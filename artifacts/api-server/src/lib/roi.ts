/**
 * ROI Calculation Engine
 *
 * Implements two exit strategies:
 *   1. Full Season (Hold to Harvest) — dividend-based
 *   2. Mid-Season Exit (30–60 days) — secondary market sale
 *
 * Formula references match the product specification document.
 */

import type { RainfallData } from "./rainfall";

// ─── Constants (mirror scheduler.ts) ─────────────────────────────────────────
const P_MAX         = 0.40;
const LGD           = 0.80;
const RISK_FREE     = 0.10;
const BETA_DS       = 0.20;
const LIQUIDITY_D   = 0.02;
const REVENUE_MULTI = 1.40;
const ALPHA         = 0.20;
const PRIMARY_FEE   = 0.015;
const SECONDARY_FEE = 0.005;

const CROP_RISK_S: Record<string, number> = {
  maize: 8, beans: 8, cassava: 8, rice: 7, wheat: 7, sunflower: 7, sorghum: 7,
  tea: 7, potatoes: 6, onions: 6, tomatoes: 5, horticulture: 5,
  avocado: 4, coffee: 3, tobacco: 2,
};

const CROP_SEASON_DAYS: Record<string, number> = {
  coffee: 180, avocado: 150, rice: 120, wheat: 90, maize: 90,
  tea: 90, sunflower: 90, potatoes: 90, tomatoes: 60, beans: 60,
  onions: 75, cassava: 270, tobacco: 120, sorghum: 90,
};

// ─── Input / Output types ─────────────────────────────────────────────────────
export interface HoldingROIInput {
  farmId: number;
  farmName: string;
  cropType: string;
  totalShares: number;
  sharesAvailable: number;
  loanAmount: number;          // KES capital raised
  sharePrice: number;          // P0 primary price
  currentPrice: number;        // P_exec today
  purchasePrice: number;       // investor's actual buy price
  quantity: number;            // shares held by investor
  farmCreatedAt: Date;
  rainfallFactor?: number;     // 0–1 from rainfall engine (optional)
  marketImbalance?: number;    // 0.85–1.15 demand factor (optional)
}

export interface ROIProjection {
  farmId: number;
  farmName: string;
  cropType: string;

  // Cost basis
  costBasis: number;             // q × P0 × (1 + 0.015)

  // Full season
  fullSeason: {
    daysToHarvest: number;
    projectedPayout: number;     // q × (α × R̂) / N × rainfallFactor
    roi: number;                 // decimal e.g. 0.22 = 22%
    roiPercent: number;          // e.g. 22
    annualizedRoi: number;
    annualizedPercent: number;
  };

  // Mid-season
  midSeason: {
    daysHeld: number;            // days since investor bought
    pSell: number;               // AI-computed secondary sell price
    saleProceeds: number;        // q × P_sell × (1 – 0.005)
    roi: number;
    roiPercent: number;
    annualizedRoi: number;
    annualizedPercent: number;
  };

  // Recommendation
  recommendation: "hold" | "sell" | "neutral";
  recommendationLabel: string;

  // Risk adjustments applied
  rainfallFactor: number;
  riskDiscount: number;         // λ
  riskScore: number;            // S 1–10
}

/**
 * Compute full-season and mid-season ROI for a single holding.
 */
export function computeROI(input: HoldingROIInput): ROIProjection {
  const {
    farmId, farmName, cropType, totalShares: N, sharesAvailable,
    loanAmount, purchasePrice, quantity: q, farmCreatedAt,
    rainfallFactor = 1.0, marketImbalance = 1.0,
  } = input;

  const cropKey = (cropType ?? "maize").toLowerCase().trim();
  const S       = CROP_RISK_S[cropKey]      ?? 5;
  const seasonDays = CROP_SEASON_DAYS[cropKey] ?? 90;

  const ageDays      = (Date.now() - farmCreatedAt.getTime()) / 86_400_000;
  const daysToHarvest = Math.max(7, seasonDays - ageDays);
  const daysHeld      = Math.max(1, ageDays);

  // ── Cost basis ───────────────────────────────────────────────────────────
  const costBasis = q * purchasePrice * (1 + PRIMARY_FEE);

  // ── Shared pricing components ────────────────────────────────────────────
  const capital  = loanAmount;
  const R_hat    = capital * REVENUE_MULTI * rainfallFactor;  // rainfall-adjusted forecast revenue
  const lambda   = ((10 - S) / 9) * P_MAX * LGD;              // risk discount
  const D_hat    = (ALPHA * R_hat) / Math.max(N, 1);          // expected dividend per share

  // ── Full Season ROI ──────────────────────────────────────────────────────
  const projectedPayout = q * D_hat;
  const fullRoi         = projectedPayout / costBasis - 1;
  const fullAnn         = Math.pow(1 + fullRoi, 365 / Math.max(daysToHarvest, 1)) - 1;

  // ── Mid-Season P_sell (DCF secondary formula) ───────────────────────────
  const timeDiscount     = Math.pow(1 + RISK_FREE, daysToHarvest / 365);
  const imbalanceFactor  = Math.max(0.85, Math.min(1.15, marketImbalance));
  const P_sell           = (D_hat / timeDiscount) * (1 - lambda) * imbalanceFactor * (1 - LIQUIDITY_D);

  const saleProceeds = q * P_sell * (1 - SECONDARY_FEE);
  const midRoi       = saleProceeds / costBasis - 1;
  const midAnn       = Math.pow(1 + midRoi, 365 / Math.max(daysHeld, 1)) - 1;

  // ── Recommendation ───────────────────────────────────────────────────────
  // If annualised mid > full + 10%: "Consider Selling"
  // If full > mid + 10%: "Consider Holding"
  let recommendation: ROIProjection["recommendation"] = "neutral";
  let recommendationLabel = "Both strategies look similar — monitor the market";

  if (midAnn > fullAnn + 0.10) {
    recommendation = "sell";
    recommendationLabel = `Mid-season annualised ROI is ${fmt(midAnn - fullAnn)} higher — consider selling`;
  } else if (fullAnn > midAnn + 0.10) {
    recommendation = "hold";
    recommendationLabel = `Full-season annualised ROI is ${fmt(fullAnn - midAnn)} higher — consider holding`;
  }

  // ── Adjust sharesAvailable field not used but keep linter happy ─────────
  void sharesAvailable;

  return {
    farmId,
    farmName,
    cropType,
    costBasis: round2(costBasis),
    fullSeason: {
      daysToHarvest: Math.round(daysToHarvest),
      projectedPayout: round2(projectedPayout),
      roi: round4(fullRoi),
      roiPercent: round2(fullRoi * 100),
      annualizedRoi: round4(fullAnn),
      annualizedPercent: round2(fullAnn * 100),
    },
    midSeason: {
      daysHeld: Math.round(daysHeld),
      pSell: round2(P_sell),
      saleProceeds: round2(saleProceeds),
      roi: round4(midRoi),
      roiPercent: round2(midRoi * 100),
      annualizedRoi: round4(midAnn),
      annualizedPercent: round2(midAnn * 100),
    },
    recommendation,
    recommendationLabel,
    rainfallFactor: Math.round(rainfallFactor * 1000) / 1000,
    riskDiscount: round4(lambda),
    riskScore: S,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function round2(n: number) { return Math.round(n * 100) / 100; }
function round4(n: number) { return Math.round(n * 10000) / 10000; }
function fmt(n: number)    { return `${(n * 100).toFixed(1)}%`; }
