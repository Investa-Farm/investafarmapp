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
