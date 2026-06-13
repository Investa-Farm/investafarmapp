import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, X, ChevronRight } from "lucide-react";
import { getToken, formatKES } from "@/lib/auth";

interface Holding {
  farmName: string; cropType: string; totalValue: number;
  gainLoss: number; gainLossPercent: number; quantity: number;
  purchasePrice: number; currentPrice: number; status: string;
}

interface Summary {
  totalValue: number; totalInvested: number; holdings: number;
  todayReturnPercent: number; weekReturnPercent: number;
}

interface Props {
  holdings: Holding[];
  summary: Summary;
}

interface HealthResult {
  score: number;
  grade: "A" | "B" | "C" | "D";
  headline: string;
  topRisk: string;
  topOpportunity: string;
  action: string;
}

const GRADE_CONFIG = {
  A: { color: "text-green-600", bg: "bg-green-50 border-green-200", ring: "#16a34a", label: "Excellent" },
  B: { color: "text-blue-600",  bg: "bg-blue-50 border-blue-200",   ring: "#2563eb", label: "Good" },
  C: { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", ring: "#d97706", label: "Fair" },
  D: { color: "text-red-500",   bg: "bg-red-50 border-red-200",     ring: "#ef4444", label: "At Risk" },
};

function scoreToGrade(score: number): "A" | "B" | "C" | "D" {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}

async function fetchHealthAnalysis(holdings: Holding[], summary: Summary): Promise<HealthResult> {
  const token = getToken();
  const diversification = new Set(holdings.map(h => h.cropType)).size;
  const gainers = holdings.filter(h => h.gainLoss >= 0).length;
  const losers = holdings.filter(h => h.gainLoss < 0).length;
  const returnPct = summary.totalInvested > 0
    ? ((summary.totalValue - summary.totalInvested) / summary.totalInvested * 100).toFixed(1)
    : "0";

  const prompt = `You are a portfolio analyst for Investa Farm Kenya.
Investor portfolio summary:
- Total value: KES ${summary.totalValue.toLocaleString()}
- Total invested: KES ${summary.totalInvested.toLocaleString()}
- Total return: ${returnPct}%
- Holdings: ${summary.holdings} farms
- Crop types: ${diversification} different crops (${[...new Set(holdings.map(h => h.cropType))].join(", ")})
- Winners: ${gainers}, Losers: ${losers}
- Today change: ${summary.todayReturnPercent}%

Score this portfolio 1-100 where 100=perfect. Reply ONLY with valid JSON (no markdown):
{
  "score": 78,
  "headline": "8-word portfolio health summary",
  "topRisk": "1 sentence about the biggest risk to watch",
  "topOpportunity": "1 sentence about the best opportunity",
  "action": "1 clear action the investor should take this week"
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
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? "";
    const parsed = JSON.parse(json);
    return { ...parsed, grade: scoreToGrade(parsed.score) };
  } catch {
    const score = Math.round(60 + (gainers / Math.max(holdings.length, 1)) * 25 + Math.min(diversification * 5, 15));
    const grade = scoreToGrade(score);
    return {
      score,
      grade,
      headline: score >= 75 ? "Healthy diversified portfolio growing steadily" : "Moderate portfolio with room to optimise",
      topRisk: losers > gainers ? `${losers} holdings are below purchase price — review your underperforming crops.` : "Concentration risk: consider spreading into more crop types.",
      topOpportunity: gainers > 0 ? "Your top performers could be listed on the secondary market for a profitable exit." : "Markets are recovering — averaging down on quality farms now could boost returns.",
      action: diversification < 3 ? "Add at least one more crop type to reduce concentration risk." : "Review your lowest-performing holding and decide: hold or exit.",
    };
  }
}

export function PortfolioHealthAI({ holdings, summary }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<HealthResult | null>(null);
  const [dots, setDots] = useState(0);

  const handleOpen = async () => {
    setOpen(true);
    if (result) return;
    setState("loading");
    const interval = setInterval(() => setDots(d => (d + 1) % 4), 400);
    const r = await fetchHealthAnalysis(holdings, summary);
    clearInterval(interval);
    setResult(r);
    setState("done");
  };

  const cfg = result ? GRADE_CONFIG[result.grade] : GRADE_CONFIG.B;

  return (
    <>
      <motion.button
        onClick={handleOpen}
        whileTap={{ scale: 0.96 }}
        className="w-full rounded-2xl overflow-hidden relative flex items-center gap-3.5 px-4 py-3.5 text-left"
        style={{ background: "linear-gradient(135deg, #052e16, #16a34a)" }}
      >
        <motion.div
          className="absolute inset-0 opacity-40"
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          style={{ background: "linear-gradient(90deg, transparent, #22c55e30, transparent)", backgroundSize: "200%" }}
        />
        <motion.div
          animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
          className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0 border border-white/20"
        >
          <Sparkles size={20} className="text-yellow-300" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">AI Portfolio Health Check</p>
          <p className="text-green-200/70 text-[11px]">
            {result ? `Score: ${result.score}/100 · ${GRADE_CONFIG[result.grade].label}` : "Tap to get your portfolio health score"}
          </p>
        </div>
        <ChevronRight size={16} className="text-white/50 flex-shrink-0" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-[430px] rounded-t-3xl overflow-hidden shadow-2xl"
              style={{ background: "linear-gradient(180deg, #052e16 0%, #0f3d21 100%)" }}
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }}
                    className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
                    <Sparkles size={17} className="text-yellow-300" />
                  </motion.div>
                  <div>
                    <p className="text-white font-bold text-sm">Portfolio Health Check</p>
                    <p className="text-green-300/60 text-[10px]">AI-powered · Investa Farm Intelligence</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <X size={14} className="text-white" />
                </button>
              </div>

              <div className="px-5 pt-4 pb-10">
                {state === "loading" && (
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-3">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                        className="w-9 h-9 rounded-full border-2 border-green-400 border-t-transparent flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold text-sm">Analysing {summary.holdings} holdings{"." .repeat(dots + 1)}</p>
                        <p className="text-green-300/60 text-[10px]">Scoring diversification, risk, and returns</p>
                      </div>
                    </div>
                    {[85, 65, 50].map((w, i) => (
                      <motion.div key={i} animate={{ opacity: [0.3, 0.7, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.2 }}
                        className="h-3 rounded-full bg-white/15" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                )}

                {state === "done" && result && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3.5">
                    {/* Score ring */}
                    <div className={`rounded-2xl border ${cfg.bg} p-4 flex items-center gap-4`}>
                      <div className="relative w-16 h-16 flex-shrink-0">
                        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                          <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" strokeWidth="5" />
                          <motion.circle cx="28" cy="28" r="22" fill="none"
                            stroke={cfg.ring} strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 22}`}
                            initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
                            animate={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - result.score / 100) }}
                            transition={{ duration: 1.2, ease: "easeOut" }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className={`font-extrabold text-base leading-none ${cfg.color}`}>{result.score}</p>
                          <p className={`text-[8px] font-bold ${cfg.color}`}>{result.grade}</p>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${cfg.color} bg-white/60`}>
                          {GRADE_CONFIG[result.grade].label}
                        </span>
                        <p className={`font-bold text-sm mt-1 ${cfg.color}`}>{result.headline}</p>
                      </div>
                    </div>

                    {/* Risk */}
                    <div className="bg-white/8 rounded-2xl px-3.5 py-3 border border-white/10">
                      <p className="text-red-300 text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <AlertTriangle size={10} /> Top Risk
                      </p>
                      <p className="text-white/85 text-xs leading-relaxed">{result.topRisk}</p>
                    </div>

                    {/* Opportunity */}
                    <div className="bg-white/8 rounded-2xl px-3.5 py-3 border border-white/10">
                      <p className="text-green-300 text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <TrendingUp size={10} /> Top Opportunity
                      </p>
                      <p className="text-white/85 text-xs leading-relaxed">{result.topOpportunity}</p>
                    </div>

                    {/* Action */}
                    <div className="rounded-2xl overflow-hidden"
                      style={{ background: "linear-gradient(135deg, #16a34a20, #22c55e20)", border: "1px solid #16a34a50" }}>
                      <div className="px-3.5 py-3">
                        <p className="text-green-300 text-[9px] font-bold uppercase tracking-widest mb-1">This Week's Action</p>
                        <p className="text-white font-semibold text-sm">{result.action}</p>
                      </div>
                    </div>

                    {/* Portfolio snapshot */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Total Value", val: formatKES(summary.totalValue), icon: "💰" },
                        { label: "Holdings", val: String(summary.holdings), icon: "🌾" },
                        { label: "This Week", val: `${summary.weekReturnPercent >= 0 ? "+" : ""}${summary.weekReturnPercent.toFixed(1)}%`, icon: "📈" },
                      ].map(({ label, val, icon }) => (
                        <div key={label} className="bg-white/8 rounded-xl p-2.5 text-center border border-white/10">
                          <p className="text-base">{icon}</p>
                          <p className="text-white font-bold text-xs mt-0.5">{val}</p>
                          <p className="text-white/40 text-[9px]">{label}</p>
                        </div>
                      ))}
                    </div>

                    <p className="text-white/25 text-[9px] text-center">AI-generated · Not financial advice · Updated on each check</p>
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
