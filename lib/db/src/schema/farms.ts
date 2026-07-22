import { pgTable, serial, text, timestamp, integer, numeric, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const farmStatusEnum = pgEnum("farm_status", ["pending", "active", "funded", "harvested"]);

export const farmsTable = pgTable("farms", {
  id: serial("id").primaryKey(),
  farmerId: integer("farmer_id").references(() => usersTable.id).notNull(),
  name: text("name").notNull(),
  cropType: text("crop_type").notNull(),
  location: text("location").notNull(),
  loanAmount: numeric("loan_amount", { precision: 15, scale: 2 }).notNull(),
  totalShares: integer("total_shares").notNull(),
  sharePrice: numeric("share_price", { precision: 15, scale: 2 }).notNull(),
  sharesAvailable: integer("shares_available").notNull(),
  status: farmStatusEnum("status").default("active").notNull(),
  imageUrl: text("image_url"),
  description: text("description"),
  changePercent: numeric("change_percent", { precision: 8, scale: 4 }).default("0").notNull(),
  tradeCount: integer("trade_count").default(0).notNull(),
  currentPrice: numeric("current_price", { precision: 15, scale: 2 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 6 }),
  longitude: numeric("longitude", { precision: 10, scale: 6 }),
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }).default("5"),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  // ── Pricing engine v2 (explainability, confidence-interval forecast, governance) ──
  topFactors: jsonb("top_factors"),                    // RiskFactor[] — top contributors to riskScore
  riskScoreSource: text("risk_score_source"),           // "groq" | "fallback"
  revenueForecastLow: numeric("revenue_forecast_low", { precision: 15, scale: 2 }),
  revenueForecastHigh: numeric("revenue_forecast_high", { precision: 15, scale: 2 }),
  uncertaintyRatio: numeric("uncertainty_ratio", { precision: 6, scale: 4 }),
  coldStart: boolean("cold_start").default(false).notNull(),
  reviewFlagged: boolean("review_flagged").default(false).notNull(),
  reviewReasons: jsonb("review_reasons"),               // string[]
});

export const insertFarmSchema = createInsertSchema(farmsTable).omit({ id: true, createdAt: true });
export type InsertFarm = z.infer<typeof insertFarmSchema>;
export type Farm = typeof farmsTable.$inferSelect;
