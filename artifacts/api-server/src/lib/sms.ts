import nodemailer from "nodemailer";

const BREVO_API = "https://api.brevo.com/v3/transactionalSMS/sms";

function whatsappLink(phone: string, message: string): string {
  let e164 = phone.replace(/\s+/g, "");
  if (!e164.startsWith("+")) e164 = "+254" + e164.replace(/^0/, "");
  const clean = e164.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

function notificationHtml(message: string, waLink: string): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#16a34a;padding:16px 20px">
    <span style="color:#fff;font-weight:700;font-size:16px">🌱 Investa Farm</span>
  </div>
  <div style="padding:24px 20px">
    <p style="font-size:15px;color:#111827;line-height:1.6;margin:0 0 20px">${message}</p>
    <a href="${waLink}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">
      💬 Open in WhatsApp
    </a>
  </div>
  <div style="padding:12px 20px;background:#f3f4f6;font-size:12px;color:#6b7280">
    Sent via email because no SMS provider is configured. Tap the button above to reply on WhatsApp.
  </div>
</div>`;
}

async function sendViaResend(toEmail: string, message: string, phone: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const fromAddr = process.env.RESEND_FROM_EMAIL ?? "Investa Farm <onboarding@resend.dev>";
  const html = notificationHtml(message, whatsappLink(phone, message));
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddr, to: toEmail, subject: "Investa Farm Notification", html, text: message }),
    });
    if (resp.ok) {
      console.info(`[SMS→RESEND] ${toEmail}: "${message.slice(0, 60)}…"`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function sendViaGmail(toEmail: string, message: string, phone: string): Promise<boolean> {
  const user = process.env.GOOGLE_SMTP_USER;
  const pass = process.env.GOOGLE_SMTP_PASS;
  if (!user || !pass) return false;
  const html = notificationHtml(message, whatsappLink(phone, message));
  try {
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transporter.sendMail({
      from: `"Investa Farm" <${user}>`,
      to: toEmail,
      subject: "Investa Farm Notification",
      text: message,
      html,
    });
    console.info(`[SMS→GMAIL] ${toEmail}: "${message.slice(0, 60)}…"`);
    return true;
  } catch (err) {
    console.warn("[SMS→GMAIL] Failed:", err instanceof Error ? err.message : String(err));
    return false;
  }
}

export async function sendSms(to: string, message: string, fallbackEmail?: string): Promise<void> {
  let phone = to.replace(/\s+/g, "");
  if (!phone.startsWith("+")) phone = "+254" + phone.replace(/^0/, "");

  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    try {
      const resp = await fetch(BREVO_API, {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: "InvestaFarm", recipient: phone, content: message, type: "transactional" }),
      });
      if (resp.ok) {
        console.info(`[SMS] Sent to ${phone}: "${message.slice(0, 40)}…"`);
        return;
      }
      const body = await resp.text().catch(() => "");
      console.warn(`[SMS] Brevo error (${resp.status}): ${body}`);
    } catch (err) {
      console.warn("[SMS] Brevo network error:", err instanceof Error ? err.message : String(err));
    }
  }

  if (fallbackEmail) {
    if (await sendViaResend(fallbackEmail, message, to)) return;
    if (await sendViaGmail(fallbackEmail, message, to)) return;
  }

  console.warn(`[SMS] No delivery channel available for ${phone}. Message: "${message.slice(0, 60)}"`);
}

export async function sendWelcomeSms(phone: string, name: string, email?: string): Promise<void> {
  const firstName = name.split(" ")[0];
  await sendSms(
    phone,
    `Hi ${firstName}! Welcome to Investa Farm 🌱 Your account is set up. Verify your email to start investing in Kenyan farms. app.investafarm.com`,
    email
  );
}

export async function sendOtpSms(phone: string, code: string, email?: string): Promise<void> {
  await sendSms(phone, `Your Investa Farm verification code is: ${code}. Valid for 10 minutes. Do not share.`, email);
}

export async function sendWalletTopupSms(phone: string, amount: number, newBalance: number, email?: string): Promise<void> {
  await sendSms(
    phone,
    `InvestaFarm: KES ${amount.toLocaleString("en-KE")} added to your wallet. New balance: KES ${newBalance.toLocaleString("en-KE")}. app.investafarm.com`,
    email
  );
}

export async function sendWithdrawalSms(phone: string, amount: number, fee: number, email?: string): Promise<void> {
  await sendSms(
    phone,
    `InvestaFarm: KES ${amount.toLocaleString("en-KE")} withdrawal to M-Pesa initiated. Fee: KES ${fee.toFixed(0)}. Expect funds within 1-2 business days.`,
    email
  );
}

export async function sendInvestmentSms(phone: string, farmName: string, shares: number, amount: number, email?: string): Promise<void> {
  await sendSms(
    phone,
    `InvestaFarm: You bought ${shares} shares in ${farmName} for KES ${amount.toLocaleString("en-KE")}. Track your investment at app.investafarm.com`,
    email
  );
}

export async function sendFarmerCreditSms(phone: string, name: string, amount: number, reason: string, email?: string): Promise<void> {
  const firstName = name.split(" ")[0];
  await sendSms(
    phone,
    `Hi ${firstName}, InvestaFarm: KES ${amount.toLocaleString("en-KE")} credited to your wallet. Reason: ${reason}. app.investafarm.com`,
    email
  );
}

export async function sendVoucherSms(phone: string, code: string, farmName: string, email?: string): Promise<void> {
  await sendSms(
    phone,
    `InvestaFarm: Your voucher code ${code} for ${farmName} is ready. Redeem at app.investafarm.com`,
    email
  );
}
