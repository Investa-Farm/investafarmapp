/**
 * FarmerAiInsights — AI-powered micro-tips for the farmer dashboard
 * Calls /api/ai/farm-insights, shows 5 scrollable pill-style tips
 */
import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";

type Insight = { type: string; icon: string; tip: string };

interface Props {
  cropType?: string;
  location?: string;
  growthStage?: string;
  farmHealth?: number;
  harvestDays?: number;
  fundsRaised?: number;
  fundingPercent?: number;
}

export function FarmerAiInsights({ cropType, location, growthStage, farmHealth, harvestDays, fundsRaised, fundingPercent }: Props) {
  const token = getToken();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchInsights = async () => {
    if (!cropType) return;
    setLoading(true);
    try {
      const r = await fetch("/api/ai/farm-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cropType, location, growthStage, farmHealth, harvestDays, fundsRaised, fundingPercent }),
      });
      const d = await r.json();
      setInsights(d.insights ?? []);
      setFetched(true);
    } catch {
      setInsights([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cropType && !fetched) {
      fetchInsights();
    }
  }, [cropType]);

  const TYPE_COLORS: Record<string, string> = {
    weather: "bg-sky-50 border-sky-200 text-sky-700",
    market:  "bg-violet-50 border-violet-200 text-violet-700",
    crop:    "bg-green-50 border-green-200 text-green-700",
    funding: "bg-amber-50 border-amber-200 text-amber-700",
    risk:    "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => { setExpanded(e => !e); if (!fetched && !loading) fetchInsights(); }}
        className="w-full flex items-center justify-between p-4 active:opacity-70 transition-opacity"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles size={15} className="text-primary" />
          </div>
          <div className="text-left">
            <p className="text-foreground font-bold text-sm">AI Farm Advisor</p>
            <p className="text-muted-foreground text-[10px]">5 personalized tips for your {cropType ?? "farm"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <Loader2 size={13} className="animate-spin text-primary" />}
          <span className="text-primary text-xs font-semibold">{expanded ? "Hide" : "Show"}</span>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
              {loading ? (
                <div className="flex items-center gap-2 py-3">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <p className="text-muted-foreground text-xs">Getting personalized insights from AI…</p>
                </div>
              ) : insights.length === 0 ? (
                <p className="text-muted-foreground text-xs py-2">No insights available. Add crop details to get started.</p>
              ) : (
                insights.map((insight, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-start gap-2.5 border rounded-xl px-3 py-2.5 ${TYPE_COLORS[insight.type] ?? "bg-muted/60 border-border text-foreground"}`}
                  >
                    <span className="text-base flex-shrink-0 mt-0.5">{insight.icon}</span>
                    <p className="text-xs leading-relaxed">{insight.tip}</p>
                  </motion.div>
                ))
              )}

              {fetched && !loading && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFetched(false); fetchInsights(); }}
                  className="flex items-center gap-1.5 text-primary text-[11px] font-semibold mt-1 active:opacity-60"
                >
                  <RefreshCw size={11} /> Refresh insights
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
