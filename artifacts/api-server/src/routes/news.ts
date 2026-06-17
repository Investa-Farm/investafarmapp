import { Router, type IRouter } from "express";
import { CROP_IMAGES } from "./crop-images";

const router: IRouter = Router();

let cache: { items: NewsItem[]; cachedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

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
  pubDate?: string;
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
    title: "Smallholder Farmers Access New Low-Interest Financing",
    source: "Daily Nation",
    summary: "A new financing initiative is providing KSh 500M in low-interest loans to smallholder farmers across 10 counties, reducing barriers to crop investment.",
    tag: "Finance",
    tagColor: "bg-blue-100 text-blue-700",
    time: "1d ago",
    imageKey: "wheat",
    url: "https://nation.africa",
  },
  {
    id: 4,
    title: "Coffee Farmers in Mt. Kenya See 22% Revenue Boost",
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
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
}

function timeAgo(pubDate: string): string {
  try {
    const d = new Date(pubDate);
    const diff = Date.now() - d.getTime();
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    if (hrs < 1) return "just now";
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "recently";
  }
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
  if (t.includes("cabbage") || t.includes("vegetable")) return "cabbage";
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

async function fetchRssNews(): Promise<NewsItem[] | null> {
  // Use Google News RSS for Kenya agriculture — no API key needed
  const feeds = [
    "https://news.google.com/rss/search?q=Kenya+agriculture+crops+farming+maize+coffee+avocado&hl=en-KE&gl=KE&ceid=KE:en",
    "https://news.google.com/rss/search?q=East+Africa+agriculture+farm+crop+prices&hl=en&gl=KE&ceid=KE:en",
  ];

  for (const feedUrl of feeds) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(feedUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; InvestaFarm/1.0)" },
      });
      clearTimeout(timeout);
      if (!res.ok) continue;

      const xml = await res.text();
      const itemBlocks = extractAllXmlTags(xml, "item");
      if (itemBlocks.length === 0) continue;

      const items: NewsItem[] = itemBlocks.slice(0, 8).map((block, i) => {
        const rawTitle = stripHtml(extractXmlTag(block, "title"));
        // Google News titles are "Headline - Source" format
        const dashIdx = rawTitle.lastIndexOf(" - ");
        const title = dashIdx > 0 ? rawTitle.slice(0, dashIdx).trim() : rawTitle;
        const source = dashIdx > 0 ? rawTitle.slice(dashIdx + 3).trim() : "News";
        const link = stripHtml(extractXmlTag(block, "link")) || extractXmlTag(block, "guid");
        const pubDate = extractXmlTag(block, "pubDate");
        const desc = stripHtml(extractXmlTag(block, "description")).slice(0, 200);
        const summary = desc || title;
        const imageKey = guessImageKey(title, desc);
        const { tag, tagColor } = guessTag(title);

        return {
          id: i + 1,
          title,
          source,
          summary,
          tag,
          tagColor,
          time: timeAgo(pubDate),
          imageKey,
          url: link || "#",
          pubDate,
        };
      }).filter(item => item.title.length > 10);

      if (items.length >= 3) return items;
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchMediastackNews(): Promise<NewsItem[] | null> {
  const apiKey = process.env["MEDIASTACK_API_KEY"];
  if (!apiKey) return null;
  try {
    const url = `http://api.mediastack.com/v1/news?access_key=${apiKey}&countries=ke&categories=general,business&keywords=agriculture,farming,maize,coffee,avocado&sort=published_desc&limit=8`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json() as { data?: Array<{ title: string; description: string; source: string; url: string; published_at: string; image?: string }> };
    if (!json.data?.length) return null;
    return json.data.map((item, i) => {
      const { tag, tagColor } = guessTag(item.title ?? "");
      const imageKey = guessImageKey(item.title ?? "", item.description ?? "");
      return {
        id: i + 1,
        title: item.title ?? "",
        source: item.source ?? "News",
        summary: (item.description ?? item.title ?? "").slice(0, 200),
        tag, tagColor,
        time: timeAgo(item.published_at ?? ""),
        imageKey,
        url: item.url ?? "#",
        pubDate: item.published_at,
      } as NewsItem;
    }).filter(it => it.title.length > 10);
  } catch {
    return null;
  }
}

router.get("/news", async (_req, res): Promise<void> => {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    res.json(cache.items);
    return;
  }
  const msNews = await fetchMediastackNews();
  const items = msNews ?? await fetchRssNews() ?? STATIC_NEWS;
  cache = { items, cachedAt: Date.now() };
  res.json(items);
});

export default router;
