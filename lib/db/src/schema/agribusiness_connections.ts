import { pgTable, serial, integer, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const agribusinessConnectionsTable = pgTable("agribusiness_connections", {
  id: serial("id").primaryKey(),
  agribusinessId: integer("agribusiness_id").references(() => usersTable.id).notNull(),
  farmerId: integer("farmer_id").references(() => usersTable.id).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
}, (t) => [unique().on(t.agribusinessId, t.farmerId)]);

export type AgribusinessConnection = typeof agribusinessConnectionsTable.$inferSelect;
