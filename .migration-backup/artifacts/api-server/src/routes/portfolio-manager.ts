import { Router, type IRouter } from "express";
import { db, farmsTable, investmentsTable, walletTransactionsTable, walletsTable } from "@workspace/db";
import {
  portfoliosTable, portfolioHoldingsTable,
  investorPortfolioSubscriptionsTable, portfolioFeesTable,
} from "@workspace/db/schema";
import { eq, and, sum, desc } from "drizzle-orm";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

const QUALIFICATION_THRESHOLD_KES = 500_000;

// ─── Qualification check ────────────────────────────────────────────────────
router.get("/portfolio-manager/qualification", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const investments = await db
    .select({ purchasePrice: investmentsTable.purchasePrice, quantity: investmentsTable.quantity })
    .from(investmentsTable)
    .where(eq(investmentsTable.investorId, user.id));

  const totalInvested = investments.reduce(
    (sum, i) => sum + Number(i.purchasePrice) * i.quantity, 0
  );

  res.json({
    qualified: totalInvested >= QUALIFICATION_THRESHOLD_KES,
    totalInvested,
    threshold: QUALIFICATION_THRESHOLD_KES,
  });
});

// ─── AI Portfolio Generator ─────────────────────────────────────────────────
router.post("/portfolio-manager/generate-ai", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { targetRisk, strategy } = req.body as { targetRisk?: number; strategy?: string };
  if (!targetRisk || !strategy) {
    res.status(400).json({ error: "targetRisk and strategy are required" }); return;
  }

  const farms = await db
    .select()
    .from(farmsTable)
    .where(eq(farmsTable.status, "active"));

  if (farms.length === 0) {
    res.json({ holdings: [] }); return;
  }

  // Score each farm based on strategy + risk alignment
  const scored = farms.map(f => {
    const crop = (f.cropType ?? "").toLowerCase();
    const change = Number(f.changePercent ?? 0);
    const price = Number(f.currentPrice ?? f.sharePrice ?? 100);

    // Farm risk score: heuristic 1–10
    let farmRisk = 5;
    if (["coffee", "avocado", "tobacco"].includes(crop)) farmRisk = 8;
    else if (["tea", "wheat", "tomatoes"].includes(crop)) farmRisk = 6;
    else if (["maize", "beans", "rice"].includes(crop)) farmRisk = 3;
    else if (["dairy", "poultry"].includes(crop)) farmRisk = 4;

    // Expected return proxy: use changePercent + base
    const expectedReturn = 12 + change * 1.5;

    // NDVI proxy based on crop + season
    const ndvi = crop === "maize" ? 0.78 : crop === "tea" ? 0.82 : crop === "coffee" ? 0.65 : 0.70;

    // Strategy filter score
    let score = 0;
    const riskDiff = Math.abs(farmRisk - targetRisk);
    score += Math.max(0, 10 - riskDiff * 2); // risk alignment

    if (strategy === "growth") {
      score += expectedReturn * 0.5;
      if (["coffee", "avocado"].includes(crop)) score += 4;
    } else if (strategy === "balanced") {
      score += expectedReturn * 0.3;
      if (farmRisk >= 3 && farmRisk <= 6) score += 4;
    } else if (strategy === "climate_resilient") {
      score += ndvi * 8;
      if (["maize", "beans", "dairy"].includes(crop)) score += 3;
      if (farmRisk < 5) score += 4;
    } else {
      score += expectedReturn * 0.3;
    }

    // Penalise farms too far outside risk budget
    if (farmRisk > targetRisk + 2) score = score * 0.4;

    return { farm: f, score, farmRisk, expectedReturn, ndvi };
  });

  // Sort by score, take top 6–8
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(8, farms.length));

  // Assign weights proportional to score
  const totalScore = top.reduce((s, t) => s + t.score, 0);
  const holdings = top.map(t => {
    const rawWeight = totalScore > 0 ? (t.score / totalScore) * 100 : 100 / top.length;
    return {
      farmId: t.farm.id,
      farmName: t.farm.name,
      cropType: t.farm.cropType,
      location: t.farm.location,
      currentPrice: Number(t.farm.currentPrice ?? t.farm.sharePrice),
      riskScore: t.farmRisk,
      expectedReturn: Math.round(t.expectedReturn * 10) / 10,
      ndvi: Math.round(t.ndvi * 100) / 100,
      weightPercent: Math.round(rawWeight * 10) / 10,
      changePercent: Number(t.farm.changePercent ?? 0),
    };
  });

  // Normalise weights to sum exactly 100
  const weightSum = holdings.reduce((s, h) => s + h.weightPercent, 0);
  if (weightSum > 0 && holdings.length > 0) {
    holdings[0].weightPercent = Math.round((holdings[0].weightPercent + (100 - weightSum)) * 10) / 10;
  }

  res.json({ holdings });
});

// ─── Create portfolio ────────────────────────────────────────────────────────
router.post("/portfolio-manager/create", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { name, description, strategy, targetRisk, managementFeePercent, holdings } =
    req.body as {
      name: string; description?: string; strategy: string;
      targetRisk: number; managementFeePercent?: number;
      holdings: { farmId: number; weightPercent: number }[];
    };

  if (!name || !strategy || !targetRisk || !Array.isArray(holdings) || holdings.length === 0) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }

  const [portfolio] = await db.insert(portfoliosTable).values({
    managerInvestorId: user.id,
    name,
    description,
    strategy,
    targetRisk,
    managementFeePercent: String(managementFeePercent ?? 0),
    isPublished: false,
  }).returning();

  await db.insert(portfolioHoldingsTable).values(
    holdings.map(h => ({
      portfolioId: portfolio.id,
      farmId: h.farmId,
      weightPercent: String(h.weightPercent),
    }))
  );

  res.json({ portfolio });
});

// ─── Publish portfolio ───────────────────────────────────────────────────────
router.post("/portfolio-manager/:id/publish", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params["id"]);
  const [portfolio] = await db.select().from(portfoliosTable).where(
    and(eq(portfoliosTable.id, id), eq(portfoliosTable.managerInvestorId, user.id))
  );

  if (!portfolio) { res.status(404).json({ error: "Portfolio not found" }); return; }

  await db.update(portfoliosTable).set({ isPublished: true }).where(eq(portfoliosTable.id, id));

  res.json({ success: true, shareUrl: `/market/portfolios/${id}` });
});

// ─── List community portfolios ───────────────────────────────────────────────
router.get("/portfolio-manager/community", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const portfolios = await db
    .select()
    .from(portfoliosTable)
    .where(eq(portfoliosTable.isPublished, true))
    .orderBy(desc(portfoliosTable.followerCount));

  const result = await Promise.all(portfolios.map(async p => {
    const holdings = await db
      .select({ holding: portfolioHoldingsTable, farm: farmsTable })
      .from(portfolioHoldingsTable)
      .leftJoin(farmsTable, eq(portfolioHoldingsTable.farmId, farmsTable.id))
      .where(eq(portfolioHoldingsTable.portfolioId, p.id));

    const totalExpectedReturn = holdings.reduce((s, h) => {
      const w = Number(h.holding.weightPercent) / 100;
      const ret = 12 + Number(h.farm?.changePercent ?? 0) * 1.5;
      return s + ret * w;
    }, 0);

    return {
      ...p,
      holdingCount: holdings.length,
      expectedReturn: Math.round(totalExpectedReturn * 10) / 10,
      topCrops: [...new Set(holdings.slice(0, 3).map(h => h.farm?.cropType).filter(Boolean))],
    };
  }));

  res.json(result);
});

// ─── Get my portfolios ───────────────────────────────────────────────────────
router.get("/portfolio-manager/my", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const portfolios = await db
    .select()
    .from(portfoliosTable)
    .where(eq(portfoliosTable.managerInvestorId, user.id))
    .orderBy(desc(portfoliosTable.createdAt));

  const result = await Promise.all(portfolios.map(async p => {
    const holdings = await db
      .select({ holding: portfolioHoldingsTable, farm: farmsTable })
      .from(portfolioHoldingsTable)
      .leftJoin(farmsTable, eq(portfolioHoldingsTable.farmId, farmsTable.id))
      .where(eq(portfolioHoldingsTable.portfolioId, p.id));

    return { ...p, holdingCount: holdings.length, holdings: holdings.map(h => ({
      farmId: h.farm?.id,
      farmName: h.farm?.name,
      cropType: h.farm?.cropType,
      weightPercent: Number(h.holding.weightPercent),
    })) };
  }));

  res.json(result);
});

// ─── Get single portfolio detail ─────────────────────────────────────────────
router.get("/portfolio-manager/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params["id"]);
  const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.id, id));
  if (!portfolio) { res.status(404).json({ error: "Not found" }); return; }

  const holdings = await db
    .select({ holding: portfolioHoldingsTable, farm: farmsTable })
    .from(portfolioHoldingsTable)
    .leftJoin(farmsTable, eq(portfolioHoldingsTable.farmId, farmsTable.id))
    .where(eq(portfolioHoldingsTable.portfolioId, id));

  const subs = await db
    .select()
    .from(investorPortfolioSubscriptionsTable)
    .where(eq(investorPortfolioSubscriptionsTable.portfolioId, id));

  const isSubscribed = subs.some(s => s.investorId === user.id);

  res.json({
    ...portfolio,
    holdings: holdings.map(h => ({
      farmId: h.farm?.id,
      farmName: h.farm?.name,
      cropType: h.farm?.cropType,
      location: h.farm?.location,
      currentPrice: Number(h.farm?.currentPrice ?? h.farm?.sharePrice ?? 0),
      changePercent: Number(h.farm?.changePercent ?? 0),
      weightPercent: Number(h.holding.weightPercent),
    })),
    subscriberCount: subs.length,
    isSubscribed,
  });
});

// ─── Copy / subscribe to portfolio ──────────────────────────────────────────
router.post("/portfolio-manager/:id/copy", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params["id"]);
  const { autoRebalance, investAmount } = req.body as { autoRebalance?: boolean; investAmount?: number };

  const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.id, id));
  if (!portfolio) { res.status(404).json({ error: "Portfolio not found" }); return; }

  // Don't allow subscribing to own portfolio
  if (portfolio.managerInvestorId === user.id) {
    res.status(400).json({ error: "Cannot copy your own portfolio" }); return;
  }

  // Check existing subscription
  const existing = await db.select().from(investorPortfolioSubscriptionsTable).where(
    and(
      eq(investorPortfolioSubscriptionsTable.investorId, user.id),
      eq(investorPortfolioSubscriptionsTable.portfolioId, id)
    )
  );
  if (existing.length > 0) {
    res.status(400).json({ error: "Already subscribed to this portfolio" }); return;
  }

  await db.insert(investorPortfolioSubscriptionsTable).values({
    investorId: user.id,
    portfolioId: id,
    autoRebalanceEnabled: autoRebalance ?? false,
    investedAmount: String(investAmount ?? 0),
  });

  // Increment follower count
  await db.update(portfoliosTable)
    .set({ followerCount: (portfolio.followerCount ?? 0) + 1 })
    .where(eq(portfoliosTable.id, id));

  res.json({ success: true, message: "Portfolio copied successfully" });
});

export default router;
