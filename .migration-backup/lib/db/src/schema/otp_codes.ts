import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const otpCodesTable = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  code: text("code").notNull(),
  purpose: text("purpose").notNull().default("email_verify"),
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OtpCode = typeof otpCodesTable.$inferSelect;
