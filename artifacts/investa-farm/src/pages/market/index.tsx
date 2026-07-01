import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Bell, ChevronRight, TrendingUp, TrendingDown, Newspaper, BookmarkPlus, Clock, Wallet, AlertTriangle, ShieldCheck, Minus, Star, Map, Calculator, BellRing, ExternalLink, ChevronDown, CheckCircle2, X, DollarSign, RefreshCw, Zap, ArrowUpRight, Lightbulb, Loader2, Share2, Flame, Users2 } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import {
  useGetTopMovers,
  useListPrimaryMarket,
  useGetMarketSummary,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "@/components/bottom-nav";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { formatChange, getToken, formatKES, isDemoAccount, getStoredUser } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestModal } from "@/components/invest-modal";
import { getCropImage, CROP_IMAGES } from "@/lib/crops";
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

function getMoverReason(item: any, isGainer: boolean): string {
  const crop = (item.cropType ?? "").toLowerCase();
  const change = Math.abs(item.changePercent ?? 0).toFixed(1);
  const name = item.farmName ?? "This farm";

  if (isGainer) {
    if (crop.includes("coffee") || crop.includes("avocado")) {
      return `${name} is up ${change}% driven by strong EU and Japanese export demand. Mombasa auction prices hit multi-year highs this week as global arabica and Hass supply tightens. Early investors are locking in shares ahead of the main harvest window.`;
    }
    if (crop.includes("maize") || crop.includes("corn") || crop.includes("sorghum")) {
      return `${name} surges ${change}% as drought conditions in northern Kenya drive maize scarcity. NCPB depots report below-average national reserves, lifting spot prices across Rift Valley and Eastern regions. Ethanol processing demand is adding further upside pressure.`;
    }
    if (crop.includes("tea")) {
      return `${name} climbs ${change}% after strong Mombasa auction results. Pakistan and Egypt buyers placed large orders ahead of the Ramadan season. La Niña-linked rains boosted leaf quality scores, commanding a premium over competing origins such as Sri Lanka and India.`;
    }
    if (crop.includes("tomato") || crop.includes("vegetable") || crop.includes("kale")) {
      return `${name} rises ${change}% as off-season supply shortfalls hit major wholesale markets. Wakulima Market in Nairobi reports 30% lower arrivals than the 5-year average, pushing farm-gate prices sharply higher. Urban population growth continues to drive steady demand.`;
    }
    return `${name} is up ${change}% on rising wholesale prices at Nairobi and Mombasa markets. Strong investor appetite and limited shares remaining are supporting this premium. Harvest forecasts remain favourable and seasonal fundamentals look solid heading into the next quarter.`;
  } else {
    if (crop.includes("tomato") || crop.includes("potato") || crop.includes("onion")) {
      return `${name} dips ${change}% amid a seasonal glut — multiple farms across Kajiado and Kirinyaga harvested simultaneously this week, flooding Wakulima Market. This is a typical short-cycle correction; prices historically recover within 2–3 weeks once oversupply clears.`;
    }
    if (crop.includes("coffee") || crop.includes("avocado")) {
      return `${name} pulls back ${change}% after recent strong gains triggered profit-taking by early investors. The long-term fundamentals remain intact — this is healthy consolidation ahead of the main harvest window. Seasonal demand from export markets stays bullish.`;
    }
    if (crop.includes("maize") || crop.includes("wheat")) {
      return `${name} slips ${change}% as good rainfall in Rift Valley improved crop prospects, softening near-term prices. Traders are adjusting inventory positions ahead of the expected harvest. This is likely a temporary dip — demand from food processors remains strong year-round.`;
    }
    return `${name} falls ${change}% due to short-term price pressure from increased local supply in this region. Traders report slower buying as buyers wait for price stabilisation before restocking. Historical data suggests recovery within 1–2 weeks as demand catches up with supply.`;
  }
}

type RiskLevel = "Low" | "Moderate" | "High";

const HIGH_RISK_CROPS = new Set(["coffee", "avocado", "tobacco", "horticulture"]);
const MOD_RISK_CROPS  = new Set(["tea", "wheat", "tomatoes", "potatoes", "onions"]);

function getRiskLevel(cropType: string, changePercent: number): RiskLevel {
  const crop = cropType?.toLowerCase() ?? "";
  if (HIGH_RISK_CROPS.has(crop) || Math.abs(changePercent) > 5) return "High";
  if (MOD_RISK_CROPS.has(crop) || Math.abs(changePercent) > 2) return "Moderate";
  return "Low";
}

function InvestorChecklist({ walletBalance }: { walletBalance?: string }) {
  const user = getStoredUser();
  const token = getToken();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem("investa_checklist_dismissed"));
  const [minimized, setMinimized] = useState(() => !!localStorage.getItem("investa_checklist_minimized"));

  const isEmailVerified = (user as any)?.emailVerified !== false;

  // Live KYC status query (avoids stale stored-user data)
  const { data: kycData } = useQuery<{ isVerified: boolean; approved: number; total: number; allUploaded: boolean }>({
    queryKey: ["kyc-status-checklist"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/status", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { isVerified: false, approved: 0, total: 0, allUploaded: false };
      return r.json();
    },
    staleTime: 30_000,
    enabled: !!token,
  });

  // Live portfolio query to detect first investment (avoids never-set localStorage)
  // Note: portfolio/summary returns holdings as a NUMBER (count), not an array
  const { data: portfolioSummary } = useQuery<{ totalInvested?: number; holdings?: number }>({
    queryKey: ["portfolio-summary-checklist"],
    queryFn: async () => {
      const r = await fetch("/api/portfolio/summary", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return {};
      return r.json();
    },
    staleTime: 30_000,
    enabled: !!token,
  });

  const isKycDone = kycData?.isVerified === true;
  const isWalletFunded = walletBalance !== undefined && parseFloat(walletBalance ?? "0") > 0;
  const hasInvested = !!localStorage.getItem("investa_first_investment") ||
    (portfolioSummary?.totalInvested ?? 0) > 0 ||
    (portfolioSummary?.holdings ?? 0) > 0;

  // Persist first-investment flag in effect (not render) to avoid re-render loops
  useEffect(() => {
    if (hasInvested && !localStorage.getItem("investa_first_investment")) {
      localStorage.setItem("investa_first_investment", "1");
    }
  }, [hasInvested]);

  const steps = [
    { label: "Verify email",    done: isEmailVerified,  action: () => setLocation("/verify-otp"),     cta: "Verify" },
    { label: "Complete KYC",    done: isKycDone,        action: () => setLocation("/profile"),         cta: "Upload" },
    { label: "Fund wallet",     done: isWalletFunded,   action: () => setLocation("/wallet"),          cta: "Add Funds" },
    { label: "First investment",done: hasInvested,      action: () => setLocation("/market/primary"),  cta: "Browse" },
  ];

  const doneCount = steps.filter(s => s.done).length;

  if (dismissed) return null;

  if (doneCount === steps.length) {
    localStorage.setItem("investa_checklist_dismissed", "1");
    return null;
  }

  const pct = Math.round((doneCount / steps.length) * 100);

  const handleMinimize = () => {
    const next = !minimized;
    setMinimized(next);
    if (next) localStorage.setItem("investa_checklist_minimized", "1");
    else localStorage.removeItem("investa_checklist_minimized");
  };

  if (minimized) {
    return (
      <div className="mx-4 mt-2">
        <button onClick={handleMinimize}
          className="w-full flex items-center gap-2.5 bg-gradient-to-r from-[#052e16] to-[#166534] rounded-xl px-3 py-2 text-white">
          <div className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center flex-shrink-0">
            <span className="text-[8px] font-bold">{doneCount}/{steps.length}</span>
          </div>
          <span className="text-xs font-semibold flex-1 text-left">Getting Started — {pct}% complete</span>
          <div className="w-16 bg-white/20 rounded-full h-1">
            <div className="bg-green-400 h-1 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <ChevronDown size={12} className="text-white/70 flex-shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-2">
      <div className="bg-gradient-to-br from-[#052e16] to-[#166534] rounded-xl p-3 text-white relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-white/70 text-[10px] font-semibold uppercase tracking-wider">Getting Started</span>
            <span className="text-white/60 text-[10px]">{doneCount}/{steps.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleMinimize}
              className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center" title="Minimize">
              <Minus size={8} className="text-white" />
            </button>
            <button onClick={() => { setMinimized(true); localStorage.setItem("investa_checklist_minimized", "1"); }}
              className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center" title="Hide — tap the bar to restore">
              <X size={8} className="text-white" />
            </button>
          </div>
        </div>
        <div className="w-full bg-white/20 rounded-full h-0.5 mb-2">
          <div className="bg-green-400 h-0.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="space-y-1">
          {steps.map((step, i) => (
            step.done ? (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-green-900/30">
                <div className="w-4 h-4 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={9} className="text-white" />
                </div>
                <p className="text-green-300 text-[11px] line-through flex-1">{step.label}</p>
                <span className="text-[9px] font-bold text-green-400">✓ Done</span>
              </div>
            ) : (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-white/10 cursor-pointer active:bg-white/15 transition-all"
                onClick={step.action}>
                <div className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 border border-white/30">
                  <span className="text-white text-[7px] font-bold">{i + 1}</span>
                </div>
                <p className="text-white text-[11px] font-medium flex-1">{step.label}</p>
                <span className="text-[9px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full">{step.cta} →</span>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
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

  const fetchInsight = async (crop: typeof WATCHLIST_CROPS[0]) => {
    setInsightCrop(crop);
    setInsightOpen(true);
    setInsightText("");
    setInsightLoading(true);
    try {
      const r = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          section: `Watchlist — ${crop.name}`,
          context: `Why should a Kenyan investor watch ${crop.name} for the ${crop.season} season? Expected return: ${crop.expectedReturn}. Market demand: ${crop.demand}. Active farms: ${crop.farms}. Planting starts: ${crop.plantingStart}. Estimated harvest: ${crop.harvestEst}. Price change: ${crop.change > 0 ? "+" : ""}${crop.change}%. Provide a concise 3-paragraph investment thesis covering: (1) market fundamentals and current demand, (2) seasonal risk factors including weather and price volatility, (3) realistic return potential for Kenyan investors in 2026.`,
        }),
      });
      const d = await r.json();
      setInsightText(d.explanation ?? d.text ?? "Unable to generate insight at this time.");
    } catch {
      setInsightText("Unable to load AI insight. Please check your connection and try again.");
    } finally {
      setInsightLoading(false);
    }
  };

  const handleCommitFunds = async () => {
    if (!commitCrop || !commitInput || Number(commitInput) <= 0) return;
    const amt = Number(commitInput);
    const balance = Number(walletData?.wallet?.balance ?? "0");
    if (amt > balance) {
      setCommitOpen(false);
      setWalletOpen(true);
      return;
    }
    setCommitLoading(true);
    try {
      const r = await fetch("/api/watchlist/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cropName: commitCrop.name, cropSeason: commitCrop.season, amount: amt }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.balance !== undefined) {
          setCommitOpen(false);
          setWalletOpen(true);
        }
        return;
      }
      const updated = { ...committed, [commitCrop.id]: amt };
      setCommitted(updated);
      localStorage.setItem("investa_watchlist_commits", JSON.stringify(updated));
      qc.invalidateQueries({ queryKey: ["wallet-balance"] });
      setCommitOpen(false);
    } catch {
      // fallback to localStorage-only if API unavailable
      const updated = { ...committed, [commitCrop.id]: amt };
      setCommitted(updated);
      localStorage.setItem("investa_watchlist_commits", JSON.stringify(updated));
      setCommitOpen(false);
    } finally {
      setCommitLoading(false);
    }
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
  const [selectedMover, setSelectedMover] = useState<any>(null);
  const [moverDetailOpen, setMoverDetailOpen] = useState(false);
  const [newsCategory, setNewsCategory] = useState("All");
  const [insightOpen, setInsightOpen] = useState(false);
  const [insightCrop, setInsightCrop] = useState<typeof WATCHLIST_CROPS[0] | null>(null);
  const [insightText, setInsightText] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const token = getToken();
  const { formatAmount } = useCurrency();


  // Combined movers/decliners tab
  const [moverTab, setMoverTab] = useState<"movers" | "decliners">("movers");
  const [moverSlide, setMoverSlide] = useState(0);
  const moverTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [marketPhase, setMarketPhase] = useState<"movers" | "ads">("movers");
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    moverTimer.current = setInterval(() => setMoverSlide(s => s + 1), 30000);
    return () => { if (moverTimer.current) clearInterval(moverTimer.current); };
  }, []);

  useEffect(() => {
    const cycle = () => {
      phaseTimer.current = setTimeout(() => {
        setMarketPhase("ads");
        phaseTimer.current = setTimeout(() => {
          setMarketPhase("movers");
          cycle();
        }, 45_000);
      }, 90_000);
    };
    cycle();
    return () => { if (phaseTimer.current) clearTimeout(phaseTimer.current); };
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

  const { data: sentimentData } = useQuery<any[]>({
    queryKey: ["news-sentiment"],
    queryFn: async () => {
      const r = await fetch("/api/news/sentiment");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 2 * 60 * 60 * 1000,
    enabled: true,
  });

  const { data: walletData } = useQuery<{ wallet: { balance: string } }>({
    queryKey: ["wallet-balance"],
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { wallet: { balance: "0" } };
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
  const isDemo = isDemoAccount();

  const { data: liveTickerData } = useQuery<{ prices: Array<{name: string; price: string; unit: string; change: number}>; insights: string[] } | null>({
    queryKey: ["market-ticker"],
    queryFn: async () => {
      const r = await fetch("/api/market/ticker");
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Build rich ticker: live prices preferred, always fall back to TICKER_ITEMS so the tape never runs empty
  const tickerItems = (() => {
    const result: Array<{ type: "price"; name: string; price: string; unit: string; change: number } | { type: "insight"; text: string }> = [];
    const priceSource = liveTickerData?.prices?.length
      ? liveTickerData.prices
      : TICKER_ITEMS;
    const insightSource = liveTickerData?.insights?.length
      ? liveTickerData.insights.map(text => ({ text }))
      : MARKET_INSIGHTS;
    const prices = priceSource.map(t => ({ type: "price" as const, ...t }));
    const insights = insightSource.map(i => ({ type: "insight" as const, ...i }));
    for (let i = 0; i < prices.length; i++) {
      result.push(prices[i]!);
      if (i % 3 === 2 && insights[Math.floor(i / 3)]) result.push(insights[Math.floor(i / 3)]!);
    }
    return [...result, ...result];
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

  // Resume pending investment banner
  const [pendingInvest, setPendingInvest] = useState<{ farmName: string; farmId: number; shares: number } | null>(() => {
    try {
      const raw = sessionStorage.getItem("investa_pending_invest");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  });
  const dismissPendingInvest = () => {
    sessionStorage.removeItem("investa_pending_invest");
    setPendingInvest(null);
  };

  return (
    <div className="app-shell pb-20 page-enter" data-testid="market-home">
      {/* Resume Pending Investment Banner */}
      <AnimatePresence>
        {pendingInvest && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mt-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-base">⏸️</div>
              <div className="flex-1 min-w-0">
                <p className="text-amber-800 font-bold text-xs">Incomplete purchase</p>
                <p className="text-amber-700 text-[11px] truncate">{pendingInvest.shares} shares · {pendingInvest.farmName}</p>
              </div>
              <button
                onClick={() => {
                  const listing = listings?.find((l: any) => l.farmId === pendingInvest.farmId || l.id === pendingInvest.farmId);
                  if (listing) { setSelectedListing(listing as any); setInvestOpen(true); }
                  else setLocation(`/market/${pendingInvest.farmId}`);
                }}
                className="text-[11px] font-bold text-amber-900 bg-amber-200 px-3 py-1.5 rounded-xl flex-shrink-0 active:scale-95 transition-transform"
              >
                Resume →
              </button>
              <button onClick={dismissPendingInvest} className="w-6 h-6 flex items-center justify-center text-amber-500 flex-shrink-0">
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <button
              onClick={() => {
                const url = `${window.location.origin}/market/preview`;
                if (navigator.share) {
                  navigator.share({ title: "Investa Farm — Live Market", text: "Check out live farm investment listings on Investa Farm 🌾", url }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(url).catch(() => {});
                }
              }}
              className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-border shadow-sm"
              title="Share market">
              <Share2 size={14} className="text-foreground" />
            </button>
            <button onClick={() => setLocation("/market/map")}
              className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-border shadow-sm"
              title="Farm Map">
              <Map size={15} className="text-foreground" />
            </button>
            <button onClick={() => setLocation("/notifications")}
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

      {/* ── Investor Onboarding Checklist (dismissible, shows for new users) ── */}
      <InvestorChecklist walletBalance={walletBalance} />

      {/* Section tabs */}
      <div className="px-4 pt-3">
        <div className="flex bg-muted rounded-2xl p-1 gap-1">
          {(["market", "news", "watchlist"] as const).map(s => (
            <button key={s} onClick={() => setActiveSectionPersist(s)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${activeSection === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {s === "watchlist" ? "Watchlist" : s === "news" ? "📰 News" : "📊 Market"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {activeSection === "market" && (
          <>
            {/* Market type links — compact strip above movers */}
            <div className="grid grid-cols-2 gap-2">
              <Link href="/market/primary">
                <div className="rounded-xl overflow-hidden relative h-14 cursor-pointer active:scale-95 transition-transform shadow-md shadow-green-600/15">
                  <img src={getCropImage("maize")} alt="Primary Market" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-green-800/70 to-green-950/60 flex items-center px-3 gap-2">
                    <span className="text-white/80 text-[8px] font-bold uppercase tracking-widest bg-white/15 px-1.5 py-0.5 rounded-full whitespace-nowrap">New Issue</span>
                    <p className="text-white font-extrabold text-xs leading-tight">Primary Market</p>
                  </div>
                </div>
              </Link>
              <Link href="/market/secondary">
                <div className="rounded-xl overflow-hidden relative h-14 cursor-pointer active:scale-95 transition-transform shadow-md shadow-amber-600/15">
                  <img src={getCropImage("coffee")} alt="Secondary Market" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-800/85 via-amber-900/70 to-amber-950/60 flex items-center px-3 gap-2">
                    <span className="text-white/80 text-[8px] font-bold uppercase tracking-widest bg-white/15 px-1.5 py-0.5 rounded-full whitespace-nowrap">Resale</span>
                    <p className="text-white font-extrabold text-xs leading-tight">Secondary Market</p>
                  </div>
                </div>
              </Link>
            </div>

            {/* Rotating Spotlight — Gainers/Decliners ↔ Investment Opportunities */}
            <section>
              <AnimatePresence mode="wait">
                {marketPhase === "movers" ? (
                  <motion.div key="movers-phase"
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.35 }}>

              <div className="flex items-center justify-between mb-2.5">
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
                  <AiSectionBot
                    label="market movers"
                    context="Kenyan farm investment market: what causes a farm's share price to move up or down, and what does it mean for my investment strategy?"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    <span className="w-3 h-1.5 rounded-full bg-green-600" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/25" />
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
                            <div
                              key={item.farmId}
                              onClick={() => { setSelectedMover({ ...item, isGainer: isMovers }); setMoverDetailOpen(true); }}
                              className="rounded-2xl overflow-hidden relative cursor-pointer active:scale-95 transition-transform shadow-md"
                            >
                              <img src={getCropImage(item.cropType ?? "", item.imageUrl ?? undefined)} alt={item.farmName} className="w-full h-24 object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-3 flex flex-col justify-end">
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
                                <div className="mt-1.5 bg-white/20 backdrop-blur-sm rounded-lg py-1 text-center">
                                  <span className="text-white text-[9px] font-bold">Tap for details →</span>
                                </div>
                              </div>
                            </div>
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
                  </motion.div>
                ) : (
                  <motion.div key="ads-phase"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35 }}>
                    <div className="flex items-center justify-between mb-2.5">
                      <h2 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                        <Zap size={13} className="text-amber-500" />
                        Investment Opportunities
                      </h2>
                      <div className="flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/25" />
                        <span className="w-3 h-1.5 rounded-full bg-amber-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(listings && listings.length >= 2 ? listings.slice(0, 2) : null)?.map((listing: any, idx: number) => {
                        const isFirst = idx === 0;
                        const roi = listing.changePercent > 0 ? `+${listing.changePercent.toFixed(1)}%` : `${listing.changePercent.toFixed(1)}%`;
                        return (
                          <div key={listing.id}
                            onClick={() => { setSelectedListing(listing); setInvestOpen(true); }}
                            className="rounded-2xl overflow-hidden relative h-52 cursor-pointer active:scale-95 transition-transform shadow-md"
                            style={{ background: isFirst ? "linear-gradient(160deg,#78350f 0%,#b45309 50%,#fbbf24 100%)" : "linear-gradient(160deg,#052e16 0%,#14532d 50%,#16a34a 100%)" }}>
                            <img src={getCropImage(listing.cropType, listing.imageUrl)}
                              className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity" alt={listing.cropType} />
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
                            <div className="relative h-full flex flex-col justify-between p-3">
                              <div>
                                <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${isFirst ? "text-yellow-100 bg-yellow-600/40" : "text-green-200 bg-green-600/30"}`}>
                                  {getRiskLevel(listing.cropType, listing.changePercent)}
                                </span>
                                <p className="text-white font-extrabold text-sm leading-tight mt-1.5">{listing.farmName}</p>
                                <p className={`text-[10px] mt-0.5 ${isFirst ? "text-yellow-100/70" : "text-green-200/70"}`}>{listing.location} · {listing.cropType}</p>
                              </div>
                              <div>
                                <p className={`font-black text-2xl leading-none ${isFirst ? "text-yellow-300" : "text-green-300"}`}>{roi}</p>
                                <p className={`text-[9px] ${isFirst ? "text-yellow-100/60" : "text-green-200/60"}`}>price change</p>
                                <div className={`mt-2 bg-white font-bold text-[10px] py-1.5 rounded-lg text-center flex items-center justify-center gap-1 ${isFirst ? "text-amber-700" : "text-primary"}`}>
                                  <Zap size={10} /> Invest Now
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }) ?? (
                        <>
                          <Link href="/market/primary">
                            <div className="rounded-2xl overflow-hidden relative h-52 cursor-pointer active:scale-95 transition-transform shadow-md"
                              style={{ background: "linear-gradient(160deg, #78350f 0%, #b45309 50%, #fbbf24 100%)" }}>
                              <img src={getCropImage("avocado")} alt="Avocado"
                                className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity" />
                              <div className="relative h-full flex flex-col justify-between p-3">
                                <div>
                                  <span className="text-yellow-100 text-[8px] font-bold uppercase tracking-widest bg-yellow-600/40 px-1.5 py-0.5 rounded-full">Premium</span>
                                  <p className="text-white font-extrabold text-sm leading-tight mt-1.5">Avocado Export</p>
                                </div>
                                <div>
                                  <p className="text-yellow-300 font-black text-2xl leading-none">+22%</p>
                                  <p className="text-yellow-100/60 text-[9px]">projected ROI</p>
                                  <div className="mt-2 bg-white text-amber-700 font-bold text-[10px] py-1.5 rounded-lg text-center">
                                    <Zap size={10} className="inline mr-1" /> View Farms
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                          <Link href="/market/primary">
                            <div className="rounded-2xl overflow-hidden relative h-52 cursor-pointer active:scale-95 transition-transform shadow-md"
                              style={{ background: "linear-gradient(160deg, #052e16 0%, #14532d 50%, #16a34a 100%)" }}>
                              <img src={getCropImage("maize")} alt="Maize"
                                className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-luminosity" />
                              <div className="relative h-full flex flex-col justify-between p-3">
                                <div>
                                  <span className="text-green-200 text-[8px] font-bold uppercase tracking-widest bg-green-600/30 px-1.5 py-0.5 rounded-full">Low Risk</span>
                                  <p className="text-white font-extrabold text-sm leading-tight mt-1.5">Maize Long Rains</p>
                                </div>
                                <div>
                                  <p className="text-green-300 font-black text-2xl leading-none">+14%</p>
                                  <p className="text-green-200/60 text-[9px]">target return</p>
                                  <div className="mt-2 bg-white text-primary font-bold text-[10px] py-1.5 rounded-lg text-center">
                                    🌽 View Farms
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>


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
                                  <Link href={listing.farmId ? `/market/${listing.farmId}` : "/market/primary"}>
                                    <div className={`rounded-2xl border overflow-hidden cursor-pointer active:scale-[0.98] transition-all ${isFeatured ? "border-primary/30 shadow-lg shadow-green-600/15" : "border-border bg-card shadow-sm shadow-green-500/10"}`}>
                                      {isFeatured && (
                                        <div className="bg-gradient-to-r from-primary/90 to-green-600 px-4 py-1.5 flex items-center gap-1.5">
                                          <Star size={10} className="text-white fill-white" />
                                          <span className="text-white text-[9px] font-bold uppercase tracking-wider">Featured Listing</span>
                                        </div>
                                      )}
                                      <div className={`flex items-center gap-3 p-3 ${isFeatured ? "bg-primary/5" : "bg-card"}`}>
                                        <div className="relative flex-shrink-0">
                                          <img src={imgSrc} alt={listing.farmName} className="w-16 h-16 rounded-xl object-cover" />
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
                                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isUp ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                              {isUp ? "⚡" : "📉"} {formatChange(listing.changePercent)}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground">{listing.sharesAvailable} shares left</span>
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

            {/* Community portfolio banner */}
            <Link href="/market/portfolios">
              <div className="bg-muted/50 border border-border rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-all">
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

            {/* Social features strip — Bets + Syndicates */}
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/bets">
                <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-300/40 rounded-2xl p-3.5 cursor-pointer active:scale-[0.97] transition-all h-full">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center mb-2">
                    <Flame size={16} className="text-orange-600" />
                  </div>
                  <p className="text-foreground font-bold text-sm leading-tight">Crop Bets</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5 leading-snug">Predict prices · win from the community pool</p>
                </div>
              </Link>
              <Link href="/syndicates">
                <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-300/40 rounded-2xl p-3.5 cursor-pointer active:scale-[0.97] transition-all h-full">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center mb-2">
                    <Users2 size={16} className="text-violet-600" />
                  </div>
                  <p className="text-foreground font-bold text-sm leading-tight">Syndicates</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5 leading-snug">Pool funds · co-invest in bigger farms</p>
                </div>
              </Link>
            </div>
          </>
        )}

        {activeSection === "news" && (
          <section className="space-y-3">
            {/* News header */}
            <div className="bg-card rounded-2xl border border-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Newspaper size={15} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-foreground font-bold text-sm leading-tight">Agriculture News</h2>
                  <p className="text-muted-foreground text-[10px]">Kenya farm &amp; market updates</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-600 text-[10px] font-bold">Live</span>
              </span>
            </div>

            {/* Category filter strip */}
            <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
              {["All", "Markets", "Weather", "Policy", "Returns"].map((cat) => (
                <button key={cat}
                  onClick={() => setNewsCategory(cat)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all active:scale-95 ${
                    newsCategory === cat
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-muted/80 border-border text-foreground hover:bg-muted"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Crop Sentiment Strip */}
            {sentimentData && sentimentData.length > 0 && (
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-foreground font-bold text-[11px]">AI Crop Sentiment</p>
                    <span className="text-muted-foreground text-[9px]">· via Groq + News + Bluesky</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground">7-day signal</span>
                </div>
                <div className="flex gap-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {sentimentData.slice(0, 8).map((s: any) => (
                    <div key={s.cropType} className="flex-shrink-0 px-3 py-2.5 border-r border-border last:border-r-0 min-w-[80px] text-center">
                      <p className="text-foreground text-[10px] font-semibold capitalize mb-1">{s.cropType}</p>
                      <div className="flex items-center justify-center gap-0.5 mb-1">
                        {s.trend === "bullish" ? (
                          <span className="text-green-600 text-[9px] font-bold">▲ {Math.abs(s.score)}</span>
                        ) : s.trend === "bearish" ? (
                          <span className="text-red-500 text-[9px] font-bold">▼ {Math.abs(s.score)}</span>
                        ) : (
                          <span className="text-amber-500 text-[9px] font-bold">— {Math.abs(s.score)}</span>
                        )}
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.trend === "bullish" ? "bg-green-500" : s.trend === "bearish" ? "bg-red-500" : "bg-amber-400"}`}
                          style={{ width: `${Math.min(100, Math.abs(s.score))}%` }}
                        />
                      </div>
                      <p className={`text-[8px] font-semibold mt-1 capitalize ${s.trend === "bullish" ? "text-green-600" : s.trend === "bearish" ? "text-red-500" : "text-amber-500"}`}>
                        {s.trend}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {newsLoading
              ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
              : (() => {
                  const allItems = newsItems ?? [];
                  const items = newsCategory === "All"
                    ? allItems
                    : allItems.filter((n: any) => (n.tag ?? "").toLowerCase() === newsCategory.toLowerCase());
                  if (items.length === 0) return (
                    <div className="bg-card rounded-2xl border border-border p-8 text-center">
                      <Newspaper size={28} className="text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No stories yet — check back soon</p>
                    </div>
                  );
                  const [top, ...rest] = items;
                  return (
                    <>
                      {/* Top story — editorial hero */}
                      <div className="bg-card rounded-2xl border border-border overflow-hidden">
                        <div className="relative h-44">
                          <img src={getNewsImage(top)} alt={top.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                          <div className="absolute bottom-3 left-3">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${top.tagColor || "bg-green-100 text-green-700"}`}>{top.tag}</span>
                          </div>
                          <div className="absolute top-3 right-3"><NewsAiBot item={top} /></div>
                        </div>
                        <button
                          className="px-4 pt-3 pb-3 text-left w-full active:opacity-70 block"
                          onClick={() => top.url && top.url !== "#" && window.open(top.url, "_blank", "noopener,noreferrer")}
                        >
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-primary text-[10px] font-bold">{top.source}</span>
                            <span className="text-muted-foreground/40 text-[10px]">·</span>
                            <span className="text-muted-foreground text-[10px] flex items-center gap-0.5"><Clock size={8} />{top.time}</span>
                          </div>
                          <p className="text-foreground font-bold text-[14px] leading-snug">{top.title}</p>
                          <p className="text-muted-foreground text-xs mt-1.5 leading-relaxed line-clamp-2">{top.summary}</p>
                          {top.url && top.url !== "#" && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <ExternalLink size={10} className="text-primary" />
                              <span className="text-primary text-[10px] font-semibold">Read full story</span>
                            </div>
                          )}
                        </button>
                      </div>

                      {/* Remaining stories — newspaper list */}
                      {rest.length > 0 && (
                        <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
                          {rest.map((item: any) => (
                            <button key={item.id}
                              className="w-full text-left px-3.5 py-3 active:bg-muted/20 transition-colors flex gap-3 items-start"
                              onClick={() => item.url && item.url !== "#" && window.open(item.url, "_blank", "noopener,noreferrer")}>
                              <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-primary text-[9px] font-bold truncate max-w-[90px]">{item.source}</span>
                                  <span className="text-muted-foreground/40 text-[9px]">·</span>
                                  <span className="text-muted-foreground text-[9px] flex items-center gap-0.5 flex-shrink-0"><Clock size={7} />{item.time}</span>
                                  <span className={`ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${item.tagColor || "bg-green-100 text-green-700"}`}>{item.tag}</span>
                                </div>
                                <p className="text-foreground font-semibold text-[12px] leading-snug line-clamp-2">{item.title}</p>
                                {item.url && item.url !== "#" && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <ExternalLink size={9} className="text-primary" />
                                    <span className="text-primary text-[9px] font-semibold">Tap to read</span>
                                  </div>
                                )}
                              </div>
                              <div className="w-16 h-14 rounded-xl overflow-hidden flex-shrink-0 mt-0.5">
                                <img src={getNewsImage(item)} alt="" className="w-full h-full object-cover" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
            <p className="text-center text-muted-foreground/60 text-[10px] pb-1">
              AI-sourced from multiple news feeds · updated every hour
            </p>
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
                <div className="flex flex-col items-end gap-1.5">
                  <div className="bg-white/15 rounded-xl px-3 py-1.5 text-right">
                    <p className="text-white/60 text-[9px] uppercase tracking-wider">Watching</p>
                    <p className="text-green-300 font-bold text-lg leading-none">{watchlisted.size}</p>
                  </div>
                  {Object.values(committed).reduce((a, b) => a + b, 0) > 0 && (
                    <div className="bg-white/15 rounded-xl px-3 py-1.5 text-right">
                      <p className="text-white/60 text-[9px] uppercase tracking-wider">Committed</p>
                      <p className="text-green-400 font-bold text-sm leading-none">{formatKES(Object.values(committed).reduce((a, b) => a + b, 0))}</p>
                    </div>
                  )}
                </div>
              </div>
              {watchlisted.size === 0 && (
                <div className="px-4 pb-3 flex items-center gap-2 border-t border-white/10">
                  <BookmarkPlus size={12} className="text-white/40" />
                  <span className="text-white/50 text-[11px]">Tap bookmark on any crop below to track it</span>
                </div>
              )}
            </div>

            {/* All upcoming crop seasons — demo shows curated list, real users see live farms */}
            {!isDemo && (!listings || listings.length === 0) && (
              <div className="bg-muted/30 border border-border rounded-2xl px-4 py-8 text-center">
                <BookmarkPlus size={28} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-semibold text-sm">No listings yet</p>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  Farm listings will appear here as farmers add their seasons. Check back soon or browse the Primary Market.
                </p>
                <Link href="/market/primary">
                  <button className="mt-4 bg-primary text-white font-semibold text-xs px-5 py-2.5 rounded-xl">
                    Browse Primary Market
                  </button>
                </Link>
              </div>
            )}
            {(isDemo ? WATCHLIST_CROPS : (listings ?? []).slice(0, 6).map((l: any) => ({
              id: l.id,
              name: l.cropType,
              season: `Long Rains 2026`,
              plantingStart: "Mar 2026",
              harvestEst: "Aug 2026",
              expectedReturn: `${l.changePercent > 0 ? "+" : ""}${(l.changePercent ?? 0).toFixed(1)}%`,
              image: getCropImage(l.cropType, l.imageUrl),
              demand: Math.abs(l.changePercent ?? 0) > 2 ? "High" : "Moderate",
              demandColor: Math.abs(l.changePercent ?? 0) > 2 ? "text-green-600 bg-green-50" : "text-primary bg-primary/5",
              farms: 1,
              change: l.changePercent ?? 0,
            }))).map((crop: any) => {
              const isWatchlisted = watchlisted.has(crop.id);
              return (
                <div key={crop.id} className={`bg-card rounded-2xl border overflow-hidden transition-all ${isWatchlisted ? "border-primary/40 shadow-lg shadow-green-500/8" : "border-border"}`}>
                  {/* Image band */}
                  <div className="relative h-32">
                    <img src={crop.image} alt={crop.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.50) 50%, rgba(0,0,0,0.20) 100%)" }} />
                    {isWatchlisted && (
                      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-primary via-green-400 to-primary" />
                    )}
                    <div className="absolute inset-0 p-3.5 flex flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-white font-extrabold text-lg leading-none">{crop.name}</p>
                            {isWatchlisted && (
                              <span className="bg-primary text-white text-[8px] font-bold px-2 py-0.5 rounded-full tracking-wide">● Watching</span>
                            )}
                          </div>
                          <p className="text-white/65 text-[11px] font-medium">{crop.season}</p>
                        </div>
                        <div className="bg-black/30 backdrop-blur-sm rounded-xl px-2.5 py-1.5 text-right border border-white/10">
                          <p className="text-white/60 text-[8px] uppercase tracking-wider">Est. Return</p>
                          <p className="text-green-300 font-extrabold text-base leading-none mt-0.5">{crop.expectedReturn}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${crop.demandColor}`}>{crop.demand} Demand</span>
                        <span className="bg-white/15 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full">{crop.farms} farms</span>
                        <RiskBadge level={getRiskLevel(crop.name, crop.change)} />
                      </div>
                    </div>
                  </div>

                  {/* Info strip */}
                  <div className="grid grid-cols-3 border-b border-border">
                    <div className="p-2.5 text-center border-r border-border">
                      <p className="text-muted-foreground text-[8px] uppercase font-semibold tracking-wider">Planting</p>
                      <p className="text-foreground font-bold text-[11px] mt-0.5">{crop.plantingStart}</p>
                    </div>
                    <div className="p-2.5 text-center border-r border-border">
                      <p className="text-muted-foreground text-[8px] uppercase font-semibold tracking-wider">Harvest</p>
                      <p className="text-foreground font-bold text-[11px] mt-0.5">{crop.harvestEst}</p>
                    </div>
                    <div className="p-2.5 text-center bg-primary/4">
                      <p className="text-muted-foreground text-[8px] uppercase font-semibold tracking-wider">ROI Target</p>
                      <p className="text-primary font-extrabold text-[11px] mt-0.5">{crop.expectedReturn}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-3 space-y-2">
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
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${isWatchlisted ? "bg-primary border-primary text-white" : "border-green-200 bg-green-50 text-green-700"}`}>
                        <BookmarkPlus size={13} />
                        {isWatchlisted ? "Watching" : "Watch"}
                      </button>
                      <button
                        onClick={() => fetchInsight(crop)}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-green-200 bg-green-50 text-green-700 text-xs font-semibold transition-all active:scale-95">
                        <Lightbulb size={13} />
                        Why?
                      </button>
                      {committed[crop.id] ? (
                        <button
                          onClick={() => { setCommitCrop(crop); setCommitInput(String(committed[crop.id])); setCommitOpen(true); }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white text-xs font-semibold py-2.5 rounded-xl active:scale-95 transition-transform">
                          <CheckCircle2 size={13} />
                          {formatKES(committed[crop.id])}
                        </button>
                      ) : (
                        <button
                          onClick={() => { setCommitCrop(crop); setCommitInput(""); setCommitOpen(true); }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-foreground text-background text-xs font-semibold py-2.5 rounded-xl active:scale-95 transition-transform">
                          <DollarSign size={13} />
                          Commit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-xl flex-shrink-0">💡</span>
              <div>
                <p className="text-foreground font-semibold text-xs mb-1">Early Investor Advantage</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
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
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setCommitOpen(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 inset-x-0 z-[60] max-w-[430px] mx-auto bg-card rounded-t-3xl shadow-xl px-5 pt-5 pb-8">
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
              {commitInput && Number(commitInput) > 0 && Number(commitInput) > Number(walletData?.wallet?.balance ?? "0") && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 mb-0">
                  <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-amber-700 text-xs font-semibold">Insufficient wallet balance</p>
                    <p className="text-amber-600 text-[11px]">Your wallet has {formatKES(Number(walletData?.wallet?.balance ?? "0"))}. Top up to commit this amount.</p>
                  </div>
                </div>
              )}
              <button
                disabled={!commitInput || Number(commitInput) <= 0 || commitLoading}
                onClick={handleCommitFunds}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#16a34a" }}
              >
                {commitLoading
                  ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
                  : commitInput && Number(commitInput) > 0 && Number(commitInput) > Number(walletData?.wallet?.balance ?? "0")
                    ? "Top Up Wallet →"
                    : `${committed[commitCrop.id] ? "Update Commitment" : "Reserve · Deduct from Wallet"}${commitInput && Number(commitInput) > 0 ? ` · ${formatKES(Number(commitInput))}` : ""}`
                }
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

      {/* AI Crop Insight Bottom Sheet */}
      <AnimatePresence>
        {insightOpen && insightCrop && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setInsightOpen(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 inset-x-0 z-[60] max-w-[430px] mx-auto bg-card rounded-t-3xl shadow-xl px-5 pt-5 pb-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Lightbulb size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">AI Investment Insight</p>
                    <p className="text-muted-foreground text-[11px]">{insightCrop.name} · {insightCrop.season}</p>
                  </div>
                </div>
                <button onClick={() => setInsightOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
                  <X size={15} />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 bg-muted rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-medium">Expected ROI</span>
                  <span className="text-primary font-extrabold text-sm">{insightCrop.expectedReturn}</span>
                </div>
                <div className="flex-1 bg-muted rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-medium">Demand</span>
                  <span className={`font-bold text-xs ${insightCrop.demandColor.split(" ")[0]}`}>{insightCrop.demand}</span>
                </div>
                <div className="flex-1 bg-muted rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-medium">Farms</span>
                  <span className="text-foreground font-bold text-xs">{insightCrop.farms}</span>
                </div>
              </div>

              <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-4 min-h-[120px] flex items-start">
                {insightLoading
                  ? (
                    <div className="flex items-center gap-3 w-full py-4">
                      <Loader2 size={20} className="animate-spin text-amber-500 flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <div className="h-3 bg-amber-200/60 rounded-full animate-pulse w-full" />
                        <div className="h-3 bg-amber-200/60 rounded-full animate-pulse w-4/5" />
                        <div className="h-3 bg-amber-200/60 rounded-full animate-pulse w-3/4" />
                      </div>
                    </div>
                  )
                  : (
                    <p className="text-amber-900 text-xs leading-relaxed whitespace-pre-line">{insightText}</p>
                  )
                }
              </div>

              <p className="text-center text-muted-foreground/50 text-[9px] mt-3">
                AI-generated insight · Not financial advice · Do your own research
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mover Detail Bottom Sheet */}
      <AnimatePresence>
        {moverDetailOpen && selectedMover && (() => {
          const isGainer = selectedMover.isGainer;
          const risk = getRiskLevel(selectedMover.cropType ?? "", selectedMover.changePercent);
          const reason = getMoverReason(selectedMover, isGainer);
          return (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
                onClick={() => setMoverDetailOpen(false)} />
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="fixed bottom-0 inset-x-0 z-[60] max-w-[430px] mx-auto bg-card rounded-t-3xl shadow-2xl overflow-hidden"
              >
                {/* Accent bar */}
                <div className={`h-1 w-full ${isGainer ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-red-500 to-rose-400"}`} />

                {/* Hero image */}
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={getCropImage(selectedMover.cropType ?? "", selectedMover.imageUrl ?? undefined)}
                    alt={selectedMover.farmName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <button
                    onClick={() => setMoverDetailOpen(false)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
                  >
                    <X size={14} className="text-white" />
                  </button>
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                    <div>
                      <p className="text-white font-bold text-base leading-tight">{selectedMover.farmName}</p>
                      <p className="text-white/70 text-xs">{selectedMover.cropType} · {selectedMover.location}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl ${isGainer ? "bg-green-500/90" : "bg-red-500/90"}`}>
                      {isGainer ? <TrendingUp size={12} className="text-white" /> : <TrendingDown size={12} className="text-white" />}
                      <span className="text-white font-bold text-sm">{formatChange(selectedMover.changePercent)}</span>
                    </div>
                  </div>
                </div>

                <div className="px-5 pt-4 pb-8 space-y-4">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                      <p className="text-muted-foreground text-[9px] uppercase font-semibold">Price</p>
                      <p className="text-foreground font-bold text-xs mt-0.5">{formatAmount(selectedMover.currentPrice ?? selectedMover.pricePerShare)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                      <p className="text-muted-foreground text-[9px] uppercase font-semibold">Change</p>
                      <p className={`font-bold text-xs mt-0.5 ${isGainer ? "text-green-600" : "text-red-500"}`}>{formatChange(selectedMover.changePercent)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                      <p className="text-muted-foreground text-[9px] uppercase font-semibold">Risk</p>
                      <p className="text-foreground font-bold text-xs mt-0.5">{risk}</p>
                    </div>
                  </div>

                  {/* Why section */}
                  <div className={`rounded-2xl p-4 border ${isGainer ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{isGainer ? "📈" : "📉"}</span>
                      <p className={`font-bold text-sm ${isGainer ? "text-green-800" : "text-red-800"}`}>
                        Why {isGainer ? "it's gaining" : "it's declining"}
                      </p>
                    </div>
                    <p className={`text-xs leading-relaxed ${isGainer ? "text-green-700" : "text-red-700"}`}>{reason}</p>
                  </div>

                  {/* Key drivers */}
                  <div className="space-y-2">
                    <p className="text-foreground font-semibold text-xs">Key Drivers</p>
                    {(isGainer ? [
                      { icon: "🌍", label: "Market Demand", val: "Rising" },
                      { icon: "📦", label: "Supply Level", val: "Tight" },
                      { icon: "🌦️", label: "Weather Outlook", val: "Favourable" },
                    ] : [
                      { icon: "📦", label: "Supply Level", val: "Elevated" },
                      { icon: "💰", label: "Price Pressure", val: "Downward" },
                      { icon: "⏱️", label: "Recovery Est.", val: "1–3 weeks" },
                    ]).map(d => (
                      <div key={d.label} className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{d.icon}</span>
                          <span className="text-foreground text-xs font-medium">{d.label}</span>
                        </div>
                        <span className={`text-xs font-bold ${isGainer ? "text-green-600" : "text-amber-600"}`}>{d.val}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => { setMoverDetailOpen(false); setLocation(selectedMover?.farmId ? `/market/${selectedMover.farmId}` : "/market/primary"); }}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    View Full Farm Details →
                  </button>
                </div>
              </motion.div>
            </>
          );
        })()}
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

      {/* Investment tips & disclaimer */}
      <div className="mx-4 mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-amber-800 text-xs font-bold mb-2 flex items-center gap-1.5">⚠️ Investment Notice</p>
        <ul className="space-y-1.5">
          <li className="text-amber-700 text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>All farm investments carry risk. Returns are not guaranteed.</li>
          <li className="text-amber-700 text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>Diversify across 3+ farms to reduce exposure to a single crop.</li>
          <li className="text-amber-700 text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>Primary market: 1.5% fee · Secondary market: 0.5% broker fee.</li>
          <li className="text-amber-700 text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>Exit windows: Wide Season (30–60 days) or Full Season (~6 months).</li>
        </ul>
      </div>

      <BottomNav role="investor" />
      <AppTour role="investor" onAskAI={q => { setAiQuestion(q); }} />

      <NotificationPrompt storageKey="investor_notif_v1" />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <AiMatchmaker open={matcherOpen} onClose={() => setMatcherOpen(false)} />
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
