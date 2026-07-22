/**
 * PortfolioAiInsight — 1-line AI insight strip for the portfolio page
 * Fetches from /api/ai/portfolio-health and shows a dismissible banner
 */
import { useState, useEffect } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";

interface Props {
  totalValue: number;
  totalInvested: number;
  holdings: number;
  gainLossPercent: number;
  crops: string[];
}

export function PortfolioAiInsight({ totalValue, totalInvested, holdings, gainLossPercent, crops }: Props) {
  const token = getToken();
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!totalValue || dismissed) return;
    setLoading(true);
    fetch("/api/ai/portfolio-health", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ totalValue, totalInvested, holdings, gainLossPercent, crops }),
    })
      .then(r => { if (!r.ok) throw new Error("fetch failed"); return r.json(); })
      .then(d => setSummary(d.summary ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [totalValue]);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {(loading || summary) && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="mx-4 mb-3 bg-gradient-to-r from-primary/5 to-emerald-50 border border-primary/20 rounded-2xl px-3.5 py-3 flex items-start gap-2.5"
        >
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            {loading ? <Loader2 size={11} className="animate-spin text-primary" /> : <Sparkles size={11} className="text-primary" />}
          </div>
          <p className="text-foreground text-xs leading-relaxed flex-1">
            {loading ? <span className="text-muted-foreground">AI is analysing your portfolio…</span> : summary}
          </p>
          {summary && (
            <button onClick={() => setDismissed(true)} className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center mt-0.5">
              <X size={9} className="text-muted-foreground" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
