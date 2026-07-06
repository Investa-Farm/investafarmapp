import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { farmsTable } from "./farms";

export const platformRevenueTable = pgTable("platform_revenue", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  farmId: integer("farm_id").references(() => farmsTable.id),
  relatedUserId: integer("related_user_id").references(() => usersTable.id),
  reference: text("reference"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PlatformRevenue = typeof platformRevenueTable.$inferSelect;
export type NewPlatformRevenue = typeof platformRevenueTable.$inferInsert;
