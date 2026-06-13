import nodemailer from "nodemailer";

const SMTP_USER = process.env.GOOGLE_SMTP_USER ?? "mosesochiengopiyo@gmail.com";
const SMTP_PASS = process.env.GOOGLE_SMTP_PASS ?? "onaglgtpvvucqots";
const APP_NAME = "Investa Farm";

function from(label: string) {
  return `"${label}" <${SMTP_USER}>`;
}

function createTransport() {
  if (!SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendOtpEmail(to: string, name: string, code: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] OTP for ${to}: ${code} (SMTP not configured)`);
    return;
  }
  await transport.sendMail({
    from: from("Investa Farm Verification"),
    to,
    subject: `Your ${APP_NAME} Verification Code: ${code}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#15803d;font-size:28px;margin:0;">Investa Farm</h1>
          <p style="color:#6b7280;font-size:14px;margin-top:4px;">Africa's Leading Farm Investment Platform</p>
        </div>
        <div style="background:white;border-radius:12px;padding:24px;text-align:center;">
          <p style="color:#374151;font-size:16px;">Hi <strong>${name}</strong>, welcome to Investa Farm! 🌾</p>
          <p style="color:#6b7280;font-size:14px;">Use this one-time code to verify your email address:</p>
          <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:20px;margin:20px 0;">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#15803d;">${code}</span>
          </div>
          <p style="color:#9ca3af;font-size:12px;">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px;">Investa Farm Ltd · Nairobi, Kenya</p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(to: string, name: string, role: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] Welcome email for ${to} (SMTP not configured)`);
    return;
  }
  const roleLabel = role === "farmer" ? "Farmer" : role === "investor" ? "Investor" : "Partner";
  const nextStep = role === "farmer"
    ? "Upload your KYC documents to get listed and start raising capital."
    : "Complete your KYC verification to start buying farm shares.";

  await transport.sendMail({
    from: from("Investa Farm"),
    to,
    subject: `Welcome to ${APP_NAME}, ${name}! 🌾`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#15803d;font-size:28px;margin:0;">Investa Farm</h1>
          <p style="color:#6b7280;font-size:14px;margin-top:4px;">Africa's Leading Farm Investment Platform</p>
        </div>
        <div style="background:white;border-radius:12px;padding:24px;">
          <h2 style="color:#15803d;">Welcome, ${name}! 👋</h2>
          <p style="color:#374151;">Your ${roleLabel} account has been verified and is ready to go.</p>
          <p style="color:#374151;">${nextStep}</p>
          <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="color:#15803d;font-weight:bold;margin:0;">🌾 What's next?</p>
            <ul style="color:#374151;font-size:14px;margin:8px 0 0 0;padding-left:20px;">
              ${role === "farmer" ? '<li>Upload KYC documents (National ID + Farm Report)</li><li>Apply for farm investment capital</li><li>Get listed on the investor market</li>' : '<li>Complete KYC (National ID + Selfie)</li><li>Top up your Investa Wallet</li><li>Browse farms and buy shares</li>'}
            </ul>
          </div>
          <p style="color:#9ca3af;font-size:12px;">If you have questions, reply to this email or visit our Help Centre.</p>
        </div>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px;">Investa Farm Ltd · Nairobi, Kenya</p>
      </div>
    `,
  });
}

export async function sendKycApprovedEmail(to: string, name: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] KYC approved email for ${to} (SMTP not configured)`);
    return;
  }
  await transport.sendMail({
    from: from("Investa Farm Compliance"),
    to,
    subject: `🎉 KYC Approved — Welcome to ${APP_NAME}!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#15803d;font-size:28px;margin:0;">Investa Farm</h1>
          <p style="color:#6b7280;font-size:14px;margin-top:4px;">Africa's Leading Farm Investment Platform</p>
        </div>
        <div style="background:white;border-radius:12px;padding:24px;text-align:center;">
          <p style="font-size:56px;margin:0 0 12px 0;">🎉</p>
          <h2 style="color:#15803d;margin:0 0 8px 0;">KYC Approved, ${name}!</h2>
          <p style="color:#374151;margin:0 0 20px 0;">Your identity has been verified by our compliance team.</p>
          <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:20px;margin:20px 0;">
            <p style="color:#15803d;font-weight:bold;font-size:18px;margin:0 0 8px 0;">✓ Account Fully Verified</p>
            <p style="color:#374151;font-size:14px;margin:0;">You now have full access to the Investa Farm platform.</p>
          </div>
          <p style="color:#374151;font-size:14px;">You can now invest in farm shares, request exits, and enjoy all platform benefits.</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:16px;">Thank you for joining Investa Farm. If you have questions, reply to this email.</p>
        </div>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px;">Investa Farm Ltd · Nairobi, Kenya</p>
      </div>
    `,
  });
}

export async function sendKycRejectedEmail(to: string, name: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] KYC rejected email for ${to} (SMTP not configured)`);
    return;
  }
  await transport.sendMail({
    from: from("Investa Farm Compliance"),
    to,
    subject: `KYC Update Required — ${APP_NAME}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#15803d;font-size:28px;margin:0;">Investa Farm</h1>
        </div>
        <div style="background:white;border-radius:12px;padding:24px;">
          <h2 style="color:#dc2626;">Hi ${name}, your KYC needs an update</h2>
          <p style="color:#374151;">Our compliance team reviewed your documents but was unable to verify them at this time.</p>
          <div style="background:#fef2f2;border:2px solid #fecaca;border-radius:12px;padding:20px;margin:20px 0;">
            <p style="color:#dc2626;font-weight:bold;margin:0 0 8px 0;">Common reasons for rejection:</p>
            <ul style="color:#374151;font-size:14px;margin:0;padding-left:20px;">
              <li>Document image was blurry or unclear</li>
              <li>ID document was expired</li>
              <li>Selfie did not match the ID photo</li>
              <li>Documents were incomplete</li>
            </ul>
          </div>
          <p style="color:#374151;font-size:14px;">Please re-upload clear, valid documents in the app to try again.</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:16px;">If you believe this is a mistake, reply to this email.</p>
        </div>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px;">Investa Farm Ltd · Nairobi, Kenya</p>
      </div>
    `,
  });
}

export async function sendFundingVoucherEmail(
  to: string,
  name: string,
  amount: number,
  farmName: string,
  voucherCode: string,
  inputAmount: number,
  supplierName?: string,
  supplierLocation?: string,
  supplierPhone?: string,
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] Funding voucher for ${to}: ${voucherCode} (SMTP not configured)`);
    return;
  }
  const fmt = (n: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
  const lockedAmount = amount - inputAmount;
  const supplierBlock = supplierName ? `
    <div style="background:#fff7ed;border:2px solid #fed7aa;border-radius:12px;padding:20px;margin:16px 0;">
      <p style="color:#c2410c;font-weight:bold;margin:0 0 8px 0;">📍 Your Assigned Input Supplier</p>
      <p style="color:#374151;margin:4px 0;font-size:14px;"><strong>${supplierName}</strong></p>
      ${supplierLocation ? `<p style="color:#6b7280;margin:4px 0;font-size:13px;">📍 ${supplierLocation}</p>` : ""}
      ${supplierPhone ? `<p style="color:#6b7280;margin:4px 0;font-size:13px;">📞 ${supplierPhone}</p>` : ""}
      <p style="color:#9a3412;font-size:12px;margin-top:8px;">Present your voucher code at this supplier to redeem ${fmt(inputAmount)} worth of inputs.</p>
    </div>
  ` : "";

  await transport.sendMail({
    from: from("Investa Farm Funding"),
    to,
    subject: `🌾 Your Funding Voucher — ${fmt(amount)} Approved for ${farmName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#f9fafb;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#15803d;font-size:28px;margin:0;">Investa Farm</h1>
          <p style="color:#6b7280;font-size:14px;margin-top:4px;">Farm Investment Platform</p>
        </div>
        <div style="background:white;border-radius:12px;padding:28px;">
          <h2 style="color:#15803d;">Congratulations, ${name}! 🎉</h2>
          <p style="color:#374151;">Your funding for <strong>${farmName}</strong> has been approved.</p>
          <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:24px;margin:20px 0;text-align:center;">
            <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">INPUT VOUCHER CODE</p>
            <span style="font-size:28px;font-weight:900;letter-spacing:6px;color:#15803d;font-family:monospace;">${voucherCode}</span>
            <p style="color:#15803d;font-weight:bold;font-size:18px;margin-top:12px;">${fmt(inputAmount)} for Inputs</p>
          </div>
          ${supplierBlock}
          <div style="background:#eff6ff;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="color:#1d4ed8;font-weight:bold;margin:0 0 8px 0;">💰 Capital Breakdown</p>
            <ul style="color:#374151;font-size:13px;margin:0;padding-left:20px;">
              <li>Input Voucher (redeemable now): <strong>${fmt(inputAmount)}</strong></li>
              <li>Capital locked until milestone: <strong>${fmt(lockedAmount)}</strong></li>
            </ul>
          </div>
        </div>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px;">Investa Farm Ltd · Nairobi, Kenya</p>
      </div>
    `,
  });
}

export async function sendKycUnderReviewEmail(to: string, name: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] KYC under-review email for ${to} (SMTP not configured)`);
    return;
  }
  await transport.sendMail({
    from: from("Investa Farm Compliance"),
    to,
    subject: `Your KYC is Under Review — ${APP_NAME}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#15803d;font-size:28px;margin:0;">Investa Farm</h1>
        </div>
        <div style="background:white;border-radius:12px;padding:24px;">
          <h2 style="color:#1d4ed8;">Hi ${name}, your KYC is under review 🔍</h2>
          <p style="color:#374151;">We've received all your verification documents and our compliance team is now reviewing them.</p>
          <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
            <p style="color:#1d4ed8;font-size:24px;margin:0;">⏳</p>
            <p style="color:#1e40af;font-weight:bold;font-size:16px;margin:8px 0 4px 0;">Review in Progress</p>
            <p style="color:#3b82f6;font-size:13px;margin:0;">Typical review time: 24–48 hours</p>
          </div>
          <p style="color:#374151;font-size:14px;">You'll receive another email once your account has been approved.</p>
        </div>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px;">Investa Farm Ltd · Nairobi, Kenya</p>
      </div>
    `,
  });
}

export async function sendKycSubmittedNotification(adminEmail: string, userName: string, userEmail: string, docType: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] KYC notification for admin (SMTP not configured)`);
    return;
  }
  await transport.sendMail({
    from: from("Investa Farm Admin Alerts"),
    to: adminEmail,
    subject: `[Admin] New KYC Document Uploaded — ${userName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
        <h2 style="color:#15803d;">New KYC Document Uploaded</h2>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:8px;color:#6b7280;">User</td><td style="padding:8px;font-weight:bold;">${userName}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;">Email</td><td style="padding:8px;">${userEmail}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;">Document</td><td style="padding:8px;">${docType}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;">Time</td><td style="padding:8px;">${new Date().toISOString()}</td></tr>
        </table>
        <p style="color:#9ca3af;font-size:12px;">Log in to the admin panel to review and approve.</p>
      </div>
    `,
  });
}

export async function sendOpportunityDigest(
  to: string,
  name: string,
  farms: Array<{ name: string; cropType: string; location: string; sharePrice?: number | string; sharesAvailable?: number }>
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL] Opportunity digest for ${to} (SMTP not configured)`);
    return;
  }
  const farmRows = farms.slice(0, 5).map(f => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:10px 8px;font-weight:600;color:#111827;font-size:13px;">${f.name}</td>
      <td style="padding:10px 8px;color:#6b7280;font-size:13px;">${f.cropType} · ${f.location}</td>
      <td style="padding:10px 8px;font-weight:700;color:#15803d;font-size:13px;">KES ${Number(f.sharePrice ?? 0).toLocaleString()}/share</td>
      <td style="padding:10px 8px;color:#374151;font-size:13px;">${f.sharesAvailable ?? 0} left</td>
    </tr>
  `).join("");

  await transport.sendMail({
    from: from("Investa Farm Opportunities"),
    to,
    subject: `🌾 This Week's Top Farm Investment Opportunities`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:580px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#052c16 0%,#15803d 100%);padding:32px 24px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.5px;">🌾 Weekly Farm Picks</h1>
          <p style="color:rgba(255,255,255,0.75);margin:10px 0 0;font-size:14px;">Hi ${name}, here are this week's top investment opportunities</p>
        </div>
        <div style="padding:24px;">
          <p style="color:#374151;font-size:14px;line-height:1.6;">Great farms are open for investment right now. Earn up to <strong style="color:#15803d;">+28%</strong> returns this season by backing verified Kenyan farmers.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px 8px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Farm</th>
                <th style="padding:10px 8px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Crop</th>
                <th style="padding:10px 8px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Price</th>
                <th style="padding:10px 8px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Shares</th>
              </tr>
            </thead>
            <tbody>${farmRows}</tbody>
          </table>
          <div style="text-align:center;margin:28px 0 20px;">
            <a href="https://investafarm.co.ke/market/primary" style="background:#15803d;color:#ffffff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">Browse All Opportunities →</a>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;">
            <p style="margin:0;color:#15803d;font-size:13px;font-weight:700;">💡 Investment Returns</p>
            <p style="margin:6px 0 0;color:#166534;font-size:12px;line-height:1.5;">
              ⚡ Mid-Season Exit: <strong>+10%</strong> in 30–60 days &nbsp;|&nbsp; 🌾 Full Season: up to <strong>+28%</strong> in ~6 months
            </p>
          </div>
        </div>
        <div style="padding:16px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">You're receiving this because you have an Investa Farm account. Sent every Monday & Friday.</p>
        </div>
      </div>
    `,
  });
}
