import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", async (_req, res): Promise<void> => {
  const checks: Record<string, { ok: boolean; level: "critical" | "warning"; message: string }> = {};

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { ok: true, level: "critical", message: "Connected" };
  } catch (e) {
    checks.database = { ok: false, level: "critical", message: (e as Error).message ?? "Query failed" };
  }

  const smtpUser = process.env.GOOGLE_SMTP_USER;
  const smtpPass = process.env.GOOGLE_SMTP_PASS;
  const resendKey = process.env.RESEND_API_KEY;
  if (smtpUser && smtpPass) {
    checks.email = { ok: true, level: "warning", message: `SMTP configured (${smtpUser})` };
  } else if (resendKey) {
    checks.email = { ok: true, level: "warning", message: "Resend configured" };
  } else {
    checks.email = { ok: false, level: "warning", message: "No email provider — set RESEND_API_KEY or GOOGLE_SMTP_USER+PASS" };
  }

  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  if (vapidPub && vapidPriv) {
    checks.push = { ok: true, level: "warning", message: "VAPID keys present" };
  } else {
    const missing = [!vapidPub && "VAPID_PUBLIC_KEY", !vapidPriv && "VAPID_PRIVATE_KEY"].filter(Boolean).join(", ");
    checks.push = { ok: false, level: "warning", message: `Missing: ${missing}` };
  }

  const criticalFailed = Object.values(checks).some(c => c.level === "critical" && !c.ok);

  res.status(criticalFailed ? 503 : 200).json({
    status: criticalFailed ? "error" : "ok",
    timestamp: new Date().toISOString(),
    checks: Object.fromEntries(
      Object.entries(checks).map(([k, v]) => [k, { ok: v.ok, message: v.message }])
    ),
  });
});

export default router;
