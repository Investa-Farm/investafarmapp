import { Router, type IRouter } from "express";
import { getCurrentUser } from "./auth";

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

export default router;
