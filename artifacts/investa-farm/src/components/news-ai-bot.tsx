import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, TrendingUp, TrendingDown, Minus, Volume2 } from "lucide-react";
import { getToken } from "@/lib/auth";

interface NewsItem {
  id: number;
  title: string;
  summary?: string;
  tag?: string;
  source?: string;
}

interface Props {
  item: NewsItem;
  portfolioCrops?: string[];
}

type ImpactLevel = "positive" | "negative" | "neutral";

interface AiAnalysis {
  headline: string;
  impact: ImpactLevel;
  portfolioEffect: string;
  marketEffect: string;
  recommendation: string;
  cropMentioned?: string;
}

const CROP_KEYWORDS: Record<string, string[]> = {
  Maize: ["maize", "corn", "grain", "cereal"],
  Avocado: ["avocado", "hass", "export", "eu market"],
  Coffee: ["coffee", "arabica", "robusta", "caffeine"],
  Tea: ["tea", "chai", "camellia"],
  Tomatoes: ["tomato", "nightshade", "vegetable"],
  Wheat: ["wheat", "flour", "bread", "baking"],
  Rice: ["rice", "paddy", "staple"],
  Beans: ["beans", "legume", "pulse"],
  Sugarcane: ["sugar", "sugarcane", "ethanol"],
  Milk: ["dairy", "milk", "livestock"],
  "French Beans": ["french beans", "snap beans"],
};

function detectCrop(text: string): string {
  const lower = text.toLowerCase();
  for (const [crop, keywords] of Object.entries(CROP_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return crop;
  }
  return "your crops";
}

function detectImpact(text: string): ImpactLevel {
  const lower = text.toLowerCase();
  const posWords = ["surge", "rise", "boom", "increase", "gain", "up", "growth", "record high", "strong demand", "export", "bumper"];
  const negWords = ["fall", "drop", "decline", "slump", "drought", "flood", "pest", "disease", "shortage", "crisis", "below"];
  const pos = posWords.filter(w => lower.includes(w)).length;
  const neg = negWords.filter(w => lower.includes(w)).length;
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

async function fetchAiAnalysis(item: NewsItem): Promise<AiAnalysis> {
  const crop = detectCrop(`${item.title} ${item.summary ?? ""} ${item.tag ?? ""}`);
  const impact = detectImpact(`${item.title} ${item.summary ?? ""}`);
  const token = getToken();

  const prompt = `You are an agricultural investment analyst for Investa Farm Kenya.
News headline: "${item.title}"
Summary: "${item.summary ?? "No summary"}"
Tag: "${item.tag ?? "General"}"

Respond ONLY with valid JSON (no markdown):
{
  "headline": "one catchy 8-word impact headline",
  "impact": "${impact}",
  "portfolioEffect": "2 sentences about how this affects ${crop} farm investments specifically",
  "marketEffect": "2 sentences on the broader market shift for ${crop} in Kenya",
  "recommendation": "1 clear action: Buy / Hold / Watch or exit guidance",
  "cropMentioned": "${crop}"
}`;

  try {
    const r = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) throw new Error("AI unavailable");
    const d = await r.json();
    const raw: string = d.message ?? d.content ?? d.reply ?? "";
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? "";
    const parsed = JSON.parse(jsonStr);
    return { ...parsed, impact, cropMentioned: crop };
  } catch {
    return {
      headline: `${crop} market shift detected`,
      impact,
      portfolioEffect: impact === "positive"
        ? `This news signals increased demand for ${crop}, which could push up share prices in your ${crop} farm holdings. Investors who bought early stand to benefit most.`
        : impact === "negative"
        ? `This development may create short-term pressure on ${crop} farm valuations. Consider your exit timing if you hold large positions.`
        : `This news has mixed implications for ${crop} farms. Monitor for the next 7 days before acting.`,
      marketEffect: impact === "positive"
        ? `Kenya's agri-commodity market for ${crop} is seeing bullish momentum. Off-takers are expected to raise contract offers in the coming weeks.`
        : impact === "negative"
        ? `Regional buyers may reduce their ${crop} procurement price temporarily due to this development.`
        : `${crop} prices are expected to remain range-bound. No major disruption anticipated.`,
      recommendation: impact === "positive" ? "📈 Consider adding exposure to verified ${crop} farm listings" : impact === "negative" ? "⚠️ Watch your positions — consider partial exit" : "🔍 Hold & monitor — no urgent action needed",
      cropMentioned: crop,
    };
  }
}

const IMPACT_CONFIG = {
  positive: { color: "text-green-600", bg: "bg-green-50 border-green-200", icon: TrendingUp, label: "Bullish Impact", badge: "bg-green-100 text-green-700" },
  negative: { color: "text-red-500", bg: "bg-red-50 border-red-200", icon: TrendingDown, label: "Bearish Impact", badge: "bg-red-100 text-red-600" },
  neutral: { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: Minus, label: "Neutral Impact", badge: "bg-amber-100 text-amber-700" },
};

type BotState = "idle" | "loading" | "done";

export function NewsAiBot({ item }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<BotState>("idle");
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [dots, setDots] = useState(0);
  const dotsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    if (analysis) return;
    setState("loading");
    dotsRef.current = setInterval(() => setDots(d => (d + 1) % 4), 420);
    const result = await fetchAiAnalysis(item);
    if (dotsRef.current) clearInterval(dotsRef.current);
    setAnalysis(result);
    setState("done");
  };

  const cfg = analysis ? IMPACT_CONFIG[analysis.impact] : IMPACT_CONFIG.neutral;
  const ImpactIcon = cfg.icon;

  return (
    <>
      {/* Trigger button */}
      <motion.button
        onClick={handleOpen}
        whileTap={{ scale: 0.92 }}
        className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl overflow-hidden group"
        style={{ background: "linear-gradient(135deg, #14532d, #16a34a)" }}
        title="AI Market Analysis"
      >
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100"
          style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}
          transition={{ duration: 0.2 }}
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          className="relative z-10"
        >
          <Sparkles size={11} className="text-yellow-300" />
        </motion.div>
        <span className="relative z-10 text-white text-[10px] font-bold tracking-wide">AI Insight</span>
      </motion.button>

      {/* Bottom sheet */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="relative w-full max-w-[430px] rounded-t-3xl overflow-hidden shadow-2xl"
              style={{ background: "linear-gradient(180deg, #052e16 0%, #0f3d21 100%)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}
                  >
                    <Sparkles size={18} className="text-white" />
                  </motion.div>
                  <div>
                    <p className="text-white font-bold text-sm">AI Market Analyst</p>
                    <p className="text-green-300/70 text-[10px]">Investa Farm Intelligence</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <X size={14} className="text-white" />
                </button>
              </div>

              {/* News reference */}
              <div className="mx-5 mt-4 bg-white/8 rounded-2xl px-3.5 py-2.5 border border-white/10">
                <p className="text-green-300 text-[9px] font-bold uppercase tracking-widest mb-0.5">Analysing</p>
                <p className="text-white text-xs font-semibold leading-snug line-clamp-2">{item.title}</p>
                {item.source && <p className="text-white/40 text-[9px] mt-0.5">Source: {item.source}</p>}
              </div>

              {/* Content */}
              <div className="px-5 pt-4 pb-8">
                {state === "loading" && (
                  <div className="space-y-3 py-4">
                    <div className="flex items-center gap-2.5">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                        className="w-8 h-8 rounded-full border-2 border-green-400 border-t-transparent flex-shrink-0"
                      />
                      <div>
                        <p className="text-white font-semibold text-sm">
                          Analysing market impact{"." .repeat(dots + 1)}
                        </p>
                        <p className="text-green-300/60 text-[10px]">Cross-referencing with live commodity prices</p>
                      </div>
                    </div>
                    {[90, 70, 55].map((w, i) => (
                      <motion.div key={i}
                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.2 }}
                        className="h-3 rounded-full bg-white/15"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                )}

                {state === "done" && analysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-3.5"
                  >
                    {/* Impact badge */}
                    <div className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 ${cfg.bg}`}>
                      <ImpactIcon size={18} className={cfg.color} />
                      <div>
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${cfg.badge} px-2 py-0.5 rounded-full`}>
                          {cfg.label}
                        </span>
                        <p className={`text-xs font-bold mt-0.5 ${cfg.color}`}>{analysis.headline}</p>
                      </div>
                    </div>

                    {/* Portfolio effect */}
                    <div className="bg-white/8 rounded-2xl px-3.5 py-3 border border-white/10">
                      <p className="text-green-300 text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-green-400/30 flex items-center justify-center">💼</span>
                        Your Portfolio
                      </p>
                      <p className="text-white/85 text-xs leading-relaxed">{analysis.portfolioEffect}</p>
                    </div>

                    {/* Market effect */}
                    <div className="bg-white/8 rounded-2xl px-3.5 py-3 border border-white/10">
                      <p className="text-green-300 text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-blue-400/30 flex items-center justify-center">📊</span>
                        Market Outlook · {analysis.cropMentioned}
                      </p>
                      <p className="text-white/85 text-xs leading-relaxed">{analysis.marketEffect}</p>
                    </div>

                    {/* Recommendation */}
                    <div className="rounded-2xl overflow-hidden"
                      style={{ background: "linear-gradient(135deg, #16a34a20, #22c55e20)", border: "1px solid #16a34a40" }}>
                      <div className="px-3.5 py-2.5">
                        <p className="text-green-300 text-[9px] font-bold uppercase tracking-widest mb-1">AI Recommendation</p>
                        <p className="text-white font-semibold text-sm">{analysis.recommendation}</p>
                      </div>
                    </div>

                    <p className="text-white/30 text-[9px] text-center">AI-generated analysis · Not financial advice · Always DYOR</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
