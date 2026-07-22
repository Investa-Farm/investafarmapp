import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";

export const farmUpdatesTable = pgTable("farm_updates", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").references(() => farmsTable.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFarmUpdateSchema = createInsertSchema(farmUpdatesTable).omit({ id: true, createdAt: true });
export type InsertFarmUpdate = z.infer<typeof insertFarmUpdateSchema>;
export type FarmUpdate = typeof farmUpdatesTable.$inferSelect;
