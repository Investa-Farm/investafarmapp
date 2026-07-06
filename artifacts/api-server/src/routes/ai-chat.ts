import { Router, type IRouter } from "express";
import { getCurrentUser } from "./auth";
import { z } from "zod";

const router: IRouter = Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const ChatBody = z.object({
  message: z.string().min(1).max(600),
  context: z.string().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
});

// ── Investment intent parser ───────────────────────────────────────────────
function parseInvestIntent(msg: string): {
  budget: number | null;
  months: number | null;
  risk: "low" | "medium" | "high" | null;
  maxFarms: number | null;
} {
  const lower = msg.toLowerCase();

  // Budget — match patterns like "20k", "20,000", "KES 20000", "20.5k"
  let budget: number | null = null;
  // Pattern: optional KES prefix, number with optional commas/decimals, optional k/K suffix
  const budgetMatch = lower.match(/(?:kes\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k\b)?/);
  if (budgetMatch) {
    const raw = parseFloat(budgetMatch[1]!.replace(/,/g, ""));
    const hasK = !!budgetMatch[2]; // captured trailing 'k'
    budget = hasK ? raw * 1000 : raw;
    // Sanity: budgets under 500 are likely months/shares — ignore
    if (budget < 500) budget = null;
  }

  // Duration in months
  let months: number | null = null;
  const monthMatch = lower.match(/(\d+)\s*(?:month|mo\b)/);
  const weekMatch = lower.match(/(\d+)\s*(?:week|wk\b)/);
  const dayMatch = lower.match(/(\d+)\s*(?:day|d\b)/);
  if (monthMatch) months = parseInt(monthMatch[1]!);
  else if (weekMatch) months = Math.round(parseInt(weekMatch[1]!) / 4);
  else if (dayMatch) months = Math.max(1, Math.round(parseInt(dayMatch[1]!) / 30));

  // Duration keywords
  if (!months) {
    if (/short.?term|quick|30\s*day|one month/.test(lower)) months = 1;
    else if (/half.?year|6 month/.test(lower)) months = 6;
    else if (/full.?season|long.?term/.test(lower)) months = 6;
  }

  // Risk level
  let risk: "low" | "medium" | "high" | null = null;
  if (/low|safe|conserv|stable|protect/.test(lower)) risk = "low";
  else if (/high|aggress|max|bold|risky/.test(lower)) risk = "high";
  else if (/medium|moderate|balanc|mixed/.test(lower)) risk = "medium";

  // Number of farms
  let maxFarms: number | null = null;
  const farmMatch = lower.match(/(\d+)\s*farm/);
  if (farmMatch) maxFarms = Math.min(5, Math.max(1, parseInt(farmMatch[1]!)));

  return { budget, months, risk, maxFarms };
}

function hasInvestIntent(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    /\binvest\b|\bput\b.*\bfarm|\bbuy.*(share|farm)|\bplace\b.*\binvest/.test(lower) &&
    /\d/.test(lower)
  );
}

// ── System prompt ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Investa, a friendly AI investment assistant for Investa Farm — Kenya's leading farm investment platform.

Your personality: warm, confident, concise. You speak in plain English (or Swahili if the user does). Use KES currency.

Rules:
- Keep replies under 120 words.
- When the user expresses intent to invest (e.g. "invest 20k for 3 months"), confirm back the parameters you extracted and say you're ready to go — DO NOT explain what you're about to do at length.
- For general questions, be educational but brief.
- Never invent specific farm names or fabricate return figures — use ranges (e.g. 12–28%).
- If the user says "yes", "go ahead", "do it", "confirm", or similar → reply "Executing now..." (the frontend handles the actual transaction).
- Available exit types: Mid-Season (~1–3 months), Full Season (~6 months).`;

// ── Fallback replies (no Groq key) ────────────────────────────────────────
function getFallbackReply(msg: string, intent: ReturnType<typeof parseInvestIntent>): string {
  const lower = msg.toLowerCase();

  if (hasInvestIntent(msg) && intent.budget) {
    const risk = intent.risk ?? "medium";
    const months = intent.months ?? 4;
    const farms = intent.maxFarms ?? 3;
    return `Got it! I'll invest KES ${intent.budget.toLocaleString()} across up to ${farms} farm${farms !== 1 ? "s" : ""} with a ${risk} risk profile targeting a ${months}-month exit. Shall I go ahead?`;
  }
  if (/return|earn|profit|roi/.test(lower))
    return "Investa Farm returns range from 8–15% (conservative) to 20–30% (aggressive) per season. Mid-Season exits in 30–90 days, Full Season ~6 months.";
  if (/safe|risk|protect/.test(lower))
    return "Every investment is backed by KYC-verified farmers and a 5% Farmer Protection Fund. Conservative picks (maize, beans, kale) are the most stable.";
  if (/minimum|start|how much/.test(lower))
    return "You can start from as little as KES 5,000 — roughly 50 shares at KES 100/share. Spread across 3–5 farms for best diversification.";
  if (/kyc|verify|document/.test(lower))
    return "KYC needs: your National ID (front & back) + a live selfie. Upload via your Profile tab. Approval usually takes 24–48 hrs.";
  return "I can help you invest, explain returns, or walk you through how Investa Farm works. What would you like to know? 🌾";
}

// ── Route ──────────────────────────────────────────────────────────────────
router.post("/ai/chat", async (req, res): Promise<void> => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = ChatBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { message, context, history = [] } = parsed.data;

    // Detect investment intent
    const intent = parseInvestIntent(message);
    const isInvest = hasInvestIntent(message);
    let action: {
      type: "invest";
      budget: number;
      months: number;
      risk: "low" | "medium" | "high";
      maxFarms: number;
    } | null = null;

    if (isInvest && intent.budget && intent.budget >= 500) {
      action = {
        type: "invest",
        budget: intent.budget,
        months: intent.months ?? 4,
        risk: intent.risk ?? "medium",
        maxFarms: intent.maxFarms ?? 3,
      };
    }

    if (!GROQ_API_KEY) {
      const reply = getFallbackReply(message, intent);
      res.json({ reply, action });
      return;
    }

    // Build message history for Groq (last 6 turns max)
    const recentHistory = history.slice(-6);

    const groqMessages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: SYSTEM_PROMPT + (context ? `\n\nUser context: ${context}` : ""),
      },
      ...recentHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 200,
        temperature: 0.5,
        messages: groqMessages,
      }),
    });

    if (!r.ok) throw new Error(`Groq ${r.status}`);
    const data = (await r.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const reply =
      data.choices?.[0]?.message?.content ?? getFallbackReply(message, intent);

    res.json({ reply, action });
  } catch (err) {
    console.error("[AI_CHAT]", (err as Error).message);
    res.json({ reply: getFallbackReply(req.body?.message ?? "", parseInvestIntent(req.body?.message ?? "")), action: null });
  }
});

export default router;
