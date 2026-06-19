import { Router, type IRouter } from "express";
import { db, reinvestmentRulesTable, farmsTable, investmentsTable, walletsTable, walletTransactionsTable, transactionsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

router.get("/reinvestment/rule", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [rule] = await db.select().from(reinvestmentRulesTable).where(eq(reinvestmentRulesTable.userId, user.id));
  res.json(rule ?? {
    enabled: false, reinvestPercent: "70", walletPercent: "30",
    cropPreference: "any", minAmount: "1000", maxFarms: 3, riskTolerance: "moderate",
  });
});

router.post("/reinvestment/rule", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { enabled, reinvestPercent, walletPercent, cropPreference, minAmount, maxFarms, riskTolerance } = req.body;

  const reinvest = Math.min(100, Math.max(0, Number(reinvestPercent ?? 70)));
  const wallet = 100 - reinvest;

  const [existing] = await db.select().from(reinvestmentRulesTable).where(eq(reinvestmentRulesTable.userId, user.id));
  if (existing) {
    const [updated] = await db.update(reinvestmentRulesTable)
      .set({
        enabled: Boolean(enabled),
        reinvestPercent: String(reinvest),
        walletPercent: String(wallet),
        cropPreference: cropPreference ?? "any",
        minAmount: String(Number(minAmount ?? 1000)),
        maxFarms: Number(maxFarms ?? 3),
        riskTolerance: riskTolerance ?? "moderate",
        updatedAt: new Date(),
      })
      .where(eq(reinvestmentRulesTable.userId, user.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(reinvestmentRulesTable).values({
      userId: user.id,
      enabled: Boolean(enabled),
      reinvestPercent: String(reinvest),
      walletPercent: String(wallet),
      cropPreference: cropPreference ?? "any",
      minAmount: String(Number(minAmount ?? 1000)),
      maxFarms: Number(maxFarms ?? 3),
      riskTolerance: riskTolerance ?? "moderate",
    }).returning();
    res.json(created);
  }
});

router.post("/reinvestment/simulate", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { payoutAmount } = req.body;
  const amount = Number(payoutAmount ?? 0);

  const [rule] = await db.select().from(reinvestmentRulesTable).where(eq(reinvestmentRulesTable.userId, user.id));
  if (!rule || !rule.enabled) {
    res.json({ enabled: false, message: "No active reinvestment rule." });
    return;
  }

  const reinvestAmount = amount * (Number(rule.reinvestPercent) / 100);
  const walletAmount = amount * (Number(rule.walletPercent) / 100);

  const cropFilter = rule.cropPreference && rule.cropPreference !== "any"
    ? eq(farmsTable.cropType, rule.cropPreference)
    : undefined;

  const riskMin = rule.riskTolerance === "low" ? 8 : rule.riskTolerance === "moderate" ? 5 : 1;
  const riskMax = rule.riskTolerance === "low" ? 10 : rule.riskTolerance === "moderate" ? 8 : 10;

  const whereClause = cropFilter
    ? and(cropFilter, gte(farmsTable.riskScore, String(riskMin)))
    : gte(farmsTable.riskScore, String(riskMin));

  const farms = await db.select().from(farmsTable)
    .where(whereClause)
    .limit(rule.maxFarms * 3)
    .orderBy(desc(farmsTable.riskScore));

  const viableFarms = farms
    .filter(f => Number(f.riskScore ?? 5) <= riskMax)
    .slice(0, rule.maxFarms);

  const perFarm = viableFarms.length > 0 ? reinvestAmount / viableFarms.length : 0;

  res.json({
    enabled: true,
    payoutAmount: amount,
    reinvestAmount,
    walletAmount,
    reinvestPercent: Number(rule.reinvestPercent),
    walletPercent: Number(rule.walletPercent),
    suggestedFarms: viableFarms.map(f => ({
      id: f.id,
      name: f.name,
      cropType: f.cropType,
      location: f.location,
      riskScore: f.riskScore,
      allotment: perFarm,
      sharesAtCurrentPrice: f.currentPrice ? Math.floor(perFarm / Number(f.currentPrice)) : 0,
    })),
  });
});

export default router;
