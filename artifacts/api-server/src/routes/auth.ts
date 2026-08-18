import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { db, usersTable, otpCodesTable, passwordResetTokensTable, walletsTable, notificationsTable, auditLogsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { LoginBody } from "@workspace/api-zod";
import { sendOtpEmail, sendWelcomeEmail, sendPasswordResetEmail } from "../lib/email";
import { sendWelcomeSms, sendOtpSms } from "../lib/sms";
import { authRateLimit, checkLockout, recordFailedAuth, recordSuccessfulAuth, getClientIp } from "../lib/security";
import {
  BCRYPT_ROUNDS,
  MIN_PASSWORD_LENGTH,
  allowlistPublicRole,
  appPublicUrl,
  consumeOauthTicket,
  createOauthState,
  generateOtp,
  hashOpaqueToken,
  isPasswordStrongEnough,
  newResetToken,
  parseOauthState,
  oauthLoginPath,
  oauthPortalMismatch,
  passwordResetUrl,
  signAuthToken,
  signOauthTicket,
  verifyAuthToken,
  verifyToken as verifyTokenPurposes,
  type TokenPurpose,
} from "../lib/authTokens";

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
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
  "demo.agent@investafarm.com",
  "demo.offtaker@investafarm.com",
  "mwea.coop.ke@gmail.com",
]);

export function signToken(
  userId: number,
  opts: { purpose?: TokenPurpose; ttlMs?: number; tokenVersion?: number } = {},
): string {
  return signAuthToken(userId, opts);
}

export function verifyToken(token: string): number | null {
  return verifyTokenPurposes(token, ["full", "verify", "totp"]);
}

const userPublicSelect = {
  id: usersTable.id,
  email: usersTable.email,
  name: usersTable.name,
  role: usersTable.role,
  emailVerified: usersTable.emailVerified,
  tokenVersion: usersTable.tokenVersion,
  phone: usersTable.phone,
  county: usersTable.county,
  country: usersTable.country,
  metadata: usersTable.metadata,
  avatarUrl: usersTable.avatarUrl,
  bio: usersTable.bio,
  createdAt: usersTable.createdAt,
  totpEnabled: usersTable.totpEnabled,
  creditLimitKES: usersTable.creditLimitKES,
  maxDepositKES: usersTable.maxDepositKES,
  maxWithdrawalKES: usersTable.maxWithdrawalKES,
  accountNumber: usersTable.accountNumber,
  oauthProviderId: usersTable.oauthProviderId,
};

export async function getCurrentUser(
  req: { headers: { authorization?: string } },
  opts: { allowUnverified?: boolean; purposes?: TokenPurpose[] } = {},
) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = verifyAuthToken(auth.slice(7));
  if (!payload) return null;
  const purposes = opts.purposes ?? ["full"];
  if (!purposes.includes(payload.purpose)) return null;
  const [user] = await db.select(userPublicSelect).from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) return null;
  if ((user.tokenVersion ?? 0) !== payload.ver) return null;
  if (!opts.allowUnverified && !user.emailVerified) return null;
  return user;
}

async function bumpTokenVersion(userId: number): Promise<void> {
  await db.update(usersTable)
    .set({ tokenVersion: sql`COALESCE(${usersTable.tokenVersion}, 0) + 1` })
    .where(eq(usersTable.id, userId));
}

async function tokenVersionOf(userId: number): Promise<number> {
  const [row] = await db.select({ tokenVersion: usersTable.tokenVersion }).from(usersTable).where(eq(usersTable.id, userId));
  return row?.tokenVersion ?? 0;
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
    const existingProvider = (existing.metadata as Record<string, unknown> | null)?.authProvider as string | undefined;
    if (existingProvider === "google") {
      res.status(400).json({ error: "conflict:google" }); return;
    }
    if (existingProvider === "linkedin") {
      res.status(400).json({ error: "conflict:linkedin" }); return;
    }
    res.status(400).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const isDemo = DEMO_EMAILS.has(email.toLowerCase());
  const [user] = await db.insert(usersTable).values({
    email, passwordHash, name, role,
    ...(phone ? { phone } : {}),
    ...(country ? { country } : {}),
    ...(isDemo ? { emailVerified: true } : {}),
    metadata: { authProvider: "email" },
  }).returning();
  const token = signToken(user.id, {
    purpose: isDemo ? "full" : "verify",
    tokenVersion: user.tokenVersion ?? 0,
  });

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
  await db.insert(otpCodesTable).values({ userId: user.id, code: hashOpaqueToken(code), purpose: "email_verify", expiresAt });
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

router.post("/auth/send-otp", authRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req, { allowUnverified: true, purposes: ["full", "verify"] });
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(otpCodesTable).values({ userId: user.id, code: hashOpaqueToken(code), purpose: "email_verify", expiresAt });
  sendOtpEmail(user.email, user.name, code).catch(() => {});
  res.json({ message: "OTP sent", email: user.email });
});

router.patch("/auth/email", authRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req, { allowUnverified: true, purposes: ["full", "verify"] });
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { email, currentPassword } = req.body;
  // Verified sessions must prove current password. Unverified onboarding may
  // correct a mistyped email with the short-lived verify token only.
  if (user.emailVerified) {
    if (!currentPassword || typeof currentPassword !== "string") {
      res.status(400).json({ error: "Current password is required to change email" }); return;
    }
    const [full] = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, user.id));
    const validPw = full ? await bcrypt.compare(currentPassword, full.passwordHash) : false;
    if (!validPw) { res.status(400).json({ error: "Current password is incorrect" }); return; }
  }
  if (!email || typeof email !== "string") { res.status(400).json({ error: "Email required" }); return; }
  const emailLower = email.toLowerCase().trim();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, emailLower));
  if (existing && existing.id !== user.id) {
    res.status(400).json({ error: "Email already in use by another account" }); return;
  }
  await db.update(usersTable).set({ email: emailLower, emailVerified: false }).where(eq(usersTable.id, user.id));
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(otpCodesTable).values({ userId: user.id, code: hashOpaqueToken(code), purpose: "email_verify", expiresAt });
  sendOtpEmail(emailLower, user.name, code).catch(() => {});
  res.json({ message: "Email updated. New code sent.", email: emailLower });
});

router.post("/auth/verify-otp", authRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req, { allowUnverified: true, purposes: ["full", "verify"] });
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
        eq(otpCodesTable.code, hashOpaqueToken(String(code))),
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

  const sessionToken = signToken(user.id, { purpose: "full", tokenVersion: user.tokenVersion ?? 0 });
  res.json({
    success: true,
    token: sessionToken,
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

  // If this email was created via OAuth, tell them to use the correct provider
  const authProvider = (user.metadata as Record<string, unknown> | null)?.authProvider as string | undefined;
  if (authProvider === "google" || authProvider === "linkedin") {
    res.status(401).json({ error: `conflict:${authProvider}` });
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
      await db.insert(otpCodesTable).values({ userId: user.id, code: hashOpaqueToken(code), purpose: "email_verify", expiresAt });
      sendOtpEmail(user.email, user.name, code).catch(() => {});
      const tempToken = signToken(user.id, { purpose: "verify", tokenVersion: user.tokenVersion ?? 0 });
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
    const tempToken = signToken(user.id, { purpose: "totp", tokenVersion: user.tokenVersion ?? 0 });
    res.json({ totpRequired: true, tempToken, email: user.email });
    return;
  }
  const token = signToken(user.id, { purpose: "full", tokenVersion: user.tokenVersion ?? 0 });

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

router.post("/auth/forgot-password", authRateLimit, async (req, res): Promise<void> => {
  const { email: rawEmail } = req.body;
  if (!rawEmail || typeof rawEmail !== "string") {
    res.status(400).json({ error: "Email required" }); return;
  }
  const email = rawEmail.toLowerCase().trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  // Always return success to not reveal whether email exists
  if (!user) { res.json({ message: "If that email exists, a reset link has been sent." }); return; }

  const { raw, hash } = newResetToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await db.insert(passwordResetTokensTable).values({ userId: user.id, token: hash, expiresAt });

  const resetUrl = passwordResetUrl(raw);
  sendPasswordResetEmail(email, user.name, resetUrl).catch(() => {});

  res.json({ message: "If that email exists, a reset link has been sent." });
});

router.post("/auth/reset-password", authRateLimit, async (req, res): Promise<void> => {
  const { token, password } = req.body;
  if (!token || !password || typeof token !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Token and new password are required" }); return;
  }
  if (!isPasswordStrongEnough(password)) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }); return;
  }

  const now = new Date();
  const [record] = await db.select().from(passwordResetTokensTable)
    .where(and(
      eq(passwordResetTokensTable.token, hashOpaqueToken(token)),
      eq(passwordResetTokensTable.used, false),
    )).limit(1);

  if (!record) { res.status(400).json({ error: "Invalid or expired reset link." }); return; }
  if (record.expiresAt < now) { res.status(400).json({ error: "This reset link has expired. Please request a new one." }); return; }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, record.userId));
  await bumpTokenVersion(record.userId);
  await db.update(passwordResetTokensTable).set({ used: true }).where(eq(passwordResetTokensTable.id, record.id));

  res.json({ message: "Password reset successfully. You can now log in." });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req, { allowUnverified: true, purposes: ["full", "verify", "totp"] });
  if (user) await bumpTokenVersion(user.id);
  res.json({ message: "Logged out" });
});

// ─── OAUTH HELPERS ────────────────────────────────────────────────────────────

function getAppUrl(): string {
  return appPublicUrl();
}

async function findOrCreateOAuthUser(
  email: string,
  name: string,
  defaultRole: string,
  provider: "google" | "linkedin",
  opts: { providerId?: string; avatarUrl?: string } = {},
) {
  const role = allowlistPublicRole(defaultRole);
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  let isNew = false;

  if (!user) {
    isNew = true;
    [user] = await db.insert(usersTable).values({
      email,
      name,
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS),
      role,
      emailVerified: true,
      metadata: { authProvider: provider },
      ...(opts.avatarUrl ? { avatarUrl: opts.avatarUrl } : {}),
      ...(opts.providerId ? { oauthProviderId: `${provider}:${opts.providerId}` } : {}),
    }).returning();
    await db.insert(walletsTable).values({ userId: user.id, balance: "0", currency: "KES" }).catch(() => {});
    sendWelcomeEmail(email, name, role).catch(() => {});
  } else {
    // Existing user — check for auth provider conflict
    const existingProvider = (user.metadata as Record<string, unknown> | null)?.authProvider as string | undefined;
    if (existingProvider && existingProvider !== provider) {
      throw Object.assign(new Error("auth_conflict"), { conflictProvider: existingProvider });
    }
    const roleClash = oauthPortalMismatch(role, user.role);
    if (roleClash) {
      throw Object.assign(new Error("auth_conflict"), { conflictRole: roleClash });
    }
    // Stamp the provider on legacy accounts (no metadata yet) so future checks work
    const updates: Record<string, any> = {};
    if (!existingProvider) {
      updates.metadata = { ...(user.metadata as object ?? {}), authProvider: provider };
    }
    if (!user.emailVerified) updates.emailVerified = true;
    // Update avatar / providerId if not already set
    if (opts.avatarUrl && !(user as any).avatarUrl) updates.avatarUrl = opts.avatarUrl;
    if (opts.providerId && !(user as any).oauthProviderId) {
      updates.oauthProviderId = `${provider}:${opts.providerId}`;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
    }
  }
  return { user, isNew };
}

function oauthRedirect(
  res: { redirect: (url: string) => void },
  user: Awaited<ReturnType<typeof findOrCreateOAuthUser>>["user"],
  isNew: boolean,
  loginPath: string,
) {
  const ticket = signOauthTicket(user.id, isNew);
  const appUrl = getAppUrl();
  const params = new URLSearchParams({
    ticket,
    is_new: isNew ? "1" : "0",
    login_path: loginPath,
  });
  res.redirect(`${appUrl}/auth-callback?${params.toString()}`);
}

// ─── GOOGLE OAUTH ─────────────────────────────────────────────────────────────

router.get("/auth/google", (req, res): void => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) { res.status(503).json({ error: "Google OAuth not configured" }); return; }
  const state = createOauthState((req.query as Record<string, string>).role);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${getAppUrl()}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code, error, state } = req.query as Record<string, string>;
  const appUrl = getAppUrl();
  const parsedState = parseOauthState(state);
  const role = parsedState?.role ?? "investor";
  const loginPath = oauthLoginPath(role);
  if (error || !code) {
    res.redirect(`${appUrl}/auth-callback?oauth_error=${encodeURIComponent(error ?? "cancelled")}&login_path=${encodeURIComponent(loginPath)}`); return;
  }
  if (!parsedState) {
    res.redirect(`${appUrl}/auth-callback?oauth_error=${encodeURIComponent("Invalid OAuth state")}&login_path=${encodeURIComponent(loginPath)}`); return;
  }
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }).toString(),
    });
    const tokens = await tokenRes.json() as any;
    if (!tokenRes.ok) throw new Error(tokens.error_description ?? "Token exchange failed");

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) throw new Error("Failed to fetch Google profile");
    const profile = await userRes.json() as any;

    const emailRaw = profile.email as string | undefined;
    if (!emailRaw || typeof emailRaw !== "string") {
      throw new Error("Google did not return an email. Grant email access and try again.");
    }
    const email = emailRaw.toLowerCase().trim();
    const name = (profile.name ?? profile.given_name ?? email.split("@")[0]) as string;

    const { user, isNew } = await findOrCreateOAuthUser(email, name, role, "google", {
      providerId: profile.sub as string | undefined,
      avatarUrl: profile.picture as string | undefined,
    });
    oauthRedirect(res, user, isNew, loginPath);
  } catch (err: any) {
    console.error("[Google OAuth]", err);
    if (err.conflictRole) {
      res.redirect(`${appUrl}/auth-callback?oauth_error=${encodeURIComponent(`conflict:role:${err.conflictRole}`)}&login_path=${encodeURIComponent(oauthLoginPath(err.conflictRole))}`);
    } else if (err.conflictProvider) {
      res.redirect(`${appUrl}/auth-callback?oauth_error=${encodeURIComponent(`conflict:${err.conflictProvider}`)}&login_path=${encodeURIComponent(loginPath)}`);
    } else {
      res.redirect(`${appUrl}/auth-callback?oauth_error=${encodeURIComponent("Google sign-in failed. Please try again.")}&login_path=${encodeURIComponent(loginPath)}`);
    }
  }
});

// ─── LINKEDIN OAUTH ───────────────────────────────────────────────────────────

router.get("/auth/linkedin", (req, res): void => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) { res.status(503).json({ error: "LinkedIn OAuth not configured" }); return; }
  const state = createOauthState((req.query as Record<string, string>).role);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: `${getAppUrl()}/api/auth/linkedin/callback`,
    scope: "openid profile email",
    state,
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

router.get("/auth/linkedin/callback", async (req, res): Promise<void> => {
  const { code, error, state } = req.query as Record<string, string>;
  const appUrl = getAppUrl();
  const parsedState = parseOauthState(state);
  const role = parsedState?.role ?? "investor";
  const loginPath = oauthLoginPath(role);
  if (error || !code) {
    res.redirect(`${appUrl}/auth-callback?oauth_error=${encodeURIComponent(error ?? "cancelled")}&login_path=${encodeURIComponent(loginPath)}`); return;
  }
  if (!parsedState) {
    res.redirect(`${appUrl}/auth-callback?oauth_error=${encodeURIComponent("Invalid OAuth state")}&login_path=${encodeURIComponent(loginPath)}`); return;
  }
  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID!;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
    const redirectUri = `${appUrl}/api/auth/linkedin/callback`;

    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }).toString(),
    });
    const tokens = await tokenRes.json() as any;
    if (!tokenRes.ok) throw new Error(tokens.error_description ?? "Token exchange failed");

    const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) throw new Error("Failed to fetch LinkedIn profile");
    const profile = await userRes.json() as any;

    const emailRaw = profile.email as string | undefined;
    if (!emailRaw || typeof emailRaw !== "string") {
      throw new Error("LinkedIn did not return an email. Grant email access and try again.");
    }
    const email = emailRaw.toLowerCase().trim();
    const name = (profile.name ?? profile.given_name ?? email.split("@")[0]) as string;

    const { user, isNew } = await findOrCreateOAuthUser(email, name, role, "linkedin", {
      providerId: profile.sub as string | undefined,
      avatarUrl: profile.picture as string | undefined,
    });
    oauthRedirect(res, user, isNew, loginPath);
  } catch (err: any) {
    console.error("[LinkedIn OAuth]", err);
    if (err.conflictRole) {
      res.redirect(`${appUrl}/auth-callback?oauth_error=${encodeURIComponent(`conflict:role:${err.conflictRole}`)}&login_path=${encodeURIComponent(oauthLoginPath(err.conflictRole))}`);
    } else if (err.conflictProvider) {
      res.redirect(`${appUrl}/auth-callback?oauth_error=${encodeURIComponent(`conflict:${err.conflictProvider}`)}&login_path=${encodeURIComponent(loginPath)}`);
    } else {
      res.redirect(`${appUrl}/auth-callback?oauth_error=${encodeURIComponent("LinkedIn sign-in failed. Please try again.")}&login_path=${encodeURIComponent(loginPath)}`);
    }
  }
});

router.post("/auth/oauth/exchange", authRateLimit, async (req, res): Promise<void> => {
  const ticket = req.body?.ticket;
  if (!ticket || typeof ticket !== "string") {
    res.status(400).json({ error: "ticket required" });
    return;
  }
  const consumed = consumeOauthTicket(ticket);
  if (!consumed) {
    res.status(401).json({ error: "Invalid or expired OAuth ticket" });
    return;
  }
  const [user] = await db.select(userPublicSelect).from(usersTable).where(eq(usersTable.id, consumed.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const token = signToken(user.id, { purpose: "full", tokenVersion: user.tokenVersion ?? 0 });
  res.json({
    token,
    isNew: consumed.isNew,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: true,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req, { allowUnverified: true, purposes: ["full", "verify"] });
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const meta = (user.metadata as Record<string, unknown> | null) ?? {};
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
    phone: user.phone,
    county: user.county,
    country: user.country,
    avatarUrl: (user as any).avatarUrl ?? null,
    bio: (user as any).bio ?? null,
    authProvider: meta.authProvider ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

router.patch("/auth/me", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const Body = z.object({
    name: z.string().min(1).optional(),
    country: z.string().optional(),
    county: z.string().optional(),
    phone: z.string().optional(),
    bio: z.string().max(300).optional(),
    avatarUrl: z.string().url().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH).optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const { name, country, county, phone, bio, avatarUrl, currentPassword, newPassword } = parsed.data;
  const updates: Record<string, any> = {};

  if (name) updates.name = name;
  if (country !== undefined) updates.country = country;
  if (county !== undefined) updates.county = county;
  if (phone !== undefined) updates.phone = phone;
  if (bio !== undefined) updates.bio = bio;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  let rotatedToken: string | undefined;
  if (newPassword) {
    if (!currentPassword) { res.status(400).json({ error: "Current password is required to change password" }); return; }
    const [full] = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, user.id));
    const valid = full ? await bcrypt.compare(currentPassword, full.passwordHash) : false;
    if (!valid) { res.status(400).json({ error: "Current password is incorrect" }); return; }
    updates.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  }

  if (Object.keys(updates).length > 0) {
    await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
  }
  if (newPassword) {
    await bumpTokenVersion(user.id);
    const ver = await tokenVersionOf(user.id);
    rotatedToken = signToken(user.id, { purpose: "full", tokenVersion: ver });
  }

  const [updated] = await db.select(userPublicSelect).from(usersTable).where(eq(usersTable.id, user.id));
  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    phone: updated.phone,
    county: updated.county,
    country: updated.country,
    avatarUrl: (updated as any).avatarUrl ?? null,
    bio: (updated as any).bio ?? null,
    ...(rotatedToken ? { token: rotatedToken } : {}),
  });
});

export default router;
