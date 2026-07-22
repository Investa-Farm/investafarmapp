/**
 * Groq-powered risk scoring + explainability for the v2 pricing engine.
 *
 * Spec requirement (§6, Explainability): "Whatever model computes S must
 * support per-prediction feature attribution... store the top 3–5
 * contributing factors alongside each score."
 *
 * There's no trained GBM/SHAP pipeline in this MVP, so Groq (llama-3.3-70b)
 * plays that role directly: given the same structured inputs the deterministic
 * heuristic uses, it returns a 1–10 score plus signed factor attributions.
 * Falls back to the existing deterministic heuristic (same pattern used by
 * ai.ts /agent/score and loans.ts application scoring) whenever GROQ_API_KEY
 * is unset or the call fails — the pricing/listing flow must never hard-fail
 * because an LLM call didn't come back.
 */

import type { RiskFactor } from "./pricing-v2";

const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export interface RiskScoreInput {
  crop: string;
  location: string;
  farmerExperienceYears: number;
  farmerHarvestCount: number;
  weatherRisk: number;        // 0–1, higher = worse
  ndviVolatility: number;     // std dev of NDVI history, 0–1
  ndviAverage?: number;       // 0–1
  rainfallFactor: number;     // 0–1.3, from rainfall engine
  hasConfirmedOfftake: boolean;
  requestedCapitalKes: number;
  fallbackScore: number;      // deterministic S from computeRiskScore, used as a sanity anchor
}

export interface RiskScoreResult {
  score: number;              // S 1–10
  topFactors: RiskFactor[];
  source: "groq" | "fallback";
}

/** Deterministic explainability derived from the same heuristic weights the
 * fallback score used — always available, never depends on network I/O. */
export function fallbackFactors(input: RiskScoreInput): RiskFactor[] {
  const factors: RiskFactor[] = [];
  if (input.farmerHarvestCount === 0) {
    factors.push({ factor: "farmer_harvest_count", contribution: -0.8, detail: "No completed harvest history yet" });
  } else {
    factors.push({ factor: "farmer_harvest_count", contribution: +0.5, detail: `${input.farmerHarvestCount} completed harvest(s)` });
  }
  if (input.rainfallFactor < 0.65) {
    factors.push({ factor: "rainfall_forecast", contribution: -1.2, detail: "Below-normal rainfall forecast for the region" });
  } else if (input.rainfallFactor > 0.9) {
    factors.push({ factor: "rainfall_forecast", contribution: +0.6, detail: "Favourable rainfall forecast" });
  }
  if (input.ndviVolatility > 0.18) {
    factors.push({ factor: "ndvi_volatility", contribution: -0.7, detail: "Unstable vegetation index history" });
  } else if (input.ndviAverage !== undefined && input.ndviAverage > 0.6) {
    factors.push({ factor: "ndvi_trend", contribution: +0.6, detail: "Healthy vegetation index trend" });
  }
  if (!input.hasConfirmedOfftake) {
    factors.push({ factor: "offtake_confirmation", contribution: -0.9, detail: "No confirmed buyer for the harvest yet" });
  }
  if (input.weatherRisk > 0.5) {
    factors.push({ factor: "weather_risk", contribution: -0.5, detail: "Elevated weather risk this season" });
  }
  return factors.slice(0, 5);
}

export async function computeRiskScoreWithExplainability(input: RiskScoreInput): Promise<RiskScoreResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { score: input.fallbackScore, topFactors: fallbackFactors(input), source: "fallback" };
  }

  const prompt = `You are the underwriting risk model for Investa Farm, an agribusiness investment platform in Kenya.
Score this farm listing's risk on a 1–10 scale where 10 = lowest risk (safest) and 1 = highest risk.
Use the deterministic baseline score below as an anchor — only deviate from it if the inputs clearly justify a different score, and never move more than 2 points away from the baseline.

Inputs:
- Crop: ${input.crop}
- Location: ${input.location}
- Farmer experience: ${input.farmerExperienceYears} years
- Farmer completed harvests: ${input.farmerHarvestCount} (0 = first-time/cold-start farmer)
- Weather risk index (0-1, higher = worse): ${input.weatherRisk}
- NDVI volatility (0-1, higher = less stable crop health): ${input.ndviVolatility}
- NDVI average (0-1, if known): ${input.ndviAverage ?? "unknown"}
- Rainfall factor (0-1.3, 1.0 = normal): ${input.rainfallFactor}
- Confirmed off-taker/buyer for harvest: ${input.hasConfirmedOfftake ? "yes" : "no"}
- Requested capital: KES ${input.requestedCapitalKes.toLocaleString()}
- Deterministic baseline score: ${input.fallbackScore}/10

Respond ONLY with valid JSON (no markdown):
{"score": <integer 1-10>, "topFactors": [{"factor": "<short_snake_case_name>", "contribution": <signed number, positive = lowers risk, negative = raises risk>, "detail": "<one short sentence>"}]}
Return between 3 and 5 topFactors, ordered by |contribution| descending.`;

  try {
    const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 400,
      }),
    });

    if (!resp.ok) throw new Error(`Groq responded ${resp.status}`);

    const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in Groq response");

    const parsed = JSON.parse(match[0]) as { score: number; topFactors: RiskFactor[] };
    const score = Math.max(1, Math.min(10, Math.round(Number(parsed.score))));
    const topFactors = Array.isArray(parsed.topFactors) && parsed.topFactors.length > 0
      ? parsed.topFactors.slice(0, 5).map(f => ({
          factor: String(f.factor),
          contribution: Number(f.contribution) || 0,
          detail: f.detail ? String(f.detail) : undefined,
        }))
      : fallbackFactors(input);

    return { score, topFactors, source: "groq" };
  } catch (e) {
    console.error("[risk-score-ai] Groq error, using deterministic fallback:", (e as Error).message);
    return { score: input.fallbackScore, topFactors: fallbackFactors(input), source: "fallback" };
  }
}
