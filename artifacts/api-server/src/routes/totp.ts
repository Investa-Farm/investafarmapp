import { Router, type IRouter, type Request } from "express";
import { createRequire } from "node:module";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken, signToken } from "./auth";

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

function getAuthUserId(req: Request): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
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

router.post("/auth/totp/setup", async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (user.totpEnabled) {
    res.status(400).json({ error: "TOTP is already enabled. Disable it first." });
    return;
  }

  const secret = otplib.generateSecret();
  const otpauthUrl = otplib.generateURI({ label: user.email, issuer: "Investa Farm", secret });

  await db.update(usersTable).set({ totpSecret: secret }).where(eq(usersTable.id, userId));

  const qrCode = await QRCode.toDataURL(otpauthUrl);

  res.json({ secret, qrCode, otpauthUrl });
});

router.post("/auth/totp/enable", async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "6-digit code required" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!user.totpSecret) {
    res.status(400).json({ error: "Run /auth/totp/setup first" }); return;
  }
  if (user.totpEnabled) {
    res.status(400).json({ error: "TOTP already enabled" }); return;
  }

  const isValid = totpVerify(code.replace(/\s/g, ""), user.totpSecret);
  if (!isValid) {
    res.status(400).json({ error: "Invalid code. Please check your authenticator app and try again." });
    return;
  }

  await db.update(usersTable).set({ totpEnabled: true }).where(eq(usersTable.id, userId));
  res.json({ success: true, message: "Two-factor authentication enabled" });
});

router.post("/auth/totp/verify-login", async (req, res): Promise<void> => {
  const { code, tempToken } = req.body;
  if (!code || !tempToken || typeof code !== "string" || typeof tempToken !== "string") {
    res.status(400).json({ error: "code and tempToken required" }); return;
  }

  const userId = verifyToken(tempToken);
  if (!userId) {
    res.status(401).json({ error: "Session expired. Please sign in again." }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!user.totpEnabled || !user.totpSecret) {
    res.status(400).json({ error: "TOTP not configured for this account" }); return;
  }

  const isValid = totpVerify(code.replace(/\s/g, ""), user.totpSecret);
  if (!isValid) {
    res.status(400).json({ error: "Invalid authenticator code. Please try again." }); return;
  }

  const token = signToken(user.id);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified, createdAt: user.createdAt.toISOString() },
  });
});

router.delete("/auth/totp/disable", async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Current authenticator code required to disable 2FA" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!user.totpEnabled || !user.totpSecret) {
    res.status(400).json({ error: "TOTP is not enabled" }); return;
  }

  const isValid = totpVerify(code.replace(/\s/g, ""), user.totpSecret);
  if (!isValid) {
    res.status(400).json({ error: "Invalid authenticator code" }); return;
  }

  await db.update(usersTable).set({ totpEnabled: false, totpSecret: null }).where(eq(usersTable.id, userId));
  res.json({ success: true, message: "Two-factor authentication disabled" });
});

router.get("/auth/totp/status", async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ totpEnabled: user.totpEnabled ?? false });
});

export default router;
