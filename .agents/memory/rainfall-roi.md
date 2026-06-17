---
name: Rainfall Impact + ROI Engine
description: Open-Meteo rainfall fetching, crop yield adjustment factors, full-season and mid-season ROI calculations, daily scheduler snapshots.
---

## Rainfall Engine (`artifacts/api-server/src/lib/rainfall.ts`)
- Fetches Open-Meteo archive (90 days past) + forecast (16 days) at `archive-api.open-meteo.com` and `api.open-meteo.com`
- In-memory cache 1 hour per (lat, lng, cropType)
- `computeRainfallFactor(cropType, totalMm)` → `{ factor 0–1, riskLevel, riskColor green/yellow/red, yieldAdjustmentPercent }`
- `getRainfallData(lat, lng, cropType)` → full `RainfallData` object
- `checkRainfallAlerts(farms[])` → farms in drought or excess riskLevel (used by scheduler)
- `getKenyaCoords(location)` → duplicate of farm-detail helper (intentional, avoids cross-module dep)

## ROI Engine (`artifacts/api-server/src/lib/roi.ts`)
- Constants mirror `scheduler.ts`: ALPHA=0.20, RISK_FREE=0.10, P_MAX=0.40, LGD=0.80, PRIMARY_FEE=0.015, SECONDARY_FEE=0.005
- `computeROI(HoldingROIInput)` → `ROIProjection`
- Full season: `payout = q × (α × R̂ × rainfallFactor) / N`; annualized with daysToHarvest
- Mid-season: P_sell = DCF formula from spec; annualized with daysHeld
- Recommendation: if annualised mid > full + 10% → "sell"; full > mid + 10% → "hold"; else "neutral"

## API Routes
- `GET /api/farms/:id/rainfall` — public (no auth); 1h cached; returns RainfallData + farmName + cropType
- `GET /api/portfolio/roi` — auth required (getCurrentUser); per-holding ROI + rainfall summary; 10min staleTime on frontend

## DB
- `roi_projections` table in `lib/db/src/schema/roi_projections.ts`
- uniqueIndex on (investmentId, snapshotDate); onConflictDoUpdate for daily upsert
- Pushed to DB via `pnpm --filter @workspace/db run push`

## Scheduler (`artifacts/api-server/src/scheduler.ts`)
- `runRainfallAlerts()` — daily 6am EAT; calls checkRainfallAlerts(); notifies investors in affected farms
- `runDailyRoiSnapshots()` — daily 1:30am EAT; upserts today's ROI for all active investments

## Frontend
- `farm-detail.tsx` Growth tab: `useQuery` for `/api/farms/:id/rainfall` (enabled only when activeTab === "growth"); rendered as color-coded card below WeatherNdvi
- `portfolio.tsx` holding cards: `useQuery` for `/api/portfolio/roi`; replaces static +10%/+22% with real AI ROI numbers, P_sell, annualized returns, recommendation pill

## News / Mediastack
- `MEDIASTACK_API_KEY` saved to shared env (key: 1e30a1be82fd6cba322d03044bfa057d)
- `/api/news` tries Mediastack first → RSS Google News → STATIC_NEWS fallback

**Why:** Rainfall directly affects crop yield; the ROI engine needed to incorporate this as a multiplicative factor to give investors accurate payout projections at both mid-season and full-season exit points.
