---
name: Risk level badges
description: How investment risk levels are computed and displayed on farm listings
---

# Risk Level Badges

Computed client-side (not stored in DB) using `getRiskLevel(cropType, changePercent)`:

```typescript
const HIGH_RISK_CROPS = new Set(["coffee", "avocado", "tobacco", "horticulture"]);
const MOD_RISK_CROPS  = new Set(["tea", "wheat", "tomatoes", "potatoes", "onions"]);

function getRiskLevel(cropType: string, changePercent: number): "Low" | "Moderate" | "High" {
  const crop = cropType?.toLowerCase() ?? "";
  if (HIGH_RISK_CROPS.has(crop) || Math.abs(changePercent) > 5) return "High";
  if (MOD_RISK_CROPS.has(crop) || Math.abs(changePercent) > 2) return "Moderate";
  return "Low";
}
```

`RiskBadge` component: color-coded pill — green (Low), amber (Moderate), red (High).

Used in:
- `market/index.tsx` — on mover cards and listing rows
- `market/primary.tsx` — on hero card top badges
- `market/index.tsx` watchlist — on watchlist crop cards

A risk legend row is shown at the top of the All Listings section to explain the color coding.

**Why:** User requested risk levels shown on investment listings. Computed from crop type volatility + current price movement.
