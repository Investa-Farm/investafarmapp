import { pgTable, serial, integer, numeric, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { farmsTable } from "./farms";

export const orderBookTable = pgTable("order_book", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").notNull().references(() => farmsTable.id),
  investorId: integer("investor_id").notNull().references(() => usersTable.id),
  side: text("side").notNull(), // "buy" | "sell"
  limitPrice: numeric("limit_price", { precision: 14, scale: 2 }).notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  filledQuantity: numeric("filled_quantity", { precision: 14, scale: 4 }).default("0").notNull(),
  status: text("status").notNull().default("open"), // "open" | "partially_filled" | "filled" | "cancelled"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  filledAt: timestamp("filled_at"),
  cancelledAt: timestamp("cancelled_at"),
});

export type OrderBookEntry = typeof orderBookTable.$inferSelect;
export type NewOrderBookEntry = typeof orderBookTable.$inferInsert;
