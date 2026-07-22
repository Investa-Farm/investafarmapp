import { Router, type IRouter } from "express";
import { db, farmsTable, farmUpdatesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { getRainfallData, getKenyaCoords } from "../lib/rainfall";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// 2-hour in-memory cache for AI recommendations
interface AiCacheEntry { recs: string[]; ts: number }
const aiCache = new Map<string, AiCacheEntry>();
const AI_TTL_MS = 2 * 60 * 60 * 1000;

// ─── Health score breakdown weights ──────────────────────────────────────────
function computeHealthScore(
  rainfallFactor: number,
  fundingPercent: number,
  changePercent: number,
  ndvi: number,
): { score: number; rainfallScore: number; fundingScore: number; priceScore: number; ndviScore: number } {
  const rainfallScore = Math.round(rainfallFactor * 30);          // max 30
  const fundingScore  = Math.round((fundingPercent / 100) * 25);   // max 25
  const priceScore    = Math.round(Math.max(0, Math.min(25, 12.5 + changePercent * 1.5))); // max 25
  const ndviScore     = Math.round(ndvi * 20);                     // max 20
  const score = Math.min(99, rainfallScore + fundingScore + priceScore + ndviScore);
  return { score, rainfallScore, fundingScore, priceScore, ndviScore };
}

// ─── NDVI lookup (matches frontend table) ────────────────────────────────────
const NDVI_BY_STAGE: Record<string, Record<string, number>> = {
  planting: { maize: 0.28, wheat: 0.25, tea: 0.55, coffee: 0.45, avocado: 0.50, dairy: 0.58, default: 0.30 },
  growing:  { maize: 0.72, wheat: 0.65, tea: 0.78, coffee: 0.63, avocado: 0.69, dairy: 0.73, default: 0.62 },
  harvest:  { maize: 0.54, wheat: 0.48, tea: 0.71, coffee: 0.57, avocado: 0.61, dairy: 0.69, default: 0.52 },
};
function getNdvi(cropType: string, stage: string): number {
  const stageData = NDVI_BY_STAGE[stage] ?? NDVI_BY_STAGE["growing"]!;
  const key = Object.keys(stageData).find(k => k !== "default" && cropType.toLowerCase().includes(k));
  return key ? stageData[key]! : stageData["default"]!;
}

// ─── Fallback AI recommendations when Groq is unavailable ────────────────────
function buildFallbackRecs(cropType: string, rainfall: any, ndvi: number): string[] {
  const crop = (cropType ?? "maize").toLowerCase();
  const recs = [
    "Monitor soil moisture daily and adjust irrigation based on current conditions.",
    "Apply fertilizer appropriate to your current growth stage for optimal yield.",
    "Inspect crops twice weekly for early signs of pests or disease and document findings.",
    "Post a farm update to reassure investors and maintain trust.",
  ];
  if (rainfall?.criticalDrought) recs[0] = "Begin emergency drip irrigation immediately — critical drought conditions detected, act within 48 hours.";
  else if (rainfall?.floodRisk)   recs[0] = "Install drainage channels and raise seedbeds to protect root systems from waterlogging.";
  else if (rainfall?.riskLevel === "low") recs[0] = "Increase irrigation frequency — rainfall is below the optimal range for your crop.";

  if (crop.includes("coffee"))      recs[1] = "Apply foliar potassium spray to improve bean density and export quality.";
  else if (crop.includes("maize"))  recs[1] = "Top-dress with CAN fertilizer at knee-high stage for maximum cob development.";
  else if (crop.includes("tea"))    recs[1] = "Prune to the recommended plucking table height after peak flush to maintain yield.";
  else if (crop.includes("avocado")) recs[1] = "Check for thrips and mites under leaves, and apply neem oil spray if detected.";

  if (ndvi < 0.40) recs[2] = "Low NDVI detected — investigate possible nutrient deficiency or pest pressure urgently.";
  return recs;
}

// ─── GET /api/farmer/health ────────────────────────────────────────────────────
router.get("/farmer/health", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Get farmer's farms
  const farms = await db.select().from(farmsTable).where(eq(farmsTable.farmerId, user.id));
  if (!farms.length) {
    res.json({ hasFarm: false });
    return;
  }

  const farm = farms[0]!;
  const fundingPct = Math.round(((farm.totalShares - farm.sharesAvailable) / farm.totalShares) * 100);
  const changePercent = Number(farm.changePercent ?? 0);

  // Determine crop growth stage from farm data
  const ageMs = Date.now() - new Date(farm.createdAt).getTime();
  const ageDays = ageMs / 86_400_000;
  const stage = ageDays < 21 ? "planting" : ageDays < 90 ? "growing" : "harvest";
  const ndvi = getNdvi(farm.cropType ?? "maize", stage);

  // Rainfall data
  const [lat, lng] = getKenyaCoords(farm.location ?? "nairobi");
  let rainfall: any = null;
  try {
    rainfall = await getRainfallData(lat, lng, farm.cropType ?? "maize");
  } catch (e) {
    logger.warn({ err: e }, "farmer-health: rainfall fetch failed");
  }

  const healthBreakdown = computeHealthScore(
    rainfall?.rainfallFactor ?? 0.7,
    fundingPct,
    changePercent,
    ndvi,
  );

  // Recent farm updates
  const recentUpdates = await db
    .select()
    .from(farmUpdatesTable)
    .where(eq(farmUpdatesTable.farmId, farm.id))
    .orderBy(desc(farmUpdatesTable.createdAt))
    .limit(3);

  // AI weekly recommendations (cached per farm, renewed every 2h)
  const cacheKey = `fhealth-${farm.id}-${Math.floor(Date.now() / AI_TTL_MS)}`;
  let recommendations: string[] = [];

  const cached = aiCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < AI_TTL_MS) {
    recommendations = cached.recs;
  } else {
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const prompt = [
          `You are an expert Kenyan agricultural advisor. Provide 5 specific, actionable weekly farm management recommendations.`,
          ``,
          `Farm details:`,
          `- Name: ${farm.name}`,
          `- Crop: ${farm.cropType}`,
          `- Location: ${farm.location ?? "Kenya"}`,
          `- Growth stage: ${stage} (${ageDays.toFixed(0)} days since listing)`,
          `- NDVI: ${ndvi.toFixed(2)} (vegetation health index)`,
          `- Funding: ${fundingPct}% funded by investors`,
          `- Price trend: ${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}% change`,
          rainfall
            ? `- Rainfall: ${rainfall.riskLevel} risk — ${rainfall.seasonalTotalMm}mm seasonal total (optimal ${rainfall.optimalRangeMin}–${rainfall.optimalRangeMax}mm)${rainfall.criticalDrought ? " — CRITICAL DROUGHT" : ""}${rainfall.floodRisk ? " — FLOOD RISK" : ""}`
            : "",
          ``,
          `Rules:`,
          `1. Each recommendation must be a single actionable sentence beginning with an action verb.`,
          `2. Make them specific to the crop type, season, and risk conditions above.`,
          `3. Mix categories: one irrigation/water management, one nutrient/fertilizer, one pest/disease, one investor-relations, one market/timing.`,
          `4. Return ONLY a valid JSON array of 5 strings. No markdown, no extra text.`,
        ].join("\n");

        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.45,
            max_tokens: 500,
          }),
          signal: AbortSignal.timeout(12_000),
        });
        const d = await resp.json() as any;
        const text: string = d.choices?.[0]?.message?.content ?? "[]";
        const cleaned = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          recommendations = (parsed as string[]).slice(0, 5);
          aiCache.set(cacheKey, { recs: recommendations, ts: Date.now() });
        }
      } catch (e) {
        logger.warn({ err: e }, "farmer-health: AI recommendations failed");
      }
    }

    if (!recommendations.length) {
      recommendations = buildFallbackRecs(farm.cropType ?? "maize", rainfall, ndvi);
      // Cache fallback too so we don't hammer Groq on every request
      aiCache.set(cacheKey, { recs: recommendations, ts: Date.now() });
    }
  }

  // Pest / disease risk signals (derived from humidity + temp via rainfall proxy)
  const pestRisks: { risk: string; severity: "low" | "medium" | "high"; tip: string }[] = [];
  if (rainfall?.floodRisk || rainfall?.extremeDays > 4) {
    pestRisks.push({ risk: "Fungal Disease", severity: "high", tip: "Apply systemic fungicide (e.g. Ridomil) preventatively during wet spells." });
  }
  if (rainfall?.riskLevel === "excess") {
    pestRisks.push({ risk: "Root Rot", severity: "high", tip: "Improve field drainage and avoid waterlogged areas; apply Metalaxyl if symptoms appear." });
  }
  if (rainfall?.riskLevel === "low" || rainfall?.criticalDrought) {
    pestRisks.push({ risk: "Spider Mites", severity: "medium", tip: "Mites thrive in dry conditions — inspect leaf undersides and apply acaricide if needed." });
  }
  if (stage === "growing" && (farm.cropType ?? "").toLowerCase().includes("maize")) {
    pestRisks.push({ risk: "Fall Armyworm", severity: "medium", tip: "Scout for FAW egg masses and larvae early morning; apply Emamectin Benzoate if >10% infestation." });
  }
  if (pestRisks.length === 0) {
    pestRisks.push({ risk: "No Immediate Threats", severity: "low", tip: "Continue regular scouting every 5–7 days to stay ahead of seasonal pests." });
  }

  res.json({
    hasFarm: true,
    farm: {
      id: farm.id,
      name: farm.name,
      cropType: farm.cropType,
      location: farm.location,
      fundingPercent: fundingPct,
      changePercent,
      stage,
      ageDays: Math.round(ageDays),
    },
    healthScore: healthBreakdown.score,
    breakdown: {
      rainfall: healthBreakdown.rainfallScore,
      funding: healthBreakdown.fundingScore,
      market: healthBreakdown.priceScore,
      ndvi: healthBreakdown.ndviScore,
    },
    ndvi,
    coords: { lat, lng },
    rainfall: rainfall
      ? {
          seasonalTotalMm: rainfall.seasonalTotalMm,
          riskLevel: rainfall.riskLevel,
          riskLabel: rainfall.riskLabel,
          riskColor: rainfall.riskColor,
          yieldAdjustmentPercent: rainfall.yieldAdjustmentPercent,
          floodRisk: rainfall.floodRisk,
          criticalDrought: rainfall.criticalDrought,
          extremeDays: rainfall.extremeDays,
          optimalRangeMin: rainfall.optimalRangeMin,
          optimalRangeMax: rainfall.optimalRangeMax,
          rainfallFactor: rainfall.rainfallFactor,
          dailyMm: rainfall.dailyMm,
          dailyDates: rainfall.dailyDates,
        }
      : null,
    recommendations,
    pestRisks,
    recentUpdates: recentUpdates.map(u => ({
      id: u.id,
      title: u.title,
      content: u.description,
      createdAt: u.createdAt.toISOString(),
    })),
  });
});

export default router;
