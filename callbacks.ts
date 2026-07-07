import { Router } from "express";
import { db, walletTransactionsTable, walletsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { validateMpesaCallback } from "../middleware/mpesaAuth";

const router = Router();

router.post("/mpesa/stk/callback", validateMpesaCallback, async (req, res) => {
  try {
    const callbackData = req.body?.Body?.stkCallback;
    if (!callbackData) {
      console.error("Malformed STK callback payload:", req.body);
      return res.status(400).json({ ResultCode: 1, ResultDesc: "Malformed payload" });
    }

    const checkoutId = callbackData.CheckoutRequestID;

    if (callbackData.ResultCode !== 0) {
      // ---------------------------------------------------------------
      // FIX: same idempotency guard applies here — only move a still-
      // pending row to "failed", never touch one already resolved.
      // ---------------------------------------------------------------
      await db.update(walletTransactionsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(and(
          eq(walletTransactionsTable.conversationId, checkoutId),
          eq(walletTransactionsTable.status, "pending")
        ));
      return res.json({ ResultCode: 0, ResultDesc: "Failure recorded" });
    }

    const metadataItems = callbackData.CallbackMetadata?.Item || [];
    const amount = metadataItems.find((i: any) => i.Name === "Amount")?.Value;
    const receipt = metadataItems.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;

    if (amount === undefined || !receipt) {
      console.error("STK callback missing Amount or MpesaReceiptNumber:", req.body);
      return res.status(400).json({ ResultCode: 1, ResultDesc: "Incomplete callback metadata" });
    }

    // -------------------------------------------------------------------
    // FIX (critical - double crediting): the original update matched only
    // on conversationId, with no check on current status. Safaricom retries
    // callbacks if it doesn't get a timely/valid ack, so a retry would match
    // the *already-completed* row again, re-trigger the balance credit
    // below, and pay the user twice for one deposit. Adding
    // `status = 'pending'` to the WHERE clause means a retry finds zero
    // matching rows and the balance update is skipped entirely.
    //
    // FIX (race condition / lost update): the original flow was
    //   1. SELECT wallet
    //   2. newBalance = wallet.balance + amount   (computed in JS)
    //   3. UPDATE wallet SET balance = newBalance
    // Two callbacks (or a callback racing a withdrawal) resolving between
    // steps 1 and 3 can both read the same starting balance and one update
    // clobbers the other, silently losing money. We replace this with a
    // single atomic `balance = balance + amount` SQL expression, and wrap
    // both writes in one DB transaction so a crash between them can't leave
    // the transaction marked "completed" without the wallet actually being
    // credited.
    // -------------------------------------------------------------------
    await db.transaction(async (tx) => {
      const [updatedTx] = await tx.update(walletTransactionsTable)
        .set({ status: "completed", mpesaReceiptNumber: receipt, updatedAt: new Date() })
        .where(and(
          eq(walletTransactionsTable.conversationId, checkoutId),
          eq(walletTransactionsTable.status, "pending")
        ))
        .returning();

      // No row updated means this transaction was already processed
      // (duplicate callback) or never existed — either way, do not touch
      // the wallet balance.
      if (!updatedTx) return;

      // FIX: verify the amount Safaricom confirms matches what was
      // originally requested, rather than blindly crediting whatever
      // figure comes back in CallbackMetadata.
      if (Number(updatedTx.amount) !== Number(amount)) {
        console.error(
          `Amount mismatch for checkoutId=${checkoutId}: expected ${updatedTx.amount}, got ${amount}`
        );
        // Flag for manual review instead of silently crediting a different
        // amount than what was recorded at initiation.
        await tx.update(walletTransactionsTable)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(walletTransactionsTable.id, updatedTx.id));
        return;
      }

      await tx.update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} + ${amount}` })
        .where(eq(walletsTable.userId, updatedTx.userId));
    });

    res.json({ ResultCode: 0, ResultDesc: "Success" });
  } catch (err) {
    console.error("Error processing STK callback:", err);
    // Return non-zero so Safaricom's retry logic kicks in rather than
    // treating a server-side error as a permanently-handled callback.
    res.status(500).json({ ResultCode: 1, ResultDesc: "Internal error" });
  }
});

router.post("/mpesa/b2c/result", validateMpesaCallback, async (req, res) => {
  try {
    const result = req.body?.Result;
    if (!result) {
      console.error("Malformed B2C result payload:", req.body);
      return res.status(400).json({ ResultCode: 1, ResultDesc: "Malformed payload" });
    }

    const conversationId = result.ConversationID;

    if (result.ResultCode !== 0) {
      await db.update(walletTransactionsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(and(
          eq(walletTransactionsTable.conversationId, conversationId),
          eq(walletTransactionsTable.status, "pending")
        ));
      return res.json({ ResultCode: 0, ResultDesc: "Recorded" });
    }

    const mpesaRef = result.TransactionID;

    // FIX: same idempotency guard as the STK handler — only transition a
    // still-pending withdrawal, so a retried result callback is a no-op
    // rather than re-processing an already-settled payout.
    await db.update(walletTransactionsTable)
      .set({ status: "completed", mpesaReceiptNumber: mpesaRef, updatedAt: new Date() })
      .where(and(
        eq(walletTransactionsTable.conversationId, conversationId),
        eq(walletTransactionsTable.status, "pending")
      ));

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    console.error("Error processing B2C result callback:", err);
    res.status(500).json({ ResultCode: 1, ResultDesc: "Internal error" });
  }
});

router.post("/mpesa/b2c/timeout", async (req, res) => {
  console.error("M-Pesa B2C Timeout:", req.body);
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

export default router;
