const TALKSASA_API = "https://bulksms.talksasa.com/api/v3/sms/send";

export async function sendSms(to: string, message: string): Promise<void> {
  const apiToken = process.env.TALKSASA_API_TOKEN;
  if (!apiToken) {
    console.warn("[SMS] TALKSASA_API_TOKEN not set — skipping SMS");
    return;
  }

  // Strip everything except digits, then normalise to Kenya 254XXXXXXXXX
  let phone = to.replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "254" + phone.slice(1);
  if (!phone.startsWith("254")) phone = "254" + phone;
  // Basic sanity: Kenya numbers are 254 + 9 digits = 12 digits total
  if (phone.length !== 12) {
    console.warn(`[SMS] Skipping send — invalid phone after normalisation: "${phone}" (from "${to}")`);
    return;
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
        sender_id: "InvestaFarm",
        message,
        recipients: [phone],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.warn(`[SMS] TalkSasa error (${resp.status}): ${body}`);
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
    `InvestaFarm: KES ${amount.toLocaleString("en-KE")} M-Pesa withdrawal initiated. Fee: KES ${fee.toFixed(0)}. Expect funds within 1-2 business days.`
  );
}

export async function sendCardWithdrawalSms(phone: string, amount: number, fee: number): Promise<void> {
  await sendSms(
    phone,
    `InvestaFarm: KES ${amount.toLocaleString("en-KE")} card withdrawal initiated. Fee: KES ${fee.toFixed(0)}. Funds arrive in 2-5 business days.`
  );
}

export async function sendUsdcWithdrawalSms(phone: string, amount: number, usdcAmount: string, fee: number): Promise<void> {
  await sendSms(
    phone,
    `InvestaFarm: ${usdcAmount} USDC (KES ${amount.toLocaleString("en-KE")}) withdrawal queued to your Polygon wallet. Fee: KES ${fee.toFixed(0)}. Usually within 30 min.`
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

export async function sendFarmFullyFundedSms(phone: string, name: string, farmName: string, loanAmount: number): Promise<void> {
  const firstName = name.split(" ")[0];
  await sendSms(
    phone,
    `Congrats ${firstName}! Your farm "${farmName}" is now 100% funded by investors. KES ${loanAmount.toLocaleString("en-KE")} loan disbursed. Your voucher details follow. app.investafarm.com`
  );
}
