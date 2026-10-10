import { integer, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const stablecoinWalletsTable = pgTable(
  "stablecoin_wallets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    asset: text("asset").notNull().default("USDC"),
    network: text("network").notNull().default("polygon"),
    balance: numeric("balance", { precision: 20, scale: 6 }).notNull().default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("stablecoin_wallets_user_network_unique").on(table.userId, table.network)],
);

export const stablecoinTransactionsTable = pgTable(
  "stablecoin_transactions",
  {
    id: serial("id").primaryKey(),
    walletId: integer("wallet_id").notNull().references(() => stablecoinWalletsTable.id),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    asset: text("asset").notNull().default("USDC"),
    network: text("network").notNull(),
    type: text("type").notNull(),
    amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
    balanceAfter: numeric("balance_after", { precision: 20, scale: 6 }).notNull(),
    description: text("description"),
    reference: text("reference").notNull().unique(),
    externalTxHash: text("external_tx_hash").unique(),
    status: text("status").notNull().default("completed"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);

export const stablecoinDepositIntentsTable = pgTable("stablecoin_deposit_intents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  providerIntentId: text("provider_intent_id").notNull().unique(),
  expectedAmount: numeric("expected_amount", { precision: 20, scale: 6 }).notNull(),
  depositAddress: text("deposit_address").notNull(),
  network: text("network").notNull().default("polygon"),
  status: text("status").notNull().default("pending"),
  transactionHash: text("transaction_hash").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StablecoinWallet = typeof stablecoinWalletsTable.$inferSelect;
export type StablecoinTransaction = typeof stablecoinTransactionsTable.$inferSelect;
