import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetPortfolio, useGetPortfolioSummary } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, formatChange, getStoredUser, getToken } from "@/lib/auth";
import { TrendingUp, TrendingDown, Share2, Tag, ExternalLink, Users, BadgeCheck, Copy, Check, Lock, Globe, ChevronRight as ChevRight, Zap, BookOpen, Star, Plus, RefreshCw, Bell, CreditCard, X, Info } from "lucide-react";
import { PortfolioWizard } from "@/components/portfolio-wizard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { ShareModal } from "@/components/share-modal";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ExitModal } from "@/components/exit-modal";
import { SellSharesModal } from "@/components/sell-shares-modal";
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
  const formatted = formatKES(animated);
  return <span className={className}>{formatted}</span>;
}

function PortfolioHeroStats({ summary, onStatDetail }: { summary: Summary; onStatDetail: (k: "invested" | "pnl" | "holdings") => void }) {
  const isUp = summary.todayReturn >= 0;

  return (
    <>
      <p className="text-white/70 text-sm mt-1">Portfolio Value</p>
      <motion.p
        key={summary.totalValue}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-white text-3xl font-bold mt-0.5"
      >
        <AnimatedKES value={summary.totalValue} />
      </motion.p>
      <div className="flex items-center gap-3 mt-1.5">
        <div className="flex items-center gap-1">
          {isUp ? <TrendingUp size={12} className="text-green-300" /> : <TrendingDown size={12} className="text-red-300" />}
          <span className={`text-xs font-semibold ${isUp ? "text-green-300" : "text-red-300"}`}>{formatChange(summary.todayReturnPercent)} today</span>
        </div>
        <span className="text-white/30">|</span>
        <span className="text-white/70 text-xs">{formatChange(summary.weekReturnPercent)} this week</span>
      </div>

      {/* Plain-text stat row — no cards */}
      <div className="flex items-center mt-3 divide-x divide-white/20">
        {([
          { key: "invested" as const, label: "Invested", value: summary.totalInvested, isKES: true, color: "text-white" },
          { key: "pnl" as const, label: "P&L", value: summary.todayReturn, isKES: true, color: summary.todayReturn >= 0 ? "text-green-300" : "text-red-300" },
          { key: "holdings" as const, label: "Holdings", value: summary.holdings, isKES: false, color: "text-white" },
        ]).map(({ key, label, value, isKES, color }) => (
          <button
            key={key}
            onClick={() => onStatDetail(key)}
            className="flex-1 text-center px-2 active:opacity-60 transition-opacity group"
          >
            <p className={`font-bold text-sm leading-tight truncate ${color}`}>
              {isKES ? <AnimatedKES value={value} /> : <>{value}</>}
            </p>
            <p className="text-white/50 text-[9px] mt-0.5 flex items-center justify-center gap-0.5">
              {label}
              <Info size={7} className="opacity-50 group-active:opacity-100" />
            </p>
          </button>
        ))}
      </div>
    </>
  );
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
  const [, setLocation] = useLocation();
  const token = getToken();
  const user = getStoredUser();
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

  const [acctCopied, setAcctCopied] = useState(false);

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

  const handleCopyAcct = async () => {
    if (!stellarAcct?.accountNumber) return;
    await navigator.clipboard.writeText(stellarAcct.accountNumber).catch(() => {});
    setAcctCopied(true);
    setTimeout(() => setAcctCopied(false), 2000);
  };

  const brokerLink = `https://app.investafarm.com/portfolio`;
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

  return (
    <div className="app-shell pb-20 page-enter" data-testid="portfolio-page">
      {/* Hero header */}
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-white/80 text-xs font-medium">My Portfolio</p>
          <button
            onClick={() => setLocation("/market")}
            className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center relative">
            <Bell size={14} className="text-white" />
          </button>
        </div>
        {summary ? (
          <PortfolioHeroStats summary={summary} onStatDetail={setStatDetail} />
        ) : (
          <Skeleton className="h-24 mt-2 rounded-2xl bg-white/20" />
        )}
      </div>

      {/* ── Tab switcher ── */}
      <div className="px-4 pt-4">
        <div className="flex bg-muted rounded-2xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === "overview" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
            📈 Overview
          </button>
          <button
            onClick={() => setActiveTab("holdings")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === "holdings" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
            🌾 My Holdings
          </button>
        </div>
      </div>

      {activeTab === "overview" && (<>

      {/* ── Performance Chart ── */}
      <div className="mx-4 mt-4 bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div>
            <p className="text-foreground font-bold text-sm">Portfolio Performance</p>
            {summary && (
              <p className={`text-xs font-semibold mt-0.5 ${isPortfolioUp ? "text-green-600" : "text-red-500"}`}>
                {isPortfolioUp ? "+" : ""}{formatKES(summary.totalValue - summary.totalInvested)}
                <span className="font-normal text-muted-foreground ml-1">total return</span>
              </p>
            )}
          </div>
          {/* Period selector */}
          <div className="flex bg-muted rounded-xl p-0.5 gap-0.5">
            {(["1W", "1M", "3M"] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  period === p ? "bg-primary text-white shadow-sm" : "text-muted-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {!summary ? (
          <Skeleton className="mx-4 mb-4 h-44 rounded-xl" />
        ) : summary.totalInvested === 0 ? (
          <div className="mx-4 mb-4 h-44 flex items-center justify-center bg-muted/40 rounded-xl">
            <div className="text-center">
              <TrendingUp size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-xs">Invest to see your growth chart</p>
            </div>
          </div>
        ) : (
          <div className="px-1 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPortfolioUp ? "#16a34a" : "#dc2626"} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={isPortfolioUp ? "#16a34a" : "#dc2626"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "hsl(220 9% 46%)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "hsl(220 9% 46%)" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[chartMin, chartMax]}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={summary.totalInvested}
                  stroke="hsl(220 9% 46%)"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  label={{ value: "Invested", position: "insideTopRight", fontSize: 8, fill: "hsl(220 9% 46%)" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isPortfolioUp ? "#16a34a" : "#dc2626"}
                  strokeWidth={2}
                  fill="url(#perfGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: isPortfolioUp ? "#16a34a" : "#dc2626", strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Stats row */}
            <div className="flex justify-between px-4 pt-1">
              {[
                { label: "Overall Return", val: `${formatChange(summary.overallGainLossPercent)}`, color: isPortfolioUp ? "text-green-600" : "text-red-500" },
                { label: "Today", val: formatChange(summary.todayReturnPercent), color: "text-green-600" },
                { label: "This Week", val: formatChange(summary.weekReturnPercent), color: "text-green-600" },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-xs font-bold ${color}`}>{val}</p>
                  <p className="text-muted-foreground text-[9px] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions horizontal scroll */}
      <div className="mt-3 overflow-x-auto no-scrollbar">
        <div className="flex gap-2.5 px-4" style={{ width: "max-content" }}>
          {[
            { icon: "🛒", label: "Browse Farms", href: "/market/primary" },
            { icon: "⚡", label: "Exit Holding", onTap: () => { const first = (holdings as Holding[])?.find(h => h.status === "active"); if (first) { setActiveTab("holdings"); handleExitClick(first); } else setActiveTab("holdings"); } },
            { icon: "📊", label: "Trade Shares", href: "/market/secondary" },
            { icon: "🔔", label: "Set Price Alert", href: "/market" },
            { icon: "💼", label: "Portfolio Mgr", onTap: () => setActiveTab("holdings") },
          ].map(item => (
            item.href
              ? <a key={item.label} href={item.href}
                  className="flex items-center gap-2 bg-white border border-border rounded-2xl px-3.5 py-2.5 shadow-sm active:scale-95 transition-transform flex-shrink-0">
                  <span className="text-base leading-none">{item.icon}</span>
                  <span className="text-foreground font-semibold text-xs whitespace-nowrap">{item.label}</span>
                </a>
              : <button key={item.label} onClick={item.onTap}
                  className="flex items-center gap-2 bg-white border border-border rounded-2xl px-3.5 py-2.5 shadow-sm active:scale-95 transition-transform flex-shrink-0">
                  <span className="text-base leading-none">{item.icon}</span>
                  <span className="text-foreground font-semibold text-xs whitespace-nowrap">{item.label}</span>
                </button>
          ))}
        </div>
      </div>

      {/* Thick section break */}
      <div className="h-2 bg-muted/40 mt-4" />

      {/* Return info banner */}
      <div className="px-4 pt-4">
        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <TrendingUp size={10} /> Exit Options &amp; Payouts
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-lg">⚡</span>
              <p className="text-xs font-bold text-orange-700">Mid-Season</p>
            </div>
            <p className="text-orange-600 font-bold text-base">+10% base</p>
            <p className="text-muted-foreground text-[10px] mt-0.5">30–60 days</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-lg">🌾</span>
              <p className="text-xs font-bold text-green-700">Full Season</p>
            </div>
            <p className="text-green-600 font-bold text-base">Up to +22%</p>
            <p className="text-muted-foreground text-[10px] mt-0.5">~6 months</p>
          </div>
        </div>
      </div>

      {/* Thick section break */}
      <div className="h-2 bg-muted/40 mt-4" />

      </>)}

      {/* Portfolio Manager + Holdings tab */}
      {activeTab === "holdings" && (
        <div className="px-4 pt-3 space-y-4">

          {/* Qualification banner */}
          {qualification && !qualification.qualified && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Star size={18} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-amber-800 font-bold text-sm">Unlock Portfolio Manager</p>
                  <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                    Invest a total of KES 500,000 to qualify. You're at KES {Math.round(qualification.totalInvested).toLocaleString()} ({Math.round((qualification.totalInvested / qualification.threshold) * 100)}%).
                  </p>
                  <div className="mt-2 bg-amber-200/50 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (qualification.totalInvested / qualification.threshold) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create portfolio CTA */}
          {qualification?.qualified && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #16a34a 100%)" }}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-green-300 text-[10px] font-bold uppercase tracking-widest mb-1">✅ Qualified Manager</p>
                    <p className="text-white font-bold text-base">Build AI Portfolios</p>
                    <p className="text-white/70 text-xs mt-0.5">Charge fees · Earn passively · Grow followers</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Zap size={22} className="text-yellow-300" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setWizardOpen(true)}
                    className="bg-white text-primary font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} /> New Portfolio
                  </button>
                  <button
                    onClick={() => setLocation("/market/portfolios")}
                    className="bg-white/20 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <BookOpen size={14} /> Community
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* My portfolios list */}
          {myPortfolios.length > 0 && (
            <div className="space-y-2">
              <p className="text-foreground font-bold text-sm flex items-center gap-1.5">
                <Star size={14} className="text-primary" /> My Portfolios
              </p>
              {myPortfolios.map((p: any) => (
                <div key={p.id} className="bg-white border border-border rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-bold text-sm truncate">{p.name}</p>
                      <p className="text-muted-foreground text-xs capitalize">{p.strategy?.replace("_"," ")} · Risk {p.targetRisk}/10</p>
                    </div>
                    {p.isPublished
                      ? <span className="text-[9px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0">Published</span>
                      : <span className="text-[9px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex-shrink-0">Draft</span>
                    }
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Users size={10} /> {p.followerCount ?? 0} followers
                    <span>·</span> {p.holdingCount ?? 0} farms
                    {Number(p.managementFeePercent) > 0 && <><span>·</span> {p.managementFeePercent}%/yr fee</>}
                  </div>
                  {!p.isPublished && (
                    <button
                      onClick={() => handlePublish(p.id)}
                      className="w-full bg-primary text-white text-xs font-bold py-2 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Globe size={12} /> Publish to Community
                    </button>
                  )}
                  {p.isPublished && (
                    <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                      <Globe size={11} className="text-muted-foreground" />
                      <p className="text-muted-foreground text-[10px] flex-1 font-mono truncate">app.investafarm.com/market/portfolios/{p.id}</p>
                      <button onClick={() => { navigator.clipboard.writeText(`https://app.investafarm.com/market/portfolios/${p.id}`).catch(()=>{}); }}
                        className="text-primary text-[10px] font-bold">Copy</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {qualification?.qualified && myPortfolios.length === 0 && (
            <div className="bg-white border border-border rounded-2xl p-6 text-center">
              <Zap size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-foreground font-bold text-sm">No portfolios yet</p>
              <p className="text-muted-foreground text-xs mt-1">Build your first AI-optimised portfolio in minutes.</p>
              <button onClick={() => setWizardOpen(true)} className="mt-3 bg-primary text-white font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95">
                Build My First Portfolio
              </button>
            </div>
          )}

          {/* Legacy broker toggle — keep for investors not yet qualified */}
          <div className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Globe size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-foreground font-bold text-sm">Public Broker Profile</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Let others follow your investment picks</p>
                </div>
              </div>
              <button
                onClick={handleBrokerToggle}
                className={`relative w-12 h-6 rounded-full transition-colors ${brokerEnabled ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${brokerEnabled ? "left-6" : "left-0.5"}`} />
              </button>
            </div>
            {brokerEnabled && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BadgeCheck size={14} className="text-green-600 flex-shrink-0" />
                  <p className="text-green-700 font-semibold text-xs">Broker Profile Active</p>
                </div>
                <p className="text-green-600 text-[10px] leading-relaxed">Your portfolio picks are now visible to followers. Others can copy your investment strategy.</p>
              </div>
            )}
          </div>

          {/* Shareable link */}
          <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
            <p className="text-foreground font-semibold text-sm flex items-center gap-2">
              <Share2 size={14} className="text-primary" /> Your Broker Link
            </p>
            {brokerEnabled ? (
              <>
                <div className="bg-muted/50 border border-border rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <Globe size={12} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-foreground text-xs font-mono flex-1 truncate">{brokerLink}</p>
                </div>
                <button
                  onClick={handleCopyLink}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 ${copied ? "bg-green-600 text-white" : "bg-primary text-white"}`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy Broker Link"}
                </button>
              </>
            ) : (
              <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-2">
                <Lock size={14} className="text-muted-foreground" />
                <p className="text-muted-foreground text-xs">Enable your broker profile to get a shareable link</p>
              </div>
            )}
          </div>

          {/* Portfolio snapshot */}
          <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
            <p className="text-foreground font-semibold text-sm">Portfolio Snapshot</p>
            {summary && (holdings?.length ?? 0) > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Total Holdings", val: String(summary.holdings), icon: "🌾" },
                    { label: "Total Value", val: formatKES(summary.totalValue), icon: "💰" },
                    { label: "Overall Return", val: formatChange(summary.overallGainLossPercent), icon: "📈" },
                    { label: "Avg per Farm", val: summary.holdings > 0 ? formatKES(summary.totalValue / summary.holdings) : "—", icon: "📊" },
                  ].map(({ label, val, icon }) => (
                    <div key={label} className="bg-muted/40 rounded-xl p-2.5 text-center">
                      <p className="text-base mb-1">{icon}</p>
                      <p className="text-foreground font-bold text-sm">{val}</p>
                      <p className="text-muted-foreground text-[9px]">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Top Holdings</p>
                  {(holdings as Holding[])?.slice(0, 3).map((h) => (
                    <div key={h.id} className="flex items-center gap-2">
                      <img src={getCropImage(h.cropType, h.imageUrl)} alt={h.farmName} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-medium text-xs truncate">{h.farmName}</p>
                        <p className="text-muted-foreground text-[10px]">{h.cropType} · {h.quantity} shares</p>
                      </div>
                      <span className={`text-xs font-bold ${h.gainLoss >= 0 ? "text-green-600" : "text-red-500"}`}>{formatChange(h.gainLossPercent)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <TrendingUp size={24} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-xs">Invest in farms to build your broker profile</p>
              </div>
            )}
          </div>

          {/* Followers placeholder */}
          <div className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-foreground font-semibold text-sm">Followers</p>
              <span className="text-muted-foreground text-xs">0 followers</span>
            </div>
            <div className="text-center py-4">
              <Users size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-xs">Share your broker link to gain followers</p>
              <p className="text-muted-foreground text-[10px] mt-0.5">Followers can see your picks and copy your strategy</p>
            </div>
          </div>
        </div>
      )}

      {/* Holdings tab */}
      {activeTab === "holdings" && (
      <div className="px-4 pt-3 space-y-3">
        {/* AI portfolio health 1-liner insight */}
        {(holdings as Holding[])?.length > 0 && summary && (
          <PortfolioAiInsight
            totalValue={summary.totalValue}
            totalInvested={summary.totalInvested}
            holdings={summary.holdings}
            gainLossPercent={summary.overallGainLossPercent}
            crops={(holdings as Holding[]).map(h => h.cropType).filter(Boolean)}
          />
        )}

        {/* AI Health Card — show when there are holdings */}
        {(holdings as Holding[])?.length > 0 && summary && (
          <PortfolioHealthAI holdings={holdings as Holding[]} summary={summary} />
        )}

        {/* Stellar custodial account card */}
        {stellarAcct?.accountNumber && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)" }}>
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🌐</span>
                </div>
                <div>
                  <p className="text-slate-300 text-[9px] font-bold uppercase tracking-widest">IFV Account</p>
                  <p className="text-white font-mono font-semibold text-xs tracking-wider">{stellarAcct.accountNumber}</p>
                </div>
              </div>
              <button
                onClick={handleCopyAcct}
                className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 active:scale-95 transition-all"
              >
                {acctCopied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-white/70" />}
                <span className="text-white/70 text-[10px] font-semibold">{acctCopied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Reinvestment Automation banner */}
        <button
          onClick={() => setReinvestOpen(true)}
          className="w-full rounded-2xl overflow-hidden relative h-16 active:scale-95 transition-transform"
        >
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #14532d, #16a34a)" }} />
          <div className="relative flex items-center gap-3 px-4 h-full">
            <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center flex-shrink-0">
              <RefreshCw size={14} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-bold text-xs">Auto-Reinvest Payouts</p>
              <p className="text-white/70 text-[10px]">Set rules · AI picks farms · grow automatically</p>
            </div>
            <div className="bg-white/20 border border-white/30 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              Set Up →
            </div>
          </div>
        </button>

        {/* Section header */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h2 className="font-bold text-foreground text-sm">My Holdings</h2>
            {(holdings as Holding[])?.length > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                {(holdings as Holding[]).length}
              </span>
            )}
            <AiSectionBot
              label="my holdings"
              context={`Investor portfolio with ${(holdings as Holding[])?.length ?? 0} holdings in Kenyan farms. Overall return: ${summary?.overallGainLossPercent?.toFixed(1) ?? 0}%. Crops: ${[...new Set((holdings as Holding[])?.map(h => h.cropType) ?? [])].join(", ")}. What should I focus on to grow returns?`}
            />
          </div>
          {(holdings as Holding[])?.length > 0 && (
            <span className="text-muted-foreground text-[10px]">
              {(holdings as Holding[]).filter(h => h.status === "active").length} active
            </span>
          )}
        </div>
        {isLoading
          ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          : holdings?.length === 0
            ? (
              <div className="text-center py-12">
                <TrendingUp size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No holdings yet.</p>
                <p className="text-muted-foreground text-xs mt-1">Browse the market to buy your first farm shares.</p>
              </div>
            )
            : holdings?.length === 0 ? null
            : (holdings as Holding[])?.map((h) => {
                const isUp = h.gainLoss >= 0;
                const isExited = h.status === "exit_requested";
                const isHarvested = h.status === "exited";
                const invested = h.purchasePrice * h.quantity;
                const midPayout = invested * 1.10;
                const fullPayout = invested * 1.22;
                const farmImg = getCropImage(h.cropType, h.imageUrl);

                const roi = roiByInvestmentId.get(h.id);
                const hasRoi = !!roi;

                return (
                  <div key={h.id} data-testid={`holding-${h.id}`} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                    <div className="relative h-24">
                      <img src={farmImg} alt={h.farmName} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/65 to-transparent" />
                      <div className="absolute inset-0 p-3 flex items-end">
                        <div>
                          <p className="text-white font-bold text-sm">{h.farmName}</p>
                          <p className="text-white/70 text-[11px]">{h.cropType} · {h.location}</p>
                        </div>
                      </div>
                      {isExited && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Exit Pending
                        </div>
                      )}
                      {isHarvested && (
                        <div className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          🌾 Harvested
                        </div>
                      )}
                      {hasRoi && roi.rainfall && roi.rainfall.riskColor !== "green" && (
                        <div className={`absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${roi.rainfall.riskColor === "red" ? "bg-red-500 text-white" : "bg-amber-400 text-amber-900"}`}>
                          {roi.rainfall.riskColor === "red" ? "🚨 Weather Risk" : "⚠️ Low Rain"}
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-2.5">
                      <div className="grid grid-cols-4 gap-1.5">
                        <div className="bg-muted/50 rounded-xl p-2 text-center">
                          <p className="text-muted-foreground text-[9px]">Shares</p>
                          <p className="text-foreground font-bold text-xs">{h.quantity}</p>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-2 text-center">
                          <p className="text-muted-foreground text-[9px]">Invested</p>
                          <p className="text-foreground font-bold text-xs">{formatAmount(invested)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-2 text-center">
                          <p className="text-muted-foreground text-[9px]">Value</p>
                          <p className="text-foreground font-bold text-xs">{formatAmount(h.totalValue)}</p>
                        </div>
                        <div className={`rounded-xl p-2 text-center ${isUp ? "bg-green-50" : "bg-red-50"}`}>
                          <p className="text-muted-foreground text-[9px]">P&L</p>
                          <p className={`font-bold text-xs ${isUp ? "text-green-600" : "text-red-500"}`}>{formatChange(h.gainLossPercent)}</p>
                        </div>
                      </div>

                      {/* AI-Computed ROI Projections */}
                      {hasRoi ? (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-green-700 text-[10px] font-semibold">AI ROI Projections</p>
                            {roi.rainfallFactor < 1.0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                                🌧️ RF×{roi.rainfallFactor}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white/80 rounded-lg p-2">
                              <p className="text-muted-foreground text-[9px]">⚡ Mid-Season Exit</p>
                              <p className="text-orange-600 font-bold text-xs">{formatAmount(roi.midSeason.saleProceeds)}</p>
                              <p className="text-orange-500 text-[9px] font-semibold">{roi.midSeason.roiPercent >= 0 ? "+" : ""}{roi.midSeason.roiPercent.toFixed(1)}% · {roi.midSeason.annualizedPercent.toFixed(0)}% ann.</p>
                              <p className="text-muted-foreground text-[8px]">{roi.midSeason.daysHeld}d held · sell @ {formatAmount(roi.midSeason.pSell)}/sh</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-2">
                              <p className="text-muted-foreground text-[9px]">🌾 Full Season Exit</p>
                              <p className="text-green-600 font-bold text-xs">{formatAmount(roi.fullSeason.projectedPayout)}</p>
                              <p className="text-green-600 text-[9px] font-semibold">{roi.fullSeason.roiPercent >= 0 ? "+" : ""}{roi.fullSeason.roiPercent.toFixed(1)}% · {roi.fullSeason.annualizedPercent.toFixed(0)}% ann.</p>
                              <p className="text-muted-foreground text-[8px]">{roi.fullSeason.daysToHarvest}d to harvest</p>
                            </div>
                          </div>
                          {roi.recommendation !== "neutral" && (
                            <div className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg ${roi.recommendation === "hold" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                              {roi.recommendation === "hold" ? "💡 Consider Holding" : "💡 Consider Selling"} — {roi.recommendationLabel.split("—")[1]?.trim() ?? ""}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-2.5">
                          <p className="text-green-700 text-[10px] font-semibold mb-1.5">Estimated Payout on Exit</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-muted-foreground text-[9px]">⚡ Mid-Season (+10%)</p>
                              <p className="text-orange-600 font-bold text-xs">{formatAmount(midPayout)}</p>
                              <p className="text-muted-foreground text-[8px]">{formatAmount(h.purchasePrice * 1.10)}/share</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[9px]">🌾 Full Season (+22%)</p>
                              <p className="text-green-600 font-bold text-xs">{formatAmount(fullPayout)}</p>
                              <p className="text-muted-foreground text-[8px]">{formatAmount(h.purchasePrice * 1.22)}/share</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-1.5 flex-wrap">
                        <Link
                          href={`/market/exchange/${h.farmId}`}
                          className="py-2 px-2.5 rounded-xl border border-border text-muted-foreground text-xs font-medium active:scale-95 transition-all flex items-center gap-1"
                        >
                          <ExternalLink size={12} /> View Farm
                        </Link>
                        <button
                          onClick={async () => {
                            const url = `https://app.investafarm.com/market/exchange/${h.farmId}`;
                            const text = `I'm investing in ${h.farmName} (${h.cropType}) on Investa Farm! Check it out → ${url}`;
                            if (navigator.share) {
                              navigator.share({ title: `${h.farmName} on Investa Farm`, text, url }).catch(() => {});
                            } else {
                              await navigator.clipboard.writeText(text).catch(() => {});
                            }
                          }}
                          className="py-2 px-2.5 rounded-xl border border-border text-muted-foreground text-xs font-medium active:scale-95 transition-all flex items-center gap-1"
                        >
                          <Share2 size={12} /> Share
                        </button>
                        {h.status === "active" && (
                          <>
                            <Link
                              href={`/market/exchange/${h.farmId}`}
                              className="py-2 px-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1"
                            >
                              <TrendingUp size={12} /> Invest More
                            </Link>
                            <button
                              onClick={() => handleSellClick(h)}
                              className="flex-1 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1"
                            >
                              <Tag size={12} /> Sell
                            </button>
                            <button
                              onClick={() => handleExitClick(h)}
                              className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold active:scale-95 transition-all"
                            >
                              Exit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
        }
        {/* Browse more farms CTA */}
        {(holdings as Holding[])?.length > 0 && (
          <Link href="/market/primary" className="block">
            <div className="mx-0 rounded-2xl overflow-hidden relative h-14 active:scale-95 transition-transform">
              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #052e16, #16a34a)" }} />
              <div className="relative flex items-center gap-3 px-4 h-full">
                <TrendingUp size={16} className="text-white flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-white font-bold text-xs">Browse More Farms</p>
                  <p className="text-white/70 text-[10px]">Explore new investment opportunities</p>
                </div>
                <ChevRight size={14} className="text-white/70" />
              </div>
            </div>
          </Link>
        )}
      </div>
      )}

      {wizardOpen && (
        <PortfolioWizard onClose={() => setWizardOpen(false)} onCreated={() => { setWizardOpen(false); refetchPortfolios(); }} />
      )}
      <ExitModal open={exitOpen} onClose={() => setExitOpen(false)} holding={selectedHolding} />
      <SellSharesModal open={sellOpen} onClose={() => setSellOpen(false)} holding={selectedHolding} />
      <ReinvestmentSettings open={reinvestOpen} onClose={() => setReinvestOpen(false)} />
      <ShareModal
        open={!!shareHolding}
        onClose={() => setShareHolding(null)}
        title={shareHolding?.farmName ?? ""}
        text={shareHolding ? `🌱 I'm invested in ${shareHolding.farmName} on Investa Farm! ${shareHolding.cropType} · ${shareHolding.location} · Earn up to +22% returns` : ""}
        url="https://app.investafarm.com/portfolio"
      />

      {/* Stock Broker Unlock Popup */}
      {brokerUnlockOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setBrokerUnlockOpen(false); localStorage.setItem("investa_broker_unlocked", "true"); }} />
          <div className="relative bg-white rounded-t-3xl w-full max-w-[430px] overflow-y-auto max-h-[92vh]">
            {/* Step indicators */}
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
                <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                  Your investment portfolio has crossed the <strong>KES 500,000</strong> threshold. You're eligible to manage portfolios and earn broker commissions.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-6 text-left">
                  <p className="text-amber-800 text-xs font-semibold">📊 Total Invested</p>
                  <p className="text-amber-900 font-extrabold text-lg">{formatKES(qualification?.totalInvested ?? 0)}</p>
                </div>
                <button onClick={() => setBrokerUnlockStep(1)}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform">
                  See What You Can Do →
                </button>
              </div>
            )}

            {brokerUnlockStep === 1 && (
              <div className="px-6 pb-8">
                <h2 className="text-foreground font-extrabold text-lg mb-1 mt-2">Stock Broker Benefits</h2>
                <p className="text-muted-foreground text-xs mb-4">As a verified broker you unlock all of these</p>
                <div className="space-y-3 mb-6">
                  {[
                    { icon: "📁", title: "Manage Portfolios", desc: "Create & publish curated farm portfolios for followers to copy" },
                    { icon: "💸", title: "Earn Management Fees", desc: "Charge up to 2% annual fee on AUM from your subscribers" },
                    { icon: "🤝", title: "1% Placement Fees", desc: "Earn on every secondary market trade your followers execute" },
                    { icon: "👥", title: "Build Followers", desc: "Share your broker link — followers see your picks in real-time" },
                    { icon: "📈", title: "Priority Allocation", desc: "Get priority access to new farm listings before general investors" },
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
                  Turn on your broker profile and start creating portfolios that others can follow and invest in.
                </p>
                <button
                  onClick={() => {
                    setBrokerEnabled(true);
                    localStorage.setItem("investa_broker_mode", "true");
                    localStorage.setItem("investa_broker_unlocked", "true");
                    setBrokerUnlockOpen(false);
                    setActiveTab("holdings");
                  }}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform mb-3">
                  🚀 Activate Broker Profile
                </button>
                <button
                  onClick={() => { setBrokerUnlockOpen(false); localStorage.setItem("investa_broker_unlocked", "true"); }}
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
            invested: {
              icon: "💰",
              title: "Total Invested",
              val: formatKES(summary.totalInvested),
              color: "from-emerald-600 to-green-500",
              description: "The total capital you've deployed across all active farm investments. This is your cost basis — the amount you've put in.",
              bullets: [
                `${summary.holdings} active farm ${summary.holdings === 1 ? "position" : "positions"}`,
                "Covers primary market purchases and secondary trades",
                "Does not include pending exit requests",
              ],
            },
            pnl: {
              icon: "📈",
              title: "Today's P&L",
              val: formatKES(summary.todayReturn),
              color: "from-blue-600 to-sky-500",
              description: "Your profit or loss over the last 24 hours based on price movement across all your farm share holdings.",
              bullets: [
                `${formatChange(summary.todayReturnPercent)} change today`,
                `This week: ${formatChange(summary.weekReturnPercent)}`,
                "Updates as market prices change",
              ],
            },
            holdings: {
              icon: "🌾",
              title: "Active Holdings",
              val: String(summary.holdings),
              color: "from-amber-600 to-orange-500",
              description: "Total number of distinct farm investment positions you currently hold. Each holding represents shares in a specific farm listing.",
              bullets: [
                `Portfolio value: ${formatKES(summary.totalValue)}`,
                `Overall return: ${formatChange(summary.overallGainLossPercent)}`,
                "Tap any holding to view details or request exit",
              ],
            },
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
                        <p className="font-extrabold text-2xl mt-0 leading-none text-foreground">{d.val}</p>
                      </div>
                    </div>
                    <button onClick={() => setStatDetail(null)}
                      className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
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

      {/* Portfolio tips */}
      <div className="mx-4 mb-4 bg-primary/5 border border-primary/20 rounded-2xl p-4">
        <p className="text-primary text-xs font-bold mb-2 flex items-center gap-1.5">📊 Portfolio Tips</p>
        <ul className="space-y-1.5">
          <li className="text-muted-foreground text-xs flex items-start gap-1.5"><span className="text-primary mt-0.5 flex-shrink-0">•</span>Hold shares across different crop types to balance seasonal risks.</li>
          <li className="text-muted-foreground text-xs flex items-start gap-1.5"><span className="text-primary mt-0.5 flex-shrink-0">•</span>Reinvest dividends automatically via the Reinvestment Settings.</li>
          <li className="text-muted-foreground text-xs flex items-start gap-1.5"><span className="text-primary mt-0.5 flex-shrink-0">•</span>Monitor farm updates regularly — active farmers post better returns.</li>
          <li className="text-muted-foreground text-xs flex items-start gap-1.5"><span className="text-primary mt-0.5 flex-shrink-0">•</span>Expected returns: <strong className="text-foreground">10–28% annually</strong> depending on crop and season.</li>
        </ul>
      </div>

      <BottomNav role="investor" />
    </div>
  );
}
