/**
 * Investa Farm — Platform Metrics Engine
 *
 * Implements:
 *   Investor:  ROI, annualized return, Sharpe ratio, win rate, max drawdown, VaR
 *   Farmer:    Cost per kg, yield gap, payback period, skill score
 *   Platform:  TVL, revenue run rate, capital efficiency, investor retention, avg subscription time
 *   Liquidity: Order-book liquidity ratio per farm
 */

import { db, investmentsTable, farmsTable, walletTransactionsTable, dividendsTable, platformRevenueTable, orderBookTable, marketListingsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

const RISK_FREE = 0.10; // annual risk-free rate

// ─── Investor Metrics ─────────────────────────────────────────────────────────

/**
 * ROI for a single holding:
 *   ROI = (currentValue – costBasis) / costBasis
 */
export function computeHoldingROI(
  quantity: number,
  purchasePrice: number,
  currentPrice: number,
  primaryFeePct = 0.015,
): { costBasis: number; currentValue: number; roi: number; roiPercent: number } {
  const costBasis    = quantity * purchasePrice * (1 + primaryFeePct);
  const currentValue = quantity * currentPrice;
  const roi          = (currentValue - costBasis) / Math.max(costBasis, 0.01);
  return {
    costBasis:    Math.round(costBasis    * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    roi:          Math.round(roi * 10000)  / 10000,
    roiPercent:   Math.round(roi * 10000)  / 100,
  };
}

/**
 * Annualized return:
 *   annualizedReturn = (1 + ROI)^(365/daysHeld) – 1
 */
export function annualizeReturn(roi: number, daysHeld: number): number {
  const days = Math.max(1, daysHeld);
  return Math.pow(1 + roi, 365 / days) - 1;
}

/**
 * Sharpe Ratio:
 *   Sharpe = (Rp – Rf) / σp
 * For a single farm: σp is estimated from CROP risk score → higher S = lower σ.
 */
export function computeSharpe(
  expectedReturnPct: number,
  riskScore: number, // 1–10
): number {
  // Estimate σ from risk score: S=10 → σ≈5%, S=1 → σ≈40%
  const sigmaPct = 40 - (riskScore - 1) * (35 / 9);
  return (expectedReturnPct - RISK_FREE * 100) / Math.max(sigmaPct, 0.1);
}

/**
 * Maximum Drawdown across a price series.
 */
export function computeMaxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;
  let peak = prices[0]!;
  let maxDD = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = (peak - p) / Math.max(peak, 0.01);
    if (dd > maxDD) maxDD = dd;
  }
  return Math.round(maxDD * 10000) / 10000;
}

/**
 * Value at Risk (95% confidence):
 *   VaR95 = μp – 1.65 × σp   (as a fraction of portfolio value)
 */
export function computeVaR95(
  expectedReturnFrac: number,
  riskScore: number,
): { varFrac: number; label: string } {
  const sigmaPct = 40 - (riskScore - 1) * (35 / 9);
  const sigma    = sigmaPct / 100;
  const varFrac  = Math.max(0, -(expectedReturnFrac - 1.65 * sigma));
  return {
    varFrac: Math.round(varFrac * 10000) / 10000,
    label:   `${(varFrac * 100).toFixed(1)}% max loss at 95% confidence`,
  };
}

// ─── Farmer Metrics ───────────────────────────────────────────────────────────

export interface FarmerSeasonRecord {
  totalInputCostsKes: number;
  actualYieldKg: number;
  expectedYieldKg: number;
  capitalRaisedKes: number;
  netProfitKes: number;
}

export function computeFarmerMetrics(seasons: FarmerSeasonRecord[]): {
  costPerKg: number;
  yieldGapPct: number;
  paybackPeriodDays: number;
  skillScore: number;    // 0–100
  winRate: number;       // %
} {
  if (seasons.length === 0) {
    return { costPerKg: 0, yieldGapPct: 100, paybackPeriodDays: 0, skillScore: 50, winRate: 0 };
  }

  const last = seasons[seasons.length - 1]!;

  // Cost per kg
  const costPerKg = last.actualYieldKg > 0
    ? last.totalInputCostsKes / last.actualYieldKg
    : 0;

  // Yield gap: actual / expected × 100
  const yieldGapPct = last.expectedYieldKg > 0
    ? Math.round((last.actualYieldKg / last.expectedYieldKg) * 100)
    : 100;

  // Payback period (days): assume 365 days/year for simple ratio
  const annualNetProfit = last.netProfitKes;
  const paybackPeriodDays = annualNetProfit > 0
    ? Math.round((last.capitalRaisedKes / annualNetProfit) * 365)
    : 9999;

  // Win rate: percentage of profitable seasons
  const profitable = seasons.filter(s => s.netProfitKes > 0).length;
  const winRate = Math.round((profitable / seasons.length) * 100);

  // Skill score: weighted average of last 3 seasons (yield growth + cost efficiency + win rate)
  const recent = seasons.slice(-3);
  let skillScore = 50;

  if (recent.length >= 2) {
    const growths = recent.slice(1).map((s, i) => {
      const prev = recent[i]!;
      return prev.actualYieldKg > 0
        ? (s.actualYieldKg - prev.actualYieldKg) / prev.actualYieldKg
        : 0;
    });
    const avgGrowth = growths.reduce((a, b) => a + b, 0) / growths.length;
    skillScore = Math.round(50 + avgGrowth * 100 + (yieldGapPct - 80) * 0.5);
    skillScore = Math.max(0, Math.min(100, skillScore));
  }

  return { costPerKg: Math.round(costPerKg * 100) / 100, yieldGapPct, paybackPeriodDays, skillScore, winRate };
}

// ─── Platform Metrics (async, queries DB) ─────────────────────────────────────

export interface PlatformMetrics {
  tvlKes: number;
  revenueRunRateKes: number;
  capitalEfficiencyPct: number;
  avgSubscriptionDays: number;
  activeFarms: number;
  totalInvestors: number;
}

export async function computePlatformMetrics(): Promise<PlatformMetrics> {
  try {
    // TVL: sum of loanAmount across all active/funded farms
    const farms = await db.select().from(farmsTable);
    const activeFarms = farms.filter(f => f.status === "active" || f.status === "funded");
    const tvlKes = activeFarms.reduce((s, f) => s + Number(f.loanAmount), 0);

    // Revenue run rate: fees from last 30 days × 12
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentRevenue = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(amount AS NUMERIC)), 0)` })
      .from(platformRevenueTable)
      .where(gte(platformRevenueTable.createdAt, thirtyDaysAgo));
    const last30Fees = Number(recentRevenue[0]?.total ?? 0);
    const revenueRunRateKes = last30Fees * 12;

    // Capital efficiency: total invested / total deposits
    const investedResult = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(amount AS NUMERIC)), 0)` })
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.type, "investment"));
    const totalInvested = Number(investedResult[0]?.total ?? 0);

    const depositResult = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(amount AS NUMERIC)), 0)` })
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.type, "deposit"));
    const totalDeposits = Number(depositResult[0]?.total ?? 1);
    const capitalEfficiencyPct = Math.round((totalInvested / totalDeposits) * 100);

    // Unique investors
    const investors = await db
      .selectDistinct({ id: investmentsTable.investorId })
      .from(investmentsTable);
    const totalInvestors = investors.length;

    return {
      tvlKes: Math.round(tvlKes),
      revenueRunRateKes: Math.round(revenueRunRateKes),
      capitalEfficiencyPct: Math.min(100, capitalEfficiencyPct),
      avgSubscriptionDays: 0, // computed separately when farm close data is available
      activeFarms: activeFarms.length,
      totalInvestors,
    };
  } catch {
    return { tvlKes: 0, revenueRunRateKes: 0, capitalEfficiencyPct: 0, avgSubscriptionDays: 0, activeFarms: 0, totalInvestors: 0 };
  }
}

// ─── Liquidity Ratio ──────────────────────────────────────────────────────────

/**
 * Liquidity ratio = (open buy orders + open sell orders) / totalShares
 *   >10% = highly liquid, 2–10% = moderate, <2% = illiquid
 */
export async function computeLiquidityRatio(farmId: number): Promise<{
  ratio: number;
  label: "high" | "moderate" | "low";
  openBuys: number;
  openSells: number;
}> {
  try {
    const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId));
    if (!farm) return { ratio: 0, label: "low", openBuys: 0, openSells: 0 };

    const orders = await db.select().from(orderBookTable).where(
      and(eq(orderBookTable.farmId, farmId), eq(orderBookTable.status, "open"))
    );

    const openBuys  = orders.filter(o => o.side === "buy") .reduce((s, o) => s + Number(o.quantity) - Number(o.filledQuantity), 0);
    const openSells = orders.filter(o => o.side === "sell").reduce((s, o) => s + Number(o.quantity) - Number(o.filledQuantity), 0);
    const N         = Math.max(farm.totalShares, 1);
    const ratio     = Math.round(((openBuys + openSells) / N) * 10000) / 100;
    const label     = ratio > 10 ? "high" : ratio > 2 ? "moderate" : "low";

    return { ratio, label, openBuys: Math.round(openBuys), openSells: Math.round(openSells) };
  } catch {
    return { ratio: 0, label: "low", openBuys: 0, openSells: 0 };
  }
}

// ─── Portfolio-Level Metrics ──────────────────────────────────────────────────

export interface PortfolioSummary {
  totalCostBasis: number;
  totalCurrentValue: number;
  portfolioROI: number;
  portfolioROIPercent: number;
  weightedAnnualizedReturn: number;
  maxDrawdown: number;
  varFrac95: number;
  holdingCount: number;
}

export function computePortfolioSummary(
  holdings: Array<{
    quantity: number;
    purchasePrice: number;
    currentPrice: number;
    riskScore: number;
    daysHeld: number;
    priceHistory?: number[];
  }>
): PortfolioSummary {
  if (holdings.length === 0) {
    return {
      totalCostBasis: 0, totalCurrentValue: 0,
      portfolioROI: 0, portfolioROIPercent: 0,
      weightedAnnualizedReturn: 0, maxDrawdown: 0,
      varFrac95: 0, holdingCount: 0,
    };
  }

  let totalCost    = 0;
  let totalValue   = 0;
  let weightedAnn  = 0;
  let allPrices: number[] = [];

  for (const h of holdings) {
    const { costBasis, currentValue, roi } = computeHoldingROI(h.quantity, h.purchasePrice, h.currentPrice);
    const ann = annualizeReturn(roi, h.daysHeld);
    totalCost  += costBasis;
    totalValue += currentValue;
    weightedAnn += ann * costBasis; // weight by cost basis
    if (h.priceHistory) allPrices = [...allPrices, ...h.priceHistory];
  }

  const portfolioROI = (totalValue - totalCost) / Math.max(totalCost, 0.01);
  const avgRiskScore = holdings.reduce((s, h) => s + h.riskScore, 0) / holdings.length;
  const { varFrac }  = computeVaR95(portfolioROI, avgRiskScore);

  return {
    totalCostBasis:         Math.round(totalCost    * 100) / 100,
    totalCurrentValue:      Math.round(totalValue   * 100) / 100,
    portfolioROI:           Math.round(portfolioROI * 10000) / 10000,
    portfolioROIPercent:    Math.round(portfolioROI * 10000) / 100,
    weightedAnnualizedReturn: totalCost > 0 ? Math.round((weightedAnn / totalCost) * 10000) / 10000 : 0,
    maxDrawdown:            allPrices.length > 1 ? computeMaxDrawdown(allPrices) : 0,
    varFrac95:              varFrac,
    holdingCount:           holdings.length,
  };
}
