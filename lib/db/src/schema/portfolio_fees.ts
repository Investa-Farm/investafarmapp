import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { portfoliosTable } from "./portfolios";
import { usersTable } from "./users";

export const portfolioFeesTable = pgTable("portfolio_fees", {
  id: serial("id").primaryKey(),
  portfolioId: integer("portfolio_id").references(() => portfoliosTable.id).notNull(),
  managerId: integer("manager_id").references(() => usersTable.id).notNull(),
  followerId: integer("follower_id").references(() => usersTable.id).notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  type: text("type").notNull(),
  currency: text("currency").default("KES").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PortfolioFee = typeof portfolioFeesTable.$inferSelect;
