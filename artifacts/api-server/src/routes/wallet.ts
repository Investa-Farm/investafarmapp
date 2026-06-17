import { Router, type IRouter } from "express";
import { createHmac } from "crypto";
import { db, walletsTable, walletTransactionsTable, escrowWalletsTable } from "@workspace/db";
import { eq, desc, and, sum, sql } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { initializePayment, verifyTransaction } from "../lib/paystack";

const router: IRouter = Router();

async function getOrCreateWallet(userId: number) {
  const [existing] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db.insert(walletsTable).values({ userId }).returning();
  return created;
}

router.get("/wallet", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const wallet = await getOrCreateWallet(user.id);
  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.userId, user.id))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(30);
  res.json({ wallet, transactions });
});

router.get("/wallet/escrow", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const escrows = await db
      .select()
      .from(escrowWalletsTable)
      .where(eq(escrowWalletsTable.userId, user.id))
      .orderBy(desc(escrowWalletsTable.createdAt));
    const heldTotal = escrows
      .filter(e => e.status === "held")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const releasedTotal = escrows
      .filter(e => e.status === "released")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    res.json({ escrows, heldTotal, releasedTotal });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch escrow" });
  }
});

router.post("/wallet/deposit", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0 || amount > 1_000_000) {
    res.status(400).json({ error: "Invalid amount. Min KES 1, Max KES 1,000,000." });
    return;
  }
  const wallet = await getOrCreateWallet(user.id);
  const newBalance = parseFloat(wallet.balance) + amount;
  await db.update(walletsTable)
    .set({ balance: String(newBalance), updatedAt: new Date() })
    .where(eq(walletsTable.id, wallet.id));
  const [tx] = await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    userId: user.id,
    type: "deposit",
    amount: String(amount),
    balanceAfter: String(newBalance),
    description: req.body.description ?? "M-Pesa deposit",
    reference: `DEP-${Date.now()}`,
    status: "completed",
  }).returning();
  res.json({ wallet: { ...wallet, balance: String(newBalance) }, transaction: tx });
});

router.post("/wallet/withdraw", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amount = Number(req.body.amount);
  const wallet = await getOrCreateWallet(user.id);
  if (!amount || amount <= 0) { res.status(400).json({ error: "Invalid amount." }); return; }
  const FEE_RATE = 0.005;
  const FEE_CAP = 260;
  const fee = Math.min(Math.round(amount * FEE_RATE * 100) / 100, FEE_CAP);
  const totalDeducted = amount + fee;
  if (parseFloat(wallet.balance) < totalDeducted) {
    res.status(400).json({ error: `Insufficient balance. Amount + withdrawal fee (KES ${fee.toFixed(0)}) requires KES ${totalDeducted.toLocaleString("en-KE")}.` });
    return;
  }
  const newBalance = parseFloat(wallet.balance) - totalDeducted;
  await db.update(walletsTable)
    .set({ balance: String(newBalance), updatedAt: new Date() })
    .where(eq(walletsTable.id, wallet.id));
  const phone = req.body.phone ? String(req.body.phone).replace(/\D/g, "") : null;
  const phoneDisplay = phone ? `(+254${phone})` : "";
  const [tx] = await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    userId: user.id,
    type: "withdrawal",
    amount: String(amount),
    balanceAfter: String(parseFloat(wallet.balance) - amount),
    description: req.body.description ?? `Withdraw to M-Pesa ${phoneDisplay}`.trim(),
    reference: `WDR-${Date.now()}`,
    status: "completed",
  }).returning();
  if (fee > 0) {
    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      userId: user.id,
      type: "fee",
      amount: String(fee),
      balanceAfter: String(newBalance),
      description: "Withdrawal fee (0.5%, max KES 260)",
      reference: `FEE-WDR-${Date.now()}`,
      status: "completed",
    }).catch(() => {});
  }
  res.json({ wallet: { ...wallet, balance: String(newBalance) }, transaction: tx, fee });
});

router.post("/wallet/paystack/initialize", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amount = Number(req.body.amount);
  if (!amount || amount < 100 || amount > 1_000_000) {
    res.status(400).json({ error: "Amount must be between KES 100 and KES 1,000,000." });
    return;
  }
  try {
    const reference = `IF-${user.id}-${Date.now()}`;
    const result = await initializePayment({
      email: user.email,
      amountKobo: Math.round(amount * 100),
      reference,
      metadata: { userId: user.id, purpose: "wallet_topup" },
    });
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Paystack unavailable";
    res.status(502).json({ error: msg });
  }
});

router.post("/wallet/paystack/verify", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { reference } = req.body;
  if (!reference) { res.status(400).json({ error: "Reference required" }); return; }
  try {
    const result = await verifyTransaction(reference);
    if (!result.paid) {
      res.status(402).json({ error: "Payment not confirmed yet", status: result.status });
      return;
    }
    const wallet = await getOrCreateWallet(user.id);
    const existing = await db.select().from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.reference, reference)).limit(1);
    if (existing.length > 0) {
      res.json({ alreadyCredited: true, wallet });
      return;
    }
    const newBalance = parseFloat(wallet.balance) + result.amount;
    await db.update(walletsTable)
      .set({ balance: String(newBalance), updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));
    const [tx] = await db.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      userId: user.id,
      type: "deposit",
      amount: String(result.amount),
      balanceAfter: String(newBalance),
      description: "Paystack top-up",
      reference,
      status: "completed",
    }).returning();
    res.json({ success: true, wallet: { ...wallet, balance: String(newBalance) }, transaction: tx });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    res.status(502).json({ error: msg });
  }
});

router.post("/wallet/paystack/webhook", async (req, res): Promise<void> => {
  const sig = req.headers["x-paystack-signature"] as string | undefined;
  const secret = process.env.PAYSTACK_SECRET_KEY ?? "";
  const rawBody = JSON.stringify(req.body);

  if (sig && secret) {
    const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
    if (sig !== expected) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  }

  const event = req.body as { event?: string; data?: { reference?: string; amount?: number; metadata?: { userId?: number } } };

  if (event.event === "charge.success" && event.data) {
    const { reference, amount: amountKobo, metadata } = event.data;
    const userId = metadata?.userId;
    const amount = (amountKobo ?? 0) / 100;

    if (!reference || !userId || amount <= 0) {
      res.sendStatus(200);
      return;
    }

    const existing = await db.select().from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.reference, reference)).limit(1);
    if (existing.length > 0) { res.sendStatus(200); return; }

    const wallet = await getOrCreateWallet(userId);
    const newBalance = parseFloat(wallet.balance) + amount;

    await db.update(walletsTable)
      .set({ balance: String(newBalance), updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      userId,
      type: "deposit",
      amount: String(amount),
      balanceAfter: String(newBalance),
      description: "Paystack deposit (verified)",
      reference,
      status: "completed",
    }).catch(() => {});
  }

  res.sendStatus(200);
});

export default router;
