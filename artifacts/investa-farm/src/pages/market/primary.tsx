import { useState, useMemo } from "react";
import { useListPrimaryMarket } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { ArrowLeft, ChevronDown, ChevronUp, BellRing, Calculator, MapPin, Users } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestModal } from "@/components/invest-modal";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getCropImage, CROP_IMAGES } from "@/lib/crops";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { PriceAlertModal } from "@/components/price-alert-modal";
import { InvestmentCalculator } from "@/components/investment-calculator";
import { AiSectionBot } from "@/components/ai-section-bot";

// --- AI insight snippet per farm ---
const AI_INSIGHTS: Record<string, string[]> = {
  maize:       ["Strong demand from millers this season", "Favourable rainfall boosts yield outlook"],
  tomatoes:    ["Urban demand up 18% · good entry point", "Processing contracts driving price stability"],
  coffee:      ["Global arabica prices rising steadily", "Export premiums widening for AA grade"],
  tea:         ["Auction volumes solid · steady income", "Rainfall adequate for top-grade flush"],
  beans:       ["Short supply across Rift Valley now", "High-protein demand pushing farmgate price"],
  avocado:     ["EU export window opens next quarter", "Hass variety premium over 22% this cycle"],
  dairy:       ["Processor intake prices up 8% YoY", "Feed cost stabilising · margins improving"],
  poultry:     ["Flock disease burden easing region-wide", "Table-egg premium sustained through Q3"],
  wheat:       ["Milling demand stable · secure offtake", "Import competition easing · local prices firm"],
  rice:        ["Mwea yields above 5-year average", "Government strategic reserve buying active"],
  sunflower:   ["Edible oil deficit supports farmgate price", "Contract farming schemes expanding"],
  kale:        ["Urban market demand consistently high", "Short cycle crop · fast capital recycling"],
  cabbage:     ["Supermarket chain offtake agreements firm", "Cool-season conditions ideal this month"],
  greenhouse:  ["Year-round harvest smooths revenue curve", "Export-quality veg fetching 2.4× farmgate"],
};

function getAiInsight(cropType: string, changePercent: number, id: number): string {
  const key = (cropType ?? "").toLowerCase();
  const pool = AI_INSIGHTS[key] ?? [
    changePercent > 0 ? "Positive price momentum · watch for entry" : "Price consolidating · monitor closely",
    "AI models show stable seasonal demand",
  ];
  return pool[id % pool.length];
}

// --- Risk helpers ---
const HIGH_RISK_CROPS = new Set(["coffee", "avocado", "tobacco", "horticulture"]);
const MOD_RISK_CROPS  = new Set(["tea", "wheat", "tomatoes", "potatoes", "onions"]);
type RiskLevel = "Low" | "Moderate" | "High";

function getRiskLevel(cropType: string, changePercent: number): RiskLevel {
  const crop = (cropType ?? "").toLowerCase();
  if (HIGH_RISK_CROPS.has(crop) || Math.abs(changePercent) > 5) return "High";
  if (MOD_RISK_CROPS.has(crop) || Math.abs(changePercent) > 2) return "Moderate";
  return "Low";
}

function RiskDots({ level }: { level: RiskLevel }) {
  const filled = level === "High" ? 5 : level === "Moderate" ? 3 : 2;
  const color = level === "High" ? "bg-red-500" : level === "Moderate" ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="flex gap-0.5 items-center">
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= filled ? color : "bg-muted-foreground/20"}`} />
      ))}
    </div>
  );
}

// --- Category helpers ---
type CategoryKey = "all" | "stable" | "balanced" | "export" | "growth";

const CATEGORY_TABS: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: "all",      label: "All",              emoji: "🌍" },
  { key: "stable",   label: "Stable Income",    emoji: "🌾" },
  { key: "balanced", label: "Balanced",         emoji: "⚖️" },
  { key: "export",   label: "Export & Premium", emoji: "✈️" },
  { key: "growth",   label: "High Growth",      emoji: "🚀" },
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
  const boost = Math.max(-4, Math.min(8, Math.round(changePercent * 0.4)));
  return Math.max(4, base + boost);
}

function generateSeasonHistory(basePrice: number, changePercent: number) {
  const times = ["6am", "8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm"];
  const trend = changePercent / 100;
  return times.map((time, i) => {
    const noise = (Math.sin(i * 1.7) * 0.04 + Math.cos(i * 0.9) * 0.03);
    return {
      time,
      value: Math.round(basePrice * (0.92 + (i / 8) * 0.18 + trend * (i / 8) + noise)),
    };
  });
}

// --- Kenya location coordinates for mini-map ---
const KE_COORDS: Record<string, [number, number]> = {
  nairobi: [-1.2921, 36.8219], nakuru: [-0.3031, 36.0800], kisumu: [-0.1022, 34.7617],
  meru: [0.0467, 37.6490], eldoret: [0.5200, 35.2699], narok: [-1.0824, 35.8706],
  nyeri: [-0.4166, 36.9500], kakamega: [0.2827, 34.7519], kitale: [1.0154, 35.0062],
  thika: [-1.0332, 37.0693], laikipia: [0.2000, 36.7000], muranga: [-0.7190, 37.1499],
  embu: [-0.5317, 37.4500], machakos: [-1.5177, 37.2634], kiambu: [-1.1691, 36.8356],
  nyandarua: [-0.1830, 36.3672], kajiado: [-1.8520, 36.7764], bomet: [-0.7876, 35.3437],
  kericho: [-0.3686, 35.2862], siaya: [0.0617, 34.2422], busia: [0.4609, 34.1109],
  turkana: [3.1200, 35.6000], wajir: [1.7473, 40.0573],
};

function getListingCoords(location: string): [number, number] {
  const loc = location.toLowerCase();
  for (const [key, coords] of Object.entries(KE_COORDS)) {
    if (loc.includes(key.replace(/_/g, " ")) || loc.includes(key)) return coords;
  }
  return [-1.2921, 36.8219];
}

function getMiniMapIframeSrc(location: string): string {
  const [lat, lng] = getListingCoords(location);
  const d = 0.22;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${(lng - d).toFixed(4)}%2C${(lat - d * 0.75).toFixed(4)}%2C${(lng + d).toFixed(4)}%2C${(lat + d * 0.75).toFixed(4)}&layer=mapnik&marker=${lat.toFixed(4)}%2C${lng.toFixed(4)}`;
}

type Listing = {
  id: number; farmId: number; farmName: string; cropType: string;
  location: string; pricePerShare: number; sharesAvailable: number;
  changePercent: number; imageUrl?: string;
};

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

  const filteredListings = useMemo(() => {
    if (!listings) return [];
    if (activeCategory === "all") return listings;
    return (listings as any[]).filter(l => getCategoryForCrop(l.cropType) === activeCategory);
  }, [listings, activeCategory]);

  const handleBuyClick = (e: React.MouseEvent, listing: Listing) => {
    e.stopPropagation();
    setSelectedListing(listing); setInvestOpen(true);
  };

  return (
    <div className="app-shell pb-20 page-enter" data-testid="primary-market">
      {/* Compact header */}
      <div className="relative overflow-hidden" style={{ height: 80 }}>
        <img src={CROP_IMAGES.maize} alt="Primary Market" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(120deg, rgba(5,46,22,0.92) 0%, rgba(20,83,45,0.80) 60%, rgba(22,163,74,0.35) 100%)" }} />
        <div className="absolute inset-0 pt-10 px-4 flex items-center">
          <button data-testid="button-back" onClick={() => setLocation("/market")}
            className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mr-2.5">
            <ArrowLeft size={13} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-[9px] font-medium uppercase tracking-wider">Buy Direct from Farmers</p>
            <h1 className="text-white text-sm font-bold leading-tight">Primary Market</h1>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1 flex-shrink-0">
            <span className="text-[10px]">⚡+10%</span>
            <span className="text-white/40 text-[9px]">·</span>
            <span className="text-[10px]">🌾+28%</span>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="px-4 pt-4 pb-1">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeCategory === tab.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-card border border-border text-muted-foreground"
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Column header */}
      <div className="px-5 pt-3 pb-1 grid grid-cols-[1fr_52px_52px_56px] gap-1 items-center">
        <p className="text-muted-foreground text-[9px] font-semibold uppercase tracking-wider">Farm / Crop</p>
        <p className="text-muted-foreground text-[9px] font-semibold uppercase tracking-wider text-center">ROI</p>
        <p className="text-muted-foreground text-[9px] font-semibold uppercase tracking-wider text-center">Risk</p>
        <p className="text-muted-foreground text-[9px] font-semibold uppercase tracking-wider text-center">Action</p>
      </div>

      {/* Listings */}
      <div className="px-4 space-y-2.5 pb-2">
        {isLoading
          ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          : filteredListings.length === 0
            ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">No farms in this category yet.</p>
                <button onClick={() => setActiveCategory("all")} className="text-primary text-sm mt-2 font-medium">
                  Show all farms
                </button>
              </div>
            )
            : (filteredListings as any[]).map((listing) => {
                const isUp = listing.changePercent >= 0;
                const risk = getRiskLevel(listing.cropType, listing.changePercent);
                const targetRoi = getTargetRoi(listing.cropType, listing.changePercent);
                const imgSrc = getCropImage(listing.cropType, listing.imageUrl ?? undefined);
                const isExpanded = expandedId === listing.id;
                const sparkData = generateSparkData(listing.pricePerShare, 12, listing.changePercent / 100);
                const seasonHistory = generateSeasonHistory(listing.pricePerShare, listing.changePercent);
                const aiInsight = getAiInsight(listing.cropType, listing.changePercent, listing.id);

                return (
                  <div key={listing.id} data-testid={`primary-listing-${listing.id}`}
                    className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">

                    {/* Main row */}
                    <div className="grid grid-cols-[1fr_52px_52px_56px] gap-1 items-center px-3 py-2">
                      {/* Farm info with thumbnail */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                          <img src={imgSrc} alt={listing.farmName} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-foreground truncate leading-tight">{listing.farmName}</p>
                          <p className="text-muted-foreground text-[10px] truncate">{listing.cropType} · {listing.location}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[9px] font-bold text-violet-600">🤖 AI</span>
                            <span className="text-[9px] text-muted-foreground truncate">{aiInsight}</span>
                          </div>
                        </div>
                      </div>

                      {/* Target ROI */}
                      <div className="text-center">
                        <p className="text-green-600 font-bold text-sm leading-tight">+{targetRoi}%</p>
                        <p className="text-muted-foreground text-[9px]">target</p>
                      </div>

                      {/* Risk dots */}
                      <div className="flex justify-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <RiskDots level={risk} />
                          <p className="text-muted-foreground text-[9px]">{risk}</p>
                        </div>
                      </div>

                      {/* Buy button */}
                      <div className="flex justify-center">
                        <button
                          data-testid={`button-buy-${listing.id}`}
                          onClick={(e) => handleBuyClick(e, listing as Listing)}
                          className="bg-primary text-white font-bold px-2.5 py-2 rounded-xl text-xs active:scale-95 transition-transform shadow-sm w-full"
                        >
                          BUY
                        </button>
                      </div>
                    </div>

                    {/* Price + sparkline + shares available + details toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : listing.id)}
                      className="w-full border-t border-border/50 px-3 py-2 flex items-center justify-between bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-foreground font-bold text-xs">{formatAmount(listing.pricePerShare)}</span>
                          <span className="text-muted-foreground text-[10px]">/share</span>
                        </div>
                        <span className={`text-[10px] font-semibold ${isUp ? "text-green-600" : "text-red-500"}`}>
                          {isUp ? "▲" : "▼"} {Math.abs(listing.changePercent).toFixed(1)}%
                        </span>
                        <div className="w-12 opacity-70">
                          <Sparkline data={sparkData} color={isUp ? "#16a34a" : "#dc2626"} height={16} />
                        </div>
                        <div className="flex items-center gap-0.5 text-muted-foreground/70">
                          <Users size={9} />
                          <span className="text-[9px]">{listing.sharesAvailable.toLocaleString()} left</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 text-primary text-[10px] font-semibold">
                        {isExpanded ? <><ChevronUp size={12} />Less</> : <><ChevronDown size={12} />Details</>}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                        {/* Mini map + chart side by side */}
                        <div className="flex gap-3 items-stretch">
                          {/* Farm image */}
                          <div className="w-28 flex-shrink-0 rounded-xl overflow-hidden border border-border relative" style={{ minHeight: 110 }}>
                            <img
                              src={imgSrc}
                              alt={listing.farmName}
                              className="w-full h-full object-cover"
                              style={{ minHeight: 110 }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent px-1.5 py-1 flex items-center gap-0.5">
                              <MapPin size={8} className="text-white flex-shrink-0" />
                              <span className="text-white text-[8px] font-semibold truncate">{listing.location}</span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground mb-1">Today's Price</p>
                            <div style={{ height: 110 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={seasonHistory} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id={`grad-${listing.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor={isUp ? "#16a34a40" : "#dc262640"} />
                                      <stop offset="95%" stopColor={isUp ? "#16a34a00" : "#dc262600"} />
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval={1} />
                                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={38}
                                    tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                                  <Tooltip
                                    formatter={(v: number) => [formatKES(v), "KES"]}
                                    labelFormatter={(l) => l}
                                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb", fontWeight: 600 }}
                                  />
                                  <Area type="monotone" dataKey="value"
                                    stroke={isUp ? "#16a34a" : "#dc2626"} strokeWidth={2}
                                    fill={`url(#grad-${listing.id})`} dot={{ fill: isUp ? "#16a34a" : "#dc2626", r: 2 }} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>

                        {/* Location + shares info */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin size={11} className="flex-shrink-0" />
                            <span className="text-[10px]">{listing.location}</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users size={11} className="flex-shrink-0" />
                            <span className="text-[10px]">{listing.sharesAvailable.toLocaleString()} shares left</span>
                          </div>
                          <div className="ml-auto">
                            <span className="text-[9px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              Min: {formatAmount(listing.pricePerShare * 10)} (10 shares)
                            </span>
                          </div>
                        </div>

                        {/* Funding progress bar */}
                        {(listing as any).totalShares > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-semibold text-foreground">Funding Progress</p>
                              <span className="text-[10px] text-primary font-bold">
                                {Math.round(((listing as any).totalShares - listing.sharesAvailable) / (listing as any).totalShares * 100)}% funded
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${Math.min(100, Math.round(((listing as any).totalShares - listing.sharesAvailable) / (listing as any).totalShares * 100))}%` }} />
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[9px] text-muted-foreground">{listing.sharesAvailable.toLocaleString()} remaining</span>
                              <span className="text-[9px] text-muted-foreground">{((listing as any).totalShares ?? 0).toLocaleString()} total shares</span>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Season Low",  value: formatAmount(Math.round(listing.pricePerShare * 0.85)), cls: "text-red-500" },
                            { label: "Current",     value: formatAmount(listing.pricePerShare),                    cls: "text-foreground" },
                            { label: "Target Exit", value: formatAmount(Math.round(listing.pricePerShare * (1 + targetRoi / 100))), cls: "text-green-600" },
                          ].map(({ label, value, cls }) => (
                            <div key={label} className="bg-muted/50 rounded-xl p-2 text-center">
                              <p className="text-muted-foreground text-[8px]">{label}</p>
                              <p className={`font-bold text-[10px] ${cls}`}>{value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-green-700 text-[10px] font-semibold">💰 Return Calculator (100 shares)</p>
                            <AiSectionBot
                              label="this farm's returns"
                              context={`Farm: ${listing.farmName}, crop: ${listing.cropType}, Kenya. Price per share: KES ${listing.pricePerShare}. Market momentum: ${listing.changePercent}%. Risk level: ${getRiskLevel(listing.cropType, listing.changePercent)}. Expected ROI: ${targetRoi}%. Should I invest in this farm?`}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-muted-foreground text-[9px]">⚡ Mid-Season (+10%)</p>
                              <p className="text-orange-600 font-bold text-xs">{formatAmount(Math.round(listing.pricePerShare * 100 * 1.10))}</p>
                              <p className="text-muted-foreground text-[8px]">30–60 days</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[9px]">🌾 Full Season (+{targetRoi}%)</p>
                              <p className="text-green-600 font-bold text-xs">{formatAmount(Math.round(listing.pricePerShare * 100 * (1 + targetRoi / 100)))}</p>
                              <p className="text-muted-foreground text-[8px]">~6 months</p>
                            </div>
                          </div>
                          {(listing as any).dcfFairValue && (
                            <div className="mt-2 pt-2 border-t border-green-200/70 flex items-center justify-between">
                              <span className="text-green-700 text-[9px] font-semibold">DCF Fair Value / share</span>
                              <span className="text-green-800 font-bold text-[11px]">{formatAmount((listing as any).dcfFairValue)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setCalcListing(listing as Listing); setCalcOpen(true); }}
                            className="w-10 h-10 rounded-xl border border-border bg-muted flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
                            title="Investment Calculator"
                          >
                            <Calculator size={16} className="text-muted-foreground" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setAlertListing(listing as Listing); setAlertOpen(true); }}
                            className="w-10 h-10 rounded-xl border border-green-200 bg-green-50 flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
                            title="Set Price Alert"
                          >
                            <BellRing size={16} className="text-green-600" />
                          </button>
                          <button
                            onClick={(e) => handleBuyClick(e, listing as Listing)}
                            className="flex-1 bg-primary text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform"
                          >
                            Invest in {listing.cropType} →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
        }
      </div>

      <InvestModal open={investOpen} onClose={() => setInvestOpen(false)} listing={selectedListing} />
      <PriceAlertModal open={alertOpen} onClose={() => setAlertOpen(false)} listing={alertListing} />
      <InvestmentCalculator open={calcOpen} onClose={() => setCalcOpen(false)} listing={calcListing} />
      <BottomNav role="investor" />
    </div>
  );
}
