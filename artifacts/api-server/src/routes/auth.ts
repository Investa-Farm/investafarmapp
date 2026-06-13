import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable, otpCodesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { LoginBody } from "@workspace/api-zod";
import { sendOtpEmail, sendWelcomeEmail } from "../lib/email";

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(["farmer", "investor", "cooperative", "agribusiness"]),
  orgType: z.string().optional(),
  county: z.string().optional(),
});

const router: IRouter = Router();

function signToken(userId: number): string {
  return Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString("base64");
}

export function verifyToken(token: string): number | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
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

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, name, role } = parsed.data;
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ email, passwordHash, name, role }).returning();
  const token = signToken(user.id);

  // Create wallet for every new user
  const { walletsTable } = await import("@workspace/db");
  const [existingWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  if (!existingWallet) {
    await db.insert(walletsTable).values({ userId: user.id, balance: "0", currency: "KES" });
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(otpCodesTable).values({ userId: user.id, code, purpose: "email_verify", expiresAt });
  sendOtpEmail(email, name, code).catch(() => {});

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

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (!user.emailVerified) {
    // Re-send OTP so they can verify from the login page
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
  const token = signToken(user.id);
  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified, createdAt: user.createdAt.toISOString() },
    token,
  });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified, createdAt: user.createdAt.toISOString() });
});

router.patch("/auth/me", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const Body = z.object({
    name: z.string().min(1).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6).optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const { name, currentPassword, newPassword } = parsed.data;
  const updates: Record<string, string> = {};

  if (name) updates.name = name;

  if (currentPassword && newPassword) {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(400).json({ error: "Current password is incorrect" }); return; }
    updates.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updates).length > 0) {
    await db.update(usersTable).set(updates as any).where(eq(usersTable.id, user.id));
  }

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role });
});

export default router;
