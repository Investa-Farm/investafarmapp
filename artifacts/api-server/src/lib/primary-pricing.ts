/**
 * AI Primary Pricing Engine — Investa Farm
 *
 * For each new farm listing, computes:
 *   R̂   = forecast harvest revenue (USD)
 *   S    = risk score (1–10, 10 = lowest risk)
 *   α    = investor revenue share (10%–30%)
 *   β    = farmer revenue share (45%–65%)
 *   γ    = platform share (≥5%)
 *   P₀   = primary share price
 *   N    = total shares issued
 *
 * Consistency equation:
 *   K = α × R̂ × d      where d = (1 – λ) / (1 + rf)^(T/365)
 *   λ = ((10–S)/9) × P_max × L
 */

import { computeRainfallFactor } from "./rainfall";
import {
  computeLambdaV2,
  estimateRevenueForecast,
  applyColdStartCap,
  checkHumanReviewTrigger,
  computeOfftakeCorrelation,
  type RevenueForecast,
  type RiskFactor,
} from "./pricing-v2";
import { computeRiskScoreWithExplainability, fallbackFactors } from "./risk-score-ai";

// ─── Engine Constants ─────────────────────────────────────────────────────────
const P_MAX    = 0.40;   // max loss probability (S = 1)
const LGD      = 0.80;   // loss given default fraction
const RF       = 0.10;   // Kenya risk-free rate (annual)
const ALPHA_MIN = 0.10;  // min investor share
const ALPHA_MAX = 0.30;  // max investor share
const BETA_MIN  = 0.45;  // min farmer share
const BETA_MAX  = 0.65;  // max farmer share
const GAMMA_MIN = 0.05;  // min platform share

// ─── Crop base yields (kg/ha) — MVP heuristics ───────────────────────────────
const CROP_BASE_YIELD_KG_HA: Record<string, number> = {
  maize: 2000, beans: 1200, cassava: 8000, rice: 2500, wheat: 2000,
  sunflower: 1200, sorghum: 1500, tea: 3000, potatoes: 15000, onions: 18000,
  tomatoes: 20000, horticulture: 12000, avocado: 5000, coffee: 800, tobacco: 1500,
};

// ─── Commodity prices (USD/kg) at harvest — MVP heuristics ───────────────────
const CROP_PRICE_USD_KG: Record<string, number> = {
  maize: 0.30, beans: 0.50, cassava: 0.12, rice: 0.60, wheat: 0.35,
  sunflower: 0.55, sorghum: 0.28, tea: 2.20, potatoes: 0.25, onions: 0.30,
  tomatoes: 0.40, horticulture: 0.50, avocado: 1.20, coffee: 3.00, tobacco: 2.50,
};

// ─── Quality factor (post-harvest losses & grading) ──────────────────────────
const CROP_QUALITY_FACTOR: Record<string, number> = {
  coffee: 0.90, tea: 0.92, avocado: 0.88, tomatoes: 0.80, horticulture: 0.82,
  potatoes: 0.85, onions: 0.85, maize: 0.90, beans: 0.92, rice: 0.88,
};
const DEFAULT_QUALITY = 0.88;

// ─── Season days per crop ─────────────────────────────────────────────────────
const CROP_SEASON_DAYS: Record<string, number> = {
  coffee: 180, avocado: 150, rice: 120, wheat: 90, maize: 90,
  tea: 90, sunflower: 90, potatoes: 90, tomatoes: 60, beans: 60,
  onions: 75, cassava: 270, tobacco: 120, sorghum: 90,
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PrimaryPricingInput {
  capitalNeededKes: number;         // K: total capital the farmer needs (KES)
  crop: string;
  landSizeHa: number;
  plantingDate: Date;
  harvestDate?: Date;               // optional; defaults to planting + season days
  farmerExperienceYears: number;
  ndviHistory?: number[];           // weekly NDVI readings (0–1)
  weatherRisk?: number;             // 0–1, higher = worse
  ndviVolatility?: number;          // std dev of NDVI history
  rainfallMm?: number;              // seasonal total mm (if known)
  desiredFarmerShare?: number;      // β, default 0.55
  riskFreeRate?: number;            // default 0.10
  location?: string;                // for rainfall lookup fallback label
  // v2 inputs (all optional — omit to get v1 behavior unchanged)
  farmerHarvestCount?: number;      // completed harvests for this farmer; 0 = cold start
  hasConfirmedOfftake?: boolean;    // confirmed buyer for the harvest
  requestedCapitalKes?: number;     // defaults to capitalNeededKes if omitted
  riskScoreOverride?: number;       // used internally by computePrimaryPricingV2 after Groq scoring
}

export interface PrimaryPricingResult {
  status: "viable" | "not_viable";
  reason?: string;

  // Core outputs
  forecastRevenueKes: number;       // R̂ in KES
  riskScore: number;                // S 1–10
  alpha: number;                    // investor revenue share (fraction)
  alphaPercent: number;
  beta: number;                     // farmer revenue share (fraction)
  betaPercent: number;
  gamma: number;                    // platform share (fraction)
  gammaPercent: number;

  // Share structure
  totalShares: number;              // N
  sharePriceKes: number;            // P₀
  capitalRaisedKes: number;         // actual K achievable

  // Risk components
  riskDiscount: number;             // λ
  discountFactor: number;           // d
  alphaRequired: number;            // α_req (before clamping)

  // Revenue components
  yieldKgHa: number;
  totalYieldKg: number;
  pricePerKgKes: number;
  rainfallFactor: number;
  qualityFactor: number;

  // Metadata
  seasonDays: number;
  warnings: string[];

  // v2 additions (populated even in v1 sync calls; topFactors/riskScoreSource
  // are only meaningful after computePrimaryPricingV2 runs the Groq step)
  revenueForecast: RevenueForecast;
  riskScoreSource: "groq" | "fallback";
  topFactors: RiskFactor[];
  coldStart: boolean;
  humanReview: { flagged: boolean; reasons: string[] };
}

// ─── Step 1: Yield Prediction (MVP heuristic) ─────────────────────────────────
function predictYield(
  crop: string,
  ndviHistory: number[],
  farmerExperienceYears: number,
  rainfallFactor: number,
): number {
  const base = CROP_BASE_YIELD_KG_HA[crop] ?? 1500;
  const ndviAvg = ndviHistory.length > 0
    ? ndviHistory.reduce((s, v) => s + v, 0) / ndviHistory.length
    : 0.70;

  // NDVI adjustment (0.5 + 0.5×NDVI maps 0→0.5, 1→1.0)
  const ndviFactor = 0.5 + 0.5 * ndviAvg;

  // Experience bump: +1% per year, capped at +15%
  const expFactor = 1 + Math.min(0.15, farmerExperienceYears * 0.01);

  return base * ndviFactor * expFactor * rainfallFactor;
}

// ─── Step 2: Price Prediction (MVP heuristic) ─────────────────────────────────
// Prices stored in USD/kg; convert to KES using approximate rate
const USD_TO_KES = 130; // 1 USD ≈ 130 KES (adjust via env in production)

function predictPriceKes(crop: string): number {
  const usdPerKg = CROP_PRICE_USD_KG[crop] ?? 0.30;
  return usdPerKg * USD_TO_KES;
}

// ─── Step 3: Risk Score Computation ──────────────────────────────────────────
export function computeRiskScore(
  crop: string,
  farmerExperienceYears: number,
  weatherRisk: number,
  ndviVolatility: number,
  rainfallFactor: number,
): number {
  // Crop baseline (same as scheduler CROP_RISK_S)
  const CROP_RISK_BASE: Record<string, number> = {
    maize: 8, beans: 8, cassava: 8, rice: 7, wheat: 7, sunflower: 7, sorghum: 7,
    tea: 7, potatoes: 6, onions: 6, tomatoes: 5, horticulture: 5,
    avocado: 4, coffee: 3, tobacco: 2,
  };

  let score = CROP_RISK_BASE[crop] ?? 5;

  // Farmer experience: +1 if >5 yrs, +2 if >10 yrs
  if (farmerExperienceYears > 10) score += 2;
  else if (farmerExperienceYears > 5) score += 1;

  // Weather risk penalty (0–1 scale → 0–3 points)
  score -= Math.round(weatherRisk * 3);

  // NDVI stability: low volatility = lower risk
  if (ndviVolatility < 0.08) score += 1;
  else if (ndviVolatility > 0.20) score -= 1;

  // Rainfall factor (0–1 → up to –4 pts for drought/flood)
  if (rainfallFactor < 0.40) score -= 4;
  else if (rainfallFactor < 0.65) score -= 3;
  else if (rainfallFactor < 0.80) score -= 2;
  else if (rainfallFactor < 0.90) score -= 1;

  return Math.max(1, Math.min(10, score));
}

// ─── Main Pricing Engine ──────────────────────────────────────────────────────
export function computePrimaryPricing(input: PrimaryPricingInput): PrimaryPricingResult {
  const {
    capitalNeededKes: K,
    landSizeHa,
    farmerExperienceYears,
    ndviHistory = [],
    weatherRisk = 0.30,
    ndviVolatility = 0.10,
    rainfallMm,
    desiredFarmerShare: betaInput,
    riskFreeRate = RF,
  } = input;

  const crop = (input.crop ?? "maize").toLowerCase().trim();
  const warnings: string[] = [];
  const beta = Math.max(BETA_MIN, Math.min(BETA_MAX, betaInput ?? 0.55));

  // Season duration
  const seasonDays = input.harvestDate && input.plantingDate
    ? Math.max(30, (input.harvestDate.getTime() - input.plantingDate.getTime()) / 86_400_000)
    : (CROP_SEASON_DAYS[crop] ?? 90);

  // ── Rainfall factor ───────────────────────────────────────────────────────
  let rainfallFactor = 1.0;
  if (rainfallMm !== undefined) {
    const rf = computeRainfallFactor(crop, rainfallMm);
    rainfallFactor = rf.factor;
    if (rf.riskLevel === "drought") warnings.push(`Drought conditions detected: ${rf.riskLabel}`);
    if (rf.riskLevel === "excess")  warnings.push(`Excess rainfall detected: ${rf.riskLabel}`);
  }

  // ── Step 1: Yield & revenue ───────────────────────────────────────────────
  const yieldKgHa     = predictYield(crop, ndviHistory, farmerExperienceYears, rainfallFactor);
  const totalYieldKg  = yieldKgHa * landSizeHa;
  const pricePerKgKes = predictPriceKes(crop);
  const qualityFactor = CROP_QUALITY_FACTOR[crop] ?? DEFAULT_QUALITY;
  const R_hat         = totalYieldKg * pricePerKgKes * qualityFactor;

  if (R_hat < K * 0.5) {
    warnings.push(`Forecast revenue (KES ${Math.round(R_hat).toLocaleString()}) is less than 50% of capital needed — consider reducing ask`);
  }

  // ── Step 2: Risk score (v2: cold-start capping + Groq override support) ──
  const farmerHarvestCount = input.farmerHarvestCount ?? 1; // default = not cold-start, keeps v1 behavior
  const coldStart = farmerHarvestCount === 0;
  const rawS = input.riskScoreOverride ?? computeRiskScore(crop, farmerExperienceYears, weatherRisk, ndviVolatility, rainfallFactor);
  const S = applyColdStartCap(rawS, farmerHarvestCount);
  if (coldStart && rawS > 7) warnings.push("First-time farmer: risk score capped at 7/10 until a harvest is completed");

  // ── v2: revenue forecast as a confidence-interval range, not a point ─────
  const revenueForecast = estimateRevenueForecast(R_hat, weatherRisk, ndviVolatility);

  // ── Step 3: Risk discount & discount factor (v2 lambda formula) ──────────
  const offtakeCorrelation = computeOfftakeCorrelation(input.hasConfirmedOfftake ?? false);
  const lambda          = computeLambdaV2(S, P_MAX, LGD, { offtake: offtakeCorrelation }, revenueForecast.uncertaintyRatio);
  const timeFactor      = Math.pow(1 + riskFreeRate, seasonDays / 365);
  const d               = (1 - lambda) / timeFactor;

  const humanReview = checkHumanReviewTrigger({
    S,
    uncertaintyRatio: revenueForecast.uncertaintyRatio,
    offtakeCorrelation,
    farmerHarvestCount,
    requestedCapital: input.requestedCapitalKes ?? K,
  });
  if (humanReview.flagged) warnings.push(`Flagged for human review: ${humanReview.reasons.join(", ")}`);

  // ── Step 4: Required alpha ────────────────────────────────────────────────
  const RHat_d    = R_hat * d;
  const alphaReq  = RHat_d > 0 ? K / RHat_d : ALPHA_MAX + 1;

  // ── Step 5: Viability check & clamp ──────────────────────────────────────
  let alpha: number;
  let capitalRaised: number;

  if (alphaReq < ALPHA_MIN) {
    alpha = ALPHA_MIN;
    capitalRaised = alpha * RHat_d;
    warnings.push(`Farm is highly profitable — α set to minimum 10% (oversubscription possible)`);
  } else if (alphaReq > ALPHA_MAX) {
    alpha = ALPHA_MAX;
    capitalRaised = alpha * RHat_d;
    if (capitalRaised < K * 0.80) {
      return {
        status: "not_viable",
        reason: `At maximum α=30%, only KES ${Math.round(capitalRaised).toLocaleString()} can be raised vs KES ${Math.round(K).toLocaleString()} needed. ` +
                `Suggest: reduce capital ask, increase farmer share β, or improve risk score (current S=${S}/10).`,
        forecastRevenueKes: Math.round(R_hat),
        riskScore: S,
        alpha: ALPHA_MAX, alphaPercent: ALPHA_MAX * 100,
        beta, betaPercent: beta * 100,
        gamma: 0, gammaPercent: 0,
        totalShares: 0, sharePriceKes: 0, capitalRaisedKes: Math.round(capitalRaised),
        riskDiscount: Math.round(lambda * 10000) / 10000,
        discountFactor: Math.round(d * 10000) / 10000,
        alphaRequired: Math.round(alphaReq * 10000) / 10000,
        yieldKgHa: Math.round(yieldKgHa), totalYieldKg: Math.round(totalYieldKg),
        pricePerKgKes: Math.round(pricePerKgKes * 100) / 100,
        rainfallFactor, qualityFactor, seasonDays: Math.round(seasonDays),
        warnings,
        revenueForecast, riskScoreSource: "fallback", topFactors: [], coldStart, humanReview,
      };
    }
    warnings.push(`Capital needed exceeds optimal — only KES ${Math.round(capitalRaised).toLocaleString()} achievable at α=30%`);
  } else {
    alpha = alphaReq;
    capitalRaised = K;
  }

  // ── Step 6: Platform share ────────────────────────────────────────────────
  let gamma = 1 - alpha - beta;
  let finalBeta = beta;

  if (gamma < GAMMA_MIN) {
    gamma = GAMMA_MIN;
    finalBeta = 1 - alpha - gamma;
    if (finalBeta < BETA_MIN) {
      return {
        status: "not_viable",
        reason: `Cannot satisfy minimum platform share (5%) and minimum farmer share (45%) simultaneously at α=${(alpha * 100).toFixed(1)}%.`,
        forecastRevenueKes: Math.round(R_hat),
        riskScore: S,
        alpha: Math.round(alpha * 10000) / 10000, alphaPercent: Math.round(alpha * 1000) / 10,
        beta: finalBeta, betaPercent: Math.round(finalBeta * 1000) / 10,
        gamma, gammaPercent: gamma * 100,
        totalShares: 0, sharePriceKes: 0, capitalRaisedKes: Math.round(capitalRaised),
        riskDiscount: Math.round(lambda * 10000) / 10000,
        discountFactor: Math.round(d * 10000) / 10000,
        alphaRequired: Math.round(alphaReq * 10000) / 10000,
        yieldKgHa: Math.round(yieldKgHa), totalYieldKg: Math.round(totalYieldKg),
        pricePerKgKes: Math.round(pricePerKgKes * 100) / 100,
        rainfallFactor, qualityFactor, seasonDays: Math.round(seasonDays),
        warnings,
        revenueForecast, riskScoreSource: "fallback", topFactors: [], coldStart, humanReview,
      };
    }
    warnings.push(`Farmer share reduced to ${(finalBeta * 100).toFixed(1)}% to maintain platform minimum of 5%`);
  }

  // ── Step 7: Share structure ───────────────────────────────────────────────
  // Choose a round P₀ based on capital raised
  let targetPrice: number;
  if (capitalRaised >= 1_000_000) targetPrice = 1000;
  else if (capitalRaised >= 500_000) targetPrice = 500;
  else if (capitalRaised >= 100_000) targetPrice = 100;
  else if (capitalRaised >= 50_000) targetPrice = 50;
  else if (capitalRaised >= 10_000) targetPrice = 10;
  else targetPrice = 5;

  const N  = Math.max(100, Math.floor(capitalRaised / targetPrice));
  const P0 = capitalRaised / N;

  return {
    status: "viable",
    forecastRevenueKes: Math.round(R_hat),
    riskScore: S,
    alpha: Math.round(alpha * 10000) / 10000,
    alphaPercent: Math.round(alpha * 10000) / 100,
    beta: Math.round(finalBeta * 10000) / 10000,
    betaPercent: Math.round(finalBeta * 10000) / 100,
    gamma: Math.round(gamma * 10000) / 10000,
    gammaPercent: Math.round(gamma * 10000) / 100,
    totalShares: N,
    sharePriceKes: Math.round(P0 * 100) / 100,
    capitalRaisedKes: Math.round(capitalRaised),
    riskDiscount: Math.round(lambda * 10000) / 10000,
    discountFactor: Math.round(d * 10000) / 10000,
    alphaRequired: Math.round(alphaReq * 10000) / 10000,
    yieldKgHa: Math.round(yieldKgHa),
    totalYieldKg: Math.round(totalYieldKg),
    pricePerKgKes: Math.round(pricePerKgKes * 100) / 100,
    rainfallFactor,
    qualityFactor,
    seasonDays: Math.round(seasonDays),
    warnings,
    revenueForecast, riskScoreSource: "fallback", topFactors: [], coldStart, humanReview,
  };
}

/**
 * v2 entry point: runs the deterministic engine once to get an anchor S and
 * rainfall factor, asks Groq to score + explain (falling back to the
 * deterministic S if Groq is unavailable), then re-runs the deterministic
 * engine with that final S so every downstream number (λ, α, N, P₀) is
 * consistent with the reported risk score.
 */
export async function computePrimaryPricingV2(input: PrimaryPricingInput): Promise<PrimaryPricingResult> {
  const baseline = computePrimaryPricing(input);

  const crop = (input.crop ?? "maize").toLowerCase().trim();
  const ndviHistory = input.ndviHistory ?? [];
  const ndviAverage = ndviHistory.length > 0 ? ndviHistory.reduce((s, v) => s + v, 0) / ndviHistory.length : undefined;

  const riskInput = {
    crop,
    location: input.location ?? "Kenya",
    farmerExperienceYears: input.farmerExperienceYears,
    farmerHarvestCount: input.farmerHarvestCount ?? 0,
    weatherRisk: input.weatherRisk ?? 0.30,
    ndviVolatility: input.ndviVolatility ?? 0.10,
    ndviAverage,
    rainfallFactor: baseline.rainfallFactor,
    hasConfirmedOfftake: input.hasConfirmedOfftake ?? false,
    requestedCapitalKes: input.requestedCapitalKes ?? input.capitalNeededKes,
    fallbackScore: baseline.riskScore,
  };

  // Not viable: skip the Groq round-trip (nothing downstream needs a refined
  // score), but still surface deterministic factors so the farmer/investor
  // can see *why* it was flagged.
  if (baseline.status === "not_viable") {
    return { ...baseline, topFactors: fallbackFactors(riskInput), riskScoreSource: "fallback" };
  }

  const { score, topFactors, source } = await computeRiskScoreWithExplainability(riskInput);

  const final = computePrimaryPricing({ ...input, riskScoreOverride: score });
  return { ...final, topFactors, riskScoreSource: source };
}

// ─── Stress Test Scenarios ────────────────────────────────────────────────────
export type StressScenario = "drought" | "price_crash" | "pest_outbreak";

export interface StressTestResult {
  scenario: StressScenario;
  label: string;
  revenueImpactPct: number;
  adjustedRevenueKes: number;
  adjustedAlpha: number;
  adjustedRoi: number;
  viable: boolean;
}

export function runStressTest(
  base: PrimaryPricingResult,
  scenario: StressScenario,
): StressTestResult {
  const scenarios: Record<StressScenario, { label: string; revMult: number; yieldMult: number }> = {
    drought:       { label: "Severe Drought",   revMult: 0.50, yieldMult: 0.50 },
    price_crash:   { label: "Commodity Price Crash (-30%)", revMult: 0.70, yieldMult: 1.00 },
    pest_outbreak: { label: "Pest/Disease Outbreak",        revMult: 0.60, yieldMult: 0.60 },
  };

  const s = scenarios[scenario];
  const adjustedRevenue  = base.forecastRevenueKes * s.revMult;
  const revenueImpactPct = Math.round((s.revMult - 1) * 100);

  // Recalculate what investor actually receives under this scenario
  const investorPayout = adjustedRevenue * base.alpha;
  const costBasis      = base.capitalRaisedKes;
  const adjustedRoi    = costBasis > 0 ? (investorPayout - costBasis) / costBasis : -1;

  return {
    scenario,
    label: s.label,
    revenueImpactPct,
    adjustedRevenueKes: Math.round(adjustedRevenue),
    adjustedAlpha: base.alpha,
    adjustedRoi: Math.round(adjustedRoi * 10000) / 10000,
    viable: investorPayout > costBasis * 0.5,
  };
}
