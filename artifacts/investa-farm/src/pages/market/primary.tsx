import { useState, useMemo } from "react";
import { useListPrimaryMarket } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES } from "@/lib/auth";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestModal } from "@/components/invest-modal";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { getCropImage, CROP_IMAGES } from "@/lib/crops";
import { Sparkline, generateSparkData } from "@/components/sparkline";

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

function getTargetRoi(cropType: string, id: number): number {
  const crop = (cropType ?? "").toLowerCase();
  const isExport   = CATEGORY_CROPS.export.some(c => crop.includes(c));
  const isGrowth   = CATEGORY_CROPS.growth.some(c => crop.includes(c));
  const isBalanced = CATEGORY_CROPS.balanced.some(c => crop.includes(c));
  const base = isExport ? 20 : isGrowth ? 22 : isBalanced ? 14 : 10;
  return base + (id % 7);
}

function generateSeasonHistory(basePrice: number) {
  const months = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  return months.map((month, i) => ({
    month,
    value: Math.round(basePrice * (0.85 + (i / 8) * 0.3)),
  }));
}

type Listing = {
  id: number; farmId: number; farmName: string; cropType: string;
  location: string; pricePerShare: number; sharesAvailable: number;
  changePercent: number; imageUrl?: string;
};

export default function PrimaryMarket() {
  const [, setLocation] = useLocation();
  const { data: listings, isLoading } = useListPrimaryMarket();
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [investOpen, setInvestOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");

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
                const targetRoi = getTargetRoi(listing.cropType, listing.id);
                const imgSrc = getCropImage(listing.cropType, listing.imageUrl ?? undefined);
                const isExpanded = expandedId === listing.id;
                const sparkData = generateSparkData(listing.pricePerShare, 12, listing.changePercent / 100);
                const seasonHistory = generateSeasonHistory(listing.pricePerShare);

                return (
                  <div key={listing.id} data-testid={`primary-listing-${listing.id}`}
                    className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">

                    {/* Main row */}
                    <div className="grid grid-cols-[1fr_52px_52px_56px] gap-1 items-center px-3 py-2.5">
                      {/* Farm info with thumbnail */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
                          <img src={imgSrc} alt={listing.farmName} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-foreground truncate leading-tight">{listing.farmName}</p>
                          <p className="text-muted-foreground text-[10px] truncate">{listing.cropType}</p>
                          <p className="text-muted-foreground text-[10px] truncate">{listing.location}</p>
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

                    {/* Price + sparkline + details toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : listing.id)}
                      className="w-full border-t border-border/50 px-3 py-2 flex items-center justify-between bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-foreground font-bold text-xs">{formatKES(listing.pricePerShare)}</span>
                          <span className="text-muted-foreground text-[10px]">/share</span>
                        </div>
                        <span className={`text-[10px] font-semibold ${isUp ? "text-green-600" : "text-red-500"}`}>
                          {isUp ? "▲" : "▼"} {Math.abs(listing.changePercent).toFixed(1)}%
                        </span>
                        <div className="w-12 opacity-70">
                          <Sparkline data={sparkData} color={isUp ? "#16a34a" : "#dc2626"} height={16} />
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 text-primary text-[10px] font-semibold">
                        {isExpanded ? <><ChevronUp size={12} />Less</> : <><ChevronDown size={12} />Details</>}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                        <p className="text-xs font-semibold text-foreground">Season Performance</p>
                        <div className="h-24">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={seasonHistory}>
                              <defs>
                                <linearGradient id={`grad-${listing.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#16a34a40" />
                                  <stop offset="95%" stopColor="#16a34a00" />
                                </linearGradient>
                              </defs>
                              <Tooltip
                                formatter={(v: number) => [formatKES(v), "Price"]}
                                labelFormatter={(l) => l}
                                contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #e5e7eb" }}
                              />
                              <Area type="monotone" dataKey="value"
                                stroke="#16a34a" strokeWidth={2}
                                fill={`url(#grad-${listing.id})`} dot={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Season Low",  value: formatKES(Math.round(listing.pricePerShare * 0.85)), cls: "text-red-500" },
                            { label: "Current",     value: formatKES(listing.pricePerShare),                    cls: "text-foreground" },
                            { label: "Target Exit", value: formatKES(Math.round(listing.pricePerShare * (1 + targetRoi / 100))), cls: "text-green-600" },
                          ].map(({ label, value, cls }) => (
                            <div key={label} className="bg-muted/50 rounded-xl p-2 text-center">
                              <p className="text-muted-foreground text-[8px]">{label}</p>
                              <p className={`font-bold text-[10px] ${cls}`}>{value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3">
                          <p className="text-green-700 text-[10px] font-semibold mb-2">💰 Return Calculator (100 shares)</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-muted-foreground text-[9px]">⚡ Mid-Season (+10%)</p>
                              <p className="text-orange-600 font-bold text-xs">{formatKES(Math.round(listing.pricePerShare * 100 * 1.10))}</p>
                              <p className="text-muted-foreground text-[8px]">30–60 days</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[9px]">🌾 Full Season (+{targetRoi}%)</p>
                              <p className="text-green-600 font-bold text-xs">{formatKES(Math.round(listing.pricePerShare * 100 * (1 + targetRoi / 100)))}</p>
                              <p className="text-muted-foreground text-[8px]">~6 months</p>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleBuyClick(e, listing as Listing)}
                          className="w-full bg-primary text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform"
                        >
                          Invest in {listing.cropType} →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
        }
      </div>

      <InvestModal open={investOpen} onClose={() => setInvestOpen(false)} listing={selectedListing} />
      <BottomNav role="investor" />
    </div>
  );
}
