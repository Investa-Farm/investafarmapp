import { pgTable, serial, integer, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const cooperativeMembersTable = pgTable("cooperative_members", {
  id: serial("id").primaryKey(),
  cooperativeId: integer("cooperative_id").references(() => usersTable.id).notNull(),
  farmerId: integer("farmer_id").references(() => usersTable.id).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [unique().on(t.cooperativeId, t.farmerId)]);

export type CooperativeMember = typeof cooperativeMembersTable.$inferSelect;
