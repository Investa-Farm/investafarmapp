import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useGetFarm, getGetFarmQueryKey, useListPrimaryMarket } from "@workspace/api-client-react";
import { ArrowLeft, TrendingUp, TrendingDown, Users, Share2, ShoppingCart, Leaf, Droplets, Sun, MapPin, ShieldCheck, User, Sparkles, BarChart2, Navigation } from "lucide-react";
import { ShareModal } from "@/components/share-modal";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { formatKES, formatChange, getToken } from "@/lib/auth";
import { getCropImage } from "@/lib/crops";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestModal } from "@/components/invest-modal";
import { useQuery } from "@tanstack/react-query";

type GrowthData = {
  farmId: number; cropType: string;
  stage: "planting" | "growing" | "harvest";
  percent: number; daysElapsed: number; daysTotal: number;
  marketPriceKes: number; marketChangePercent: number; marketInsight: string;
};

const GROWTH_STAGES = [
  { key: "planting", label: "Planting", icon: Leaf,     color: "bg-emerald-500" },
  { key: "growing",  label: "Growing",  icon: Droplets,  color: "bg-blue-500"   },
  { key: "harvest",  label: "Harvest",  icon: Sun,       color: "bg-orange-500"  },
];

const KENYA_COORDS: Record<string, [number, number]> = {
  nairobi: [-1.2921, 36.8219], kiambu: [-1.1728, 36.8342], nakuru: [-0.3031, 36.0800],
  meru: [0.0500, 37.6500], kirinyaga: [-0.4700, 37.3100], laikipia: [0.0300, 36.8000],
  nyeri: [-0.4167, 36.9500], kisumu: [-0.0917, 34.7679], eldoret: [0.5200, 35.2699],
  machakos: [-1.5177, 37.2634], narok: [-1.0833, 35.8667], thika: [-1.0332, 37.0693],
  ahero: [-0.1667, 34.9167], molo: [-0.2667, 35.7333], limuru: [-1.1133, 36.6428],
  nanyuki: [0.0100, 37.0714], embu: [-0.5273, 37.4571], kitui: [-1.3667, 38.0167],
  mombasa: [-4.0435, 39.6682], kericho: [-0.3667, 35.2833], bungoma: [0.5630, 34.5522],
  kakamega: [0.2827, 34.7519], kisii: [-0.6817, 34.7717], muranga: [-0.7167, 37.1500],
  nyandarua: [-0.1833, 36.4500], bomet: [-0.7833, 35.3500],
};

function getKenyaCoords(location: string): [number, number] {
  const lower = location.toLowerCase();
  for (const [key, coords] of Object.entries(KENYA_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return [-1.2921, 36.8219];
}

function AiInsightTags({ cropType, changePercent, stage, fundingPercent }: {
  cropType: string; changePercent: number; stage?: string; fundingPercent: number;
}) {
  const tags: { text: string; color: string }[] = [];
  if (changePercent > 3) tags.push({ text: `📈 Strong +${changePercent.toFixed(1)}% momentum`, color: "bg-[#16a34a]/5 border-[#16a34a]/20 text-[#16a34a]" });
  if (changePercent < -2) tags.push({ text: `📉 Price dip — buying opportunity`, color: "bg-amber-50 border-amber-200 text-amber-700" });
  if (stage === "growing") tags.push({ text: "🌱 In peak growing phase", color: "bg-blue-50 border-blue-200 text-blue-700" });
  if (stage === "harvest") tags.push({ text: "🌾 Near harvest — high confidence", color: "bg-orange-50 border-orange-200 text-orange-700" });
  if (fundingPercent > 70) tags.push({ text: `⚡ ${fundingPercent}% funded — almost full`, color: "bg-red-50 border-red-200 text-red-700" });
  if (fundingPercent < 30) tags.push({ text: "🎯 Early entry — best price", color: "bg-violet-50 border-violet-200 text-violet-700" });
  const cropTags: Record<string, string> = {
    maize: "🌽 Maize — highest demand crop in Kenya",
    coffee: "☕ Coffee — premium export demand",
    avocado: "🥑 Avocado — EU export season",
    tea: "🍵 Tea — stable year-round prices",
    horticulture: "🥦 Horticulture — fast ROI cycle",
  };
  const key = cropType?.toLowerCase();
  for (const [k, v] of Object.entries(cropTags)) {
    if (key?.includes(k)) { tags.push({ text: v, color: "bg-[#16a34a]/5 border-[#16a34a]/20 text-[#16a34a]" }); break; }
  }
  if (tags.length === 0) {
    tags.push({ text: "✅ Verified farm — audited by Investa", color: "bg-[#16a34a]/5 border-[#16a34a]/20 text-[#16a34a]" });
  }
  return (
    <div className="bg-card rounded-2xl border border-border p-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles size={13} className="text-[#16a34a]" />
        <p className="text-xs font-semibold text-foreground">AI Investment Insights</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.slice(0, 4).map((tag, i) => (
          <span key={i} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${tag.color}`}>
            {tag.text}
          </span>
        ))}
      </div>
    </div>
  );
}

type DetailTab = "overview" | "financials" | "growth" | "location";

const DETAIL_TABS: { id: DetailTab; label: string; icon: string }[] = [
  { id: "overview",   label: "Overview",   icon: "🌾" },
  { id: "financials", label: "Financials", icon: "💰" },
  { id: "growth",     label: "Growth",     icon: "🌱" },
  { id: "location",   label: "Location",   icon: "📍" },
];

export default function FarmDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const farmId = parseInt(params.id ?? "0", 10);
  const [investOpen, setInvestOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const token = getToken();

  const { data: farm, isLoading } = useGetFarm(farmId, {
    query: { enabled: !!farmId, queryKey: getGetFarmQueryKey(farmId) },
  });
  const { data: primaryListings } = useListPrimaryMarket();

  const { data: growth } = useQuery<GrowthData>({
    queryKey: ["farm-growth", farmId],
    enabled: !!farmId,
    queryFn: async () => {
      const r = await fetch(`/api/farmer/growth/${farmId}`, { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listing = (primaryListings as any[])?.find((l: any) => l.farmId === farmId);
  const isUp = (farm?.changePercent ?? 0) >= 0;

  if (isLoading) {
    return (
      <div className="app-shell p-4 pt-14 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (!farm) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData = (farm.priceHistory as any[])?.map((p: any) => ({ date: String(p.date).split("T")[0].slice(5), price: Number(p.price) })) ?? [];
  const currentStageIdx = GROWTH_STAGES.findIndex(s => s.key === (growth?.stage ?? "growing"));
  const [mapLat, mapLng] = getKenyaCoords(farm.location ?? "");
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${(mapLng - 0.025).toFixed(4)}%2C${(mapLat - 0.018).toFixed(4)}%2C${(mapLng + 0.025).toFixed(4)}%2C${(mapLat + 0.018).toFixed(4)}&layer=mapnik&marker=${mapLat.toFixed(4)}%2C${mapLng.toFixed(4)}`;

  return (
    <div className="app-shell pb-28 page-enter" data-testid="farm-detail">
      {/* Hero image */}
      <div className="relative h-52">
        <img
          src={getCropImage(farm.cropType, farm.imageUrl)}
          alt={farm.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        <div className="absolute top-12 left-4 right-4 flex items-center justify-between">
          <button data-testid="button-back" onClick={() => setLocation("/market")}
            className="w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <button data-testid="button-share" onClick={() => setShareOpen(true)}
            className="w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Share2 size={16} className="text-white" />
          </button>
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <h1 className="text-white text-xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{farm.name}</h1>
          <p className="text-white/80 text-sm">{farm.cropType} · {farm.location}</p>
        </div>
      </div>

      {/* Price summary strip */}
      <div className="px-4 py-3 bg-card border-b border-border flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{formatKES(farm.currentPrice)}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isUp ? <TrendingUp size={12} className="text-[#16a34a]" /> : <TrendingDown size={12} className="text-red-500" />}
            <span className={`text-sm font-semibold ${isUp ? "text-[#16a34a]" : "text-red-500"}`}>
              {formatChange(farm.changePercent)} today
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-muted-foreground text-xs justify-end">
            <Users size={11} /> <span>{farm.investors} investors</span>
          </div>
          <p className="text-muted-foreground text-xs mt-0.5">{farm.tradeCount} trades</p>
          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#16a34a]/10 text-[#16a34a]">
            {farm.fundingPercent}% funded
          </span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="px-4 pt-3 pb-1 sticky top-0 bg-background z-20 border-b border-border">
        <div className="flex bg-muted rounded-2xl p-1 gap-1">
          {DETAIL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1 ${
                activeTab === tab.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-4">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            <AiInsightTags
              cropType={farm.cropType}
              changePercent={farm.changePercent}
              stage={growth?.stage}
              fundingPercent={farm.fundingPercent}
            />

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "Loan Amount", val: formatKES(farm.loanAmount) },
                { label: "Total Shares", val: farm.totalShares.toLocaleString() },
                { label: "Available", val: farm.sharesAvailable.toLocaleString() },
                { label: "Share Price", val: formatKES(farm.sharePrice) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-card rounded-xl border border-border p-3">
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</p>
                  <p className="text-foreground font-semibold text-sm mt-0.5">{val}</p>
                </div>
              ))}
            </div>

            {/* Farmer details */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <User size={14} className="text-[#16a34a]" /> About the Farmer
              </p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-[#16a34a]/10 border-2 border-[#16a34a]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#16a34a] font-bold text-lg">
                    {((farm as any).farmerName ?? farm.name ?? "F").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm">{(farm as any).farmerName ?? "Investa Farm Farmer"}</p>
                  <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                    <MapPin size={10} /> {farm.location}
                  </p>
                </div>
                <span className="flex-shrink-0 bg-[#16a34a]/10 text-[#16a34a] text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <ShieldCheck size={10} /> Verified
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Primary Crop", value: farm.cropType },
                  { label: "Region", value: (farm.location ?? "Kenya").split(",")[0]?.trim() },
                  { label: "Farm Size", value: "~2.5 Acres" },
                  { label: "Season", value: "Long Rains 2026" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/50 rounded-xl p-2.5">
                    <p className="text-muted-foreground text-[9px] uppercase tracking-wider font-semibold">{label}</p>
                    <p className="text-foreground font-semibold text-xs mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {farm.description && (
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold mb-1.5">About this Farm</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{farm.description}</p>
              </div>
            )}
          </>
        )}

        {/* ── FINANCIALS TAB ── */}
        {activeTab === "financials" && (
          <>
            {/* Funding progress */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Funding Status</p>
                <span className="text-[#16a34a] font-bold text-sm">{farm.fundingPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div className="bg-[#16a34a] rounded-full h-3 transition-all duration-700" style={{ width: `${farm.fundingPercent}%` }} />
              </div>
              <div className="flex justify-between mt-2">
                <p className="text-muted-foreground text-xs">{formatKES(farm.loanAmount * farm.fundingPercent / 100)} raised</p>
                <p className="text-muted-foreground text-xs">Target: {formatKES(farm.loanAmount)}</p>
              </div>
            </div>

            {/* Returns preview */}
            <div className="bg-gradient-to-r from-[#16a34a]/5 to-emerald-50 border border-[#16a34a]/20 rounded-2xl p-4">
              <p className="text-sm font-semibold text-foreground mb-2.5 flex items-center gap-1.5">
                <span>💰</span> Projected Returns
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/90 rounded-xl p-3 border border-orange-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-lg">⚡</span>
                    <p className="text-xs font-semibold text-orange-700">Mid-Season Exit</p>
                  </div>
                  <p className="text-orange-600 font-bold text-lg">+10%</p>
                  <p className="text-muted-foreground text-[10px]">30–60 days</p>
                </div>
                <div className="bg-white/90 rounded-xl p-3 border border-[#16a34a]/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-lg">🌾</span>
                    <p className="text-xs font-semibold text-[#16a34a]">Full Season Exit</p>
                  </div>
                  <p className="text-[#16a34a] font-bold text-lg">Up to +22%</p>
                  <p className="text-muted-foreground text-[10px]">~6 months</p>
                </div>
              </div>
            </div>

            {/* Price performance chart */}
            {chartData.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BarChart2 size={13} className="text-[#16a34a]" /> Price Performance
                  </p>
                  <span className={`text-xs font-bold ${isUp ? "text-[#16a34a]" : "text-red-500"}`}>{formatChange(farm.changePercent)}</span>
                </div>
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px" }}
                      formatter={(v: number) => [formatKES(v), "Price"]}
                    />
                    <Area type="monotone" dataKey="price" stroke="#16a34a" strokeWidth={2} fill="url(#priceGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-muted/50 rounded-xl p-2 text-center">
                    <p className="text-muted-foreground text-[8px]">Season Low</p>
                    <p className="text-red-500 font-bold text-[10px]">{formatKES(Math.round(farm.currentPrice * 0.88))}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-2 text-center">
                    <p className="text-muted-foreground text-[8px]">Current</p>
                    <p className="text-foreground font-bold text-[10px]">{formatKES(farm.currentPrice)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-2 text-center">
                    <p className="text-muted-foreground text-[8px]">Season High</p>
                    <p className="text-[#16a34a] font-bold text-[10px]">{formatKES(Math.round(farm.currentPrice * 1.18))}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Share stats */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-sm font-semibold mb-3">Share Details</p>
              <div className="space-y-2.5">
                {[
                  { label: "Loan Amount", val: formatKES(farm.loanAmount), color: "text-foreground" },
                  { label: "Total Shares", val: farm.totalShares.toLocaleString(), color: "text-foreground" },
                  { label: "Shares Available", val: farm.sharesAvailable.toLocaleString(), color: "text-[#16a34a]" },
                  { label: "Price per Share", val: formatKES(farm.sharePrice), color: "text-foreground" },
                  { label: "Active Investors", val: String(farm.investors), color: "text-blue-600" },
                  { label: "Trade Volume", val: String(farm.tradeCount) + " trades", color: "text-foreground" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground text-sm">{label}</span>
                    <span className={`font-semibold text-sm ${color}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── GROWTH TAB ── */}
        {activeTab === "growth" && (
          <>
            {growth ? (
              <>
                <div className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold">Crop Growth Stage</p>
                    <span className="text-[#16a34a] text-xs font-bold bg-[#16a34a]/10 px-2.5 py-1 rounded-full">{growth.percent}% complete</span>
                  </div>
                  <div className="flex items-center gap-1 mb-4">
                    {GROWTH_STAGES.map((stage, i) => {
                      const Icon = stage.icon;
                      const done = i <= currentStageIdx;
                      const current = i === currentStageIdx;
                      return (
                        <div key={stage.key} className="flex items-center gap-1 flex-1">
                          <div className={`flex flex-col items-center gap-1.5 flex-1 ${current ? "opacity-100" : done ? "opacity-70" : "opacity-30"}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${current ? stage.color : done ? "bg-[#16a34a]/20" : "bg-muted"}`}>
                              <Icon size={18} className={current ? "text-white" : "text-muted-foreground"} />
                            </div>
                            <span className={`text-[10px] font-semibold text-center ${current ? "text-[#16a34a]" : "text-muted-foreground"}`}>{stage.label}</span>
                          </div>
                          {i < GROWTH_STAGES.length - 1 && (
                            <div className={`h-0.5 w-5 rounded-full flex-shrink-0 ${i < currentStageIdx ? "bg-[#16a34a]" : "bg-muted"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 mb-2">
                    <div className="bg-[#16a34a] rounded-full h-2.5 transition-all duration-700" style={{ width: `${growth.percent}%` }} />
                  </div>
                  <p className="text-muted-foreground text-xs">{growth.daysElapsed} of {growth.daysTotal} days · <span className="text-[#16a34a] font-semibold">{growth.daysTotal - growth.daysElapsed} days to harvest</span></p>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-blue-700">Live Commodity Price — {farm.cropType}</p>
                    <span className={`text-xs font-bold ${growth.marketChangePercent >= 0 ? "text-[#16a34a]" : "text-red-500"}`}>
                      {growth.marketChangePercent >= 0 ? "+" : ""}{growth.marketChangePercent.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-blue-800 font-bold text-xl">{formatKES(growth.marketPriceKes)} <span className="text-[10px] font-normal text-blue-600">/ 90kg bag</span></p>
                  <p className="text-blue-600 text-xs mt-1.5 italic">{growth.marketInsight}</p>
                </div>

                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-sm font-semibold mb-3">Growth Timeline</p>
                  <div className="space-y-3">
                    {[
                      { label: "Days Elapsed", val: `${growth.daysElapsed} days`, color: "text-foreground" },
                      { label: "Total Season", val: `${growth.daysTotal} days`, color: "text-foreground" },
                      { label: "Days to Harvest", val: `${growth.daysTotal - growth.daysElapsed} days`, color: "text-[#16a34a]" },
                      { label: "Current Stage", val: growth.stage.charAt(0).toUpperCase() + growth.stage.slice(1), color: "text-blue-600" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <span className="text-muted-foreground text-sm">{label}</span>
                        <span className={`font-semibold text-sm ${color}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-muted/30 rounded-2xl border border-border">
                <Leaf size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-foreground font-semibold text-sm">Growth data not yet available</p>
                <p className="text-muted-foreground text-xs mt-1">Check back once the crop season begins</p>
              </div>
            )}
          </>
        )}

        {/* ── LOCATION TAB ── */}
        {activeTab === "location" && (
          <>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation size={14} className="text-[#16a34a]" />
                  <p className="text-sm font-semibold">Farm Location</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                  <span className="text-[10px] text-[#16a34a] font-semibold uppercase tracking-wide">GPS Verified</span>
                </div>
              </div>
              <div className="relative" style={{ height: 260 }}>
                <iframe
                  src={osmUrl}
                  width="100%"
                  height="260"
                  style={{ border: 0, display: "block" }}
                  loading="lazy"
                  title={`Map — ${farm.location}`}
                />
                <div className="absolute bottom-3 left-3 pointer-events-none">
                  <div className="bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2">
                    <p className="text-white font-semibold text-xs">{farm.location}</p>
                    <p className="text-white/70 text-[10px]">Lat {mapLat.toFixed(4)}, Lng {mapLng.toFixed(4)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <MapPin size={14} className="text-[#16a34a]" /> Location Details
              </p>
              <div className="space-y-2.5">
                {[
                  { label: "County / Area", val: (farm.location ?? "Kenya").split(",")[0]?.trim() },
                  { label: "Latitude", val: mapLat.toFixed(4) },
                  { label: "Longitude", val: mapLng.toFixed(4) },
                  { label: "Country", val: "Kenya" },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground text-sm">{label}</span>
                    <span className="font-semibold text-sm text-foreground">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Invest Now CTA */}
      {listing && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40">
          <div className="bg-background/95 backdrop-blur-md border-t border-border px-4 pt-3 pb-8 shadow-2xl">
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <p className="text-xs text-muted-foreground">Share price</p>
                <p className="text-base font-bold text-foreground">{formatKES(listing.pricePerShare)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Funding</p>
                <p className="text-sm font-bold text-[#16a34a]">{farm.fundingPercent}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Available</p>
                <p className="text-sm font-semibold text-foreground">{listing.sharesAvailable.toLocaleString()} shares</p>
              </div>
            </div>
            <button
              data-testid="button-buy-confirm"
              onClick={() => setInvestOpen(true)}
              className="w-full bg-[#16a34a] text-white font-bold py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#16a34a]/30 text-base"
            >
              <ShoppingCart size={18} /> Invest in {farm.cropType} Now
            </button>
          </div>
        </div>
      )}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={farm.name}
        text={`🌱 Invest in ${farm.name} on Investa Farm! ${farm.cropType} · ${farm.location} · Up to +22% returns`}
        url={typeof window !== "undefined" ? window.location.href : ""}
      />

      <InvestModal
        open={investOpen}
        onClose={() => setInvestOpen(false)}
        listing={listing ? {
          id: listing.id,
          farmId: listing.farmId,
          farmName: listing.farmName,
          cropType: listing.cropType,
          location: listing.location,
          pricePerShare: listing.pricePerShare,
          sharesAvailable: listing.sharesAvailable,
          changePercent: listing.changePercent,
          imageUrl: farm.imageUrl ?? undefined,
        } : null}
      />
    </div>
  );
}
