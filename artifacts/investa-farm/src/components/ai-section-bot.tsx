import { useState } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";

type Props = {
  context: string;
  label?: string;
};

export function AiSectionBot({ context, label }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const token = getToken();

  const handleOpen = async () => {
    setOpen(true);
    if (explanation) return;
    setLoading(true);
    try {
      const r = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ context }),
      });
      const d = await r.json();
      setExplanation(d.explanation ?? "Unable to generate explanation.");
    } catch {
      setExplanation("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={handleOpen}
        className="w-6 h-6 rounded-full bg-[#16a34a]/10 hover:bg-[#16a34a]/20 flex items-center justify-center transition-colors ml-1"
        title={`AI: explain ${label ?? "this section"}`}
      >
        <Sparkles size={11} className="text-[#16a34a]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            className="absolute left-0 top-8 z-50 w-72 bg-card border border-[#16a34a]/20 rounded-2xl shadow-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-[#16a34a]" />
                <p className="text-[11px] font-bold text-[#16a34a] uppercase tracking-wide">AI Insight</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                <X size={10} className="text-muted-foreground" />
              </button>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={14} className="animate-spin text-[#16a34a]" />
                <p className="text-muted-foreground text-xs">Thinking…</p>
              </div>
            ) : (
              <p className="text-foreground text-xs leading-relaxed">{explanation}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
