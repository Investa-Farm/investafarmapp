import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const stellarAccountsTable = pgTable("stellar_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id),
  accountNumber: text("account_number").notNull().unique(), // e.g. IFV-2847-3921 (shown to user)
  publicKey: text("public_key").notNull().unique(),        // Stellar G... (hidden from user)
  encryptedSecret: text("encrypted_secret").notNull(),     // AES-encrypted secret key
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StellarAccount = typeof stellarAccountsTable.$inferSelect;
