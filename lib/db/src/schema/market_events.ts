import { pgTable, serial, text, timestamp, numeric } from "drizzle-orm/pg-core";

export const marketEventsTable = pgTable("market_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  eventType: text("event_type").notNull(), // weather | policy | market | trade | supply
  affectedCrops: text("affected_crops").array().notNull().default([]),
  affectedRegions: text("affected_regions").array().notNull().default([]),
  impactDirection: text("impact_direction").notNull(), // positive | negative | mixed
  impactMagnitude: numeric("impact_magnitude", { precision: 6, scale: 4 }).notNull().default("0.08"),
  severity: text("severity").notNull().default("moderate"), // low | moderate | high | critical
  scope: text("scope").notNull().default("regional"), // national | regional | county
  source: text("source").notNull().default("ai-monitor"),
  expiresAt: timestamp("expires_at"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
});

export type MarketEvent = typeof marketEventsTable.$inferSelect;
export type InsertMarketEvent = typeof marketEventsTable.$inferInsert;
