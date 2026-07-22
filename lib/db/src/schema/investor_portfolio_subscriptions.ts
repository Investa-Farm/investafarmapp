import { pgTable, serial, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { portfoliosTable } from "./portfolios";

export const investorPortfolioSubscriptionsTable = pgTable("investor_portfolio_subscriptions", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id").references(() => usersTable.id).notNull(),
  portfolioId: integer("portfolio_id").references(() => portfoliosTable.id).notNull(),
  autoRebalanceEnabled: boolean("auto_rebalance_enabled").default(false).notNull(),
  investedAmount: numeric("invested_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
});

export type InvestorPortfolioSubscription = typeof investorPortfolioSubscriptionsTable.$inferSelect;
