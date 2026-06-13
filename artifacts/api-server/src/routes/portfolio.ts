import { Router, type IRouter } from "express";
import { db, farmsTable, investmentsTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RequestExitBody } from "@workspace/api-zod";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

const FARM_IMAGES = [
  "/investa-farm/crops/maize.jpg",
  "/investa-farm/crops/avocado.jpg",
  "/investa-farm/crops/coffee.jpg",
  "/investa-farm/crops/wheat.jpg",
  "/investa-farm/crops/potatoes.jpg",
  "/investa-farm/crops/dairy.jpg",
  "/investa-farm/crops/sunflower.jpg",
  "/investa-farm/crops/cassava.jpg",
  "/investa-farm/crops/potato-field.jpg",
];

router.get("/portfolio", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const holdings = await db
    .select({ investment: investmentsTable, farm: farmsTable })
    .from(investmentsTable)
    .leftJoin(farmsTable, eq(investmentsTable.farmId, farmsTable.id))
    .where(eq(investmentsTable.investorId, user.id));

  res.json(holdings.filter(h => h.farm).map(({ investment, farm }) => {
    const purchasePrice = Number(investment.purchasePrice);
    const currentPrice = Number(farm!.currentPrice);
    const totalValue = currentPrice * investment.quantity;
    const gainLoss = (currentPrice - purchasePrice) * investment.quantity;
    const gainLossPercent = purchasePrice > 0 ? ((currentPrice - purchasePrice) / purchasePrice) * 100 : 0;
    return {
      id: investment.id,
      farmId: farm!.id,
      farmName: farm!.name,
      cropType: farm!.cropType,
      location: farm!.location,
      quantity: investment.quantity,
      purchasePrice,
      currentPrice,
      totalValue,
      gainLoss,
      gainLossPercent,
      exitType: investment.exitType,
      exitDate: investment.exitDate?.toISOString() ?? undefined,
      imageUrl: farm!.imageUrl ?? FARM_IMAGES[farm!.id % FARM_IMAGES.length],
      status: investment.status,
    };
  }));
});

router.get("/portfolio/summary", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const holdings = await db
    .select({ investment: investmentsTable, farm: farmsTable })
    .from(investmentsTable)
    .leftJoin(farmsTable, eq(investmentsTable.farmId, farmsTable.id))
    .where(eq(investmentsTable.investorId, user.id));

  let totalValue = 0;
  let totalInvested = 0;
  holdings.forEach(({ investment, farm }) => {
    if (!farm) return;
    totalValue += Number(farm.currentPrice) * investment.quantity;
    totalInvested += Number(investment.purchasePrice) * investment.quantity;
  });

  const overallGainLoss = totalValue - totalInvested;
  const overallGainLossPercent = totalInvested > 0 ? (overallGainLoss / totalInvested) * 100 : 0;
  const todayReturn = totalValue * 0.0044;
  const todayReturnPercent = 0.44;

  const priceHistory = Array.from({ length: 7 }, (_, i) => ({
    label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    value: totalInvested * (0.95 + i * 0.01 + Math.random() * 0.02),
  }));

  res.json({
    totalValue,
    totalInvested,
    todayReturn,
    todayReturnPercent,
    weekReturnPercent: 6.2,
    overallGainLoss,
    overallGainLossPercent,
    holdings: holdings.length,
    priceHistory,
  });
});

router.post("/portfolio/exit", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = RequestExitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { holdingId, exitType } = parsed.data;
  const [investment] = await db.select().from(investmentsTable).where(eq(investmentsTable.id, holdingId));
  if (!investment) {
    res.status(404).json({ error: "Holding not found" });
    return;
  }
  const days = exitType === "wide_season" ? 45 : 180;
  const exitDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, investment.farmId));
  const estimatedReturn = Number(farm?.currentPrice ?? investment.purchasePrice) * investment.quantity * 1.08;

  await db.update(investmentsTable).set({ exitType, exitDate, status: "exit_requested" }).where(eq(investmentsTable.id, holdingId));

  res.json({
    id: Date.now(),
    holdingId,
    exitType,
    exitDate: exitDate.toISOString(),
    estimatedReturn,
    status: "pending",
  });
});

router.get("/transactions", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const txs = await db
    .select({ tx: transactionsTable, farm: farmsTable })
    .from(transactionsTable)
    .leftJoin(farmsTable, eq(transactionsTable.farmId, farmsTable.id))
    .where(eq(transactionsTable.userId, user.id));

  res.json(txs.map(({ tx, farm }) => ({
    id: tx.id,
    type: tx.type,
    farmId: tx.farmId,
    farmName: farm?.name ?? "Farm",
    cropType: farm?.cropType ?? "Crop",
    quantity: tx.quantity,
    pricePerShare: Number(tx.pricePerShare),
    totalAmount: Number(tx.totalAmount),
    exitType: tx.exitType ?? undefined,
    status: tx.status,
    createdAt: tx.createdAt.toISOString(),
  })));
});

export default router;
