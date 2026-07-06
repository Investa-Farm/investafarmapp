import { pgTable, serial, integer, numeric, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const syndicatesTable = pgTable("syndicates", {
  id: serial("id").primaryKey(),
  leaderId: integer("leader_id").references(() => usersTable.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location").notNull(),
  county: varchar("county", { length: 100 }).notNull(),
  cropFocus: text("crop_focus").notNull(),
  memberCount: integer("member_count").notNull().default(1),
  minMembers: integer("min_members").notNull().default(5),
  maxMembers: integer("max_members").notNull().default(20),
  fundingGoalKES: numeric("funding_goal_kes", { precision: 15, scale: 2 }).notNull(),
  raisedKES: numeric("raised_kes", { precision: 15, scale: 2 }).notNull().default("0"),
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }).default("4"),
  isOpen: boolean("is_open").notNull().default(true),
  status: varchar("status", { length: 20 }).notNull().default("forming"),
  imageUrl: text("image_url"),
  agroDealer: text("agro_dealer"),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const syndicateMembersTable = pgTable("syndicate_members", {
  id: serial("id").primaryKey(),
  syndicateId: integer("syndicate_id").references(() => syndicatesTable.id).notNull(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  contribution: numeric("contribution", { precision: 15, scale: 2 }).default("0"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const syndicateInvestmentsTable = pgTable("syndicate_investments", {
  id: serial("id").primaryKey(),
  syndicateId: integer("syndicate_id").references(() => syndicatesTable.id).notNull(),
  investorId: integer("investor_id").references(() => usersTable.id).notNull(),
  amountKES: numeric("amount_kes", { precision: 15, scale: 2 }).notNull(),
  sharesEquivalent: integer("shares_equivalent").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Syndicate = typeof syndicatesTable.$inferSelect;
export type SyndicateMember = typeof syndicateMembersTable.$inferSelect;
export type SyndicateInvestment = typeof syndicateInvestmentsTable.$inferSelect;
