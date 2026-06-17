import { Router, type IRouter, type Request } from "express";
import { createRequire } from "node:module";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken, signToken } from "./auth";

// otplib and qrcode are CJS-only — use createRequire so esbuild doesn't try to tree-shake them
const _require = createRequire(import.meta.url);
const authenticator = (_require("otplib") as any).authenticator as {
  generateSecret(): string;
  keyuri(accountName: string, issuer: string, secret: string): string;
  verify(opts: { token: string; secret: string }): boolean;
};
const QRCode = _require("qrcode") as { toDataURL(url: string): Promise<string> };

const router: IRouter = Router();

function getAuthUserId(req: Request): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
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

  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(user.email, "Investa Farm", secret);

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

  const isValid = authenticator.verify({ token: code.replace(/\s/g, ""), secret: user.totpSecret });
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

  const isValid = authenticator.verify({ token: code.replace(/\s/g, ""), secret: user.totpSecret });
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

  const isValid = authenticator.verify({ token: code.replace(/\s/g, ""), secret: user.totpSecret });
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
