import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const portfoliosTable = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  managerInvestorId: integer("manager_investor_id").references(() => usersTable.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  strategy: text("strategy").notNull(),
  targetRisk: integer("target_risk").notNull(),
  managementFeePercent: numeric("management_fee_percent", { precision: 5, scale: 2 }).default("0").notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  followerCount: integer("follower_count").default(0).notNull(),
  totalAum: numeric("total_aum", { precision: 18, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastRebalancedAt: timestamp("last_rebalanced_at"),
});

export type Portfolio = typeof portfoliosTable.$inferSelect;
export type NewPortfolio = typeof portfoliosTable.$inferInsert;
