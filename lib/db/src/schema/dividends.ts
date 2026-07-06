import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { farmsTable } from "./farms";
import { usersTable } from "./users";
import { investmentsTable } from "./investments";

export const dividendsTable = pgTable("dividends", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").references(() => farmsTable.id).notNull(),
  investorId: integer("investor_id").references(() => usersTable.id).notNull(),
  investmentId: integer("investment_id").references(() => investmentsTable.id).notNull(),
  shares: integer("shares").notNull(),
  harvestRevenue: numeric("harvest_revenue", { precision: 15, scale: 2 }).notNull(),
  alphaShare: numeric("alpha_share", { precision: 5, scale: 4 }).notNull().default("0.2"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  status: text("status").default("pending").notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Dividend = typeof dividendsTable.$inferSelect;
