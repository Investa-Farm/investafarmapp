import { Router } from "express";
import { db, farmsTable, investmentsTable, marketListingsTable, sentimentScoresTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { computeROI, type HoldingROIInput } from "../lib/roi";
import { getRainfallData, getKenyaCoords } from "../lib/rainfall";
import { getCurrentUser } from "./auth";

const router = Router();

/**
 * GET /api/portfolio/roi
 *
 * Returns full-season + mid-season ROI projections for each of the
 * authenticated investor's active holdings.
 *
 * Each projection integrates:
 *   • Rainfall factor  — live weather data (drought/excess-rain cascade)
 *   • Sentiment factor — latest news-AI score for the crop type/region
 *   • Order-book imbalance — buy vs sell pressure in the primary listing
 *
 * The self-consistent D̂ formula guarantees positive baseline ROI and makes
 * the secondary-market P_sell start near P₀ on day 1 and converge upward.
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

  // ── Bulk-load latest news/AI sentiment scores ──────────────────────────────
  // sentimentFactor = 1 + 0.03 × ((positivePct − negativePct) / 100)
  // Neutral (no data) → 1.0
  const sentimentRows = await db
    .select()
    .from(sentimentScoresTable)
    .orderBy(desc(sentimentScoresTable.createdAt))
    .catch(() => []);

  const sentimentMap = new Map<string, number>(); // cropType → factor
  for (const row of sentimentRows) {
    if (sentimentMap.has(row.cropType)) continue; // keep latest per crop
    const pos    = Number(row.positivePct ?? 50);
    const neg    = Number(row.negativePct ?? 50);
    const factor = 1 + 0.03 * ((pos - neg) / 100);
    sentimentMap.set(row.cropType, Math.max(0.80, Math.min(1.20, factor)));
  }

  const farmMap    = new Map(farms.map(f => [f.id, f]));
  const listingMap = new Map(listings.map(l => [l.farmId, l]));

  const results = await Promise.all(investments.map(async (inv) => {
    const farm    = farmMap.get(inv.farmId);
    const listing = listingMap.get(inv.farmId);
    if (!farm) return null;

    const N          = farm.totalShares;
    const soldShares = Math.max(0, N - (listing?.sharesAvailable ?? N));
    const sellSide   = listing?.sharesAvailable ?? 0;
    const imbalance  = 1 + 0.20 * ((soldShares - sellSide) / Math.max(N, 1));

    // ── Rainfall factor ──────────────────────────────────────────────────────
    let rainfallFactor = 1.0;
    let rainfallData: Awaited<ReturnType<typeof getRainfallData>> | null = null;
    try {
      const [lat, lng] = getKenyaCoords(farm.location ?? "");
      rainfallData   = await getRainfallData(lat, lng, farm.cropType ?? "maize");
      rainfallFactor = rainfallData.rainfallFactor;
    } catch { /* use default 1.0 */ }

    // ── Sentiment factor ─────────────────────────────────────────────────────
    const cropKey       = (farm.cropType ?? "maize").toLowerCase().trim();
    const sentimentFactor = sentimentMap.get(cropKey) ?? 1.0;

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
      sentimentFactor,
    };

    const projection = computeROI(input);
    return {
      investmentId: inv.id,
      ...projection,
      rainfall: rainfallData
        ? {
            seasonalTotalMm:        rainfallData.seasonalTotalMm,
            riskLevel:              rainfallData.riskLevel,
            riskLabel:              rainfallData.riskLabel,
            riskColor:              rainfallData.riskColor,
            yieldAdjustmentPercent: rainfallData.yieldAdjustmentPercent,
            floodRisk:              rainfallData.floodRisk,
            criticalDrought:        rainfallData.criticalDrought,
          }
        : null,
      sentiment: {
        factor: sentimentFactor,
        hasData: sentimentMap.has(cropKey),
      },
    };
  }));

  res.json(results.filter(Boolean));
});

export default router;
