import { pgTable, serial, text, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
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
});

export type LoanApplication = typeof loanApplicationsTable.$inferSelect;
