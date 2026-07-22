import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, walletsTable, walletTransactionsTable, escrowWalletsTable, usersTable, investmentsTable, farmsTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import {
  financialRateLimit,
  requireNonce,
  checkDepositVelocity, recordDeposit,
  checkWithdrawalVelocity, recordWithdrawal,
  getUserVelocitySummary,
} from "../lib/security";
import { notifyUser } from "../lib/push";
import { sendWalletTopupSms, sendWithdrawalSms, sendCardWithdrawalSms, sendUsdcWithdrawalSms } from "../lib/sms";
import { sendWalletCreditEmail, sendWithdrawalConfirmationEmail } from "../lib/email";
import { isCircleConfigured, getKesUsdcRate, createPaymentIntent, getPaymentIntentStatus, getStaticUsdcAddress } from "../lib/circle";
import {
  isConfigured as isPesapalConfigured,
  ensureIpnRegistered,
  submitOrder,
  getTransactionStatus,
} from "../lib/pesapal";
import { getPolygonTxStatus } from "../lib/polygonscan";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAppUrl(): string {
  // In production on Render, APP_URL is set. In Replit dev, use REPLIT_DEV_DOMAIN.
  return (
    process.env.APP_URL ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://investafarm.com")
  );
}

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

// ─── WALLET PIN ROUTES ───────────────────────────────────────────────────────

// GET /wallet/pin/status — check whether the user has a wallet PIN set
router.get("/wallet/pin/status", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [u] = await db.select({ walletPin: usersTable.walletPin }).from(usersTable).where(eq(usersTable.id, user.id));
  res.json({ hasPin: !!u?.walletPin });
});

// POST /wallet/pin/setup — create or reset the wallet PIN (bcrypt-hashed)
router.post("/wallet/pin/setup", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { pin } = req.body;
  if (!pin || !/^\d{4}$/.test(String(pin))) {
    res.status(400).json({ error: "PIN must be exactly 4 digits" }); return;
  }
  const hash = await bcrypt.hash(String(pin), 10);
  await db.update(usersTable).set({ walletPin: hash } as any).where(eq(usersTable.id, user.id));
  res.json({ success: true });
});

// POST /wallet/pin/verify — verify the wallet PIN before a transaction
router.post("/wallet/pin/verify", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { pin } = req.body;
  if (!pin) { res.status(400).json({ error: "PIN required" }); return; }
  const [u] = await db.select({ walletPin: usersTable.walletPin }).from(usersTable).where(eq(usersTable.id, user.id));
  if (!u?.walletPin) {
    res.status(400).json({ error: "No PIN set — please create a wallet PIN first." }); return;
  }
  const valid = await bcrypt.compare(String(pin), u.walletPin);
  if (!valid) { res.status(401).json({ error: "Incorrect PIN. Please try again." }); return; }
  res.json({ valid: true });
});

// ─── GET /wallet ─────────────────────────────────────────────────────────────
router.get("/wallet", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const wallet = await getOrCreateWallet(user.id);
  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(and(eq(walletTransactionsTable.userId, user.id), isNull(walletTransactionsTable.deletedAt)))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(30);
  res.json({ wallet, transactions });
});

// DELETE /wallet/transactions/:id — hide a wallet transaction (soft delete)
router.delete("/wallet/transactions/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params["id"] ?? "", 10);
  if (!id) { res.status(400).json({ error: "Invalid transaction id" }); return; }

  const [row] = await db
    .select({ id: walletTransactionsTable.id })
    .from(walletTransactionsTable)
    .where(and(eq(walletTransactionsTable.id, id), eq(walletTransactionsTable.userId, user.id), isNull(walletTransactionsTable.deletedAt)));
  if (!row) { res.status(404).json({ error: "Transaction not found" }); return; }

  await db.update(walletTransactionsTable).set({ deletedAt: new Date() }).where(eq(walletTransactionsTable.id, id));
  res.json({ success: true });
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
  if (user.maxDepositKES && amount > Number(user.maxDepositKES)) {
    res.status(400).json({ error: `Deposit of KES ${amount.toLocaleString()} exceeds your single-transaction limit of KES ${Number(user.maxDepositKES).toLocaleString()}.` }); return;
  }
  const result = await creditWallet(user.id, amount, `DEP-${Date.now()}`, req.body.description ?? "Direct deposit");
  recordDeposit(user.id, amount);
  res.json(result);
});

// ─── POST /wallet/withdraw ───────────────────────────────────────────────────
router.post("/wallet/withdraw", financialRateLimit, requireNonce, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amount = Number(req.body.amount);
  if (!amount || isNaN(amount)) { res.status(400).json({ error: "Invalid amount." }); return; }
  const check = checkWithdrawalVelocity(user.id, amount);
  if (!check.ok) { res.status(400).json({ error: check.error }); return; }
  if (user.maxWithdrawalKES && amount > Number(user.maxWithdrawalKES)) {
    res.status(400).json({ error: `Withdrawal of KES ${amount.toLocaleString()} exceeds your single-transaction limit of KES ${Number(user.maxWithdrawalKES).toLocaleString()}.` }); return;
  }
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
    description: `Withdraw to mobile money${phoneDisplay}`.trim(), reference: ref, status: "completed",
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
  notifyUser(user.id, "withdrawal", "Withdrawal Initiated", `KES ${amount.toLocaleString("en-KE")} sent to mobile money. Processing 1-2 business days.`, "/wallet").catch(() => {});
  sendWithdrawalConfirmationEmail(user.email, user.name, amount, fee, phone || user.phone || "Mobile Money", ref).catch(() => {});
  if (user.phone) sendWithdrawalSms(user.phone, amount, fee).catch(() => {});
  res.json({ wallet: { ...wallet, balance: String(newBalance) }, fee });
});

// ─── CIRCLE / USDC ROUTES ─────────────────────────────────────────────────────

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
  } catch {
    const addressInfo = getStaticUsdcAddress(user.id);
    res.json({ id: idempotencyKey, depositAddress: addressInfo.address, chain: addressInfo.chain, memo: addressInfo.memo, amountUSDC, kesRate, configured: false });
  }
});

const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const POLYGON_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function verifyPolygonUsdcTx(txHash: string, toAddress: string, minUsdc: number): Promise<boolean> {
  try {
    const resp = await fetch("https://polygon-rpc.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
    });
    const data = await resp.json() as any;
    const receipt = data?.result;
    if (!receipt || receipt.status !== "0x1") return false;
    if (receipt.to?.toLowerCase() !== USDC_POLYGON.toLowerCase()) return false;
    for (const log of (receipt.logs ?? [])) {
      if (log.address?.toLowerCase() !== USDC_POLYGON.toLowerCase()) continue;
      if (log.topics?.[0] !== POLYGON_TRANSFER_TOPIC) continue;
      const recipientRaw: string = log.topics?.[2] ?? "";
      const recipient = "0x" + recipientRaw.slice(-40);
      if (recipient.toLowerCase() !== toAddress.toLowerCase()) continue;
      const rawAmt = parseInt(log.data, 16);
      const usdcAmt = rawAmt / 1_000_000;
      if (usdcAmt >= minUsdc * 0.99) return true;
    }
    return false;
  } catch { return false; }
}

router.post("/wallet/circle/verify", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { intentId, amountKes, txHash } = req.body;
  if (!intentId) { res.status(400).json({ error: "Intent ID required" }); return; }
  const amount = Number(amountKes);
  if (!amount || amount < 500) { res.status(400).json({ error: "Invalid amount" }); return; }

  if (isCircleConfigured()) {
    try {
      const status = await getPaymentIntentStatus(intentId);
      if (!status.paid) {
        res.status(402).json({ error: "USDC payment not confirmed yet. Check your transaction and try again in a moment." });
        return;
      }
    } catch { /* Circle API error — fall through to txHash verification */ }
  } else if (txHash && typeof txHash === "string" && txHash.startsWith("0x")) {
    const kesRate = await getKesUsdcRate().catch(() => 130);
    const expectedUsdc = amount / kesRate;
    const { address: depositAddress } = getStaticUsdcAddress(user.id);
    const valid = await verifyPolygonUsdcTx(txHash, depositAddress, expectedUsdc);
    if (!valid) {
      res.status(402).json({ error: "Transaction not found or amount mismatch. Please wait a moment for the transaction to confirm, then try again." });
      return;
    }
  } else {
    res.status(402).json({
      error: "USDC payment could not be verified. Please connect your MetaMask, Coinbase, or Binance wallet and send the transaction — we'll verify it on-chain automatically.",
    });
    return;
  }

  const reference = `CIRCLE-${txHash ?? intentId}`;
  const result = await creditWallet(user.id, amount, reference, `USDC deposit${txHash ? ` (tx: ${txHash.slice(0, 10)}…)` : ` via Circle (${intentId.slice(0, 8)})`}`);
  if ((result as any).alreadyCredited) { res.json({ alreadyCredited: true }); return; }
  recordDeposit(user.id, amount);
  notifyUser(user.id, "wallet_credit", "💰 USDC Deposit Confirmed!", `KES ${amount.toLocaleString("en-KE")} added to your wallet via USDC.`, "/wallet").catch(() => {});
  res.json({ success: true });
});

router.get("/wallet/circle/tx-status", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const txHash = String(req.query.txHash ?? "");
  if (!txHash.startsWith("0x")) { res.status(400).json({ error: "Invalid tx hash" }); return; }
  const result = await getPolygonTxStatus(txHash);
  res.json(result);
});

// ─── SECURITY LIMITS ─────────────────────────────────────────────────────────
router.get("/security/limits", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json(getUserVelocitySummary(user.id));
});

// ─── PESAPAL ROUTES ───────────────────────────────────────────────────────────

// In-memory pending order map: orderTrackingId → { userId, amount, reference }
const pendingPesapalOrders = new Map<string, { userId: number; amount: number; reference: string }>();

/**
 * POST /wallet/pesapal/order
 * Creates a PesaPal hosted checkout order.
 * Returns { orderTrackingId, redirectUrl, configured } to the client.
 * The client embeds redirectUrl in an iframe for the user to complete payment.
 */
router.post("/wallet/pesapal/order", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const amount = Number(req.body.amount);
  const currency = String(req.body.currency ?? "KES").toUpperCase();
  // Optional: pre-select the payment method on PesaPal's hosted checkout
  const paymentMethodCode = typeof req.body.paymentMethodCode === "string" ? req.body.paymentMethodCode : undefined;
  const phoneOverride = typeof req.body.phone === "string" ? req.body.phone.trim() : undefined;

  if (!amount || amount < 10 || amount > 5_000_000) {
    res.status(400).json({ error: "Amount must be between 10 and 5,000,000." }); return;
  }

  const check = checkDepositVelocity(user.id, amount);
  if (!check.ok) { res.status(400).json({ error: check.error }); return; }

  const reference = `IF-PP-${user.id}-${Date.now()}`;
  const appUrl = getAppUrl();

  if (!isPesapalConfigured()) {
    // Dev demo mode — auto-credit after a short delay
    const demoId = `DEMO-PP-${Date.now()}`;
    pendingPesapalOrders.set(demoId, { userId: user.id, amount, reference });
    setTimeout(() => pendingPesapalOrders.delete(demoId), 15 * 60 * 1000);
    res.json({ orderTrackingId: demoId, redirectUrl: "", configured: false });
    return;
  }

  try {
    // Ensure IPN is registered (idempotent)
    const ipnUrl = `${appUrl}/api/wallet/pesapal/ipn`;
    const ipnId = await ensureIpnRegistered(ipnUrl);

    const nameParts = (user.name ?? "").split(" ");
    const order = await submitOrder({
      reference,
      amount,
      currency,
      description: `Investa Farm wallet top-up — ${user.email}`,
      email: user.email,
      phone: phoneOverride ?? user.phone ?? undefined,
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" ") || undefined,
      ipnId,
      callbackUrl: `${appUrl}/wallet?pp_ref=${reference}`,
      paymentMethodCode,
    });

    // Store so IPN callback can credit the wallet
    pendingPesapalOrders.set(order.orderTrackingId, { userId: user.id, amount, reference });
    setTimeout(() => pendingPesapalOrders.delete(order.orderTrackingId), 30 * 60 * 1000);

    res.json({ orderTrackingId: order.orderTrackingId, redirectUrl: order.redirectUrl, configured: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create PesaPal order";
    res.status(502).json({ error: msg });
  }
});

/**
 * GET /wallet/pesapal/status/:orderTrackingId
 * Poll this until paid === true. Credits the wallet on first confirmed poll.
 */
router.get("/wallet/pesapal/status/:orderTrackingId", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { orderTrackingId } = req.params;
  if (!orderTrackingId) { res.status(400).json({ error: "orderTrackingId required" }); return; }

  // Demo mode
  if (orderTrackingId.startsWith("DEMO-PP-")) {
    const pending = pendingPesapalOrders.get(orderTrackingId);
    if (!pending) { res.json({ paid: false, statusCode: "Pending" }); return; }
    // Credit on first poll (simulates immediate payment)
    const { amount, reference } = pending;
    const result = await creditWallet(user.id, amount, `PESAPAL-${reference}`, "PesaPal demo deposit");
    if (!(result as any).alreadyCredited) recordDeposit(user.id, amount);
    pendingPesapalOrders.delete(orderTrackingId);
    res.json({ paid: true, statusCode: "Completed", amount });
    return;
  }

  if (!isPesapalConfigured()) {
    res.json({ paid: false, statusCode: "Pending", amount: 0 }); return;
  }

  try {
    const status = await getTransactionStatus(orderTrackingId);
    if (status.paid) {
      const pending = pendingPesapalOrders.get(orderTrackingId);
      const creditAmount = status.amount > 0 ? status.amount : pending?.amount ?? 0;
      const reference = pending?.reference ?? `PESAPAL-${orderTrackingId}`;
      const creditRef = `PESAPAL-${status.confirmationCode || orderTrackingId}`;

      if (creditAmount > 0) {
        const creditUserId = pending?.userId ?? user.id;
        const result = await creditWallet(creditUserId, creditAmount, creditRef, `PesaPal deposit via ${status.paymentMethod || "mobile money"}`);
        if (!(result as any).alreadyCredited) {
          recordDeposit(creditUserId, creditAmount);
          notifyUser(creditUserId, "wallet_credit", "💰 Payment Confirmed!", `KES ${creditAmount.toLocaleString("en-KE")} added to your Investa Farm wallet.`, "/wallet").catch(() => {});
          // Send email/SMS confirmations
          const userRow = await db.select({ phone: usersTable.phone, email: usersTable.email, name: usersTable.name })
            .from(usersTable).where(eq(usersTable.id, creditUserId)).limit(1).then(r => r[0]).catch(() => null);
          if (userRow) {
            const newBal = parseFloat((result as any).wallet?.balance ?? "0");
            sendWalletCreditEmail(userRow.email, userRow.name, creditAmount, newBal, "PesaPal").catch(() => {});
            if (userRow.phone) sendWalletTopupSms(userRow.phone, creditAmount, newBal).catch(() => {});
          }
        }
        pendingPesapalOrders.delete(orderTrackingId);
      }
    }
    res.json(status);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Status check failed";
    res.status(502).json({ error: msg });
  }
});

/**
 * POST /wallet/pesapal/ipn
 * PesaPal calls this when a payment completes (no auth, validate by querying status).
 */
router.post("/wallet/pesapal/ipn", async (req, res): Promise<void> => {
  try {
    const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = req.body as {
      OrderTrackingId?: string;
      OrderMerchantReference?: string;
      OrderNotificationType?: string;
    };

    if (!OrderTrackingId) {
      res.json({ orderNotificationType: OrderNotificationType, orderTrackingId: "", orderMerchantReference: "", status: "200" });
      return;
    }

    if (!isPesapalConfigured()) {
      res.json({ orderNotificationType: OrderNotificationType, orderTrackingId: OrderTrackingId, orderMerchantReference: OrderMerchantReference ?? "", status: "200" });
      return;
    }

    const status = await getTransactionStatus(OrderTrackingId);
    if (status.paid) {
      const pending = pendingPesapalOrders.get(OrderTrackingId);
      const creditAmount = status.amount > 0 ? status.amount : pending?.amount ?? 0;
      const creditUserId = pending?.userId;
      const creditRef = `PESAPAL-${status.confirmationCode || OrderTrackingId}`;

      if (creditUserId && creditAmount > 0) {
        const result = await creditWallet(creditUserId, creditAmount, creditRef, `PesaPal deposit via ${status.paymentMethod || "mobile money"}`).catch(e => {
          console.error("[PesaPal IPN] creditWallet error:", e);
          return null;
        });
        if (result && !(result as any).alreadyCredited) {
          recordDeposit(creditUserId, creditAmount);
          notifyUser(creditUserId, "wallet_credit", "💰 Payment Confirmed!", `KES ${creditAmount.toLocaleString("en-KE")} added to your Investa Farm wallet.`, "/wallet").catch(() => {});
          const userRow = await db.select({ phone: usersTable.phone, email: usersTable.email, name: usersTable.name })
            .from(usersTable).where(eq(usersTable.id, creditUserId)).limit(1).then(r => r[0]).catch(() => null);
          if (userRow) {
            const newBal = parseFloat((result as any).wallet?.balance ?? "0");
            sendWalletCreditEmail(userRow.email, userRow.name, creditAmount, newBal, "PesaPal").catch(() => {});
            if (userRow.phone) sendWalletTopupSms(userRow.phone, creditAmount, newBal).catch(() => {});
          }
          console.info(`[PesaPal IPN] Credited KES ${creditAmount} to user ${creditUserId} — ref ${status.confirmationCode}`);
        }
        pendingPesapalOrders.delete(OrderTrackingId);
      } else {
        console.warn(`[PesaPal IPN] No pending entry for ${OrderTrackingId} — merchant ref: ${OrderMerchantReference}`);
      }
    }

    // PesaPal requires this exact response shape
    res.json({
      orderNotificationType: OrderNotificationType,
      orderTrackingId: OrderTrackingId,
      orderMerchantReference: OrderMerchantReference ?? "",
      status: "200",
    });
  } catch (e) {
    console.error("[PesaPal IPN] Error:", e);
    res.json({ status: "200" }); // always 200 to avoid PesaPal retries flooding us
  }
});


// ─── GET /wallet/pending-exits ───────────────────────────────────────────────
router.get("/wallet/pending-exits", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
      investmentId: investmentsTable.id,
      shares: investmentsTable.quantity,
      purchasePrice: investmentsTable.purchasePrice,
      exitType: investmentsTable.exitType,
      exitDate: investmentsTable.exitDate,
      farmName: farmsTable.name,
      cropType: farmsTable.cropType,
    })
    .from(investmentsTable)
    .leftJoin(farmsTable, eq(investmentsTable.farmId, farmsTable.id))
    .where(and(
      eq(investmentsTable.investorId, user.id),
      eq(investmentsTable.status, "exit_requested"),
    ));

  const total = rows.reduce((sum, r) => sum + r.shares * Number(r.purchasePrice ?? 0), 0);

  res.json({
    pendingTotal: total,
    count: rows.length,
    exits: rows.map(r => ({
      investmentId: r.investmentId,
      farmName: r.farmName ?? "Unknown Farm",
      cropType: r.cropType ?? "",
      shares: r.shares,
      amount: r.shares * Number(r.purchasePrice ?? 0),
      exitType: r.exitType ?? "full_season",
      exitDate: r.exitDate ? new Date(r.exitDate).toISOString() : null,
    })),
  });
});

// ─── POST /wallet/withdraw/card ──────────────────────────────────────────────
router.post("/wallet/withdraw/card", financialRateLimit, requireNonce, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amount = Number(req.body.amount);
  if (!amount || isNaN(amount) || amount < 100) { res.status(400).json({ error: "Minimum withdrawal is KES 100" }); return; }
  const { cardholderName, cardNumber: cardNum } = req.body;
  if (!cardholderName?.trim() || !cardNum?.trim()) { res.status(400).json({ error: "Cardholder name and card number are required" }); return; }
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
  const ref = `WCARD-${Date.now()}`;
  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id, userId: user.id, type: "withdrawal",
    amount: String(amount), balanceAfter: String(newBalance),
    description: `Card withdrawal to ••••${String(cardNum).slice(-4)} (${cardholderName})`, reference: ref, status: "processing",
  });
  if (fee > 0) {
    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id, userId: user.id, type: "fee",
      amount: String(fee), balanceAfter: String(newBalance),
      description: "Withdrawal fee (0.5%, max KES 260)", reference: `FEE-${ref}`, status: "completed",
    }).catch(() => {});
  }
  recordWithdrawal(user.id, amount);
  notifyUser(user.id, "withdrawal", "Card Withdrawal Initiated",
    `KES ${amount.toLocaleString("en-KE")} will arrive at your card within 2–5 business days.`, "/wallet").catch(() => {});
  if (user.phone) sendCardWithdrawalSms(user.phone, amount, fee).catch(() => {});
  res.json({ wallet: { ...wallet, balance: String(newBalance) }, fee, ref, status: "processing" });
});

// ─── POST /wallet/withdraw/usdc ──────────────────────────────────────────────
router.post("/wallet/withdraw/usdc", financialRateLimit, requireNonce, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const amount = Number(req.body.amount);
  if (!amount || isNaN(amount) || amount < 500) { res.status(400).json({ error: "Minimum USDC withdrawal is KES 500" }); return; }
  const { walletAddress } = req.body;
  if (!walletAddress?.startsWith("0x") || walletAddress.length < 42) {
    res.status(400).json({ error: "Invalid Polygon USDC wallet address — must start with 0x and be 42 chars" }); return;
  }
  const check = checkWithdrawalVelocity(user.id, amount);
  if (!check.ok) { res.status(400).json({ error: check.error }); return; }
  const wallet = await getOrCreateWallet(user.id);
  const kesRate = await getKesUsdcRate().catch(() => 130);
  const usdcAmount = (amount / kesRate).toFixed(2);
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
  const ref = `WUSDC-${Date.now()}`;
  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id, userId: user.id, type: "withdrawal",
    amount: String(amount), balanceAfter: String(newBalance),
    description: `USDC withdrawal (${usdcAmount} USDC) → ${walletAddress.slice(0, 8)}…${walletAddress.slice(-4)}`,
    reference: ref, status: "processing",
  });
  if (fee > 0) {
    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id, userId: user.id, type: "fee",
      amount: String(fee), balanceAfter: String(newBalance),
      description: "Withdrawal fee (0.5%, max KES 260)", reference: `FEE-${ref}`, status: "completed",
    }).catch(() => {});
  }
  recordWithdrawal(user.id, amount);
  notifyUser(user.id, "withdrawal", "USDC Withdrawal Queued",
    `${usdcAmount} USDC being sent to your Polygon wallet. Usually arrives within 30 min.`, "/wallet").catch(() => {});
  if (user.phone) sendUsdcWithdrawalSms(user.phone, amount, usdcAmount, fee).catch(() => {});
  res.json({ wallet: { ...wallet, balance: String(newBalance) }, fee, ref, usdcAmount, status: "processing" });
});

export default router;
