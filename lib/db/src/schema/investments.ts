import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";
import { usersTable } from "./users";

export const investmentsTable = pgTable("investments", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id").references(() => usersTable.id).notNull(),
  farmId: integer("farm_id").references(() => farmsTable.id).notNull(),
  quantity: integer("quantity").notNull(),
  purchasePrice: numeric("purchase_price", { precision: 15, scale: 2 }).notNull(),
  exitType: text("exit_type").notNull(),
  exitDate: timestamp("exit_date"),
  exitRequestedAt: timestamp("exit_requested_at"),
  exitStatus: text("exit_status").default("pending"),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInvestmentSchema = createInsertSchema(investmentsTable).omit({ id: true, createdAt: true });
export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type Investment = typeof investmentsTable.$inferSelect;
