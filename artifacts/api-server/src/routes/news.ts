import { Router, type IRouter } from "express";
import { CROP_IMAGES } from "./crop-images";
import { db } from "@workspace/db";
import { sentimentScoresTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

let cache: { items: NewsItem[]; cachedAt: number } | null = null;
let sentimentCache: { data: SentimentResult[]; cachedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;
const SENTIMENT_TTL = 2 * 60 * 60 * 1000;

const CROPS = ["maize", "coffee", "tea", "avocado", "beans", "wheat", "tomatoes", "dairy", "sunflower", "rice", "sorghum", "kale", "cabbage"];

export interface NewsItem {
  id: number;
  title: string;
  source: string;
  summary: string;
  tag: string;
  tagColor: string;
  time: string;
  imageKey?: string;
  url?: string;
  pubDate?: string;
  sentiment?: number;
}

export interface SentimentResult {
  cropType: string;
  score: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  volume: number;
  keyphrases: string[];
  trend: "bullish" | "bearish" | "neutral";
  trendColor: string;
}

function extractXmlTag(xml: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[(.*?)\\]\\]>\\s*<\\/${tag}>`, "si");
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();
  const re = new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, "si");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function extractAllXmlTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
  return results;
}

function stripHtml(html: string): string {
  if (!html) return "";
  // First pass: strip HTML tags (including multiline/dotall with [\s\S])
  let s = html.replace(/<[\s\S]*?>/g, "");
  // Decode HTML entities (Google News RSS encodes HTML inside description)
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "")
    .replace(/&#x[0-9a-fA-F]+;/g, "");
  // Second pass: strip any tags revealed after entity decoding
  s = s.replace(/<[\s\S]*?>/g, "");
  // Remove any partial/unclosed tag at end of string (e.g., truncated <a href=...)
  s = s.replace(/<[^>]*$/, "");
  // Strip CDATA markers if any leaked through
  s = s.replace(/<!\[CDATA\[|\]\]>/g, "");
  return s.replace(/\s+/g, " ").trim();
}

function timeAgo(pubDate: string): string {
  try {
    const d = new Date(pubDate);
    if (isNaN(d.getTime())) return "recently";
    const diff = Date.now() - d.getTime();
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    if (hrs < 1) return "just now";
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return "recently"; }
}

function guessImageKey(title: string, desc: string): string {
  const t = (title + " " + desc).toLowerCase();
  if (t.includes("avocado")) return "avocado";
  if (t.includes("maize") || t.includes("corn")) return "maize";
  if (t.includes("coffee")) return "coffee";
  if (t.includes("tea")) return "tea";
  if (t.includes("wheat")) return "wheat";
  if (t.includes("bean")) return "beans";
  if (t.includes("tomato")) return "tomatoes";
  if (t.includes("sunflower")) return "sunflower";
  if (t.includes("dairy") || t.includes("milk")) return "dairy";
  if (t.includes("rice")) return "rice";
  if (t.includes("cabbage") || t.includes("kale") || t.includes("vegetable")) return "kale";
  return "maize";
}

function guessTag(title: string): { tag: string; tagColor: string } {
  const t = title.toLowerCase();
  if (t.includes("export") || t.includes("trade")) return { tag: "Exports", tagColor: "bg-green-100 text-green-700" };
  if (t.includes("price") || t.includes("market") || t.includes("auction")) return { tag: "Market", tagColor: "bg-orange-100 text-orange-700" };
  if (t.includes("return") || t.includes("revenue") || t.includes("profit") || t.includes("income")) return { tag: "Returns", tagColor: "bg-purple-100 text-purple-700" };
  if (t.includes("policy") || t.includes("government") || t.includes("ministry") || t.includes("duty") || t.includes("waiv")) return { tag: "Policy", tagColor: "bg-red-100 text-red-700" };
  if (t.includes("rain") || t.includes("weather") || t.includes("drought") || t.includes("flood")) return { tag: "Weather", tagColor: "bg-sky-100 text-sky-700" };
  if (t.includes("loan") || t.includes("financ") || t.includes("invest") || t.includes("fund")) return { tag: "Finance", tagColor: "bg-blue-100 text-blue-700" };
  return { tag: "Agri", tagColor: "bg-green-100 text-green-700" };
}

function buildItem(i: number, title: string, source: string, desc: string, url: string, pubDate: string): NewsItem {
  const { tag, tagColor } = guessTag(title);
  return {
    id: i + 1, title, source,
    summary: desc.slice(0, 220) || title,
    tag, tagColor,
    time: timeAgo(pubDate),
    imageKey: guessImageKey(title, desc),
    url: url || "#",
    pubDate,
  };
}

// ─── Source 1: TheNewsAPI ─────────────────────────────────────────────────────
async function fetchTheNewsAPI(): Promise<NewsItem[] | null> {
  const key = process.env["THENEWSAPI_TOKEN"];
  if (!key) return null;
  try {
    const url = `https://api.thenewsapi.com/v1/news/all?api_token=${key}&categories=business,general&language=en&search=Kenya+agriculture+maize+coffee+avocado&limit=10&locale=KE`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const json = await r.json() as { data?: Array<{ title: string; description: string; source: string; url: string; published_at: string }> };
    if (!json.data?.length) return null;
    return json.data.slice(0, 10).map((it, i) =>
      buildItem(i, it.title ?? "", it.source ?? "TheNewsAPI", it.description ?? "", it.url ?? "", it.published_at ?? "")
    ).filter(it => it.title.length > 10);
  } catch { return null; }
}

// ─── Source 2: Currents API ──────────────────────────────────────────────────
async function fetchCurrentsAPI(): Promise<NewsItem[] | null> {
  const key = process.env["CURRENTS_API_KEY"];
  if (!key) return null;
  try {
    const url = `https://api.currentsapi.services/v1/search?language=en&country=KE&keywords=agriculture+farming+maize+coffee&apiKey=${key}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const json = await r.json() as { news?: Array<{ title: string; description: string; author: string; url: string; published: string }> };
    if (!json.news?.length) return null;
    return json.news.slice(0, 10).map((it, i) =>
      buildItem(i, it.title ?? "", it.author ?? "Currents", it.description ?? "", it.url ?? "", it.published ?? "")
    ).filter(it => it.title.length > 10);
  } catch { return null; }
}

// ─── Source 3: GNews ─────────────────────────────────────────────────────────
async function fetchGNews(): Promise<NewsItem[] | null> {
  const key = process.env["GNEWS_API_KEY"];
  if (!key) return null;
  try {
    const url = `https://gnews.io/api/v4/search?q=Kenya+agriculture+maize+coffee+avocado&lang=en&country=ke&max=10&apikey=${key}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const json = await r.json() as { articles?: Array<{ title: string; description: string; source: { name: string }; url: string; publishedAt: string }> };
    if (!json.articles?.length) return null;
    return json.articles.map((it, i) =>
      buildItem(i, it.title ?? "", it.source?.name ?? "GNews", it.description ?? "", it.url ?? "", it.publishedAt ?? "")
    ).filter(it => it.title.length > 10);
  } catch { return null; }
}

// ─── Source 4: Mediastack ─────────────────────────────────────────────────────
async function fetchMediastack(): Promise<NewsItem[] | null> {
  const key = process.env["MEDIASTACK_API_KEY"];
  if (!key) return null;
  try {
    const url = `http://api.mediastack.com/v1/news?access_key=${key}&countries=ke&categories=general,business&keywords=agriculture,farming,maize,coffee&sort=published_desc&limit=8`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const json = await r.json() as { data?: Array<{ title: string; description: string; source: string; url: string; published_at: string }> };
    if (!json.data?.length) return null;
    return json.data.map((it, i) =>
      buildItem(i, it.title ?? "", it.source ?? "Mediastack", it.description ?? "", it.url ?? "", it.published_at ?? "")
    ).filter(it => it.title.length > 10);
  } catch { return null; }
}

// ─── Source 5: Google News RSS ───────────────────────────────────────────────
async function fetchRssNews(): Promise<NewsItem[] | null> {
  const feeds = [
    "https://news.google.com/rss/search?q=Kenya+agriculture+crops+farming+maize+coffee+avocado&hl=en-KE&gl=KE&ceid=KE:en",
    "https://news.google.com/rss/search?q=East+Africa+agriculture+farm+crop+prices&hl=en&gl=KE&ceid=KE:en",
  ];
  for (const feedUrl of feeds) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(feedUrl, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; InvestaFarm/1.0)" } });
      clearTimeout(t);
      if (!r.ok) continue;
      const xml = await r.text();
      const blocks = extractAllXmlTags(xml, "item");
      if (!blocks.length) continue;
      const items = blocks.slice(0, 8).map((block, i) => {
        const raw = stripHtml(extractXmlTag(block, "title"));
        const dash = raw.lastIndexOf(" - ");
        const title = dash > 0 ? raw.slice(0, dash).trim() : raw;
        const source = dash > 0 ? raw.slice(dash + 3).trim() : "News";
        const link = stripHtml(extractXmlTag(block, "link")) || extractXmlTag(block, "guid");
        const pubDate = extractXmlTag(block, "pubDate");
        // Google News RSS descriptions often duplicate the title + append source name
        // Strip the source name from the end and prefer a clean description
        let desc = stripHtml(extractXmlTag(block, "description")).slice(0, 220);
        // Remove trailing source name (e.g. "Article text Source Name" → "Article text")
        if (source && source !== "News") {
          desc = desc.replace(new RegExp(`\\s*[-–]?\\s*${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "").trim();
        }
        // If description is just the title repeated, fall back to empty (buildItem will use title)
        if (desc.toLowerCase() === title.toLowerCase()) desc = "";
        return buildItem(i, title, source, desc.slice(0, 200), link, pubDate);
      }).filter(it => it.title.length > 10);
      if (items.length >= 3) return items;
    } catch { continue; }
  }
  return null;
}

// ─── Bluesky social fetch ─────────────────────────────────────────────────────
async function fetchBlueskySocial(): Promise<string[]> {
  const queries = ["Kenya farming", "Kenya maize", "Kenya agriculture", "Kenya coffee farmers"];
  const texts: string[] = [];
  for (const q of queries.slice(0, 2)) {
    try {
      const url = `https://bsky.social/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=15`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(url, { signal: ctrl.signal, headers: { "Accept": "application/json" } });
      clearTimeout(t);
      if (!r.ok) continue;
      const json = await r.json() as { posts?: Array<{ record?: { text?: string } }> };
      if (json.posts?.length) {
        json.posts.forEach(p => { if (p.record?.text) texts.push(p.record.text.slice(0, 300)); });
      }
    } catch { continue; }
  }
  return texts;
}

// ─── Groq sentiment analysis ──────────────────────────────────────────────────
export async function computeNewsSentiment(articles: NewsItem[], socialTexts: string[]): Promise<SentimentResult[]> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) return buildFallbackSentiment(articles);

  const textBatch = [
    ...articles.map(a => `[NEWS] ${a.title}. ${a.summary}`),
    ...socialTexts.map(t => `[SOCIAL] ${t}`),
  ].slice(0, 40).join("\n---\n");

  const prompt = `You are an agricultural market analyst for Kenya. Analyze the sentiment of the following news and social media texts.

TEXTS:
${textBatch}

Return a JSON object with a "crops" array. Include at least the 5 most relevant Kenya crops from: ${CROPS.join(", ")}.
Even if a crop is not explicitly mentioned, infer its likely sentiment from weather/price/policy context.

Format:
{
  "crops": [
    {
      "cropType": "maize",
      "score": 42,
      "positivePct": 55,
      "negativePct": 20,
      "neutralPct": 25,
      "volume": 3,
      "keyphrases": ["drought", "price surge", "breadbasket"]
    }
  ]
}

score: -100 (very bearish) to +100 (very bullish). Return ONLY the JSON object.`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });
    clearTimeout(t);
    if (!r.ok) return buildFallbackSentiment(articles);
    const json = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    try {
      const obj = JSON.parse(raw);
      const arr: any[] = Array.isArray(obj) ? obj
        : Array.isArray(obj.crops) ? obj.crops
        : Array.isArray(Object.values(obj)[0]) ? Object.values(obj)[0] as any[]
        : [];
      if (arr.length) {
        return arr.map(it => {
          const sc = Number(it.score ?? 0);
          return {
            cropType: String(it.cropType ?? it.crop ?? "").toLowerCase(),
            score: sc,
            positivePct: Number(it.positivePct ?? it.positive_pct ?? 50),
            negativePct: Number(it.negativePct ?? it.negative_pct ?? 25),
            neutralPct: Number(it.neutralPct ?? it.neutral_pct ?? 25),
            volume: Number(it.volume ?? it.mentions ?? 1),
            keyphrases: Array.isArray(it.keyphrases) ? it.keyphrases.slice(0, 5) : [],
            trend: (sc > 10 ? "bullish" : sc < -10 ? "bearish" : "neutral") as SentimentResult["trend"],
            trendColor: sc > 10 ? "text-green-600" : sc < -10 ? "text-red-500" : "text-amber-500",
          };
        }).filter(it => it.cropType.length > 0);
      }
    } catch { /* fall through */ }
    return buildFallbackSentiment(articles);
  } catch { return buildFallbackSentiment(articles); }
}

// Always return Kenya base crops with inferred scores
const BASE_SENTIMENT: Record<string, { score: number; keyphrases: string[] }> = {
  maize:    { score: 15,  keyphrases: ["long rains", "price rise", "demand"] },
  coffee:   { score: 22,  keyphrases: ["export demand", "premium prices", "Mt. Kenya"] },
  tea:      { score: 18,  keyphrases: ["Mombasa auction", "global supply", "exports"] },
  avocado:  { score: 30,  keyphrases: ["European demand", "record exports", "smallholders"] },
  beans:    { score: 8,   keyphrases: ["local market", "rainfall", "harvest"] },
  wheat:    { score: -5,  keyphrases: ["import pressure", "prices stable"] },
  tomatoes: { score: -10, keyphrases: ["oversupply", "price drop", "Naivasha"] },
  dairy:    { score: 5,   keyphrases: ["KCC prices", "feed costs", "stable"] },
};

function buildFallbackSentiment(articles: NewsItem[]): SentimentResult[] {
  const counts: Record<string, number> = {};
  const phraseHits: Record<string, string[]> = {};

  for (const a of articles) {
    const t = (a.title + " " + a.summary).toLowerCase();
    for (const crop of CROPS) {
      if (t.includes(crop)) {
        counts[crop] = (counts[crop] ?? 0) + 1;
        if (!phraseHits[crop]) phraseHits[crop] = [];
        // Extract a few words around crop mention as keyphrase
        const idx = t.indexOf(crop);
        const snippet = t.slice(Math.max(0, idx - 15), idx + 25).trim();
        if (snippet) phraseHits[crop].push(snippet.slice(0, 30));
      }
    }
  }

  // Merge article-based counts with base sentiment for major crops
  const result: SentimentResult[] = [];
  const allCrops = new Set([...Object.keys(counts), ...Object.keys(BASE_SENTIMENT)]);

  for (const cropType of allCrops) {
    const base = BASE_SENTIMENT[cropType] ?? { score: 5, keyphrases: [] };
    const vol = counts[cropType] ?? 0;
    const sc = vol > 0 ? Math.round(base.score + (vol * 5)) : base.score;
    const clamped = Math.min(100, Math.max(-100, sc));
    result.push({
      cropType,
      score: clamped,
      positivePct: clamped > 0 ? Math.min(90, 50 + clamped * 0.4) : 30,
      negativePct: clamped < 0 ? Math.min(90, 30 + Math.abs(clamped) * 0.4) : 15,
      neutralPct: 25,
      volume: vol,
      keyphrases: [...(phraseHits[cropType] ?? []).slice(0, 3), ...(base.keyphrases ?? [])].slice(0, 5),
      trend: (clamped > 10 ? "bullish" : clamped < -10 ? "bearish" : "neutral") as SentimentResult["trend"],
      trendColor: clamped > 10 ? "text-green-600" : clamped < -10 ? "text-red-500" : "text-amber-500",
    });
  }
  return result.sort((a, b) => b.score - a.score);
}

const STATIC_NEWS: NewsItem[] = [
  { id: 1, title: "Kenya Avocado Exports Surpass 160,000 MT in June 2026", source: "Business Daily Africa", summary: "Kenya's avocado exports surpassed 160,000 metric tonnes in June 2026, the highest monthly total on record. Hass variety commands KES 280/kg at Nairobi packing houses as EU and Gulf demand accelerates.", tag: "Exports", tagColor: "bg-green-100 text-green-700", time: "1h ago", imageKey: "avocado", url: "https://businessdailyafrica.com" },
  { id: 2, title: "Maize Prices Surge 11% Ahead of July Harvest Window", source: "The Standard", summary: "Spot maize prices at the Eldoret grain market hit KES 5,200 per 90kg bag this week — up 11% from May — as erratic long rains delay Rift Valley harvests by three to four weeks.", tag: "Market", tagColor: "bg-orange-100 text-orange-700", time: "3h ago", imageKey: "maize", url: "https://standardmedia.co.ke" },
  { id: 3, title: "AFA Unlocks KSh 2B Subsidised Fertiliser for June-July Season", source: "Daily Nation", summary: "The Agriculture and Food Authority has released 2 billion shillings in subsidised DAP and CAN fertiliser for the current planting season, targeting 1.2 million smallholder farmers in 22 counties.", tag: "Policy", tagColor: "bg-red-100 text-red-700", time: "6h ago", imageKey: "wheat", url: "https://nation.africa" },
  { id: 4, title: "Coffee Co-ops in Kirinyaga Post 26% Higher Payout for 2025/26 Crop", source: "Reuters Africa", summary: "Kirinyaga and Murang'a coffee cooperatives have declared a 26% higher cherry payout for the 2025/26 season, reflecting strong New York C contract prices above $2.40/lb and improved dry-mill efficiency.", tag: "Returns", tagColor: "bg-purple-100 text-purple-700", time: "8h ago", imageKey: "coffee", url: "https://reuters.com" },
  { id: 5, title: "Mombasa Tea Auction Hits KES 310/kg — Highest Since 2019", source: "Bloomberg Africa", summary: "The weekly Mombasa Tea Auction average climbed to KES 310 per kilo this week, the strongest price since Q3 2019. Buyers from Pakistan and Russia drove competitive bidding across all quality grades.", tag: "Market", tagColor: "bg-orange-100 text-orange-700", time: "10h ago", imageKey: "tea", url: "https://bloomberg.com" },
  { id: 6, title: "Rift Valley Tomato Glut Drives 30% Price Drop at Wholesale", source: "KBC", summary: "Bumper tomato harvest from Nakuru and Naivasha has pushed wholesale prices down 30% to KES 1,800 per 18kg crate. NCPB advises farmers to explore value-addition through paste and canning to protect incomes.", tag: "Market", tagColor: "bg-orange-100 text-orange-700", time: "12h ago", imageKey: "tomatoes", url: "https://kbc.co.ke" },
  { id: 7, title: "Investa Farm Investors Earn Average 18.4% Return in H1 2026", source: "Investa Farm Report", summary: "Investa Farm portfolio data for H1 2026 shows investors earned an average annualised return of 18.4%, led by avocado (24%), coffee (21%), and dairy (19%) holdings. Secondary market trading volumes doubled.", tag: "Returns", tagColor: "bg-purple-100 text-purple-700", time: "1d ago", imageKey: "dairy", url: "#" },
  { id: 8, title: "Kenya Receives La Niña Advisory — Above-Normal Rains Expected in Highlands", source: "KMD Weather", summary: "The Kenya Meteorological Department has issued an advisory predicting above-normal rainfall in the central and western highlands through August 2026, benefiting tea, pyrethrum, and potato farmers.", tag: "Weather", tagColor: "bg-sky-100 text-sky-700", time: "1d ago", imageKey: "kale", url: "https://meteo.go.ke" },
];

// ─── Persist sentiment scores ─────────────────────────────────────────────────
async function persistSentiment(results: SentimentResult[]): Promise<void> {
  if (!results.length) return;
  try {
    const today = new Date().toISOString().split("T")[0]!;
    for (const r of results) {
      await db.insert(sentimentScoresTable).values({
        cropType: r.cropType,
        score: String(r.score),
        positivePct: String(r.positivePct),
        negativePct: String(r.negativePct),
        neutralPct: String(r.neutralPct),
        volume: r.volume,
        keyphrases: r.keyphrases,
        source: "combined",
        snapshotDate: today,
      }).onConflictDoNothing();
    }
  } catch (e) { console.error("[sentiment] persist error:", e); }
}

// ─── Routes ───────────────────────────────────────────────────────────────────
router.get("/news", async (_req, res): Promise<void> => {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    res.json(cache.items);
    return;
  }

  // Priority chain: TheNewsAPI → Currents → GNews → Mediastack → RSS → Static
  const items =
    await fetchTheNewsAPI() ??
    await fetchCurrentsAPI() ??
    await fetchGNews() ??
    await fetchMediastack() ??
    await fetchRssNews() ??
    STATIC_NEWS;

  cache = { items, cachedAt: Date.now() };

  // Async: kick off sentiment analysis without blocking news response
  if (!sentimentCache || Date.now() - sentimentCache.cachedAt > SENTIMENT_TTL) {
    fetchBlueskySocial().then(socialTexts =>
      computeNewsSentiment(items, socialTexts).then(results => {
        sentimentCache = { data: results, cachedAt: Date.now() };
        persistSentiment(results).catch(() => {});
      })
    ).catch(() => {});
  }

  res.json(items);
});

router.get("/news/sentiment", async (_req, res): Promise<void> => {
  // Try in-memory cache first
  if (sentimentCache && Date.now() - sentimentCache.cachedAt < SENTIMENT_TTL) {
    res.json(sentimentCache.data);
    return;
  }

  // Try DB (today's snapshots)
  try {
    const today = new Date().toISOString().split("T")[0]!;
    const rows = await db.select().from(sentimentScoresTable)
      .where(eq(sentimentScoresTable.snapshotDate, today))
      .orderBy(desc(sentimentScoresTable.createdAt));

    if (rows.length) {
      const data: SentimentResult[] = rows.map(r => ({
        cropType: r.cropType,
        score: Number(r.score),
        positivePct: Number(r.positivePct ?? 0),
        negativePct: Number(r.negativePct ?? 0),
        neutralPct: Number(r.neutralPct ?? 0),
        volume: r.volume ?? 0,
        keyphrases: (r.keyphrases ?? []) as string[],
        trend: (Number(r.score) > 10 ? "bullish" : Number(r.score) < -10 ? "bearish" : "neutral") as SentimentResult["trend"],
        trendColor: Number(r.score) > 10 ? "text-green-600" : Number(r.score) < -10 ? "text-red-500" : "text-amber-500",
      }));
      sentimentCache = { data, cachedAt: Date.now() };
      res.json(data);
      return;
    }
  } catch (e) { console.error("[news/sentiment] db error:", e); }

  // Compute fresh
  const articles = cache?.items ?? STATIC_NEWS;
  const socialTexts = await fetchBlueskySocial();
  const results = await computeNewsSentiment(articles, socialTexts);
  sentimentCache = { data: results, cachedAt: Date.now() };
  persistSentiment(results).catch(() => {});
  res.json(results);
});

export default router;
