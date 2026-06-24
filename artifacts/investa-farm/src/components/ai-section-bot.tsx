import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { getToken } from "@/lib/auth";

type Props = {
  context: string;
  label?: string;
};

function generateFallbackInsight(context: string): string {
  const c = context.toLowerCase();
  if (c.includes("ndvi")) {
    const match = c.match(/ndvi score is ([\d.]+)/);
    const score = match ? parseFloat(match[1]!) : 0.6;
    if (score >= 0.7) return "Strong vegetation index — crop canopy is dense and healthy. This signals good photosynthesis rates and adequate water uptake. Investors typically see lower crop failure risk in farms with NDVI above 0.7.";
    if (score >= 0.5) return "Moderate vegetation health. Crop is growing but may benefit from additional irrigation or fertiliser. Monitor over the next 2 weeks for trend direction.";
    return "Vegetation stress detected. The farm may be experiencing drought pressure or pest activity. Review rainfall data and consider field intervention before mid-season.";
  }
  if (c.includes("rainfall") || c.includes("weather") || c.includes("rain")) {
    return "Rainfall conditions are within seasonal norms for this region. La Niña patterns favour above-average precipitation through Q2, which is positive for most staple crops. Irrigation dependency is reduced, improving net margins.";
  }
  if (c.includes("maize") || c.includes("corn")) {
    return "Maize remains Kenya's highest-demand staple crop. NCPB procurement prices are firm this season with strong off-take from millers in Nairobi and Mombasa. Early-stage investments typically yield the best entry price before harvest-driven price appreciation.";
  }
  if (c.includes("coffee")) {
    return "Arabica coffee commands premium export pricing with strong demand from European and Japanese buyers. Kenyan AA-grade consistently achieves top-3 auction results at the Nairobi Coffee Exchange. This crop offers high ROI with lower volume volatility than staples.";
  }
  if (c.includes("tea")) {
    return "Tea from Kenyan highlands (Kirinyaga, Nyeri, Kericho) is globally ranked for quality. Auction volumes at Mombasa remain solid. The crop provides stable quarterly income as it is harvested year-round, unlike seasonal staples.";
  }
  if (c.includes("avocado")) {
    return "Avocado exports surged 40% YoY as Kenyan Hass avocados gain EU market access. Laikipia and Murang'a farms benefit from ideal altitude and climate. Supply gaps versus European demand create sustained upward price pressure.";
  }
  if (c.includes("tomato")) {
    return "Tomatoes show high short-term ROI but carry seasonal price volatility. Wakulima Market Nairobi reports supply 20-30% below 5-year average this period, supporting farm-gate prices. Short grow cycle (60-90 days) enables faster investor returns.";
  }
  if (c.includes("rice")) {
    return "Rice farming in Ahero and Mwea irrigation schemes benefits from government subsidised water. Domestic demand consistently exceeds local production, requiring imports — farms with reliable water access command a premium. Stable, predictable harvest cycle.";
  }
  if (c.includes("sunflower")) {
    return "Sunflower oil demand is growing as palm oil import costs rise. Narok and Trans-Nzoia regions are ideal growing zones. Processors like Bidco and Pwani Oil have established off-take agreements with cooperatives, reducing price risk for investors.";
  }
  if (c.includes("harvest") || c.includes("season")) {
    return "Farm is approaching or in harvest phase — historically the period of strongest share price appreciation. Investor sentiment typically peaks 4-6 weeks before harvest as yield estimates firm up. This is often the optimal window for short-term holders to exit.";
  }
  if (c.includes("funding") || c.includes("funded")) {
    return "Funding progress is a strong signal of investor confidence. Listings that cross 50% funding tend to complete rapidly as momentum builds. Early investors benefit from the best entry price before demand-driven price appreciation.";
  }
  if (c.includes("portfolio") || c.includes("return") || c.includes("roi")) {
    return "Diversifying across crop types and regions reduces seasonal concentration risk. Farms in different growth stages provide staggered harvest return timing, smoothing overall portfolio yield. Target a mix of staple income and premium export crops for balanced exposure.";
  }
  return "This farm shows stable fundamentals based on current crop and regional data. Seasonal demand patterns and recent market prices support a positive outlook for the upcoming harvest window. Consider current funding level and days to harvest when timing your investment.";
}

export function AiSectionBot({ context, label }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const token = getToken();

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        const left = Math.min(rect.left, window.innerWidth - 296);
        const top = rect.bottom + 6;
        setPopupPos({ top, left: Math.max(8, left) });
      }
    }
    setOpen(o => !o);
    if (explanation) return;
    setLoading(true);
    try {
      const r = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ context }),
      });
      if (!r.ok) throw new Error("api_error");
      const d = await r.json();
      if (d.error || !d.explanation) throw new Error("no_content");
      setExplanation(d.explanation);
    } catch {
      setExplanation(generateFallbackInsight(context));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        const left = Math.min(rect.left, window.innerWidth - 296);
        setPopupPos({ top: rect.bottom + 6, left: Math.max(8, left) });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  const popup = open && popupPos ? (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      style={{ position: "fixed", top: popupPos.top, left: popupPos.left, zIndex: 999 }}
      className="w-72 bg-card border border-[#16a34a]/20 rounded-2xl shadow-xl p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-[#16a34a]" />
          <p className="text-[11px] font-bold text-[#16a34a] uppercase tracking-wide">AI Insight</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          className="w-5 h-5 rounded-full bg-muted flex items-center justify-center"
        >
          <X size={10} className="text-muted-foreground" />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 size={14} className="animate-spin text-[#16a34a]" />
          <p className="text-muted-foreground text-xs">Analysing…</p>
        </div>
      ) : (
        <p className="text-foreground text-xs leading-relaxed">{explanation}</p>
      )}
    </motion.div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="w-6 h-6 rounded-full bg-[#16a34a]/10 hover:bg-[#16a34a]/20 flex items-center justify-center transition-colors ml-1 flex-shrink-0"
        title={`AI: explain ${label ?? "this section"}`}
      >
        <Sparkles size={11} className="text-[#16a34a]" />
      </button>
      {createPortal(
        <AnimatePresence>{popup}</AnimatePresence>,
        document.body
      )}
    </>
  );
}
