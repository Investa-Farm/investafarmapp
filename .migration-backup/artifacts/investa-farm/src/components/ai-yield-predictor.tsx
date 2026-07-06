import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, TrendingUp, AlertTriangle, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { getToken } from "@/lib/auth";

interface Props {
  farmId: number;
  farmName: string;
  cropType: string;
  fundingPercent?: number;
  daysRemaining?: number;
  riskScore?: number;
}

interface Prediction {
  riskScore: number;
  probability: number;
  returnLow: number;
  returnHigh: number;
  riskDiscountPct: number;
  narrative: string;
  daysRemaining: number;
}

function RiskBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? "#16a34a" : score >= 5 ? "#f59e0b" : "#dc2626";
  const label = score >= 8 ? "Low Risk" : score >= 5 ? "Moderate" : "High Risk";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground font-medium">Risk Score</span>
        <span className="font-bold" style={{ color }}>{score}/10 · {label}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

function ProbabilityArc({ probability }: { probability: number }) {
  const color = probability >= 80 ? "#16a34a" : probability >= 60 ? "#f59e0b" : "#dc2626";
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="7" strokeDasharray="100 201" strokeDashoffset="0" strokeLinecap="round" />
          <motion.circle
            cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(probability / 100) * 201} 201`}
            initial={{ strokeDasharray: "0 201" }}
            animate={{ strokeDasharray: `${(probability / 100) * 201} 201` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-extrabold text-lg leading-none" style={{ color }}>{probability}%</p>
          <p className="text-[8px] text-muted-foreground font-medium">chance</p>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground mt-1 text-center">of achieving target return</p>
    </div>
  );
}

export function AiYieldPredictor({ farmId, farmName, cropType, fundingPercent = 0, daysRemaining = 120, riskScore = 7 }: Props) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/yield-predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ farmId, farmName, cropType, fundingPercent, daysRemaining, riskScore }),
      });
      if (!r.ok) throw new Error("Server error");
      const data = await r.json() as Prediction & { error?: string };
      if (data.error) throw new Error(data.error);
      setPrediction(data);
      setExpanded(true);
    } catch {
      setError("AI prediction temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 overflow-hidden">
      <button
        onClick={prediction ? () => setExpanded(e => !e) : fetchPrediction}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-purple-500/25">
          <Brain size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-violet-900">AI Yield Prediction</p>
          <p className="text-violet-600 text-[10px]">
            {prediction
              ? `${prediction.returnLow}%–${prediction.returnHigh}% · ${prediction.probability}% probability`
              : "Tap to generate AI-powered forecast"}
          </p>
        </div>
        {loading ? (
          <Loader2 size={16} className="text-violet-500 animate-spin flex-shrink-0" />
        ) : prediction ? (
          expanded ? <ChevronUp size={16} className="text-violet-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-violet-400 flex-shrink-0" />
        ) : null}
      </button>

      {expanded && prediction && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="px-4 pb-4 space-y-4 border-t border-violet-200"
        >
          <div className="pt-3 flex items-start gap-4">
            <ProbabilityArc probability={prediction.probability} />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Projected Return</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-extrabold text-green-600">+{prediction.returnLow}%</span>
                  <span className="text-muted-foreground text-sm font-medium">– {prediction.returnHigh}%</span>
                </div>
                <p className="text-[9px] text-muted-foreground">risk-adjusted annualised</p>
              </div>
              <RiskBar score={prediction.riskScore} />
            </div>
          </div>

          {prediction.riskDiscountPct > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
              <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-700 text-[10px] leading-relaxed">
                AI applied a <strong>{prediction.riskDiscountPct}% risk discount</strong> based on crop type, season timing, and market conditions.
              </p>
            </div>
          )}

          <div className="bg-white/70 rounded-xl p-3 border border-violet-100">
            <p className="text-[9px] text-violet-700 uppercase tracking-wider font-bold mb-1">AI Analyst Commentary</p>
            <p className="text-foreground text-xs leading-relaxed">{prediction.narrative}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/60 rounded-xl p-2.5 text-center border border-violet-100">
              <p className="text-muted-foreground text-[9px]">Days to Harvest</p>
              <p className="font-bold text-sm text-foreground">{prediction.daysRemaining}</p>
            </div>
            <div className="bg-white/60 rounded-xl p-2.5 text-center border border-violet-100">
              <p className="text-muted-foreground text-[9px]">Risk Score</p>
              <p className="font-bold text-sm text-foreground">{prediction.riskScore}/10</p>
            </div>
          </div>

          <button
            onClick={fetchPrediction}
            className="w-full flex items-center justify-center gap-1.5 text-violet-600 text-xs font-semibold py-2 rounded-xl border border-violet-200 hover:bg-violet-100 transition-colors active:scale-95"
          >
            <RefreshCw size={11} />
            Refresh prediction
          </button>
        </motion.div>
      )}

      {error && (
        <div className="px-4 pb-4">
          <p className="text-red-500 text-xs text-center">{error}</p>
        </div>
      )}
    </div>
  );
}
