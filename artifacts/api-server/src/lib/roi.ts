/**
 * ROI Calculation Engine — Investa Farm
 *
 * Two exit strategies:
 *   1. Full Season (Hold to Harvest) — dividend at α × R_actual / N
 *   2. Mid-Season Exit — secondary market P_sell(t) via DCF
 *
 * Self-consistent pricing contract
 * ─────────────────────────────────
 * At launch the primary engine sets α so that:
 *   α × R̂₀ × d_baseline = K   →   D̂_baseline = α × R̂₀ / N = K / (N × d_baseline) = P₀ / d_baseline
 *
 * Therefore the correct baseline dividend per share is:
 *   D̂_baseline = sharePrice / d_baseline
 *
 * Adjusted for live conditions:
 *   D̂(t) = D̂_baseline × rainfallFactor × sentimentFactor
 *
 * This guarantees positive full-season ROI at baseline, correctly reflects
 * drought/excess-rain losses, and ensures the secondary price starts at ~P₀
 * on day 1 and naturally converges upward toward D̂ as harvest approaches.
 *
 * Secondary price (mid-season sell at day t):
 *   P_sell(t) = (D̂(t) / timeDiscount(t)) × (1 − λ(t)) × imbalanceFactor × (1 − δ)
 *
 * At t=0:  P_sell ≈ P₀ × 0.98  (2% liquidity discount — expected day-1 drag)
 * At t=T:  P_sell → P₀ × (1+rf)^(T/365) × 0.98  (natural time appreciation)
 */

import type { RainfallData } from "./rainfall";

// ─── Constants ────────────────────────────────────────────────────────────────
const P_MAX         = 0.40;   // max loss probability (S=1)
const LGD           = 0.80;   // loss given default fraction
const RISK_FREE     = 0.10;   // annual risk-free rate
const BETA_DS       = 0.20;   // demand-supply sensitivity
const LIQUIDITY_D   = 0.02;   // 2% liquidity discount on secondary sales
const PRIMARY_FEE   = 0.015;  // 1.5% entry fee
const SECONDARY_FEE = 0.005;  // 0.5% exit fee

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

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HoldingROIInput {
  farmId:          number;
  farmName:        string;
  cropType:        string;
  totalShares:     number;
  sharesAvailable: number;
  loanAmount:      number;    // K — capital raised
  sharePrice:      number;    // P₀ — primary issue price
  currentPrice:    number;    // market execution price today
  purchasePrice:   number;    // investor's actual buy-in price
  quantity:        number;    // shares held
  farmCreatedAt:   Date;
  rainfallFactor?: number;    // 0–1.3  from rainfall engine (default 1.0)
  marketImbalance?: number;   // demand multiplier 0.85–1.15 (default 1.0)
  /**
   * Sentiment factor derived from news-AI scores for this crop/region.
   * 0.85–1.15; neutral = 1.0.
   * Formula: 1 + 0.03 × ((positivePct − negativePct) / 100)
   */
  sentimentFactor?: number;
}

export interface ROIProjection {
  farmId:   number;
  farmName: string;
  cropType: string;

  costBasis: number;   // q × P₀ × 1.015

  fullSeason: {
    daysToHarvest:    number;
    projectedPayout:  number;   // q × D̂(t)
    roi:              number;   // decimal
    roiPercent:       number;
    annualizedRoi:    number;
    annualizedPercent: number;
  };

  midSeason: {
    daysHeld:         number;
    pSell:            number;   // AI secondary price at day t
    saleProceeds:     number;   // q × P_sell × (1 − 0.005)
    roi:              number;
    roiPercent:       number;
    annualizedRoi:    number;
    annualizedPercent: number;
  };

  recommendation:      "hold" | "sell" | "neutral";
  recommendationLabel: string;

  rainfallFactor:  number;
  sentimentFactor: number;
  riskDiscount:    number;   // λ
  riskScore:       number;   // S 1–10
}

// ─── Core computation ─────────────────────────────────────────────────────────
export function computeROI(input: HoldingROIInput): ROIProjection {
  const {
    farmId, farmName, cropType,
    totalShares: N,
    sharesAvailable,
    purchasePrice,
    sharePrice: P0,
    quantity: q,
    farmCreatedAt,
    rainfallFactor  = 1.0,
    marketImbalance = 1.0,
    sentimentFactor = 1.0,
  } = input;

  void sharesAvailable; // not used in formula but kept for consumers

  const cropKey    = (cropType ?? "maize").toLowerCase().trim();
  const S_base     = CROP_RISK_S[cropKey]      ?? 5;
  const seasonDays = CROP_SEASON_DAYS[cropKey] ?? 90;

  const ageDays       = (Date.now() - farmCreatedAt.getTime()) / 86_400_000;
  const daysToHarvest = Math.max(7, seasonDays - ageDays);
  const daysHeld      = Math.max(1, ageDays);

  // ── Risk discount (λ) ───────────────────────────────────────────────────────
  // Use crop baseline S for the structural discount; rainfall already captured
  // in rainfallFactor — avoids double-counting.
  const lambda = ((10 - S_base) / 9) * P_MAX * LGD;

  // ── Baseline discount factor d_baseline ─────────────────────────────────────
  // d_baseline = (1 − λ) / (1 + rf)^(seasonDays/365)
  // This is the DCF factor at farm creation used by the primary pricing engine
  // to set α.  It ensures D̂_baseline × d_baseline = P₀.
  const d_baseline = (1 - lambda) / Math.pow(1 + RISK_FREE, seasonDays / 365);

  // ── Self-consistent D̂ per share ─────────────────────────────────────────────
  // D̂_baseline = P₀ / d_baseline  (guaranteed positive ROI at neutral conditions)
  // D̂(t) = D̂_baseline × rainfallFactor × sentimentFactor
  //   • rainfallFactor < 1 → drought reduces yield → can turn ROI negative (correct)
  //   • sentimentFactor   → news/AI nudges expected price/demand (±15% max)
  const D_hat_baseline = P0 / Math.max(d_baseline, 0.01);
  const D_hat = D_hat_baseline * rainfallFactor * Math.max(0.70, Math.min(1.30, sentimentFactor));

  // ── Cost basis ──────────────────────────────────────────────────────────────
  const costBasis = q * purchasePrice * (1 + PRIMARY_FEE);

  // ── Full-Season ROI ─────────────────────────────────────────────────────────
  // projectedPayout = q × D̂(t)
  // ROI_full = projectedPayout / costBasis − 1
  const projectedPayout = q * D_hat;
  const fullRoi         = projectedPayout / costBasis - 1;
  const fullAnn         = Math.pow(1 + fullRoi, 365 / Math.max(daysToHarvest, 1)) - 1;

  // ── Mid-Season P_sell (DCF secondary formula) ───────────────────────────────
  // P_sell(t) = (D̂(t) / timeDiscount(t)) × (1 − λ(t)) × imbalanceFactor × (1 − δ)
  //
  // timeDiscount(t) = (1 + rf)^(daysToHarvest/365)  [shrinks as harvest nears]
  // λ(t) = same structural lambda (rainfall already in D̂)
  //
  // At t=0: P_sell ≈ P₀ × 0.98 (2% liquidity drag — intentional)
  // At t=T: P_sell ≈ P₀ × (1+rf)^(T/365) × 0.98 (natural time appreciation)
  const timeDiscount    = Math.pow(1 + RISK_FREE, daysToHarvest / 365);
  const imbalanceFactor = Math.max(0.85, Math.min(1.15, marketImbalance));
  const P_sell          = (D_hat / timeDiscount) * (1 - lambda) * imbalanceFactor * (1 - LIQUIDITY_D);

  const saleProceeds = q * P_sell * (1 - SECONDARY_FEE);
  const midRoi       = saleProceeds / costBasis - 1;
  const midAnn       = Math.pow(1 + midRoi, 365 / Math.max(daysHeld, 1)) - 1;

  // ── Recommendation engine ───────────────────────────────────────────────────
  // "Consider Selling"  if ann mid-season > full + 10%
  // "Consider Holding"  if ann full       > mid  + 10%
  let recommendation: ROIProjection["recommendation"] = "neutral";
  let recommendationLabel = "Both strategies look similar — monitor the market";

  if (midAnn > fullAnn + 0.10) {
    recommendation      = "sell";
    recommendationLabel = `Mid-season annualised ROI is ${fmt(midAnn - fullAnn)} higher — consider selling`;
  } else if (fullAnn > midAnn + 0.10) {
    recommendation      = "hold";
    recommendationLabel = `Full-season annualised ROI is ${fmt(fullAnn - midAnn)} higher — consider holding`;
  }

  return {
    farmId,
    farmName,
    cropType,
    costBasis: round2(costBasis),
    fullSeason: {
      daysToHarvest:     Math.round(daysToHarvest),
      projectedPayout:   round2(projectedPayout),
      roi:               round4(fullRoi),
      roiPercent:        round2(fullRoi * 100),
      annualizedRoi:     round4(fullAnn),
      annualizedPercent: round2(fullAnn * 100),
    },
    midSeason: {
      daysHeld:          Math.round(daysHeld),
      pSell:             round2(P_sell),
      saleProceeds:      round2(saleProceeds),
      roi:               round4(midRoi),
      roiPercent:        round2(midRoi * 100),
      annualizedRoi:     round4(midAnn),
      annualizedPercent: round2(midAnn * 100),
    },
    recommendation,
    recommendationLabel,
    rainfallFactor:  Math.round(rainfallFactor * 1000) / 1000,
    sentimentFactor: Math.round(sentimentFactor * 1000) / 1000,
    riskDiscount:    round4(lambda),
    riskScore:       S_base,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function round2(n: number) { return Math.round(n * 100) / 100; }
function round4(n: number) { return Math.round(n * 10000) / 10000; }
function fmt(n: number)    { return `${(n * 100).toFixed(1)}%`; }
