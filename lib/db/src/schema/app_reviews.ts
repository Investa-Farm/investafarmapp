import { pgTable, serial, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const appReviewsTable = pgTable("app_reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  review: text("review"),
  context: varchar("context", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
