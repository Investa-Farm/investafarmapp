import { Router, type IRouter } from "express";
import { db, farmsTable, investmentsTable, farmUpdatesTable, marketListingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateFarmUpdateBody } from "@workspace/api-zod";
import { getCurrentUser } from "./auth";

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
  };
}

router.get("/farmer/dashboard", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const farms = await db.select().from(farmsTable).where(eq(farmsTable.farmerId, user.id));
  const allInvestors = await db.select().from(investmentsTable);
  const myFarmIds = farms.map(f => f.id);
  const myInvestors = allInvestors.filter(i => myFarmIds.includes(i.farmId));

  const farmValue = farms.reduce((sum, f) => sum + Number(f.currentPrice) * f.totalShares, 0);
  const fundsRaised = farms.reduce((sum, f) => sum + (Number(f.loanAmount) * (f.totalShares - f.sharesAvailable) / f.totalShares), 0);
  const fundingTarget = farms.reduce((sum, f) => sum + Number(f.loanAmount), 0);
  const fundingPercent = fundingTarget > 0 ? Math.round((fundsRaised / fundingTarget) * 100) : 0;

  const priceHistory = Array.from({ length: 7 }, (_, i) => ({
    label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    value: farmValue * (0.94 + i * 0.01),
  }));

  res.json({
    farmValue,
    weekChangePercent: 6.2,
    fundsRaised,
    fundingTarget,
    fundingPercent,
    profit: fundsRaised * 0.1,
    fundsReceived: fundsRaised,
    growthStage: "growing" as const,
    growthPercent: 65,
    activeFarms: farms.length,
    totalInvestors: new Set(myInvestors.map(i => i.investorId)).size,
    priceHistory,
  });
});

router.get("/farmer/farms", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const farms = await db.select().from(farmsTable).where(eq(farmsTable.farmerId, user.id));
  res.json(farms.map(f => farmToJson(f, user.name)));
});

router.get("/farmer/updates", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const farms = await db.select().from(farmsTable).where(eq(farmsTable.farmerId, user.id));
  const farmIds = farms.map(f => f.id);
  if (farmIds.length === 0) {
    res.json([]);
    return;
  }
  const updates = await db.select().from(farmUpdatesTable);
  const myUpdates = updates.filter(u => farmIds.includes(u.farmId));
  res.json(myUpdates.map(u => {
    const farm = farms.find(f => f.id === u.farmId);
    const hoursAgo = Math.floor((Date.now() - u.createdAt.getTime()) / 3600000);
    return {
      id: u.id,
      farmId: u.farmId,
      farmName: farm?.name ?? "Farm",
      title: u.title,
      description: u.description,
      imageUrl: u.imageUrl ?? undefined,
      hoursAgo,
      createdAt: u.createdAt.toISOString(),
    };
  }));
});

router.post("/farmer/updates", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateFarmUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [farm] = await db.select().from(farmsTable)
    .where(and(eq(farmsTable.id, parsed.data.farmId), eq(farmsTable.farmerId, user.id)));
  if (!farm) {
    res.status(403).json({ error: "Farm not found or not authorized" });
    return;
  }
  const [update] = await db.insert(farmUpdatesTable).values({
    farmId: parsed.data.farmId,
    title: parsed.data.title,
    description: parsed.data.description,
    imageUrl: parsed.data.imageUrl ?? null,
  }).returning();

  res.status(201).json({
    id: update.id,
    farmId: update.farmId,
    farmName: farm.name,
    title: update.title,
    description: update.description,
    imageUrl: update.imageUrl ?? undefined,
    hoursAgo: 0,
    createdAt: update.createdAt.toISOString(),
  });
});

export default router;
