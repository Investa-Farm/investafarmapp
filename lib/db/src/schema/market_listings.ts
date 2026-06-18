import { pgTable, serial, text, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";
import { usersTable } from "./users";

export const listingTypeEnum = pgEnum("listing_type", ["primary", "secondary"]);

export const marketListingsTable = pgTable("market_listings", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").references(() => farmsTable.id).notNull(),
  sellerId: integer("seller_id").references(() => usersTable.id),
  investmentId: integer("investment_id"),
  listingType: listingTypeEnum("listing_type").notNull(),
  sharesAvailable: integer("shares_available").notNull(),
  pricePerShare: numeric("price_per_share", { precision: 15, scale: 2 }).notNull(),
  isActive: integer("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMarketListingSchema = createInsertSchema(marketListingsTable).omit({ id: true, createdAt: true });
export type InsertMarketListing = z.infer<typeof insertMarketListingSchema>;
export type MarketListing = typeof marketListingsTable.$inferSelect;
