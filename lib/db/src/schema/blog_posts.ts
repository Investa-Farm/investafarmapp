import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(), // stored as HTML
  category: text("category").notNull(),
  authorName: text("author_name").notNull().default("Investa Farm Editorial"),
  authorRole: text("author_role").notNull().default("Editorial Team"),
  imageUrl: text("image_url"),
  readTimeMinutes: integer("read_time_minutes").notNull().default(5),
  featured: boolean("featured").default(false).notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BlogPost = typeof blogPostsTable.$inferSelect;
export type InsertBlogPost = typeof blogPostsTable.$inferInsert;
