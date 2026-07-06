import { pgTable, serial, integer, text, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const adminMessagesTable = pgTable("admin_messages", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id"),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 255 }).notNull(),
  message: text("message").notNull(),
  reply: text("reply"),
  repliedAt: timestamp("replied_at"),
  isReadByUser: boolean("is_read_by_user").default(false).notNull(),
  isReadByAdmin: boolean("is_read_by_admin").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
