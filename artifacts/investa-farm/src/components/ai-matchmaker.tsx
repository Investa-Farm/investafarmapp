import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Sparkles, Target, CheckCircle2, TrendingUp, Loader2,
  RefreshCw, MapPin, ChevronRight, Shield, Zap, Rocket,
  Calendar, Wallet,
} from "lucide-react";
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

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const deg = pct * 3.6;
  const color = pct >= 80 ? "#16a34a" : pct >= 60 ? "#d97706" : "#6b7280";
  const label = pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : "Fair";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-14 h-14 rounded-full p-[3px]"
        style={{
          background: `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.08) ${deg}deg)`,
        }}
      >
        <div className="w-full h-full rounded-full bg-black/70 flex flex-col items-center justify-center">
          <span className="text-white font-black text-sm leading-none">{pct}%</span>
        </div>
      </div>
      <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
    </div>
  );
}

const RISK_OPTIONS = [
  { value: "low",    label: "Conservative", icon: <Shield size={14} />,  accent: "#15803d", bg: "#dcfce7", border: "#86efac", desc: "Stable returns" },
  { value: "medium", label: "Balanced",     icon: <Target size={14} />,  accent: "#b45309", bg: "#fef3c7", border: "#fcd34d", desc: "Moderate risk" },
  { value: "high",   label: "Aggressive",   icon: <Rocket size={14} />,  accent: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd", desc: "High potential" },
];

const DURATION_OPTS = [
  { v: 1,  label: "1m" },
  { v: 2,  label: "2m" },
  { v: 4,  label: "4m" },
  { v: 6,  label: "6m" },
  { v: 12, label: "1yr" },
];

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
    setSelectedCrops(prev => prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]);

  const handleMatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ targetReturnPct: targetReturn, riskTolerance, preferredCrops: selectedCrops, durationMonths: duration, amount }),
      });
      if (!r.ok) throw new Error("Server error");
      const data = await r.json() as { matches?: Match[]; error?: string };
      if (data.error) throw new Error(data.error);
      setMatches(data.matches ?? []);
      setStep("results");
    } catch (e: unknown) {
      setError((e as Error).message || "Unable to connect. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setStep("prefs"); setMatches([]); setError(null); };
  const selectedRisk = RISK_OPTIONS.find(r => r.value === riskTolerance)!;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: "92dvh", background: "hsl(var(--background))" }}
          >
            {/* ── Header ── */}
            <div className="relative flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(145deg,#052e16 0%,#14532d 55%,#166534 100%)" }}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #4ade80 0%, transparent 45%)" }} />
              <div className="relative px-5 pt-5 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shadow-inner">
                    <Sparkles size={18} className="text-green-300" />
                  </div>
                  <div>
                    <p className="text-white font-extrabold text-sm tracking-tight">AI Smart Match</p>
                    <p className="text-green-300/70 text-[10px] font-medium">
                      {step === "results" ? `${matches.length} farm${matches.length !== 1 ? "s" : ""} matched` : "Set your goals · Find your farms"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {step === "results" && (
                    <button onClick={reset}
                      className="w-8 h-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center active:scale-90 transition-transform">
                      <RefreshCw size={13} className="text-white/80" />
                    </button>
                  )}
                  <button onClick={onClose}
                    className="w-8 h-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center active:scale-90 transition-transform">
                    <X size={14} className="text-white/80" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Content ── */}
            <div className="overflow-y-auto flex-1 overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
              <AnimatePresence mode="wait">

                {/* ── Preferences form ── */}
                {step === "prefs" && (
                  <motion.div key="prefs" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="px-5 pt-5 pb-8 space-y-6">

                    {/* Intro callout */}
                    <div className="bg-primary/8 border border-primary/20 rounded-2xl p-3.5 flex items-start gap-2.5">
                      <Target size={14} className="text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-foreground/80 text-xs leading-relaxed">
                        Tell us your goals and we'll scan every active farm to find your highest-matching opportunities — with personalised scores.
                      </p>
                    </div>

                    {/* ── Target Return ── */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp size={13} className="text-primary" />
                          <p className="text-xs font-bold text-foreground uppercase tracking-wider">Target Return</p>
                        </div>
                        <div className="bg-primary text-white text-sm font-black px-3 py-1 rounded-xl shadow-sm shadow-primary/25">
                          {targetReturn}%
                        </div>
                      </div>
                      <input type="range" min={8} max={40} step={1} value={targetReturn}
                        onChange={e => setTargetReturn(+e.target.value)}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
                        style={{ background: `linear-gradient(to right, #16a34a ${((targetReturn - 8) / 32) * 100}%, #e5e7eb ${((targetReturn - 8) / 32) * 100}%)` }}
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-1.5 font-medium">
                        <span>8% · Safe</span><span>24% · Balanced</span><span>40% · Growth</span>
                      </div>
                    </div>

                    {/* ── Risk Tolerance ── */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <Shield size={13} className="text-primary" />
                        <p className="text-xs font-bold text-foreground uppercase tracking-wider">Risk Tolerance</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {RISK_OPTIONS.map(r => {
                          const active = riskTolerance === r.value;
                          return (
                            <button key={r.value} onClick={() => setRiskTolerance(r.value as any)}
                              className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95 ${
                                active ? "border-current shadow-sm" : "border-border bg-card"
                              }`}
                              style={active ? { background: r.bg, borderColor: r.border, color: r.accent } : {}}>
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${active ? "" : "bg-muted text-muted-foreground"}`}
                                style={active ? { background: r.border } : {}}>
                                {r.icon}
                              </div>
                              <p className="text-[10px] font-bold leading-tight">{r.label}</p>
                              <p className="text-[8px] opacity-70 font-medium">{r.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Investment Amount ── */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <Wallet size={13} className="text-primary" />
                        <p className="text-xs font-bold text-foreground uppercase tracking-wider">Investment Amount</p>
                      </div>
                      <div className="flex items-center gap-3 bg-muted/60 rounded-2xl px-4 py-3 border border-border mb-2.5">
                        <span className="text-muted-foreground text-sm font-semibold">KES</span>
                        <input type="number" value={amount} onChange={e => setAmount(+e.target.value)}
                          className="flex-1 bg-transparent text-foreground font-black text-xl focus:outline-none"
                          placeholder="10,000" />
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                        {[5000, 10000, 25000, 50000, 100000].map(a => (
                          <button key={a} onClick={() => setAmount(a)}
                            className={`flex-shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all ${
                              amount === a ? "bg-primary text-white border-primary shadow-sm" : "border-border text-muted-foreground bg-card"
                            }`}>
                            {a >= 1000 ? `${a / 1000}K` : a}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Duration ── */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-primary" />
                          <p className="text-xs font-bold text-foreground uppercase tracking-wider">Investment Duration</p>
                        </div>
                        <span className="text-xs font-bold text-primary">{duration} month{duration !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex gap-2">
                        {DURATION_OPTS.map(({ v, label }) => (
                          <button key={v} onClick={() => setDuration(v)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                              duration === v ? "bg-primary text-white border-primary shadow-sm" : "border-border text-muted-foreground bg-card"
                            }`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Preferred Crops ── */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">🌾</span>
                          <p className="text-xs font-bold text-foreground uppercase tracking-wider">Preferred Crops</p>
                        </div>
                        <span className="text-[9px] text-muted-foreground/60 font-medium">Optional</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {CROPS_LIST.map(crop => (
                          <button key={crop} onClick={() => toggleCrop(crop)}
                            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all border ${
                              selectedCrops.includes(crop)
                                ? "bg-primary/10 text-primary border-primary/40 shadow-sm"
                                : "border-border text-muted-foreground bg-card"
                            }`}>
                            {crop}
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-red-600 text-xs leading-relaxed">{error}</p>
                      </div>
                    )}

                    {/* CTA */}
                    <button onClick={handleMatch} disabled={loading}
                      className="w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2.5 active:scale-95 transition-all disabled:opacity-70 shadow-xl shadow-green-600/25"
                      style={{ background: "linear-gradient(135deg,#14532d 0%,#16a34a 60%,#22c55e 100%)", color: "#fff" }}>
                      {loading
                        ? <><Loader2 size={17} className="animate-spin" /> Scanning active farms…</>
                        : <><Sparkles size={17} /> Find My Best Farms</>}
                    </button>
                  </motion.div>
                )}

                {/* ── Results ── */}
                {step === "results" && (
                  <motion.div key="results" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="px-4 pt-4 pb-10 space-y-4">
                    {/* Summary banner */}
                    <div className="flex items-center gap-2.5 bg-primary/8 border border-primary/20 rounded-2xl p-3">
                      <CheckCircle2 size={15} className="text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-bold text-xs">
                          {matches.length > 0
                            ? `${matches.length} farms matched your profile`
                            : "No matching farms right now"}
                        </p>
                        <p className="text-muted-foreground text-[10px] mt-0.5">
                          {targetReturn}% target · {selectedRisk.label} risk · {duration}mo · {formatKES(amount)}
                        </p>
                      </div>
                      <button onClick={reset}
                        className="flex items-center gap-1 text-primary text-[10px] font-bold bg-primary/10 px-2.5 py-1.5 rounded-lg flex-shrink-0 active:scale-95 transition-transform">
                        <RefreshCw size={9} /> Redo
                      </button>
                    </div>

                    {matches.length === 0 ? (
                      <div className="text-center py-14">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                          <Sparkles size={28} className="text-muted-foreground/30" />
                        </div>
                        <p className="text-foreground font-semibold text-sm">No matches found</p>
                        <p className="text-muted-foreground text-xs mt-1 leading-relaxed">Try broadening your criteria — lower the target return or widen your crop preferences.</p>
                        <button onClick={reset} className="mt-5 text-primary text-sm font-semibold underline underline-offset-2">Adjust preferences</button>
                      </div>
                    ) : (
                      matches.map((m, i) => {
                        const img = getCropImage(m.cropType);
                        const isTop = i === 0;
                        return (
                          <motion.div key={m.farmId}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className={`rounded-2xl overflow-hidden border shadow-md ${isTop ? "border-primary/30 shadow-green-500/12" : "border-border shadow-black/5"}`}
                          >
                            {/* Hero image */}
                            <div className="relative h-40">
                              <img src={img} alt={m.farmName} className="w-full h-full object-cover" />
                              <div className="absolute inset-0"
                                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.1) 100%)" }} />

                              {/* Top row — rank badge + score ring */}
                              <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                                <div className="flex items-center gap-1.5">
                                  {isTop && (
                                    <span className="bg-primary text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                                      ★ Top Pick
                                    </span>
                                  )}
                                  {!isTop && (
                                    <span className="bg-black/40 text-white/80 text-[8px] font-bold px-2 py-0.5 rounded-full">
                                      #{i + 1}
                                    </span>
                                  )}
                                </div>
                                <ScoreRing score={m.matchScore} />
                              </div>

                              {/* Bottom — name + location */}
                              <div className="absolute bottom-0 left-0 right-0 p-3.5">
                                <p className="text-white font-extrabold text-base leading-tight">{m.farmName}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-white/65 text-[10px] font-medium">{m.cropType}</span>
                                  {m.location && (
                                    <>
                                      <span className="text-white/30 text-[10px]">·</span>
                                      <div className="flex items-center gap-0.5">
                                        <MapPin size={8} className="text-white/50" />
                                        <span className="text-white/65 text-[10px]">{m.location.split(",")[0]}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Body */}
                            <div className="bg-card p-3.5 space-y-3">
                              {/* Match reason */}
                              <div className="flex items-start gap-2 bg-primary/6 border border-primary/15 rounded-xl p-2.5">
                                <Zap size={11} className="text-primary flex-shrink-0 mt-0.5" />
                                <p className="text-foreground/80 text-[11px] leading-relaxed italic">"{m.matchReason}"</p>
                              </div>

                              {/* Stats row */}
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1">
                                    <TrendingUp size={11} className="text-green-500" />
                                    <span className="text-green-600 text-xs font-extrabold">
                                      +{m.expectedReturnLow?.toFixed(0)}–{m.expectedReturnHigh?.toFixed(0)}% est. return
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground text-[9px]">
                                    {formatKES(m.pricePerShare)}/share · {m.sharesAvailable.toLocaleString()} available
                                  </p>
                                </div>
                                <button
                                  onClick={() => { setLocation(m.farmId ? `/market/${m.farmId}` : "/market/primary"); onClose(); }}
                                  className="flex items-center gap-1.5 bg-primary text-white text-[11px] font-bold px-4 py-2.5 rounded-xl active:scale-95 transition-transform shadow-sm shadow-primary/25">
                                  View Farm <ChevronRight size={11} />
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
