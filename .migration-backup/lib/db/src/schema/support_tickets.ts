import { pgTable, serial, integer, text, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "resolved", "closed"]);
export const ticketCategoryEnum = pgEnum("ticket_category", ["payment", "kyc", "investment", "withdrawal", "technical", "other"]);

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  category: ticketCategoryEnum("category").notNull().default("other"),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  mpesaRef: varchar("mpesa_ref", { length: 100 }),
  amountClaimed: varchar("amount_claimed", { length: 50 }),
  paymentMethod: varchar("payment_method", { length: 50 }),
  status: ticketStatusEnum("status").notNull().default("open"),
  adminReply: text("admin_reply"),
  adminRepliedAt: timestamp("admin_replied_at"),
  walletCredited: integer("wallet_credited").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
