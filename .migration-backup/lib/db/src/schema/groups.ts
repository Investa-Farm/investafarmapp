import { pgTable, serial, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const groupStatusEnum = pgEnum("group_status", ["pending", "verified", "rejected"]);

export const farmerGroupsTable = pgTable("farmer_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  registrationNumber: text("registration_number").notNull().unique(),
  location: text("location").notNull(),
  county: text("county").notNull(),
  memberCount: integer("member_count").default(1).notNull(),
  leaderId: integer("leader_id").references(() => usersTable.id).notNull(),
  status: groupStatusEnum("status").default("pending").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FarmerGroup = typeof farmerGroupsTable.$inferSelect;
