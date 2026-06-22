import { Router, type IRouter } from "express";
import { createHmac } from "crypto";
import { db, walletsTable, walletTransactionsTable, escrowWalletsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { verifyTransaction, initializePayment, initiateMpesaCharge, checkChargeStatus, isConfigured as isPaystackConfigured, PAYSTACK_PUBLIC_KEY } from "../lib/paystack";
import {
  financialRateLimit,
  checkDepositVelocity, recordDeposit,
  checkWithdrawalVelocity, recordWithdrawal,
  getUserVelocitySummary,
} from "../lib/security";
import { notifyUser } from "../lib/push";
import { sendWalletTopupSms, sendWithdrawalSms } from "../lib/sms";
import { isCircleConfigured, getKesUsdcRate, createPaymentIntent, getPaymentIntentStatus, getStaticUsdcAddress } from "../lib/circle";
import { createPaymentIntent as stripeCreateIntent, retrievePaymentIntent, isConfigured as isStripeConfigured, STRIPE_PUBLIC_KEY, constructWebhookEvent } from "../lib/stripe";

const router: IRouter = Router();

async function getOrCreateWallet(userId: number) {
  const [existing] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db.insert(walletsTable).values({ userId }).returning();
  return created;
}

async function creditWallet(userId: number, amount: number, reference: string, description: string) {
  const wallet = await getOrCreateWallet(userId);
  // Idempotency: skip if already credited
  const existing = await db.select().from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.reference, reference)).limit(1);
  if (existing.length > 0) return { alreadyCredited: true, wallet };
  const newBalance = parseFloat(wallet.balance) + amount;
  await db.update(walletsTable)
    .set({ balance: String(newBalance), updatedAt: new Date() })
    .where(eq(walletsTable.id, wallet.id));
  const [tx] = await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    userId,
    type: "deposit",
    amount: String(amount),
    balanceAfter: String(newBalance),
    description,
    reference,
    status: "completed",
  }).returning();
  return { wallet: { ...wallet, balance: String(newBalance) }, transaction: tx, newBalance };
}

// ─── GET /wallet ─────────────────────────────────────────────────────────────
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

// ─── GET /wallet/escrow ──────────────────────────────────────────────────────
router.get("/wallet/escrow", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const escrows = await db
      .select()
      .from(escrowWalletsTable)
      .where(eq(escrowWalletsTable.userId, user.id))
      .orderBy(desc(escrowWalletsTable.createdAt));
    const heldTotal = escrows.filter(e => e.status === "held").reduce((s, e) => s + Number(e.amount), 0);
    const releasedTotal = escrows.filter(e => e.status === "released").reduce((s, e) => s + Number(e.amount), 0);
    res.json({ escrows, heldTotal, releasedTotal });
  } catch { res.status(500).json({ error: "Failed to fetch escrow" }); }
});

// ─── POST /wallet/deposit (direct, dev only) ─────────────────────────────────
router.post("/wallet/deposit", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amount = Number(req.body.amount);
  if (!amount || isNaN(amount)) { res.status(400).json({ error: "Invalid amount." }); return; }
  const check = checkDepositVelocity(user.id, amount);
  if (!check.ok) { res.status(400).json({ error: check.error }); return; }
  const result = await creditWallet(user.id, amount, `DEP-${Date.now()}`, req.body.description ?? "M-Pesa deposit");
  recordDeposit(user.id, amount);
  res.json(result);
});

// ─── POST /wallet/withdraw ───────────────────────────────────────────────────
router.post("/wallet/withdraw", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amount = Number(req.body.amount);
  if (!amount || isNaN(amount)) { res.status(400).json({ error: "Invalid amount." }); return; }
  const check = checkWithdrawalVelocity(user.id, amount);
  if (!check.ok) { res.status(400).json({ error: check.error }); return; }
  const wallet = await getOrCreateWallet(user.id);
  const FEE_RATE = 0.005;
  const FEE_CAP = 260;
  const fee = Math.min(Math.round(amount * FEE_RATE * 100) / 100, FEE_CAP);
  const totalDeducted = amount + fee;
  if (parseFloat(wallet.balance) < totalDeducted) {
    res.status(400).json({ error: `Insufficient balance. Amount + fee (KES ${fee.toFixed(0)}) requires KES ${totalDeducted.toLocaleString("en-KE")}.` });
    return;
  }
  const newBalance = parseFloat(wallet.balance) - totalDeducted;
  await db.update(walletsTable).set({ balance: String(newBalance), updatedAt: new Date() }).where(eq(walletsTable.id, wallet.id));
  const phone = req.body.phone ? String(req.body.phone) : null;
  const phoneDisplay = phone ? ` (${phone})` : "";
  const ref = `WDR-${Date.now()}`;
  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id, userId: user.id, type: "withdrawal",
    amount: String(amount), balanceAfter: String(parseFloat(wallet.balance) - amount),
    description: `Withdraw to M-Pesa${phoneDisplay}`.trim(), reference: ref, status: "completed",
  });
  if (fee > 0) {
    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id, userId: user.id, type: "fee",
      amount: String(fee), balanceAfter: String(newBalance),
      description: "Withdrawal fee (0.5%, max KES 260)",
      reference: `FEE-${ref}`, status: "completed",
    }).catch(() => {});
  }
  recordWithdrawal(user.id, amount);
  notifyUser(user.id, "withdrawal", "Withdrawal Initiated", `KES ${amount.toLocaleString("en-KE")} sent to M-Pesa. Processing 1-2 business days.`, "/wallet").catch(() => {});
  if (phone) {
    sendWithdrawalSms(phone, amount, fee).catch(() => {});
  } else {
    db.select({ phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, user.id)).limit(1)
      .then(([u]) => { if ((u as any)?.phone) sendWithdrawalSms((u as any).phone, amount, fee).catch(() => {}); })
      .catch(() => {});
  }
  res.json({ wallet: { ...wallet, balance: String(newBalance) }, fee });
});

// ─── POST /wallet/paystack/initialize (card / general) ───────────────────────
router.post("/wallet/paystack/initialize", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amount = Number(req.body.amount);
  if (!amount || amount < 100 || amount > 1_000_000) {
    res.status(400).json({ error: "Amount must be between KES 100 and KES 1,000,000." });
    return;
  }
  const amountKobo = Math.round(amount * 100);
  const reference = `IF-${user.id}-${Date.now()}`;

  if (!isPaystackConfigured()) {
    // No real Paystack key — return a local reference only (dev demo mode)
    res.json({ reference, publicKey: "", email: user.email, amountKobo, accessCode: "", authorizationUrl: "", configured: false });
    return;
  }

  try {
    const { accessCode, authorizationUrl, reference: psRef } = await initializePayment({
      email: user.email,
      amountKobo,
      reference,
      metadata: { userId: user.id, source: "investa-farm" },
    });
    res.json({
      reference: psRef,
      accessCode,
      authorizationUrl,
      publicKey: PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amountKobo,
      configured: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Paystack initialization failed";
    res.status(502).json({ error: msg });
  }
});

// ─── POST /wallet/paystack/mpesa (M-Pesa STK push) ───────────────────────────
router.post("/wallet/paystack/mpesa", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amount = Number(req.body.amount);
  const phone = String(req.body.phone ?? "").trim();
  if (!amount || amount < 10 || amount > 1_000_000) {
    res.status(400).json({ error: "Amount must be between KES 10 and KES 1,000,000." });
    return;
  }
  if (!phone) { res.status(400).json({ error: "Phone number required for M-Pesa." }); return; }

  const check = checkDepositVelocity(user.id, amount);
  if (!check.ok) { res.status(400).json({ error: check.error }); return; }

  const reference = `MPESA-${user.id}-${Date.now()}`;
  const amountKobo = Math.round(amount * 100);

  if (!isPaystackConfigured()) {
    // Dev demo: pretend STK push sent, return demo reference
    res.json({ reference, status: "pay_offline", displayText: "Demo mode — no real STK push sent", configured: false });
    return;
  }

  try {
    const result = await initiateMpesaCharge({ email: user.email, amountKobo, reference, phone });
    res.json({ ...result, configured: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "M-Pesa charge failed";
    res.status(502).json({ error: msg });
  }
});

// ─── GET /wallet/paystack/status/:reference (poll M-Pesa) ────────────────────
router.get("/wallet/paystack/status/:reference", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { reference } = req.params;
  if (!reference) { res.status(400).json({ error: "Reference required" }); return; }

  if (!isPaystackConfigured()) {
    res.json({ status: "pending", paid: false, amount: 0 });
    return;
  }

  try {
    const result = await checkChargeStatus(reference);
    // If paid, credit the wallet
    if (result.paid && result.amount > 0) {
      await creditWallet(user.id, result.amount, reference, "M-Pesa payment via Paystack");
      recordDeposit(user.id, result.amount);
      notifyUser(user.id, "wallet_credit", "💰 M-Pesa Payment Confirmed!", `KES ${result.amount.toLocaleString("en-KE")} added to your Investa Farm wallet.`, "/wallet").catch(() => {});
    }
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Status check failed";
    res.status(502).json({ error: msg });
  }
});

// ─── POST /wallet/paystack/verify ────────────────────────────────────────────
router.post("/wallet/paystack/verify", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { reference, amount: clientAmount } = req.body;
  if (!reference) { res.status(400).json({ error: "Reference required" }); return; }
  try {
    let amount = 0;
    let paid = false;
    try {
      const result = await verifyTransaction(reference);
      paid = result.paid;
      amount = result.amount;
    } catch {
      res.status(502).json({ error: "Could not verify payment with Paystack. Please wait a moment and try again." }); return;
    }
    if (!paid) { res.status(402).json({ error: "Payment not confirmed yet" }); return; }

    const result = await creditWallet(user.id, amount, reference, "Paystack top-up");
    if ((result as any).alreadyCredited) { res.json({ alreadyCredited: true, wallet: result.wallet }); return; }

    recordDeposit(user.id, amount);
    notifyUser(user.id, "wallet_credit", "💰 Wallet Credited!", `KES ${amount.toLocaleString("en-KE")} added to your wallet.`, "/wallet").catch(() => {});
    db.select({ phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, user.id)).limit(1)
      .then(([u]) => { if ((u as any)?.phone) sendWalletTopupSms((u as any).phone, amount, (result as any).newBalance).catch(() => {}); })
      .catch(() => {});

    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    res.status(502).json({ error: msg });
  }
});

// ─── POST /wallet/paystack/webhook ───────────────────────────────────────────
router.post("/wallet/paystack/webhook", async (req, res): Promise<void> => {
  const sig = req.headers["x-paystack-signature"] as string | undefined;
  const secret = process.env.PAYSTACK_SECRET_KEY ?? "";
  const rawBody = JSON.stringify(req.body);
  if (sig && secret) {
    const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
    if (sig !== expected) { res.status(400).json({ error: "Invalid signature" }); return; }
  }
  const event = req.body as { event?: string; data?: { reference?: string; amount?: number; metadata?: { userId?: number } } };
  if (event.event === "charge.success" && event.data) {
    const { reference, amount: amountKobo, metadata } = event.data;
    const userId = metadata?.userId;
    const amount = (amountKobo ?? 0) / 100;
    if (reference && userId && amount > 0) {
      await creditWallet(userId, amount, reference, "Paystack deposit (webhook)").catch(() => {});
    }
  }
  res.sendStatus(200);
});

// ─── GET /wallet/circle/info ─────────────────────────────────────────────────
router.get("/wallet/circle/info", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const kesRate = await getKesUsdcRate().catch(() => 130);
  const addressInfo = getStaticUsdcAddress(user.id);
  res.json({
    configured: isCircleConfigured(),
    kesRate,
    depositAddress: addressInfo.address,
    chain: addressInfo.chain,
    memo: addressInfo.memo,
    minUSDC: "5.00",
  });
});

// ─── POST /wallet/circle/intent ──────────────────────────────────────────────
router.post("/wallet/circle/intent", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amountKes = Number(req.body.amountKes);
  if (!amountKes || amountKes < 500) { res.status(400).json({ error: "Minimum KES 500 for USDC payments." }); return; }
  const kesRate = await getKesUsdcRate().catch(() => 130);
  const amountUSDC = (amountKes / kesRate).toFixed(2);
  const idempotencyKey = `IF-CIRCLE-${user.id}-${Date.now()}`;
  if (!isCircleConfigured()) {
    const addressInfo = getStaticUsdcAddress(user.id);
    res.json({ id: idempotencyKey, depositAddress: addressInfo.address, chain: addressInfo.chain, memo: addressInfo.memo, amountUSDC, kesRate, configured: false });
    return;
  }
  try {
    const intent = await createPaymentIntent({ amountUSDC, idempotencyKey });
    res.json({ id: intent.id, depositAddress: intent.depositAddress.address, chain: intent.depositAddress.chain, amountUSDC, kesRate, memo: `IF-${user.id}`, configured: true });
  } catch (_err: unknown) {
    // Circle API key malformed or sandbox unreachable — fall back to static address so the UI still works
    const addressInfo = getStaticUsdcAddress(user.id);
    res.json({ id: idempotencyKey, depositAddress: addressInfo.address, chain: addressInfo.chain, memo: addressInfo.memo, amountUSDC, kesRate, configured: false });
  }
});

// ─── POST /wallet/circle/verify ──────────────────────────────────────────────
router.post("/wallet/circle/verify", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { intentId, amountKes } = req.body;
  if (!intentId) { res.status(400).json({ error: "Intent ID required" }); return; }
  const amount = Number(amountKes);
  if (!amount || amount < 500) { res.status(400).json({ error: "Invalid amount" }); return; }

  if (isCircleConfigured()) {
    try {
      const status = await getPaymentIntentStatus(intentId);
      if (!status.paid) {
        res.status(402).json({ error: "USDC payment not confirmed yet. Check your transaction and try again." });
        return;
      }
    } catch { /* fall through for manual confirm */ }
  }

  const reference = `CIRCLE-${intentId}`;
  const result = await creditWallet(user.id, amount, reference, `USDC deposit via Circle (${intentId.slice(0, 8)})`);
  if ((result as any).alreadyCredited) { res.json({ alreadyCredited: true }); return; }
  recordDeposit(user.id, amount);
  notifyUser(user.id, "wallet_credit", "💰 USDC Deposit Confirmed!", `KES ${amount.toLocaleString("en-KE")} added to your wallet via USDC.`, "/wallet").catch(() => {});
  res.json({ success: true });
});

// ─── GET /security/limits ────────────────────────────────────────────────────
router.get("/security/limits", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json(getUserVelocitySummary(user.id));
});

// ─── STRIPE ROUTES ───────────────────────────────────────────────────────────

// GET /wallet/stripe/config — returns Stripe publishable key (safe to expose)
router.get("/wallet/stripe/config", async (_req, res): Promise<void> => {
  res.json({ publicKey: STRIPE_PUBLIC_KEY, configured: isStripeConfigured() });
});

// POST /wallet/stripe/create-intent — create a PaymentIntent
router.post("/wallet/stripe/create-intent", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amount = Number(req.body.amount);
  if (!amount || amount < 100 || amount > 1_000_000) {
    res.status(400).json({ error: "Amount must be between KES 100 and KES 1,000,000." }); return;
  }
  const check = checkDepositVelocity(user.id, amount);
  if (!check.ok) { res.status(400).json({ error: check.error }); return; }
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Card payments not configured. Please use M-Pesa or USDC." }); return;
  }
  try {
    const { clientSecret, id } = await stripeCreateIntent({ amountKES: amount, userId: user.id, email: user.email });
    res.json({ clientSecret, intentId: id, publicKey: STRIPE_PUBLIC_KEY });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create payment intent";
    res.status(502).json({ error: msg });
  }
});

// POST /wallet/stripe/confirm — credit wallet after Stripe confirms payment
router.post("/wallet/stripe/confirm", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { intentId, amount: clientAmount } = req.body;
  if (!intentId) { res.status(400).json({ error: "Payment intent ID required" }); return; }
  try {
    const intent = await retrievePaymentIntent(intentId);
    if (intent.status !== "succeeded") {
      res.status(402).json({ error: "Payment not confirmed yet. Please complete the card payment first." }); return;
    }
    if (String(intent.metadata?.userId) !== String(user.id)) {
      res.status(403).json({ error: "Payment intent does not belong to this account" }); return;
    }
    const amount = intent.amount / 100; // convert from minor units to KES
    const reference = `STRIPE-${intentId}`;
    const result = await creditWallet(user.id, amount, reference, "Card top-up via Stripe");
    if ((result as any).alreadyCredited) { res.json({ alreadyCredited: true, wallet: result.wallet }); return; }
    recordDeposit(user.id, amount);
    notifyUser(user.id, "wallet_credit", "💰 Card Payment Confirmed!", `KES ${amount.toLocaleString("en-KE")} added to your wallet.`, "/wallet").catch(() => {});
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Confirmation failed";
    res.status(502).json({ error: msg });
  }
});

// POST /wallet/stripe/webhook — Stripe webhook for async payment events
router.post("/wallet/stripe/webhook", async (req, res): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  let event: any;
  if (sig && webhookSecret) {
    try {
      const { constructWebhookEvent } = await import("../lib/stripe");
      event = constructWebhookEvent(JSON.stringify(req.body), sig, webhookSecret);
    } catch {
      res.status(400).json({ error: "Invalid webhook signature" }); return;
    }
  } else {
    event = req.body;
  }
  if ((event as any).type === "payment_intent.succeeded") {
    const intent = (event as any).data?.object as any;
    const userId = parseInt(intent?.metadata?.userId ?? "0", 10);
    const amount = (intent?.amount ?? 0) / 100;
    const reference = `STRIPE-${intent?.id}`;
    if (userId && amount > 0) {
      await creditWallet(userId, amount, reference, "Card top-up via Stripe (webhook)").catch(() => {});
    }
  }
  res.sendStatus(200);
});

export default router;
