# Investa Farm Pricing Engine v2 — Updated Spec

This extends the original pricing model with the risk factors, data sources, and governance checks discussed. It's meant to be dropped into Replit alongside the implementation file (`pricing_engine.js`).

---

## 1. Updated Risk Discount (λ)

**Original:**

λ = ((10 − S) / 9) × p_max × L

**v2 — λ now aggregates multiple sub-risks instead of one score:**

λ = ((10 − S) / 9) × p_max × L × (1 + C_farmer + C_region + C_input + C_offtake)

Where the new correlation/risk adjustments are:

| Term | Meaning | Range | Source |
|---|---|---|---|
| `C_farmer` | Farmer concentration risk — extra weight if this farmer has other active listings with issues | 0–0.15 | Farmer-level risk profile (new table) |
| `C_region` | Regional/crop correlation risk — extra weight if many active farms share region + crop | 0–0.20 | Portfolio correlation check (new service) |
| `C_input` | Input cost inflation risk — extra weight if fertilizer/seed price index has spiked since voucher issuance | 0–0.10 | Agro-dealer price feed |
| `C_offtake` | Counterparty risk — extra weight if no confirmed off-taker/buyer for the harvest | 0–0.15 | Off-taker confirmation field on farm application |

All four are optional at launch (default 0) — add them incrementally as data sources come online.

---

## 2. Revenue Forecast as a Range, Not a Point Estimate

**Original:** R̂ is a single number.

**v2:** R̂ becomes a triple: `{ low, expected, high }` representing a confidence interval (e.g., 80% CI from the forecasting model). The pricing formula still uses `R̂.expected`, but:

- λ is derived partly from interval width: wider interval → higher λ (more uncertainty = more discount).
- The farm detail page shows the range, not just one number, to investors.

```
uncertainty_ratio = (R_high - R_low) / R_expected
lambda_uncertainty_adjustment = uncertainty_ratio * 0.1  // tunable weight
```

---

## 3. New Mid-Season Signal: Voucher Redemption Tracking

Since capital is disbursed as vouchers, redemption behavior is a free, high-signal data source:

- Track redemption timing (on-schedule vs. late) and completeness (full vs. partial redemption) per farm.
- If a farmer redeems late or only partially by a checkpoint date, flag the farm and increase λ via a new term or feed it into `C_farmer`.

```
redemption_score = f(days_late, pct_redeemed)  // 0 (bad) to 1 (good)
```

This becomes a mid-season update to S (risk score), not just a one-time input at application.

---

## 4. Model Calibration Loop

After every harvest, log:

```
{
  farm_id,
  R_hat_expected,
  R_hat_low,
  R_hat_high,
  R_actual,
  S_at_listing,
  S_at_harvest
}
```

Run a scheduled job (weekly/monthly) that computes forecast error (R_actual vs R_hat_expected) across recent harvests and flags if the model is systematically over- or under-forecasting. This isn't a pricing formula change — it's an ops requirement: **build this table and job now**, even before you have enough harvests to retrain on.

---

## 5. Cold-Start Risk Scoring Path

For farmers with no prior harvest history:

- Weight satellite/land data (NDVI baseline, plot size, soil data if available) more heavily.
- Weight community engagement and off-taker confirmation more heavily.
- Cap the maximum risk score achievable (e.g., S ≤ 7) until at least one completed harvest exists, regardless of how good the other inputs look.

```
if (farmer_harvest_count == 0) {
  S = min(computed_S, 7)
}
```

---

## 6. Explainability Requirement

Whatever model computes S must support per-prediction feature attribution (e.g., SHAP for gradient-boosted trees). Store the top 3–5 contributing factors alongside each score:

```
{
  score: 7,
  top_factors: [
    { factor: "ndvi_trend", contribution: +1.2 },
    { factor: "farmer_harvest_count", contribution: -0.8 },
    { factor: "region_rainfall_forecast", contribution: +0.5 }
  ]
}
```

This is what gets shown to the farmer as "factors affecting your score."

---

## 7. Human Review Trigger

Auto-flag for manual underwriting review (don't auto-approve/auto-list) if any of:

- `S <= 3`
- `uncertainty_ratio > 0.5` (R̂ range is very wide relative to expected value)
- `C_offtake` is at max (no confirmed buyer)
- Farmer is new (cold start) **and** requesting capital above a threshold (e.g., $5,000)

---

## 8. Updated Secondary Market Formula (P_sell)

No structural change to the formula itself — λ(t) simply now inherits all the v2 adjustments above, since λ(t) is computed the same way as λ at listing, just recalculated with current data:

P_sell(t) = [α·R̂(t).expected / (N·(1 + r_f)^((T−t)/365))] × (1 − λ(t)) × (1 + β·imbalance) × (1 − δ)

---

## 9. New Data Tables Needed

| Table | Purpose |
|---|---|
| `farmer_risk_profile` | Aggregates a farmer's history across all their farms (for `C_farmer`) |
| `region_crop_exposure` | Tracks how many active farms share region + crop (for `C_region`) |
| `input_price_index` | Agro-dealer fertilizer/seed price feed over time (for `C_input`) |
| `voucher_redemption_log` | Timing and completeness of voucher redemption per farm |
| `forecast_calibration_log` | R̂ vs. actual revenue per completed harvest |

---

## 10. Rollout Order (suggested)

1. Confidence-interval R̂ + display on farm page (low engineering lift, high trust payoff)
2. Voucher redemption tracking (data you already generate, just needs logging)
3. Forecast calibration log + job (needed before you can trust the model at scale)
4. Cold-start capping logic
5. C_region and C_farmer (need the new tables above)
6. C_input (needs an external price feed — lowest priority, hardest data source)
7. Explainability storage + human review trigger (governance layer, do alongside #1–2)
