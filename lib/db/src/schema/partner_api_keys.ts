import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const partnerApiKeysTable = pgTable("partner_api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  keyValue: text("key_value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PartnerApiKey = typeof partnerApiKeysTable.$inferSelect;
