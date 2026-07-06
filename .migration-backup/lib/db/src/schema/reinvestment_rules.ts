import { pgTable, serial, integer, numeric, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const reinvestmentRulesTable = pgTable("reinvestment_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  enabled: boolean("enabled").notNull().default(false),
  reinvestPercent: numeric("reinvest_percent", { precision: 5, scale: 2 }).notNull().default("70"),
  walletPercent: numeric("wallet_percent", { precision: 5, scale: 2 }).notNull().default("30"),
  cropPreference: text("crop_preference").default("any"),
  minAmount: numeric("min_amount", { precision: 14, scale: 2 }).notNull().default("1000"),
  maxFarms: integer("max_farms").notNull().default(3),
  riskTolerance: text("risk_tolerance").notNull().default("moderate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ReinvestmentRule = typeof reinvestmentRulesTable.$inferSelect;
