import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useListPrimaryMarket } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getStoredUser } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { ArrowLeft, TrendingUp, TrendingDown, Search, SlidersHorizontal, ChevronDown, ChevronUp, Zap, X, Users, Bell } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestModal } from "@/components/invest-modal";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getCropImage } from "@/lib/crops";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { PriceAlertModal } from "@/components/price-alert-modal";
import { InvestmentCalculator } from "@/components/investment-calculator";

const AI_INSIGHTS: Record<string, string[]> = {
  maize:       ["Strong demand from millers", "Favourable rainfall outlook"],
  tomatoes:    ["Urban demand up 18%", "Processing contracts stable"],
  coffee:      ["Arabica prices rising", "Export premiums widening"],
  tea:         ["Auction volumes solid", "Rainfall adequate for flush"],
  beans:       ["Short supply Rift Valley", "High-protein demand rising"],
  avocado:     ["EU export window opens Q4", "Hass variety +22% premium"],
  dairy:       ["Processor prices up 8% YoY", "Feed costs stabilising"],
  poultry:     ["Disease burden easing", "Table-egg premium sustained"],
  wheat:       ["Milling demand stable", "Import competition easing"],
  rice:        ["Mwea yields above avg", "Strategic reserve buying"],
  sunflower:   ["Edible oil deficit firm", "Contract schemes expanding"],
  kale:        ["Urban demand high", "Short cycle · fast turnover"],
};

function getAiInsight(cropType: string, changePercent: number, id: number): string {
  const key = (cropType ?? "").toLowerCase();
  const pool = AI_INSIGHTS[key] ?? [changePercent > 0 ? "Positive momentum" : "Consolidating", "Stable demand"];
  return pool[id % pool.length];
}

const HIGH_RISK_CROPS = new Set(["coffee", "avocado", "tobacco", "horticulture"]);
const MOD_RISK_CROPS  = new Set(["tea", "wheat", "tomatoes", "potatoes", "onions"]);
type RiskLevel = "Low" | "Mod" | "High";

function getRiskLevel(cropType: string, changePercent: number): RiskLevel {
  const crop = (cropType ?? "").toLowerCase();
  if (HIGH_RISK_CROPS.has(crop) || Math.abs(changePercent) > 5) return "High";
  if (MOD_RISK_CROPS.has(crop) || Math.abs(changePercent) > 2) return "Mod";
  return "Low";
}

type CategoryKey = "all" | "stable" | "balanced" | "export" | "growth";
const CATEGORY_TABS: { key: CategoryKey; label: string; short: string }[] = [
  { key: "all",      label: "All Markets",     short: "ALL"  },
  { key: "stable",   label: "Stable Income",   short: "STBL" },
  { key: "balanced", label: "Balanced",        short: "BAL"  },
  { key: "export",   label: "Export Grade",    short: "EXPT" },
  { key: "growth",   label: "High Growth",     short: "GRTH" },
];
const CATEGORY_CROPS: Record<Exclude<CategoryKey, "all">, string[]> = {
  stable:   ["maize", "corn", "wheat", "sorghum", "barley", "beans", "cassava", "rice", "grain"],
  balanced: ["tomatoes", "potatoes", "dairy", "cattle", "kale", "onions", "capsicum", "sugarcane"],
  export:   ["coffee", "tea", "avocado", "macadamia", "sunflower", "tobacco"],
  growth:   ["poultry", "chicken", "horticulture", "greenhouse", "strawberries"],
};
function getCategoryForCrop(cropType: string): Exclude<CategoryKey, "all"> {
  const crop = (cropType ?? "").toLowerCase();
  for (const [cat, crops] of Object.entries(CATEGORY_CROPS)) {
    if (crops.some(c => crop.includes(c) || c.includes(crop))) return cat as Exclude<CategoryKey, "all">;
  }
  return "stable";
}
function getTargetRoi(cropType: string, changePercent: number): number {
  const crop = (cropType ?? "").toLowerCase();
  const isExport   = CATEGORY_CROPS.export.some(c => crop.includes(c));
  const isGrowth   = CATEGORY_CROPS.growth.some(c => crop.includes(c));
  const isBalanced = CATEGORY_CROPS.balanced.some(c => crop.includes(c));
  const base = isExport ? 20 : isGrowth ? 22 : isBalanced ? 14 : 10;
  return Math.max(4, base + Math.round(changePercent * 0.4));
}

function generateSeasonHistory(basePrice: number, changePercent: number) {
  const times = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
  return times.map((time, i) => {
    const noise = Math.sin(i * 1.7) * 0.04 + Math.cos(i * 0.9) * 0.03;
    return { time, value: Math.round(basePrice * (0.92 + (i / 8) * 0.18 + (changePercent / 100) * (i / 8) + noise)) };
  });
}

type Listing = {
  id: number; farmId: number; farmName: string; cropType: string;
  location: string; pricePerShare: number; sharesAvailable: number;
  changePercent: number; imageUrl?: string;
};

function TickerTape({ listings }: { listings: Listing[] }) {
  const items = listings.slice(0, 8);
  if (!items.length) return null;
  return (
    <div className="overflow-hidden border-b border-border bg-muted/40">
      <motion.div
        className="flex gap-6 whitespace-nowrap py-1.5 px-3"
        animate={{ x: [0, -1200] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items].map((l, i) => {
          const up = l.changePercent >= 0;
          const ticker = l.cropType.slice(0, 4).toUpperCase();
          return (
            <span key={i} className="text-[10px] font-bold tracking-wide inline-flex items-center gap-1.5">
              <span className="text-muted-foreground">{ticker}</span>
              <span className="text-foreground font-mono">{formatKES(l.pricePerShare)}</span>
              <span className={up ? "text-green-600" : "text-red-500"}>
                {up ? "▲" : "▼"}{Math.abs(l.changePercent).toFixed(1)}%
              </span>
            </span>
          );
        })}
      </motion.div>
    </div>
  );
}

export default function PrimaryMarket() {
  const [, setLocation] = useLocation();
  const { formatAmount } = useCurrency();
  const { data: listings, isLoading } = useListPrimaryMarket();
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [investOpen, setInvestOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [alertListing, setAlertListing] = useState<Listing | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [calcListing, setCalcListing] = useState<Listing | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"roi" | "price" | "change">("roi");

  const filteredListings = useMemo(() => {
    if (!listings) return [];
    let list = listings as Listing[];
    if (activeCategory !== "all") list = list.filter(l => getCategoryForCrop(l.cropType) === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l => l.farmName.toLowerCase().includes(q) || l.cropType.toLowerCase().includes(q) || l.location.toLowerCase().includes(q));
    }
    if (sortBy === "roi") list = [...list].sort((a, b) => getTargetRoi(b.cropType, b.changePercent) - getTargetRoi(a.cropType, a.changePercent));
    if (sortBy === "price") list = [...list].sort((a, b) => a.pricePerShare - b.pricePerShare);
    if (sortBy === "change") list = [...list].sort((a, b) => b.changePercent - a.changePercent);
    return list;
  }, [listings, activeCategory, search, sortBy]);

  const allListings = (listings as Listing[]) ?? [];
  const gainers = allListings.filter(l => l.changePercent > 0).length;
  const losers  = allListings.filter(l => l.changePercent < 0).length;
  const avgRoi  = allListings.length ? (allListings.reduce((s, l) => s + getTargetRoi(l.cropType, l.changePercent), 0) / allListings.length).toFixed(1) : "—";

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col pb-20 bg-background">

      {/* Header */}
      <div className="bg-background border-b border-border">
        <div className="flex items-center gap-3 px-4 pt-12 pb-3">
          <button onClick={() => setLocation("/market")}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform bg-muted border border-border">
            <ArrowLeft size={14} className="text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[9px] font-bold tracking-[0.15em] text-primary/70 uppercase">Primary Exchange</span>
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 border border-green-200">
                <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[8px] font-bold text-green-700 tracking-wider">OPEN</span>
              </span>
            </div>
            <h1 className="text-foreground font-extrabold text-lg tracking-tight leading-none">Primary Market</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSortBy(s => s === "roi" ? "price" : s === "price" ? "change" : "roi")}
              className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-transform bg-muted border border-border">
              <SlidersHorizontal size={13} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Ticker tape */}
        {!isLoading && allListings.length > 0 && <TickerTape listings={allListings} />}

        {/* Market summary stats */}
        <div className="grid grid-cols-4 border-t border-border">
          {[
            { label: "LISTED", value: allListings.length || "—", color: "text-foreground" },
            { label: "GAINERS", value: gainers, color: "text-green-600" },
            { label: "LOSERS", value: losers, color: "text-red-500" },
            { label: "AVG ROI", value: avgRoi ? `${avgRoi}%` : "—", color: "text-green-700" },
          ].map((s, i) => (
            <div key={i} className="px-3 py-2 text-center border-r border-border last:border-0">
              <p className={`text-sm font-black leading-none ${s.color}`}>{s.value}</p>
              <p className="text-[8px] font-bold text-muted-foreground tracking-widest mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search + Sort bar */}
      <div className="px-4 pt-3 pb-2 space-y-2 bg-background">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted border border-border">
          <Search size={13} className="text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search farm, crop, or county…"
            className="flex-1 bg-transparent text-foreground text-xs placeholder-muted-foreground outline-none font-medium"
          />
          {search && <button onClick={() => setSearch("")}><X size={11} className="text-muted-foreground" /></button>}
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {CATEGORY_TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveCategory(tab.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all ${
                activeCategory === tab.key
                  ? "text-white bg-primary shadow-sm"
                  : "text-muted-foreground bg-muted border border-border hover:text-foreground"
              }`}>
              {tab.short}
            </button>
          ))}
        </div>

        {/* Sort indicator */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Sorted by</span>
          {[{k:"roi",l:"Target ROI"},{k:"change",l:"% Change"},{k:"price",l:"Price"}].map(s => (
            <button key={s.k} onClick={() => setSortBy(s.k as any)}
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-all ${sortBy === s.k ? "text-primary bg-primary/10" : "text-muted-foreground"}`}>
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="px-4 grid grid-cols-[1fr_48px_44px_52px] gap-1 items-center mb-1 border-b border-border pb-1.5 bg-background">
        <p className="text-[8px] font-black tracking-[0.15em] text-muted-foreground uppercase">ASSET / FARM</p>
        <p className="text-[8px] font-black tracking-[0.15em] text-muted-foreground uppercase text-right">ROI</p>
        <p className="text-[8px] font-black tracking-[0.15em] text-muted-foreground uppercase text-right">CHG%</p>
        <p className="text-[8px] font-black tracking-[0.15em] text-muted-foreground uppercase text-center">ACTION</p>
      </div>

      {/* Listings */}
      <div className="flex-1 px-4 space-y-1.5 pb-2">
        {isLoading
          ? Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse bg-muted" />
            ))
          : filteredListings.length === 0
            ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-primary/5 border border-primary/10">
                  <TrendingUp size={24} className="text-primary/40" />
                </div>
                <p className="text-muted-foreground text-sm font-semibold">No listings found</p>
                <button onClick={() => { setActiveCategory("all"); setSearch(""); }} className="text-primary text-xs mt-2 font-bold">Clear filters</button>
              </div>
            )
            : (filteredListings as Listing[]).map((listing, idx) => {
                const isUp = listing.changePercent >= 0;
                const roi = getTargetRoi(listing.cropType, listing.changePercent);
                const imgSrc = getCropImage(listing.cropType, listing.imageUrl ?? undefined);
                const isExpanded = expandedId === listing.id;
                const sparkData = generateSparkData(listing.pricePerShare, 14, listing.changePercent / 100);
                const seasonHistory = generateSeasonHistory(listing.pricePerShare, listing.changePercent);
                const insight = getAiInsight(listing.cropType, listing.changePercent, listing.id);
                const risk = getRiskLevel(listing.cropType, listing.changePercent);
                const ticker = listing.cropType.slice(0, 3).toUpperCase();

                return (
                  <motion.div key={listing.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="rounded-xl overflow-hidden bg-card border border-border shadow-sm">

                    {/* Main row */}
                    <div className="grid grid-cols-[1fr_48px_44px_52px] gap-1 items-center px-3 py-2.5">
                      {/* Asset info */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-lg overflow-hidden">
                            <img src={imgSrc} alt={listing.farmName} className="w-full h-full object-cover" />
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 text-[7px] font-black px-1 rounded ${isUp ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                            {ticker}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-[11px] text-foreground truncate leading-tight">{listing.farmName}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-muted-foreground text-[9px] font-mono">{formatAmount(listing.pricePerShare)}</span>
                            <span className="text-muted-foreground/40 text-[8px]">·</span>
                            <span className="text-muted-foreground text-[9px] truncate">{listing.location.split(",")[0]}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[8px] font-black text-violet-600 bg-violet-50 border border-violet-100 px-1 py-0.5 rounded">AI</span>
                            <span className="text-[9px] text-muted-foreground truncate leading-tight">{insight}</span>
                          </div>
                        </div>
                      </div>

                      {/* ROI */}
                      <div className="text-right">
                        <p className="text-green-600 font-black text-sm leading-none font-mono">+{roi}%</p>
                        <p className="text-muted-foreground text-[8px] mt-0.5">target</p>
                      </div>

                      {/* Change */}
                      <div className="text-right">
                        <p className={`font-black text-sm leading-none font-mono ${isUp ? "text-green-600" : "text-red-500"}`}>
                          {isUp ? "+" : ""}{listing.changePercent.toFixed(1)}%
                        </p>
                        <p className="text-muted-foreground text-[8px] mt-0.5">{risk}</p>
                      </div>

                      {/* Buy button */}
                      <div className="flex justify-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedListing(listing); setInvestOpen(true); }}
                          className="px-2.5 py-2 rounded-lg text-[10px] font-black tracking-wide text-white active:scale-90 transition-transform shadow-sm w-full bg-primary hover:bg-primary/90">
                          BUY
                        </button>
                      </div>
                    </div>

                    {/* Sparkline + expand row */}
                    <button onClick={() => setExpandedId(isExpanded ? null : listing.id)}
                      className="w-full px-3 pb-2.5 flex items-center gap-3 active:bg-muted/50 transition-colors">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="w-20 opacity-80">
                          <Sparkline data={sparkData} color={isUp ? "#16a34a" : "#ef4444"} height={18} />
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users size={8} />
                          <span className="text-[9px] font-mono">{listing.sharesAvailable.toLocaleString()}</span>
                          <span className="text-[8px]">avail</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setAlertListing(listing); setAlertOpen(true); }}
                          className="w-6 h-6 rounded-md flex items-center justify-center active:scale-90 transition-transform bg-muted border border-border">
                          <Bell size={9} className="text-muted-foreground" />
                        </button>
                        <div className="flex items-center gap-0.5 text-muted-foreground text-[9px] font-semibold ml-1">
                          {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail panel */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-border"
                        >
                          <div className="px-4 py-4 space-y-4 bg-muted/20">
                            {/* Price chart */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">Today's Price Action</p>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded font-mono ${isUp ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>
                                  {isUp ? "▲" : "▼"} {Math.abs(listing.changePercent).toFixed(2)}%
                                </span>
                              </div>
                              <div style={{ height: 110 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={seasonHistory} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                      <linearGradient id={`g-${listing.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isUp ? "#16a34a" : "#ef4444"} stopOpacity={0.15} />
                                        <stop offset="95%" stopColor={isUp ? "#16a34a" : "#ef4444"} stopOpacity={0} />
                                      </linearGradient>
                                    </defs>
                                    <XAxis dataKey="time" tick={{ fontSize: 8, fill: "#94a3b8", fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={1} />
                                    <YAxis hide />
                                    <Tooltip
                                      contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 10, fontFamily: "monospace" }}
                                      labelStyle={{ color: "#94a3b8", fontSize: 8 }}
                                      itemStyle={{ color: isUp ? "#16a34a" : "#ef4444", fontWeight: 800 }}
                                      formatter={(v: number) => [formatKES(v), "Price"]}
                                    />
                                    <Area type="monotone" dataKey="value" stroke={isUp ? "#16a34a" : "#ef4444"} strokeWidth={1.5} fill={`url(#g-${listing.id})`} dot={false} />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            {/* Key metrics grid */}
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: "Share Price", value: formatAmount(listing.pricePerShare) },
                                { label: "Target ROI", value: `+${getTargetRoi(listing.cropType, listing.changePercent)}%`, color: "text-green-600" },
                                { label: "Shares Left", value: listing.sharesAvailable.toLocaleString() },
                              ].map((m, i) => (
                                <div key={i} className="rounded-lg px-2.5 py-2 text-center bg-card border border-border">
                                  <p className={`font-black text-xs leading-none ${(m as any).color ?? "text-foreground"}`}>{m.value}</p>
                                  <p className="text-[8px] text-muted-foreground mt-1 tracking-wider uppercase">{m.label}</p>
                                </div>
                              ))}
                            </div>

                            {/* Action buttons */}
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => { setSelectedListing(listing); setInvestOpen(true); }}
                                className="py-3 rounded-xl text-xs font-black text-white tracking-wide active:scale-95 transition-transform bg-primary hover:bg-primary/90">
                                ⚡ Invest Now
                              </button>
                              <button
                                onClick={() => { setCalcListing(listing); setCalcOpen(true); }}
                                className="py-3 rounded-xl text-xs font-bold text-foreground active:scale-95 transition-transform bg-muted border border-border">
                                📊 Calculate
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
        }
      </div>

      <BottomNav role="investor" />

      {selectedListing && investOpen && (
        <InvestModal open={investOpen} onClose={() => setInvestOpen(false)} listing={selectedListing as any} />
      )}
      {alertListing && alertOpen && (
        <PriceAlertModal open={alertOpen} onClose={() => setAlertOpen(false)} listing={alertListing as any} />
      )}
      {calcListing && calcOpen && (
        <InvestmentCalculator open={calcOpen} onClose={() => setCalcOpen(false)} listing={calcListing as any} />
      )}
    </div>
  );
}
