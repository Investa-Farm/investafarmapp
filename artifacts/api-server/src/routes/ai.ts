import { Router, type IRouter } from "express";
import { getCurrentUser } from "./auth";
import { db, marketListingsTable, farmsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
const cache = new Map<string, string>();

router.post("/ai/explain", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { context } = req.body as { context?: string };
  if (!context || typeof context !== "string" || context.length > 800) {
    res.status(400).json({ error: "Invalid context" });
    return;
  }

  const cacheKey = context.trim().toLowerCase().slice(0, 100);
  if (cache.has(cacheKey)) {
    res.json({ explanation: cache.get(cacheKey) });
    return;
  }

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env["GROQ_API_KEY"] ?? ""}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are a concise, friendly financial assistant for Investa Farm — a Kenyan farm investment platform. " +
              "Answer in 2–3 short sentences. Use plain language specific to Kenyan agriculture. " +
              "Do NOT use bullets, headers, or markdown. Currency is KES.",
          },
          { role: "user", content: context },
        ],
        max_tokens: 150,
        temperature: 0.5,
      }),
    });

    if (!resp.ok) throw new Error(`Groq ${resp.status}`);
    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const explanation = data.choices[0]?.message?.content?.trim() ?? "No explanation available.";

    cache.set(cacheKey, explanation);
    setTimeout(() => cache.delete(cacheKey), 2 * 60 * 60 * 1000);

    res.json({ explanation });
  } catch (err) {
    console.error("[AI_EXPLAIN]", (err as Error).message);
    res.status(503).json({ explanation: "AI is temporarily unavailable. Please try again shortly." });
  }
});

router.post("/ai/match", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { targetReturnPct, riskTolerance, preferredCrops, durationMonths, amount } = req.body as {
    targetReturnPct?: number; riskTolerance?: string; preferredCrops?: string[];
    durationMonths?: number; amount?: number;
  };

  const listings = await db
    .select({
      id: marketListingsTable.id,
      farmId: marketListingsTable.farmId,
      listingType: marketListingsTable.listingType,
      sharesAvailable: marketListingsTable.sharesAvailable,
      pricePerShare: marketListingsTable.pricePerShare,
      isActive: marketListingsTable.isActive,
      farmName: farmsTable.name,
      cropType: farmsTable.cropType,
      changePercent: farmsTable.changePercent,
      location: farmsTable.location,
      farmStatus: farmsTable.status,
    })
    .from(marketListingsTable)
    .innerJoin(farmsTable, eq(marketListingsTable.farmId, farmsTable.id))
    .where(eq(marketListingsTable.isActive, 1))
    .limit(15);

  if (listings.length === 0) {
    res.json({ matches: [] });
    return;
  }

  const listingsSummary = listings.map(l => ({
    farmId: l.farmId,
    farmName: l.farmName,
    cropType: l.cropType,
    pricePerShare: Number(l.pricePerShare),
    sharesAvailable: l.sharesAvailable,
    changePercent: Number(l.changePercent),
    location: l.location,
  }));

  const prompt = `Investa Farm — Kenyan farm investment platform AI advisor.

INVESTOR PREFERENCES:
- Target return: ${targetReturnPct ?? 20}%
- Risk tolerance: ${riskTolerance ?? "medium"}
- Preferred crops: ${(preferredCrops ?? []).length > 0 ? preferredCrops!.join(", ") : "any"}
- Duration: ${durationMonths ?? 4} months
- Amount: KES ${amount ?? 10000}

ACTIVE FARM LISTINGS:
${JSON.stringify(listingsSummary, null, 2)}

Rank the top 3 best-fit farms. Consider crop risk, market momentum (changePercent), and how well the listing matches duration and return preferences. Output ONLY valid JSON:

{"matches":[{"farmId":<number>,"matchScore":<0-100>,"matchReason":"<1 sentence>","expectedReturnLow":<number>,"expectedReturnHigh":<number>}]}`;

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env["GROQ_API_KEY"] ?? ""}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Output ONLY valid JSON with no markdown or explanation." },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.25,
      }),
    });

    if (!resp.ok) throw new Error(`Groq ${resp.status}`);
    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0]?.message?.content?.trim() ?? "{}";
    const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr) as { matches?: Array<{ farmId: number; matchScore: number; matchReason: string; expectedReturnLow: number; expectedReturnHigh: number }> };

    const matches = (parsed.matches ?? []).map(m => {
      const listing = listingsSummary.find(l => l.farmId === m.farmId);
      return { ...listing, ...m };
    });

    res.json({ matches });
  } catch (err) {
    console.error("[AI_MATCH]", (err as Error).message);
    // Fallback: heuristic local ranking when AI is unavailable
    const riskMap: Record<string, number> = { low: 1, medium: 5, high: 9 };
    const userRisk = riskMap[((riskTolerance ?? "medium") as string).toLowerCase()] ?? 5;
    const scored = listingsSummary.map(l => {
      const volatility = Math.abs(l.changePercent);
      const riskScore = volatility > 5 ? 8 : volatility > 2 ? 5 : 2;
      const riskMatch = 10 - Math.abs(riskScore - userRisk);
      const cropMatch = (preferredCrops ?? []).length === 0 ? 5 : (preferredCrops!.map(c => c.toLowerCase()).includes(l.cropType.toLowerCase()) ? 10 : 2);
      const momentum = l.changePercent > 0 ? 5 : 0;
      const matchScore = Math.round(Math.min(100, (riskMatch * 5 + cropMatch * 3 + momentum * 2)));
      return {
        ...l,
        matchScore,
        matchReason: `${l.cropType} farm with ${l.changePercent >= 0 ? "positive" : "mixed"} market momentum. Heuristic match (AI unavailable).`,
        expectedReturnLow: 10,
        expectedReturnHigh: 22,
      };
    }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
    res.json({ matches: scored });
  }
});

router.post("/ai/yield-predict", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { farmName, cropType, fundingPercent, daysRemaining, riskScore } = req.body as {
    farmName?: string; cropType?: string; fundingPercent?: number;
    daysRemaining?: number; riskScore?: number;
  };

  const S = Math.max(1, Math.min(10, riskScore ?? 7));
  const pMax = 0.40;
  const L = 0.80;
  const r = 0.10;
  const remainingYears = (daysRemaining ?? 120) / 365;

  const pLoss = ((10 - S) / 9) * pMax;
  const lambda = pLoss * L;
  const discountFactor = Math.pow(1 + r, remainingYears);
  const riskAdjustedMultiplier = (1 - lambda) / discountFactor;

  const cropBaseReturns: Record<string, [number, number]> = {
    maize: [18, 28], beans: [15, 25], tomatoes: [20, 35],
    coffee: [25, 40], tea: [18, 30], dairy: [12, 20],
    rice: [16, 24], kale: [18, 30], sunflower: [14, 22],
    wheat: [16, 26], avocado: [22, 38], poultry: [14, 22],
  };
  const key = (cropType ?? "").toLowerCase();
  const [baseLow, baseHigh] = cropBaseReturns[key] ?? [15, 28];
  const adjLow = Math.max(0, Math.round(baseLow * riskAdjustedMultiplier * 10) / 10);
  const adjHigh = Math.max(0, Math.round(baseHigh * riskAdjustedMultiplier * 10) / 10);
  const probability = Math.round(55 + (S / 10) * 40);

  const prompt = `Investa Farm yield analyst. Farm: ${farmName ?? "Unknown"}, crop: ${cropType ?? "Unknown"}, Kenya.
Risk score ${S}/10. Days remaining: ${daysRemaining ?? 120}. Funding: ${fundingPercent ?? 0}%.
Adjusted return range: ${adjLow}%–${adjHigh}%. Probability of target: ${probability}%.
Write exactly 2 sentences: a yield forecast mentioning Kenyan agricultural conditions, and one key risk factor. Plain text only.`;

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env["GROQ_API_KEY"] ?? ""}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Write exactly 2 sentences. No bullets, no markdown, no headers." },
          { role: "user", content: prompt },
        ],
        max_tokens: 130,
        temperature: 0.4,
      }),
    });

    if (!resp.ok) throw new Error(`Groq ${resp.status}`);
    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const narrative = data.choices[0]?.message?.content?.trim() ?? "";

    res.json({
      riskScore: S,
      probability,
      returnLow: adjLow,
      returnHigh: adjHigh,
      riskDiscountPct: Math.round(lambda * 100 * 10) / 10,
      narrative,
      daysRemaining: daysRemaining ?? 120,
    });
  } catch (err) {
    console.error("[AI_YIELD]", (err as Error).message);
    res.status(503).json({ error: "AI prediction temporarily unavailable." });
  }
});

// ─── POST /ai/farm-insights ─────────────────────────────────────────────────
// Returns 5 concise, actionable AI recommendations for a farmer
router.post("/ai/farm-insights", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { cropType, location, growthStage, farmHealth, harvestDays, fundsRaised, fundingPercent } = req.body as {
    cropType?: string; location?: string; growthStage?: string; farmHealth?: number;
    harvestDays?: number; fundsRaised?: number; fundingPercent?: number;
  };

  const cacheKey = `farm-insights:${cropType}:${growthStage}:${farmHealth}:${harvestDays}`;
  if (cache.has(cacheKey)) {
    res.json({ insights: JSON.parse(cache.get(cacheKey)!) });
    return;
  }

  const prompt = `You are an expert Kenyan agricultural advisor for Investa Farm.

FARM DATA:
- Crop: ${cropType ?? "Unknown"}
- Location: ${location ?? "Kenya"}
- Growth stage: ${growthStage ?? "vegetative"}
- Farm health score: ${farmHealth ?? 75}/100
- Days to harvest: ${harvestDays ?? 90}
- Funds raised: KES ${(fundsRaised ?? 0).toLocaleString()}
- Funding progress: ${fundingPercent ?? 0}%

Generate exactly 5 short, specific, actionable insights for this Kenyan farmer. Each insight must be under 20 words and highly specific to their crop and stage. Format as JSON only:

{"insights":[{"type":"weather","icon":"🌤","tip":"..."},{"type":"market","icon":"📊","tip":"..."},{"type":"crop","icon":"🌱","tip":"..."},{"type":"funding","icon":"💰","tip":"..."},{"type":"risk","icon":"⚠️","tip":"..."}]}`;

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env["GROQ_API_KEY"] ?? ""}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: "Output ONLY valid JSON. No markdown, no explanation." },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.4,
      }),
    });

    if (!resp.ok) throw new Error(`Groq ${resp.status}`);
    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0]?.message?.content?.trim() ?? "{}";
    const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr) as { insights?: Array<{ type: string; icon: string; tip: string }> };
    const insights = parsed.insights ?? [];

    cache.set(cacheKey, JSON.stringify(insights));
    setTimeout(() => cache.delete(cacheKey), 60 * 60 * 1000); // 1h cache

    res.json({ insights });
  } catch (err) {
    console.error("[AI_FARM_INSIGHTS]", (err as Error).message);
    // Heuristic fallback
    const stage = (growthStage ?? "").toLowerCase();
    const crop = (cropType ?? "crop").toLowerCase();
    const fallback = [
      { type: "crop",    icon: "🌱", tip: stage === "planting" ? `Water ${crop} deeply at planting to establish roots.` : `Monitor ${crop} for pests at ${stage} stage.` },
      { type: "weather", icon: "🌤", tip: "Check NDVI scores weekly — rainfall patterns shifting in Kenya." },
      { type: "market",  icon: "📊", tip: `${crop.charAt(0).toUpperCase()+crop.slice(1)} prices typically rise closer to harvest — hold for better exit.` },
      { type: "funding", icon: "💰", tip: fundingPercent && fundingPercent < 50 ? "Share your farm listing with local farmer networks to attract investors." : "Funding is strong — focus on yield quality to maximize investor returns." },
      { type: "risk",    icon: "⚠️", tip: `Protect ${crop} against post-harvest losses — secure dry storage early.` },
    ];
    res.json({ insights: fallback });
  }
});

// ─── GET /ai/portfolio-health ────────────────────────────────────────────────
// Returns a 1-line AI summary of portfolio health
router.post("/ai/portfolio-health", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { totalValue, totalInvested, holdings, gainLossPercent, crops } = req.body as {
    totalValue?: number; totalInvested?: number; holdings?: number;
    gainLossPercent?: number; crops?: string[];
  };

  const cacheKey = `portfolio-health:${user.id}:${Math.round((gainLossPercent ?? 0) * 10)}`;
  if (cache.has(cacheKey)) {
    res.json({ summary: cache.get(cacheKey) });
    return;
  }

  const isProfit = (gainLossPercent ?? 0) >= 0;
  const prompt = `Investa Farm — 1-sentence portfolio health insight for a Kenyan investor.
Portfolio: KES ${(totalValue ?? 0).toLocaleString()} value, ${holdings ?? 0} holdings, ${gainLossPercent?.toFixed(1) ?? 0}% overall return.
Crops: ${(crops ?? []).join(", ") || "mixed"}.
Write exactly 1 sentence: a specific recommendation for this portfolio. Plain text only. Max 25 words.`;

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env["GROQ_API_KEY"] ?? ""}` },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: "Write exactly 1 sentence. No bullets, no markdown." },
          { role: "user", content: prompt },
        ],
        max_tokens: 60,
        temperature: 0.5,
      }),
    });
    if (!resp.ok) throw new Error(`Groq ${resp.status}`);
    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const summary = data.choices[0]?.message?.content?.trim() ?? "";
    cache.set(cacheKey, summary);
    setTimeout(() => cache.delete(cacheKey), 30 * 60 * 1000);
    res.json({ summary });
  } catch {
    const fallback = isProfit
      ? `Your portfolio is growing — consider diversifying into high-ROI coffee or avocado to boost returns.`
      : `Market dip detected — this is an opportunity to average down on stable crops like maize or beans.`;
    res.json({ summary: fallback });
  }
});

// ─── POST /agent/score — AI-powered farm selection for the autonomous agent ───
// Takes a list of live listings and returns a ranked selection with Groq reasoning.
// Falls back to deterministic scoring when no GROQ_API_KEY is set.
router.post("/agent/score", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { listings, risk, budget, maxFarms } = req.body as {
    listings: any[];
    risk: "low" | "medium" | "high";
    budget: number;
    maxFarms: number;
  };

  if (!Array.isArray(listings) || !risk || !budget || !maxFarms) {
    res.status(400).json({ error: "Invalid parameters" }); return;
  }

  const RISK_CROP_PREFS: Record<string, string[]> = {
    low:    ["maize", "beans", "kale", "wheat", "cassava", "sorghum"],
    medium: ["coffee", "tea", "rice", "sunflower", "tomatoes", "sugarcane"],
    high:   ["avocado", "coffee", "dairy", "poultry", "macadamia", "horticulture"],
  };
  const ROI_BANDS: Record<string, [number, number]> = {
    low: [8, 15], medium: [15, 22], high: [20, 30],
  };

  const prefs = RISK_CROP_PREFS[risk] ?? RISK_CROP_PREFS["medium"]!;
  const [roiMin, roiMax] = ROI_BANDS[risk] ?? [15, 22];

  // Trim listings to relevant fields for the prompt (keep token count manageable)
  const slim = listings.slice(0, 30).map((l: any) => ({
    id: l.id,
    farmName: l.farmName,
    cropType: l.cropType,
    location: l.location,
    pricePerShare: l.pricePerShare,
    sharesAvailable: l.sharesAvailable,
    changePercent: l.changePercent ?? 0,
    fundingProgress: l.fundingProgress ?? 0,
    daysToHarvest: l.daysToHarvest ?? 180,
  }));

  let selected: Array<{ id: number; reason: string; confidence: number; suggestedShares: number; suggestedAmount: number }> = [];

  const groqKey = process.env["GROQ_API_KEY"];
  if (groqKey) {
    try {
      const prompt = `You are an autonomous AI investment agent for Investa Farm, a Kenyan agriculture investment platform.

Investor parameters:
- Budget: KES ${budget.toLocaleString()}
- Risk profile: ${risk} (target ROI ${roiMin}–${roiMax}%)
- Max farms: ${maxFarms}
- Preferred crops: ${prefs.join(", ")}

Available farm listings (JSON):
${JSON.stringify(slim, null, 2)}

Select the best ${maxFarms} farm(s) that match the investor's risk profile and maximise expected returns within the budget.
For each selected farm, calculate the number of shares to buy (splitBudget/maxFarms ÷ pricePerShare, max sharesAvailable).

Respond ONLY with a valid JSON array — no other text:
[{"id": <farm_id>, "reason": "<1-sentence reason>", "confidence": <0-100>, "suggestedShares": <int>, "suggestedAmount": <int_kes>}]`;

      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 600,
          temperature: 0.3,
        }),
      });

      if (resp.ok) {
        const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
        const raw = data.choices[0]?.message?.content?.trim() ?? "";
        // Extract JSON array from response (Groq may wrap in markdown)
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            selected = parsed.slice(0, maxFarms).map((item: any) => {
              const listing = listings.find((l: any) => l.id === item.id);
              const perFarm = Math.floor(budget / maxFarms);
              const qty = listing
                ? Math.min(Math.max(1, Math.floor(perFarm / listing.pricePerShare)), listing.sharesAvailable)
                : item.suggestedShares ?? 1;
              return {
                id: item.id,
                reason: item.reason ?? "Strong match for risk profile",
                confidence: Math.min(99, Math.max(50, Number(item.confidence) || 75)),
                suggestedShares: qty,
                suggestedAmount: listing ? qty * listing.pricePerShare : item.suggestedAmount ?? perFarm,
              };
            });
          }
        }
      }
    } catch (e) {
      console.error("[agent/score] Groq error", (e as Error).message);
    }
  }

  // Fallback: deterministic scoring if Groq unavailable or parse failed
  if (selected.length === 0) {
    const perFarm = Math.floor(budget / maxFarms);
    const scored = slim
      .map(l => {
        const cropMatch = prefs.some(p => l.cropType?.toLowerCase().includes(p));
        const trendScore = Math.min(30, Math.max(0, (l.changePercent ?? 0) * 5));
        const liquidityScore = l.sharesAvailable > 50 ? 20 : 10;
        const score = (cropMatch ? 40 : 0) + trendScore + liquidityScore;
        return { ...l, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxFarms);

    selected = scored.map(l => {
      const qty = Math.min(Math.max(1, Math.floor(perFarm / l.pricePerShare)), l.sharesAvailable);
      const cropMatch = prefs.some(p => l.cropType?.toLowerCase().includes(p));
      return {
        id: l.id,
        reason: cropMatch
          ? `${l.cropType} aligns with your ${risk} risk profile and shows +${(l.changePercent ?? 0).toFixed(1)}% trend.`
          : `Diversification pick — strong liquidity with ${l.sharesAvailable} shares available.`,
        confidence: cropMatch ? 82 : 65,
        suggestedShares: qty,
        suggestedAmount: qty * l.pricePerShare,
      };
    });
  }

  res.json({ selected, roiRange: [roiMin, roiMax] });
});

export default router;
