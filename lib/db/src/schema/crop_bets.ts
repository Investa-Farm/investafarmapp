import { pgTable, serial, integer, numeric, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { farmsTable } from "./farms";

export const cropBetsTable = pgTable("crop_bets", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").references(() => usersTable.id).notNull(),
  farmId: integer("farm_id").references(() => farmsTable.id).notNull(),
  question: text("question").notNull(),
  description: text("description"),
  targetMetric: varchar("target_metric", { length: 50 }).notNull().default("roi"),
  targetValue: numeric("target_value", { precision: 10, scale: 2 }).notNull(),
  totalPoolKES: numeric("total_pool_kes", { precision: 15, scale: 2 }).notNull().default("0"),
  yesPoolKES: numeric("yes_pool_kes", { precision: 15, scale: 2 }).notNull().default("0"),
  noPoolKES: numeric("no_pool_kes", { precision: 15, scale: 2 }).notNull().default("0"),
  minStakeKES: numeric("min_stake_kes", { precision: 10, scale: 2 }).notNull().default("1000"),
  maxStakeKES: numeric("max_stake_kes", { precision: 10, scale: 2 }).notNull().default("100000"),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  outcome: boolean("outcome"),
  resolvedAt: timestamp("resolved_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const betStakesTable = pgTable("bet_stakes", {
  id: serial("id").primaryKey(),
  betId: integer("bet_id").references(() => cropBetsTable.id).notNull(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  amountKES: numeric("amount_kes", { precision: 15, scale: 2 }).notNull(),
  position: varchar("position", { length: 5 }).notNull(),
  payout: numeric("payout", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CropBet = typeof cropBetsTable.$inferSelect;
export type BetStake = typeof betStakesTable.$inferSelect;
