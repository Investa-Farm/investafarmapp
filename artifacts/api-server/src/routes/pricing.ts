/**
 * Primary Pricing Engine API
 *
 * POST /farm/price          — compute AI primary pricing for a proposed listing
 * GET  /farm/price/:farmId  — re-evaluate pricing for an existing farm
 * POST /farm/stress-test    — run stress-test scenarios on a farm
 * GET  /platform/metrics    — platform-level KPIs (TVL, run rate, efficiency)
 * GET  /portfolio/metrics   — investor portfolio summary (ROI, VaR, drawdown)
 */

import { Router } from "express";
import { z } from "zod";
import { db, farmsTable, investmentsTable, marketListingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { computePrimaryPricing, computePrimaryPricingV2, runStressTest, type StressScenario } from "../lib/primary-pricing";
import { computePlatformMetrics, computeLiquidityRatio, computePortfolioSummary, computeHoldingROI, annualizeReturn } from "../lib/metrics";
import { getRainfallData, getKenyaCoords } from "../lib/rainfall";
import { getCurrentUser } from "./auth";

const router = Router();

// ─── Input Validation ─────────────────────────────────────────────────────────
const FarmPriceBody = z.object({
  capitalNeededKes:      z.number().positive(),
  crop:                  z.string().min(2),
  landSizeHa:            z.number().positive(),
  plantingDate:          z.string().datetime().optional(),
  harvestDate:           z.string().datetime().optional(),
  farmerExperienceYears: z.number().min(0).max(50).default(3),
  ndviHistory:           z.array(z.number().min(0).max(1)).optional(),
  weatherRisk:           z.number().min(0).max(1).optional(),
  ndviVolatility:        z.number().min(0).max(1).optional(),
  rainfallMm:            z.number().min(0).optional(),
  desiredFarmerShare:    z.number().min(0.45).max(0.65).optional(),
  location:              z.string().optional(),
  farmerHarvestCount:    z.number().int().min(0).optional(),
  hasConfirmedOfftake:   z.boolean().optional(),
});

const StressTestBody = z.object({
  farmId:   z.number().int().positive().optional(),
  scenario: z.enum(["drought", "price_crash", "pest_outbreak"]),
  // OR provide inline pricing result fields
  capitalNeededKes:      z.number().positive().optional(),
  crop:                  z.string().min(2).optional(),
  landSizeHa:            z.number().positive().optional(),
  farmerExperienceYears: z.number().min(0).max(50).optional(),
  location:              z.string().optional(),
});

// ─── POST /farm/price ─────────────────────────────────────────────────────────
router.post("/farm/price", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = FarmPriceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;

  // Fetch live rainfall if location provided and rainfallMm not given
  let rainfallMm = data.rainfallMm;
  if (rainfallMm === undefined && data.location) {
    try {
      const [lat, lng] = getKenyaCoords(data.location);
      const rainfall = await getRainfallData(lat, lng, data.crop);
      rainfallMm = rainfall.seasonalTotalMm + rainfall.forecastTotalMm * 0.5;
    } catch { /* proceed without */ }
  }

  const result = await computePrimaryPricingV2({
    capitalNeededKes:      data.capitalNeededKes,
    crop:                  data.crop,
    landSizeHa:            data.landSizeHa,
    plantingDate:          data.plantingDate ? new Date(data.plantingDate) : new Date(),
    harvestDate:           data.harvestDate  ? new Date(data.harvestDate)  : undefined,
    farmerExperienceYears: data.farmerExperienceYears,
    ndviHistory:           data.ndviHistory,
    weatherRisk:           data.weatherRisk,
    ndviVolatility:        data.ndviVolatility,
    rainfallMm,
    desiredFarmerShare:    data.desiredFarmerShare,
    location:              data.location,
    farmerHarvestCount:    data.farmerHarvestCount,
    hasConfirmedOfftake:   data.hasConfirmedOfftake,
  });

  res.json(result);
});

// ─── GET /farm/price/:farmId ──────────────────────────────────────────────────
router.get("/farm/price/:farmId", async (req, res): Promise<void> => {
  const farmId = parseInt(req.params.farmId ?? "", 10);
  if (isNaN(farmId)) { res.status(400).json({ error: "Invalid farmId" }); return; }

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId));
  if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

  // Fetch rainfall
  let rainfallMm: number | undefined;
  try {
    const [lat, lng] = getKenyaCoords(farm.location ?? "");
    const rainfall = await getRainfallData(lat, lng, farm.cropType ?? "maize");
    rainfallMm = rainfall.seasonalTotalMm + rainfall.forecastTotalMm * 0.5;
  } catch { /* proceed without */ }

  const farmerHarvestCount = (await db.select().from(farmsTable)
    .where(and(eq(farmsTable.farmerId, farm.farmerId), eq(farmsTable.status, "harvested")))).length;

  const result = await computePrimaryPricingV2({
    capitalNeededKes:      Number(farm.loanAmount),
    crop:                  farm.cropType ?? "maize",
    landSizeHa:            Number((farm as any).landSizeHa ?? 1),
    plantingDate:          new Date(farm.createdAt),
    farmerExperienceYears: Number((farm as any).farmerExperienceYears ?? 3),
    rainfallMm,
    location:              farm.location ?? undefined,
    farmerHarvestCount,
  });

  // Also include live liquidity ratio
  const liquidity = await computeLiquidityRatio(farmId);

  res.json({ ...result, liquidity, farmId, farmName: farm.name });
});

// ─── POST /farm/stress-test ───────────────────────────────────────────────────
router.post("/farm/stress-test", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = StressTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const { scenario, farmId } = parsed.data;

  // Get base pricing — from DB farm or inline input
  let basePricing;

  if (farmId) {
    const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId));
    if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

    let rainfallMm: number | undefined;
    try {
      const [lat, lng] = getKenyaCoords(farm.location ?? "");
      const r = await getRainfallData(lat, lng, farm.cropType ?? "maize");
      rainfallMm = r.seasonalTotalMm;
    } catch { /* skip */ }

    basePricing = computePrimaryPricing({
      capitalNeededKes: Number(farm.loanAmount),
      crop: farm.cropType ?? "maize",
      landSizeHa: Number((farm as any).landSizeHa ?? 1),
      plantingDate: new Date(farm.createdAt),
      farmerExperienceYears: Number((farm as any).farmerExperienceYears ?? 3),
      rainfallMm,
      location: farm.location ?? undefined,
    });
  } else {
    const { capitalNeededKes, crop, landSizeHa, farmerExperienceYears, location } = parsed.data;
    if (!capitalNeededKes || !crop || !landSizeHa) {
      res.status(400).json({ error: "Provide farmId OR (capitalNeededKes, crop, landSizeHa)" });
      return;
    }
    basePricing = computePrimaryPricing({
      capitalNeededKes, crop, landSizeHa,
      plantingDate: new Date(),
      farmerExperienceYears: farmerExperienceYears ?? 3,
      location,
    });
  }

  if (basePricing.status !== "viable") {
    res.status(422).json({ error: "Cannot stress-test a non-viable farm", details: basePricing.reason });
    return;
  }

  const scenarios: StressScenario[] = ["drought", "price_crash", "pest_outbreak"];
  const results = scenario === "all" as unknown as StressScenario
    ? scenarios.map(s => runStressTest(basePricing!, s))
    : [runStressTest(basePricing, scenario)];

  res.json({ base: basePricing, stressTests: results });
});

// ─── GET /platform/metrics ────────────────────────────────────────────────────
router.get("/platform/metrics", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const metrics = await computePlatformMetrics();
  res.json(metrics);
});

// ─── GET /portfolio/metrics ───────────────────────────────────────────────────
// Extended portfolio summary with ROI, VaR, drawdown, Sharpe
router.get("/portfolio/metrics", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const investments = await db
    .select()
    .from(investmentsTable)
    .where(and(eq(investmentsTable.investorId, user.id), eq(investmentsTable.status, "active")));

  if (investments.length === 0) {
    res.json({
      totalCostBasis: 0, totalCurrentValue: 0,
      portfolioROI: 0, portfolioROIPercent: 0,
      weightedAnnualizedReturn: 0, maxDrawdown: 0,
      varFrac95: 0, holdingCount: 0,
      holdings: [],
    });
    return;
  }

  const farmIds = [...new Set(investments.map(i => i.farmId))];
  const farms   = await db.select().from(farmsTable);
  const farmMap = new Map(farms.map(f => [f.id, f]));

  const CROP_RISK_S: Record<string, number> = {
    maize: 8, beans: 8, cassava: 8, rice: 7, wheat: 7, sunflower: 7, sorghum: 7,
    tea: 7, potatoes: 6, onions: 6, tomatoes: 5, horticulture: 5,
    avocado: 4, coffee: 3, tobacco: 2,
  };

  const holdingsInput = investments.map(inv => {
    const farm = farmMap.get(inv.farmId);
    const currentPrice = Number((farm as any)?.currentPrice ?? inv.purchasePrice);
    const purchasePrice = Number(inv.purchasePrice);
    const cropKey = (farm?.cropType ?? "maize").toLowerCase();
    const riskScore = CROP_RISK_S[cropKey] ?? 5;
    const daysHeld = Math.max(1, (Date.now() - new Date(inv.createdAt ?? Date.now()).getTime()) / 86_400_000);

    return {
      quantity: Number(inv.quantity),
      purchasePrice,
      currentPrice,
      riskScore,
      daysHeld: Math.round(daysHeld),
    };
  });

  const summary = computePortfolioSummary(holdingsInput);

  // Per-holding breakdown
  const holdingDetails = investments.map((inv, i) => {
    const h = holdingsInput[i]!;
    const { costBasis, currentValue, roi, roiPercent } = computeHoldingROI(h.quantity, h.purchasePrice, h.currentPrice);
    const farm = farmMap.get(inv.farmId);
    return {
      investmentId: inv.id,
      farmId: inv.farmId,
      farmName: farm?.name ?? "Unknown",
      cropType: farm?.cropType ?? "unknown",
      quantity: h.quantity,
      purchasePrice: h.purchasePrice,
      currentPrice: h.currentPrice,
      costBasis,
      currentValue,
      roi,
      roiPercent,
      annualizedReturn: Math.round(annualizeReturn(roi, h.daysHeld) * 10000) / 100,
      daysHeld: h.daysHeld,
      riskScore: h.riskScore,
    };
  });

  res.json({ ...summary, holdings: holdingDetails });
});

// ─── GET /farm/:farmId/liquidity ──────────────────────────────────────────────
router.get("/farm/:farmId/liquidity", async (req, res): Promise<void> => {
  const farmId = parseInt(req.params.farmId ?? "", 10);
  if (isNaN(farmId)) { res.status(400).json({ error: "Invalid farmId" }); return; }
  const liquidity = await computeLiquidityRatio(farmId);
  res.json(liquidity);
});

export default router;
