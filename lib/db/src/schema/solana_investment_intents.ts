import { integer, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { farmsTable } from "./farms";
import { investmentsTable } from "./investments";
import { marketListingsTable } from "./market_listings";
import { usersTable } from "./users";

export const solanaInvestmentIntentsTable = pgTable("solana_investment_intents", {
  id: text("id").primaryKey(),
  investorId: integer("investor_id").references(() => usersTable.id).notNull(),
  farmId: integer("farm_id").references(() => farmsTable.id).notNull(),
  listingId: integer("listing_id").references(() => marketListingsTable.id).notNull(),
  investmentId: integer("investment_id").references(() => investmentsTable.id),
  walletAddress: text("wallet_address").notNull(),
  memo: text("memo").notNull().unique(),
  quantity: integer("quantity").notNull(),
  exitType: text("exit_type").notNull(),
  pricePerShareKes: numeric("price_per_share_kes", { precision: 15, scale: 2 }).notNull(),
  principalKes: numeric("principal_kes", { precision: 15, scale: 2 }).notNull(),
  feeKes: numeric("fee_kes", { precision: 15, scale: 2 }).notNull(),
  totalKes: numeric("total_kes", { precision: 15, scale: 2 }).notNull(),
  kesPerUsdc: numeric("kes_per_usdc", { precision: 15, scale: 6 }).notNull(),
  amountUsdc: numeric("amount_usdc", { precision: 20, scale: 6 }).notNull(),
  amountUsdcRaw: text("amount_usdc_raw").notNull(),
  status: text("status").default("pending").notNull(),
  transactionSignature: text("transaction_signature").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  settledAt: timestamp("settled_at"),
});

export type SolanaInvestmentIntent = typeof solanaInvestmentIntentsTable.$inferSelect;
