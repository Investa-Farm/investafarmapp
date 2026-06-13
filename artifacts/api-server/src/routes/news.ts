import { Router, type IRouter } from "express";
import { CROP_IMAGES } from "./crop-images";

const router: IRouter = Router();

let cache: { items: NewsItem[]; cachedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000;

interface NewsItem {
  id: number;
  title: string;
  source: string;
  summary: string;
  tag: string;
  tagColor: string;
  time: string;
  imageKey?: string;
  url?: string;
}

const STATIC_NEWS: NewsItem[] = [
  {
    id: 1,
    title: "Kenya Avocado Exports Hit Record High in Q2 2026",
    source: "Business Daily Africa",
    summary: "Kenya's avocado exports reached 150,000 metric tonnes in Q2 2026, driven by surging demand from European and Asian markets. Prices rose 12% year-on-year.",
    tag: "Exports",
    tagColor: "bg-green-100 text-green-700",
    time: "2h ago",
    imageKey: "avocado",
    url: "https://businessdailyafrica.com",
  },
  {
    id: 2,
    title: "Maize Prices Rise 8% Across East Africa as Rains Delay",
    source: "The Standard",
    summary: "Erratic long rains in the Rift Valley have pushed maize prices up 8% this week. Analysts expect further gains before the July harvest.",
    tag: "Market",
    tagColor: "bg-orange-100 text-orange-700",
    time: "5h ago",
    imageKey: "maize",
    url: "https://standardmedia.co.ke",
  },
  {
    id: 3,
    title: "Investa Farm Partners with Equity Bank for Farmer Financing",
    source: "Daily Nation",
    summary: "Investa Farm and Equity Bank have signed an MOU to provide KSh 500M in low-interest loans to smallholder farmers across 10 counties.",
    tag: "Investa",
    tagColor: "bg-blue-100 text-blue-700",
    time: "1d ago",
    imageKey: "wheat",
    url: "https://nation.africa",
  },
  {
    id: 4,
    title: "Coffee Farmers in Mt. Kenya See 22% Revenue Boost This Season",
    source: "Reuters Africa",
    summary: "Improved processing practices and fair-trade premiums have lifted coffee farmer incomes by an average of 22% in Kirinyaga and Murang'a counties.",
    tag: "Returns",
    tagColor: "bg-purple-100 text-purple-700",
    time: "1d ago",
    imageKey: "coffee",
    url: "https://reuters.com",
  },
  {
    id: 5,
    title: "Government Waives Import Duty on Fertilizers for 2026/27 Season",
    source: "KBC",
    summary: "The Cabinet Secretary for Agriculture announced a full waiver on fertilizer import duty, expected to reduce input costs for farmers by up to 30%.",
    tag: "Policy",
    tagColor: "bg-red-100 text-red-700",
    time: "2d ago",
    imageKey: "sunflower",
    url: "https://kbc.co.ke",
  },
  {
    id: 6,
    title: "Tea Auction Prices at Mombasa Hit 5-Year High",
    source: "Bloomberg Africa",
    summary: "Average tea prices at the Mombasa Tea Auction climbed to $2.89/kg this week — the highest in five years — as global supply tightens.",
    tag: "Market",
    tagColor: "bg-orange-100 text-orange-700",
    time: "3d ago",
    imageKey: "tea",
    url: "https://bloomberg.com",
  },
];

async function fetchGroqNews(): Promise<NewsItem[] | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  try {
    const today = new Date().toLocaleDateString("en-KE", { dateStyle: "long" });
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        max_tokens: 1800,
        messages: [
          {
            role: "user",
            content: `Generate 6 realistic Kenya agricultural news items for today, ${today}. Return ONLY a JSON array (no markdown, no explanation). Each item must have exactly: id (1-6), title (headline), source (one of: Business Daily Africa, Daily Nation, The Standard, Reuters Africa, Bloomberg Africa, KBC), summary (2 sentences), tag (one of: Exports, Market, Returns, Policy, Weather, Investa), tagColor (use "bg-green-100 text-green-700" for Exports/Returns, "bg-orange-100 text-orange-700" for Market, "bg-red-100 text-red-700" for Policy/Weather, "bg-blue-100 text-blue-700" for Investa, "bg-purple-100 text-purple-700" for Returns), time (e.g. "3h ago"), imageKey (one of: avocado, maize, coffee, tea, wheat, beans, tomatoes, sunflower), url ("#"). Topics: avocado exports, maize prices, tea auction, coffee, horticulture, farm input costs, Kenya agribusiness 2026.`,
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as NewsItem[];
    return null;
  } catch {
    return null;
  }
}

router.get("/news", async (_req, res): Promise<void> => {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    res.json(cache.items);
    return;
  }
  const groqNews = await fetchGroqNews();
  const items = groqNews ?? STATIC_NEWS;
  cache = { items, cachedAt: Date.now() };
  res.json(items);
});

export default router;
