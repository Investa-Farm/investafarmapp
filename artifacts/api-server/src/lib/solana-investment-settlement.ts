import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { and, eq, lte, sql } from "drizzle-orm";
import {
  db,
  farmsTable,
  investmentsTable,
  marketListingsTable,
  solanaInvestmentIntentsTable,
  transactionFeesTable,
  transactionsTable,
} from "@workspace/db";
import { notifyUser } from "./push";
import { recordInvestment } from "./security";
import { isExpectedSolanaUsdcPayment } from "./solana-investment.js";

export const SOLANA_MAINNET_USDC_MINT_ADDRESS =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const USDC_DECIMALS = 6;

export function getSolanaMainnetConfig() {
  const treasuryAddress = process.env["SOLANA_MAINNET_USDC_TREASURY_ADDRESS"]?.trim() ?? "";
  let treasury: PublicKey | null = null;
  try {
    if (treasuryAddress) treasury = new PublicKey(treasuryAddress);
  } catch {
    treasury = null;
  }

  return {
    treasury,
    mint: new PublicKey(SOLANA_MAINNET_USDC_MINT_ADDRESS),
    rpcUrl: process.env["SOLANA_MAINNET_RPC_URL"]?.trim() || clusterApiUrl("mainnet-beta"),
    configured: Boolean(treasury),
  };
}

export function createSolanaMainnetConnection(commitment: "confirmed" | "finalized" = "confirmed") {
  return new Connection(getSolanaMainnetConfig().rpcUrl, commitment);
}

export function solanaTreasuryUsdcAta(treasury: PublicKey, mint = new PublicKey(SOLANA_MAINNET_USDC_MINT_ADDRESS)) {
  return getAssociatedTokenAddressSync(
    mint,
    treasury,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

async function readIntent(id: string) {
  const [intent] = await db
    .select()
    .from(solanaInvestmentIntentsTable)
    .where(eq(solanaInvestmentIntentsTable.id, id))
    .limit(1);
  return intent ?? null;
}

async function releaseReservation(intentId: string, finalStatus: "failed" | "expired"): Promise<void> {
  await db.transaction(async (tx) => {
    const [intent] = await tx
      .select()
      .from(solanaInvestmentIntentsTable)
      .where(eq(solanaInvestmentIntentsTable.id, intentId))
      .for("update")
      .limit(1);
    if (!intent || (intent.status !== "pending" && intent.status !== "submitted")) return;

    const [listing] = await tx
      .select()
      .from(marketListingsTable)
      .where(eq(marketListingsTable.id, intent.listingId))
      .for("update")
      .limit(1);
    if (listing) {
      await tx.update(marketListingsTable)
        .set({ sharesAvailable: sql`${marketListingsTable.sharesAvailable} + ${intent.quantity}` })
        .where(eq(marketListingsTable.id, listing.id));

      if (listing.listingType === "primary") {
        await tx.update(farmsTable)
          .set({ sharesAvailable: sql`${farmsTable.sharesAvailable} + ${intent.quantity}` })
          .where(eq(farmsTable.id, intent.farmId));
      }
    }

    await tx.update(solanaInvestmentIntentsTable)
      .set({ status: finalStatus })
      .where(eq(solanaInvestmentIntentsTable.id, intent.id));
  });
}

async function checkPaymentOnChain(
  intent: typeof solanaInvestmentIntentsTable.$inferSelect,
  signature: string,
  commitment: "confirmed" | "finalized",
): Promise<"not_found" | "failed" | "invalid" | "valid"> {
  const config = getSolanaMainnetConfig();
  if (!config.treasury) return "invalid";
  const connection = createSolanaMainnetConnection(commitment);
  const transaction = await connection.getParsedTransaction(signature, {
    commitment,
    maxSupportedTransactionVersion: 0,
  });
  if (!transaction) return "not_found";
  if (transaction.meta?.err) return "failed";

  const destinationAta = solanaTreasuryUsdcAta(config.treasury, config.mint).toBase58();
  return isExpectedSolanaUsdcPayment(transaction, {
    walletAddress: intent.walletAddress,
    destinationAta,
    mintAddress: config.mint.toBase58(),
    amountRaw: intent.amountUsdcRaw,
    memo: intent.memo,
  }) ? "valid" : "invalid";
}

async function settleVerifiedIntent(intentId: string, signature: string): Promise<boolean> {
  const intent = await readIntent(intentId);
  if (!intent || intent.status !== "submitted" || intent.transactionSignature !== signature) return false;

  const paymentStatus = await checkPaymentOnChain(intent, signature, "finalized");
  if (paymentStatus === "not_found") return false;
  if (paymentStatus !== "valid") {
    await releaseReservation(intent.id, "failed");
    return false;
  }

  let settledUserId: number | null = null;
  await db.transaction(async (tx) => {
    const [lockedIntent] = await tx
      .select()
      .from(solanaInvestmentIntentsTable)
      .where(eq(solanaInvestmentIntentsTable.id, intentId))
      .for("update")
      .limit(1);
    if (
      !lockedIntent ||
      lockedIntent.status !== "submitted" ||
      lockedIntent.transactionSignature !== signature
    ) return;

    const [listing] = await tx
      .select()
      .from(marketListingsTable)
      .where(eq(marketListingsTable.id, lockedIntent.listingId))
      .limit(1);
    if (!listing) {
      await tx.update(solanaInvestmentIntentsTable)
        .set({ status: "failed" })
        .where(eq(solanaInvestmentIntentsTable.id, lockedIntent.id));
      return;
    }

    const exitDays = lockedIntent.exitType === "wide_season" ? 45 : 180;
    const exitDate = new Date(Date.now() + exitDays * 24 * 60 * 60 * 1000);
    const [investment] = await tx.insert(investmentsTable).values({
      investorId: lockedIntent.investorId,
      farmId: lockedIntent.farmId,
      quantity: lockedIntent.quantity,
      purchasePrice: lockedIntent.pricePerShareKes,
      exitType: lockedIntent.exitType,
      exitDate,
      status: "active",
    }).returning({ id: investmentsTable.id });
    if (!investment) throw new Error("Could not create the settled farm investment.");

    await tx.update(farmsTable)
      .set({ tradeCount: sql`${farmsTable.tradeCount} + 1` })
      .where(eq(farmsTable.id, lockedIntent.farmId));

    await tx.insert(transactionsTable).values({
      userId: lockedIntent.investorId,
      farmId: lockedIntent.farmId,
      type: "buy",
      quantity: lockedIntent.quantity,
      pricePerShare: lockedIntent.pricePerShareKes,
      totalAmount: lockedIntent.principalKes,
      exitType: lockedIntent.exitType,
      status: "completed",
    });

    await tx.insert(transactionFeesTable).values({
      investorId: lockedIntent.investorId,
      farmId: lockedIntent.farmId,
      feeType: listing.listingType === "primary" ? "primary_purchase" : "secondary_trade",
      amount: lockedIntent.feeKes,
      currency: "KES",
    });

    await tx.update(solanaInvestmentIntentsTable)
      .set({
        status: "settled",
        investmentId: investment.id,
        settledAt: new Date(),
      })
      .where(eq(solanaInvestmentIntentsTable.id, lockedIntent.id));

    settledUserId = lockedIntent.investorId;
  });

  if (settledUserId !== null) {
    recordInvestment(settledUserId, Number(intent.principalKes));
    notifyUser(
      settledUserId,
      "investment_made",
      "🌾 Solana USDC Investment Confirmed",
      `${intent.quantity} share${intent.quantity === 1 ? "" : "s"} confirmed in KES-priced shares. The KES wallet was not used.`,
      "/portfolio",
    ).catch(() => {});
    return true;
  }
  const latest = await readIntent(intentId);
  return latest?.status === "settled" && latest.transactionSignature === signature;
}

export async function confirmSolanaInvestmentPayment(
  intentId: string,
  signature: string,
  accountAddress: string,
): Promise<{ status: "settled" | "pending" | "invalid" | "expired" | "not_found"; message: string }> {
  const intent = await readIntent(intentId);
  if (!intent) return { status: "not_found", message: "This investment request was not found." };
  if (intent.walletAddress !== accountAddress) {
    return { status: "invalid", message: "The confirmation wallet does not match the investment request." };
  }
  if (intent.status === "settled") {
    return intent.transactionSignature === signature
      ? { status: "settled", message: "USDC payment confirmed and farm shares credited." }
      : { status: "invalid", message: "This investment request has already been settled with another transaction." };
  }
  if (intent.status === "expired" || intent.status === "failed") {
    return { status: "expired", message: "This investment request is no longer active. No shares were credited." };
  }
  if (intent.transactionSignature && intent.transactionSignature !== signature) {
    return { status: "invalid", message: "A different transaction is already being verified for this investment." };
  }

  if (intent.status === "pending" && intent.expiresAt <= new Date()) {
    await releaseReservation(intent.id, "expired");
    return { status: "expired", message: "This investment request expired. No shares were credited." };
  }

  const paymentStatus = await checkPaymentOnChain(intent, signature, "confirmed");
  if (paymentStatus === "not_found") {
    return { status: "pending", message: "Solana has not returned this transaction yet. No shares have been credited." };
  }
  if (paymentStatus !== "valid") {
    return { status: "invalid", message: "The transaction did not match this farm purchase. No shares were credited." };
  }

  if (intent.status === "pending") {
    await db.update(solanaInvestmentIntentsTable)
      .set({ status: "submitted", transactionSignature: signature })
      .where(and(
        eq(solanaInvestmentIntentsTable.id, intent.id),
        eq(solanaInvestmentIntentsTable.status, "pending"),
      ));
  }

  const settled = await settleVerifiedIntent(intent.id, signature);
  return settled
    ? { status: "settled", message: "USDC payment confirmed and farm shares credited." }
    : { status: "pending", message: "Payment is confirmed on Solana and is awaiting final settlement. Do not send again." };
}

export async function reconcileSolanaInvestmentPayments(): Promise<void> {
  const pending = await db
    .select()
    .from(solanaInvestmentIntentsTable)
    .where(eq(solanaInvestmentIntentsTable.status, "submitted"))
    .limit(50);

  for (const intent of pending) {
    if (!intent.transactionSignature) continue;
    try {
      await settleVerifiedIntent(intent.id, intent.transactionSignature);
    } catch (error) {
      console.warn("[solana-investment] Confirmation retry failed:", error instanceof Error ? error.message : "unknown error");
    }
  }

  const expired = await db
    .select({ id: solanaInvestmentIntentsTable.id })
    .from(solanaInvestmentIntentsTable)
    .where(and(
      eq(solanaInvestmentIntentsTable.status, "pending"),
      lte(solanaInvestmentIntentsTable.expiresAt, new Date()),
    ))
    .limit(50);

  for (const intent of expired) {
    try {
      await releaseReservation(intent.id, "expired");
    } catch (error) {
      console.warn("[solana-investment] Expired reservation cleanup failed:", error instanceof Error ? error.message : "unknown error");
    }
  }
}
