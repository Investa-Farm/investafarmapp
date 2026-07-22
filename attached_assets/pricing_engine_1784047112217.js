/**
 * Investa Farm Pricing Engine v2
 * -------------------------------
 * Implements the primary and secondary market pricing formulas,
 * including the v2 risk-discount adjustments (farmer concentration,
 * regional correlation, input cost inflation, off-taker risk),
 * confidence-interval revenue forecasts, cold-start capping, and
 * explainability output for the risk score.
 *
 * Drop this into your Replit project (e.g. /server/pricingEngine.js)
 * and wire it up to your data layer (Neon/Postgres) where noted.
 */

// ---------------------------------------------------------------------------
// 1. Risk discount (lambda)
// ---------------------------------------------------------------------------

/**
 * @param {number} S - risk score, 1-10
 * @param {number} pMax - max discount rate (platform-configured)
 * @param {number} L - base liquidity/loss factor
 * @param {object} correlations - { farmer, region, input, offtake }, each 0-1
 * @param {number} uncertaintyRatio - (R_high - R_low) / R_expected
 * @returns {number} lambda - risk discount factor
 */
function computeLambda(S, pMax, L, correlations = {}, uncertaintyRatio = 0) {
  const { farmer = 0, region = 0, input = 0, offtake = 0 } = correlations;

  const baseLambda = ((10 - S) / 9) * pMax * L;
  const correlationMultiplier = 1 + farmer + region + input + offtake;
  const uncertaintyAdjustment = uncertaintyRatio * 0.1; // tunable weight

  return baseLambda * correlationMultiplier + uncertaintyAdjustment;
}

// ---------------------------------------------------------------------------
// 2. Revenue forecast as a range
// ---------------------------------------------------------------------------

/**
 * @param {number} low
 * @param {number} expected
 * @param {number} high
 */
function makeRevenueForecast(low, expected, high) {
  const uncertaintyRatio = expected > 0 ? (high - low) / expected : 0;
  return { low, expected, high, uncertaintyRatio };
}

// ---------------------------------------------------------------------------
// 3. Correlation / sub-risk terms (C_farmer, C_region, C_input, C_offtake)
// ---------------------------------------------------------------------------

/**
 * Farmer concentration risk. Pull farmer's other active farms and their
 * flags from your `farmer_risk_profile` table.
 * @param {object} farmerProfile - { activeFarms: number, flaggedFarms: number }
 */
function computeFarmerCorrelation(farmerProfile) {
  if (!farmerProfile || farmerProfile.activeFarms <= 1) return 0;
  const flagRatio = farmerProfile.flaggedFarms / farmerProfile.activeFarms;
  return Math.min(0.15, flagRatio * 0.15);
}

/**
 * Regional/crop correlation risk. Pull count of active farms sharing
 * region + crop from your `region_crop_exposure` table.
 * @param {number} sharedFarmCount - farms in same region+crop currently active
 * @param {number} threshold - count at which risk starts scaling (e.g. 5)
 */
function computeRegionCorrelation(sharedFarmCount, threshold = 5) {
  if (sharedFarmCount <= threshold) return 0;
  const excess = sharedFarmCount - threshold;
  return Math.min(0.2, excess * 0.02);
}

/**
 * Input cost inflation risk. Compare current agro-dealer price index
 * to the index at voucher issuance.
 * @param {number} priceIndexAtIssuance
 * @param {number} currentPriceIndex
 */
function computeInputCorrelation(priceIndexAtIssuance, currentPriceIndex) {
  if (!priceIndexAtIssuance) return 0;
  const pctIncrease =
    (currentPriceIndex - priceIndexAtIssuance) / priceIndexAtIssuance;
  return Math.max(0, Math.min(0.1, pctIncrease * 0.5));
}

/**
 * Off-taker / counterparty risk.
 * @param {boolean} hasConfirmedOfftake
 */
function computeOfftakeCorrelation(hasConfirmedOfftake) {
  return hasConfirmedOfftake ? 0 : 0.15;
}

// ---------------------------------------------------------------------------
// 4. Voucher redemption -> mid-season risk score adjustment
// ---------------------------------------------------------------------------

/**
 * @param {number} daysLate - days past the redemption checkpoint (0 if on time)
 * @param {number} pctRedeemed - 0-1, fraction of voucher value redeemed
 * @returns {number} redemptionScore - 0 (bad) to 1 (good)
 */
function computeRedemptionScore(daysLate, pctRedeemed) {
  const latenessPenalty = Math.min(1, daysLate / 30); // fully penalized at 30+ days late
  const completenessPenalty = 1 - pctRedeemed;
  const rawScore = 1 - (latenessPenalty * 0.5 + completenessPenalty * 0.5);
  return Math.max(0, Math.min(1, rawScore));
}

// ---------------------------------------------------------------------------
// 5. Cold-start capping
// ---------------------------------------------------------------------------

/**
 * @param {number} computedS - risk score from the model
 * @param {number} farmerHarvestCount - completed harvests for this farmer
 * @param {number} cap - max score allowed for cold-start farmers
 */
function applyColdStartCap(computedS, farmerHarvestCount, cap = 7) {
  if (farmerHarvestCount === 0) {
    return Math.min(computedS, cap);
  }
  return computedS;
}

// ---------------------------------------------------------------------------
// 6. Human review trigger
// ---------------------------------------------------------------------------

/**
 * @returns {{ flagged: boolean, reasons: string[] }}
 */
function checkHumanReviewTrigger({
  S,
  uncertaintyRatio,
  offtakeCorrelation,
  farmerHarvestCount,
  requestedCapital,
  coldStartCapitalThreshold = 5000,
}) {
  const reasons = [];

  if (S <= 3) reasons.push("risk_score_below_threshold");
  if (uncertaintyRatio > 0.5) reasons.push("revenue_forecast_too_wide");
  if (offtakeCorrelation >= 0.15) reasons.push("no_confirmed_offtake");
  if (farmerHarvestCount === 0 && requestedCapital > coldStartCapitalThreshold) {
    reasons.push("cold_start_high_capital_request");
  }

  return { flagged: reasons.length > 0, reasons };
}

// ---------------------------------------------------------------------------
// 7. Primary market price (P0)
// ---------------------------------------------------------------------------

/**
 * @param {object} params
 * @param {number} params.alpha - investor revenue share (0.10-0.30)
 * @param {number} params.revenueForecast.expected
 * @param {number} params.N - total shares issued
 * @param {number} params.rf - risk-free rate
 * @param {number} params.T - days to harvest
 * @param {number} params.lambda - risk discount
 */
function computePrimaryPrice({ alpha, revenueForecast, N, rf, T, lambda }) {
  const discountFactor = Math.pow(1 + rf, T / 365);
  const base = (alpha * revenueForecast.expected) / (N * discountFactor);
  return base * (1 - lambda);
}

// ---------------------------------------------------------------------------
// 8. Secondary market fair value (P_sell(t))
// ---------------------------------------------------------------------------

/**
 * @param {object} params
 * @param {number} params.alpha
 * @param {object} params.revenueForecastAtT - { expected }, updated forecast
 * @param {number} params.N
 * @param {number} params.rf
 * @param {number} params.daysRemaining - (T - t)
 * @param {number} params.lambdaAtT
 * @param {number} params.beta - demand-supply sensitivity (default 0.2)
 * @param {number} params.imbalance - (bidVolume - askVolume) / N
 * @param {number} params.delta - liquidity discount (default 0.02)
 */
function computeFairValue({
  alpha,
  revenueForecastAtT,
  N,
  rf,
  daysRemaining,
  lambdaAtT,
  beta = 0.2,
  imbalance,
  delta = 0.02,
}) {
  const discountFactor = Math.pow(1 + rf, daysRemaining / 365);
  const base = (alpha * revenueForecastAtT.expected) / (N * discountFactor);
  return base * (1 - lambdaAtT) * (1 + beta * imbalance) * (1 - delta);
}

// ---------------------------------------------------------------------------
// 9. End-to-end example: computing a farm's current risk score + price
// ---------------------------------------------------------------------------

/**
 * Orchestrates all the above into one call. In production, the *_profile
 * and *_index inputs would come from your Postgres tables; this function
 * just shows how they compose.
 */
function computeFarmPricing({
  baseS,                  // raw score from the ML model, 1-10
  pMax,
  L,
  farmerProfile,          // { activeFarms, flaggedFarms, harvestCount }
  sharedFarmCount,        // for region correlation
  priceIndexAtIssuance,
  currentPriceIndex,
  hasConfirmedOfftake,
  revenueForecast,        // { low, expected, high, uncertaintyRatio }
  alpha,
  N,
  rf,
  T,
  daysRemaining,
  imbalance,
  requestedCapital,
}) {
  const cFarmer = computeFarmerCorrelation(farmerProfile);
  const cRegion = computeRegionCorrelation(sharedFarmCount);
  const cInput = computeInputCorrelation(priceIndexAtIssuance, currentPriceIndex);
  const cOfftake = computeOfftakeCorrelation(hasConfirmedOfftake);

  const S = applyColdStartCap(baseS, farmerProfile.harvestCount);

  const lambda = computeLambda(
    S,
    pMax,
    L,
    { farmer: cFarmer, region: cRegion, input: cInput, offtake: cOfftake },
    revenueForecast.uncertaintyRatio
  );

  const primaryPrice = computePrimaryPrice({
    alpha,
    revenueForecast,
    N,
    rf,
    T,
    lambda,
  });

  const fairValue = computeFairValue({
    alpha,
    revenueForecastAtT: revenueForecast,
    N,
    rf,
    daysRemaining,
    lambdaAtT: lambda,
    imbalance,
  });

  const reviewCheck = checkHumanReviewTrigger({
    S,
    uncertaintyRatio: revenueForecast.uncertaintyRatio,
    offtakeCorrelation: cOfftake,
    farmerHarvestCount: farmerProfile.harvestCount,
    requestedCapital,
  });

  return {
    S,
    lambda,
    primaryPrice,
    fairValue,
    correlations: { cFarmer, cRegion, cInput, cOfftake },
    humanReview: reviewCheck,
  };
}

module.exports = {
  computeLambda,
  makeRevenueForecast,
  computeFarmerCorrelation,
  computeRegionCorrelation,
  computeInputCorrelation,
  computeOfftakeCorrelation,
  computeRedemptionScore,
  applyColdStartCap,
  checkHumanReviewTrigger,
  computePrimaryPrice,
  computeFairValue,
  computeFarmPricing,
};
