/**
 * Atomic wallet operations using PostgreSQL transactions.
 * All multi-step financial operations go through here to guarantee consistency.
 */

import { db, walletsTable, walletTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface TransferResult {
  fromNewBalance: number;
  toNewBalance: number;
}

/**
 * Atomically transfer funds from one user wallet to another.
 * Throws if sender has insufficient balance.
 */
export async function transferFunds(
  fromUserId: number,
  toUserId: number,
  amount: number,
  opts: {
    fromDescription: string;
    toDescription: string;
    fromReference: string;
    toReference: string;
    type?: "transfer" | "return" | "investment";
  }
): Promise<TransferResult> {
  if (amount <= 0) throw new Error("Transfer amount must be positive");

  return db.transaction(async (tx) => {
    const [fromWallet] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, fromUserId));
    const [toWallet]   = await tx.select().from(walletsTable).where(eq(walletsTable.userId, toUserId));

    if (!fromWallet) throw new Error(`Wallet not found for user ${fromUserId}`);
    if (!toWallet)   throw new Error(`Wallet not found for user ${toUserId}`);

    const fromBal = parseFloat(fromWallet.balance);
    if (fromBal < amount) {
      throw new Error(`Insufficient balance: need KES ${amount.toLocaleString()} but have KES ${fromBal.toLocaleString()}`);
    }

    const fromNewBalance = parseFloat((fromBal - amount).toFixed(2));
    const toNewBalance   = parseFloat((parseFloat(toWallet.balance) + amount).toFixed(2));

    await tx.update(walletsTable)
      .set({ balance: String(fromNewBalance), updatedAt: new Date() })
      .where(eq(walletsTable.id, fromWallet.id));

    await tx.update(walletsTable)
      .set({ balance: String(toNewBalance), updatedAt: new Date() })
      .where(eq(walletsTable.id, toWallet.id));

    await tx.insert(walletTransactionsTable).values({
      walletId: fromWallet.id,
      userId: fromUserId,
      type: opts.type ?? "transfer",
      amount: String(amount),
      balanceAfter: String(fromNewBalance),
      description: opts.fromDescription,
      reference: opts.fromReference,
      status: "completed",
    });

    await tx.insert(walletTransactionsTable).values({
      walletId: toWallet.id,
      userId: toUserId,
      type: opts.type === "investment" ? "return" : (opts.type ?? "transfer"),
      amount: String(amount),
      balanceAfter: String(toNewBalance),
      description: opts.toDescription,
      reference: opts.toReference,
      status: "completed",
    });

    return { fromNewBalance, toNewBalance };
  });
}

/**
 * Credit a single wallet (no paired debit — used for dividends, harvest payouts, etc.)
 */
export async function creditWallet(
  userId: number,
  amount: number,
  opts: {
    type: "deposit" | "return" | "investment";
    description: string;
    reference: string;
  }
): Promise<number> {
  if (amount <= 0) throw new Error("Credit amount must be positive");

  return db.transaction(async (tx) => {
    const [wallet] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, userId));
    if (!wallet) throw new Error(`Wallet not found for user ${userId}`);

    const newBalance = parseFloat((parseFloat(wallet.balance) + amount).toFixed(2));

    await tx.update(walletsTable)
      .set({ balance: String(newBalance), updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    await tx.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      userId,
      type: opts.type,
      amount: String(amount),
      balanceAfter: String(newBalance),
      description: opts.description,
      reference: opts.reference,
      status: "completed",
    });

    return newBalance;
  });
}

/**
 * Debit a single wallet (no paired credit — used for fees, etc.)
 */
export async function debitWallet(
  userId: number,
  amount: number,
  opts: {
    type: "withdrawal" | "investment" | "fee";
    description: string;
    reference: string;
  }
): Promise<number> {
  if (amount <= 0) throw new Error("Debit amount must be positive");

  return db.transaction(async (tx) => {
    const [wallet] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, userId));
    if (!wallet) throw new Error(`Wallet not found for user ${userId}`);

    const currentBal = parseFloat(wallet.balance);
    if (currentBal < amount) {
      throw new Error(`Insufficient balance: need KES ${amount.toLocaleString()} but have KES ${currentBal.toLocaleString()}`);
    }

    const newBalance = parseFloat((currentBal - amount).toFixed(2));

    await tx.update(walletsTable)
      .set({ balance: String(newBalance), updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    await tx.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      userId,
      type: opts.type,
      amount: String(amount),
      balanceAfter: String(newBalance),
      description: opts.description,
      reference: opts.reference,
      status: "completed",
    });

    return newBalance;
  });
}

/**
 * Ensure a wallet exists for a user, creating it if needed.
 */
export async function ensureWallet(userId: number) {
  const [existing] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db.insert(walletsTable).values({ userId }).returning();
  return created!;
}
