/**
 * Rainfall Impact Engine
 * Fetches Open-Meteo data (no API key needed) and computes crop yield
 * adjustment factors based on seasonal rainfall totals.
 */

// ─── In-memory cache (1 hour TTL) ────────────────────────────────────────────
interface CacheEntry { data: RainfallData; fetchedAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RainfallData {
  lat: number;
  lng: number;
  seasonalTotalMm: number;
  forecastTotalMm: number;
  dailyMm: number[];
  dailyDates: string[];
  extremeDays: number;         // days with >25mm (heavy rain)
  dryDays: number;             // days with <1mm
  rainfallFactor: number;      // 0–1 yield adjustment factor
  riskLevel: "optimal" | "low" | "drought" | "excess";
  riskLabel: string;
  riskColor: "green" | "yellow" | "red";
  comparisonToOptimal: number; // % vs optimal mid-point (900mm)
  floodRisk: boolean;
  criticalDrought: boolean;
  optimalRangeMin: number;
  optimalRangeMax: number;
  ndviAdjustment: number;      // combined rainfall × NDVI adjustment
  yieldAdjustmentPercent: number; // e.g. -22 means 22% yield reduction
}

// ─── Crop-specific optimal ranges (mm per season) ────────────────────────────
const CROP_RAINFALL_PROFILE: Record<string, { min: number; max: number; optMid: number }> = {
  maize:        { min: 600,  max: 1200, optMid: 900  },
  beans:        { min: 500,  max: 1000, optMid: 750  },
  wheat:        { min: 450,  max: 900,  optMid: 675  },
  rice:         { min: 900,  max: 2000, optMid: 1200 },
  potatoes:     { min: 500,  max: 800,  optMid: 650  },
  tomatoes:     { min: 400,  max: 750,  optMid: 600  },
  coffee:       { min: 1200, max: 2000, optMid: 1600 },
  tea:          { min: 1200, max: 2200, optMid: 1700 },
  avocado:      { min: 600,  max: 1200, optMid: 900  },
  sunflower:    { min: 400,  max: 800,  optMid: 600  },
  cassava:      { min: 500,  max: 1200, optMid: 850  },
  onions:       { min: 350,  max: 700,  optMid: 500  },
  horticulture: { min: 500,  max: 900,  optMid: 700  },
  sorghum:      { min: 300,  max: 700,  optMid: 500  },
  tobacco:      { min: 500,  max: 1000, optMid: 750  },
};

const DEFAULT_PROFILE = { min: 600, max: 1200, optMid: 900 };

/**
 * Compute a 0–1 yield adjustment factor from seasonal rainfall.
 * 1.0 = optimal, 0.0 = complete failure.
 */
export function computeRainfallFactor(cropType: string, totalMm: number): {
  factor: number;
  riskLevel: RainfallData["riskLevel"];
  riskLabel: string;
  riskColor: RainfallData["riskColor"];
  yieldAdjustmentPercent: number;
} {
  const crop = (cropType ?? "maize").toLowerCase().trim();
  const profile = CROP_RAINFALL_PROFILE[crop] ?? DEFAULT_PROFILE;
  const { min, max } = profile;
  const criticalLow = min * 0.70;  // 70% of min → near total loss
  const lowBound = min * 0.92;     // 92% of min → mild stress

  let factor: number;
  let riskLevel: RainfallData["riskLevel"];
  let riskLabel: string;
  let riskColor: RainfallData["riskColor"];

  if (totalMm < criticalLow) {
    // Critical drought — near total loss
    factor = Math.max(0.02, totalMm / criticalLow * 0.15);
    riskLevel = "drought";
    riskLabel = `Severe drought — ${Math.round(totalMm)}mm vs ${min}mm minimum`;
    riskColor = "red";
  } else if (totalMm < min) {
    // Drought / sub-optimal low
    const t = (totalMm - criticalLow) / (min - criticalLow);
    factor = 0.15 + t * 0.75; // 15%→90%
    riskLevel = totalMm < lowBound ? "drought" : "low";
    riskLabel = totalMm < lowBound
      ? `Drought stress — ${Math.round(totalMm)}mm (${Math.round((totalMm / min) * 100)}% of minimum)`
      : `Low rainfall — ${Math.round(totalMm)}mm (slight deficit)`;
    riskColor = totalMm < lowBound ? "red" : "yellow";
  } else if (totalMm <= max) {
    // Optimal range
    factor = 1.0;
    riskLevel = "optimal";
    riskLabel = `Optimal — ${Math.round(totalMm)}mm within ${min}–${max}mm range`;
    riskColor = "green";
  } else {
    // Excess / flood risk
    const excess = totalMm - max;
    const loss = Math.min(0.40, 0.21 + (excess / (max * 0.5)) * 0.19);
    factor = Math.max(0.60, 1.0 - loss);
    riskLevel = "excess";
    riskLabel = `Excess rainfall — ${Math.round(totalMm)}mm, flooding risk ${Math.round(loss * 100)}% yield loss`;
    riskColor = excess > max * 0.3 ? "red" : "yellow";
  }

  const yieldAdjustmentPercent = Math.round((factor - 1.0) * 100);
  return { factor, riskLevel, riskLabel, riskColor, yieldAdjustmentPercent };
}

/**
 * Fetch Open-Meteo rainfall data for a given lat/lng.
 * Returns 90 days of past daily rain_sum + 16-day forecast.
 */
async function fetchOpenMeteo(lat: number, lng: number): Promise<{ dates: string[]; daily: number[] }> {
  const pastUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${getDaysAgo(90)}&end_date=${getDaysAgo(1)}&daily=rain_sum&timezone=Africa%2FNairobi`;
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=rain_sum&forecast_days=16&timezone=Africa%2FNairobi`;

  const [pastRes, forecastRes] = await Promise.all([
    fetch(pastUrl).catch(() => null),
    fetch(forecastUrl).catch(() => null),
  ]);

  const pastJson = pastRes?.ok ? await pastRes.json().catch(() => null) : null;
  const forecastJson = forecastRes?.ok ? await forecastRes.json().catch(() => null) : null;

  const pastDates: string[] = (pastJson as any)?.daily?.time ?? [];
  const pastRain: number[] = ((pastJson as any)?.daily?.rain_sum ?? []).map((v: number | null) => v ?? 0);
  const forecastDates: string[] = (forecastJson as any)?.daily?.time ?? [];
  const forecastRain: number[] = ((forecastJson as any)?.daily?.rain_sum ?? []).map((v: number | null) => v ?? 0);

  return {
    dates: [...pastDates, ...forecastDates],
    daily: [...pastRain, ...forecastRain],
  };
}

/**
 * Main function: fetch and compute rainfall impact for a farm location.
 */
export async function getRainfallData(
  lat: number,
  lng: number,
  cropType: string
): Promise<RainfallData> {
  const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}_${cropType}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

  const { dates, daily } = await fetchOpenMeteo(lat, lng);

  const past = daily.slice(0, 90);
  const forecast = daily.slice(90);

  const seasonalTotalMm = past.reduce((s, v) => s + v, 0);
  const forecastTotalMm = forecast.reduce((s, v) => s + v, 0);
  const projectedSeasonalMm = seasonalTotalMm + forecastTotalMm * 0.5; // blend actual + 50% of forecast

  const extremeDays = daily.filter(v => v > 25).length;
  const dryDays = daily.filter(v => v < 1).length;

  const crop = (cropType ?? "maize").toLowerCase().trim();
  const profile = CROP_RAINFALL_PROFILE[crop] ?? DEFAULT_PROFILE;

  const { factor, riskLevel, riskLabel, riskColor, yieldAdjustmentPercent } =
    computeRainfallFactor(cropType, projectedSeasonalMm);

  // NDVI approximation from rainfall (simple coupling)
  const ndviBase = riskLevel === "optimal" ? 0.75 : riskLevel === "low" ? 0.55 : riskLevel === "drought" ? 0.35 : 0.60;
  const ndviAdjustment = ndviBase * factor;

  const data: RainfallData = {
    lat, lng,
    seasonalTotalMm: Math.round(seasonalTotalMm),
    forecastTotalMm: Math.round(forecastTotalMm),
    dailyMm: daily.slice(-30),           // last 30 days for chart
    dailyDates: dates.slice(-30),
    extremeDays,
    dryDays,
    rainfallFactor: Math.round(factor * 1000) / 1000,
    riskLevel,
    riskLabel,
    riskColor,
    comparisonToOptimal: Math.round(((projectedSeasonalMm - profile.optMid) / profile.optMid) * 100),
    floodRisk: riskLevel === "excess" && extremeDays > 5,
    criticalDrought: riskLevel === "drought" && projectedSeasonalMm < profile.min * 0.80,
    optimalRangeMin: profile.min,
    optimalRangeMax: profile.max,
    ndviAdjustment: Math.round(ndviAdjustment * 100) / 100,
    yieldAdjustmentPercent,
  };

  cache.set(cacheKey, { data, fetchedAt: Date.now() });
  return data;
}

/**
 * Check if any farms' forecast rainfall will breach thresholds and
 * return the farms + their rainfall data (for alert sending).
 */
export async function checkRainfallAlerts(
  farms: Array<{ id: number; name: string; cropType: string; location: string }>
): Promise<Array<{ farmId: number; farmName: string; rainfallData: RainfallData }>> {
  const alerts: Array<{ farmId: number; farmName: string; rainfallData: RainfallData }> = [];
  for (const farm of farms) {
    try {
      const [lat, lng] = getKenyaCoords(farm.location);
      const data = await getRainfallData(lat, lng, farm.cropType);
      if (data.riskLevel === "drought" || data.riskLevel === "excess") {
        alerts.push({ farmId: farm.id, farmName: farm.name, rainfallData: data });
      }
    } catch {
      // skip
    }
  }
  return alerts;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0]!;
}

const KENYA_COORDS: Record<string, [number, number]> = {
  nairobi: [-1.2921, 36.8219], kiambu: [-1.1728, 36.8342], nakuru: [-0.3031, 36.0800],
  meru: [0.0500, 37.6500], kirinyaga: [-0.4700, 37.3100], laikipia: [0.0300, 36.8000],
  nyeri: [-0.4167, 36.9500], kisumu: [-0.0917, 34.7679], eldoret: [0.5200, 35.2699],
  machakos: [-1.5177, 37.2634], narok: [-1.0833, 35.8667], thika: [-1.0332, 37.0693],
  ahero: [-0.1667, 34.9167], molo: [-0.2667, 35.7333], limuru: [-1.1133, 36.6428],
  nanyuki: [0.0100, 37.0714], embu: [-0.5273, 37.4571], kitui: [-1.3667, 38.0167],
  mombasa: [-4.0435, 39.6682], kericho: [-0.3667, 35.2833], bungoma: [0.5630, 34.5522],
  kakamega: [0.2827, 34.7519], kisii: [-0.6817, 34.7717], muranga: [-0.7167, 37.1500],
  nyandarua: [-0.1833, 36.4500], bomet: [-0.7833, 35.3500],
};

export function getKenyaCoords(location: string): [number, number] {
  const lower = (location ?? "").toLowerCase();
  for (const [key, coords] of Object.entries(KENYA_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return [-1.2921, 36.8219]; // default: Nairobi
}
