import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, supportTicketsTable, usersTable, notificationsTable, walletsTable, walletTransactionsTable } from "@workspace/db";
import { getCurrentUser } from "./auth";
import { sendGenericEmail } from "../lib/email";
import { notifyUser } from "../lib/push";
import { financialRateLimit } from "../lib/security";

const router = Router();

const SUPPORT_EMAIL = "investafarm@proton.me";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "investafarm@proton.me";

function param(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

// ─── USER ROUTES ─────────────────────────────────────────────────────────────

// POST /support/tickets — submit a new ticket
router.post("/support/tickets", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { category, subject, description, mpesaRef, amountClaimed, paymentMethod } = req.body as {
    category?: string; subject: string; description: string;
    mpesaRef?: string; amountClaimed?: string; paymentMethod?: string;
  };
  if (!subject?.trim() || !description?.trim()) {
    res.status(400).json({ error: "Subject and description are required" }); return;
  }

  const validCategories = ["payment", "kyc", "investment", "withdrawal", "technical", "other"];
  const cat = validCategories.includes(category ?? "") ? (category as any) : "other";

  const [ticket] = await db.insert(supportTicketsTable).values({
    userId: user.id,
    category: cat,
    subject: subject.trim(),
    description: description.trim(),
    mpesaRef: mpesaRef?.trim() || null,
    amountClaimed: amountClaimed?.trim() || null,
    paymentMethod: paymentMethod?.trim() || null,
  }).returning();

  // Email confirmation to user
  sendGenericEmail(user.email, `Support Ticket #${ticket.id} Received: ${subject}`, `
    <p>Hi ${user.name},</p>
    <p>We have received your support request. Our team will respond within <strong>24 hours</strong> (Mon–Fri).</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
      <tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;width:35%">Ticket #</td><td style="padding:8px;border:1px solid #e5e7eb">#${ticket.id}</td></tr>
      <tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Category</td><td style="padding:8px;border:1px solid #e5e7eb;text-transform:capitalize">${cat}</td></tr>
      <tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Subject</td><td style="padding:8px;border:1px solid #e5e7eb">${subject}</td></tr>
      ${mpesaRef ? `<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">M-Pesa Ref</td><td style="padding:8px;border:1px solid #e5e7eb;font-family:monospace">${mpesaRef}</td></tr>` : ""}
      ${amountClaimed ? `<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Amount</td><td style="padding:8px;border:1px solid #e5e7eb">KES ${amountClaimed}</td></tr>` : ""}
    </table>
    <p style="color:#6b7280;font-size:13px">You can check the status of your ticket at any time in the <strong>Help & Support</strong> section of the app.</p>
    <p style="color:#6b7280;font-size:13px">Need to add more details? Reply to this email or send us a message at <a href="mailto:${SUPPORT_EMAIL}" style="color:#16a34a">${SUPPORT_EMAIL}</a></p>
  `).catch(() => {});

  // Notify admin
  sendGenericEmail(ADMIN_EMAIL, `[Ticket #${ticket.id}] New ${cat} request from ${user.name}`, `
    <p><strong>New support ticket from ${user.name}</strong> (${user.email})</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
      <tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;width:35%">Category</td><td style="padding:8px;border:1px solid #e5e7eb;text-transform:capitalize">${cat}</td></tr>
      <tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Subject</td><td style="padding:8px;border:1px solid #e5e7eb">${subject}</td></tr>
      <tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Description</td><td style="padding:8px;border:1px solid #e5e7eb">${description}</td></tr>
      ${mpesaRef ? `<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">M-Pesa Ref</td><td style="padding:8px;border:1px solid #e5e7eb;color:#dc2626;font-family:monospace;font-weight:700">${mpesaRef}</td></tr>` : ""}
      ${amountClaimed ? `<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Amount Claimed</td><td style="padding:8px;border:1px solid #e5e7eb;color:#dc2626;font-weight:700">KES ${amountClaimed}</td></tr>` : ""}
      ${paymentMethod ? `<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Payment Method</td><td style="padding:8px;border:1px solid #e5e7eb">${paymentMethod}</td></tr>` : ""}
    </table>
    <p>Review and respond at: <a href="https://app.investafarm.com/admin/dashboard" style="color:#16a34a">Admin Dashboard → Support</a></p>
  `).catch(() => {});

  res.json({ ok: true, ticketId: ticket.id });
});

// GET /support/tickets/mine — user's own tickets
router.get("/support/tickets/mine", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const tickets = await db.select().from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, user.id))
    .orderBy(desc(supportTicketsTable.createdAt))
    .limit(50);

  res.json(tickets.map(t => ({
    id: t.id,
    category: t.category,
    subject: t.subject,
    description: t.description,
    mpesaRef: t.mpesaRef,
    amountClaimed: t.amountClaimed,
    paymentMethod: t.paymentMethod,
    status: t.status,
    adminReply: t.adminReply,
    adminRepliedAt: t.adminRepliedAt?.toISOString() ?? null,
    walletCredited: t.walletCredited,
    createdAt: t.createdAt.toISOString(),
  })));
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const authHeader = String(req.headers["authorization"] ?? "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return false; }
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    if (decoded.startsWith("admin-session:") || decoded.startsWith("kyc-admin-session:") || decoded.startsWith("sub-admin-session:")) return true;
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64").toString("utf8"));
    if (payload?.role === "admin") return true;
  } catch {}
  res.status(403).json({ error: "Forbidden" }); return false;
}

// GET /admin/support-tickets — all tickets
router.get("/admin/support-tickets", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const status = req.query["status"] as string | undefined;
  const tickets = await db
    .select({ ticket: supportTicketsTable, user: usersTable })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .orderBy(desc(supportTicketsTable.createdAt))
    .limit(200);

  const list = tickets
    .filter(r => !status || status === "all" || r.ticket.status === status)
    .map(r => ({
      id: r.ticket.id,
      userId: r.ticket.userId,
      userName: r.user?.name ?? "Unknown",
      userEmail: r.user?.email ?? "",
      userRole: r.user?.role ?? "",
      category: r.ticket.category,
      subject: r.ticket.subject,
      description: r.ticket.description,
      mpesaRef: r.ticket.mpesaRef,
      amountClaimed: r.ticket.amountClaimed,
      paymentMethod: r.ticket.paymentMethod,
      status: r.ticket.status,
      adminReply: r.ticket.adminReply,
      adminRepliedAt: r.ticket.adminRepliedAt?.toISOString() ?? null,
      walletCredited: r.ticket.walletCredited,
      createdAt: r.ticket.createdAt.toISOString(),
    }));

  res.json(list);
});

// PATCH /admin/support-tickets/:id — respond to a ticket
router.patch("/admin/support-tickets/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const ticketId = parseInt(param(req.params["id"]) || "0", 10);
  const { adminReply, status } = req.body as { adminReply?: string; status?: string };
  const validStatuses = ["open", "in_progress", "resolved", "closed"];
  const newStatus = validStatuses.includes(status ?? "") ? status : undefined;

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (adminReply?.trim()) { updates.adminReply = adminReply.trim(); updates.adminRepliedAt = new Date(); }
  if (newStatus) updates.status = newStatus;

  await db.update(supportTicketsTable).set(updates).where(eq(supportTicketsTable.id, ticketId));

  // Notify user
  const [ticket] = await db.select({ ticket: supportTicketsTable, user: usersTable })
    .from(supportTicketsTable).leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .where(eq(supportTicketsTable.id, ticketId));

  if (ticket?.user) {
    const u = ticket.user;
    await db.insert(notificationsTable).values({
      userId: u.id,
      type: "support",
      title: `🎫 Ticket #${ticketId} Update`,
      body: adminReply ? `Our team replied: ${adminReply.trim().slice(0, 100)}` : `Status changed to ${newStatus}`,
    });
    notifyUser(u.id, "support", `🎫 Ticket #${ticketId} Update`, adminReply ? adminReply.trim().slice(0, 80) : `Status: ${newStatus}`, "/faq").catch(() => {});
    if (adminReply?.trim()) {
      sendGenericEmail(u.email, `Re: Ticket #${ticketId} — ${ticket.ticket.subject}`, `
        <p>Hi ${u.name},</p>
        <p>Our support team has responded to your ticket:</p>
        <div style="border-left:4px solid #16a34a;padding:12px 16px;margin:16px 0;background:#f0fdf4;border-radius:6px">
          <p style="margin:0;color:#166534;font-size:14px;line-height:1.6">${adminReply.trim()}</p>
        </div>
        <p style="color:#6b7280;font-size:13px">Ticket #${ticketId} · Status: <strong style="text-transform:capitalize">${newStatus ?? ticket.ticket.status}</strong></p>
        <p style="color:#6b7280;font-size:13px">View your ticket in the app: <a href="https://app.investafarm.com/faq" style="color:#16a34a">Help & Support</a></p>
        <p style="color:#6b7280;font-size:13px">Need to follow up? Reply directly to this email or contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#16a34a">${SUPPORT_EMAIL}</a></p>
      `).catch(() => {});
    }
  }

  res.json({ ok: true });
});

// POST /admin/support-tickets/:id/credit — validate payment and credit wallet
router.post("/admin/support-tickets/:id/credit", financialRateLimit, async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const ticketId = parseInt(param(req.params["id"]) || "0", 10);
  const { amountKES, note } = req.body as { amountKES: number; note?: string };
  if (!amountKES || amountKES <= 0 || amountKES > 500000) {
    res.status(400).json({ error: "Amount must be between KES 1 and KES 500,000" }); return;
  }

  const [row] = await db.select({ ticket: supportTicketsTable, user: usersTable })
    .from(supportTicketsTable).leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .where(eq(supportTicketsTable.id, ticketId));

  if (!row?.user) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (row.ticket.walletCredited) { res.status(400).json({ error: "Wallet already credited for this ticket" }); return; }

  const userId = row.user.id;
  const reference = `TICKET-${ticketId}-CREDIT-${Date.now()}`;

  // Credit wallet
  let wallet = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1).then(r => r[0]);
  if (!wallet) {
    [wallet] = await db.insert(walletsTable).values({ userId }).returning();
  }
  const newBal = parseFloat(wallet.balance ?? "0") + amountKES;
  await db.update(walletsTable).set({ balance: String(newBal) }).where(eq(walletsTable.id, wallet.id));
  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    userId,
    type: "deposit",
    amount: String(amountKES),
    balanceAfter: String(newBal),
    reference,
    description: note?.trim() || `Admin payment validation — Ticket #${ticketId}`,
    status: "completed",
  });

  await db.update(supportTicketsTable).set({
    walletCredited: amountKES,
    status: "resolved",
    adminReply: `Payment of KES ${amountKES.toLocaleString("en-KE")} validated and credited to your wallet. ${note ?? ""}`.trim(),
    adminRepliedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(supportTicketsTable.id, ticketId));

  // Notify user
  await db.insert(notificationsTable).values({
    userId,
    type: "wallet_credit",
    title: `💰 Payment Validated — KES ${amountKES.toLocaleString("en-KE")} Credited`,
    body: `Your ticket #${ticketId} payment has been verified and KES ${amountKES.toLocaleString("en-KE")} has been added to your wallet.`,
  });
  notifyUser(userId, "wallet_credit", "💰 Payment Validated!", `KES ${amountKES.toLocaleString("en-KE")} credited to your wallet.`, "/wallet").catch(() => {});
  sendGenericEmail(row.user.email, `Payment Validated — KES ${amountKES.toLocaleString("en-KE")} Credited to Your Wallet`, `
    <p>Hi ${row.user.name},</p>
    <p>Great news! Your payment has been verified and credited to your Investa Farm wallet.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
      <tr><td style="padding:8px;background:#f0fdf4;border:1px solid #bbf7d0;font-weight:600;width:40%">Amount Credited</td><td style="padding:8px;border:1px solid #bbf7d0;color:#16a34a;font-weight:700;font-size:16px">KES ${amountKES.toLocaleString("en-KE")}</td></tr>
      <tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Ticket</td><td style="padding:8px;border:1px solid #e5e7eb">#${ticketId} — ${row.ticket.subject}</td></tr>
      <tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Reference</td><td style="padding:8px;border:1px solid #e5e7eb;font-family:monospace;font-size:11px">${reference}</td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px">Your wallet balance has been updated. You can now invest in farms or withdraw your funds.</p>
  `).catch(() => {});

  res.json({ ok: true, credited: amountKES, newBalance: newBal });
});

// POST /admin/wallet/:userId/credit — direct manual wallet credit (for Activity tab validation)
router.post("/admin/wallet/:userId/credit", financialRateLimit, async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const userId = parseInt(param(req.params["userId"]) || "0", 10);
  const { amountKES, reference, note } = req.body as { amountKES: number; reference?: string; note?: string };

  if (!userId || !amountKES || amountKES <= 0 || amountKES > 500000) {
    res.status(400).json({ error: "Invalid userId or amount" }); return;
  }

  const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!userRow) { res.status(404).json({ error: "User not found" }); return; }

  const ref = reference?.trim() || `ADMIN-CREDIT-${Date.now()}`;
  let wallet = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1).then(r => r[0]);
  if (!wallet) {
    [wallet] = await db.insert(walletsTable).values({ userId }).returning();
  }
  const newBal = parseFloat(wallet.balance ?? "0") + amountKES;
  await db.update(walletsTable).set({ balance: String(newBal) }).where(eq(walletsTable.id, wallet.id));
  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    userId,
    type: "deposit",
    amount: String(amountKES),
    balanceAfter: String(newBal),
    reference: ref,
    description: note?.trim() || "Admin manual wallet credit",
    status: "completed",
  });

  await db.insert(notificationsTable).values({
    userId,
    type: "wallet_credit",
    title: `💰 Wallet Credited — KES ${amountKES.toLocaleString("en-KE")}`,
    body: note?.trim() || "An admin has manually credited your wallet.",
  });
  notifyUser(userId, "wallet_credit", "💰 Wallet Credited!", `KES ${amountKES.toLocaleString("en-KE")} added to your wallet.`, "/wallet").catch(() => {});
  sendGenericEmail(userRow.email, `Wallet Credited — KES ${amountKES.toLocaleString("en-KE")}`, `
    <p>Hi ${userRow.name},</p>
    <p>Your Investa Farm wallet has been credited by our team.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
      <tr><td style="padding:8px;background:#f0fdf4;border:1px solid #bbf7d0;font-weight:600;width:40%">Amount</td><td style="padding:8px;border:1px solid #bbf7d0;color:#16a34a;font-weight:700;font-size:16px">KES ${amountKES.toLocaleString("en-KE")}</td></tr>
      <tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Reference</td><td style="padding:8px;border:1px solid #e5e7eb;font-family:monospace;font-size:11px">${ref}</td></tr>
      ${note ? `<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Note</td><td style="padding:8px;border:1px solid #e5e7eb">${note}</td></tr>` : ""}
    </table>
  `).catch(() => {});

  res.json({ ok: true, credited: amountKES, newBalance: newBal });
});

export default router;
