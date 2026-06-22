import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", async (_req, res): Promise<void> => {
  const checks: Record<string, { ok: boolean; message: string }> = {};

  // ── Database check ──────────────────────────────────────────────────────────
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { ok: true, message: "Connected" };
  } catch (e) {
    checks.database = { ok: false, message: (e as Error).message ?? "Query failed" };
  }

  // ── Email check (SMTP or Resend) ─────────────────────────────────────────────
  const smtpUser = process.env.GOOGLE_SMTP_USER;
  const smtpPass = process.env.GOOGLE_SMTP_PASS;
  const resendKey = process.env.RESEND_API_KEY;
  if (smtpUser && smtpPass) {
    checks.email = { ok: true, message: `SMTP configured (${smtpUser})` };
  } else if (resendKey) {
    checks.email = { ok: true, message: "Resend configured" };
  } else {
    checks.email = { ok: false, message: "No email provider — set RESEND_API_KEY or GOOGLE_SMTP_USER+PASS" };
  }

  // ── Push notifications check ─────────────────────────────────────────────────
  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  if (vapidPub && vapidPriv) {
    checks.push = { ok: true, message: "VAPID keys present" };
  } else {
    const missing = [!vapidPub && "VAPID_PUBLIC_KEY", !vapidPriv && "VAPID_PRIVATE_KEY"].filter(Boolean).join(", ");
    checks.push = { ok: false, message: `Missing env vars: ${missing}` };
  }

  const allOk = Object.values(checks).every(c => c.ok);

  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default router;
