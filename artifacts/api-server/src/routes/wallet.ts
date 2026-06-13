import { Router, type IRouter } from "express";
import { db, walletsTable, walletTransactionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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
  if (parseFloat(wallet.balance) < amount) {
    res.status(400).json({ error: "Insufficient balance." });
    return;
  }
  const newBalance = parseFloat(wallet.balance) - amount;
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
    balanceAfter: String(newBalance),
    description: req.body.description ?? `Withdraw to M-Pesa ${phoneDisplay}`.trim(),
    reference: `WDR-${Date.now()}`,
    status: "completed",
  }).returning();
  res.json({ wallet: { ...wallet, balance: String(newBalance) }, transaction: tx });
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

export default router;
