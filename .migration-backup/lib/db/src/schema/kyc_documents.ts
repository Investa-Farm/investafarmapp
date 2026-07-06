import { pgTable, serial, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const kycStatusEnum = pgEnum("kyc_status", ["pending", "approved", "rejected"]);
export const kycDocTypeEnum = pgEnum("kyc_doc_type", [
  "farm_report",
  "national_id",
  "national_id_back",
  "selfie",
  "land_title",
  "group_certificate",
  "financial_statement",
  "business_registration",
  "other",
]);

export const kycDocumentsTable = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  groupId: integer("group_id"),
  docType: kycDocTypeEnum("doc_type").notNull(),
  title: text("title").notNull(),
  fileUrl: text("file_url").notNull(),
  notes: text("notes"),
  status: kycStatusEnum("status").default("pending").notNull(),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type KycDocument = typeof kycDocumentsTable.$inferSelect;
