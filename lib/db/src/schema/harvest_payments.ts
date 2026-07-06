import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { farmsTable } from "./farms";

export const harvestPaymentsTable = pgTable("harvest_payments", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").notNull().references(() => farmsTable.id),
  offtakerId: integer("offtaker_id").references(() => usersTable.id),
  offtakerName: text("offtaker_name"),
  totalRevenue: numeric("total_revenue", { precision: 15, scale: 2 }).notNull(),
  farmerShare: numeric("farmer_share", { precision: 15, scale: 2 }).notNull(),
  investorPoolShare: numeric("investor_pool_share", { precision: 15, scale: 2 }).notNull(),
  platformShare: numeric("platform_share", { precision: 15, scale: 2 }).notNull(),
  farmerPct: numeric("farmer_pct", { precision: 5, scale: 2 }).notNull().default("55"),
  investorPct: numeric("investor_pct", { precision: 5, scale: 2 }).notNull().default("20"),
  platformPct: numeric("platform_pct", { precision: 5, scale: 2 }).notNull().default("25"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  triggeredBy: integer("triggered_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type HarvestPayment = typeof harvestPaymentsTable.$inferSelect;
export type NewHarvestPayment = typeof harvestPaymentsTable.$inferInsert;
