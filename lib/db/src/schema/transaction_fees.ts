import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { farmsTable } from "./farms";

export const transactionFeesTable = pgTable("transaction_fees", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id").references(() => usersTable.id).notNull(),
  farmId: integer("farm_id").references(() => farmsTable.id),
  feeType: text("fee_type").notNull(), // primary_purchase | secondary_trade | withdrawal | commitment_penalty
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").default("KES").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TransactionFee = typeof transactionFeesTable.$inferSelect;
