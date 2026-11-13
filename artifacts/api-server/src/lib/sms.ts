const TALKSASA_API = "https://bulksms.talksasa.com/api/v3/sms/send";

export type SmsSendResult =
  | { status: "accepted" }
  | { status: "missing_phone" | "not_configured" | "invalid_phone" | "provider_error" | "network_error" };

function getResponsePayload(body: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function safeProviderMessage(payload: Record<string, unknown> | null, phone: string, apiToken: string): string | null {
  const message = typeof payload?.message === "string"
    ? payload.message
    : typeof payload?.error === "string"
      ? payload.error
      : null;
  if (!message) return null;

  const safeMessage = message
    .replaceAll(apiToken, "[redacted]")
    .replaceAll(phone, "[redacted number]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/\+?\d(?:[\s().-]*\d){7,14}/g, "[redacted number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return safeMessage || null;
}

function normalizePhone(to: string): string | null {
  const trimmed = to.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  else if (trimmed.startsWith("+")) {
    // Keep the explicit international country code.
  } else if (digits.startsWith("0")) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.length === 9 && /^[17]/.test(digits)) {
    digits = `254${digits}`;
  } else if (!digits.startsWith("254") && digits.length <= 10) {
    digits = `254${digits}`;
  }

  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export async function sendSms(to: string, message: string): Promise<SmsSendResult> {
  const apiToken = process.env.TALKSASA_API_TOKEN || process.env.TALKSASA_API_KEY;
  if (!apiToken) {
    console.warn("[SMS] Missing TALKSASA_API_TOKEN (or TALKSASA_API_KEY) — skipping SMS");
    return { status: "not_configured" };
  }

  const phone = normalizePhone(to);
  if (!phone) {
    console.warn("[SMS] Skipping send — phone number is not a valid international number");
    return { status: "invalid_phone" };
  }

  try {
    const resp = await fetch(TALKSASA_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        recipient: phone,
        sender_id: process.env.TALKSASA_SENDER_ID || "TALKSASA",
        type: "plain",
        message,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const responseBody = await resp.text().catch(() => "");
    const responsePayload = getResponsePayload(responseBody);
    const providerMessage = safeProviderMessage(responsePayload, phone, apiToken);
    const detail = providerMessage ? `: ${providerMessage}` : "";

    if (!resp.ok) {
      console.warn(`[SMS] TalkSasa rejected message (HTTP ${resp.status})${detail}`);
      return { status: "provider_error" };
    }

    const providerStatus = typeof responsePayload?.status === "string"
      ? responsePayload.status.toLowerCase()
      : "";
    if (
      responsePayload?.success === false ||
      responsePayload?.success === "false" ||
      ["failed", "error", "rejected"].includes(providerStatus)
    ) {
      console.warn(`[SMS] TalkSasa reported a failed message${detail}`);
      return { status: "provider_error" };
    }

    console.info("[SMS] TalkSasa accepted a transactional message");
    return { status: "accepted" };
  } catch (err) {
    console.warn("[SMS] Network error:", err instanceof Error ? err.message : String(err));
    return { status: "network_error" };
  }
}

export async function sendWelcomeSms(phone: string, name: string): Promise<void> {
  const firstName = name.split(" ")[0];
  await sendSms(
    phone,
    `Hi ${firstName}! Welcome to Investa Farm 🌱 Your account is set up. Verify your email to start investing in Kenyan farms. app.investafarm.com`
  );
}

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  await sendSms(phone, `Your Investa Farm verification code is: ${code}. Valid for 10 minutes. Do not share.`);
}

export async function sendWalletTopupSms(phone: string, amount: number, newBalance: number): Promise<void> {
  await sendSms(
    phone,
    `InvestaFarm: KES ${amount.toLocaleString("en-KE")} added to your wallet. New balance: KES ${newBalance.toLocaleString("en-KE")}. app.investafarm.com`
  );
}

export async function sendWithdrawalSms(phone: string, amount: number, fee: number): Promise<void> {
  await sendSms(
    phone,
    `InvestaFarm: Withdrawal request received. KES ${amount.toLocaleString("en-KE")} is reserved; fee KES ${fee.toFixed(0)}. No M-Pesa transfer has been sent yet.`
  );
}

export async function sendCardWithdrawalSms(phone: string, amount: number, fee: number): Promise<void> {
  await sendSms(
    phone,
    `InvestaFarm: Card withdrawal request received. KES ${amount.toLocaleString("en-KE")} is reserved; fee KES ${fee.toFixed(0)}. No card transfer has been sent yet.`
  );
}

export async function sendInvestmentSms(phone: string, farmName: string, shares: number, amount: number): Promise<SmsSendResult> {
  return sendSms(
    phone,
    `InvestaFarm: You bought ${shares} shares in ${farmName} for KES ${amount.toLocaleString("en-KE")}. Track your investment at app.investafarm.com`
  );
}

export async function sendFarmerCreditSms(phone: string, name: string, amount: number, reason: string): Promise<void> {
  const firstName = name.split(" ")[0];
  await sendSms(
    phone,
    `Hi ${firstName}, InvestaFarm: KES ${amount.toLocaleString("en-KE")} credited to your wallet. Reason: ${reason}. app.investafarm.com`
  );
}

export async function sendVoucherSms(phone: string, code: string, farmName: string): Promise<void> {
  await sendSms(
    phone,
    `InvestaFarm: Your voucher code ${code} for ${farmName} is ready. Redeem at app.investafarm.com`
  );
}

export async function sendFarmFullyFundedSms(phone: string, name: string, farmName: string, loanAmount: number): Promise<void> {
  const firstName = name.split(" ")[0];
  await sendSms(
    phone,
    `Congrats ${firstName}! Your farm "${farmName}" is now 100% funded by investors. KES ${loanAmount.toLocaleString("en-KE")} loan disbursed. Your voucher details follow. app.investafarm.com`
  );
}
