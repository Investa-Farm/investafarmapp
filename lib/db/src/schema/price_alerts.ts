import { pgTable, serial, integer, numeric, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { farmsTable } from "./farms";

export const priceAlertsTable = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  farmId: integer("farm_id").notNull().references(() => farmsTable.id),
  targetPrice: numeric("target_price", { precision: 14, scale: 2 }).notNull(),
  direction: text("direction").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PriceAlert = typeof priceAlertsTable.$inferSelect;
