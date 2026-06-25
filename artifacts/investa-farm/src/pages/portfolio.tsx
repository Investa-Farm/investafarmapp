import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetPortfolio, useGetPortfolioSummary } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, formatChange, getStoredUser, getToken } from "@/lib/auth";
import {
  TrendingUp, TrendingDown, Share2, Tag, ExternalLink, Users, BadgeCheck,
  Copy, Check, Lock, Globe, ChevronRight as ChevRight, Zap, BookOpen,
  Star, Plus, RefreshCw, Bell, CreditCard, X, Info, ChevronLeft, ChevronRight,
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
    <div className="bg-white border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
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
  const [holdingIdx, setHoldingIdx] = useState(0);
  const [, setLocation] = useLocation();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
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

  const chartData = useMemo(() => {
    if (!summary) return [];
    return buildChartData(summary.totalInvested, summary.totalValue, period);
  }, [summary, period]);

  const chartMin = useMemo(() => chartData.length ? Math.min(...chartData.map(d => d.value)) * 0.995 : 0, [chartData]);
  const chartMax = useMemo(() => chartData.length ? Math.max(...chartData.map(d => d.value)) * 1.005 : 0, [chartData]);
  const isPortfolioUp = summary ? summary.totalValue >= summary.totalInvested : true;

  const holdingsList = (holdings as Holding[]) ?? [];
  const currentHolding = holdingsList[holdingIdx] ?? null;

  return (
    <div className="app-shell page-enter" style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }} data-testid="portfolio-page">

      {/* ── Hero header ── */}
      <div className="hero-header pt-10 pb-3 px-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-white/80 text-xs font-medium">My Portfolio</p>
          <button
            onClick={() => setLocation("/market")}
            className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
            <Bell size={14} className="text-white" />
          </button>
        </div>

        {/* Stats row */}
        {summary ? (
          <div>
            <p className="text-white/60 text-xs mt-0.5">Portfolio Value</p>
            <motion.p key={summary.totalValue} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="text-white text-2xl font-bold mt-0.5">
              <AnimatedKES value={summary.totalValue} />
            </motion.p>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1">
                {summary.todayReturn >= 0
                  ? <TrendingUp size={10} className="text-green-300" />
                  : <TrendingDown size={10} className="text-red-300" />}
                <span className={`text-[11px] font-semibold ${summary.todayReturn >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {formatChange(summary.todayReturnPercent)} today
                </span>
              </div>
              <span className="text-white/30">|</span>
              <span className="text-white/60 text-[11px]">{formatChange(summary.weekReturnPercent)} this week</span>
            </div>
            {/* 3-stat row */}
            <div className="flex items-center mt-2 divide-x divide-white/20">
              {([
                { key: "invested" as const, label: "Invested", value: summary.totalInvested, isKES: true, color: "text-white" },
                { key: "pnl" as const, label: "P&L", value: summary.todayReturn, isKES: true, color: summary.todayReturn >= 0 ? "text-green-300" : "text-red-300" },
                { key: "holdings" as const, label: "Holdings", value: summary.holdings, isKES: false, color: "text-white" },
              ]).map(({ key, label, value, isKES, color }) => (
                <button key={key} onClick={() => setStatDetail(key)}
                  className="flex-1 text-center px-2 active:opacity-60 transition-opacity group">
                  <p className={`font-bold text-xs leading-tight truncate ${color}`}>
                    {isKES ? <AnimatedKES value={value} /> : <>{value}</>}
                  </p>
                  <p className="text-white/40 text-[9px] mt-0.5 flex items-center justify-center gap-0.5">
                    {label} <Info size={6} className="opacity-50" />
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Skeleton className="h-20 mt-2 rounded-2xl bg-white/20" />
        )}
      </div>

      {/* ── Tab switcher ── */}
      <div className="px-4 pt-2 pb-2 flex-shrink-0">
        <div className="flex bg-muted rounded-2xl p-1 gap-1">
          <button onClick={() => setActiveTab("overview")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === "overview" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
            📈 Overview
          </button>
          <button onClick={() => setActiveTab("holdings")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === "holdings" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
            🌾 My Holdings
          </button>
        </div>
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {activeTab === "overview" && (
        <div className="flex-1 overflow-hidden flex flex-col gap-2.5 px-4 pb-2" style={{ minHeight: 0 }}>

          {/* Performance Chart — fills remaining space */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden flex flex-col flex-1" style={{ minHeight: 0 }}>
            <div className="px-4 pt-3 pb-1 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-foreground font-bold text-sm">Performance</p>
                {summary && (
                  <p className={`text-xs font-semibold mt-0.5 ${isPortfolioUp ? "text-green-600" : "text-red-500"}`}>
                    {isPortfolioUp ? "+" : ""}{formatKES(summary.totalValue - summary.totalInvested)}
                    <span className="font-normal text-muted-foreground ml-1">total return</span>
                  </p>
                )}
              </div>
              <div className="flex bg-muted rounded-xl p-0.5 gap-0.5">
                {(["1W", "1M", "3M"] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${period === p ? "bg-primary text-white shadow-sm" : "text-muted-foreground"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 px-1 pb-2" style={{ minHeight: 0 }}>
              {!summary ? (
                <div className="h-full flex items-center justify-center"><Skeleton className="w-full h-full rounded-xl" /></div>
              ) : summary.totalInvested === 0 ? (
                <div className="h-full flex items-center justify-center bg-muted/30 rounded-xl mx-2">
                  <div className="text-center">
                    <TrendingUp size={24} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-xs">Invest to see your growth chart</p>
                  </div>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="80%">
                    <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isPortfolioUp ? "#16a34a" : "#dc2626"} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={isPortfolioUp ? "#16a34a" : "#dc2626"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false}
                        domain={[chartMin, chartMax]} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} width={34} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={summary.totalInvested} stroke="hsl(220 9% 46%)" strokeDasharray="4 3" strokeWidth={1}
                        label={{ value: "Invested", position: "insideTopRight", fontSize: 8, fill: "hsl(220 9% 46%)" }} />
                      <Area type="monotone" dataKey="value" stroke={isPortfolioUp ? "#16a34a" : "#dc2626"}
                        strokeWidth={2} fill="url(#perfGrad)" dot={false}
                        activeDot={{ r: 4, fill: isPortfolioUp ? "#16a34a" : "#dc2626", strokeWidth: 2, stroke: "#fff" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex justify-around px-2 pt-0.5">
                    {[
                      { label: "Overall", val: `${formatChange(summary.overallGainLossPercent)}`, color: isPortfolioUp ? "text-green-600" : "text-red-500" },
                      { label: "Today", val: formatChange(summary.todayReturnPercent), color: "text-green-600" },
                      { label: "This Week", val: formatChange(summary.weekReturnPercent), color: "text-green-600" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="text-center">
                        <p className={`text-xs font-bold ${color}`}>{val}</p>
                        <p className="text-muted-foreground text-[9px]">{label}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom 2-column grid: Quick Actions + Exit Options */}
          <div className="grid grid-cols-2 gap-2.5 flex-shrink-0">
            {/* Quick actions */}
            <div className="bg-white border border-border rounded-2xl p-3 space-y-1.5">
              <p className="text-muted-foreground text-[9px] font-bold uppercase tracking-wider mb-2">Quick Actions</p>
              {[
                { icon: "🛒", label: "Browse Farms", href: "/market/primary" },
                { icon: "📊", label: "Trade Shares", href: "/market/secondary" },
                { icon: "🔔", label: "Price Alerts", href: "/market" },
              ].map(item => (
                <a key={item.label} href={item.href}
                  className="flex items-center gap-2 py-1.5 active:opacity-60 transition-opacity">
                  <span className="text-base leading-none">{item.icon}</span>
                  <span className="text-foreground font-medium text-xs">{item.label}</span>
                  <ChevRight size={10} className="text-muted-foreground ml-auto" />
                </a>
              ))}
              <button onClick={() => { const first = holdingsList.find(h => h.status === "active"); if (first) { setActiveTab("holdings"); handleExitClick(first); } else setActiveTab("holdings"); }}
                className="flex items-center gap-2 py-1.5 active:opacity-60 transition-opacity w-full text-left">
                <span className="text-base">⚡</span>
                <span className="text-foreground font-medium text-xs">Exit Holding</span>
                <ChevRight size={10} className="text-muted-foreground ml-auto" />
              </button>
            </div>

            {/* Exit options */}
            <div className="space-y-2">
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-3 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">⚡</span>
                  <p className="text-xs font-bold text-orange-700">Mid-Season</p>
                </div>
                <p className="text-orange-600 font-bold text-base">+10% base</p>
                <p className="text-muted-foreground text-[10px]">30–60 days</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-3 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">🌾</span>
                  <p className="text-xs font-bold text-green-700">Full Season</p>
                </div>
                <p className="text-green-600 font-bold text-base">Up to +22%</p>
                <p className="text-muted-foreground text-[10px]">~6 months</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ HOLDINGS TAB ══ */}
      {activeTab === "holdings" && (
        <div className="flex-1 overflow-hidden flex flex-col gap-2 px-4 pb-2" style={{ minHeight: 0 }}>

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

          {/* Holding card carousel — fills available height */}
          <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            {isLoading ? (
              <Skeleton className="flex-1 rounded-2xl" />
            ) : holdingsList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center bg-white border border-border rounded-2xl p-6">
                <TrendingUp size={32} className="text-muted-foreground mb-3" />
                <p className="text-foreground font-bold text-sm">No holdings yet</p>
                <p className="text-muted-foreground text-xs mt-1">Browse the market to buy your first farm shares.</p>
                <Link href="/market/primary" className="mt-4 bg-primary text-white font-bold px-5 py-2.5 rounded-xl text-sm">
                  Browse Farms
                </Link>
              </div>
            ) : (
              <>
                {/* Carousel nav header */}
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
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
                      className="w-7 h-7 rounded-full bg-white border border-border flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <ChevronLeft size={13} className="text-foreground" />
                    </button>
                    <span className="text-muted-foreground text-[10px] font-medium min-w-[32px] text-center">
                      {holdingIdx + 1}/{holdingsList.length}
                    </span>
                    <button
                      onClick={() => setHoldingIdx(i => Math.min(holdingsList.length - 1, i + 1))}
                      disabled={holdingIdx === holdingsList.length - 1}
                      className="w-7 h-7 rounded-full bg-white border border-border flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <ChevronRight size={13} className="text-foreground" />
                    </button>
                  </div>
                </div>

                {/* Dot indicators */}
                <div className="flex items-center justify-center gap-1 mb-2 flex-shrink-0">
                  {holdingsList.map((_, i) => (
                    <button key={i} onClick={() => setHoldingIdx(i)}
                      style={{ width: i === holdingIdx ? 18 : 5, height: 5, borderRadius: 100, border: "none", cursor: "pointer", transition: "all 0.3s", background: i === holdingIdx ? "#16a34a" : "#d1d5db", padding: 0 }} />
                  ))}
                </div>

                {/* Card — fills remaining space */}
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
                        className="flex-1 bg-card rounded-2xl border border-border overflow-hidden shadow-md flex flex-col"
                        style={{ minHeight: 0 }}
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
                        <div className="relative flex-shrink-0" style={{ height: "32%" }}>
                          <img src={farmImg} alt={h.farmName} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                          {/* status badges */}
                          {isExited && <div className="absolute top-2.5 left-2.5 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Exit Pending</div>}
                          {isHarvested && <div className="absolute top-2.5 left-2.5 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">🌾 Harvested</div>}
                          {/* sparkline + change pill */}
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                            <div className="opacity-80">
                              <Sparkline data={generateSparkData(h.farmId * 13, 10)} width={48} height={22} positive={isUp} />
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isUp ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                              {formatChange(h.gainLossPercent)}
                            </span>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-white font-bold text-sm leading-tight">{h.farmName}</p>
                            <p className="text-white/70 text-[10px] mt-0.5">{h.cropType} · {h.location}</p>
                          </div>
                        </div>

                        {/* Stats strip */}
                        <div className="grid grid-cols-4 divide-x divide-border border-b border-border flex-shrink-0">
                          {[
                            { label: "Shares", val: String(h.quantity), color: "text-foreground" },
                            { label: "Invested", val: formatAmount(invested), color: "text-foreground" },
                            { label: "Value", val: formatAmount(h.totalValue), color: isUp ? "text-green-600" : "text-red-500" },
                            { label: "P&L", val: (isUp ? "+" : "") + formatAmount(h.gainLoss), color: isUp ? "text-green-600" : "text-red-500" },
                          ].map(({ label, val, color }) => (
                            <div key={label} className="py-2 text-center">
                              <p className={`font-bold text-xs ${color}`}>{val}</p>
                              <p className="text-muted-foreground text-[9px] mt-0.5">{label}</p>
                            </div>
                          ))}
                        </div>

                        {/* ROI projections */}
                        <div className="p-3 flex-1 flex flex-col justify-between" style={{ minHeight: 0 }}>
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-2.5">
                            <p className="text-green-700 text-[10px] font-semibold mb-1.5">
                              {roi ? "AI ROI Projections" : "Estimated Payout on Exit"}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-white/80 rounded-lg p-2">
                                <p className="text-muted-foreground text-[9px]">⚡ Mid-Season</p>
                                <p className="text-orange-600 font-bold text-xs">{roi ? formatAmount(roi.midSeason.saleProceeds) : formatAmount(midPayout)}</p>
                                {roi
                                  ? <p className="text-orange-500 text-[9px] font-semibold">{roi.midSeason.roiPercent >= 0 ? "+" : ""}{roi.midSeason.roiPercent.toFixed(1)}%</p>
                                  : <p className="text-muted-foreground text-[9px]">+10% return</p>
                                }
                              </div>
                              <div className="bg-white/80 rounded-lg p-2">
                                <p className="text-muted-foreground text-[9px]">🌾 Full Season</p>
                                <p className="text-green-600 font-bold text-xs">{roi ? formatAmount(roi.fullSeason.projectedPayout) : formatAmount(fullPayout)}</p>
                                {roi
                                  ? <p className="text-green-600 text-[9px] font-semibold">{roi.fullSeason.roiPercent >= 0 ? "+" : ""}{roi.fullSeason.roiPercent.toFixed(1)}%</p>
                                  : <p className="text-muted-foreground text-[9px]">+22% return</p>
                                }
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-1.5 mt-2">
                            <Link href={`/market/exchange/${h.farmId}`}
                              className="h-9 px-2.5 rounded-xl border border-border text-muted-foreground text-[10px] font-medium active:scale-95 transition-all flex items-center justify-center gap-1 flex-shrink-0">
                              <ExternalLink size={10} /> View
                            </Link>
                            {h.status === "active" && (
                              <>
                                <button onClick={() => handleSwapClick(h)}
                                  className="flex-1 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1">
                                  <RefreshCw size={10} /> Swap
                                </button>
                                <button onClick={() => handleSellClick(h)}
                                  className="flex-1 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1">
                                  <Tag size={10} /> Sell
                                </button>
                                <button onClick={() => handleExitClick(h)}
                                  className="flex-1 h-9 rounded-xl bg-primary text-white text-[10px] font-bold active:scale-95 transition-all">
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

          {/* Reinvestment + browse strip at bottom */}
          {holdingsList.length > 0 && (
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setReinvestOpen(true)}
                className="flex-1 h-11 rounded-xl overflow-hidden relative active:scale-95 transition-transform">
                <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #14532d, #16a34a)" }} />
                <div className="relative flex items-center gap-2 px-3 h-full">
                  <RefreshCw size={12} className="text-white flex-shrink-0" />
                  <span className="text-white font-bold text-xs">Auto-Reinvest</span>
                </div>
              </button>
              <Link href="/market/primary"
                className="flex-1 h-11 rounded-xl bg-white border border-border flex items-center gap-2 px-3 active:scale-95 transition-transform">
                <TrendingUp size={12} className="text-primary flex-shrink-0" />
                <span className="text-foreground font-bold text-xs">Browse More</span>
              </Link>
            </div>
          )}
        </div>
      )}

      <BottomNav role="investor" />

      {wizardOpen && (
        <PortfolioWizard onClose={() => setWizardOpen(false)} onCreated={() => { setWizardOpen(false); refetchPortfolios(); }} />
      )}
      <ExitModal open={exitOpen} onClose={() => setExitOpen(false)} holding={selectedHolding} />
      <SellSharesModal open={sellOpen} onClose={() => setSellOpen(false)} holding={selectedHolding} />
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
          <div className="absolute inset-0 bg-black/50" onClick={() => { setBrokerUnlockOpen(false); localStorage.setItem("investa_broker_unlocked", "true"); }} />
          <div className="relative bg-white rounded-t-3xl w-full max-w-[430px] overflow-y-auto max-h-[90vh]">
            <div className="flex gap-1.5 justify-center pt-5 pb-2">
              {[0, 1, 2].map(s => (
                <div key={s} className={`h-1.5 rounded-full transition-all ${s === brokerUnlockStep ? "w-8 bg-primary" : "w-1.5 bg-gray-200"}`} />
              ))}
            </div>
            {brokerUnlockStep === 0 && (
              <div className="px-6 pb-8 text-center">
                <div className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4 mt-2">
                  <span className="text-4xl">🏆</span>
                </div>
                <h2 className="text-foreground font-extrabold text-xl mb-2">You Qualify as a Stock Broker!</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Your investment portfolio has crossed <strong>KES 500,000</strong>. You're eligible to manage portfolios and earn broker commissions.
                </p>
                <button onClick={() => setBrokerUnlockStep(1)}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform">
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
                    <div key={b.title} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0 text-lg">{b.icon}</div>
                      <div>
                        <p className="text-foreground font-semibold text-sm">{b.title}</p>
                        <p className="text-muted-foreground text-xs">{b.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setBrokerUnlockStep(2)}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform">
                  Activate My Profile →
                </button>
              </div>
            )}
            {brokerUnlockStep === 2 && (
              <div className="px-6 pb-10 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center mx-auto mb-4 mt-2">
                  <span className="text-4xl">🌱</span>
                </div>
                <h2 className="text-foreground font-extrabold text-xl mb-2">Activate Broker Mode</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Turn on your broker profile and start creating portfolios that others can follow.
                </p>
                <button
                  onClick={() => { setBrokerEnabled(true); localStorage.setItem("investa_broker_mode", "true"); localStorage.setItem("investa_broker_unlocked", "true"); setBrokerUnlockOpen(false); setActiveTab("holdings"); }}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform mb-3">
                  🚀 Activate Broker Profile
                </button>
                <button onClick={() => { setBrokerUnlockOpen(false); localStorage.setItem("investa_broker_unlocked", "true"); }}
                  className="w-full py-3 rounded-2xl border border-border text-muted-foreground font-medium text-sm active:scale-95 transition-transform">
                  Maybe Later
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
              <motion.div className="relative w-full bg-card rounded-t-3xl overflow-hidden shadow-2xl max-w-[430px] mx-auto"
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}>
                <div className={`h-1.5 bg-gradient-to-r ${d.color}`} />
                <div className="px-5 pt-4 pb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${d.color} flex items-center justify-center shadow-sm`}>
                        <span className="text-xl">{d.icon}</span>
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-base">{d.title}</p>
                        <p className="font-extrabold text-2xl leading-none text-foreground">{d.val}</p>
                      </div>
                    </div>
                    <button onClick={() => setStatDetail(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <X size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">{d.description}</p>
                  <div className="space-y-2">
                    {d.bullets.map((b, i) => (
                      <div key={i} className="flex items-center gap-2.5 bg-muted/50 rounded-xl px-3 py-2.5">
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
