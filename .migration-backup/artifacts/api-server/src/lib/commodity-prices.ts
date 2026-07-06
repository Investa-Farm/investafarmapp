import { logger } from "./logger";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface LiveCommodityPrice {
  price: number;
  unit: string;
  source: "worldbank" | "ai" | "fallback";
}

export interface LiveCommodityPrices {
  prices: Record<string, LiveCommodityPrice>;
  fetchedAt: string;
  kesPerUsd: number;
}

const STATIC_DEFAULTS: Record<string, { price: number; unit: string }> = {
  maize:     { price: 4200,  unit: "/bag" },
  tomatoes:  { price: 9500,  unit: "/bag" },
  avocado:   { price: 18500, unit: "/100kg" },
  tea:       { price: 32000, unit: "/100kg" },
  coffee:    { price: 85000, unit: "/100kg" },
  beans:     { price: 6200,  unit: "/bag" },
  wheat:     { price: 3900,  unit: "/bag" },
  potatoes:  { price: 3800,  unit: "/bag" },
  sunflower: { price: 7200,  unit: "/bag" },
  sorghum:   { price: 2600,  unit: "/bag" },
  cassava:   { price: 2800,  unit: "/bag" },
  dairy:     { price: 55,    unit: "/L" },
};

const WB_CROPS: Array<{ key: string; indicator: string; kgPerUnit: number; isPerKg?: boolean }> = [
  { key: "maize",  indicator: "PMAIZMMT",     kgPerUnit: 90,  isPerKg: false },
  { key: "wheat",  indicator: "PWHEAMTUSDM",  kgPerUnit: 90,  isPerKg: false },
  { key: "coffee", indicator: "PCOFFOTMUSDM", kgPerUnit: 100, isPerKg: false },
  { key: "tea",    indicator: "PTEAMKGUSDM",  kgPerUnit: 100, isPerKg: true  },
];

const AI_CROPS = ["tomatoes", "avocado", "beans", "potatoes", "sunflower", "sorghum", "cassava", "dairy"];

let _cache: { data: LiveCommodityPrices; expiresAt: number } | null = null;

async function fetchKesRate(): Promise<number> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw new Error("HTTP error");
    const d = await r.json() as { rates?: Record<string, number> };
    const rate = d.rates?.["KES"];
    if (rate && rate > 80 && rate < 250) return rate;
  } catch (e) {
    logger.warn({ err: e }, "[commodity] Exchange rate fetch failed, using fallback 129.5");
  }
  return 129.5;
}

async function fetchWorldBankPrice(indicator: string): Promise<number | null> {
  try {
    const url = `https://api.worldbank.org/v2/country/WLD/indicator/${indicator}?format=json&mrv=5&per_page=5`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const d = await r.json() as [unknown, Array<{ value: number | null }>];
    const entries = Array.isArray(d[1]) ? d[1] : [];
    for (const e of entries) {
      if (e.value !== null && e.value > 0) return e.value;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchGroqKenyaPrices(kesPerUsd: number): Promise<Record<string, number>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return {};

  const month = new Date().toLocaleString("en-KE", {
    month: "long", year: "numeric", timeZone: "Africa/Nairobi",
  });

  const prompt = `Return ONLY a JSON object with current Kenya wholesale market prices in KES for ${month}. KES/USD rate is ${Math.round(kesPerUsd)}. Use realistic Nairobi market prices. Format: {"tomatoes":<KES per 50kg bag>,"avocado":<KES per 100kg>,"beans":<KES per 90kg bag>,"potatoes":<KES per 50kg bag>,"sunflower":<KES per 90kg bag>,"sorghum":<KES per 90kg bag>,"cassava":<KES per 90kg bag>,"dairy":<KES per litre>}`;

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a Kenya agricultural commodity market expert. Return only valid JSON, no markdown, no explanation." },
          { role: "user", content: prompt },
        ],
        max_tokens: 250,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!r.ok) return {};
    const d = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = d.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[^{}]+\}/);
    if (!match) return {};
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0 && n < 5_000_000) result[k] = Math.round(n);
    }
    return result;
  } catch (e) {
    logger.warn({ err: e }, "[commodity] Groq price fetch failed");
    return {};
  }
}

export async function getLiveCommodityPrices(): Promise<LiveCommodityPrices> {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.data;

  const result: Record<string, LiveCommodityPrice> = {};

  const kesPerUsd = await fetchKesRate();

  await Promise.all(
    WB_CROPS.map(async ({ key, indicator, kgPerUnit, isPerKg }) => {
      const rawUsd = await fetchWorldBankPrice(indicator);
      if (rawUsd && rawUsd > 0) {
        let kesPrice: number;
        if (isPerKg) {
          kesPrice = rawUsd * kgPerUnit * kesPerUsd;
        } else {
          kesPrice = (rawUsd / 1000) * kgPerUnit * kesPerUsd;
        }
        kesPrice = Math.round(kesPrice / 50) * 50;
        result[key] = {
          price: kesPrice,
          unit: STATIC_DEFAULTS[key]?.unit ?? "/bag",
          source: "worldbank",
        };
        logger.info({ key, rawUsd, kesPrice, kesPerUsd }, "[commodity] WorldBank price fetched");
      }
    })
  );

  const groqPrices = await fetchGroqKenyaPrices(kesPerUsd);
  for (const crop of AI_CROPS) {
    const price = groqPrices[crop];
    if (price && price > 5 && price < 2_000_000) {
      result[crop] = {
        price,
        unit: STATIC_DEFAULTS[crop]?.unit ?? "/bag",
        source: "ai",
      };
    }
  }

  for (const [key, def] of Object.entries(STATIC_DEFAULTS)) {
    if (!result[key]) {
      result[key] = { price: def.price, unit: def.unit, source: "fallback" };
    }
  }

  const payload: LiveCommodityPrices = {
    prices: result,
    fetchedAt: new Date().toISOString(),
    kesPerUsd,
  };

  _cache = { data: payload, expiresAt: Date.now() + CACHE_TTL_MS };

  const sources = Object.values(result).reduce<Record<string, number>>((acc, v) => {
    acc[v.source] = (acc[v.source] ?? 0) + 1;
    return acc;
  }, {});
  logger.info({ sources, kesPerUsd, crops: Object.keys(result).length }, "[commodity] Live prices fetched and cached (6h)");

  return payload;
}
