import { pgTable, serial, integer, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const agribizProductsTable = pgTable("agribiz_products", {
  id: serial("id").primaryKey(),
  agribusinessId: integer("agribusiness_id").references(() => usersTable.id).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 50 }).notNull().default("Other"),
  unit: varchar("unit", { length: 50 }).notNull().default("kg"),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AgribizProduct = typeof agribizProductsTable.$inferSelect;
export type NewAgribizProduct = typeof agribizProductsTable.$inferInsert;
