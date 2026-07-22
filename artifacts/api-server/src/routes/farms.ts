import { Router, type IRouter } from "express";
import { db, farmsTable, usersTable, marketListingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateFarmBody,
  UpdateFarmBody,
  GetFarmParams,
  UpdateFarmParams,
  ListFarmsQueryParams,
} from "@workspace/api-zod";
import { getCurrentUser } from "./auth";
import { computePrimaryPricingV2 } from "../lib/primary-pricing";

const router: IRouter = Router();

function farmToJson(farm: typeof farmsTable.$inferSelect, farmerName: string) {
  return {
    id: farm.id,
    farmerId: farm.farmerId,
    farmerName,
    name: farm.name,
    cropType: farm.cropType,
    location: farm.location,
    loanAmount: Number(farm.loanAmount),
    totalShares: farm.totalShares,
    sharePrice: Number(farm.sharePrice),
    sharesAvailable: farm.sharesAvailable,
    fundingPercent: Math.round(((farm.totalShares - farm.sharesAvailable) / farm.totalShares) * 100),
    status: farm.status,
    imageUrl: farm.imageUrl ?? undefined,
    changePercent: Number(farm.changePercent),
    tradeCount: farm.tradeCount,
    currentPrice: Number(farm.currentPrice),
    description: farm.description ?? undefined,
    createdAt: farm.createdAt.toISOString(),
    riskScore: farm.riskScore !== null ? Number(farm.riskScore) : undefined,
    riskScoreSource: (farm as any).riskScoreSource ?? undefined,
    topFactors: (farm as any).topFactors ?? undefined,
    revenueForecast: (farm as any).revenueForecastLow !== null && (farm as any).revenueForecastLow !== undefined ? {
      low: Number((farm as any).revenueForecastLow),
      high: Number((farm as any).revenueForecastHigh),
      uncertaintyRatio: Number((farm as any).uncertaintyRatio ?? 0),
    } : undefined,
    coldStart: (farm as any).coldStart ?? false,
    reviewFlagged: (farm as any).reviewFlagged ?? false,
    reviewReasons: (farm as any).reviewReasons ?? undefined,
  };
}

router.get("/farms", async (req, res): Promise<void> => {
  const params = ListFarmsQueryParams.safeParse(req.query);
  const farms = await db
    .select({ farm: farmsTable, user: usersTable })
    .from(farmsTable)
    .leftJoin(usersTable, eq(farmsTable.farmerId, usersTable.id));

  let filtered = farms;
  if (params.success && params.data.status) {
    filtered = farms.filter(f => f.farm.status === params.data.status);
  }
  if (params.success && params.data.cropType) {
    filtered = filtered.filter(f => f.farm.cropType.toLowerCase().includes((params.data.cropType ?? "").toLowerCase()));
  }

  res.json(filtered.map(({ farm, user }) => farmToJson(farm, user?.name ?? "Unknown")));
});

router.post("/farms", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateFarmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, cropType, location, loanAmount, totalShares, description, imageUrl } = parsed.data;
  const sharePrice = Number(loanAmount) / totalShares;

  const farmerHarvestCount = (await db.select().from(farmsTable)
    .where(and(eq(farmsTable.farmerId, user.id), eq(farmsTable.status, "harvested")))).length;

  let v2: Awaited<ReturnType<typeof computePrimaryPricingV2>> | undefined;
  try {
    v2 = await computePrimaryPricingV2({
      capitalNeededKes: Number(loanAmount),
      crop: cropType,
      landSizeHa: 1,
      plantingDate: new Date(),
      farmerExperienceYears: 3,
      location,
      farmerHarvestCount,
    });
  } catch (e) {
    console.error("[POST /farms] pricing v2 failed, proceeding without explainability:", (e as Error).message);
  }

  const [farm] = await db.insert(farmsTable).values({
    farmerId: user.id,
    name,
    cropType,
    location,
    loanAmount: String(loanAmount),
    totalShares,
    sharePrice: String(sharePrice),
    sharesAvailable: totalShares,
    currentPrice: String(sharePrice),
    description: description ?? null,
    imageUrl: imageUrl ?? null,
    ...(v2 ? {
      riskScore: String(v2.riskScore),
      topFactors: v2.topFactors,
      riskScoreSource: v2.riskScoreSource,
      revenueForecastLow: String(Math.round(v2.revenueForecast.low)),
      revenueForecastHigh: String(Math.round(v2.revenueForecast.high)),
      uncertaintyRatio: String(v2.revenueForecast.uncertaintyRatio.toFixed(4)),
      coldStart: v2.coldStart,
      reviewFlagged: v2.humanReview.flagged,
      reviewReasons: v2.humanReview.reasons,
    } : {}),
  }).returning();

  await db.insert(marketListingsTable).values({
    farmId: farm.id,
    sellerId: user.id,
    listingType: "primary",
    sharesAvailable: totalShares,
    pricePerShare: String(sharePrice),
  });

  res.status(201).json(farmToJson(farm, user.name));
});

router.get("/farms/:id", async (req, res): Promise<void> => {
  const params = GetFarmParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ farm: farmsTable, user: usersTable })
    .from(farmsTable)
    .leftJoin(usersTable, eq(farmsTable.farmerId, usersTable.id))
    .where(eq(farmsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Farm not found" });
    return;
  }

  const priceHistory = Array.from({ length: 12 }, (_, i) => ({
    date: new Date(Date.now() - (11 - i) * 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    price: Number(row.farm.sharePrice) * (0.9 + Math.random() * 0.2),
  }));

  res.json({
    ...farmToJson(row.farm, row.user?.name ?? "Unknown"),
    investors: Math.floor(Math.random() * 50) + 5,
    priceHistory,
  });
});

router.patch("/farms/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = UpdateFarmParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateFarmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.description) updates.description = parsed.data.description;
  if (parsed.data.imageUrl) updates.imageUrl = parsed.data.imageUrl;
  if (parsed.data.status) updates.status = parsed.data.status;

  const [farm] = await db.update(farmsTable).set(updates).where(eq(farmsTable.id, params.data.id)).returning();
  if (!farm) {
    res.status(404).json({ error: "Farm not found" });
    return;
  }
  res.json(farmToJson(farm, user.name));
});

export default router;
