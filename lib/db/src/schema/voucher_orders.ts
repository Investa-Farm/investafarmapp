import { pgTable, serial, integer, numeric, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const voucherOrdersTable = pgTable("voucher_orders", {
  id: serial("id").primaryKey(),
  agribusinessId: integer("agribusiness_id").references(() => usersTable.id).notNull(),
  farmerId: integer("farmer_id").references(() => usersTable.id).notNull(),
  voucherCode: varchar("voucher_code", { length: 100 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  items: text("items").notNull().default("[]"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  farmerPhone: varchar("farmer_phone", { length: 30 }),
  farmerLocation: varchar("farmer_location", { length: 200 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type VoucherOrder = typeof voucherOrdersTable.$inferSelect;
