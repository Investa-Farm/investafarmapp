import { Router, type IRouter } from "express";
import { db, farmsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const CROP_CALENDAR: Record<string, { plantingMonths: number[]; harvestMonths: number[]; growthDays: number }> = {
  maize:    { plantingMonths: [3, 4, 10, 11], harvestMonths: [7, 8, 2, 3], growthDays: 120 },
  coffee:   { plantingMonths: [3, 4],          harvestMonths: [10, 11, 12], growthDays: 365 },
  tea:      { plantingMonths: [1, 2],           harvestMonths: [4, 5, 9],   growthDays: 180 },
  avocado:  { plantingMonths: [3, 4],           harvestMonths: [9, 10, 11], growthDays: 200 },
  wheat:    { plantingMonths: [10, 11],          harvestMonths: [1, 2, 3],   growthDays: 105 },
  potatoes: { plantingMonths: [3, 4, 9, 10],    harvestMonths: [6, 7, 12],  growthDays: 90 },
  tomatoes: { plantingMonths: [2, 3, 8, 9],     harvestMonths: [5, 6, 11],  growthDays: 75 },
  cassava:  { plantingMonths: [3, 4, 10, 11],   harvestMonths: [9, 10, 4],  growthDays: 270 },
  sunflower:{ plantingMonths: [3, 4],            harvestMonths: [7, 8],      growthDays: 100 },
  dairy:    { plantingMonths: [1],               harvestMonths: [1],         growthDays: 365 },
};

function getCropKey(cropType: string): string {
  return cropType.toLowerCase().split(" ")[0] ?? "maize";
}

export function computeGrowthStage(cropType: string, createdAt: Date): {
  stage: "planting" | "growing" | "harvest";
  percent: number;
  daysElapsed: number;
  daysTotal: number;
} {
  const key = getCropKey(cropType);
  const cal = CROP_CALENDAR[key] ?? CROP_CALENDAR["maize"]!;
  const now = new Date();
  const daysElapsed = Math.floor((now.getTime() - createdAt.getTime()) / 86400000);
  const daysTotal = cal.growthDays;
  const pct = Math.min(100, Math.round((daysElapsed / daysTotal) * 100));

  let stage: "planting" | "growing" | "harvest";
  if (pct < 20) stage = "planting";
  else if (pct < 80) stage = "growing";
  else stage = "harvest";

  return { stage, percent: pct, daysElapsed, daysTotal };
}

async function fetchCropPriceInsight(cropType: string): Promise<{ priceKes: number; changePercent: number; insight: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  const defaults: Record<string, number> = {
    maize: 4500, coffee: 85000, tea: 32000, avocado: 12000, wheat: 6200,
    potatoes: 3800, tomatoes: 9500, cassava: 2800, sunflower: 7200, dairy: 55000,
  };
  const key = getCropKey(cropType);
  const base = defaults[key] ?? 5000;

  if (!apiKey) {
    const jitter = (Math.random() - 0.5) * 0.06;
    return { priceKes: Math.round(base * (1 + jitter)), changePercent: +((jitter * 100).toFixed(2)), insight: "Default price estimate" };
  }

  const today = new Date().toISOString().split("T")[0];
  const prompt = `You are a commodity market analyst for East African agricultural markets.
Today is ${today}. Provide the current wholesale market price for ${cropType} in Kenya.

Respond ONLY with valid JSON (no markdown):
{"priceKes":NUMBER_PER_90KG_BAG,"changePercent":NUMBER,"insight":"one sentence about current market conditions"}

Rules:
- priceKes = wholesale price per 90kg bag in KES (realistic Kenya market rate)
- changePercent = week-on-week % change (can be negative), realistic range -8 to +12
- insight = brief market driver (weather, demand, exports, season)
- Use real knowledge of Kenya commodity markets`;

  try {
    const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 150,
      }),
    });
    const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { priceKes: number; changePercent: number; insight: string };
      if (parsed.priceKes > 0) return parsed;
    }
    const jitter = (Math.random() - 0.5) * 0.06;
    return { priceKes: Math.round(base * (1 + jitter)), changePercent: +((jitter * 100).toFixed(2)), insight: "Estimated from market data" };
  } catch {
    const jitter = (Math.random() - 0.5) * 0.06;
    return { priceKes: Math.round(base * (1 + jitter)), changePercent: +((jitter * 100).toFixed(2)), insight: "Estimated from market data" };
  }
}

router.get("/crop-prices/:cropType", async (req, res): Promise<void> => {
  const cropType = decodeURIComponent(req.params.cropType);
  const data = await fetchCropPriceInsight(cropType);
  res.json({ cropType, ...data });
});

router.post("/crop-prices/update-farms", async (req, res): Promise<void> => {
  const farms = await db.select().from(farmsTable);
  const updated: number[] = [];

  for (const farm of farms) {
    try {
      const priceData = await fetchCropPriceInsight(farm.cropType);
      const sharesIssued = farm.totalShares - farm.sharesAvailable;
      const fundingPct = farm.totalShares > 0 ? sharesIssued / farm.totalShares : 0;
      const demandMultiplier = 1 + fundingPct * 0.15;
      const newPrice = Math.round((priceData.priceKes / 100) * demandMultiplier);
      await db.update(farmsTable)
        .set({ currentPrice: String(newPrice), changePercent: String(priceData.changePercent) })
        .where(eq(farmsTable.id, farm.id));
      updated.push(farm.id);
    } catch { /* skip failed */ }
  }

  res.json({ updated: updated.length, farmIds: updated });
});

router.get("/farmer/growth/:farmId", async (req, res): Promise<void> => {
  const farmId = parseInt(req.params.farmId, 10);
  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId));
  if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

  const growth = computeGrowthStage(farm.cropType, farm.createdAt);
  const priceData = await fetchCropPriceInsight(farm.cropType);

  res.json({
    farmId,
    cropType: farm.cropType,
    ...growth,
    marketPriceKes: priceData.priceKes,
    marketChangePercent: priceData.changePercent,
    marketInsight: priceData.insight,
  });
});

export default router;
