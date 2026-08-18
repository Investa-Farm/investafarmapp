import { Router, type IRouter, type Request } from "express";
import { createRequire } from "node:module";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken } from "./auth";
import { authRateLimit, checkLockout, recordFailedAuth, recordSuccessfulAuth, getClientIp } from "../lib/security";
import {
  decryptAtRest,
  encryptAtRest,
  getTokenSecret,
  verifyAuthToken,
  type TokenPurpose,
} from "../lib/authTokens";

const DEVICE_SECRET_SUFFIX = "-device-trust";

function deviceSecret(): string {
  return getTokenSecret() + DEVICE_SECRET_SUFFIX;
}

function signDeviceToken(userId: number): string {
  const until = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ userId, until, type: "device" })).toString("base64url");
  const sig = createHmac("sha256", deviceSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyDeviceToken(token: string): { userId: number; until: number } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", deviceSecret()).update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.type !== "device" || !decoded.until || decoded.until < Date.now()) return null;
    return { userId: decoded.userId, until: decoded.until };
  } catch { return null; }
}

// otplib v13 is CJS-only — use the globalThis.require injected by the ESM banner so CJS
// resolution works correctly in the deployed compiled bundle. Fall back to a fresh
// createRequire only when the banner hasn't run (e.g. local ts-node execution).
const _require = ((globalThis as any).require ?? createRequire(import.meta.url)) as NodeRequire;
const _rawOtplib = _require("otplib");
// Some bundler/Node combinations wrap the module under .default
const otplib = (_rawOtplib?.default ?? _rawOtplib) as {
  generateSecret(): string;
  generateSync(payload: { secret: string }): string;
  verifySync(payload: { token: string; secret: string }, opts?: { window?: number }): { valid: boolean } | null | false;
  generateURI(payload: { label: string; issuer: string; secret: string }): string;
};
const QRCode = _require("qrcode") as { toDataURL(url: string): Promise<string> };

const router: IRouter = Router();

function bearerPayload(req: Request, purposes: TokenPurpose[]) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = verifyAuthToken(auth.slice(7));
  if (!payload || !purposes.includes(payload.purpose)) return null;
  return payload;
}

function totpVerify(token: string, secret: string): boolean {
  try {
    const result = otplib.verifySync({ token, secret }, { window: 1 });
    if (!result) return false;
    if (typeof result === "object" && "valid" in result) return result.valid === true;
    return Boolean(result);
  } catch {
    return false;
  }
}

function secretOf(stored: string | null | undefined): string | null {
  if (!stored) return null;
  return decryptAtRest(stored);
}

router.post("/auth/totp/setup", async (req, res): Promise<void> => {
  const payload = bearerPayload(req, ["full"]);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = payload.userId;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if ((user.tokenVersion ?? 0) !== payload.ver) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!user.emailVerified) { res.status(403).json({ error: "Verify your email before enabling 2FA" }); return; }

  if (user.totpEnabled) {
    res.status(400).json({ error: "TOTP is already enabled. Disable it first." });
    return;
  }

  const existingPlain = secretOf(user.totpSecret);
  const secret = existingPlain ?? otplib.generateSecret();
  const otpauthUrl = otplib.generateURI({ label: user.email, issuer: "Investa Farm", secret });

  if (!user.totpSecret) {
    await db.update(usersTable).set({ totpSecret: encryptAtRest(secret) }).where(eq(usersTable.id, userId));
  }

  const qrCode = await QRCode.toDataURL(otpauthUrl);

  res.json({ secret, qrCode, otpauthUrl });
});

router.post("/auth/totp/enable", async (req, res): Promise<void> => {
  const payload = bearerPayload(req, ["full"]);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = payload.userId;

  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "6-digit code required" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if ((user.tokenVersion ?? 0) !== payload.ver) { res.status(401).json({ error: "Unauthorized" }); return; }
  const secret = secretOf(user.totpSecret);
  if (!secret) {
    res.status(400).json({ error: "Run /auth/totp/setup first" }); return;
  }
  if (user.totpEnabled) {
    res.status(400).json({ error: "TOTP already enabled" }); return;
  }

  const isValid = totpVerify(code.replace(/\s/g, ""), secret);
  if (!isValid) {
    res.status(400).json({ error: "Invalid code. Please check your authenticator app and try again." });
    return;
  }

  await db.update(usersTable).set({ totpEnabled: true }).where(eq(usersTable.id, userId));
  res.json({ success: true, message: "Two-factor authentication enabled" });
});

router.post("/auth/totp/verify-login", authRateLimit, async (req, res): Promise<void> => {
  const { code, tempToken } = req.body;
  if (!code || !tempToken || typeof code !== "string" || typeof tempToken !== "string") {
    res.status(400).json({ error: "code and tempToken required" }); return;
  }

  const ip = getClientIp(req);
  const lock = checkLockout(`totp:${ip}`);
  if (lock.locked) {
    res.status(429).json({ error: lock.message, retryAfterMs: lock.remainingMs }); return;
  }

  const payload = verifyAuthToken(tempToken);
  if (!payload || payload.purpose !== "totp") {
    res.status(401).json({ error: "Session expired. Please sign in again." }); return;
  }
  const userId = payload.userId;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if ((user.tokenVersion ?? 0) !== payload.ver) {
    res.status(401).json({ error: "Session expired. Please sign in again." }); return;
  }
  const secret = secretOf(user.totpSecret);
  if (!user.totpEnabled || !secret) {
    res.status(400).json({ error: "TOTP not configured for this account" }); return;
  }

  const isValid = totpVerify(code.replace(/\s/g, ""), secret);
  if (!isValid) {
    recordFailedAuth(`totp:${ip}`);
    res.status(400).json({ error: "Invalid authenticator code. Please try again." }); return;
  }
  recordSuccessfulAuth(`totp:${ip}`);

  const token = signToken(user.id, { purpose: "full", tokenVersion: user.tokenVersion ?? 0 });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified, createdAt: user.createdAt.toISOString() },
  });
});

router.delete("/auth/totp/disable", async (req, res): Promise<void> => {
  const payload = bearerPayload(req, ["full"]);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = payload.userId;

  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Current authenticator code required to disable 2FA" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if ((user.tokenVersion ?? 0) !== payload.ver) { res.status(401).json({ error: "Unauthorized" }); return; }
  const secret = secretOf(user.totpSecret);
  if (!user.totpEnabled || !secret) {
    res.status(400).json({ error: "TOTP is not enabled" }); return;
  }

  const isValid = totpVerify(code.replace(/\s/g, ""), secret);
  if (!isValid) {
    res.status(400).json({ error: "Invalid authenticator code" }); return;
  }

  await db.update(usersTable).set({ totpEnabled: false, totpSecret: null }).where(eq(usersTable.id, userId));
  res.json({ success: true, message: "Two-factor authentication disabled" });
});

router.get("/auth/totp/status", async (req, res): Promise<void> => {
  const payload = bearerPayload(req, ["full"]);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if ((user.tokenVersion ?? 0) !== payload.ver) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json({ totpEnabled: user.totpEnabled ?? false });
});

// Issue a 30-day signed device token after the user has proven TOTP identity
// with a live authenticator code (JWT alone is not sufficient).
router.post("/auth/totp/trust-device", authRateLimit, async (req, res): Promise<void> => {
  const payload = bearerPayload(req, ["full"]);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { code } = req.body ?? {};
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Authenticator code required to trust this device" }); return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user?.totpEnabled) {
    res.status(400).json({ error: "TOTP not enabled on this account" }); return;
  }
  if ((user.tokenVersion ?? 0) !== payload.ver) { res.status(401).json({ error: "Unauthorized" }); return; }
  const secret = secretOf(user.totpSecret);
  if (!secret || !totpVerify(code.replace(/\s/g, ""), secret)) {
    res.status(400).json({ error: "Invalid authenticator code" }); return;
  }
  const deviceToken = signDeviceToken(payload.userId);
  res.json({ deviceToken, until: Date.now() + 30 * 24 * 60 * 60 * 1000 });
});

// Skip TOTP on a device that holds a valid signed device token.
// Requires a live tempToken (issued by /auth/login when totpRequired) + stored deviceToken.
router.post("/auth/totp/verify-device", authRateLimit, async (req, res): Promise<void> => {
  const { tempToken, deviceToken } = req.body;
  if (!tempToken || !deviceToken) {
    res.status(400).json({ error: "tempToken and deviceToken required" }); return;
  }

  const payload = verifyAuthToken(tempToken);
  if (!payload || payload.purpose !== "totp") {
    res.status(401).json({ error: "Session expired. Please sign in again." }); return;
  }

  const deviceData = verifyDeviceToken(deviceToken);
  if (!deviceData || deviceData.userId !== payload.userId) {
    res.status(401).json({ error: "Device not trusted or token expired. Please verify with authenticator." }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if ((user.tokenVersion ?? 0) !== payload.ver) {
    res.status(401).json({ error: "Session expired. Please sign in again." }); return;
  }

  const token = signToken(user.id, { purpose: "full", tokenVersion: user.tokenVersion ?? 0 });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified, createdAt: user.createdAt.toISOString() },
  });
});

// TOTP must not be used as an email-verification bypass.
router.post("/auth/totp/verify-email", (_req, res): void => {
  res.status(403).json({ error: "Email verification via authenticator is disabled. Use the email OTP." });
});

export default router;
