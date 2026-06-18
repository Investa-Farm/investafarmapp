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
