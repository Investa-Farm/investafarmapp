import nodemailer from "nodemailer";

const APP_NAME = "Investa Farm";
const GRASS_GREEN = "#16a34a";
const GRASS_DARK = "#14532d";
const GRASS_MID = "#166534";

function from(label: string) {
  return `"${label}" <${process.env.GOOGLE_SMTP_USER ?? ""}>`;
}

function createTransport() {
  const user = process.env.GOOGLE_SMTP_USER;
  const pass = process.env.GOOGLE_SMTP_PASS;
  if (!user || !pass) {
    console.warn("[EMAIL] SMTP not configured — set GOOGLE_SMTP_USER and GOOGLE_SMTP_PASS secrets to enable emails");
    return null;
  }
  // Port 465 + secure:true (direct SSL) is more reliable on cloud hosts like Render/Railway
  // that may block STARTTLS (port 587). Gmail supports both.
  const raw = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  return {
    sendMail: async (opts: Parameters<typeof raw.sendMail>[0]) => {
      try {
        return await raw.sendMail(opts);
      } catch (err: unknown) {
        const subject = typeof opts === "object" && opts !== null ? (opts as { subject?: string }).subject ?? "(no subject)" : "(no subject)";
        console.error("[EMAIL] sendMail failed — subject:", subject, "| error:", err instanceof Error ? `${err.message} (code: ${(err as NodeJS.ErrnoException).code ?? "?"})` : String(err));
        console.error("[EMAIL] Hint: Verify GOOGLE_SMTP_USER and GOOGLE_SMTP_PASS are set correctly in your deployment environment.");
        throw err;
      }
    },
  };
}

export async function testSmtpConnection(): Promise<void> {
  const user = process.env.GOOGLE_SMTP_USER;
  const pass = process.env.GOOGLE_SMTP_PASS;
  if (!user || !pass) {
    console.warn("[EMAIL] SMTP not configured — emails will be skipped (set GOOGLE_SMTP_USER + GOOGLE_SMTP_PASS to enable)");
    return;
  }
  try {
    const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass }, tls: { rejectUnauthorized: false }, connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000 });
    await t.verify();
    console.info("[EMAIL] SMTP connection verified OK — emails will be sent");
  } catch (err: unknown) {
    console.error("[EMAIL] SMTP connection FAILED at startup:", err instanceof Error ? `${err.message} (code: ${(err as NodeJS.ErrnoException).code ?? "?"})` : String(err));
    console.error("[EMAIL] Emails will NOT be sent until this is fixed. Check GOOGLE_SMTP_USER, GOOGLE_SMTP_PASS, and Gmail App Password configuration.");
  }
}

// Logo image for email header
const LOGO_SVG = `
<table cellpadding="0" cellspacing="0" style="margin:0 auto 12px auto;">
  <tr>
    <td align="center">
      <img src="https://www.investafarm.com/Investa_8_-removebg-preview%20(1).png"
           alt="Investa Farm" width="90" height="90"
           style="display:block;border:0;outline:none;text-decoration:none;" />
    </td>
  </tr>
  <tr>
    <td align="center" style="padding-top:6px;">
      <p style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;margin:0;line-height:1.1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Investa Farm</p>
      <p style="color:rgba(255,255,255,0.60);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin:5px 0 0 0;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">AFRICA'S FARM EXCHANGE</p>
    </td>
  </tr>
</table>`;

function emailWrapper(content: string, preheader = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:24px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(22,163,74,0.10);">

        <!-- Header — grass green -->
        <tr>
          <td style="background:linear-gradient(135deg,${GRASS_DARK} 0%,${GRASS_GREEN} 100%);padding:32px 40px 24px;text-align:center;">
            ${LOGO_SVG}
          </td>
        </tr>

        <!-- Content -->
        ${content}

        <!-- Footer -->
        <tr>
          <td style="background:#f0fdf4;padding:20px 40px 24px;border-top:1px solid #bbf7d0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:center;padding-bottom:10px;">
                  <a href="https://chat.whatsapp.com/BWfnSpL4GTl0EsFpuPMKOK"
                    style="display:inline-block;background:#25D366;color:#ffffff;font-size:11px;font-weight:700;text-decoration:none;padding:7px 18px;border-radius:20px;margin-bottom:4px;">
                    💬 Join our WhatsApp Community
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <p style="color:#6b7280;font-size:11px;margin:0 0 4px 0;text-align:center;">
                    <strong style="color:#374151;">Investa Farm Ltd</strong> · Nairobi, Kenya
                  </p>
                  <p style="color:#9ca3af;font-size:10px;margin:0 0 3px 0;text-align:center;">
                    Regulated by the Capital Markets Authority of Kenya &nbsp;·&nbsp;
                    <a href="mailto:investafarm@proton.me" style="color:${GRASS_GREEN};text-decoration:none;">investafarm@proton.me</a>
                  </p>
                  <p style="color:#d1d5db;font-size:10px;margin:0;text-align:center;">
                    This is an automated message. Please do not reply directly to this email. &nbsp;·&nbsp;
                    <a href="#" style="color:#9ca3af;text-decoration:none;">Unsubscribe</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationReminderEmail(
  to: string,
  name: string,
  daysSince: number
): Promise<void> {
  const transport = createTransport();
  if (!transport) return;

  const isUrgent = daysSince >= 14;
  const urgencyLabel = isUrgent ? "⚠️ Action Required" : "📧 Friendly Reminder";
  const subject = isUrgent
    ? `⚠️ Verify your Investa Farm email — account at risk`
    : `Reminder: Verify your Investa Farm email`;

  const content = `
    <tr>
      <td style="padding:32px 40px;">
        <h2 style="color:#111827;font-size:22px;font-weight:800;margin:0 0 8px 0;">${urgencyLabel}</h2>
        <h3 style="color:${GRASS_GREEN};font-size:17px;font-weight:700;margin:0 0 20px 0;">Verify Your Email Address</h3>
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
          Hi <strong>${name}</strong>,<br><br>
          You registered on <strong>Investa Farm</strong> ${Math.round(daysSince)} days ago but haven't verified your email yet.
        </p>

        ${isUrgent ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
          <p style="color:#991b1b;font-size:13px;font-weight:700;margin:0 0 6px 0;">⚠️ Your account may be restricted</p>
          <p style="color:#b91c1c;font-size:13px;margin:0;line-height:1.5;">
            Unverified accounts cannot complete investments, withdraw funds, or access full platform features.
            Verify now to keep your account in good standing.
          </p>
        </div>` : `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
          <p style="color:#92400e;font-size:13px;font-weight:700;margin:0 0 6px 0;">Why verify your email?</p>
          <ul style="color:#78350f;font-size:13px;line-height:1.8;margin:0;padding-left:16px;">
            <li>Protect your account from unauthorised access</li>
            <li>Receive price alerts and farm updates</li>
            <li>Enable withdrawals and portfolio features</li>
            <li>Get your weekly investment opportunity digest</li>
          </ul>
        </div>`}

        <table cellpadding="0" cellspacing="0" style="margin:24px auto;">
          <tr>
            <td align="center" style="background:linear-gradient(135deg,${GRASS_DARK},${GRASS_GREEN});border-radius:12px;padding:1px;">
              <a href="https://investafarm.co.ke/verify-otp" style="display:inline-block;background:linear-gradient(135deg,${GRASS_DARK},${GRASS_GREEN});color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 36px;border-radius:12px;">
                ✅ Verify My Email Now
              </a>
            </td>
          </tr>
        </table>

        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0 0;line-height:1.6;">
          If you didn't create an Investa Farm account, you can safely ignore this email.<br>
          Questions? <a href="mailto:investafarm@proton.me" style="color:${GRASS_GREEN};">investafarm@proton.me</a>
        </p>
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm"),
    to,
    subject,
    replyTo: "investafarm@proton.me",
    headers: { "X-Mailer": "Investa Farm Platform", "List-Unsubscribe": `<mailto:investafarm@proton.me?subject=Unsubscribe>` },
    html: emailWrapper(content, `Verify your Investa Farm email to unlock all platform features.`),
  });
}

function statCard(icon: string, label: string, value: string, color = GRASS_GREEN) {
  return `
    <td align="center" style="padding:0 6px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 12px;text-align:center;min-width:100px;">
        <p style="font-size:24px;margin:0 0 4px 0;">${icon}</p>
        <p style="font-size:18px;font-weight:800;color:${color};margin:0 0 2px 0;">${value}</p>
        <p style="font-size:10px;color:#9ca3af;margin:0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${label}</p>
      </div>
    </td>`;
}

function ctaButton(text: string, url: string, gradient = `linear-gradient(135deg,${GRASS_DARK},${GRASS_GREEN})`) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0;">
          <a href="${url}" style="display:inline-block;background:${gradient};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.3px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

// ─── FIRST INVESTMENT CONGRATULATION EMAIL ───────────────────────────────────
export async function sendFirstInvestmentEmail(
  to: string, name: string, farmName: string, amount: number
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] First investment congrats for ${to} (SMTP not configured)`);
    return;
  }
  const fmt = (n: number) => `KES ${new Intl.NumberFormat("en-KE").format(Math.round(n))}`;

  const content = `
    <tr>
      <td style="padding:0;">
        <!-- Fiesta hero -->
        <div style="background:linear-gradient(160deg,${GRASS_DARK} 0%,${GRASS_GREEN} 100%);padding:36px 40px;text-align:center;border-bottom:4px solid #4ade80;">
          <p style="font-size:52px;margin:0 0 8px 0;">🎊🌾🎉</p>
          <h1 style="color:#ffffff;font-size:26px;font-weight:900;margin:0 0 10px 0;">¡Felicidades, ${name}!</h1>
          <div style="background:rgba(255,255,255,0.12);border-radius:12px;padding:12px 20px;display:inline-block;margin:0 0 10px 0;">
            <p style="color:rgba(255,255,255,0.65);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 4px 0;">en Español significa</p>
            <p style="color:#ffffff;font-size:14px;font-style:italic;margin:0;">"Congratulations on your first investment!" 🥳</p>
            <p style="color:rgba(255,255,255,0.6);font-size:11px;margin:4px 0 0 0;">...because your money is rich enough to speak two languages now! 😄</p>
          </div>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:36px 40px;">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
          You just made history — well, <em>your</em> financial history! Your first farm investment is confirmed and your money is already hard at work in the Kenyan soil. 🌱
        </p>

        <!-- Investment summary card -->
        <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:20px;padding:28px;text-align:center;margin:0 0 28px 0;">
          <p style="color:${GRASS_MID};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px 0;">Your First Investment</p>
          <p style="color:${GRASS_DARK};font-size:28px;font-weight:900;margin:0 0 4px 0;">${fmt(amount)}</p>
          <p style="color:#4b5563;font-size:14px;margin:0;">in <strong>${farmName}</strong></p>
          <div style="margin-top:16px;background:#ffffff;border-radius:12px;padding:10px 16px;display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
            <p style="color:${GRASS_MID};font-size:13px;font-weight:700;margin:0;">🏅 First Investor Badge Earned!</p>
          </div>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
          <tr>
            ${statCard("⚡", "Mid-Season", "+10%")}
            ${statCard("🌾", "Full Season", "+22%")}
            ${statCard("📅", "Harvest", "~6 Months")}
          </tr>
        </table>

        <!-- What's next -->
        <div style="background:#f8faf8;border:1px solid #e5ede5;border-radius:16px;padding:24px;margin:0 0 28px 0;">
          <p style="color:#111827;font-weight:700;font-size:15px;margin:0 0 14px 0;">🗺️ What happens next?</p>
          ${[
            "Your farm manager begins the growing cycle immediately",
            "Track real-time progress from your portfolio dashboard",
            "Receive mid-season updates with field photos",
            "Harvest payout lands in your Investa Wallet — M-Pesa ready!",
          ].map(t => `
          <p style="color:#374151;font-size:14px;margin:0 0 8px 0;padding-left:20px;position:relative;">
            <span style="color:${GRASS_GREEN};position:absolute;left:0;font-weight:700;">✓</span> ${t}
          </p>`).join("")}
        </div>

        ${ctaButton("🌾 Track My Investment →", "https://investafarm.co.ke/portfolio")}

        <p style="color:#9ca3af;font-size:12px;margin:20px 0 0 0;text-align:center;font-style:italic;">
          Pro tip: Diversify across 3–5 farms for the best risk-adjusted returns. ¡Buena suerte! 🍀
        </p>
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm"),
    to,
    subject: `🎊 ¡Felicidades! Your first farm investment is confirmed, ${name}!`,
    html: emailWrapper(content, `Your first investment of ${fmt(amount)} in ${farmName} is confirmed. ¡Felicidades!`),
  });
}

// ─── OTP EMAIL ───────────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] Password reset for ${to}: ${resetUrl} (SMTP not configured)`);
    return;
  }

  const content = `
    <tr>
      <td style="padding:40px 40px 32px;">
        <h1 style="color:#111827;font-size:24px;font-weight:800;margin:0 0 8px 0;">Reset your password 🔑</h1>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px 0;">Hi <strong style="color:#111827;">${name}</strong>, we received a request to reset your Investa Farm password. Click the button below to choose a new password.</p>

        <div style="text-align:center;margin:0 0 28px 0;">
          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:14px;box-shadow:0 4px 14px rgba(22,163,74,0.35);">
            Reset Password
          </a>
        </div>

        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:16px;margin:0 0 24px 0;">
          <p style="color:#166534;font-size:13px;margin:0 0 6px 0;">🔗 Or copy this link into your browser:</p>
          <p style="color:#15803d;font-size:12px;word-break:break-all;margin:0;font-family:Courier,monospace;">${resetUrl}</p>
        </div>

        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin:0 0 24px 0;">
          <p style="color:#92400e;font-size:13px;margin:0;">⏱ <strong>This link expires in 1 hour.</strong> If you didn't request a password reset, you can safely ignore this email — your account is not at risk.</p>
        </div>

        <p style="color:#9ca3af;font-size:13px;margin:0;">For your security, never share this link with anyone.</p>
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm Security"),
    to,
    subject: `Reset your Investa Farm password`,
    html: emailWrapper(content, "Reset your Investa Farm password — link expires in 1 hour."),
  });
}

export async function sendOtpEmail(to: string, name: string, code: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] OTP for ${to}: ${code} (SMTP not configured)`);
    return;
  }

  const content = `
    <tr>
      <td style="padding:40px 40px 32px;">
        <h1 style="color:#111827;font-size:24px;font-weight:800;margin:0 0 8px 0;">Verify your email ✉️</h1>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px 0;">Hi <strong style="color:#111827;">${name}</strong>, welcome to Investa Farm! Enter the code below to confirm your email address and activate your account.</p>

        <!-- OTP Box -->
        <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:16px;padding:32px;text-align:center;margin:0 0 24px 0;">
          <p style="color:${GRASS_MID};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px 0;">Your Verification Code</p>
          <div style="background:#ffffff;border-radius:12px;padding:20px;display:inline-block;margin:0 auto;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
            <span style="font-size:44px;font-weight:900;letter-spacing:16px;color:${GRASS_DARK};font-family:Courier,monospace;">${code}</span>
          </div>
          <p style="color:${GRASS_MID};font-size:12px;margin:12px 0 0 0;">⏱ Expires in <strong>10 minutes</strong></p>
        </div>

        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin:0 0 24px 0;">
          <p style="color:#92400e;font-size:13px;margin:0;">🔒 <strong>Security tip:</strong> Never share this code with anyone. Investa Farm staff will never ask for your OTP.</p>
        </div>

        <p style="color:#9ca3af;font-size:13px;margin:0;">Didn't request this? You can safely ignore this email — your account is protected.</p>
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm Verification"),
    to,
    subject: `${code} is your Investa Farm verification code`,
    html: emailWrapper(content, `Your ${code} verification code expires in 10 minutes.`),
  });
}

// ─── WELCOME EMAIL ────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(to: string, name: string, role: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] Welcome email for ${to} (SMTP not configured)`);
    return;
  }

  const isFarmer = role === "farmer";
  const roleLabel = isFarmer ? "Farmer" : role === "investor" ? "Investor" : "Partner";
  const heroEmoji = isFarmer ? "🌾" : "📈";

  const steps = isFarmer
    ? [
        { icon: "🪪", text: "Upload your <strong>National ID + farm documents</strong> for KYC verification" },
        { icon: "📋", text: "Apply for <strong>farm investment capital</strong> from your dashboard" },
        { icon: "🚀", text: "Get listed on the investor market and <strong>attract real investors</strong>" },
        { icon: "💰", text: "Receive funding and <strong>retain 55% of all harvest revenue</strong>" },
      ]
    : [
        { icon: "🪪", text: "Complete <strong>KYC verification</strong> with your National ID + selfie" },
        { icon: "💳", text: "<strong>Top up your Investa Wallet</strong> via M-Pesa or card" },
        { icon: "🌾", text: "Browse the <strong>Live Market</strong> and invest in verified Kenyan farms" },
        { icon: "📈", text: "<strong>Earn harvest returns</strong> of up to +22% paid to your M-Pesa" },
      ];

  const stepsHtml = steps.map((s) => `
    <tr>
      <td style="padding:10px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="44" style="vertical-align:top;">
              <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,${GRASS_DARK},${GRASS_GREEN});text-align:center;line-height:36px;font-size:16px;">
                ${s.icon}
              </div>
            </td>
            <td style="vertical-align:middle;padding-left:12px;">
              <p style="color:#374151;font-size:14px;margin:0;line-height:1.5;">${s.text}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  // For farmers: show opportunity image/banner
  const farmerOpportunityBanner = isFarmer ? `
    <div style="background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);border-radius:16px;padding:24px;margin:0 0 24px 0;text-align:center;">
      <p style="color:rgba(255,255,255,0.8);font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px 0;">YOUR EARNING POTENTIAL</p>
      <p style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 4px 0;">55% Revenue Share</p>
      <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:0 0 16px 0;">Keep the majority of every harvest — always.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;padding:0 8px;">
            <p style="color:#4ade80;font-size:16px;font-weight:800;margin:0;">2–5 Days</p>
            <p style="color:rgba(255,255,255,0.6);font-size:10px;margin:2px 0 0 0;text-transform:uppercase;letter-spacing:0.5px;">Fund Timeline</p>
          </td>
          <td style="text-align:center;padding:0 8px;border-left:1px solid rgba(255,255,255,0.2);border-right:1px solid rgba(255,255,255,0.2);">
            <p style="color:#4ade80;font-size:16px;font-weight:800;margin:0;">Active</p>
            <p style="color:rgba(255,255,255,0.6);font-size:10px;margin:2px 0 0 0;text-transform:uppercase;letter-spacing:0.5px;">Investors Now</p>
          </td>
          <td style="text-align:center;padding:0 8px;">
            <p style="color:#4ade80;font-size:16px;font-weight:800;margin:0;">No Loans</p>
            <p style="color:rgba(255,255,255,0.6);font-size:10px;margin:2px 0 0 0;text-transform:uppercase;letter-spacing:0.5px;">No Bank Debt</p>
          </td>
        </tr>
      </table>
    </div>` : `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
      <tr>
        ${statCard("📈", "Max Returns", "+22%")}
        ${statCard("💰", "Min. Invest", "KES 5K")}
        ${statCard("🛡️", "Protection", "Insured")}
      </tr>
    </table>`;

  const content = `
    <tr>
      <td style="padding:0;">
        <!-- Hero banner -->
        <div style="background:linear-gradient(160deg,${GRASS_DARK} 0%,${GRASS_MID} 100%);padding:32px 40px;text-align:center;border-bottom:4px solid ${GRASS_GREEN};">
          <p style="font-size:52px;margin:0 0 8px 0;">${heroEmoji}</p>
          <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0 0 6px 0;">Welcome, ${name}!</h1>
          <p style="color:rgba(255,255,255,0.75);font-size:15px;margin:0;">Your ${roleLabel} account is ready. Let's get started.</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:36px 40px;">
        ${farmerOpportunityBanner}

        <div style="background:#f8faf8;border:1px solid #e5ede5;border-radius:16px;padding:24px;margin:0 0 28px 0;">
          <p style="color:#111827;font-weight:700;font-size:16px;margin:0 0 16px 0;">🗺️ Your next steps:</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tbody>${stepsHtml}</tbody>
          </table>
        </div>

        ${ctaButton(isFarmer ? "Open Farmer Dashboard →" : "Browse Live Farms →", "https://investafarm.co.ke")}

        ${!isFarmer ? `
        <!-- Crop image grid for investors -->
        <div style="margin:0 0 24px 0;">
          <p style="color:#374151;font-size:13px;font-weight:700;margin:0 0 12px 0;">🌾 Farms accepting investment right now:</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 4px 8px 0;width:33.3%;">
                <div style="border-radius:10px;overflow:hidden;position:relative;">
                  <img src="https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=180&h=110&fit=crop&auto=format" alt="Maize" style="width:100%;height:80px;object-fit:cover;display:block;" />
                  <div style="background:rgba(0,0,0,0.5);padding:4px 6px;text-align:center;">
                    <p style="color:#fff;font-size:10px;font-weight:700;margin:0;">🌽 Maize</p>
                    <p style="color:#4ade80;font-size:9px;margin:0;">+18% p.a.</p>
                  </div>
                </div>
              </td>
              <td style="padding:0 4px 8px;width:33.3%;">
                <div style="border-radius:10px;overflow:hidden;">
                  <img src="https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=180&h=110&fit=crop&auto=format" alt="Coffee" style="width:100%;height:80px;object-fit:cover;display:block;" />
                  <div style="background:rgba(0,0,0,0.5);padding:4px 6px;text-align:center;">
                    <p style="color:#fff;font-size:10px;font-weight:700;margin:0;">☕ Coffee</p>
                    <p style="color:#4ade80;font-size:9px;margin:0;">+22% p.a.</p>
                  </div>
                </div>
              </td>
              <td style="padding:0 0 8px 4px;width:33.3%;">
                <div style="border-radius:10px;overflow:hidden;">
                  <img src="https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=180&h=110&fit=crop&auto=format" alt="Avocado" style="width:100%;height:80px;object-fit:cover;display:block;" />
                  <div style="background:rgba(0,0,0,0.5);padding:4px 6px;text-align:center;">
                    <p style="color:#fff;font-size:10px;font-weight:700;margin:0;">🥑 Avocado</p>
                    <p style="color:#4ade80;font-size:9px;margin:0;">+20% p.a.</p>
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </div>` : ""}

        <p style="color:#9ca3af;font-size:12px;margin:20px 0 0 0;text-align:center;">
          Need help? Email us at <a href="mailto:investafarm@proton.me" style="color:${GRASS_GREEN};text-decoration:none;">investafarm@proton.me</a> or join our
          <a href="https://chat.whatsapp.com/BWfnSpL4GTl0EsFpuPMKOK" style="color:${GRASS_GREEN};text-decoration:none;"> WhatsApp community</a>.
        </p>
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm"),
    replyTo: `"Investa Farm Support" <investafarm@proton.me>`,
    to,
    subject: `🌾 Welcome to Investa Farm, ${name}! Your ${roleLabel} account is ready`,
    html: emailWrapper(content, `Your ${roleLabel} account is now active. Here's how to get started in 4 easy steps.`),
    headers: {
      "X-Priority": "3",
      "List-Unsubscribe": "<mailto:investafarm@proton.me?subject=unsubscribe>",
      "X-Entity-Ref-ID": `investa-welcome-${Date.now()}`,
    },
  });
}

// ─── KYC APPROVED ────────────────────────────────────────────────────────────
export async function sendKycApprovedEmail(to: string, name: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] KYC approved email for ${to} (SMTP not configured)`);
    return;
  }

  const content = `
    <tr>
      <td style="padding:0;">
        <div style="background:linear-gradient(135deg,${GRASS_DARK} 0%,${GRASS_GREEN} 100%);padding:40px;text-align:center;">
          <div style="background:rgba(255,255,255,0.15);border-radius:50%;width:72px;height:72px;margin:0 auto 16px;line-height:72px;text-align:center;">
            <span style="font-size:36px;">✅</span>
          </div>
          <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0 0 8px 0;">KYC Approved!</h1>
          <p style="color:rgba(255,255,255,0.8);font-size:15px;margin:0;">Your identity has been verified, ${name}</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
          Great news! Our compliance team has reviewed and approved your KYC documents. You now have <strong>full access</strong> to the Investa Farm platform with no restrictions.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
          <tr>
            ${statCard("🔓", "Status", "Verified", GRASS_GREEN)}
            ${statCard("🌾", "Market Access", "Full", GRASS_GREEN)}
            ${statCard("⚡", "Limits", "None", GRASS_GREEN)}
          </tr>
        </table>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;padding:24px;margin:0 0 28px 0;">
          <p style="color:${GRASS_MID};font-weight:700;font-size:15px;margin:0 0 12px 0;">🎉 What's now unlocked for you:</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${["Invest in any farm on the Primary Market", "Trade shares on the Secondary Market", "Request exits and receive M-Pesa payouts", "Access unlimited investment amounts"].map(t => `
            <tr><td style="padding:6px 0;">
              <span style="color:${GRASS_GREEN};font-weight:700;">✓</span>
              <span style="color:#374151;font-size:14px;margin-left:8px;">${t}</span>
            </td></tr>`).join("")}
          </table>
        </div>

        ${ctaButton("🚀 Start Investing Now →", "https://investafarm.co.ke/market")}
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm Compliance"),
    to,
    subject: `✅ KYC Approved — You're fully verified on Investa Farm!`,
    html: emailWrapper(content, "Your identity is verified. You now have full access to invest in Kenyan farms."),
  });
}

// ─── KYC REJECTED ────────────────────────────────────────────────────────────
export async function sendKycRejectedEmail(to: string, name: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] KYC rejected email for ${to} (SMTP not configured)`);
    return;
  }

  const content = `
    <tr>
      <td style="padding:0;">
        <div style="background:linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%);padding:40px;text-align:center;">
          <p style="font-size:48px;margin:0 0 12px 0;">🔄</p>
          <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 8px 0;">KYC Update Required</h1>
          <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:0;">We need clearer documents from you, ${name}</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
          Our compliance team reviewed your documents but was unable to complete verification at this time. Don't worry — this is common on first submission. Please re-upload with the fixes below.
        </p>

        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:16px;padding:24px;margin:0 0 24px 0;">
          <p style="color:#991b1b;font-weight:700;font-size:15px;margin:0 0 12px 0;">⚠️ Common reasons for rejection:</p>
          ${["Document image was blurry or poorly lit — retake in good lighting", "ID was expired — use a current, valid National ID", "Selfie did not clearly match the ID photo — ensure clear face visibility", "Document was cut off — capture the full document edges", "Wrong document type submitted"].map(r => `
          <p style="color:#374151;font-size:14px;margin:0 0 8px 0;padding-left:20px;position:relative;">
            <span style="color:#dc2626;position:absolute;left:0;">•</span> ${r}
          </p>`).join("")}
        </div>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:0 0 28px 0;">
          <p style="color:${GRASS_MID};font-size:14px;margin:0;">💡 <strong>Tip:</strong> Take photos in bright natural light, hold the document flat, and ensure all four corners are visible.</p>
        </div>

        ${ctaButton("📄 Re-submit KYC Documents →", "https://investafarm.co.ke/kyc", "linear-gradient(135deg,#7f1d1d,#dc2626)")}

        <p style="color:#9ca3af;font-size:13px;margin:20px 0 0 0;text-align:center;">
          If you believe this is a mistake, reply to this email and we'll investigate within 24 hours.
        </p>
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm Compliance"),
    to,
    subject: `⚠️ KYC Action Required — Please re-submit your documents`,
    html: emailWrapper(content, "Your KYC documents need to be resubmitted with clearer photos. Here's what to fix."),
  });
}

// ─── FUNDING VOUCHER ─────────────────────────────────────────────────────────
export async function sendFundingVoucherEmail(
  to: string, name: string, amount: number, farmName: string, voucherCode: string,
  inputAmount: number, supplierName?: string, supplierLocation?: string, supplierPhone?: string,
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] Funding voucher for ${to}: ${voucherCode} (SMTP not configured)`);
    return;
  }
  const fmt = (n: number) => `KES ${new Intl.NumberFormat("en-KE").format(Math.round(n))}`;
  const lockedAmount = amount - inputAmount;

  const supplierBlock = supplierName ? `
    <div style="background:#fff7ed;border:2px solid #fed7aa;border-radius:16px;padding:24px;margin:0 0 24px 0;">
      <p style="color:#92400e;font-weight:700;font-size:15px;margin:0 0 12px 0;">📍 Your Assigned Input Supplier</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;">
          <span style="color:#374151;font-size:15px;font-weight:700;">${supplierName}</span>
        </td></tr>
        ${supplierLocation ? `<tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:14px;">📍 ${supplierLocation}</span></td></tr>` : ""}
        ${supplierPhone ? `<tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:14px;">📞 ${supplierPhone}</span></td></tr>` : ""}
        <tr><td style="padding:12px 0 0 0;">
          <p style="color:#9a3412;font-size:13px;margin:0;background:#fffbeb;border-radius:8px;padding:10px;">
            Present your voucher code at this location to redeem <strong>${fmt(inputAmount)}</strong> worth of farm inputs.
          </p>
        </td></tr>
      </table>
    </div>` : "";

  const content = `
    <tr>
      <td style="padding:0;">
        <div style="background:linear-gradient(135deg,${GRASS_DARK} 0%,${GRASS_GREEN} 100%);padding:40px;text-align:center;">
          <p style="font-size:48px;margin:0 0 12px 0;">🎉</p>
          <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 8px 0;">Funding Approved!</h1>
          <p style="color:rgba(255,255,255,0.8);font-size:15px;margin:0;">${fmt(amount)} approved for ${farmName}</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
          Congratulations, <strong>${name}</strong>! Your funding application for <strong>${farmName}</strong> has been approved by investors. Here is your input voucher:
        </p>

        <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px dashed #86efac;border-radius:20px;padding:32px;text-align:center;margin:0 0 28px 0;">
          <p style="color:${GRASS_MID};font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px 0;">Input Voucher Code</p>
          <div style="background:#ffffff;border-radius:12px;padding:16px 24px;display:inline-block;box-shadow:0 4px 16px rgba(0,0,0,0.08);margin:0 0 12px 0;">
            <span style="font-size:32px;font-weight:900;letter-spacing:10px;color:${GRASS_DARK};font-family:Courier,monospace;">${voucherCode}</span>
          </div>
          <p style="color:${GRASS_GREEN};font-size:18px;font-weight:800;margin:0;">Redeemable for ${fmt(inputAmount)}</p>
        </div>

        ${supplierBlock}

        <div style="background:#f8faf8;border:1px solid #e5ede5;border-radius:16px;padding:24px;margin:0 0 28px 0;">
          <p style="color:#111827;font-weight:700;font-size:15px;margin:0 0 16px 0;">💰 Capital Breakdown</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr style="border-bottom:1px solid #e5ede5;">
              <td style="padding:10px 0;color:#374151;font-size:14px;">Total Approved</td>
              <td style="padding:10px 0;color:#111827;font-weight:700;font-size:14px;text-align:right;">${fmt(amount)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5ede5;">
              <td style="padding:10px 0;color:#374151;font-size:14px;">Input Voucher (use now)</td>
              <td style="padding:10px 0;color:${GRASS_GREEN};font-weight:700;font-size:14px;text-align:right;">${fmt(inputAmount)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#374151;font-size:14px;">Locked until milestone</td>
              <td style="padding:10px 0;color:#6b7280;font-weight:700;font-size:14px;text-align:right;">${fmt(lockedAmount)}</td>
            </tr>
          </table>
        </div>

        ${ctaButton("View Farm Dashboard →", "https://investafarm.co.ke/farmer/dashboard")}
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm Funding"),
    to,
    subject: `🌾 ${fmt(amount)} Funding Approved — Your voucher for ${farmName} is ready`,
    html: emailWrapper(content, `Your farm funding of ${fmt(amount)} is approved. Redeem your ${fmt(inputAmount)} input voucher now.`),
  });
}

// ─── KYC UNDER REVIEW ────────────────────────────────────────────────────────
export async function sendKycUnderReviewEmail(to: string, name: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] KYC under-review email for ${to} (SMTP not configured)`);
    return;
  }

  const content = `
    <tr>
      <td style="padding:0;">
        <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:40px;text-align:center;">
          <p style="font-size:48px;margin:0 0 12px 0;">🔍</p>
          <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 8px 0;">Documents Under Review</h1>
          <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:0;">We've received everything, ${name}</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
          Our compliance team has received all your verification documents and is now carefully reviewing them.
        </p>

        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:16px;padding:28px;margin:0 0 24px 0;text-align:center;">
          <p style="color:#1d4ed8;font-size:32px;margin:0 0 8px 0;">⏳</p>
          <p style="color:#1e40af;font-weight:700;font-size:17px;margin:0 0 4px 0;">Review in Progress</p>
          <p style="color:#3b82f6;font-size:13px;margin:0;">Typical review time: <strong>24–48 hours</strong></p>
        </div>

        <div style="background:#f8faf8;border:1px solid #e5ede5;border-radius:16px;padding:20px;margin:0 0 28px 0;">
          <p style="color:#374151;font-weight:600;font-size:14px;margin:0 0 10px 0;">While you wait, you can:</p>
          ${["Explore the live market to see available farms", "Set up your wallet for instant investing once approved", "Browse our investment guide in the app"].map(t => `
          <p style="color:#6b7280;font-size:14px;margin:0 0 8px 0;padding-left:16px;">
            <span style="color:${GRASS_GREEN};">→</span> ${t}
          </p>`).join("")}
        </div>

        ${ctaButton("Explore the Market →", "https://investafarm.co.ke/market", `linear-gradient(135deg,#1e40af,#3b82f6)`)}

        <p style="color:#9ca3af;font-size:13px;margin:20px 0 0 0;text-align:center;">
          You'll receive an email as soon as your review is complete.
        </p>
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm Compliance"),
    to,
    subject: `🔍 Your KYC documents are under review — expect approval in 24–48 hrs`,
    html: emailWrapper(content, "We've received your documents. Our team will review within 24–48 hours."),
  });
}

// ─── KYC SUBMITTED ADMIN NOTIFICATION ────────────────────────────────────────
export async function sendKycSubmittedNotification(adminEmail: string, userName: string, userEmail: string, docType: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] KYC notification for admin (SMTP not configured)`);
    return;
  }

  const content = `
    <tr>
      <td style="padding:32px 40px;">
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;margin:0 0 20px 0;">
          <p style="color:#92400e;font-weight:700;font-size:14px;margin:0;">🔔 New KYC Document Awaiting Review</p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5ede5;border-radius:12px;overflow:hidden;">
          ${[["User", userName], ["Email", userEmail], ["Document Type", docType], ["Submitted", new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })]].map(([k, v]) => `
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:13px;font-weight:600;width:140px;">${k}</td>
            <td style="padding:12px 16px;color:#111827;font-size:14px;font-weight:500;">${v}</td>
          </tr>`).join("")}
        </table>
        <p style="color:#9ca3af;font-size:13px;margin:16px 0 0 0;">Log in to the admin panel to review and approve or reject this submission.</p>
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm Admin Alerts"),
    to: adminEmail,
    subject: `[Admin] New KYC Upload — ${userName} (${docType})`,
    html: emailWrapper(content, `${userName} has uploaded a new KYC document: ${docType}`),
  });
}

// ─── PRICE ALERT ─────────────────────────────────────────────────────────────
export async function sendPriceAlertEmail(to: string, name: string, farmName: string, cropType: string, oldPrice: number, newPrice: number, changePercent: number): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] Price alert for ${to}: ${farmName} ${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}% (SMTP not configured)`);
    return;
  }

  const isUp = changePercent > 0;
  const fmt = (n: number) => `KES ${new Intl.NumberFormat("en-KE").format(Math.round(n))}`;
  const absChange = Math.abs(changePercent);
  const headerBg = isUp
    ? `linear-gradient(135deg,${GRASS_DARK} 0%,${GRASS_GREEN} 100%)`
    : "linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%)";

  const content = `
    <tr>
      <td style="padding:0;">
        <div style="background:${headerBg};padding:40px;text-align:center;">
          <p style="font-size:48px;margin:0 0 12px 0;">${isUp ? "📈" : "📉"}</p>
          <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 8px 0;">
            ${isUp ? "Price Surge Alert!" : "Price Drop Alert!"}
          </h1>
          <p style="color:rgba(255,255,255,0.85);font-size:15px;margin:0;">${farmName} · ${cropType}</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
          Hi <strong>${name}</strong>, a farm in your portfolio has moved by more than <strong>5%</strong>. Here are the details:
        </p>

        <div style="background:#f8faf8;border:1px solid #e5ede5;border-radius:20px;padding:28px;margin:0 0 24px 0;text-align:center;">
          <p style="color:#6b7280;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 16px 0;">${farmName}</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="text-align:center;padding:0 12px;">
                <p style="color:#9ca3af;font-size:11px;margin:0 0 4px 0;">Previous</p>
                <p style="color:#374151;font-size:22px;font-weight:800;margin:0;">${fmt(oldPrice)}</p>
              </td>
              <td style="text-align:center;font-size:24px;color:#d1d5db;">→</td>
              <td style="text-align:center;padding:0 12px;">
                <p style="color:#9ca3af;font-size:11px;margin:0 0 4px 0;">Current</p>
                <p style="color:${isUp ? GRASS_GREEN : "#dc2626"};font-size:22px;font-weight:800;margin:0;">${fmt(newPrice)}</p>
              </td>
            </tr>
          </table>
          <div style="background:${isUp ? "#f0fdf4" : "#fef2f2"};border-radius:12px;padding:12px;margin-top:16px;display:inline-block;">
            <span style="color:${isUp ? GRASS_GREEN : "#dc2626"};font-size:20px;font-weight:900;">${isUp ? "▲" : "▼"} ${absChange.toFixed(1)}%</span>
          </div>
        </div>

        ${ctaButton("View Portfolio →", "https://investafarm.co.ke/portfolio", headerBg)}
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm Price Alerts"),
    to,
    subject: `${isUp ? "📈" : "📉"} Price Alert: ${farmName} moved ${isUp ? "+" : ""}${changePercent.toFixed(1)}%`,
    html: emailWrapper(content, `${farmName} share price changed by ${isUp ? "+" : ""}${changePercent.toFixed(1)}% to ${fmt(newPrice)}.`),
  });
}

// ─── FARM UPDATE EMAIL ────────────────────────────────────────────────────────
export async function sendFarmUpdateEmail(
  to: string,
  investorName: string,
  farmName: string,
  updateTitle: string,
  updateDescription: string,
  farmId: number,
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] Farm update email for ${to} (SMTP not configured)`);
    return;
  }
  const appUrl = process.env.APP_URL ?? "https://investa.farm";
  const farmUrl = `${appUrl}/market/${farmId}`;
  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#052e16,#16a34a);font-size:28px;">🌱</div>
    </div>
    <h2 style="font-size:20px;font-weight:800;color:#111827;text-align:center;margin:0 0 6px 0;">New Field Update</h2>
    <p style="font-size:14px;color:#6b7280;text-align:center;margin:0 0 24px 0;">Your farm just posted fresh progress</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-weight:700;color:#14532d;font-size:15px;margin:0 0 8px 0;">📢 ${updateTitle}</p>
      <p style="color:#166534;font-size:13px;line-height:1.6;margin:0;">${updateDescription}</p>
    </div>

    <p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 8px 0;">
      Hi <strong>${investorName}</strong>, your investment in <strong style="color:#16a34a;">${farmName}</strong> has a new field update.
    </p>
    <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 24px 0;">
      Staying informed helps you track crop progress and make smarter exit timing decisions. Farms with active updates tend to return <strong>+12% higher yields</strong> for investors.
    </p>

    <div style="text-align:center;">
      <a href="${farmUrl}" style="display:inline-block;background:linear-gradient(135deg,#052e16,#16a34a);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 32px;border-radius:12px;letter-spacing:0.3px;">
        View Farm Update →
      </a>
    </div>
  `;
  await transport.sendMail({
    from: `"Investa Farm" <${process.env.GOOGLE_SMTP_USER ?? "noreply@investafarm.com"}>`,
    to,
    subject: `🌱 Field Update: ${farmName} — ${updateTitle}`,
    html: emailWrapper(content, `${farmName} posted a new field update: "${updateTitle}"`),
  });
}

// ─── WEEKLY OPPORTUNITY DIGEST ────────────────────────────────────────────────
export async function sendOpportunityDigest(
  to: string, name: string,
  farms: Array<{ name: string; cropType: string; location: string; sharePrice?: number | string; sharesAvailable?: number; changePercent?: number }>
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] Opportunity digest for ${to} (SMTP not configured)`);
    return;
  }

  const farmRowsHtml = farms.slice(0, 5).map(f => {
    const price = Number(f.sharePrice ?? 0);
    const change = Number(f.changePercent ?? 0);
    const isUp = change >= 0;
    return `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:14px 12px;">
          <p style="font-weight:700;color:#111827;font-size:14px;margin:0 0 2px 0;">${f.name}</p>
          <p style="color:#6b7280;font-size:12px;margin:0;">${f.cropType} · ${f.location}</p>
        </td>
        <td style="padding:14px 8px;text-align:center;">
          <span style="display:inline-block;background:${isUp ? "#f0fdf4" : "#fef2f2"};color:${isUp ? GRASS_GREEN : "#dc2626"};font-size:12px;font-weight:700;padding:3px 8px;border-radius:6px;">${isUp ? "+" : ""}${change.toFixed(1)}%</span>
        </td>
        <td style="padding:14px 8px;text-align:right;">
          <p style="font-weight:700;color:${GRASS_GREEN};font-size:14px;margin:0;">KES ${price.toLocaleString()}</p>
          <p style="color:#9ca3af;font-size:11px;margin:2px 0 0 0;">${f.sharesAvailable ?? 0} shares left</p>
        </td>
      </tr>`;
  }).join("");

  const content = `
    <tr>
      <td style="padding:0;">
        <div style="background:linear-gradient(135deg,${GRASS_DARK} 0%,${GRASS_GREEN} 50%,${GRASS_MID} 100%);padding:40px;text-align:center;">
          <p style="font-size:48px;margin:0 0 12px 0;">🌾</p>
          <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 8px 0;">Your Weekly Farm Picks</h1>
          <p style="color:rgba(255,255,255,0.75);font-size:14px;margin:0;">Hi ${name}, the best opportunities this week</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:36px 40px;">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 8px 0;">
          These verified Kenyan farms are open for investment this week. Earn up to <strong style="color:${GRASS_GREEN};">+22%</strong> returns by backing real farmers.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5ede5;border-radius:16px;overflow:hidden;margin:20px 0 28px 0;">
          <thead>
            <tr style="background:#f8faf8;">
              <th style="padding:12px;text-align:left;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Farm</th>
              <th style="padding:12px;text-align:center;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Change</th>
              <th style="padding:12px;text-align:right;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Price / Shares</th>
            </tr>
          </thead>
          <tbody>${farmRowsHtml}</tbody>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
          <tr>
            ${statCard("⚡", "Mid-Season", "+10%")}
            ${statCard("🌾", "Full Season", "+22%")}
            ${statCard("🛡️", "Protected", "Fund")}
          </tr>
        </table>

        ${ctaButton("Browse All Farm Opportunities →", "https://investafarm.co.ke/market/primary")}

        <div style="background:#f8faf8;border:1px solid #e5ede5;border-radius:12px;padding:16px;margin:20px 0 0 0;">
          <p style="color:#6b7280;font-size:12px;margin:0;line-height:1.6;">
            📊 <strong>Smart tip:</strong> Diversify across 3–5 farms for the best risk-adjusted returns. Mix stable crops (maize, wheat) with growth crops (avocado, coffee).
          </p>
        </div>
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm Opportunities"),
    to,
    subject: `🌾 ${name}'s Weekly Farm Picks — Top opportunities this week`,
    html: emailWrapper(content, `${farms.length} farms open for investment. Earn up to +22% returns this season.`),
  });
}

// ─── FUNDING APPLICATION CONTRACT EMAIL ───────────────────────────────────────
export async function sendFundingApplicationEmail(
  to: string,
  name: string,
  opts: {
    amount: number;
    purpose: string;
    cropType: string;
    location: string;
    farmName: string;
    repaymentMonths: number;
    aiScore: number;
    aiSummary: string;
  }
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] Funding application contract for ${to} (SMTP not configured)`);
    return;
  }

  const { amount, purpose, cropType, location, farmName, repaymentMonths, aiScore, aiSummary } = opts;
  const scoreColor = aiScore >= 70 ? GRASS_GREEN : aiScore >= 50 ? "#d97706" : "#dc2626";

  const content = `
    <tr>
      <td style="padding:0;">
        <div style="background:linear-gradient(135deg,${GRASS_DARK} 0%,${GRASS_MID} 50%,${GRASS_GREEN} 100%);padding:40px;text-align:center;">
          <p style="font-size:48px;margin:0 0 12px 0;">📋</p>
          <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 8px 0;">Application Received!</h1>
          <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:0;">Your farm funding application is under review</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:36px 40px;">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
          Hi <strong>${name}</strong>, we've received your application for <strong>${farmName}</strong>.
          Your farm will be listed on the Investa Farm investor exchange upon approval.
        </p>

        <div style="background:#f8faf8;border:1px solid #e5ede5;border-radius:16px;padding:24px;margin-bottom:24px;">
          <h3 style="color:#111827;font-size:15px;font-weight:700;margin:0 0 16px 0;">Application Summary</h3>
          ${[
            ["Farm Name", farmName],
            ["Crop Type", cropType],
            ["Location", location],
            ["Funding Amount", `KES ${amount.toLocaleString()}`],
            ["Purpose", purpose.charAt(0).toUpperCase() + purpose.slice(1).replace("_", " ")],
            ["Repayment Period", `${repaymentMonths} months`],
          ].map(([label, value]) => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;">
            <span style="color:#6b7280;font-size:13px;">${label}</span>
            <span style="color:#111827;font-size:13px;font-weight:600;">${value}</span>
          </div>`).join("")}
        </div>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:48px;height:48px;border-radius:50%;background:${scoreColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <span style="color:#fff;font-weight:800;font-size:16px;">${aiScore}</span>
            </div>
            <div>
              <p style="color:#111827;font-size:13px;font-weight:700;margin:0 0 2px 0;">AI Risk Score: ${aiScore}/100</p>
              <p style="color:#6b7280;font-size:12px;margin:0;">${aiSummary}</p>
            </div>
          </div>
        </div>

        <div style="background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:16px;margin-bottom:28px;">
          <p style="color:#854d0e;font-size:13px;font-weight:700;margin:0 0 8px 0;">📄 Production Funding Agreement — Key Terms</p>
          <ul style="color:#78350f;font-size:12px;line-height:1.8;margin:0;padding-left:16px;">
            <li>You keep <strong>55%</strong> of gross harvest revenue</li>
            <li>Investors receive <strong>45%</strong> of gross harvest revenue</li>
            <li>Post at least <strong>1 field update per month</strong> with a photo</li>
            <li>Report any crop failure within <strong>24 hours</strong></li>
            <li>Simple interest: <strong>8% per annum</strong> — repaid from harvest proceeds</li>
            <li>No early repayment penalty</li>
          </ul>
        </div>

        ${ctaButton("View My Application →", "https://investafarm.co.ke/farmer/loan-apply")}

        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0 0;line-height:1.6;">
          Questions? Reply to this email or contact us at <a href="mailto:investafarm@proton.me" style="color:${GRASS_GREEN};">investafarm@proton.me</a><br>
          WhatsApp community: <a href="https://chat.whatsapp.com/LnhwCYLjhng4F1y9RWQIEE" style="color:${GRASS_GREEN};">Join our farmers group</a>
        </p>
      </td>
    </tr>`;

  await transport.sendMail({
    from: from("Investa Farm"),
    to,
    subject: `📋 Application Received — ${farmName} | Investa Farm`,
    replyTo: "investafarm@proton.me",
    headers: { "X-Mailer": "Investa Farm Platform", "List-Unsubscribe": `<mailto:investafarm@proton.me?subject=Unsubscribe>` },
    html: emailWrapper(content, `Your funding application for ${farmName} has been received. AI Score: ${aiScore}/100.`),
  });
}
