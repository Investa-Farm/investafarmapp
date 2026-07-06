const BREVO_API = "https://api.brevo.com/v3/transactionalSMS/sms";

export async function sendSms(to: string, message: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[SMS] BREVO_API_KEY not set — skipping SMS");
    return;
  }

  let phone = to.replace(/\s+/g, "");
  if (!phone.startsWith("+")) phone = "+254" + phone.replace(/^0/, "");

  try {
    const resp = await fetch(BREVO_API, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: "InvestaFarm",
        recipient: phone,
        content: message,
        type: "transactional",
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.warn(`[SMS] Brevo error (${resp.status}): ${body}`);
    } else {
      console.info(`[SMS] Sent to ${phone}: "${message.slice(0, 40)}…"`);
    }
  } catch (err) {
    console.warn("[SMS] Network error:", err instanceof Error ? err.message : String(err));
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
    `InvestaFarm: KES ${amount.toLocaleString("en-KE")} withdrawal to M-Pesa initiated. Fee: KES ${fee.toFixed(0)}. Expect funds within 1-2 business days.`
  );
}

export async function sendInvestmentSms(phone: string, farmName: string, shares: number, amount: number): Promise<void> {
  await sendSms(
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
