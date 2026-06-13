import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Bell, ChevronRight, TrendingUp, TrendingDown, Newspaper, BookmarkPlus, Clock, Wallet, AlertTriangle, ShieldCheck, Minus, Star, Map, Calculator, BellRing, ExternalLink, ChevronDown, CheckCircle2, X, DollarSign } from "lucide-react";
import {
  useGetTopMovers,
  useListPrimaryMarket,
  useGetMarketSummary,
} from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { formatChange, getToken, formatKES } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestModal } from "@/components/invest-modal";
import { getCropImage, CROP_IMAGES } from "@/lib/crops";
import { CoachMark } from "@/components/coach-mark";
import { NotificationPrompt } from "@/components/notification-prompt";
import { AiAssistant } from "@/components/ai-assistant";
import { AppTour } from "@/components/app-tour";
import { NotificationsPanel } from "@/components/notifications-panel";
import { useCurrency } from "@/lib/currency";
import { InvestmentCalculator } from "@/components/investment-calculator";
import { PriceAlertModal } from "@/components/price-alert-modal";
import { motion, AnimatePresence } from "framer-motion";

const CROPS = [
  { name: "Maize",    change: 2.1  },
  { name: "Tomatoes", change: -1.3 },
  { name: "Avocado",  change: 0.8  },
  { name: "Tea",      change: 1.4  },
  { name: "Coffee",   change: -0.6 },
  { name: "Beans",    change: 3.2  },
  { name: "Wheat",    change: 0.5  },
  { name: "Potatoes", change: -0.9 },
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
  if (level === "High") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
        <AlertTriangle size={7} /> High Risk
      </span>
    );
  }
  if (level === "Moderate") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <Minus size={7} /> Moderate
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
      <ShieldCheck size={7} /> Low Risk
    </span>
  );
}

export default function MarketHome() {
  const [, setLocation] = useLocation();
  const { data: movers, isLoading: moversLoading } = useGetTopMovers();
  const { data: listings, isLoading: listingsLoading } = useListPrimaryMarket();
  const { data: summary } = useGetMarketSummary();
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [investOpen, setInvestOpen] = useState(false);
  const [watchlisted, setWatchlisted] = useState<Set<number>>(new Set());
  const [activeSection, setActiveSection] = useState<"market" | "news" | "watchlist">("market");
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
  const [calcListing, setCalcListing] = useState<any>(null);
  const [alertListing, setAlertListing] = useState<any>(null);
  const token = getToken();
  const { formatAmount } = useCurrency();

  const [expandedNews, setExpandedNews] = useState<number | null>(null);

  const { data: newsItems, isLoading: newsLoading } = useQuery<any[]>({
    queryKey: ["news"],
    queryFn: async () => {
      const r = await fetch("/api/news");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30 * 60 * 1000,
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
  const tickerItems = [...CROPS, ...CROPS];

  const handleBuyClick = (e: React.MouseEvent, listing: Listing) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedListing(listing); setInvestOpen(true);
  };

  return (
    <div className="app-shell pb-20 page-enter" data-testid="market-home">
      <div className="bg-background border-b border-border relative overflow-hidden pt-12 pb-4 px-5" data-tour="market-header">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">Farm Exchange</p>
              <span className="inline-flex items-center gap-1 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-600 text-[9px] font-bold uppercase tracking-wider">Live</span>
              </span>
            </div>
            <h1 className="text-foreground text-xl font-bold flex items-center gap-1.5">
              Live Market <TrendingUp size={16} className="text-primary" />
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {walletBalance !== undefined && (
              <button
                data-tour="wallet-btn"
                onClick={() => setLocation("/profile")}
                className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5"
              >
                <Wallet size={12} className="text-primary" />
                <span className="text-primary text-xs font-bold">{formatAmount(parseFloat(walletBalance ?? "0"))}</span>
              </button>
            )}
            <button
              onClick={() => setLocation("/market/map")}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center border border-border"
              title="Farm Map"
            >
              <Map size={17} className="text-foreground" />
            </button>
            <button
              onClick={() => setNotifOpen(true)}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center relative border border-border"
            >
              <Bell size={17} className="text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[7px] text-white font-bold flex items-center justify-center">
                  {Math.min(unreadCount, 9)}
                </span>
              )}
            </button>
          </div>
        </div>

        {summary && (
          <div className="relative grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "Turnover",   val: formatAmount((summary.totalVolumeKes ?? 0)), icon: "💰" },
              { label: "Avg Return", val: `+${summary.averageReturn}%`,                icon: "📈" },
              { label: "Listings",   val: String(summary.totalListings),               icon: "🌾" },
            ].map(({ label, val, icon }) => (
              <div key={label} className="bg-primary/5 rounded-2xl p-2.5 text-center border border-primary/15">
                <p className="text-[11px] mb-0.5">{icon}</p>
                <p className="text-foreground font-bold text-sm">{val}</p>
                <p className="text-muted-foreground text-[9px] mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="relative overflow-hidden rounded-xl bg-muted border border-border">
          <div className="flex ticker-track whitespace-nowrap py-2">
            {tickerItems.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-4 text-xs font-medium">
                <span className="text-foreground/80">{c.name}</span>
                <span className={c.change >= 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                  {formatChange(c.change)}
                </span>
                <span className="text-border ml-1">|</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="px-4 pt-3">
        <div className="flex bg-muted rounded-2xl p-1 gap-1">
          {(["market", "news", "watchlist"] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${activeSection === s ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {s === "watchlist" ? "Watchlist" : s === "news" ? "📰 News" : "📊 Market"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {activeSection === "market" && (
          <>
            {/* Top Movers */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-foreground text-sm">Top Movers Today</h2>
                <Link href="/market/primary">
                  <span className="text-primary text-xs font-medium flex items-center gap-0.5">
                    View All <ChevronRight size={13} />
                  </span>
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                {moversLoading
                  ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="w-36 h-28 rounded-2xl flex-shrink-0" />)
                  : movers?.slice(0, 5).map((m: any) => {
                      const risk = getRiskLevel(m.cropType ?? "", m.changePercent);
                      return (
                        <Link key={m.farmId} href={`/market/${m.farmId}`}>
                          <div className="flex-shrink-0 w-36 rounded-2xl overflow-hidden relative cursor-pointer active:scale-95 transition-transform card-lift">
                            <img
                              src={getCropImage(m.cropType ?? "", m.imageUrl ?? undefined)}
                              alt={m.farmName}
                              className="w-full h-28 object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2.5 flex flex-col justify-end">
                              <p className="text-white text-xs font-semibold leading-tight">{m.farmName}</p>
                              <p className="text-white/70 text-[10px]">{formatAmount(m.currentPrice)}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className={`text-[10px] font-bold ${m.changePercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                                  {formatChange(m.changePercent)}
                                </span>
                              </div>
                              <div className="mt-1">
                                <RiskBadge level={risk} />
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
              </div>
            </section>

            {/* Market type links */}
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/market/primary">
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 cursor-pointer active:scale-95 transition-transform">
                  <p className="text-primary font-bold text-sm">Primary Market</p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">Buy from farmers directly</p>
                </div>
              </Link>
              <Link href="/market/secondary">
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 cursor-pointer active:scale-95 transition-transform">
                  <p className="text-primary font-bold text-sm">Secondary Market</p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">Trade between investors</p>
                </div>
              </Link>
            </div>

            {/* Risk level legend */}
            <div className="bg-card border border-border rounded-2xl p-3 flex items-center gap-4">
              <p className="text-muted-foreground text-[10px] font-medium flex-shrink-0">Risk levels:</p>
              <div className="flex items-center gap-2 flex-wrap">
                <RiskBadge level="Low" />
                <RiskBadge level="Moderate" />
                <RiskBadge level="High" />
              </div>
            </div>

            {/* Market Listings */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-foreground text-sm">All Listings</h2>
                {listings && listings.length > 0 && (
                  <span className="text-muted-foreground text-[10px]">{listings.length} farms</span>
                )}
              </div>
              <div className="space-y-3">
                {listingsLoading
                  ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
                  : listings?.length === 0
                    ? (
                      <div className="text-center py-10 bg-muted/30 rounded-2xl border border-border">
                        <TrendingUp size={28} className="text-muted-foreground mx-auto mb-2" />
                        <p className="text-foreground font-semibold text-sm">No listings yet</p>
                        <p className="text-muted-foreground text-xs mt-1">Farms will appear here as farmers list them</p>
                      </div>
                    )
                    : listings?.map((listing: any, idx: number) => {
                        const sparkData = generateSparkData(listing.pricePerShare, 12, listing.changePercent / 100);
                        const isUp = listing.changePercent >= 0;
                        const imgSrc = getCropImage(listing.cropType, listing.imageUrl ?? undefined);
                        const risk = getRiskLevel(listing.cropType, listing.changePercent);
                        const isFeatured = idx === 0;
                        return (
                          <Link key={listing.id} href={`/market/${listing.farmId}`}>
                            <div className={`rounded-2xl border overflow-hidden cursor-pointer active:scale-[0.98] transition-all shadow-sm ${isFeatured ? "border-primary/30 shadow-primary/10" : "border-border bg-card"}`}>
                              {isFeatured && (
                                <div className="bg-gradient-to-r from-primary/90 to-green-600 px-4 py-1.5 flex items-center gap-1.5">
                                  <Star size={10} className="text-white fill-white" />
                                  <span className="text-white text-[9px] font-bold uppercase tracking-wider">Featured Listing</span>
                                </div>
                              )}
                              <div className={`flex items-center gap-3 p-3 ${isFeatured ? "bg-primary/5" : "bg-card"}`}>
                                <div className="relative flex-shrink-0">
                                  <img src={imgSrc} alt={listing.farmName}
                                    className="w-14 h-14 rounded-xl object-cover" />
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
                        );
                      })}
              </div>
            </section>
          </>
        )}

        {activeSection === "news" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Newspaper size={15} className="text-primary" />
                <h2 className="font-semibold text-sm text-foreground">Agriculture & Market News</h2>
              </div>
              <span className="text-muted-foreground text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live feed
              </span>
            </div>
            {newsLoading
              ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)
              : (newsItems ?? []).map((item: any) => {
                  const isExpanded = expandedNews === item.id;
                  return (
                    <div
                      key={item.id}
                      className="bg-card rounded-2xl border border-border overflow-hidden"
                    >
                      {/* Thumbnail */}
                      <div className="relative">
                        <img src={getNewsImage(item)} alt={item.title} className="w-full h-32 object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <span className={`absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${item.tagColor || "bg-green-100 text-green-700"}`}>
                          {item.tag}
                        </span>
                      </div>

                      {/* Tap to expand */}
                      <button
                        className="w-full text-left p-3.5 active:bg-muted/30 transition-colors"
                        onClick={() => setExpandedNews(isExpanded ? null : item.id)}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-muted-foreground text-[10px] flex items-center gap-1">
                            <Clock size={9} /> {item.time}
                          </span>
                          <span className="text-primary/60 text-[10px] font-medium truncate">{item.source}</span>
                          <ChevronDown
                            size={13}
                            className={`ml-auto text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                        <p className="text-foreground font-semibold text-sm leading-snug">{item.title}</p>
                      </button>

                      {/* Expanded body */}
                      {isExpanded && (
                        <div className="px-3.5 pb-3.5 pt-0 border-t border-border">
                          <p className="text-muted-foreground text-sm leading-relaxed mt-3">{item.summary}</p>
                          {item.url && item.url !== "#" && (
                            <button
                              onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                              className="inline-flex items-center gap-1.5 mt-3 text-primary text-xs font-semibold hover:text-primary/80 transition-colors active:scale-95"
                            >
                              Read full article <ExternalLink size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center">
              <Newspaper size={20} className="text-primary mx-auto mb-2" />
              <p className="text-primary font-semibold text-sm">Live Agriculture News</p>
              <p className="text-muted-foreground text-xs mt-0.5">Kenya agri-market news from online sources · refreshed every 30 min</p>
            </div>
          </section>
        )}

        {activeSection === "watchlist" && (
          <section className="space-y-3">
            {/* Grass-green watchlist header */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #16a34a 100%)" }}>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-green-300 text-[10px] font-bold uppercase tracking-widest mb-0.5">🌱 Season Watchlist</p>
                  <h2 className="text-white font-bold text-base leading-tight">Upcoming Crop Seasons</h2>
                  <p className="text-white/60 text-xs mt-0.5">Commit funds before listings go live</p>
                </div>
                {Object.values(committed).reduce((a, b) => a + b, 0) > 0 && (
                  <div className="text-right">
                    <p className="text-white/60 text-[10px]">Committed</p>
                    <p className="text-green-300 font-bold text-sm">{formatKES(Object.values(committed).reduce((a, b) => a + b, 0))}</p>
                  </div>
                )}
              </div>
            </div>
            {WATCHLIST_CROPS.map(crop => (
              <div key={crop.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="relative h-28">
                  <img src={crop.image} alt={crop.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30" />
                  <div className="absolute inset-0 p-3 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white font-bold text-lg">{crop.name}</p>
                        <p className="text-white/70 text-xs">{crop.season}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/60 text-[9px]">Expected Return</p>
                        <p className="text-green-400 font-bold text-base">{crop.expectedReturn}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${crop.demandColor}`}>{crop.demand} Demand</span>
                      <span className="text-white/60 text-[9px]">{crop.farms} farms available</span>
                      <RiskBadge level={getRiskLevel(crop.name, crop.change)} />
                    </div>
                  </div>
                </div>
                <div className="p-3 flex items-center gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-muted-foreground text-[9px]">Planting Starts</p>
                      <p className="text-foreground font-semibold text-xs">{crop.plantingStart}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[9px]">Est. Harvest</p>
                      <p className="text-foreground font-semibold text-xs">{crop.harvestEst}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setWatchlisted(s => { const n = new Set(s); n.has(crop.id) ? n.delete(crop.id) : n.add(crop.id); return n; })}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${watchlisted.has(crop.id) ? "bg-primary border-primary" : "border-border"}`}>
                      <BookmarkPlus size={14} className={watchlisted.has(crop.id) ? "text-white" : "text-muted-foreground"} />
                    </button>
                    {committed[crop.id] ? (
                      <button
                        onClick={() => { setCommitCrop(crop); setCommitInput(String(committed[crop.id])); setCommitOpen(true); }}
                        className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform">
                        <CheckCircle2 size={12} />
                        {formatKES(committed[crop.id])}
                      </button>
                    ) : (
                      <button
                        onClick={() => { setCommitCrop(crop); setCommitInput(""); setCommitOpen(true); }}
                        className="bg-primary text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform flex items-center gap-1">
                        <DollarSign size={11} />
                        Commit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="text-green-700 font-semibold text-sm mb-1">💡 Planting Season Tip</p>
              <p className="text-green-600 text-xs leading-relaxed">
                Investing at the planting stage gives you exposure to the full season return of up to +28%. Early investors often get the best share prices before demand rises.
              </p>
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
        { target: "[data-testid='market-home']", title: "Welcome, Investor!", body: "Browse live farm listings here. Each one shows a risk badge — Low, Moderate, or High.", position: "bottom" },
        { target: "[data-testid='nav-portfolio']", title: "Your Portfolio", body: "Track your farm share holdings, returns, and request exits.", position: "top" },
        { target: "[data-testid='nav-activity']", title: "Activity Feed", body: "Your full transaction history and investment receipts live here.", position: "top" },
        { target: "[data-testid='nav-profile']", title: "Profile & KYC", body: "Complete identity verification (KYC) to unlock trading and payouts.", position: "top" },
      ]} />
      <NotificationPrompt storageKey="investor_notif_v1" />
      <AiAssistant initialQuestion={aiQuestion} />

      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
