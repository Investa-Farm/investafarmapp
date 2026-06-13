import { Router, type IRouter } from "express";
import { getCurrentUser } from "./auth";
import { z } from "zod";

const router: IRouter = Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const ChatBody = z.object({
  message: z.string().min(1).max(500),
  context: z.string().optional(),
});

const SYSTEM_PROMPT = `You are an AI financial assistant for Investa Farm — Kenya's leading farm investment platform.
You help investors understand farm investments, returns, and how the platform works.
Keep answers concise (under 150 words), practical, and focused on Kenyan farming context.
Use KES currency. Always be encouraging and educational.
If asked to perform actions (invest, open portfolio), tell the user you'll navigate them there.
Do NOT invent farm data — only use provided context.`;

router.post("/ai/chat", async (req, res): Promise<void> => {
  await getCurrentUser(req);

  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { message, context } = parsed.data;

  if (!GROQ_API_KEY) {
    res.json({ reply: getFallbackReply(message) });
    return;
  }

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        max_tokens: 200,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + (context ? `\n\nCurrent data: ${context}` : "") },
          { role: "user", content: message },
        ],
      }),
    });

    if (!r.ok) throw new Error(`Groq error: ${r.status}`);
    const data = await r.json() as any;
    const reply = data.choices?.[0]?.message?.content ?? getFallbackReply(message);
    res.json({ reply });
  } catch {
    res.json({ reply: getFallbackReply(message) });
  }
});

function getFallbackReply(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes("return") || lower.includes("earn")) {
    return "You earn returns at harvest: ⚡ Mid-Season +8–12% in 30–60 days, or 🌾 Full Season up to +28% in ~6 months. Returns are paid to your Investa Wallet.";
  }
  if (lower.includes("safe") || lower.includes("risk")) {
    return "Investa Farm protects investors with a Farmer Protection Fund (5% of all investments), KYC-verified farmers, and weather insurance. Agricultural investments carry market risk — diversify across crops.";
  }
  if (lower.includes("minimum") || lower.includes("start")) {
    return "You can start investing from KES 5,000 — about 50 shares at KES 100/share. Spread across 3–5 farms for best risk management.";
  }
  if (lower.includes("kyc")) {
    return "KYC requires: 📄 National ID (front & back) and 🤳 a live selfie. Upload from your Profile tab. Review takes 24–48 hours, then you unlock full trading.";
  }
  return "Great question! I can help you explore available farm investments, understand returns, manage your portfolio, or explain how Investa Farm works. What would you like to know? 🌾";
}

export default router;
