import { pgTable, serial, text, timestamp, pgEnum, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["farmer", "investor", "cooperative", "agribusiness", "admin", "viewer"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  accountNumber: text("account_number").unique(),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").default(false).notNull(),
  phone: text("phone"),
  county: text("county"),
  creditLimitKES: numeric("credit_limit_kes", { precision: 15, scale: 2 }),
  maxDepositKES: numeric("max_deposit_kes", { precision: 15, scale: 2 }),
  maxWithdrawalKES: numeric("max_withdrawal_kes", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
