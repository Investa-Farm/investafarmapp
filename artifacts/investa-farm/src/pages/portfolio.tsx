import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetPortfolio, useGetPortfolioSummary } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, formatChange, getStoredUser, getToken } from "@/lib/auth";
import {
  TrendingUp, TrendingDown, Share2, Tag, ExternalLink, Users, BadgeCheck,
  Copy, Check, Lock, Globe, ChevronRight as ChevRight, Zap, BookOpen,
  Star, Plus, RefreshCw, Bell, CreditCard, X, Info, ChevronLeft, ChevronRight,
  Wallet, BarChart3, ArrowUpRight, ArrowDownRight, Briefcase,
} from "lucide-react";
import { PortfolioWizard } from "@/components/portfolio-wizard";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { ShareModal } from "@/components/share-modal";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ExitModal } from "@/components/exit-modal";
import { SellSharesModal } from "@/components/sell-shares-modal";
import { SwapModal } from "@/components/swap-modal";
import { PortfolioHealthAI } from "@/components/portfolio-health-ai";
import { getCropImage } from "@/lib/crops";
import { ReinvestmentSettings } from "@/components/reinvestment-settings";
import { useCurrency } from "@/lib/currency";
import { PortfolioAiInsight } from "@/components/portfolio-ai-insight";
import { AiSectionBot } from "@/components/ai-section-bot";

function useCountUp(target: number, duration = 900) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const from = current;
    const run = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCurrent(from + (target - from) * ease);
      if (p < 1) rafRef.current = requestAnimationFrame(run);
    };
    rafRef.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);
  return current;
}

type Holding = {
  id: number; farmId: number; farmName: string; cropType: string; location: string;
  quantity: number; purchasePrice: number; currentPrice: number; totalValue: number;
  gainLoss: number; gainLossPercent: number; exitType: string; imageUrl?: string; status: string;
};

type Summary = {
  totalValue: number; totalInvested: number; holdings: number;
  todayReturn: number; todayReturnPercent: number; weekReturnPercent: number;
  overallGainLossPercent: number;
};

function AnimatedKES({ value, className }: { value: number; className?: string }) {
  const animated = useCountUp(value);
  return <span className={className}>{formatKES(animated)}</span>;
}

type Period = "1W" | "1M" | "3M";

function buildChartData(totalInvested: number, totalValue: number, period: Period) {
  const points = period === "1W" ? 7 : period === "1M" ? 30 : 90;
  const labels: string[] = [];
  const now = new Date();
  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (period === "1W") labels.push(d.toLocaleDateString("en-KE", { weekday: "short" }));
    else if (period === "1M") labels.push(d.getDate() === 1 || i === points - 1 || i === 0 ? d.toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "");
    else labels.push(i % 15 === 0 ? d.toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "");
  }
  const start = totalInvested;
  const end = totalValue;
  return labels.map((label, i) => {
    const t = i / Math.max(1, points - 1);
    return { label, value: Math.max(0, start + (end - start) * t) };
  });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="text-foreground font-bold">{formatKES(payload[0].value)}</p>
    </div>
  );
};

export default function Portfolio() {
  const { data: holdings, isLoading } = useGetPortfolio();
  const { data: summary } = useGetPortfolioSummary();
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapHolding, setSwapHolding] = useState<Holding | null>(null);
  const [shareHolding, setShareHolding] = useState<Holding | null>(null);
  const [period, setPeriod] = useState<Period>("1W");
  const [activeTab, setActiveTab] = useState<"overview" | "holdings">(() =>
    window.location.hash === "#holdings" ? "holdings" : "overview"
  );
  const [brokerEnabled, setBrokerEnabled] = useState(() => localStorage.getItem("investa_broker_mode") === "true");
  const [copied, setCopied] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reinvestOpen, setReinvestOpen] = useState(false);
  const [brokerUnlockOpen, setBrokerUnlockOpen] = useState(false);
  const [brokerUnlockStep, setBrokerUnlockStep] = useState(0);
  const [statDetail, setStatDetail] = useState<"invested" | "pnl" | "holdings" | null>(null);
  const [roiDetailHolding, setRoiDetailHolding] = useState<Holding | null>(null);
  const [holdingIdx, setHoldingIdx] = useState(0);
  const [, setLocation] = useLocation();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [overviewSlide, setOverviewSlide] = useState(0);
  const overviewTouchX = useRef<number | null>(null);
  const token = getToken();
  const qc = useQueryClient();
  const { formatAmount } = useCurrency();

  const { data: myPortfolios = [], refetch: refetchPortfolios } = useQuery<any[]>({
    queryKey: ["my-portfolios"],
    queryFn: async () => {
      const r = await fetch("/api/portfolio-manager/my", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: qualification } = useQuery<any>({
    queryKey: ["pm-qualification"],
    queryFn: async () => {
      const r = await fetch("/api/portfolio-manager/qualification", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { qualified: false, totalInvested: 0, threshold: 500000 };
      return r.json();
    },
    staleTime: 120_000,
  });

  const { data: roiData } = useQuery<any[]>({
    queryKey: ["portfolio-roi"],
    enabled: activeTab === "holdings",
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch("/api/portfolio/roi", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const roiByInvestmentId = new Map<number, any>(
    (roiData ?? []).map((r: any) => [r.investmentId, r])
  );

  const { data: stellarAcct } = useQuery<{ accountNumber: string }>({
    queryKey: ["stellar-account"],
    queryFn: async () => {
      const r = await fetch("/api/stellar/account", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 300_000,
  });

  const [acctCopied, setAcctCopied] = useState(false);
  const handleCopyAcct = async () => {
    if (!stellarAcct?.accountNumber) return;
    await navigator.clipboard.writeText(stellarAcct.accountNumber).catch(() => {});
    setAcctCopied(true);
    setTimeout(() => setAcctCopied(false), 2000);
  };

  const brokerLink = `${window.location.origin}/market/portfolios`;
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(brokerLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleBrokerToggle = () => {
    const next = !brokerEnabled;
    setBrokerEnabled(next);
    localStorage.setItem("investa_broker_mode", String(next));
  };

  const handlePublish = async (portfolioId: number) => {
    await fetch(`/api/portfolio-manager/${portfolioId}/publish`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    refetchPortfolios();
  };

  const handleExitClick = (h: Holding) => { setSelectedHolding(h); setExitOpen(true); };
  const handleSellClick = (h: Holding) => { setSelectedHolding(h); setSellOpen(true); };
  const handleSwapClick = (h: Holding) => { setSwapHolding(h); setSwapOpen(true); };

  useEffect(() => {
    if (qualification?.qualified && localStorage.getItem("investa_broker_unlocked") !== "true") {
      setBrokerUnlockOpen(true);
      setBrokerUnlockStep(0);
    }
  }, [qualification?.qualified]);

  // Auto-advance overview slides every 30 s, looping continuously
  useEffect(() => {
    if (activeTab !== "overview") return;
    const t = setInterval(() => setOverviewSlide(s => (s + 1) % 3), 30_000);
    return () => clearInterval(t);
  }, [activeTab]);

  const chartData = useMemo(() => {
    if (!summary) return [];
    return buildChartData(summary.totalInvested, summary.totalValue, period);
  }, [summary, period]);

  const chartMin = useMemo(() => chartData.length ? Math.min(...chartData.map(d => d.value)) * 0.995 : 0, [chartData]);
  const chartMax = useMemo(() => chartData.length ? Math.max(...chartData.map(d => d.value)) * 1.005 : 0, [chartData]);
  const isPortfolioUp = summary ? summary.totalValue >= summary.totalInvested : true;

  const holdingsList = (holdings as Holding[]) ?? [];
  const currentHolding = holdingsList[holdingIdx] ?? null;

  const SECONDARY_HOLD_DAYS: Record<string, number> = {
    kale: 30, cabbage: 30, tomatoes: 30, poultry: 30, chicken: 30, spinach: 30,
    maize: 45, beans: 45, sunflower: 45, rice: 45, wheat: 45, dairy: 45, cattle: 45,
    corn: 45, sorghum: 45, cassava: 45,
    coffee: 60, tea: 60, avocado: 60, greenhouse: 60, macadamia: 60, tobacco: 60,
  };

  function getMinHoldDays(cropType: string): number {
    const crop = (cropType ?? "").toLowerCase();
    for (const [key, days] of Object.entries(SECONDARY_HOLD_DAYS)) {
      if (crop.includes(key)) return days;
    }
    return 45;
  }

  function getHoldInfo(h: Holding): { status: "pre_season" | "mid_season" | "full_season"; daysRemaining: number; minHoldDays: number } {
    const minHoldDays = getMinHoldDays((h as any).cropType ?? "");
    if ((h as any).createdAt) {
      const days = Math.floor((Date.now() - new Date((h as any).createdAt).getTime()) / 86400000);
      if (days >= 90) return { status: "full_season", daysRemaining: 0, minHoldDays };
      if (days >= minHoldDays) return { status: "mid_season", daysRemaining: 0, minHoldDays };
      return { status: "pre_season", daysRemaining: minHoldDays - days, minHoldDays };
    }
    return { status: "mid_season", daysRemaining: 0, minHoldDays };
  }

  function getSeasonStatus(h: Holding): "pre_season" | "mid_season" | "full_season" {
    return getHoldInfo(h).status;
  }

  const totalGain = summary ? summary.totalValue - summary.totalInvested : 0;

  return (
    <div className="app-shell page-enter" style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden", background: "#f0fdf4" }} data-testid="portfolio-page">

      {/* ── Premium Hero Header ── */}
      <div className="flex-shrink-0 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0d4f2e 0%, #16a34a 55%, #22c55e 100%)",
          paddingTop: "env(safe-area-inset-top, 16px)",
        }}>
        {/* Decorative blobs */}
        <div style={{ position: "absolute", top: -32, right: -32, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 28, left: "40%", width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

        <div className="px-5 pt-3 pb-3 relative">
          {/* Top row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">My Portfolio</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLocation("/wallet")}
                className="flex items-center gap-1.5 bg-white/15 border border-white/25 rounded-full px-3 py-1.5 active:scale-95 transition-all">
                <Wallet size={11} className="text-white" />
                <span className="text-white text-[11px] font-semibold">Wallet</span>
              </button>
              <button
                onClick={() => setLocation("/market")}
                className="w-8 h-8 rounded-full bg-white/15 border border-white/25 flex items-center justify-center active:scale-95 transition-all">
                <Bell size={13} className="text-white" />
              </button>
            </div>
          </div>

          {/* Portfolio value */}
          {summary ? (
            <>
              <motion.div key={summary.totalValue} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-white/70 text-xs mb-0.5">Total Portfolio Value</p>
                <p className="text-white font-extrabold" style={{ fontSize: 30, letterSpacing: -1, lineHeight: 1.1 }}>
                  <AnimatedKES value={summary.totalValue} />
                </p>
                {/* Return badge */}
                <div className="flex items-center gap-2 mt-2">
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${totalGain >= 0 ? "bg-white/20" : "bg-red-500/30"}`}>
                    {totalGain >= 0
                      ? <ArrowUpRight size={11} className="text-green-200" />
                      : <ArrowDownRight size={11} className="text-red-200" />}
                    <span className={`text-[11px] font-bold ${totalGain >= 0 ? "text-green-100" : "text-red-200"}`}>
                      {totalGain >= 0 ? "+" : ""}{formatKES(totalGain)}
                    </span>
                    <span className="text-white/50 text-[10px]">all time</span>
                  </div>
                  <div className="h-4 w-px bg-white/20" />
                  <span className={`text-[11px] font-semibold ${summary.todayReturn >= 0 ? "text-green-200" : "text-red-300"}`}>
                    {formatChange(summary.todayReturnPercent)} today
                  </span>
                </div>
              </motion.div>

              {/* 3-stat glassmorphism row */}
              <div className="grid grid-cols-3 gap-1.5 mt-3">
                {([
                  { key: "invested" as const, label: "Invested", value: formatKES(summary.totalInvested), icon: "💰" },
                  { key: "pnl" as const, label: "P&L", value: (summary.todayReturn >= 0 ? "+" : "") + formatKES(summary.todayReturn), icon: summary.todayReturn >= 0 ? "📈" : "📉", highlight: true, up: summary.todayReturn >= 0 },
                  { key: "holdings" as const, label: "Holdings", value: String(summary.holdings), icon: "🌾" },
                ]).map(({ key, label, value, icon, highlight, up }) => (
                  <button key={key} onClick={() => setStatDetail(key)}
                    className="relative rounded-2xl p-2.5 text-left active:scale-95 transition-all overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}>
                    <span className="text-base leading-none block mb-1">{icon}</span>
                    <p className={`font-bold text-xs leading-tight truncate ${highlight ? (up ? "text-green-200" : "text-red-300") : "text-white"}`}>{value}</p>
                    <p className="text-white/50 text-[9px] mt-0.5 flex items-center gap-0.5">{label} <Info size={6} className="opacity-60" /></p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-9 w-48 rounded-xl bg-white/20" />
              <Skeleton className="h-5 w-32 rounded-full bg-white/15" />
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[0,1,2].map(i => <Skeleton key={i} className="h-16 rounded-2xl bg-white/15" />)}
              </div>
            </div>
          )}
        </div>

        {/* Curved bottom edge */}
        <div style={{ height: 20, background: "#f0fdf4", borderRadius: "50% 50% 0 0 / 100% 100% 0 0", marginTop: -1 }} />
      </div>

      {/* ── Tab switcher ── */}
      <div className="px-4 pt-1 pb-2 flex-shrink-0">
        <div className="flex rounded-2xl p-1 gap-1" style={{ background: "rgba(0,0,0,0.06)" }}>
          {([
            { id: "overview" as const, emoji: "📈", label: "Overview" },
            { id: "holdings" as const, emoji: "🌾", label: "My Holdings" },
          ]).map(({ id, emoji, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === id ? "bg-white text-foreground shadow-md" : "text-muted-foreground"}`}>
              <span>{emoji}</span>{label}
              {id === "holdings" && holdingsList.length > 0 && (
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${activeTab === id ? "bg-primary/10 text-primary" : "bg-muted-foreground/20 text-muted-foreground"}`}>
                  {holdingsList.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {activeTab === "overview" && (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}
          onTouchStart={e => { overviewTouchX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={e => {
            if (overviewTouchX.current === null) return;
            const dx = (e.changedTouches[0]?.clientX ?? 0) - overviewTouchX.current;
            if (Math.abs(dx) > 40) setOverviewSlide(s => Math.max(0, Math.min(2, s + (dx < 0 ? 1 : -1))));
            overviewTouchX.current = null;
          }}>

          {/* Slide nav dots */}
          <div className="flex items-center justify-between px-4 pt-1.5 pb-1 flex-shrink-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {["Performance", "Risk Allocation", "vs Peers"][overviewSlide]}
            </p>
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map(i => (
                <button key={i} onClick={() => setOverviewSlide(i)}
                  style={{ width: i === overviewSlide ? 18 : 6, height: 6, borderRadius: 99,
                    background: i === overviewSlide ? "#16a34a" : "#d1d5db",
                    transition: "all 0.3s", border: "none", padding: 0, cursor: "pointer" }} />
              ))}
            </div>
          </div>

          {/* Slide viewport */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
            <AnimatePresence mode="wait">
              {overviewSlide === 0 && (
                <motion.div key="s0"
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 px-4 pb-4 overflow-y-auto flex flex-col gap-3">

          {/* Performance Chart */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden flex flex-col shadow-sm" style={{ minHeight: 240 }}>
            <div className="px-4 pt-3.5 pb-2 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BarChart3 size={13} className="text-primary" />
                  </div>
                  <p className="text-foreground font-bold text-sm">Performance</p>
                </div>
                {summary && (
                  <p className={`text-xs font-semibold mt-1 ml-9 ${isPortfolioUp ? "text-green-600" : "text-red-500"}`}>
                    {isPortfolioUp ? "+" : ""}{formatKES(summary.totalValue - summary.totalInvested)}
                    <span className="font-normal text-muted-foreground ml-1">total return</span>
                  </p>
                )}
              </div>
              <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: "rgba(0,0,0,0.05)" }}>
                {(["1W", "1M", "3M"] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${period === p ? "bg-primary text-white shadow-sm" : "text-muted-foreground"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 px-1 pb-2" style={{ minHeight: 0 }}>
              {!summary ? (
                <div className="h-full flex items-center justify-center"><Skeleton className="w-full h-full rounded-xl" /></div>
              ) : summary.totalInvested === 0 ? (
                <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50/50 rounded-xl mx-2">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                    <TrendingUp size={24} className="text-primary" />
                  </div>
                  <p className="text-foreground font-bold text-sm">No investments yet</p>
                  <p className="text-muted-foreground text-xs mt-1">Invest in a farm to see your growth chart</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="80%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isPortfolioUp ? "#16a34a" : "#dc2626"} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={isPortfolioUp ? "#16a34a" : "#dc2626"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 93%)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(220 9% 50%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(220 9% 50%)" }} axisLine={false} tickLine={false}
                        domain={[chartMin, chartMax]} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} width={34} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={summary.totalInvested} stroke="hsl(220 9% 70%)" strokeDasharray="4 3" strokeWidth={1}
                        label={{ value: "Cost", position: "insideTopRight", fontSize: 8, fill: "hsl(220 9% 60%)" }} />
                      <Area type="monotone" dataKey="value" stroke={isPortfolioUp ? "#16a34a" : "#dc2626"}
                        strokeWidth={2.5} fill="url(#perfGrad)" dot={false}
                        activeDot={{ r: 5, fill: isPortfolioUp ? "#16a34a" : "#dc2626", strokeWidth: 2.5, stroke: "#fff" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex justify-around px-2 pt-1">
                    {[
                      { label: "Overall", val: formatChange(summary.overallGainLossPercent), color: isPortfolioUp ? "text-green-600" : "text-red-500" },
                      { label: "Today", val: formatChange(summary.todayReturnPercent), color: summary.todayReturn >= 0 ? "text-green-600" : "text-red-500" },
                      { label: "This Week", val: formatChange(summary.weekReturnPercent), color: summary.weekReturnPercent >= 0 ? "text-green-600" : "text-red-500" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="text-center">
                        <p className={`text-xs font-bold ${color}`}>{val}</p>
                        <p className="text-muted-foreground text-[9px] mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
                </motion.div>
              )}

              {overviewSlide === 1 && (
                <motion.div key="s1"
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 px-4 pb-4 overflow-y-auto">

          {/* Risk Allocation */}
          {(() => {
            const cropTotals: Record<string, number> = {};
            for (const h of holdingsList) {
              const key = (h.cropType ?? "Other").toLowerCase();
              cropTotals[key] = (cropTotals[key] ?? 0) + h.totalValue;
            }
            const totalVal = summary?.totalValue || 1;
            const entries = Object.entries(cropTotals)
              .map(([crop, val]) => ({ crop, val, pct: Math.round((val / totalVal) * 100) }))
              .sort((a, b) => b.val - a.val);
            const RISK_COLORS: Record<string, string> = {
              coffee: "#ef4444", avocado: "#f97316", tobacco: "#dc2626",
              tea: "#f59e0b", tomatoes: "#eab308", wheat: "#d97706",
              maize: "#16a34a", beans: "#22c55e", dairy: "#4ade80",
              kale: "#15803d", rice: "#059669", sunflower: "#a3e635",
            };
            const HIGH_RISK = new Set(["coffee", "avocado", "tobacco", "horticulture"]);
            const MED_RISK  = new Set(["tea", "wheat", "tomatoes", "potatoes"]);
            const overallRisk = entries.some(e => HIGH_RISK.has(e.crop))
              ? "High" : entries.some(e => MED_RISK.has(e.crop)) ? "Moderate" : "Low";
            const riskColor = overallRisk === "High" ? "text-red-600" : overallRisk === "Moderate" ? "text-amber-600" : "text-green-600";
            const riskBg    = overallRisk === "High" ? "bg-red-50 border-red-200" : overallRisk === "Moderate" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200";

            return (
              <div className="bg-white border border-border rounded-2xl p-4 shadow-sm flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                      <BarChart3 size={13} className="text-primary" />
                    </div>
                    <p className="text-foreground font-bold text-sm">Risk Allocation</p>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${riskBg} ${riskColor}`}>
                    {overallRisk} Risk
                  </span>
                </div>

                {holdingsList.length === 0 ? (
                  <p className="text-muted-foreground text-xs text-center py-3">Invest to see your risk allocation</p>
                ) : (
                  <div className="space-y-2">
                    {entries.slice(0, 5).map(({ crop, val, pct }) => {
                      const barColor = RISK_COLORS[crop] ?? "#16a34a";
                      const isHigh = HIGH_RISK.has(crop);
                      const isMed  = MED_RISK.has(crop);
                      const riskLabel = isHigh ? "High" : isMed ? "Med" : "Low";
                      const riskLabelColor = isHigh ? "text-red-500" : isMed ? "text-amber-500" : "text-green-600";
                      return (
                        <div key={crop}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ background: barColor }} />
                              <span className="text-foreground text-[11px] font-semibold capitalize">{crop}</span>
                              <span className={`text-[9px] font-bold ${riskLabelColor}`}>{riskLabel}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-[10px]">{formatKES(val)}</span>
                              <span className="text-foreground text-[11px] font-bold w-7 text-right">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, delay: 0.1 }}
                              className="h-full rounded-full"
                              style={{ background: barColor }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {entries.length > 5 && (
                      <p className="text-muted-foreground text-[9px] text-right">+{entries.length - 5} more crop{entries.length - 5 > 1 ? "s" : ""}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
                </motion.div>
              )}

              {overviewSlide === 2 && (
                <motion.div key="s2"
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 px-4 pb-4 overflow-y-auto">

          {/* Peer Portfolio Comparison */}
          {(() => {
            const myReturn = summary?.overallGainLossPercent ?? 0;
            const peers = [
              { label: "Top 10%",   pct: 31.2, color: "#16a34a" },
              { label: "Market Avg", pct: 18.4, color: "#f59e0b" },
              { label: "You",        pct: myReturn, color: myReturn >= 18.4 ? "#16a34a" : myReturn >= 10 ? "#f59e0b" : "#ef4444" },
              { label: "Bottom 25%", pct: 6.1, color: "#9ca3af" },
            ].sort((a, b) => b.pct - a.pct);
            const maxPct = Math.max(...peers.map(p => Math.abs(p.pct)), 35);
            const youRank = myReturn >= 31.2 ? "Top 10%" : myReturn >= 18.4 ? "Above Avg" : myReturn >= 6.1 ? "Below Avg" : "Bottom 25%";
            const rankColor = myReturn >= 18.4 ? "text-green-600 bg-green-50 border-green-200" : myReturn >= 6.1 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-red-500 bg-red-50 border-red-200";

            return (
              <div className="bg-white border border-border rounded-2xl p-4 shadow-sm flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Users size={13} className="text-primary" />
                    </div>
                    <p className="text-foreground font-bold text-sm">vs Peer Portfolios</p>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${rankColor}`}>{youRank}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {peers.map(({ label, pct, color }) => {
                    const isYou = label === "You";
                    const barW = Math.max(4, (Math.abs(pct) / maxPct) * 100);
                    return (
                      <div key={label}
                        className={`rounded-xl p-3 ${isYou ? "border-2" : "border border-border bg-muted/20"}`}
                        style={isYou ? { borderColor: color, background: `${color}12` } : {}}>
                        <p className={`text-[10px] font-semibold mb-0.5 ${isYou ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
                        <p className="text-xl font-black leading-none" style={{ color }}>
                          {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                        </p>
                        <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barW}%` }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="h-full rounded-full"
                            style={{ background: color, opacity: isYou ? 1 : 0.65 }}
                          />
                        </div>
                        {isYou && <p className="text-[8px] font-bold mt-1.5" style={{ color }}>← Your portfolio</p>}
                      </div>
                    );
                  })}
                </div>
                <p className="text-muted-foreground/60 text-[9px] mt-3 text-center">Based on 2,841 active Investa investors · H1 2026</p>
              </div>
            );
          })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ══ HOLDINGS TAB ══ */}
      {activeTab === "holdings" && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 pb-24">

          {/* AI insight strip */}
          {holdingsList.length > 0 && summary && (
            <div className="flex-shrink-0">
              <PortfolioAiInsight
                totalValue={summary.totalValue}
                totalInvested={summary.totalInvested}
                holdings={summary.holdings}
                gainLossPercent={summary.overallGainLossPercent}
                crops={holdingsList.map(h => h.cropType).filter(Boolean)}
              />
            </div>
          )}

          {/* Holding card carousel */}
          <div className="flex flex-col">
            {isLoading ? (
              <Skeleton className="h-[480px] rounded-2xl" />
            ) : holdingsList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center bg-white border border-border rounded-2xl p-8 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp size={28} className="text-primary" />
                </div>
                <p className="text-foreground font-bold text-base">No holdings yet</p>
                <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed max-w-[200px]">Browse the market to buy your first farm shares.</p>
                <Link href="/market/primary"
                  className="mt-5 bg-primary text-white font-bold px-6 py-3 rounded-xl text-sm active:scale-95 transition-transform">
                  Browse Farms
                </Link>
              </div>
            ) : (
              <>
                {/* Carousel nav header */}
                <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-primary rounded-full" />
                    <h2 className="font-bold text-foreground text-sm">My Holdings</h2>
                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {holdingsList.length}
                    </span>
                    <AiSectionBot
                      label="my holdings"
                      context={`Investor portfolio with ${holdingsList.length} holdings in Kenyan farms. Overall return: ${summary?.overallGainLossPercent?.toFixed(1) ?? 0}%.`}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setHoldingIdx(i => Math.max(0, i - 1))}
                      disabled={holdingIdx === 0}
                      className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shadow-sm">
                      <ChevronLeft size={13} className="text-foreground" />
                    </button>
                    <span className="text-muted-foreground text-[10px] font-medium min-w-[36px] text-center">
                      {holdingIdx + 1}/{holdingsList.length}
                    </span>
                    <button
                      onClick={() => setHoldingIdx(i => Math.min(holdingsList.length - 1, i + 1))}
                      disabled={holdingIdx === holdingsList.length - 1}
                      className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shadow-sm">
                      <ChevronRight size={13} className="text-foreground" />
                    </button>
                  </div>
                </div>

                {/* Dot indicators */}
                <div className="flex items-center justify-center gap-1.5 mb-3 flex-shrink-0">
                  {holdingsList.map((_, i) => (
                    <button key={i} onClick={() => setHoldingIdx(i)}
                      style={{ width: i === holdingIdx ? 20 : 5, height: 5, borderRadius: 100, border: "none", cursor: "pointer", transition: "all 0.3s", background: i === holdingIdx ? "#16a34a" : "#d1d5db", padding: 0 }} />
                  ))}
                </div>

                {/* Card */}
                <AnimatePresence mode="wait">
                  {currentHolding && (() => {
                    const h = currentHolding;
                    const isUp = h.gainLoss >= 0;
                    const isExited = h.status === "exit_requested";
                    const isHarvested = h.status === "exited";
                    const invested = h.purchasePrice * h.quantity;
                    const midPayout = invested * 1.10;
                    const fullPayout = invested * 1.22;
                    const farmImg = getCropImage(h.cropType, h.imageUrl);
                    const roi = roiByInvestmentId.get(h.id);

                    return (
                      <motion.div
                        key={h.id}
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ type: "spring", stiffness: 340, damping: 30 }}
                        className="bg-white rounded-2xl border border-border overflow-hidden shadow-md flex flex-col"
                        data-testid={`holding-${h.id}`}
                        onTouchStart={e => {
                          touchStartX.current = e.touches[0]?.clientX ?? null;
                          touchStartY.current = e.touches[0]?.clientY ?? null;
                        }}
                        onTouchEnd={e => {
                          if (touchStartX.current === null || touchStartY.current === null) return;
                          const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
                          const dy = (e.changedTouches[0]?.clientY ?? 0) - touchStartY.current;
                          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
                            if (dx < 0) setHoldingIdx(i => Math.min(holdingsList.length - 1, i + 1));
                            else setHoldingIdx(i => Math.max(0, i - 1));
                          }
                          touchStartX.current = null;
                          touchStartY.current = null;
                        }}
                      >
                        {/* Farm image */}
                        <div className="relative flex-shrink-0" style={{ height: 170 }}>
                          <img src={farmImg} alt={h.farmName} className="w-full h-full object-cover" />
                          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)" }} />

                          {/* Status badge */}
                          {isExited && (
                            <div className="absolute top-3 left-3 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                              <span>⏳</span> Exit Pending
                            </div>
                          )}
                          {isHarvested && (
                            <div className="absolute top-3 left-3 bg-green-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                              🌾 Harvested
                            </div>
                          )}

                          {/* Sparkline + change pill */}
                          <div className="absolute top-3 right-3 flex items-center gap-1.5">
                            <div style={{ opacity: 0.9 }}>
                              <Sparkline data={generateSparkData(h.farmId * 13, 10)} width={50} height={24} positive={isUp} />
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full shadow ${isUp ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                              {formatChange(h.gainLossPercent)}
                            </span>
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 p-3.5">
                            <p className="text-white font-bold text-base leading-tight">{h.farmName}</p>
                            <p className="text-white/65 text-[11px] mt-0.5">{h.cropType} · 📍 {h.location}</p>
                          </div>
                        </div>

                        {/* Stats strip */}
                        <div className="grid grid-cols-4 divide-x divide-border border-b border-border flex-shrink-0"
                          style={{ background: "linear-gradient(to bottom, #fafafa, #f5f5f5)" }}>
                          {[
                            { label: "Shares", val: String(h.quantity), color: "text-foreground", highlight: false },
                            { label: "Invested", val: formatAmount(invested), color: "text-foreground", highlight: false },
                            { label: "Value", val: formatAmount(h.totalValue), color: isUp ? "text-green-600" : "text-red-500", highlight: true, up: isUp },
                            { label: "P&L", val: (isUp ? "+" : "") + formatAmount(h.gainLoss), color: isUp ? "text-green-600" : "text-red-500", highlight: true, up: isUp },
                          ].map(({ label, val, color, highlight, up }) => (
                            <div key={label} className={`py-3 text-center ${highlight ? (up ? "bg-green-50/60" : "bg-red-50/60") : ""}`}>
                              <p className={`font-bold text-xs leading-tight ${color}`}>{val}</p>
                              <p className="text-muted-foreground text-[9px] mt-0.5 font-medium">{label}</p>
                            </div>
                          ))}
                        </div>

                        {/* ROI projections + actions */}
                        <div className="p-3.5 space-y-3">
                          <button
                            onClick={() => setRoiDetailHolding(h)}
                            className="w-full rounded-xl p-3 relative overflow-hidden text-left active:scale-[0.98] transition-all"
                            style={{ background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)", border: "1px solid #bbf7d0" }}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-green-700 text-[10px] font-bold uppercase tracking-wide">
                                {roi ? "🤖 AI ROI Projections" : "📊 Estimated Payout on Exit"}
                              </p>
                              <span className="text-green-600 text-[9px] font-semibold flex items-center gap-0.5">Details <ChevRight size={9} /></span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-white/80 rounded-xl p-2.5 border border-orange-100">
                                <p className="text-muted-foreground text-[9px] font-medium mb-1">⚡ Mid-Season</p>
                                <p className="text-orange-600 font-extrabold text-sm">{roi ? formatAmount(roi.midSeason.saleProceeds) : formatAmount(midPayout)}</p>
                                {roi
                                  ? <p className="text-orange-500 text-[9px] font-bold mt-0.5">{roi.midSeason.roiPercent >= 0 ? "+" : ""}{roi.midSeason.roiPercent.toFixed(1)}% ROI</p>
                                  : <p className="text-orange-400 text-[9px] mt-0.5">+10% return</p>
                                }
                              </div>
                              <div className="bg-white/80 rounded-xl p-2.5 border border-green-100">
                                <p className="text-muted-foreground text-[9px] font-medium mb-1">🌾 Full Season</p>
                                <p className="text-green-600 font-extrabold text-sm">{roi ? formatAmount(roi.fullSeason.projectedPayout) : formatAmount(fullPayout)}</p>
                                {roi
                                  ? <p className="text-green-600 text-[9px] font-bold mt-0.5">{roi.fullSeason.roiPercent >= 0 ? "+" : ""}{roi.fullSeason.roiPercent.toFixed(1)}% ROI</p>
                                  : <p className="text-green-500 text-[9px] mt-0.5">up to +22%</p>
                                }
                              </div>
                            </div>
                          </button>

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            <Link href={`/market/exchange/${h.farmId}`}
                              className="h-11 px-3 rounded-xl border border-border text-muted-foreground text-[11px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1 flex-shrink-0 bg-muted/50">
                              <ExternalLink size={11} /> View
                            </Link>
                            {h.status === "active" && (
                              <>
                                <button onClick={() => handleSwapClick(h)}
                                  className="flex-1 h-11 rounded-xl text-[11px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1"
                                  style={{ background: "#eef2ff", border: "1px solid #c7d2fe", color: "#4f46e5" }}>
                                  <RefreshCw size={11} /> Swap
                                </button>
                                <button onClick={() => handleSellClick(h)}
                                  className="flex-1 h-11 rounded-xl text-[11px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1"
                                  style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb" }}>
                                  <Tag size={11} /> Sell
                                </button>
                                <button onClick={() => handleExitClick(h)}
                                  className="flex-1 h-11 rounded-xl text-white text-[11px] font-bold active:scale-95 transition-all"
                                  style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
                                  Exit
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* Reinvestment + browse strip */}
          {holdingsList.length > 0 && (
            <div className="flex gap-2.5 flex-shrink-0">
              <button onClick={() => setReinvestOpen(true)}
                className="flex-1 h-12 rounded-xl overflow-hidden relative active:scale-95 transition-transform shadow-sm">
                <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #14532d, #16a34a)" }} />
                <div className="relative flex items-center gap-2 px-4 h-full">
                  <RefreshCw size={13} className="text-white flex-shrink-0" />
                  <span className="text-white font-bold text-xs">Auto-Reinvest</span>
                </div>
              </button>
              <Link href="/market/primary"
                className="flex-1 h-12 rounded-xl bg-white border border-border flex items-center gap-2 px-4 active:scale-95 transition-transform shadow-sm">
                <TrendingUp size={13} className="text-primary flex-shrink-0" />
                <span className="text-foreground font-bold text-xs">Browse More</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Persistent Portfolio Setup button */}
      <button
        onClick={() => setWizardOpen(true)}
        className="fixed right-4 bottom-24 z-40 bg-primary text-white shadow-xl shadow-primary/30 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs font-bold active:scale-95 transition-all border border-primary/30"
        title="Open Portfolio Setup"
      >
        <Briefcase size={14} /> Setup Guide
      </button>

      <BottomNav role="investor" />

      {wizardOpen && (
        <PortfolioWizard onClose={() => setWizardOpen(false)} onCreated={() => { setWizardOpen(false); refetchPortfolios(); }} />
      )}
      <ExitModal open={exitOpen} onClose={() => setExitOpen(false)} holding={selectedHolding} seasonStatus={selectedHolding ? getSeasonStatus(selectedHolding as any) : "mid_season"} />
      <SellSharesModal
        open={sellOpen}
        onClose={() => setSellOpen(false)}
        holding={selectedHolding}
        seasonStatus={selectedHolding ? getHoldInfo(selectedHolding as any).status : "mid_season"}
        daysRemaining={selectedHolding ? getHoldInfo(selectedHolding as any).daysRemaining : 0}
        minHoldDays={selectedHolding ? getHoldInfo(selectedHolding as any).minHoldDays : 45}
      />
      <SwapModal open={swapOpen} onClose={() => { setSwapOpen(false); setSwapHolding(null); }} holding={swapHolding} />
      <ReinvestmentSettings open={reinvestOpen} onClose={() => setReinvestOpen(false)} />
      <ShareModal
        open={!!shareHolding}
        onClose={() => setShareHolding(null)}
        title={shareHolding?.farmName ?? ""}
        text={shareHolding ? `🌱 I'm invested in ${shareHolding.farmName} on Investa Farm! ${shareHolding.cropType} · ${shareHolding.location}` : ""}
        url="https://app.investafarm.com/portfolio"
      />

      {/* Broker unlock popup */}
      {brokerUnlockOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setBrokerUnlockOpen(false); localStorage.setItem("investa_broker_unlocked", "true"); }} />
          <motion.div
            className="relative bg-white rounded-t-3xl w-full max-w-[430px] overflow-y-auto max-h-[90vh] shadow-2xl"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}>
            <div className="flex gap-1.5 justify-center pt-5 pb-2">
              {[0, 1, 2].map(s => (
                <div key={s} className={`h-1.5 rounded-full transition-all ${s === brokerUnlockStep ? "w-8 bg-primary" : "w-1.5 bg-gray-200"}`} />
              ))}
            </div>
            {brokerUnlockStep === 0 && (
              <div className="px-6 pb-8 text-center">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 mt-2"
                  style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)" }}>
                  <span className="text-4xl">🏆</span>
                </div>
                <h2 className="text-foreground font-extrabold text-xl mb-2">You Qualify as a Stock Broker!</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                  Your investment portfolio has crossed <strong>KES 500,000</strong>. You're eligible to manage portfolios and earn broker commissions.
                </p>
                <button onClick={() => setBrokerUnlockStep(1)}
                  className="w-full py-4 rounded-2xl text-white font-bold text-sm active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
                  See What You Can Do →
                </button>
              </div>
            )}
            {brokerUnlockStep === 1 && (
              <div className="px-6 pb-8">
                <h2 className="text-foreground font-extrabold text-lg mb-1 mt-2">Stock Broker Benefits</h2>
                <div className="space-y-3 mb-6 mt-3">
                  {[
                    { icon: "📁", title: "Manage Portfolios", desc: "Create & publish curated farm portfolios" },
                    { icon: "💸", title: "Earn Management Fees", desc: "Charge up to 2% annual fee on AUM" },
                    { icon: "🤝", title: "1% Placement Fees", desc: "Earn on every trade your followers make" },
                    { icon: "👥", title: "Build Followers", desc: "Share your broker link to grow your network" },
                  ].map(b => (
                    <div key={b.title} className="flex items-start gap-3 bg-muted/50 rounded-xl p-3">
                      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0 text-lg shadow-sm">{b.icon}</div>
                      <div>
                        <p className="text-foreground font-semibold text-sm">{b.title}</p>
                        <p className="text-muted-foreground text-xs mt-0.5">{b.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setBrokerUnlockStep(2)}
                  className="w-full py-4 rounded-2xl text-white font-bold text-sm active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
                  Activate My Profile →
                </button>
              </div>
            )}
            {brokerUnlockStep === 2 && (
              <div className="px-6 pb-10 text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 mt-2"
                  style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
                  <span className="text-4xl">🌱</span>
                </div>
                <h2 className="text-foreground font-extrabold text-xl mb-2">Activate Broker Mode</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Turn on your broker profile and start creating portfolios that others can follow.
                </p>
                <button
                  onClick={() => { setBrokerEnabled(true); localStorage.setItem("investa_broker_mode", "true"); localStorage.setItem("investa_broker_unlocked", "true"); setBrokerUnlockOpen(false); setActiveTab("holdings"); }}
                  className="w-full py-4 rounded-2xl text-white font-bold text-sm active:scale-95 transition-transform mb-3"
                  style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
                  🚀 Activate Broker Profile
                </button>
                <button onClick={() => { setBrokerUnlockOpen(false); localStorage.setItem("investa_broker_unlocked", "true"); }}
                  className="w-full py-3 rounded-2xl border border-border text-muted-foreground font-medium text-sm active:scale-95 transition-transform">
                  Maybe Later
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ROI Detail bottom sheet */}
      <AnimatePresence>
        {roiDetailHolding && (() => {
          const h = roiDetailHolding;
          const invested = h.purchasePrice * h.quantity;
          const midPayout = invested * 1.10;
          const fullPayout = invested * 1.22;
          const roi = roiByInvestmentId.get(h.id);
          const isUp = h.gainLoss >= 0;
          return (
            <motion.div className="fixed inset-0 z-50 flex items-end"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRoiDetailHolding(null)} />
              <motion.div className="relative w-full bg-white rounded-t-3xl overflow-hidden shadow-2xl max-w-[430px] mx-auto"
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}>
                <div className="h-1.5 bg-gradient-to-r from-green-600 to-emerald-400" />
                <div className="px-5 pt-4 pb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-400 flex items-center justify-center shadow-sm">
                        <span className="text-2xl">📊</span>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs font-medium">ROI Breakdown</p>
                        <p className="font-extrabold text-base leading-tight text-foreground">{h.farmName}</p>
                      </div>
                    </div>
                    <button onClick={() => setRoiDetailHolding(null)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-all">
                      <X size={14} className="text-muted-foreground" />
                    </button>
                  </div>

                  {/* Current position */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Shares", val: String(h.quantity), color: "text-foreground" },
                      { label: "Cost Basis", val: formatAmount(invested), color: "text-foreground" },
                      { label: "Current P&L", val: (isUp ? "+" : "") + formatAmount(h.gainLoss), color: isUp ? "text-green-600" : "text-red-500" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="bg-muted/50 rounded-xl p-2.5 text-center">
                        <p className={`font-bold text-xs ${color}`}>{val}</p>
                        <p className="text-muted-foreground text-[9px] mt-0.5 font-medium">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Exit scenarios */}
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Exit Scenarios</p>
                  <div className="space-y-3">
                    <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #fff7ed, #fffbeb)", border: "1px solid #fed7aa" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⚡</span>
                          <div>
                            <p className="text-orange-800 font-bold text-sm">Mid-Season Exit</p>
                            <p className="text-orange-500 text-[10px]">30–60 days · 10% return</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-orange-600 font-extrabold text-base">{roi ? formatAmount(roi.midSeason.saleProceeds) : formatAmount(midPayout)}</p>
                          <p className="text-orange-500 text-[10px] font-bold">{roi ? `${roi.midSeason.roiPercent >= 0 ? "+" : ""}${roi.midSeason.roiPercent.toFixed(1)}%` : "+10%"} ROI</p>
                        </div>
                      </div>
                      <div className="bg-white/70 rounded-xl px-3 py-2 flex items-center justify-between">
                        <p className="text-orange-700 text-[10px]">Profit on exit</p>
                        <p className="text-orange-700 font-bold text-xs">{roi ? formatAmount(roi.midSeason.saleProceeds - invested) : formatAmount(midPayout - invested)}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)", border: "1px solid #bbf7d0" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🌾</span>
                          <div>
                            <p className="text-green-800 font-bold text-sm">Full Season Exit</p>
                            <p className="text-green-500 text-[10px]">~6 months · up to 22% return</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-green-600 font-extrabold text-base">{roi ? formatAmount(roi.fullSeason.projectedPayout) : formatAmount(fullPayout)}</p>
                          <p className="text-green-500 text-[10px] font-bold">{roi ? `${roi.fullSeason.roiPercent >= 0 ? "+" : ""}${roi.fullSeason.roiPercent.toFixed(1)}%` : "+22%"} ROI</p>
                        </div>
                      </div>
                      <div className="bg-white/70 rounded-xl px-3 py-2 flex items-center justify-between">
                        <p className="text-green-700 text-[10px]">Projected profit</p>
                        <p className="text-green-700 font-bold text-xs">{roi ? formatAmount(roi.fullSeason.projectedPayout - invested) : formatAmount(fullPayout - invested)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button onClick={() => { setRoiDetailHolding(null); setSelectedHolding(h); setSellOpen(true); }}
                      className="py-3 rounded-2xl text-sm font-bold active:scale-95 transition-transform"
                      style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb" }}>
                      Sell Shares
                    </button>
                    <button onClick={() => { setRoiDetailHolding(null); setSelectedHolding(h); setExitOpen(true); }}
                      className="py-3 rounded-2xl text-sm font-bold text-white active:scale-95 transition-transform"
                      style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
                      Request Exit
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Stat detail bottom sheet */}
      <AnimatePresence>
        {statDetail && summary && (() => {
          const STAT_INFO = {
            invested: { icon: "💰", title: "Total Invested", val: formatKES(summary.totalInvested), color: "from-emerald-600 to-green-500",
              description: "The total capital you've deployed across all active farm investments.",
              bullets: [`${summary.holdings} active farm positions`, "Covers primary market purchases and secondary trades", "Does not include pending exit requests"] },
            pnl: { icon: "📈", title: "Today's P&L", val: formatKES(summary.todayReturn), color: "from-blue-600 to-sky-500",
              description: "Your profit or loss over the last 24 hours based on price movement.",
              bullets: [`${formatChange(summary.todayReturnPercent)} change today`, `This week: ${formatChange(summary.weekReturnPercent)}`, "Updates as market prices change"] },
            holdings: { icon: "🌾", title: "Active Holdings", val: String(summary.holdings), color: "from-amber-600 to-orange-500",
              description: "Total number of distinct farm investment positions you currently hold.",
              bullets: [`Portfolio value: ${formatKES(summary.totalValue)}`, `Overall return: ${formatChange(summary.overallGainLossPercent)}`, "Tap any holding to view details or request exit"] },
          };
          const d = STAT_INFO[statDetail];
          return (
            <motion.div className="fixed inset-0 z-50 flex items-end"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setStatDetail(null)} />
              <motion.div className="relative w-full bg-white rounded-t-3xl overflow-hidden shadow-2xl max-w-[430px] mx-auto"
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}>
                <div className={`h-1.5 bg-gradient-to-r ${d.color}`} />
                <div className="px-5 pt-4 pb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${d.color} flex items-center justify-center shadow-sm`}>
                        <span className="text-2xl">{d.icon}</span>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs font-medium">{d.title}</p>
                        <p className="font-extrabold text-2xl leading-none text-foreground">{d.val}</p>
                      </div>
                    </div>
                    <button onClick={() => setStatDetail(null)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-all">
                      <X size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">{d.description}</p>
                  <div className="space-y-2">
                    {d.bullets.map((b, i) => (
                      <div key={i} className="flex items-center gap-3 bg-muted/50 rounded-xl px-3.5 py-3">
                        <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${d.color} flex-shrink-0`} />
                        <p className="text-foreground text-xs font-medium">{b}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
