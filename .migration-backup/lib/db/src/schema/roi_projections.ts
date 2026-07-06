import { pgTable, serial, integer, decimal, text, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { investmentsTable } from "./investments";

export const roiProjectionsTable = pgTable(
  "roi_projections",
  {
    id:                    serial("id").primaryKey(),
    investmentId:          integer("investment_id").notNull().references(() => investmentsTable.id, { onDelete: "cascade" }),
    snapshotDate:          date("snapshot_date").notNull(),
    fullSeasonRoi:         decimal("full_season_roi", { precision: 10, scale: 4 }),
    fullSeasonAnnualized:  decimal("full_season_annualized", { precision: 10, scale: 4 }),
    fullSeasonPayout:      decimal("full_season_payout", { precision: 18, scale: 2 }),
    midSeasonRoi:          decimal("mid_season_roi", { precision: 10, scale: 4 }),
    midSeasonAnnualized:   decimal("mid_season_annualized", { precision: 10, scale: 4 }),
    midSeasonPSell:        decimal("mid_season_p_sell", { precision: 18, scale: 2 }),
    rainfallFactor:        decimal("rainfall_factor", { precision: 6, scale: 4 }),
    recommendation:        text("recommendation"),
    createdAt:             timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("roi_proj_inv_date_uidx").on(t.investmentId, t.snapshotDate)]
);
