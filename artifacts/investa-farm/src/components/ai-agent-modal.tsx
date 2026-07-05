/**
 * AiAgentModal — fully autonomous AI investment agent
 *
 * Flow (zero human intervention after "Run"):
 *  1. Setup   — set budget / risk / diversification (auto-loaded from last run)
 *  2. Running — AI scores farms via Groq, then places all buys automatically
 *              Live feed shows each investment card as it's executed
 *  3. Done    — full summary with AI reasoning per farm
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Bot, Zap, CheckCircle2, Loader2, TrendingUp,
  AlertCircle, Sparkles, ChevronRight, Brain,
  ShieldCheck, BarChart3, Wallet,
} from "lucide-react";
import { formatKES, getToken } from "@/lib/auth";
import { getCropImage } from "@/lib/crops";
import { useLocation } from "wouter";
import { nonceHeaders } from "@/lib/nonce";
import { useQueryClient } from "@tanstack/react-query";
import { getListPrimaryMarketQueryKey } from "@workspace/api-client-react";

// ── Persistence ───────────────────────────────────────────────────────────────
const LS_CONFIG = "investa_agent_config";

interface AgentConfig {
  budget: number;
  risk: "low" | "medium" | "high";
  maxFarms: number;
}

function loadConfig(): AgentConfig {
  try {
    const raw = localStorage.getItem(LS_CONFIG);
    if (raw) return { budget: 20000, risk: "medium", maxFarms: 3, ...JSON.parse(raw) };
  } catch {}
  return { budget: 20000, risk: "medium", maxFarms: 3 };
}

function saveConfig(c: AgentConfig) {
  try { localStorage.setItem(LS_CONFIG, JSON.stringify(c)); } catch {}
}

// ── Types ─────────────────────────────────────────────────────────────────────
type AgentStep = "setup" | "scoring" | "running" | "done" | "error";

interface LiveInvestment {
  farmName: string;
  cropType: string;
  location?: string;
  shares: number;
  pricePerShare: number;
  total: number;
  exitType: string;
  aiReason: string;
  confidence: number;
  status: "pending" | "investing" | "done" | "failed";
}

const RISK_PROFILES = {
  low:    { label: "Conservative", emoji: "🛡️", returnMin: 8,  returnMax: 15, color: "#16a34a", exitType: "wide_season"  as const, desc: "Stable staple crops, low volatility" },
  medium: { label: "Balanced",     emoji: "⚖️", returnMin: 15, returnMax: 22, color: "#2563eb", exitType: "full_season"  as const, desc: "Mixed portfolio, moderate returns" },
  high:   { label: "Aggressive",   emoji: "🚀", returnMin: 20, returnMax: 30, color: "#7c3aed", exitType: "full_season"  as const, desc: "High-yield cash crops, higher risk" },
};

const PHASE_MSGS = [
  { icon: "🌐", text: "Fetching live market listings…" },
  { icon: "🤖", text: "Sending to Groq AI for analysis…" },
  { icon: "📊", text: "Scoring farms against your risk profile…" },
  { icon: "🎯", text: "Selecting optimal portfolio allocation…" },
  { icon: "💰", text: "Verifying wallet balance…" },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void; }

// ── Component ─────────────────────────────────────────────────────────────────
export function AiAgentModal({ open, onClose }: Props) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const token = getToken();

  const [step, setStep] = useState<AgentStep>("setup");
  const [config, setConfig] = useState<AgentConfig>(loadConfig);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [phaseMsg, setPhaseMsg] = useState(PHASE_MSGS[0]!.text);
  const [liveQueue, setLiveQueue] = useState<LiveInvestment[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [errorMsg, setErrorMsg] = useState("");
  const [totalInvested, setTotalInvested] = useState(0);
  const [roiRange, setRoiRange] = useState<[number, number]>([15, 22]);
  const abortRef = useRef(false);

  // Load wallet balance when modal opens (for budget validation in setup)
  useEffect(() => {
    if (!open || !token) return;
    fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setWalletBalance(parseFloat(d?.wallet?.balance ?? "0")))
      .catch(() => {});
  }, [open, token]);

  const reset = () => {
    abortRef.current = false;
    setStep("setup");
    setPhaseIdx(0);
    setPhaseMsg(PHASE_MSGS[0]!.text);
    setLiveQueue([]);
    setActiveIdx(-1);
    setErrorMsg("");
    setTotalInvested(0);
  };

  const handleClose = () => { onClose(); setTimeout(reset, 400); };

  const updateConfig = (patch: Partial<AgentConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveConfig(next);
  };

  // ── Animate phase messages ─────────────────────────────────────────────────
  const advancePhase = async (idx: number) => {
    const msg = PHASE_MSGS[Math.min(idx, PHASE_MSGS.length - 1)]!;
    setPhaseIdx(idx);
    setPhaseMsg(msg.text);
  };

  // ── Main autonomous agent execution ───────────────────────────────────────
  const runAgent = async () => {
    abortRef.current = false;
    const { budget, risk, maxFarms } = config;
    const profile = RISK_PROFILES[risk];

    setStep("scoring");
    await advancePhase(0);

    try {
      // ① Fetch live listings
      const listingsResp = await fetch("/api/market/primary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listingsResp.ok) throw new Error("Could not fetch market listings");
      const listingsData = await listingsResp.json();
      const listings: any[] = (Array.isArray(listingsData) ? listingsData : listingsData.listings ?? [])
        .filter((l: any) => l.sharesAvailable > 0);

      if (listings.length === 0) throw new Error("No active farm listings available right now. Try again later.");

      await advancePhase(1);
      await new Promise(r => setTimeout(r, 500));

      // ② Send to AI for scoring
      const scoreResp = await fetch("/api/agent/score", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listings, risk, budget, maxFarms }),
      });
      if (!scoreResp.ok) throw new Error("AI scoring service unavailable");
      const { selected, roiRange: rRange } = await scoreResp.json() as {
        selected: Array<{ id: number; reason: string; confidence: number; suggestedShares: number; suggestedAmount: number }>;
        roiRange: [number, number];
      };

      if (!selected?.length) throw new Error("AI could not find suitable farms for your parameters.");
      setRoiRange(rRange);

      await advancePhase(2);
      await new Promise(r => setTimeout(r, 400));

      // ③ Build the live queue from AI selections
      const queue: LiveInvestment[] = selected.map(sel => {
        const listing = listings.find((l: any) => l.id === sel.id);
        if (!listing) return null;
        return {
          farmName: listing.farmName,
          cropType: listing.cropType,
          location: listing.location,
          shares: sel.suggestedShares,
          pricePerShare: listing.pricePerShare,
          total: sel.suggestedAmount,
          exitType: profile.exitType === "full_season" ? "Full Season" : "Mid-Season",
          aiReason: sel.reason,
          confidence: sel.confidence,
          status: "pending" as const,
        };
      }).filter(Boolean) as LiveInvestment[];

      if (queue.length === 0) throw new Error("No valid farms matched your budget.");

      await advancePhase(3);
      setLiveQueue(queue);
      await new Promise(r => setTimeout(r, 400));

      await advancePhase(4);
      await new Promise(r => setTimeout(r, 300));

      // ④ Switch to running view and execute each buy
      setStep("running");

      let totalSpent = 0;
      const finalQueue = [...queue];

      for (let i = 0; i < finalQueue.length; i++) {
        if (abortRef.current) break;
        const item = finalQueue[i]!;

        // Mark as actively investing
        finalQueue[i] = { ...item, status: "investing" };
        setLiveQueue([...finalQueue]);
        setActiveIdx(i);

        await new Promise(r => setTimeout(r, 350));

        try {
          const listing = listings.find((l: any) => l.farmName === item.farmName);
          if (!listing) throw new Error("Listing not found");

          const buyResp = await fetch("/api/market/buy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              ...nonceHeaders(),
            },
            body: JSON.stringify({
              listingId: listing.id,
              quantity: item.shares,
              exitType: profile.exitType,
            }),
          });

          if (buyResp.ok) {
            finalQueue[i] = { ...finalQueue[i]!, status: "done" };
            totalSpent += item.total;
          } else {
            const errData = await buyResp.json().catch(() => ({}));
            finalQueue[i] = { ...finalQueue[i]!, status: "failed", aiReason: (errData as any).error ?? item.aiReason };
          }
        } catch {
          finalQueue[i] = { ...finalQueue[i]!, status: "failed" };
        }

        setLiveQueue([...finalQueue]);
        await new Promise(r => setTimeout(r, 300));
      }

      setActiveIdx(-1);

      const succeeded = finalQueue.filter(f => f.status === "done");
      if (succeeded.length === 0) {
        throw new Error("No investments could be placed. Check your wallet balance and try again.");
      }

      setTotalInvested(totalSpent);
      setLiveQueue(finalQueue);

      // ⑤ Invalidate caches
      qc.invalidateQueries({ queryKey: getListPrimaryMarketQueryKey() });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["portfolio-summary"] });

      setStep("done");

    } catch (e: any) {
      setErrorMsg(e.message ?? "Something went wrong. Please try again.");
      setStep("error");
    }
  };

  const profile = RISK_PROFILES[config.risk];
  const budgetExceedsBalance = walletBalance !== null && config.budget > walletBalance;
  const succeededInvestments = liveQueue.filter(f => f.status === "done");

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={step !== "scoring" && step !== "running" ? handleClose : undefined} />

          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: "92dvh" }}
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                  style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)" }}>
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    AI Investment Agent
                    <span className="text-[9px] font-black bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full border border-violet-200">AUTONOMOUS</span>
                  </p>
                  <p className="text-muted-foreground text-[10px]">
                    {step === "setup"   ? "Configure · AI does the rest" :
                     step === "scoring" ? "Analysing market…" :
                     step === "running" ? `Investing in ${liveQueue.length} farm${liveQueue.length !== 1 ? "s" : ""}…` :
                     step === "done"    ? `${succeededInvestments.length} investment${succeededInvestments.length !== 1 ? "s" : ""} complete` :
                     "Agent stopped"}
                  </p>
                </div>
              </div>
              {(step === "setup" || step === "done" || step === "error") && (
                <button onClick={handleClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={15} className="text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 px-5 pt-4 pb-8">
              <AnimatePresence mode="wait">

                {/* ── SETUP ─────────────────────────────────────────────── */}
                {step === "setup" && (
                  <motion.div key="setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="space-y-5">

                    {/* Wallet balance strip */}
                    <div className="flex items-center justify-between bg-muted/60 rounded-2xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Wallet size={14} className="text-muted-foreground" />
                        <p className="text-muted-foreground text-xs">Available balance</p>
                      </div>
                      {walletBalance === null
                        ? <div className="w-24 h-4 bg-muted animate-pulse rounded" />
                        : <p className="text-foreground font-bold text-sm">{formatKES(walletBalance)}</p>}
                    </div>

                    {/* Budget */}
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Investment Budget (KES)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">KES</span>
                        <input
                          type="number" value={config.budget}
                          onChange={e => updateConfig({ budget: Math.max(500, +e.target.value) })}
                          className="w-full border-2 border-border rounded-xl pl-12 pr-4 py-2.5 text-sm font-bold focus:outline-none focus:border-blue-500 bg-background"
                        />
                      </div>
                      {budgetExceedsBalance && (
                        <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1">
                          <AlertCircle size={10} /> Exceeds wallet balance — top up first or lower budget
                        </p>
                      )}
                      <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                        {[5000, 10000, 25000, 50000, 100000].map(a => (
                          <button key={a} onClick={() => updateConfig({ budget: a })}
                            className={`flex-shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${config.budget === a ? "border-blue-500 text-blue-600 bg-blue-50" : "border-border text-muted-foreground"}`}>
                            {formatKES(a)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Risk */}
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Risk Profile</label>
                      <div className="space-y-2">
                        {(Object.entries(RISK_PROFILES) as [keyof typeof RISK_PROFILES, typeof RISK_PROFILES["low"]][]).map(([key, val]) => (
                          <button key={key} onClick={() => updateConfig({ risk: key })}
                            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${config.risk === key ? "border-blue-500 bg-blue-50" : "border-border bg-background hover:bg-muted/30"}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">{val.emoji} {val.label}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.risk === key ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>
                                {val.returnMin}–{val.returnMax}% est.
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10px] mt-0.5">{val.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Diversification */}
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Spread across <span className="text-blue-600 font-extrabold">{config.maxFarms} farm{config.maxFarms !== 1 ? "s" : ""}</span>
                        <span className="text-muted-foreground font-normal ml-1">(~{formatKES(Math.floor(config.budget / config.maxFarms))} each)</span>
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} onClick={() => updateConfig({ maxFarms: n })}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${config.maxFarms === n ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground bg-background"}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="rounded-2xl overflow-hidden border border-border">
                      <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40">
                        Agent summary
                      </div>
                      <div className="divide-y divide-border">
                        {[
                          ["Budget",      formatKES(config.budget)],
                          ["Risk",        `${profile.emoji} ${profile.label}`],
                          ["Farms",       `Up to ${config.maxFarms}`],
                          ["Est. return", `+${profile.returnMin}–${profile.returnMax}%`],
                          ["Exit type",   profile.exitType === "full_season" ? "Full Season (~6mo)" : "Mid-Season (30–60d)"],
                        ].map(([label, val]) => (
                          <div key={label} className="flex justify-between items-center px-4 py-2.5 text-xs">
                            <span className="text-muted-foreground">{label}</span>
                            <span className={`font-bold ${label === "Est. return" ? "text-green-600" : "text-foreground"}`}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={runAgent}
                      disabled={budgetExceedsBalance || config.budget < 500}
                      className="w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)" }}
                    >
                      <Zap size={18} />
                      Run AI Agent — Invest Automatically
                    </button>

                    <p className="text-center text-muted-foreground text-[10px]">
                      The agent will scan farms, use Groq AI to select the best match, and place all investments — no confirmation needed.
                    </p>
                  </motion.div>
                )}

                {/* ── SCORING (AI analysis phase) ───────────────────────── */}
                {step === "scoring" && (
                  <motion.div key="scoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="py-6 flex flex-col items-center gap-6">

                    {/* Pulsing brain */}
                    <div className="relative">
                      <motion.div
                        className="w-20 h-20 rounded-full flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)" }}
                        animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                      >
                        <Brain size={36} className="text-white" />
                      </motion.div>
                      <motion.div className="absolute inset-0 rounded-full border-2 border-violet-400/40"
                        animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0, 0.7] }}
                        transition={{ duration: 1.5, repeat: Infinity }} />
                    </div>

                    <div className="text-center">
                      <p className="text-foreground font-bold text-base">AI is analysing…</p>
                      <p className="text-muted-foreground text-xs mt-1">Groq is selecting the best farms for you</p>
                    </div>

                    {/* Phase steps */}
                    <div className="w-full space-y-2">
                      {PHASE_MSGS.map((m, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: i <= phaseIdx ? 1 : 0.3, x: 0 }}
                          className={`flex items-center gap-3 p-2.5 rounded-xl ${i === phaseIdx ? "bg-violet-50 border border-violet-200" : ""}`}>
                          {i < phaseIdx
                            ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                            : i === phaseIdx
                              ? <Loader2 size={14} className="text-violet-600 animate-spin flex-shrink-0" />
                              : <div className="w-3.5 h-3.5 rounded-full border-2 border-border flex-shrink-0" />}
                          <span className={`text-xs ${i === phaseIdx ? "text-violet-800 font-semibold" : i < phaseIdx ? "text-foreground" : "text-muted-foreground/40"}`}>
                            <span className="mr-1">{m.icon}</span>{m.text}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── RUNNING (live investment feed) ────────────────────── */}
                {step === "running" && (
                  <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="space-y-4">

                    {/* Live progress header */}
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)" }}>
                        <Bot size={18} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground font-bold text-sm">Placing investments…</p>
                        <p className="text-muted-foreground text-xs">
                          {liveQueue.filter(f => f.status === "done").length}/{liveQueue.length} complete
                        </p>
                      </div>
                      <div className="flex gap-0.5">
                        {[0,1,2].map(i => (
                          <motion.div key={i} className="w-1.5 h-4 rounded-full bg-blue-600"
                            animate={{ scaleY: [1, 1.8, 1] }}
                            transition={{ delay: i * 0.15, duration: 0.7, repeat: Infinity }} />
                        ))}
                      </div>
                    </div>

                    {/* Live farm cards */}
                    <div className="space-y-2.5">
                      {liveQueue.map((item, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={`rounded-2xl border overflow-hidden transition-all ${
                            item.status === "done"    ? "border-green-200 bg-green-50/40" :
                            item.status === "failed"  ? "border-red-200 bg-red-50/40" :
                            item.status === "investing" ? "border-blue-300 bg-blue-50/60" :
                            "border-border bg-background opacity-60"
                          }`}>
                          <div className="flex items-center gap-3 p-3">
                            <div className="relative flex-shrink-0">
                              <img src={getCropImage(item.cropType)} alt={item.cropType}
                                className="w-12 h-12 rounded-xl object-cover" />
                              {/* Status badge */}
                              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center ${
                                item.status === "done"      ? "bg-green-500" :
                                item.status === "failed"    ? "bg-red-500" :
                                item.status === "investing" ? "bg-blue-500" :
                                "bg-muted"
                              }`}>
                                {item.status === "done"      && <CheckCircle2 size={10} className="text-white" />}
                                {item.status === "failed"    && <X size={9} className="text-white" />}
                                {item.status === "investing" && <Loader2 size={9} className="text-white animate-spin" />}
                                {item.status === "pending"   && <div className="w-2 h-2 rounded-full bg-muted-foreground" />}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-foreground font-semibold text-sm leading-tight truncate">{item.farmName}</p>
                              <p className="text-muted-foreground text-[10px]">{item.cropType} · {item.shares} shares</p>
                              {/* AI reason */}
                              <p className="text-muted-foreground/70 text-[9px] mt-0.5 italic leading-tight line-clamp-1">
                                🤖 {item.aiReason}
                              </p>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className={`font-bold text-sm ${item.status === "failed" ? "text-red-500 line-through" : "text-foreground"}`}>
                                {formatKES(item.total)}
                              </p>
                              {item.status === "done" && (
                                <p className="text-green-600 text-[9px] font-bold flex items-center justify-end gap-0.5">
                                  <CheckCircle2 size={8} /> Invested
                                </p>
                              )}
                              {item.status === "investing" && (
                                <p className="text-blue-600 text-[9px] font-bold">In progress…</p>
                              )}
                              {item.status === "failed" && (
                                <p className="text-red-500 text-[9px] font-bold">Failed</p>
                              )}
                            </div>
                          </div>

                          {/* Confidence bar */}
                          {item.status !== "pending" && (
                            <div className="px-3 pb-2.5">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[8px] text-muted-foreground uppercase tracking-wider">AI Confidence</span>
                                <span className="text-[8px] font-bold text-muted-foreground">{item.confidence}%</span>
                              </div>
                              <div className="h-1 bg-border rounded-full overflow-hidden">
                                <motion.div className="h-full rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.confidence}%` }}
                                  transition={{ duration: 0.6, delay: 0.1 }}
                                  style={{ background: item.confidence >= 80 ? "#16a34a" : item.confidence >= 60 ? "#2563eb" : "#f59e0b" }}
                                />
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── DONE ──────────────────────────────────────────────── */}
                {step === "done" && (
                  <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="space-y-4">

                    {/* Success banner */}
                    <div className="rounded-2xl overflow-hidden"
                      style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #16a34a 100%)" }}>
                      <div className="p-5 flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
                          <ShieldCheck size={28} className="text-white" />
                        </div>
                        <div>
                          <p className="text-white font-black text-base">Agent Complete!</p>
                          <p className="text-green-200 text-xs mt-0.5">
                            {succeededInvestments.length} of {liveQueue.length} investment{liveQueue.length !== 1 ? "s" : ""} placed autonomously
                          </p>
                        </div>
                      </div>
                      <div className="bg-white/10 px-5 py-3 grid grid-cols-3 divide-x divide-white/15">
                        {[
                          { label: "Invested", val: formatKES(totalInvested) },
                          { label: "Farms",    val: String(succeededInvestments.length) },
                          { label: "Est. ROI", val: `+${roiRange[0]}–${roiRange[1]}%` },
                        ].map(s => (
                          <div key={s.label} className="text-center px-2">
                            <p className="text-white font-black text-base">{s.val}</p>
                            <p className="text-white/60 text-[9px] uppercase tracking-wider">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Farm cards */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart3 size={10} /> Portfolio additions
                      </p>
                      {liveQueue.map((inv, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className={`rounded-2xl p-3 border ${inv.status === "done" ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/20 opacity-60"}`}>
                          <div className="flex items-center gap-3">
                            <img src={getCropImage(inv.cropType)} alt={inv.cropType}
                              className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {inv.status === "done"
                                  ? <CheckCircle2 size={11} className="text-green-500 flex-shrink-0" />
                                  : <X size={11} className="text-red-500 flex-shrink-0" />}
                                <p className="text-foreground font-semibold text-sm truncate">{inv.farmName}</p>
                              </div>
                              <p className="text-muted-foreground text-[10px]">{inv.cropType} · {inv.shares} shares · {inv.exitType}</p>
                              <p className="text-muted-foreground/70 text-[9px] italic mt-0.5 line-clamp-1">🤖 {inv.aiReason}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-foreground font-bold text-sm">{formatKES(inv.total)}</p>
                              {inv.status === "done" && (
                                <div className="flex items-center justify-end gap-0.5 mt-0.5">
                                  <TrendingUp size={9} className="text-green-500" />
                                  <span className="text-green-600 text-[9px] font-bold">{inv.confidence}% conf.</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { handleClose(); setLocation("/portfolio"); }}
                        className="flex-1 bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 text-sm">
                        View Portfolio <ChevronRight size={14} />
                      </button>
                      <button onClick={reset}
                        className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 active:scale-95 border border-border"
                        title="Run again">
                        <Sparkles size={16} className="text-muted-foreground" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── ERROR ─────────────────────────────────────────────── */}
                {step === "error" && (
                  <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="py-8 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-foreground font-bold text-base">Agent Stopped</p>
                      <p className="text-muted-foreground text-sm mt-1 leading-relaxed max-w-[260px]">{errorMsg}</p>
                    </div>
                    <button onClick={reset}
                      className="w-full text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all"
                      style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)" }}>
                      Adjust & Try Again
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
