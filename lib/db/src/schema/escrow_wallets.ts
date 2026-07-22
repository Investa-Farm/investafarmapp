import { pgTable, serial, integer, numeric, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const escrowStatusEnum = pgEnum("escrow_status", ["held", "released", "refunded"]);

export const escrowWalletsTable = pgTable("escrow_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  investmentId: integer("investment_id"),
  farmId: integer("farm_id"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  status: escrowStatusEnum("status").notNull().default("held"),
  description: text("description"),
  releaseAt: timestamp("release_at"),
  releasedAt: timestamp("released_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type EscrowWallet = typeof escrowWalletsTable.$inferSelect;
