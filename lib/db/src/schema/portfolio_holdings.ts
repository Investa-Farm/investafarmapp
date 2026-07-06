import { pgTable, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { portfoliosTable } from "./portfolios";
import { farmsTable } from "./farms";

export const portfolioHoldingsTable = pgTable("portfolio_holdings", {
  id: serial("id").primaryKey(),
  portfolioId: integer("portfolio_id").references(() => portfoliosTable.id).notNull(),
  farmId: integer("farm_id").references(() => farmsTable.id).notNull(),
  weightPercent: numeric("weight_percent", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PortfolioHolding = typeof portfolioHoldingsTable.$inferSelect;
