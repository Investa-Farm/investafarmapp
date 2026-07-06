import { pgTable, serial, text, numeric, integer, date, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const sentimentScoresTable = pgTable("sentiment_scores", {
  id: serial("id").primaryKey(),
  cropType: text("crop_type").notNull(),
  region: text("region").default("Kenya"),
  score: numeric("score", { precision: 6, scale: 2 }).notNull(),
  positivePct: numeric("positive_pct", { precision: 5, scale: 2 }),
  negativePct: numeric("negative_pct", { precision: 5, scale: 2 }),
  neutralPct: numeric("neutral_pct", { precision: 5, scale: 2 }),
  volume: integer("volume").default(0),
  keyphrases: text("keyphrases").array(),
  source: text("source").default("combined"),
  snapshotDate: date("snapshot_date").notNull().default(sql`CURRENT_DATE`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
