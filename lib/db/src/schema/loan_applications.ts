import { pgTable, serial, text, timestamp, integer, numeric, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const loanStatusEnum = pgEnum("loan_status", ["draft", "submitted", "under_review", "approved", "rejected", "disbursed"]);
export const loanPurposeEnum = pgEnum("loan_purpose", ["seeds", "fertilizer", "equipment", "irrigation", "labour", "other"]);

export const loanApplicationsTable = pgTable("loan_applications", {
  id: serial("id").primaryKey(),
  farmerId: integer("farmer_id").references(() => usersTable.id).notNull(),
  groupId: integer("group_id"),
  farmId: integer("farm_id"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  purpose: loanPurposeEnum("purpose").notNull(),
  purposeDetails: text("purpose_details").notNull(),
  repaymentPeriodMonths: integer("repayment_period_months").notNull(),
  status: loanStatusEnum("status").default("draft").notNull(),
  reviewNotes: text("review_notes"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Enhanced proposal fields (nullable for backward compat)
  cropName: text("crop_name"),
  acreage: text("acreage"),
  farmLocation: text("farm_location"),
  harvestDate: text("harvest_date"),
  costBreakdown: jsonb("cost_breakdown"),       // { landPrep, seeds, fertilizer, pesticides, labour, equipment, irrigation, transport, postHarvest, insurance, contingency, total }
  expectedYieldKg: text("expected_yield_kg"),
  expectedPricePerKg: text("expected_price_per_kg"),
  expectedRevenue: numeric("expected_revenue", { precision: 15, scale: 2 }),
  farmerShare: numeric("farmer_share", { precision: 15, scale: 2 }),
  // Credit scoring, repayment tracking & status timeline
  aiScore: integer("ai_score"),
  interestRate: numeric("interest_rate", { precision: 5, scale: 3 }).default("1.080").notNull(),
  amountRepaid: numeric("amount_repaid", { precision: 15, scale: 2 }).default("0").notNull(),
  nextRepaymentDueAt: timestamp("next_repayment_due_at"),
  lastReminderAt: timestamp("last_reminder_at"),
  statusHistory: jsonb("status_history"), // [{ stage: "submitted"|"ai_scored"|"approved"|"rejected"|"listed"|"disbursed", at: ISOString, note?: string }]
});

export type LoanApplication = typeof loanApplicationsTable.$inferSelect;
