import { Router, type IRouter } from "express";
import { getCurrentUser } from "./auth";
import { db, marketListingsTable } from "@workspace/db";
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
    .select()
    .from(marketListingsTable)
    .where(eq(marketListingsTable.status, "active"))
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
    res.status(503).json({ error: "AI matching temporarily unavailable. Please try again." });
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

export default router;
