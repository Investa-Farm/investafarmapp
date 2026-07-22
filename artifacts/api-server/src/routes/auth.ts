import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { db, usersTable, otpCodesTable, passwordResetTokensTable, walletsTable, notificationsTable, auditLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { LoginBody } from "@workspace/api-zod";
import { sendOtpEmail, sendWelcomeEmail, sendPasswordResetEmail } from "../lib/email";
import { sendWelcomeSms, sendOtpSms } from "../lib/sms";
import { authRateLimit, checkLockout, recordFailedAuth, recordSuccessfulAuth, getClientIp } from "../lib/security";

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(["farmer", "investor", "cooperative", "agribusiness"]),
  phone: z.string().optional(),
  orgType: z.string().optional(),
  county: z.string().optional(),
  country: z.string().optional(),
  referredById: z.number().optional(),
  referralChannel: z.string().optional(),
});

const router: IRouter = Router();

const DEMO_EMAILS = new Set([
  "john.farmer@investafarm.com",
  "david.investor@investafarm.com",
  "demo.farmer@investafarm.com",
  "demo.investor@investafarm.com",
  "demo.coop@investafarm.com",
  "admin@investafarm.com",
  "grace.farmer@investafarm.com",
  "peter.farmer@investafarm.com",
]);

const TOKEN_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";

export function signToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): number | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.userId ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(req: { headers: { authorization?: string } }) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const userId = verifyToken(token);
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user ?? null;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post("/auth/register", authRateLimit, async (req, res): Promise<void> => {
  const ip = getClientIp(req);

  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email: rawEmail, password, name, role, phone, country, referredById, referralChannel } = parsed.data;
  const email = rawEmail.toLowerCase().trim();

  // Block disposable/spam email patterns
  const spamDomains = ["mailinator.com","guerrillamail.com","tempmail.com","throwam.com","yopmail.com","10minutemail.com","fakeinbox.com","trashmail.com","dispostable.com","maildrop.cc"];
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (spamDomains.includes(domain)) {
    res.status(400).json({ error: "Disposable email addresses are not allowed. Please use a real email." });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const isDemo = DEMO_EMAILS.has(email.toLowerCase());
  const [user] = await db.insert(usersTable).values({
    email, passwordHash, name, role,
    ...(phone ? { phone } : {}),
    ...(country ? { country } : {}),
    ...(isDemo ? { emailVerified: true } : {}),
  }).returning();
  const token = signToken(user.id);

  // Create wallet for every new user
  const [existingWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  if (!existingWallet) {
    await db.insert(walletsTable).values({ userId: user.id, balance: "0", currency: "KES" });
  }

  // Handle referral — notify the referring agribusiness/user
  if (referredById) {
    db.insert(notificationsTable).values({
      userId: referredById,
      type: "referral_signup",
      title: "New Referral Registration",
      body: `${name} just registered using your referral link as a ${role}. They are now linked to your network.`,
    }).catch(() => {});
  }

  if (isDemo) {
    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: true, createdAt: user.createdAt.toISOString() },
      token,
      requiresOtp: false,
    });
    return;
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(otpCodesTable).values({ userId: user.id, code, purpose: "email_verify", expiresAt });
  sendOtpEmail(email, name, code).catch(() => {});
  if (phone) {
    sendWelcomeSms(phone, name).catch(() => {});
    sendOtpSms(phone, code).catch(() => {});
  }

  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified, createdAt: user.createdAt.toISOString() },
    token,
    requiresOtp: true,
  });
});

router.post("/auth/send-otp", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(otpCodesTable).values({ userId: user.id, code, purpose: "email_verify", expiresAt });
  sendOtpEmail(user.email, user.name, code).catch(() => {});
  res.json({ message: "OTP sent", email: user.email });
});

router.patch("/auth/email", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { email } = req.body;
  if (!email || typeof email !== "string") { res.status(400).json({ error: "Email required" }); return; }
  const emailLower = email.toLowerCase().trim();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, emailLower));
  if (existing && existing.id !== user.id) {
    res.status(400).json({ error: "Email already in use by another account" }); return;
  }
  await db.update(usersTable).set({ email: emailLower, emailVerified: false }).where(eq(usersTable.id, user.id));
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(otpCodesTable).values({ userId: user.id, code, purpose: "email_verify", expiresAt });
  sendOtpEmail(emailLower, user.name, code).catch(() => {});
  res.json({ message: "Email updated. New code sent.", email: emailLower });
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  const now = new Date();
  const [otp] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.userId, user.id),
        eq(otpCodesTable.code, String(code)),
        eq(otpCodesTable.used, false),
        eq(otpCodesTable.purpose, "email_verify"),
      )
    )
    .limit(1);

  if (!otp) { res.status(400).json({ error: "Invalid or expired code" }); return; }
  if (otp.expiresAt < now) { res.status(400).json({ error: "Code has expired. Request a new one." }); return; }

  await db.update(otpCodesTable).set({ used: true }).where(eq(otpCodesTable.id, otp.id));
  await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, user.id));

  if (!user.emailVerified) {
    sendWelcomeEmail(user.email, user.name, user.role).catch(() => {});
  }

  res.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: true },
  });
});

router.post("/auth/login", authRateLimit, async (req, res): Promise<void> => {
  const ip = getClientIp(req);

  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email: rawLoginEmail, password } = parsed.data;
  const email = rawLoginEmail.toLowerCase().trim();

  // Check lockout by email first, then by IP
  const emailLock = checkLockout(`email:${email}`);
  const ipLock = checkLockout(`ip:${ip}`);
  if (emailLock.locked) {
    res.status(429).json({ error: emailLock.message, retryAfterMs: emailLock.remainingMs });
    return;
  }
  if (ipLock.locked) {
    res.status(429).json({ error: ipLock.message, retryAfterMs: ipLock.remainingMs });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    recordFailedAuth(`email:${email}`);
    recordFailedAuth(`ip:${ip}`);
    // Constant-time response to prevent user enumeration
    await bcrypt.compare(password, "$2b$10$invalidhashpaddingtomatchtime00000000000000000000000000");
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    recordFailedAuth(`email:${email}`);
    recordFailedAuth(`ip:${ip}`);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Successful login — clear lockout
  recordSuccessfulAuth(`email:${email}`);
  recordSuccessfulAuth(`ip:${ip}`);
  let resolvedVerified = user.emailVerified;
  if (!resolvedVerified) {
    if (DEMO_EMAILS.has(user.email.toLowerCase())) {
      // Auto-verify demo accounts — update DB and mark resolved as true
      await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, user.id));
      resolvedVerified = true;
    } else {
      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await db.insert(otpCodesTable).values({ userId: user.id, code, purpose: "email_verify", expiresAt });
      sendOtpEmail(user.email, user.name, code).catch(() => {});
      const tempToken = signToken(user.id);
      res.status(403).json({
        error: "Please verify your email first. We've sent a new code to your inbox.",
        requiresOtp: true,
        email: user.email,
        token: tempToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: false },
      });
      return;
    }
  }
  // TOTP 2FA: skip for demo accounts; for real users with TOTP enabled, issue a temp token and prompt 2FA
  if (user.totpEnabled && user.totpSecret && !DEMO_EMAILS.has(email)) {
    const tempToken = signToken(user.id);
    res.json({ totpRequired: true, tempToken, email: user.email });
    return;
  }
  const token = signToken(user.id);

  // Write login audit log (non-blocking)
  db.insert(auditLogsTable).values({
    userId: user.id,
    action: "login",
    entityType: "user",
    entityId: user.id,
    metadata: JSON.stringify({ email: user.email, role: user.role }),
    ipAddress: ip,
    userAgent: (req.headers["user-agent"] ?? null) as string | null,
  }).catch(() => {});

  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: resolvedVerified, createdAt: user.createdAt.toISOString() },
    token,
  });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email: rawEmail } = req.body;
  if (!rawEmail || typeof rawEmail !== "string") {
    res.status(400).json({ error: "Email required" }); return;
  }
  const email = rawEmail.toLowerCase().trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  // Always return success to not reveal whether email exists
  if (!user) { res.json({ message: "If that email exists, a reset link has been sent." }); return; }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db.insert(passwordResetTokensTable).values({ userId: user.id, token, expiresAt });

  const origin = req.get("origin") ?? `https://${req.get("host")}`;
  const resetUrl = `${origin}/reset-password?token=${token}`;
  sendPasswordResetEmail(email, user.name, resetUrl).catch(() => {});

  res.json({ message: "If that email exists, a reset link has been sent." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body;
  if (!token || !password || typeof token !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Token and new password are required" }); return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" }); return;
  }

  const now = new Date();
  const [record] = await db.select().from(passwordResetTokensTable)
    .where(and(
      eq(passwordResetTokensTable.token, token),
      eq(passwordResetTokensTable.used, false),
    )).limit(1);

  if (!record) { res.status(400).json({ error: "Invalid or expired reset link." }); return; }
  if (record.expiresAt < now) { res.status(400).json({ error: "This reset link has expired. Please request a new one." }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, record.userId));
  await db.update(passwordResetTokensTable).set({ used: true }).where(eq(passwordResetTokensTable.id, record.id));

  res.json({ message: "Password reset successfully. You can now log in." });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ message: "Logged out" });
});

// ─── OAUTH HELPERS ────────────────────────────────────────────────────────────

function getAppUrl(): string {
  const raw =
    process.env.APP_URL ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:8080");
  // Strip any trailing slash so callback URLs like /api/auth/google/callback
  // are never doubled (https://app.investafarm.com//api/...)
  return raw.replace(/\/+$/, "");
}

async function findOrCreateOAuthUser(email: string, name: string, defaultRole: string) {
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    [user] = await db.insert(usersTable).values({
      email,
      name,
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
      role: (defaultRole as "farmer" | "investor" | "cooperative" | "agribusiness"),
      emailVerified: true,
    }).returning();
    // Create wallet for new OAuth user
    await db.insert(walletsTable).values({ userId: user.id, balance: "0", currency: "KES" }).catch(() => {});
  } else if (!user.emailVerified) {
    await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, user.id));
  }
  return user;
}

function oauthRedirect(res: any, user: Awaited<ReturnType<typeof findOrCreateOAuthUser>>) {
  const token = signToken(user.id);
  const userJson = encodeURIComponent(JSON.stringify({
    id: user.id, email: user.email, name: user.name,
    role: user.role, emailVerified: true,
  }));
  const appUrl = getAppUrl();
  res.redirect(`${appUrl}/auth-callback?token=${token}&user=${userJson}`);
}

// ─── GOOGLE OAUTH ─────────────────────────────────────────────────────────────

router.get("/auth/google", (req, res): void => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) { res.status(503).json({ error: "Google OAuth not configured" }); return; }
  const role = String((req.query as Record<string, string>).role ?? "investor");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${getAppUrl()}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state: role,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code, error, state } = req.query as Record<string, string>;
  const appUrl = getAppUrl();
  if (error || !code) {
    res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent(error ?? "cancelled")}`); return;
  }
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }).toString(),
    });
    const tokens = await tokenRes.json() as any;
    if (!tokenRes.ok) throw new Error(tokens.error_description ?? "Token exchange failed");

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) throw new Error("Failed to fetch Google profile");
    const profile = await userRes.json() as any;

    const email = (profile.email as string).toLowerCase().trim();
    const name = (profile.name ?? profile.given_name ?? email.split("@")[0]) as string;
    const role = state ?? "investor";

    const user = await findOrCreateOAuthUser(email, name, role);
    oauthRedirect(res, user);
  } catch (err) {
    console.error("[Google OAuth]", err);
    res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent("Google sign-in failed. Please try again.")}`);
  }
});

// ─── LINKEDIN OAUTH ───────────────────────────────────────────────────────────

router.get("/auth/linkedin", (req, res): void => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) { res.status(503).json({ error: "LinkedIn OAuth not configured" }); return; }
  const role = String((req.query as Record<string, string>).role ?? "investor");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: `${getAppUrl()}/api/auth/linkedin/callback`,
    scope: "openid profile email",
    state: role,
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

router.get("/auth/linkedin/callback", async (req, res): Promise<void> => {
  const { code, error, state } = req.query as Record<string, string>;
  const appUrl = getAppUrl();
  if (error || !code) {
    res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent(error ?? "cancelled")}`); return;
  }
  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID!;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
    const redirectUri = `${appUrl}/api/auth/linkedin/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }).toString(),
    });
    const tokens = await tokenRes.json() as any;
    if (!tokenRes.ok) throw new Error(tokens.error_description ?? "Token exchange failed");

    // Get user info via OpenID Connect
    const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) throw new Error("Failed to fetch LinkedIn profile");
    const profile = await userRes.json() as any;

    const email = (profile.email as string).toLowerCase().trim();
    const name = (profile.name ?? profile.given_name ?? email.split("@")[0]) as string;
    const role = state ?? "investor";

    const user = await findOrCreateOAuthUser(email, name, role);
    oauthRedirect(res, user);
  } catch (err) {
    console.error("[LinkedIn OAuth]", err);
    res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent("LinkedIn sign-in failed. Please try again.")}`);
  }
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified, phone: user.phone, country: user.country, createdAt: user.createdAt.toISOString() });
});

router.patch("/auth/me", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const Body = z.object({
    name: z.string().min(1).optional(),
    country: z.string().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6).optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const { name, country, currentPassword, newPassword } = parsed.data;
  const updates: Record<string, string> = {};

  if (name) updates.name = name;
  if (country) updates.country = country;

  if (currentPassword && newPassword) {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(400).json({ error: "Current password is incorrect" }); return; }
    updates.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updates).length > 0) {
    await db.update(usersTable).set(updates as any).where(eq(usersTable.id, user.id));
  }

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, phone: updated.phone, country: updated.country });
});

export default router;
