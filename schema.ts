import { pgTable, pgEnum, serial, integer, text, numeric, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// ---------------------------------------------------------------------------
// FIX: `status` was a free-text column, meaning a typo like "complete"
// instead of "completed" would silently corrupt transaction state with no
// error. A Postgres enum makes invalid states impossible at the DB layer.
// ---------------------------------------------------------------------------
export const walletTransactionStatusEnum = pgEnum("wallet_transaction_status", [
  "pending",
  "completed",
  "failed",
]);

// ---------------------------------------------------------------------------
// FIX: `type` had the same free-text problem as `status`. Enumerating the
// known transaction types prevents typos and documents the valid set.
// ---------------------------------------------------------------------------
export const walletTransactionTypeEnum = pgEnum("wallet_transaction_type", [
  "deposit",
  "withdrawal",
  "b2b_transfer",
]);

export const walletTransactionsTable = pgTable(
  "wallet_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    type: walletTransactionTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    mpesaReceiptNumber: varchar("mpesa_ref", { length: 100 }).unique(),
    conversationId: varchar("conversation_id", { length: 100 }),
    status: walletTransactionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // FIX: every callback handler filters on conversationId with no index
    // backing it, which forces a sequential scan on every M-Pesa webhook as
    // the table grows. This is the hottest lookup path in the whole system.
    conversationIdIdx: index("wallet_transactions_conversation_id_idx").on(table.conversationId),
  })
);
