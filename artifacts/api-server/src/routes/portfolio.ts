import { Router, type IRouter } from "express";
import { db, farmsTable, investmentsTable, transactionsTable, walletTransactionsTable } from "@workspace/db";
import { eq, and, gte, desc, asc } from "drizzle-orm";
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
    // Floor at 98% of purchase price so DCF discounting never shows an immediate large loss
    const effectivePrice = Math.max(currentPrice, purchasePrice * 0.98);
    const totalValue = effectivePrice * investment.quantity;
    const gainLoss = (effectivePrice - purchasePrice) * investment.quantity;
    const gainLossPercent = purchasePrice > 0 ? ((effectivePrice - purchasePrice) / purchasePrice) * 100 : 0;
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
    const purchasePrice = Number(investment.purchasePrice);
    const currentPrice = Number(farm.currentPrice);
    // Use purchase price as a floor so DCF discounting doesn't show immediate losses.
    // The real P&L reflects actual market movement above (or below) what the investor paid.
    const effectivePrice = Math.max(currentPrice, purchasePrice * 0.98);
    totalValue += effectivePrice * investment.quantity;
    totalInvested += purchasePrice * investment.quantity;
  });

  const overallGainLoss = totalValue - totalInvested;
  const overallGainLossPercent = totalInvested > 0 ? (overallGainLoss / totalInvested) * 100 : 0;

  // Real todayReturn: sum of wallet "return" transactions today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTxs = await db
    .select()
    .from(walletTransactionsTable)
    .where(and(
      eq(walletTransactionsTable.userId, user.id),
      eq(walletTransactionsTable.type, "return"),
      gte(walletTransactionsTable.createdAt, todayStart),
    ));
  const todayReturn = todayTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const todayReturnPercent = totalInvested > 0 ? (todayReturn / totalInvested) * 100 : 0;

  // Real 7-day price history from wallet transaction balance snapshots
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentTxs = await db
    .select()
    .from(walletTransactionsTable)
    .where(and(
      eq(walletTransactionsTable.userId, user.id),
      gte(walletTransactionsTable.createdAt, weekAgo),
    ))
    .orderBy(asc(walletTransactionsTable.createdAt));

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let prevValue = totalInvested;
  const priceHistory = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
    const dayKey = d.toDateString();
    const dayTxs = recentTxs.filter(tx => new Date(tx.createdAt).toDateString() === dayKey);
    const lastTx = dayTxs[dayTxs.length - 1];
    const val = lastTx ? Number(lastTx.balanceAfter) : prevValue;
    prevValue = val;
    const dow = d.getDay();
    return { label: dayLabels[dow === 0 ? 6 : dow - 1], value: val };
  });

  const firstVal = priceHistory.find(p => p.value > 0)?.value ?? totalInvested;
  const lastVal = priceHistory[priceHistory.length - 1].value;
  const weekReturnPercent = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;

  res.json({
    totalValue,
    totalInvested,
    todayReturn,
    todayReturnPercent,
    weekReturnPercent: Number(weekReturnPercent.toFixed(2)),
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
  await db
    .update(investmentsTable)
    .set({ exitType, exitDate, status: "exit_requested" })
    .where(eq(investmentsTable.id, holdingId));
  res.json({ success: true, exitDate: exitDate.toISOString(), exitType });
});

export default router;
