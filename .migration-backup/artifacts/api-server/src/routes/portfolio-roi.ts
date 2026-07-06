import { Router } from "express";
import { db, farmsTable, investmentsTable, marketListingsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { computeROI, type HoldingROIInput } from "../lib/roi";
import { getRainfallData, getKenyaCoords } from "../lib/rainfall";
import { getCurrentUser } from "./auth";

const router = Router();

/**
 * GET /api/portfolio/roi
 * Returns full-season + mid-season ROI projections for each of the
 * authenticated investor's active holdings (rainfall-adjusted).
 */
router.get("/portfolio/roi", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const investments = await db.select().from(investmentsTable)
    .where(and(eq(investmentsTable.investorId, user.id), eq(investmentsTable.status, "active")));

  if (investments.length === 0) { res.json([]); return; }

  const farmIds  = [...new Set(investments.map(i => i.farmId))];
  const farms    = await db.select().from(farmsTable).where(inArray(farmsTable.id, farmIds));
  const listings = await db.select().from(marketListingsTable)
    .where(and(inArray(marketListingsTable.farmId, farmIds), eq(marketListingsTable.listingType, "primary")));

  const farmMap    = new Map(farms.map(f => [f.id, f]));
  const listingMap = new Map(listings.map(l => [l.farmId, l]));

  const results = await Promise.all(investments.map(async (inv) => {
    const farm    = farmMap.get(inv.farmId);
    const listing = listingMap.get(inv.farmId);
    if (!farm) return null;

    const N         = farm.totalShares;
    const soldShares = Math.max(0, N - (listing?.sharesAvailable ?? N));
    const sellSide   = listing?.sharesAvailable ?? 0;
    const imbalance  = 1 + 0.20 * ((soldShares - sellSide) / Math.max(N, 1));

    let rainfallFactor = 1.0;
    let rainfallData: Awaited<ReturnType<typeof getRainfallData>> | null = null;
    try {
      const [lat, lng] = getKenyaCoords(farm.location ?? "");
      rainfallData = await getRainfallData(lat, lng, farm.cropType ?? "maize");
      rainfallFactor = rainfallData.rainfallFactor;
    } catch { /* use default 1.0 */ }

    const input: HoldingROIInput = {
      farmId:          farm.id,
      farmName:        farm.name ?? "",
      cropType:        farm.cropType ?? "maize",
      totalShares:     farm.totalShares,
      sharesAvailable: listing?.sharesAvailable ?? farm.sharesAvailable,
      loanAmount:      Number(farm.loanAmount),
      sharePrice:      Number(farm.sharePrice),
      currentPrice:    Number((farm as any).currentPrice ?? farm.sharePrice),
      purchasePrice:   Number(inv.purchasePrice),
      quantity:        Number(inv.quantity),
      farmCreatedAt:   new Date(farm.createdAt),
      rainfallFactor,
      marketImbalance: imbalance,
    };

    const projection = computeROI(input);
    return {
      investmentId: inv.id,
      ...projection,
      rainfall: rainfallData
        ? {
            seasonalTotalMm: rainfallData.seasonalTotalMm,
            riskLevel:       rainfallData.riskLevel,
            riskLabel:       rainfallData.riskLabel,
            riskColor:       rainfallData.riskColor,
            yieldAdjustmentPercent: rainfallData.yieldAdjustmentPercent,
            floodRisk:       rainfallData.floodRisk,
            criticalDrought: rainfallData.criticalDrought,
          }
        : null,
    };
  }));

  res.json(results.filter(Boolean));
});

export default router;
