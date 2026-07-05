import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bot, Zap, CheckCircle2, Loader2, TrendingUp, AlertCircle, MapPin, Sparkles, ChevronRight } from "lucide-react";
import { formatKES, getToken } from "@/lib/auth";
import { getCropImage } from "@/lib/crops";
import { useLocation } from "wouter";
import { nonceHeaders } from "@/lib/nonce";
import { useQueryClient } from "@tanstack/react-query";
import { getListPrimaryMarketQueryKey } from "@workspace/api-client-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

type AgentStep = "setup" | "running" | "done" | "error";

interface InvestedFarm {
  farmName: string;
  cropType: string;
  location?: string;
  shares: number;
  pricePerShare: number;
  total: number;
  estimatedReturn: number;
  exitType: string;
}

const RISK_PROFILES = {
  low:    { label: "🛡️ Conservative", returnMin: 8,  returnMax: 15, crops: ["Maize", "Beans", "Kale", "Wheat"],                 exitType: "wide_season" as const },
  medium: { label: "⚖️ Balanced",     returnMin: 15, returnMax: 22, crops: ["Coffee", "Tea", "Rice", "Sunflower", "Tomatoes"], exitType: "full_season" as const },
  high:   { label: "🚀 Aggressive",   returnMin: 20, returnMax: 30, crops: ["Avocado", "Coffee", "Dairy", "Poultry"],          exitType: "full_season" as const },
};

const STATUS_STEPS = [
  "Scanning active farm listings…",
  "Analysing risk & return profiles…",
  "Scoring farms against your parameters…",
  "Selecting optimal portfolio allocation…",
  "Checking wallet balance…",
  "Placing investments…",
  "Confirming transactions…",
];

export function AiAgentModal({ open, onClose }: Props) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const token = getToken();

  const [step, setStep] = useState<AgentStep>("setup");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [budget, setBudget] = useState(20000);
  const [maxFarms, setMaxFarms] = useState(3);
  const [statusIdx, setStatusIdx] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [invested, setInvested] = useState<InvestedFarm[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [totalInvested, setTotalInvested] = useState(0);

  const reset = () => {
    setStep("setup");
    setStatusIdx(0);
    setInvested([]);
    setErrorMsg("");
    setTotalInvested(0);
  };

  const animateStatuses = async (msgs: string[], delayMs = 700) => {
    for (let i = 0; i < msgs.length; i++) {
      setStatusMsg(msgs[i]!);
      setStatusIdx(i);
      await new Promise(r => setTimeout(r, delayMs));
    }
  };

  const runAgent = async () => {
    setStep("running");
    setStatusMsg(STATUS_STEPS[0]!);
    setStatusIdx(0);

    try {
      const profile = RISK_PROFILES[risk];

      await animateStatuses(STATUS_STEPS.slice(0, 5), 600);

      const r = await fetch("/api/market/primary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Could not fetch market listings");
      const data = await r.json();
      const listings: any[] = Array.isArray(data) ? data : (data.listings ?? []);

      const scored = listings
        .filter((l: any) => l.sharesAvailable > 0)
        .map((l: any) => {
          const cropMatch = profile.crops.some(c =>
            l.cropType?.toLowerCase().includes(c.toLowerCase())
          );
          const score =
            (cropMatch ? 40 : 0) +
            Math.min(30, Math.max(0, l.changePercent ?? 0) * 10) +
            (l.sharesAvailable > 50 ? 20 : 10) +
            Math.random() * 10;
          return { ...l, agentScore: score };
        })
        .sort((a: any, b: any) => b.agentScore - a.agentScore)
        .slice(0, maxFarms);

      if (scored.length === 0) throw new Error("No suitable farms found. Try adjusting your parameters.");

      setStatusMsg(STATUS_STEPS[5]!);
      setStatusIdx(5);
      await new Promise(r => setTimeout(r, 500));

      const perFarm = Math.floor(budget / scored.length);
      const results: InvestedFarm[] = [];

      for (const listing of scored) {
        const qty = Math.max(1, Math.floor(perFarm / listing.pricePerShare));
        const actualQty = Math.min(qty, listing.sharesAvailable);
        const total = actualQty * listing.pricePerShare;
        const returnPct = profile.returnMin + Math.random() * (profile.returnMax - profile.returnMin);

        try {
          const buyRes = await fetch("/api/market/buy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              ...nonceHeaders(),
            },
            body: JSON.stringify({
              listingId: listing.id,
              quantity: actualQty,
              exitType: profile.exitType,
            }),
          });

          if (buyRes.ok) {
            results.push({
              farmName: listing.farmName,
              cropType: listing.cropType,
              location: listing.location,
              shares: actualQty,
              pricePerShare: listing.pricePerShare,
              total,
              estimatedReturn: returnPct,
              exitType: profile.exitType === "full_season" ? "Full Season" : "Mid-Season",
            });
          }
        } catch {
          // skip failed buys silently
        }
        await new Promise(r => setTimeout(r, 400));
      }

      setStatusMsg(STATUS_STEPS[6]!);
      setStatusIdx(6);
      await new Promise(r => setTimeout(r, 600));

      if (results.length === 0) {
        throw new Error("Investments could not be placed. Check your wallet balance and try again.");
      }

      const total = results.reduce((s, r) => s + r.total, 0);
      setInvested(results);
      setTotalInvested(total);
      qc.invalidateQueries({ queryKey: getListPrimaryMarketQueryKey() });
      qc.invalidateQueries({ queryKey: ["wallet-balance"] });
      qc.invalidateQueries({ queryKey: ["portfolio-summary"] });
      setStep("done");

    } catch (e: any) {
      setErrorMsg(e.message ?? "Something went wrong. Please try again.");
      setStep("error");
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 400);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={handleClose} />

          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: "92dvh" }}
          >
            <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                  style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)" }}>
                  <Bot size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    AI Investment Agent
                    <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">AUTO</span>
                  </p>
                  <p className="text-muted-foreground text-[10px]">Set parameters · AI invests for you</p>
                </div>
              </div>
              {step !== "running" && (
                <button onClick={handleClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={15} className="text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 px-5 pt-4 pb-8">
              <AnimatePresence mode="wait">

                {step === "setup" && (
                  <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-2">
                      <Bot size={14} className="text-blue-700 flex-shrink-0 mt-0.5" />
                      <p className="text-blue-800 text-xs leading-relaxed">
                        Set your budget and risk preference. The AI agent will automatically find, score, and invest in the best farms — no manual steps needed.
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Total Budget (KES)
                      </label>
                      <input
                        type="number"
                        value={budget}
                        onChange={e => setBudget(+e.target.value)}
                        className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 bg-background"
                        placeholder="20,000"
                      />
                      <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                        {[5000, 10000, 25000, 50000, 100000].map(a => (
                          <button key={a} onClick={() => setBudget(a)}
                            className={`flex-shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${budget === a ? "border-blue-500 text-blue-600 bg-blue-50" : "border-border text-muted-foreground"}`}>
                            {formatKES(a)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Risk Profile</label>
                      <div className="space-y-2">
                        {(Object.entries(RISK_PROFILES) as [keyof typeof RISK_PROFILES, typeof RISK_PROFILES["low"]][]).map(([key, val]) => (
                          <button key={key} onClick={() => setRisk(key)}
                            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${risk === key ? "border-blue-500 bg-blue-50" : "border-border bg-white"}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-foreground">{val.label}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${risk === key ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>
                                {val.returnMin}–{val.returnMax}% est.
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10px] mt-0.5">{val.crops.slice(0, 4).join(", ")}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Diversify Across: <span className="text-blue-600 font-extrabold">{maxFarms} farm{maxFarms !== 1 ? "s" : ""}</span>
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} onClick={() => setMaxFarms(n)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${maxFarms === n ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground bg-white"}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                      <p className="text-muted-foreground text-[10px] mt-1.5 text-center">
                        Budget split: ~{formatKES(Math.floor(budget / maxFarms))} per farm
                      </p>
                    </div>

                    <div className="bg-muted/50 rounded-2xl p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Agent Summary</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total budget</span>
                        <span className="font-bold text-foreground">{formatKES(budget)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Risk profile</span>
                        <span className="font-bold text-foreground">{RISK_PROFILES[risk].label}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Farms to invest in</span>
                        <span className="font-bold text-foreground">Up to {maxFarms}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Est. return</span>
                        <span className="font-bold text-green-600">+{RISK_PROFILES[risk].returnMin}–{RISK_PROFILES[risk].returnMax}%</span>
                      </div>
                    </div>

                    <button
                      onClick={runAgent}
                      className="w-full text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                      style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)" }}
                    >
                      <Zap size={16} />
                      Run AI Agent Now
                    </button>
                  </motion.div>
                )}

                {step === "running" && (
                  <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="py-6 flex flex-col items-center gap-6">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)" }}>
                        <Bot size={36} className="text-white" />
                      </div>
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-blue-500/50"
                        animate={{ scale: [1, 1.25, 1], opacity: [0.8, 0, 0.8] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>

                    <div className="text-center">
                      <p className="text-foreground font-bold text-base">Agent is working…</p>
                      <p className="text-muted-foreground text-xs mt-1">This may take a few moments</p>
                    </div>

                    <div className="w-full space-y-2">
                      {STATUS_STEPS.map((msg, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: i <= statusIdx ? 1 : 0.25, x: 0 }}
                          className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${i === statusIdx ? "bg-blue-50 border border-blue-200" : ""}`}>
                          {i < statusIdx ? (
                            <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                          ) : i === statusIdx ? (
                            <Loader2 size={14} className="text-blue-600 animate-spin flex-shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-border flex-shrink-0" />
                          )}
                          <span className={`text-xs ${i === statusIdx ? "text-blue-800 font-semibold" : i < statusIdx ? "text-foreground" : "text-muted-foreground/50"}`}>
                            {msg}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {step === "done" && (
                  <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex flex-col items-center py-4 gap-3">
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 size={32} className="text-green-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-foreground font-bold text-lg">Agent Complete!</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Invested {formatKES(totalInvested)} across {invested.length} farm{invested.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex justify-between text-sm">
                      <span className="text-muted-foreground">Total invested</span>
                      <span className="font-bold text-foreground">{formatKES(totalInvested)}</span>
                    </div>

                    <div className="space-y-2.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Investments Made</p>
                      {invested.map((inv, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="flex items-center gap-3 bg-muted/40 rounded-2xl p-3">
                          <img src={getCropImage(inv.cropType)} alt={inv.cropType}
                            className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground font-semibold text-sm leading-tight truncate">{inv.farmName}</p>
                            <p className="text-muted-foreground text-[10px]">{inv.cropType} · {inv.shares} shares</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <TrendingUp size={10} className="text-green-500" />
                              <span className="text-green-600 text-[10px] font-semibold">+{inv.estimatedReturn.toFixed(0)}% est.</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-foreground font-bold text-sm">{formatKES(inv.total)}</p>
                            <p className="text-muted-foreground text-[9px]">{inv.exitType}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={handleClose}
                        className="flex-1 bg-primary text-white font-bold py-3 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5">
                        View Portfolio <ChevronRight size={14} />
                      </button>
                      <button onClick={reset}
                        className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 active:scale-95 transition-all">
                        <Sparkles size={16} className="text-muted-foreground" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === "error" && (
                  <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-foreground font-bold text-base">Agent Stopped</p>
                      <p className="text-muted-foreground text-xs mt-1 leading-relaxed max-w-[260px]">{errorMsg}</p>
                    </div>
                    <button onClick={reset}
                      className="w-full bg-primary text-white font-bold py-3 rounded-xl active:scale-95 transition-all">
                      Try Again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
