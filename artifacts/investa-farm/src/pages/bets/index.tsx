import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Trophy, Plus, TrendingUp, Clock, CheckCircle2, XCircle, Flame, ChevronRight, X, Loader2 } from "lucide-react";
import { getToken, getStoredUser, formatKES } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import { motion, AnimatePresence } from "framer-motion";

type Bet = {
  id: number; farmId: number; farmName: string; cropType: string;
  question: string; description?: string; targetMetric: string; targetValue: number;
  totalPoolKES: number; yesPoolKES: number; noPoolKES: number;
  minStakeKES: number; maxStakeKES: number; status: string; outcome?: boolean;
  expiresAt: string; createdAt: string; creatorName: string;
};

type LeaderboardEntry = {
  rank: number; userId: number; userName: string;
  totalStakedKES: number; totalPayoutKES: number; roi: number;
};

type MyStake = {
  stakeId: number; betId: number; amountKES: number; position: string;
  payout: number | null; betQuestion: string; farmName: string;
  betStatus: string; betOutcome: boolean | null; createdAt: string;
};

type PrimaryFarm = { id: number; farmName: string; cropType: string; location: string };

const CROP_EMOJI: Record<string, string> = {
  coffee: "☕", maize: "🌽", tea: "🍵", avocado: "🥑",
  macadamia: "🌰", tomatoes: "🍅", rice: "🌾", sunflower: "🌻",
  beans: "🫘", wheat: "🌾", dairy: "🐄", poultry: "🐔",
};
function cropEmoji(c: string) {
  const k = c.toLowerCase();
  for (const [key, v] of Object.entries(CROP_EMOJI)) if (k.includes(key)) return v;
  return "🌱";
}

export default function BetsPage() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const user = getStoredUser() as any;
  const qc = useQueryClient();

  const [tab, setTab]                   = useState<"open" | "mine" | "leaderboard">("open");
  const [stakeModal, setStakeModal]     = useState<Bet | null>(null);
  const [createOpen, setCreateOpen]     = useState(false);
  const [stakeAmount, setStakeAmount]   = useState("");
  const [stakePosition, setStakePosition] = useState<"yes" | "no">("yes");
  const [error, setError]               = useState<string | null>(null);

  const [newBet, setNewBet] = useState({
    farmId: "", question: "", description: "", targetMetric: "roi",
    targetValue: "", expiresAt: "", minStakeKES: "1000", maxStakeKES: "100000",
  });

  const { data: bets = [], isLoading: betsLoading } = useQuery<Bet[]>({
    queryKey: ["bets"],
    queryFn: async () => {
      const r = await fetch("/api/bets", { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : [];
    },
    staleTime: 60_000,
  });

  const { data: myStakes = [] } = useQuery<MyStake[]>({
    queryKey: ["bets-my-stakes"],
    enabled: tab === "mine",
    queryFn: async () => {
      const r = await fetch("/api/bets/my/stakes", { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : [];
    },
  });

  const { data: leaderboard = [] } = useQuery<LeaderboardEntry[]>({
    queryKey: ["bets-leaderboard"],
    enabled: tab === "leaderboard",
    queryFn: async () => {
      const r = await fetch("/api/bets/leaderboard/top", { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : [];
    },
  });

  const { data: farms = [] } = useQuery<PrimaryFarm[]>({
    queryKey: ["market-primary-list"],
    enabled: createOpen,
    queryFn: async () => {
      const r = await fetch("/api/market/primary", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      const d = await r.json();
      return d.map((l: any) => ({ id: l.farmId, farmName: l.farmName, cropType: l.cropType, location: l.location }));
    },
  });

  const stakesMutation = useMutation({
    mutationFn: async ({ betId, amountKES, position }: { betId: number; amountKES: number; position: string }) => {
      const r = await fetch(`/api/bets/${betId}/stake`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountKES, position }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to place stake");
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bets"] });
      qc.invalidateQueries({ queryKey: ["bets-my-stakes"] });
      setStakeModal(null);
      setStakeAmount("");
      setError(null);
    },
    onError: (e: any) => setError(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to create bet");
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bets"] });
      setCreateOpen(false);
      setNewBet({ farmId: "", question: "", description: "", targetMetric: "roi", targetValue: "", expiresAt: "", minStakeKES: "1000", maxStakeKES: "100000" });
    },
  });

  const openBets  = bets.filter(b => b.status === "open");
  const totalPool = openBets.reduce((s, b) => s + b.totalPoolKES, 0);

  return (
    <div className="flex flex-col min-h-dvh bg-background max-w-[430px] mx-auto pb-24">

      {/* Header */}
      <div className="hero-header px-5 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setLocation("/portfolio")}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-black text-xl tracking-tight">🎯 Crop Bets</h1>
            <p className="text-white/70 text-xs">Predict farm outcomes & earn</p>
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="bg-white/20 border border-white/30 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <Plus size={14} className="text-white" />
            <span className="text-white text-xs font-bold">New Bet</span>
          </button>
        </div>
        <div className="bg-white/10 rounded-2xl p-3 grid grid-cols-3 gap-3 text-center">
          <div><p className="text-white/60 text-[10px]">Open Bets</p><p className="text-white font-black text-lg">{openBets.length}</p></div>
          <div><p className="text-white/60 text-[10px]">Total Pool</p><p className="text-white font-black text-lg">{formatKES(totalPool)}</p></div>
          <div><p className="text-white/60 text-[10px]">My Stakes</p><p className="text-white font-black text-lg">{myStakes.length}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mx-4 mb-4 mt-2">
        {([["open","Open Bets"],["mine","My Stakes"],["leaderboard","Leaders"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">

        {/* Open Bets */}
        {tab === "open" && (
          betsLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
          ) : openBets.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🎯</div>
              <p className="font-bold text-foreground mb-1">No open bets yet</p>
              <p className="text-sm text-muted-foreground">Be the first to create a crop prediction!</p>
              <button onClick={() => setCreateOpen(true)}
                className="mt-4 bg-primary text-white rounded-xl px-6 py-2.5 text-sm font-bold">
                Create First Bet
              </button>
            </div>
          ) : openBets.map(bet => {
            const yesOdds = bet.totalPoolKES > 0 ? (bet.totalPoolKES / Math.max(bet.yesPoolKES, 1)).toFixed(2) : "—";
            const noOdds  = bet.totalPoolKES > 0 ? (bet.totalPoolKES / Math.max(bet.noPoolKES, 1)).toFixed(2) : "—";
            const yesPct  = bet.totalPoolKES > 0 ? Math.round((bet.yesPoolKES / bet.totalPoolKES) * 100) : 50;
            const expires = new Date(bet.expiresAt);
            const days    = Math.max(0, Math.round((expires.getTime() - Date.now()) / 86_400_000));

            return (
              <div key={bet.id} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xl">{cropEmoji(bet.cropType)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground truncate">{bet.farmName}</p>
                      <p className="text-sm font-bold text-foreground leading-snug">{bet.question}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 rounded-lg px-2 py-1 flex-shrink-0">
                      <Clock size={10} />{days}d
                    </div>
                  </div>

                  {/* Pool bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>YES {yesPct}% · {formatKES(bet.yesPoolKES)}</span>
                      <span>NO {100 - yesPct}% · {formatKES(bet.noPoolKES)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-red-100 overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${yesPct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground">
                      Pool: <span className="font-bold text-foreground">{formatKES(bet.totalPoolKES)}</span>
                      <span className="mx-2">·</span>
                      YES {yesOdds}x / NO {noOdds}x
                    </div>
                    <button onClick={() => { setStakeModal(bet); setError(null); }}
                      className="bg-primary text-white text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
                      <Flame size={11} />Stake
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* My Stakes */}
        {tab === "mine" && (
          myStakes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">💸</div>
              <p className="font-bold text-foreground mb-1">No stakes yet</p>
              <p className="text-sm text-muted-foreground">Find a bet and stake your prediction</p>
            </div>
          ) : myStakes.map(s => (
            <div key={s.stakeId} className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-xs text-muted-foreground truncate">{s.farmName}</p>
                  <p className="text-sm font-bold text-foreground leading-snug">{s.betQuestion}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.position === "yes" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {s.position.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">Staked</p>
                  <p className="font-bold text-foreground text-sm">{formatKES(s.amountKES)}</p>
                </div>
                {s.payout !== null && (
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Payout</p>
                    <p className={`font-bold text-sm ${s.payout >= s.amountKES ? "text-green-600" : "text-red-500"}`}>{formatKES(s.payout)}</p>
                  </div>
                )}
                <div className="text-right">
                  {s.betStatus === "open" && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">Open</span>}
                  {s.betStatus === "resolved" && s.betOutcome !== null && (
                    (s.position === "yes") === s.betOutcome
                      ? <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-600"><CheckCircle2 size={10} />Won</span>
                      : <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-500"><XCircle size={10} />Lost</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Leaderboard */}
        {tab === "leaderboard" && (
          <div>
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={18} className="text-amber-500" />
                <p className="font-black text-amber-800 text-base">Top Predictors</p>
              </div>
              <p className="text-amber-700 text-xs">Ranked by total payout earnings from correct predictions</p>
            </div>
            {leaderboard.map(l => (
              <div key={l.userId}
                className={`flex items-center gap-3 p-3 rounded-2xl mb-2 ${l.rank <= 3 ? "bg-amber-50 border border-amber-200" : "bg-white border border-border"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                  l.rank === 1 ? "bg-amber-400 text-white" :
                  l.rank === 2 ? "bg-gray-300 text-gray-700" :
                  l.rank === 3 ? "bg-amber-700/40 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                  {l.rank <= 3 ? ["🥇","🥈","🥉"][l.rank - 1] : l.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{l.userName}</p>
                  <p className="text-[10px] text-muted-foreground">Staked: {formatKES(l.totalStakedKES)}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-sm text-primary">{formatKES(l.totalPayoutKES)}</p>
                  <p className={`text-[10px] font-semibold ${l.roi >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {l.roi >= 0 ? "+" : ""}{l.roi}% ROI
                  </p>
                </div>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div className="text-center py-8">
                <Trophy size={40} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No resolved bets yet — be the first to win!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stake Modal */}
      <AnimatePresence>
        {stakeModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setStakeModal(null)} />
            <motion.div className="relative w-full max-w-[430px] bg-white rounded-t-3xl p-6 shadow-2xl"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-black text-lg text-foreground">Place Stake</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{stakeModal.question}</p>
                </div>
                <button onClick={() => setStakeModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <button onClick={() => setStakePosition("yes")}
                  className={`flex-1 py-3 rounded-2xl text-sm font-black border-2 transition-all ${stakePosition === "yes" ? "bg-green-500 text-white border-green-500" : "border-border text-muted-foreground bg-green-50"}`}>
                  ✅ YES
                  <p className="text-[10px] font-medium mt-0.5">{formatKES(stakeModal.yesPoolKES)} in pool</p>
                </button>
                <button onClick={() => setStakePosition("no")}
                  className={`flex-1 py-3 rounded-2xl text-sm font-black border-2 transition-all ${stakePosition === "no" ? "bg-red-500 text-white border-red-500" : "border-border text-muted-foreground bg-red-50"}`}>
                  ❌ NO
                  <p className="text-[10px] font-medium mt-0.5">{formatKES(stakeModal.noPoolKES)} in pool</p>
                </button>
              </div>

              <div className="space-y-1.5 mb-4">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stake Amount (KES)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">KES</span>
                  <input type="number" value={stakeAmount} onChange={e => setStakeAmount(e.target.value)}
                    placeholder={stakeModal.minStakeKES.toLocaleString()}
                    className="w-full border border-border rounded-xl px-4 py-3 pl-12 font-bold text-sm focus:outline-none focus:border-primary" />
                </div>
                <p className="text-[10px] text-muted-foreground">Min: {formatKES(stakeModal.minStakeKES)} · Max: {formatKES(stakeModal.maxStakeKES)}</p>
              </div>

              {stakeAmount && parseFloat(stakeAmount) > 0 && (
                <div className="bg-muted rounded-xl p-3 mb-4 text-xs grid grid-cols-2 gap-2">
                  <div><p className="text-muted-foreground">Your stake</p><p className="font-bold text-foreground">{formatKES(parseFloat(stakeAmount))}</p></div>
                  <div>
                    <p className="text-muted-foreground">Est. payout (if correct)</p>
                    <p className="font-bold text-green-600">{formatKES(
                      parseFloat(stakeAmount) * (stakeModal.totalPoolKES + parseFloat(stakeAmount)) /
                      Math.max(stakePosition === "yes" ? stakeModal.yesPoolKES + parseFloat(stakeAmount) : stakeModal.noPoolKES + parseFloat(stakeAmount), 1)
                    )}</p>
                  </div>
                </div>
              )}

              {error && <p className="text-red-500 text-xs text-center mb-3">{error}</p>}

              <button
                onClick={() => {
                  const a = parseFloat(stakeAmount);
                  if (!a || a < stakeModal.minStakeKES) { setError(`Minimum stake is ${formatKES(stakeModal.minStakeKES)}`); return; }
                  setError(null);
                  stakesMutation.mutate({ betId: stakeModal.id, amountKES: a, position: stakePosition });
                }}
                disabled={stakesMutation.isPending}
                className="w-full bg-primary text-white rounded-2xl py-3.5 font-black text-base disabled:opacity-50 flex items-center justify-center gap-2">
                {stakesMutation.isPending && <Loader2 size={18} className="animate-spin" />}
                Stake {stakePosition.toUpperCase()} {stakeAmount ? formatKES(parseFloat(stakeAmount)) : ""}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Bet Modal */}
      <AnimatePresence>
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCreateOpen(false)} />
            <motion.div className="relative w-full max-w-[430px] bg-white rounded-3xl shadow-2xl flex flex-col" style={{ maxHeight: "90vh" }}
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}>
              <div className="hero-header rounded-t-3xl px-5 pt-5 pb-4 flex-shrink-0 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-black text-lg">Create Crop Bet</h2>
                  <p className="text-white/70 text-xs">Challenge other investors to predict outcomes</p>
                </div>
                <button onClick={() => setCreateOpen(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <X size={16} className="text-white" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Farm *</label>
                  <select value={newBet.farmId} onChange={e => setNewBet(b => ({ ...b, farmId: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary">
                    <option value="">Select a farm…</option>
                    {farms.map((f: PrimaryFarm) => (
                      <option key={f.id} value={f.id}>{cropEmoji(f.cropType)} {f.farmName} — {f.location}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Prediction Question *</label>
                  <input value={newBet.question} onChange={e => setNewBet(b => ({ ...b, question: e.target.value }))}
                    placeholder='e.g. "Will this farm achieve >20% ROI this season?"'
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Target Metric</label>
                  <select value={newBet.targetMetric} onChange={e => setNewBet(b => ({ ...b, targetMetric: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary">
                    <option value="roi">ROI (%)</option>
                    <option value="yield">Yield (kg)</option>
                    <option value="price">Price per share (KES)</option>
                    <option value="funded_pct">Funding percentage (%)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Target Value *</label>
                    <input type="number" value={newBet.targetValue} onChange={e => setNewBet(b => ({ ...b, targetValue: e.target.value }))}
                      placeholder="e.g. 20"
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Expires *</label>
                    <input type="date" value={newBet.expiresAt} onChange={e => setNewBet(b => ({ ...b, expiresAt: e.target.value }))}
                      min={new Date(Date.now() + 86_400_000).toISOString().split("T")[0]}
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Min Stake (KES)</label>
                    <input type="number" value={newBet.minStakeKES} onChange={e => setNewBet(b => ({ ...b, minStakeKES: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Max Stake (KES)</label>
                    <input type="number" value={newBet.maxStakeKES} onChange={e => setNewBet(b => ({ ...b, maxStakeKES: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!newBet.farmId || !newBet.question || !newBet.targetValue || !newBet.expiresAt) return;
                    createMutation.mutate({
                      farmId: parseInt(newBet.farmId),
                      question: newBet.question,
                      description: newBet.description || undefined,
                      targetMetric: newBet.targetMetric,
                      targetValue: parseFloat(newBet.targetValue),
                      expiresAt: new Date(newBet.expiresAt).toISOString(),
                      minStakeKES: parseFloat(newBet.minStakeKES),
                      maxStakeKES: parseFloat(newBet.maxStakeKES),
                    });
                  }}
                  disabled={createMutation.isPending || !newBet.farmId || !newBet.question || !newBet.targetValue || !newBet.expiresAt}
                  className="w-full bg-primary text-white rounded-2xl py-3.5 font-black text-base disabled:opacity-40 flex items-center justify-center gap-2">
                  {createMutation.isPending && <Loader2 size={18} className="animate-spin" />}
                  Create Prediction Market
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 z-30 max-w-[430px] mx-auto">
        <BottomNav role="investor" />
      </div>
    </div>
  );
}
