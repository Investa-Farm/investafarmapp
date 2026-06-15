import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Target, CheckCircle2, TrendingUp, Loader2, RefreshCw, MapPin } from "lucide-react";
import { getCropImage } from "@/lib/crops";
import { formatKES, getToken } from "@/lib/auth";
import { useLocation } from "wouter";

const CROPS_LIST = ["Maize", "Beans", "Tomatoes", "Coffee", "Tea", "Dairy", "Rice", "Kale", "Wheat", "Avocado"];

interface Match {
  farmId: number;
  farmName: string;
  cropType: string;
  pricePerShare: number;
  sharesAvailable: number;
  changePercent: number;
  location?: string;
  matchScore: number;
  matchReason: string;
  expectedReturnLow: number;
  expectedReturnHigh: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AiMatchmaker({ open, onClose }: Props) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"prefs" | "results">("prefs");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [targetReturn, setTargetReturn] = useState(20);
  const [riskTolerance, setRiskTolerance] = useState<"low" | "medium" | "high">("medium");
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [duration, setDuration] = useState(4);
  const [amount, setAmount] = useState(10000);

  const toggleCrop = (crop: string) =>
    setSelectedCrops(prev =>
      prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]
    );

  const handleMatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          targetReturnPct: targetReturn,
          riskTolerance,
          preferredCrops: selectedCrops,
          durationMonths: duration,
          amount,
        }),
      });
      if (!r.ok) throw new Error("Server error");
      const data = await r.json() as { matches?: Match[]; error?: string };
      if (data.error) throw new Error(data.error);
      setMatches(data.matches ?? []);
      setStep("results");
    } catch (e: unknown) {
      setError((e as Error).message || "Unable to connect to AI. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setStep("prefs"); setMatches([]); setError(null); };

  const RISK_LABELS = { low: "🛡️ Low", medium: "⚖️ Medium", high: "🚀 High" };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: "90vh" }}
          >
            <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center shadow-md shadow-green-600/30">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm">AI Smart Match</p>
                  <p className="text-muted-foreground text-[10px]">Personalised farm recommendations</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {step === "results" && (
                  <button onClick={reset} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <RefreshCw size={13} className="text-muted-foreground" />
                  </button>
                )}
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={15} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 pt-4 pb-6">
              <AnimatePresence mode="wait">
                {step === "prefs" && (
                  <motion.div key="prefs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-start gap-2">
                      <Target size={14} className="text-green-700 flex-shrink-0 mt-0.5" />
                      <p className="text-green-800 text-xs leading-relaxed">
                        Set your investment goals and the AI will scan all active farms to find your best matches — with match scores and return estimates.
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Target Return: <span className="text-primary font-extrabold">{targetReturn}%</span>
                      </label>
                      <input type="range" min={8} max={40} step={1} value={targetReturn}
                        onChange={e => setTargetReturn(+e.target.value)}
                        className="w-full accent-primary h-1.5 rounded-full" />
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                        <span>8% conservative</span><span>40% aggressive</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Risk Tolerance</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["low", "medium", "high"] as const).map(r => (
                          <button key={r} onClick={() => setRiskTolerance(r)}
                            className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${riskTolerance === r ? "bg-primary text-white border-primary shadow-sm" : "border-border text-muted-foreground bg-white"}`}>
                            {RISK_LABELS[r]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Duration: <span className="text-primary font-extrabold">{duration} month{duration !== 1 ? "s" : ""}</span>
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 4, 6, 12].map(m => (
                          <button key={m} onClick={() => setDuration(m)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${duration === m ? "bg-primary text-white border-primary" : "border-border text-muted-foreground bg-white"}`}>
                            {m}m
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Investment Amount (KES)
                      </label>
                      <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(+e.target.value)}
                        className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary bg-background"
                        placeholder="10,000"
                      />
                      <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                        {[5000, 10000, 25000, 50000, 100000].map(a => (
                          <button key={a} onClick={() => setAmount(a)}
                            className={`flex-shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${amount === a ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                            {formatKES(a)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Preferred Crops <span className="font-normal">(optional — leave blank for any)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {CROPS_LIST.map(crop => (
                          <button key={crop} onClick={() => toggleCrop(crop)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all border ${selectedCrops.includes(crop) ? "bg-green-100 text-green-700 border-green-400" : "border-border text-muted-foreground bg-white"}`}>
                            {crop}
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-red-600 text-xs">{error}</p>
                      </div>
                    )}

                    <button
                      onClick={handleMatch}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-green-700 to-green-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-green-600/25 disabled:opacity-70"
                    >
                      {loading
                        ? <><Loader2 size={16} className="animate-spin" /> Analysing {15} active farms…</>
                        : <><Sparkles size={16} /> Find My Best Farms</>}
                    </button>
                  </motion.div>
                )}

                {step === "results" && (
                  <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
                      <p className="font-semibold text-sm">Top {matches.length} farms matched to your goals</p>
                    </div>
                    {matches.length === 0 ? (
                      <div className="text-center py-10">
                        <Sparkles size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground text-sm">No matches found for these preferences.</p>
                        <p className="text-muted-foreground text-xs mt-1">Try broadening your criteria.</p>
                        <button onClick={reset} className="mt-4 text-primary text-sm font-semibold underline underline-offset-2">Adjust preferences</button>
                      </div>
                    ) : (
                      matches.map((m, i) => {
                        const img = getCropImage(m.cropType);
                        return (
                          <motion.div key={m.farmId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className="rounded-2xl border border-border overflow-hidden shadow-sm shadow-green-500/10">
                            <div className="relative h-24">
                              <img src={img} alt={m.farmName} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent p-3 flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/80 bg-white/15 px-2 py-0.5 rounded-full">
                                    #{i + 1} Best Match
                                  </span>
                                  <div className="flex items-center gap-1 bg-gradient-to-r from-green-700 to-green-600 px-2.5 py-1 rounded-full shadow-sm">
                                    <Sparkles size={8} className="text-white" />
                                    <span className="text-white text-[9px] font-extrabold">{m.matchScore}% match</span>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-white font-bold text-sm leading-tight">{m.farmName}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-white/70 text-[10px]">{m.cropType}</span>
                                    {m.location && (
                                      <>
                                        <span className="text-white/40 text-[10px]">·</span>
                                        <MapPin size={8} className="text-white/60" />
                                        <span className="text-white/70 text-[10px]">{m.location.split(",")[0]}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="p-3 space-y-2.5">
                              <p className="text-muted-foreground text-[11px] leading-relaxed italic">"{m.matchReason}"</p>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-1">
                                    <TrendingUp size={11} className="text-green-500" />
                                    <span className="text-green-600 text-xs font-bold">
                                      +{m.expectedReturnLow?.toFixed(0)}–{m.expectedReturnHigh?.toFixed(0)}% est.
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground text-[9px] mt-0.5">
                                    {formatKES(m.pricePerShare)}/share · {m.sharesAvailable} available
                                  </p>
                                </div>
                                <button
                                  onClick={() => { setLocation(`/market/exchange/${m.farmId}`); onClose(); }}
                                  className="bg-primary text-white text-[10px] font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform shadow-sm">
                                  View Farm →
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
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
