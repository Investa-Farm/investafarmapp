/**
 * Investa Farm Pricing Engine v2 — risk-discount aggregation, confidence-interval
 * revenue forecasts, cold-start capping, and governance checks.
 *
 * Ported from the v2 spec (attached_assets/pricing-engine-v2-spec*.md) into the
 * TypeScript codebase. Pure functions only — no DB/IO here, so they're trivial
 * to unit test and reuse from both the pricing route and farm-creation flows.
 *
 * λ = ((10 − S) / 9) × p_max × L × (1 + C_farmer + C_region + C_input + C_offtake)
 *     + uncertaintyRatio × 0.1
 *
 * The four correlation terms default to 0 (spec: "optional at launch") until
 * their backing tables (farmer_risk_profile, region_crop_exposure,
 * input_price_index) are built — see replit.md follow-ups.
 */

// ─── 1. Risk discount (lambda) ────────────────────────────────────────────────

export interface RiskCorrelations {
  farmer?: number;   // C_farmer  0–0.15
  region?: number;   // C_region  0–0.20
  input?: number;    // C_input   0–0.10
  offtake?: number;  // C_offtake 0–0.15
}

export function computeLambdaV2(
  S: number,
  pMax: number,
  L: number,
  correlations: RiskCorrelations = {},
  uncertaintyRatio = 0,
): number {
  const { farmer = 0, region = 0, input = 0, offtake = 0 } = correlations;
  const baseLambda = ((10 - S) / 9) * pMax * L;
  const correlationMultiplier = 1 + farmer + region + input + offtake;
  const uncertaintyAdjustment = uncertaintyRatio * 0.1; // tunable weight
  return baseLambda * correlationMultiplier + uncertaintyAdjustment;
}

// ─── 2. Revenue forecast as a range, not a point estimate ────────────────────

export interface RevenueForecast {
  low: number;
  expected: number;
  high: number;
  uncertaintyRatio: number;
}

export function makeRevenueForecast(low: number, expected: number, high: number): RevenueForecast {
  const uncertaintyRatio = expected > 0 ? (high - low) / expected : 0;
  return { low, expected, high, uncertaintyRatio };
}

/**
 * Derive a low/high band around a point forecast when no dedicated
 * forecasting model exists yet. Wider band for higher weather/NDVI
 * uncertainty — this is the MVP stand-in the spec calls for in §2/§10 item 1.
 */
export function estimateRevenueForecast(
  expected: number,
  weatherRisk = 0.30,
  ndviVolatility = 0.10,
): RevenueForecast {
  // 8%–30% half-width band scaled by weather risk + NDVI volatility, tuned so
  // typical-risk listings (weatherRisk≈0.3, ndviVolatility≈0.1) land around a
  // ~0.35 uncertainty ratio — comfortably below the 0.5 human-review threshold
  // — while genuinely volatile listings can still cross it.
  const halfWidthPct = Math.max(0.08, Math.min(0.30, 0.08 + weatherRisk * 0.20 + ndviVolatility * 0.50));
  const low = Math.max(0, expected * (1 - halfWidthPct));
  const high = expected * (1 + halfWidthPct);
  return makeRevenueForecast(low, expected, high);
}

// ─── 3. Correlation / sub-risk terms ──────────────────────────────────────────

export function computeFarmerCorrelation(farmerProfile?: { activeFarms: number; flaggedFarms: number }): number {
  if (!farmerProfile || farmerProfile.activeFarms <= 1) return 0;
  const flagRatio = farmerProfile.flaggedFarms / farmerProfile.activeFarms;
  return Math.min(0.15, flagRatio * 0.15);
}

export function computeRegionCorrelation(sharedFarmCount: number, threshold = 5): number {
  if (sharedFarmCount <= threshold) return 0;
  const excess = sharedFarmCount - threshold;
  return Math.min(0.2, excess * 0.02);
}

export function computeInputCorrelation(priceIndexAtIssuance?: number, currentPriceIndex?: number): number {
  if (!priceIndexAtIssuance || currentPriceIndex === undefined) return 0;
  const pctIncrease = (currentPriceIndex - priceIndexAtIssuance) / priceIndexAtIssuance;
  return Math.max(0, Math.min(0.1, pctIncrease * 0.5));
}

export function computeOfftakeCorrelation(hasConfirmedOfftake: boolean): number {
  return hasConfirmedOfftake ? 0 : 0.15;
}

// ─── 4. Voucher redemption → mid-season risk signal ──────────────────────────

export function computeRedemptionScore(daysLate: number, pctRedeemed: number): number {
  const latenessPenalty = Math.min(1, daysLate / 30);
  const completenessPenalty = 1 - pctRedeemed;
  const rawScore = 1 - (latenessPenalty * 0.5 + completenessPenalty * 0.5);
  return Math.max(0, Math.min(1, rawScore));
}

// ─── 5. Cold-start capping ────────────────────────────────────────────────────

export function applyColdStartCap(computedS: number, farmerHarvestCount: number, cap = 7): number {
  return farmerHarvestCount === 0 ? Math.min(computedS, cap) : computedS;
}

// ─── 6. Explainability ────────────────────────────────────────────────────────

export interface RiskFactor {
  factor: string;
  contribution: number; // signed; + increases score, − decreases it
  detail?: string;
}

// ─── 7. Human review trigger ──────────────────────────────────────────────────

export interface HumanReviewInput {
  S: number;
  uncertaintyRatio: number;
  offtakeCorrelation: number;
  farmerHarvestCount: number;
  requestedCapital: number;
  coldStartCapitalThreshold?: number;
}

export interface HumanReviewResult {
  flagged: boolean;
  reasons: string[];
}

export function checkHumanReviewTrigger({
  S,
  uncertaintyRatio,
  offtakeCorrelation,
  farmerHarvestCount,
  requestedCapital,
  coldStartCapitalThreshold = 5000,
}: HumanReviewInput): HumanReviewResult {
  const reasons: string[] = [];
  if (S <= 3) reasons.push("risk_score_below_threshold");
  if (uncertaintyRatio > 0.5) reasons.push("revenue_forecast_too_wide");
  if (offtakeCorrelation >= 0.15) reasons.push("no_confirmed_offtake");
  if (farmerHarvestCount === 0 && requestedCapital > coldStartCapitalThreshold) {
    reasons.push("cold_start_high_capital_request");
  }
  return { flagged: reasons.length > 0, reasons };
}

export const HUMAN_REVIEW_REASON_LABELS: Record<string, string> = {
  risk_score_below_threshold: "Risk score is very low (S ≤ 3)",
  revenue_forecast_too_wide: "Revenue forecast range is unusually wide",
  no_confirmed_offtake: "No confirmed buyer for the harvest",
  cold_start_high_capital_request: "First-time farmer requesting capital above the cold-start threshold",
};
