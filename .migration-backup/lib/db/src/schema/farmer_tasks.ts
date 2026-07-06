import { pgTable, serial, integer, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const farmerTasksTable = pgTable("farmer_tasks", {
  id: serial("id").primaryKey(),
  farmerId: integer("farmer_id").references(() => usersTable.id).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  notes: text("notes").notNull().default(""),
  category: varchar("category", { length: 50 }).notNull().default("General"),
  icon: varchar("icon", { length: 20 }).notNull().default("📋"),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FarmerTask = typeof farmerTasksTable.$inferSelect;
