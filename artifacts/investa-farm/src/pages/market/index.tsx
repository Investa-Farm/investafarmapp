import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Bell, ChevronRight, TrendingUp, TrendingDown, Newspaper, BookmarkPlus, Clock, Wallet, AlertTriangle, ShieldCheck, Minus, Star, Map, Calculator, BellRing, ExternalLink, ChevronDown, CheckCircle2, X, DollarSign, RefreshCw, Zap, ArrowUpRight } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import {
  useGetTopMovers,
  useListPrimaryMarket,
  useGetMarketSummary,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "@/components/bottom-nav";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { formatChange, getToken, formatKES, isDemoAccount } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestModal } from "@/components/invest-modal";
import { getCropImage, CROP_IMAGES } from "@/lib/crops";
import { CoachMark } from "@/components/coach-mark";
import { NotificationPrompt } from "@/components/notification-prompt";
import { InlineMicBot } from "@/components/ai-assistant";
import { AppTour } from "@/components/app-tour";
import { NewsAiBot } from "@/components/news-ai-bot";
import { NotificationsPanel } from "@/components/notifications-panel";
import { useCurrency } from "@/lib/currency";
import { InvestmentCalculator } from "@/components/investment-calculator";
import { PriceAlertModal } from "@/components/price-alert-modal";
import { motion, AnimatePresence } from "framer-motion";
import { AiSectionBot } from "@/components/ai-section-bot";
import { AiMatchmaker } from "@/components/ai-matchmaker";
import { WalletModal } from "@/components/wallet-modal";

const TICKER_ITEMS = [
  { name: "Maize",     price: "4,200",  unit: "/bag",    change: 2.1,  statement: false },
  { name: "Tomatoes",  price: "120",    unit: "/kg",     change: -1.3, statement: false },
  { name: "Avocado",   price: "18,500", unit: "/100kg",  change: 0.8,  statement: false },
  { name: "Tea",       price: "65",     unit: "/kg",     change: 1.4,  statement: false },
  { name: "Coffee",    price: "680",    unit: "/kg",     change: -0.6, statement: false },
  { name: "Beans",     price: "1,450",  unit: "/kg",     change: 3.2,  statement: false },
  { name: "Wheat",     price: "3,900",  unit: "/bag",    change: 0.5,  statement: false },
  { name: "Potatoes",  price: "2,800",  unit: "/bag",    change: -0.9, statement: false },
  { name: "Onions",    price: "95",     unit: "/kg",     change: 1.8,  statement: false },
  { name: "Rice",      price: "180",    unit: "/kg",     change: 0.3,  statement: false },
  { name: "Sunflower", price: "4,100",  unit: "/bag",    change: -0.4, statement: false },
  { name: "Sorghum",   price: "2,600",  unit: "/bag",    change: 1.1,  statement: false },
];

const MARKET_INSIGHTS = [
  { text: "🔥 Nairobi maize demand surge — prices up 4.2% this week",  statement: true },
  { text: "📊 KES 4.2M invested across 18 farms this month",            statement: true },
  { text: "🌾 Long rains forecast — tea & coffee yields projected high", statement: true },
  { text: "💰 Top performers: Avocado +22%, Coffee +18% ROI",           statement: true },
  { text: "⚡ 3 new farm listings added — invest before shares run out", statement: true },
  { text: "🌍 Kenya agri exports up 8% YoY — strong investor outlook",  statement: true },
  { text: "☀️ Optimal planting season begins — book your shares now",   statement: true },
];

function getNewsImage(item: { imageKey?: string; tag?: string; title?: string }): string {
  if (item.imageKey && (CROP_IMAGES as Record<string, string>)[item.imageKey]) {
    return (CROP_IMAGES as Record<string, string>)[item.imageKey];
  }
  const t = (item.title ?? "").toLowerCase();
  if (t.includes("avocado")) return CROP_IMAGES.avocado;
  if (t.includes("maize") || t.includes("corn")) return CROP_IMAGES.maize;
  if (t.includes("coffee")) return CROP_IMAGES.coffee;
  if (t.includes("tea")) return CROP_IMAGES.tea;
  if (t.includes("wheat")) return CROP_IMAGES.wheat;
  if (t.includes("bean")) return CROP_IMAGES.beans;
  if (t.includes("tomato")) return CROP_IMAGES.tomatoes;
  if (t.includes("sunflower")) return CROP_IMAGES.sunflower;
  if (item.tag === "Returns") return CROP_IMAGES.coffee;
  return CROP_IMAGES.maize;
}

const WATCHLIST_CROPS = [
  {
    id: 1,
    name: "Maize",
    season: "Long Rains 2026",
    plantingStart: "Mar 2026",
    harvestEst: "Aug 2026",
    expectedReturn: "+18%",
    image: CROP_IMAGES.maize,
    demand: "High",
    demandColor: "text-green-600 bg-green-50",
    farms: 12,
    change: 2.1,
  },
  {
    id: 2,
    name: "Coffee",
    season: "Main Crop 2026",
    plantingStart: "Apr 2026",
    harvestEst: "Nov 2026",
    expectedReturn: "+24%",
    image: CROP_IMAGES.coffee,
    demand: "Very High",
    demandColor: "text-emerald-600 bg-emerald-50",
    farms: 8,
    change: -0.6,
  },
  {
    id: 3,
    name: "Avocado",
    season: "Hass 2026",
    plantingStart: "May 2026",
    harvestEst: "Dec 2026",
    expectedReturn: "+22%",
    image: CROP_IMAGES.avocado,
    demand: "High",
    demandColor: "text-green-600 bg-green-50",
    farms: 6,
    change: 0.8,
  },
  {
    id: 4,
    name: "Tea",
    season: "Long Rains 2026",
    plantingStart: "Mar 2026",
    harvestEst: "Jul 2026",
    expectedReturn: "+16%",
    image: CROP_IMAGES.tea,
    demand: "Moderate",
    demandColor: "text-primary bg-primary/5",
    farms: 15,
    change: 1.4,
  },
];

type Listing = {
  id: number; farmId: number; farmName: string; cropType: string;
  location: string; pricePerShare: number; sharesAvailable: number;
  changePercent: number; imageUrl?: string; tradeCount?: number;
};

type RiskLevel = "Low" | "Moderate" | "High";

const HIGH_RISK_CROPS = new Set(["coffee", "avocado", "tobacco", "horticulture"]);
const MOD_RISK_CROPS  = new Set(["tea", "wheat", "tomatoes", "potatoes", "onions"]);

function getRiskLevel(cropType: string, changePercent: number): RiskLevel {
  const crop = cropType?.toLowerCase() ?? "";
  if (HIGH_RISK_CROPS.has(crop) || Math.abs(changePercent) > 5) return "High";
  if (MOD_RISK_CROPS.has(crop) || Math.abs(changePercent) > 2) return "Moderate";
  return "Low";
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const bars = level === "High" ? 5 : level === "Moderate" ? 3 : 2;
  const barColor = level === "High" ? "#ef4444" : level === "Moderate" ? "#f59e0b" : "#16a34a";
  const textClass = level === "High" ? "text-red-600" : level === "Moderate" ? "text-amber-600" : "text-green-700";
  return (
    <span className={`inline-flex items-center gap-1 ${textClass}`}>
      <span className="flex gap-[2px] items-end">
        {[1,2,3,4,5].map(i => (
          <span key={i} className="w-[3px] rounded-[1px] flex-shrink-0"
            style={{ height: 3 + i * 1.5, background: i <= bars ? barColor : "rgba(0,0,0,0.12)" }} />
        ))}
      </span>
      <span className="text-[9px] font-bold">{level}</span>
    </span>
  );
}

export default function MarketHome() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    setRefreshing(true);
    qc.invalidateQueries({ queryKey: ["primary-market"] });
    qc.invalidateQueries({ queryKey: ["market-movers"] });
    qc.invalidateQueries({ queryKey: ["market-decliners"] });
    qc.invalidateQueries({ queryKey: ["market-summary"] });
    setTimeout(() => setRefreshing(false), 1500);
  };
  const { data: movers, isLoading: moversLoading } = useGetTopMovers();
  const { data: listings, isLoading: listingsLoading } = useListPrimaryMarket();
  const { data: decliners, isLoading: declinersLoading } = useQuery<any[]>({
    queryKey: ["market-decliners"],
    queryFn: async () => {
      const r = await fetch("/api/market/decliners");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
  const { data: summary } = useGetMarketSummary();
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [investOpen, setInvestOpen] = useState(false);
  const [watchlisted, setWatchlisted] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("investa_watchlist") ?? "[]") as number[]); } catch { return new Set(); }
  });
  const [activeSection, setActiveSection] = useState<"market" | "news" | "watchlist">(() => {
    const saved = localStorage.getItem("investa_market_tab");
    return (saved === "market" || saved === "news" || saved === "watchlist") ? saved : "market";
  });
  const setActiveSectionPersist = (s: "market" | "news" | "watchlist") => {
    setActiveSection(s);
    localStorage.setItem("investa_market_tab", s);
  };
  const [committed, setCommitted] = useState<Record<number, number>>(() => {
    try { return JSON.parse(localStorage.getItem("investa_watchlist_commits") ?? "{}") ?? {}; } catch { return {}; }
  });
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitCrop, setCommitCrop] = useState<typeof WATCHLIST_CROPS[0] | null>(null);
  const [commitInput, setCommitInput] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState<string | undefined>(undefined);
  const [calcOpen, setCalcOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [matcherOpen, setMatcherOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [statModal, setStatModal] = useState<"turnover" | "return" | "listings" | null>(null);
  const [calcListing, setCalcListing] = useState<any>(null);
  const [alertListing, setAlertListing] = useState<any>(null);
  const token = getToken();
  const { formatAmount } = useCurrency();

  const [expandedNews, setExpandedNews] = useState<number | null>(null);

  // Combined movers/decliners tab
  const [moverTab, setMoverTab] = useState<"movers" | "decliners">("movers");
  const [moverSlide, setMoverSlide] = useState(0);
  const moverTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    moverTimer.current = setInterval(() => setMoverSlide(s => s + 1), 30000);
    return () => { if (moverTimer.current) clearInterval(moverTimer.current); };
  }, []);

  // Featured listings animated cycling (2 visible at a time)
  const [featIdx, setFeatIdx] = useState(0);
  const featTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!listings || listings.length <= 2) return;
    featTimer.current = setInterval(() => setFeatIdx(i => i + 1), 45000);
    return () => { if (featTimer.current) clearInterval(featTimer.current); };
  }, [listings?.length]);

  const { data: newsItems, isLoading: newsLoading } = useQuery<any[]>({
    queryKey: ["news"],
    queryFn: async () => {
      const r = await fetch("/api/news");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: walletData } = useQuery<{ wallet: { balance: string } }>({
    queryKey: ["wallet-balance"],
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const walletBalance = walletData?.wallet?.balance;
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;
  // Build rich ticker: interleave commodity prices with market insights
  const tickerItems = (() => {
    const result: Array<{ type: "price"; name: string; price: string; unit: string; change: number } | { type: "insight"; text: string }> = [];
    const prices = TICKER_ITEMS.map(t => ({ type: "price" as const, ...t }));
    const insights = MARKET_INSIGHTS.map(i => ({ type: "insight" as const, ...i }));
    for (let i = 0; i < prices.length; i++) {
      result.push(prices[i]);
      if (i % 3 === 2 && insights[Math.floor(i / 3)]) result.push(insights[Math.floor(i / 3)]);
    }
    return [...result, ...result]; // double for seamless loop
  })();

  const handleBuyClick = (e: React.MouseEvent, listing: Listing) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedListing(listing); setInvestOpen(true);
  };

  const STAT_DETAILS = {
    turnover: {
      title: "24h Market Turnover",
      icon: "💰",
      val: formatAmount(summary?.totalVolumeKes ?? 0),
      color: "from-emerald-600 to-green-500",
      description: "Total KES traded across all farm listings in the last 24 hours. Includes primary market purchases, secondary market trades, and exit redemptions.",
      bullets: [
        "High turnover signals strong investor demand",
        "Calculated across all active listings",
        "Updated in real-time as trades execute",
      ],
    },
    return: {
      title: "Average Return",
      icon: "📈",
      val: `+${summary?.averageReturn ?? "0"}%`,
      color: "from-blue-600 to-sky-500",
      description: "Weighted average projected annual return across all active farm listings. Powered by AI harvest forecast models that factor in crop type, season length, and regional data.",
      bullets: [
        "Based on AI-driven revenue forecasting",
        "Weighted by total listing value",
        "Includes dividend + capital appreciation",
      ],
    },
    listings: {
      title: "Active Listings",
      icon: "🌾",
      val: String(summary?.totalListings ?? 0),
      color: "from-amber-600 to-orange-500",
      description: "Number of active farm investment listings currently open for purchase. Spans primary market (new issues from farmers) and secondary market (investor resale shares).",
      bullets: [
        "Primary: new farm season shares",
        "Secondary: investor-to-investor resale",
        "Listings close when fully subscribed",
      ],
    },
  } as const;

  return (
    <div className="app-shell pb-20 page-enter" data-testid="market-home">
      {/* Market Header */}
      <div className="relative overflow-hidden pt-12 pb-0 px-5 border-b border-border bg-background" data-tour="market-header">
        {/* Subtle dot grid decoration */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #16a34a 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="absolute -top-12 -right-8 w-36 h-36 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-primary/5 blur-2xl" />

        <div className="relative flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto" />
              <span className="inline-flex items-center gap-1 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-700 text-[9px] font-bold uppercase tracking-wider">Live</span>
              </span>
            </div>
            <h1 className="text-foreground text-xl font-bold flex items-center gap-1.5">
              Live Market <TrendingUp size={16} className="text-primary" />
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Wallet — tap to top up */}
            <button
              data-tour="wallet-btn"
              onClick={() => setWalletOpen(true)}
              className="flex items-center gap-1.5 bg-primary text-white rounded-full px-3 py-1.5 shadow-sm shadow-primary/30 active:scale-95 transition-transform"
            >
              <Wallet size={12} className="text-white" />
              <span className="text-white text-xs font-bold">{walletBalance !== undefined ? formatAmount(parseFloat(walletBalance ?? "0")) : "Wallet"}</span>
              <ArrowUpRight size={11} className="text-white/80" />
            </button>
            <button onClick={handleRefresh}
              className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-border shadow-sm"
              title="Refresh market">
              <RefreshCw size={14} className={`text-foreground ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setLocation("/market/map")}
              className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-border shadow-sm"
              title="Farm Map">
              <Map size={15} className="text-foreground" />
            </button>
            <button onClick={() => setNotifOpen(true)}
              className="w-8 h-8 rounded-full bg-card flex items-center justify-center relative border border-border shadow-sm">
              <Bell size={15} className="text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[7px] text-white font-bold flex items-center justify-center">
                  {Math.min(unreadCount, 9)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Market stats inline strip */}
        {summary && (
          <div className="flex items-stretch gap-2 mb-3">
            {(["turnover", "return", "listings"] as const).map((key, i) => {
              const d = STAT_DETAILS[key];
              return (
                <button key={key} onClick={() => setStatModal(key)}
                  className="flex-1 flex items-center gap-2 bg-card rounded-xl px-2.5 py-2 border border-border shadow-sm active:scale-95 transition-transform hover:border-primary/20 group">
                  <span className="text-base leading-none">{d.icon}</span>
                  <div className="min-w-0 text-left">
                    <p className={`font-extrabold text-xs leading-tight ${key === "return" ? "text-green-600" : "text-foreground"}`}>{d.val}</p>
                    <p className="text-muted-foreground text-[9px] leading-tight">{key === "turnover" ? "Turnover" : key === "return" ? "Avg Return" : "Listings"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Ticker — rich with KES commodity prices + market insights */}
        <div className="relative overflow-hidden rounded-xl mb-0 border-t border-border" style={{ background: "rgba(0,0,0,0.03)" }}>
          <div className="flex ticker-track whitespace-nowrap py-2">
            {tickerItems.map((item, i) => (
              item.type === "price" ? (
                <span key={i} className="inline-flex items-center gap-1 px-3.5 text-xs flex-shrink-0">
                  <span className="font-bold text-foreground/90">{item.name}</span>
                  <span className="text-muted-foreground text-[10px]">KES {item.price}{item.unit}</span>
                  <span className={`font-bold text-[10px] ${item.change >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {item.change >= 0 ? "▲" : "▼"}{Math.abs(item.change)}%
                  </span>
                  <span className="text-border/50 ml-1 text-[10px]">·</span>
                </span>
              ) : (
                <span key={i} className="inline-flex items-center px-4 text-[10px] font-medium text-amber-700 bg-amber-50/60 border-l border-r border-amber-200/50 flex-shrink-0">
                  {item.text}
                  <span className="text-border/50 ml-3 text-[10px]">·</span>
                </span>
              )
            ))}
          </div>
        </div>
      </div>

      {/* Stat detail bottom sheet */}
      <AnimatePresence>
        {statModal && (() => {
          const d = STAT_DETAILS[statModal];
          return (
            <motion.div className="fixed inset-0 z-50 flex items-end"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setStatModal(null)} />
              <motion.div className="relative w-full bg-card rounded-t-3xl overflow-hidden shadow-2xl"
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}>
                {/* gradient top bar */}
                <div className={`h-1.5 bg-gradient-to-r ${d.color}`} />
                <div className="px-5 pt-4 pb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${d.color} flex items-center justify-center shadow-sm`}>
                        <span className="text-xl">{d.icon}</span>
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-base">{d.title}</p>
                        <p className={`font-extrabold text-2xl mt-0 leading-none ${statModal === "return" ? "text-green-600" : "text-foreground"}`}>{d.val}</p>
                      </div>
                    </div>
                    <button onClick={() => setStatModal(null)}
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

      {/* Section tabs */}
      <div className="px-4 pt-3">
        <div className="flex bg-muted rounded-2xl p-1 gap-1">
          {(["market", "news", "watchlist"] as const).map(s => (
            <button key={s} onClick={() => setActiveSectionPersist(s)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${activeSection === s ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {s === "watchlist" ? "Watchlist" : s === "news" ? "📰 News" : "📊 Market"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {activeSection === "market" && (
          <>
            {/* Top Movers / Decliners — combined section */}
            <section>
              {/* Market type labels */}
              <div className="flex items-center gap-2 mb-2">
                <Link href="/market/primary">
                  <span className="inline-flex items-center gap-1 bg-green-600/10 border border-green-600/20 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full active:scale-95 transition-transform">
                    <TrendingUp size={9} /> Primary Market
                  </span>
                </Link>
                <Link href="/market/secondary">
                  <span className="inline-flex items-center gap-1 bg-amber-600/10 border border-amber-600/20 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full active:scale-95 transition-transform">
                    <TrendingDown size={9} /> Secondary Market
                  </span>
                </Link>
              </div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  {moverTab === "movers"
                    ? <TrendingUp size={13} className="text-green-600" />
                    : <TrendingDown size={13} className="text-red-500" />}
                  {moverTab === "movers" ? "Top Gainers" : "Top Decliners"}
                  <AiSectionBot context="What are 'top movers' and 'top decliners' in the Investa Farm market? Why do farm share prices change, and what should an investor look for?" label="movers & decliners" />
                  <InlineMicBot section="market" role="investor" />
                </h2>
                <div className="flex items-center gap-1.5">
                  <div className="flex bg-muted rounded-full p-0.5 gap-0.5">
                    <button
                      onClick={() => { setMoverTab("movers"); setMoverSlide(0); }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${moverTab === "movers" ? "bg-green-600 text-white shadow-sm" : "text-muted-foreground"}`}
                    >
                      <TrendingUp size={9} /> Gainers
                    </button>
                    <button
                      onClick={() => { setMoverTab("decliners"); setMoverSlide(0); }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${moverTab === "decliners" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground"}`}
                    >
                      <TrendingDown size={9} /> Decliners
                    </button>
                  </div>
                  <Link href="/market/primary">
                    <span className="text-primary text-xs font-medium flex items-center gap-0.5">
                      All <ChevronRight size={13} />
                    </span>
                  </Link>
                </div>
              </div>
              {(() => {
                const isMovers = moverTab === "movers";
                const rawData = isMovers
                  ? (movers ?? [])
                  : (decliners ?? []).filter((d: any) => d.changePercent <= 0);
                const isLoading = isMovers ? moversLoading : declinersLoading;
                const pageCount = Math.max(1, Math.ceil(rawData.length / 2));
                const page = moverSlide % pageCount;
                const pageData = rawData.slice(page * 2, page * 2 + 2);
                const accentColor = isMovers ? "#16a34a" : "#ef4444";

                if (isLoading) return (
                  <div className="grid grid-cols-2 gap-3">
                    {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
                  </div>
                );
                if (rawData.length === 0) return (
                  <div className="bg-muted/40 border border-border rounded-2xl px-4 py-3 text-center">
                    <p className="text-muted-foreground text-xs">
                      {isMovers ? "No movers data yet" : "All farms up today 🌟"}
                    </p>
                  </div>
                );
                return (
                  <div className="overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`${moverTab}-${page}`}
                        initial={{ opacity: 0, x: isMovers ? 30 : -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: isMovers ? -30 : 30 }}
                        transition={{ duration: 0.32 }}
                        className="grid grid-cols-2 gap-3"
                      >
                        {pageData.map((item: any) => {
                          const risk = getRiskLevel(item.cropType ?? "", item.changePercent);
                          return (
                            <Link key={item.farmId} href={`/market/exchange/${item.farmId}`}>
                              <div className="rounded-2xl overflow-hidden relative cursor-pointer active:scale-95 transition-transform shadow-md">
                                <img src={getCropImage(item.cropType ?? "", item.imageUrl ?? undefined)} alt={item.farmName} className="w-full h-24 object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3 flex flex-col justify-end">
                                  <p className="text-white text-xs font-bold leading-tight">{item.farmName}</p>
                                  <p className="text-white/70 text-[9px]">{item.cropType} · {formatAmount(item.currentPrice)}</p>
                                  <div className="flex items-center justify-between mt-1">
                                    <div className="flex items-center gap-1">
                                      {isMovers
                                        ? <TrendingUp size={9} className="text-green-300" />
                                        : <TrendingDown size={9} className="text-red-300" />}
                                      <span className={`text-[10px] font-bold ${isMovers ? "text-green-300" : "text-red-300"}`}>
                                        {formatChange(item.changePercent)}
                                      </span>
                                    </div>
                                    <RiskBadge level={risk} />
                                  </div>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>
                    {rawData.length > 2 && (
                      <div className="flex justify-center gap-1 mt-2">
                        {Array(pageCount).fill(0).map((_, i) => (
                          <button key={i} onClick={() => setMoverSlide(i)}
                            className={`h-1 rounded-full transition-all ${i === page ? "w-4" : "w-1.5 bg-muted"}`}
                            style={i === page ? { width: 16, background: accentColor } : {}} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>

            {/* Market type links — image cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/market/primary">
                <div className="rounded-2xl overflow-hidden relative h-24 cursor-pointer active:scale-95 transition-transform shadow-lg shadow-green-600/20">
                  <img src={getCropImage("maize")} alt="Primary Market" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-green-800/70 to-green-950/60 p-3 flex flex-col justify-between">
                    <span className="text-white/80 text-[8px] font-bold uppercase tracking-widest bg-white/10 self-start px-1.5 py-0.5 rounded-full">New Issue</span>
                    <div>
                      <p className="text-white font-extrabold text-sm leading-tight">Primary Market</p>
                      <p className="text-white/70 text-[10px]">Buy direct from farms</p>
                    </div>
                  </div>
                </div>
              </Link>
              <Link href="/market/secondary">
                <div className="rounded-2xl overflow-hidden relative h-24 cursor-pointer active:scale-95 transition-transform shadow-lg shadow-amber-600/20">
                  <img src={getCropImage("coffee")} alt="Secondary Market" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-800/85 via-amber-900/70 to-amber-950/60 p-3 flex flex-col justify-between">
                    <span className="text-white/80 text-[8px] font-bold uppercase tracking-widest bg-white/10 self-start px-1.5 py-0.5 rounded-full">Resale</span>
                    <div>
                      <p className="text-white font-extrabold text-sm leading-tight">Secondary Market</p>
                      <p className="text-white/70 text-[10px]">Trade between investors</p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>

            {/* Featured Listings — 2 visible, climbing animation */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  <Star size={13} className="text-amber-500 fill-amber-400" />
                  Featured Listings
                  <InlineMicBot section="listings" role="investor" />
                </h2>
                {listings && listings.length > 0 && (
                  <Link href="/market/primary">
                    <span className="text-primary text-xs font-medium flex items-center gap-0.5">
                      View All ({listings.length}) <ChevronRight size={13} />
                    </span>
                  </Link>
                )}
              </div>
              <div className="space-y-3 overflow-hidden">
                {listingsLoading
                  ? Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
                  : !listings || listings.length === 0
                    ? (
                      <div className="text-center py-10 bg-muted/30 rounded-2xl border border-border">
                        <TrendingUp size={28} className="text-muted-foreground mx-auto mb-2" />
                        <p className="text-foreground font-semibold text-sm">No listings yet</p>
                        <p className="text-muted-foreground text-xs mt-1">Farms will appear here as farmers list them</p>
                      </div>
                    )
                    : (() => {
                        const total = listings.length;
                        const featListings = [
                          listings[featIdx % total],
                          ...(total > 1 ? [listings[(featIdx + 1) % total]] : []),
                        ];
                        return (
                          <AnimatePresence mode="popLayout" initial={false}>
                            {featListings.map((listing: any, idx: number) => {
                              const sparkData = generateSparkData(listing.pricePerShare, 12, listing.changePercent / 100);
                              const isUp = listing.changePercent >= 0;
                              const imgSrc = getCropImage(listing.cropType, listing.imageUrl ?? undefined);
                              const risk = getRiskLevel(listing.cropType, listing.changePercent);
                              const isFeatured = idx === 0;
                              return (
                                <motion.div
                                  key={listing.id}
                                  layout
                                  initial={{ opacity: 0, y: 56 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -48, scale: 0.97 }}
                                  transition={{ duration: 0.42, ease: "easeInOut", layout: { duration: 0.4, ease: "easeInOut" } }}
                                >
                                  <Link href={`/market/exchange/${listing.farmId}`}>
                                    <div className={`rounded-2xl border overflow-hidden cursor-pointer active:scale-[0.98] transition-all ${isFeatured ? "border-primary/30 shadow-lg shadow-green-600/15" : "border-border bg-card shadow-sm shadow-green-500/10"}`}>
                                      {isFeatured && (
                                        <div className="bg-gradient-to-r from-primary/90 to-green-600 px-4 py-1.5 flex items-center gap-1.5">
                                          <Star size={10} className="text-white fill-white" />
                                          <span className="text-white text-[9px] font-bold uppercase tracking-wider">Featured Listing</span>
                                        </div>
                                      )}
                                      <div className={`flex items-center gap-3 p-3 ${isFeatured ? "bg-primary/5" : "bg-card"}`}>
                                        <div className="relative flex-shrink-0">
                                          <img src={imgSrc} alt={listing.farmName} className="w-14 h-14 rounded-xl object-cover" />
                                          <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${isUp ? "bg-green-500" : "bg-red-500"}`}>
                                            {isUp ? <TrendingUp size={9} className="text-white" /> : <TrendingDown size={9} className="text-white" />}
                                          </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-foreground text-sm font-bold leading-tight truncate">{listing.farmName}</p>
                                          <p className="text-muted-foreground text-[11px] mt-0.5 truncate">{listing.cropType} · {listing.location}</p>
                                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                            <span className={`text-[10px] font-bold ${isUp ? "text-green-600" : "text-red-500"}`}>
                                              {formatChange(listing.changePercent)}
                                            </span>
                                            <span className="text-muted-foreground/40 text-[10px]">·</span>
                                            <RiskBadge level={risk} />
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                          <div className="w-16">
                                            <Sparkline data={sparkData} color={isUp ? "#16a34a" : "#dc2626"} height={28} />
                                          </div>
                                          <p className="text-foreground text-sm font-bold">{formatAmount(listing.pricePerShare)}</p>
                                          <div className="flex items-center gap-1">
                                            <button
                                              title="Investment Calculator"
                                              className="w-6 h-6 rounded-lg bg-muted border border-border flex items-center justify-center active:scale-95 transition-transform"
                                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCalcListing(listing); setCalcOpen(true); }}
                                            >
                                              <Calculator size={11} className="text-muted-foreground" />
                                            </button>
                                            <button
                                              title="Price Alert"
                                              className="w-6 h-6 rounded-lg bg-muted border border-border flex items-center justify-center active:scale-95 transition-transform"
                                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAlertListing(listing); setAlertOpen(true); }}
                                            >
                                              <BellRing size={11} className="text-muted-foreground" />
                                            </button>
                                            <button
                                              className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform shadow-sm shadow-primary/30"
                                              onClick={(e) => handleBuyClick(e, listing as Listing)}
                                            >
                                              BUY
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                      {listing.sharesAvailable < 50 && (
                                        <div className="bg-amber-50 border-t border-amber-200 px-4 py-1.5">
                                          <p className="text-amber-700 text-[9px] font-semibold">⚡ Only {listing.sharesAvailable} shares remaining</p>
                                        </div>
                                      )}
                                    </div>
                                  </Link>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        );
                      })()}
              </div>
            </section>

            {/* Investment Ad Cards — horizontal side-by-side */}
            <section>
              <div className="grid grid-cols-2 gap-3">
                {/* Gold card — avocado */}
                <Link href="/market/primary">
                  <div className="rounded-2xl overflow-hidden relative h-52 cursor-pointer active:scale-95 transition-transform shadow-md"
                    style={{ background: "linear-gradient(160deg, #78350f 0%, #b45309 50%, #fbbf24 100%)" }}>
                    <img src={getCropImage("avocado")} alt="Avocado"
                      className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity" />
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
                    <div className="relative h-full flex flex-col justify-between p-3">
                      <div>
                        <span className="text-yellow-100 text-[8px] font-bold uppercase tracking-widest bg-yellow-600/40 px-1.5 py-0.5 rounded-full">Premium</span>
                        <p className="text-white font-extrabold text-sm leading-tight mt-1.5">Avocado Export Season</p>
                        <p className="text-yellow-100/70 text-[10px] mt-0.5">Kiambu · EU demand</p>
                      </div>
                      <div>
                        <p className="text-yellow-300 font-black text-2xl leading-none">+22%</p>
                        <p className="text-yellow-100/60 text-[9px]">projected ROI</p>
                        <div className="mt-2 bg-white text-amber-700 font-bold text-[10px] py-1.5 rounded-lg text-center flex items-center justify-center gap-1">
                          <Zap size={10} /> Invest Now
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Green card — maize */}
                <Link href="/market/primary">
                  <div className="rounded-2xl overflow-hidden relative h-52 cursor-pointer active:scale-95 transition-transform shadow-md"
                    style={{ background: "linear-gradient(160deg, #052e16 0%, #14532d 50%, #16a34a 100%)" }}>
                    <img src={getCropImage("maize")} alt="Maize"
                      className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-luminosity" />
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
                    <div className="relative h-full flex flex-col justify-between p-3">
                      <div>
                        <span className="text-green-200 text-[8px] font-bold uppercase tracking-widest bg-green-600/30 px-1.5 py-0.5 rounded-full">Low Risk</span>
                        <p className="text-white font-extrabold text-sm leading-tight mt-1.5">Maize Long Rains</p>
                        <p className="text-green-200/70 text-[10px] mt-0.5">Nakuru · Rift Valley</p>
                      </div>
                      <div>
                        <p className="text-green-300 font-black text-2xl leading-none">+14%</p>
                        <p className="text-green-200/60 text-[9px]">target return</p>
                        <div className="mt-2 bg-white text-primary font-bold text-[10px] py-1.5 rounded-lg text-center flex items-center justify-center gap-1">
                          🌽 Invest Now
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>

              {/* Community portfolio banner */}
              <Link href="/market/portfolios">
                <div className="mt-3 bg-muted/50 border border-border rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-all">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Star size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-bold text-sm">Community Portfolios</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Copy AI-built portfolios from top investors</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                </div>
              </Link>
            </section>
          </>
        )}

        {activeSection === "news" && (
          <section className="space-y-3">
            {/* News header */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#052e16,#166534,#16a34a)" }}>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Newspaper size={14} className="text-green-300" />
                    <span className="text-green-300 text-[10px] font-bold uppercase tracking-widest">Agriculture News</span>
                  </div>
                  <h2 className="text-white font-bold text-base leading-tight">Kenya Agri Market</h2>
                  <p className="text-white/60 text-xs mt-0.5">Prices, weather & investment insights</p>
                </div>
                <span className="flex items-center gap-1.5 bg-green-500/20 border border-green-400/30 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-300 text-[10px] font-bold">Live</span>
                </span>
              </div>
            </div>

            {newsLoading
              ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)
              : (newsItems ?? []).map((item: any, idx: number) => {
                  const isExpanded = expandedNews === item.id;
                  const isFeatured = idx === 0;
                  return (
                    <div
                      key={item.id}
                      className={`bg-card rounded-2xl border overflow-hidden transition-all ${isFeatured ? "border-primary/30 shadow-md shadow-green-500/10" : "border-border shadow-sm"}`}
                    >
                      {/* Thumbnail */}
                      <div className="relative">
                        <img src={getNewsImage(item)} alt={item.title} className={`w-full object-cover ${isFeatured ? "h-44" : "h-28"}`} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                        {isFeatured && (
                          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
                        )}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          {isFeatured && (
                            <span className="bg-primary text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Featured</span>
                          )}
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.tagColor || "bg-green-100 text-green-700"}`}>
                            {item.tag}
                          </span>
                        </div>
                        {isFeatured && (
                          <div className="absolute bottom-3 left-3 right-3">
                            <p className="text-white font-bold text-sm leading-snug drop-shadow-sm line-clamp-2">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-white/70 text-[10px] flex items-center gap-1">
                                <Clock size={9} /> {item.time}
                              </span>
                              <span className="text-white/60 text-[10px]">· {item.source}</span>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2">
                          <NewsAiBot item={item} />
                        </div>
                      </div>

                      {/* Content */}
                      <button
                        className="w-full text-left px-3.5 py-3 active:bg-muted/30 transition-colors"
                        onClick={() => setExpandedNews(isExpanded ? null : item.id)}
                      >
                        {!isFeatured && (
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-muted-foreground text-[10px] flex items-center gap-1">
                              <Clock size={9} /> {item.time}
                            </span>
                            <span className="text-primary/60 text-[10px] font-medium truncate">{item.source}</span>
                          </div>
                        )}
                        {!isFeatured && (
                          <p className="text-foreground font-semibold text-sm leading-snug">{item.title}</p>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <p className={`text-muted-foreground text-xs line-clamp-1 flex-1 ${isFeatured ? "mt-0" : ""}`}>
                            {item.summary?.slice(0, 80)}{item.summary?.length > 80 ? "…" : ""}
                          </p>
                          <ChevronDown
                            size={13}
                            className={`ml-2 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </button>

                      {/* Expanded body */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3.5 pb-3.5 pt-0 border-t border-border space-y-3">
                              <p className="text-muted-foreground text-sm leading-relaxed mt-3">{item.summary}</p>
                              <div className="flex items-center gap-2">
                                {item.url && item.url !== "#" && (
                                  <button
                                    onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                                    className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors active:scale-95"
                                  >
                                    Read full story <ExternalLink size={11} />
                                  </button>
                                )}
                                <span className="flex-1" />
                                <NewsAiBot item={item} />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
            <div className="bg-muted/40 border border-border rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Newspaper size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-foreground font-semibold text-xs">Kenya Agri-Market News</p>
                <p className="text-muted-foreground text-[10px] mt-0.5">Sourced from online agriculture feeds · refreshed every 30 min</p>
              </div>
            </div>
          </section>
        )}

        {activeSection === "watchlist" && (
          <section className="space-y-3">
            {/* Watchlist header */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #16a34a 100%)" }}>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-green-300 text-[10px] font-bold uppercase tracking-widest mb-0.5">🌱 Season Watchlist</p>
                  <h2 className="text-white font-bold text-base leading-tight">Upcoming Crop Seasons</h2>
                  <p className="text-white/60 text-xs mt-0.5">Save crops &amp; commit funds early</p>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-[10px]">Bookmarked</p>
                  <p className="text-green-300 font-bold text-sm">{watchlisted.size} crops</p>
                  {Object.values(committed).reduce((a, b) => a + b, 0) > 0 && (
                    <>
                      <p className="text-white/50 text-[9px] mt-1">Committed</p>
                      <p className="text-green-400 font-bold text-xs">{formatKES(Object.values(committed).reduce((a, b) => a + b, 0))}</p>
                    </>
                  )}
                </div>
              </div>
              {watchlisted.size === 0 && (
                <div className="px-4 pb-3 flex items-center gap-2">
                  <span className="text-white/50 text-[11px]">👆 Tap the bookmark on any crop below to track it</span>
                </div>
              )}
            </div>

            {/* All upcoming crop seasons — always visible */}
            {WATCHLIST_CROPS.map(crop => {
              const isWatchlisted = watchlisted.has(crop.id);
              return (
                <div key={crop.id} className={`bg-card rounded-2xl border overflow-hidden transition-all ${isWatchlisted ? "border-primary/40 shadow-md shadow-green-500/10" : "border-border"}`}>
                  <div className="relative h-28">
                    <img src={crop.image} alt={crop.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/75 to-black/30" />
                    {isWatchlisted && (
                      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-primary via-green-400 to-primary" />
                    )}
                    <div className="absolute inset-0 p-3 flex flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-white font-bold text-base">{crop.name}</p>
                            {isWatchlisted && (
                              <span className="bg-primary/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">Watching</span>
                            )}
                          </div>
                          <p className="text-white/70 text-[11px]">{crop.season}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white/60 text-[9px]">Est. Return</p>
                          <p className="text-green-400 font-bold text-base">{crop.expectedReturn}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${crop.demandColor}`}>{crop.demand} Demand</span>
                        <span className="text-white/60 text-[9px]">{crop.farms} farms</span>
                        <RiskBadge level={getRiskLevel(crop.name, crop.change)} />
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-muted/50 rounded-xl p-2 text-center">
                        <p className="text-muted-foreground text-[8px] uppercase font-semibold">Planting</p>
                        <p className="text-foreground font-bold text-[10px] mt-0.5">{crop.plantingStart}</p>
                      </div>
                      <div className="bg-muted/50 rounded-xl p-2 text-center">
                        <p className="text-muted-foreground text-[8px] uppercase font-semibold">Harvest</p>
                        <p className="text-foreground font-bold text-[10px] mt-0.5">{crop.harvestEst}</p>
                      </div>
                      <div className="bg-green-50 border border-green-100 rounded-xl p-2 text-center">
                        <p className="text-muted-foreground text-[8px] uppercase font-semibold">Return</p>
                        <p className="text-green-700 font-bold text-[10px] mt-0.5">{crop.expectedReturn}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setWatchlisted(s => {
                            const n = new Set(s);
                            n.has(crop.id) ? n.delete(crop.id) : n.add(crop.id);
                            try { localStorage.setItem("investa_watchlist", JSON.stringify([...n])); } catch {}
                            return n;
                          });
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${isWatchlisted ? "bg-primary border-primary text-white" : "border-border text-foreground"}`}>
                        <BookmarkPlus size={13} />
                        {isWatchlisted ? "Watching" : "Watch"}
                      </button>
                      {committed[crop.id] ? (
                        <button
                          onClick={() => { setCommitCrop(crop); setCommitInput(String(committed[crop.id])); setCommitOpen(true); }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white text-xs font-semibold py-2.5 rounded-xl active:scale-95 transition-transform">
                          <CheckCircle2 size={13} />
                          {formatKES(committed[crop.id])} committed
                        </button>
                      ) : (
                        <button
                          onClick={() => { setCommitCrop(crop); setCommitInput(""); setCommitOpen(true); }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-foreground text-background text-xs font-semibold py-2.5 rounded-xl active:scale-95 transition-transform">
                          <DollarSign size={13} />
                          Commit Funds
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-xl flex-shrink-0">💡</span>
              <div>
                <p className="text-green-800 font-semibold text-xs mb-1">Early Investor Advantage</p>
                <p className="text-green-700 text-xs leading-relaxed">
                  Investing at planting stage locks in better share prices before demand rises. Committed funds are reserved — no charges until the listing goes live.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Commit Funds Bottom Sheet */}
      <AnimatePresence>
        {commitOpen && commitCrop && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setCommitOpen(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 inset-x-0 z-50 max-w-[430px] mx-auto bg-card rounded-t-3xl shadow-xl px-5 pt-5 pb-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-foreground">Commit Funds</p>
                  <p className="text-muted-foreground text-xs">{commitCrop.name} · {commitCrop.season}</p>
                </div>
                <button onClick={() => setCommitOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>
              {/* Crop preview */}
              <div className="relative h-24 rounded-2xl overflow-hidden mb-4">
                <img src={commitCrop.image} alt={commitCrop.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30 flex items-center p-4">
                  <div>
                    <p className="text-white font-bold">{commitCrop.name}</p>
                    <p className="text-green-400 text-sm font-bold">{commitCrop.expectedReturn} expected</p>
                    <p className="text-white/60 text-xs">Harvest: {commitCrop.harvestEst}</p>
                  </div>
                </div>
              </div>
              {/* Preset amounts */}
              <p className="text-xs text-muted-foreground mb-2 font-medium">Quick amounts (KES):</p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[5000, 10000, 25000, 50000].map(amt => (
                  <button key={amt} onClick={() => setCommitInput(String(amt))}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${commitInput === String(amt) ? "bg-primary text-white border-primary" : "border-border text-foreground"}`}>
                    {amt >= 1000 ? `${amt / 1000}K` : amt}
                  </button>
                ))}
              </div>
              {/* Custom input */}
              <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-3 mb-4">
                <span className="text-muted-foreground text-sm font-medium">KES</span>
                <input
                  type="number"
                  placeholder="Enter custom amount"
                  value={commitInput}
                  onChange={e => setCommitInput(e.target.value)}
                  className="flex-1 bg-transparent text-foreground text-sm font-semibold outline-none placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                <p className="text-green-700 text-xs leading-relaxed">
                  💡 Committing funds reserves your intent to invest when this crop listing opens. No charges now — you'll be notified first when shares go live.
                </p>
              </div>
              <button
                disabled={!commitInput || Number(commitInput) <= 0}
                onClick={() => {
                  const amt = Number(commitInput);
                  if (amt > 0) {
                    const updated = { ...committed, [commitCrop.id]: amt };
                    setCommitted(updated);
                    localStorage.setItem("investa_watchlist_commits", JSON.stringify(updated));
                  }
                  setCommitOpen(false);
                }}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #052e16, #16a34a)" }}
              >
                {committed[commitCrop.id] ? "Update Commitment" : "Commit Funds"} {commitInput && Number(commitInput) > 0 ? `· ${formatKES(Number(commitInput))}` : ""}
              </button>
              {committed[commitCrop.id] && (
                <button
                  onClick={() => {
                    const updated = { ...committed };
                    delete updated[commitCrop.id];
                    setCommitted(updated);
                    localStorage.setItem("investa_watchlist_commits", JSON.stringify(updated));
                    setCommitOpen(false);
                  }}
                  className="w-full mt-2 py-2.5 rounded-2xl text-muted-foreground text-xs font-medium active:scale-[0.98] transition-all">
                  Remove commitment
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <InvestModal
        open={investOpen}
        onClose={() => setInvestOpen(false)}
        listing={selectedListing}
      />

      <InvestmentCalculator
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        listing={calcListing}
        onBuy={() => { setCalcOpen(false); if (calcListing) { setSelectedListing(calcListing as Listing); setInvestOpen(true); } }}
      />

      <PriceAlertModal
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        listing={alertListing}
      />

      <BottomNav role="investor" />
      <AppTour role="investor" onAskAI={q => { setAiQuestion(q); }} />

      <CoachMark storageKey="investor_onboarding_v1" steps={[
        { target: "", title: "Welcome, Investor!", body: "Browse live farm listings here. Each one shows a risk badge — Low, Moderate, or High.", position: "bottom" },
        { target: "[data-testid='nav-portfolio']", title: "Your Portfolio", body: "Track your farm share holdings, returns, and request exits.", position: "top" },
        { target: "[data-testid='nav-activity']", title: "Activity Feed", body: "Your full transaction history and investment receipts live here.", position: "top" },
        { target: "[data-testid='nav-profile']", title: "Profile & KYC", body: "Complete identity verification (KYC) to unlock trading and payouts.", position: "top" },
      ]} />
      <NotificationPrompt storageKey="investor_notif_v1" />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <AiMatchmaker open={matcherOpen} onClose={() => setMatcherOpen(false)} />
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
