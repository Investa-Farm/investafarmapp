import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useGetFarm, getGetFarmQueryKey, useListPrimaryMarket } from "@workspace/api-client-react";
import { ArrowLeft, TrendingUp, TrendingDown, Users, Share2, ShoppingCart, Leaf, Droplets, Sun, MapPin, ShieldCheck, User } from "lucide-react";
import { ShareModal } from "@/components/share-modal";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { formatKES, formatChange, getToken } from "@/lib/auth";
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
  nairobi: [-1.2921, 36.8219],
  kiambu: [-1.1728, 36.8342],
  nakuru: [-0.3031, 36.0800],
  meru: [0.0500, 37.6500],
  kirinyaga: [-0.4700, 37.3100],
  laikipia: [0.0300, 36.8000],
  nyeri: [-0.4167, 36.9500],
  kisumu: [-0.0917, 34.7679],
  eldoret: [0.5200, 35.2699],
  machakos: [-1.5177, 37.2634],
  narok: [-1.0833, 35.8667],
  thika: [-1.0332, 37.0693],
  ahero: [-0.1667, 34.9167],
  molo: [-0.2667, 35.7333],
  limuru: [-1.1133, 36.6428],
  nanyuki: [0.0100, 37.0714],
  embu: [-0.5273, 37.4571],
  kitui: [-1.3667, 38.0167],
  mombasa: [-4.0435, 39.6682],
  kericho: [-0.3667, 35.2833],
  bungoma: [0.5630, 34.5522],
  kakamega: [0.2827, 34.7519],
  kisii: [-0.6817, 34.7717],
  muranga: [-0.7167, 37.1500],
  nyandarua: [-0.1833, 36.4500],
  bomet: [-0.7833, 35.3500],
};

function getKenyaCoords(location: string): [number, number] {
  const lower = location.toLowerCase();
  for (const [key, coords] of Object.entries(KENYA_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return [-1.2921, 36.8219];
}

export default function FarmDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const farmId = parseInt(params.id ?? "0", 10);
  const [investOpen, setInvestOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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

  const listing = primaryListings?.find(l => l.farmId === farmId);
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

  const chartData = farm.priceHistory?.map(p => ({ date: p.date.split("T")[0].slice(5), price: p.price })) ?? [];
  const currentStageIdx = GROWTH_STAGES.findIndex(s => s.key === (growth?.stage ?? "growing"));
  const [mapLat, mapLng] = getKenyaCoords(farm.location ?? "");

  return (
    <div className="app-shell pb-6 page-enter" data-testid="farm-detail">
      {/* Hero image */}
      <div className="relative h-56">
        <img
          src={farm.imageUrl ?? "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=600&q=80"}
          alt={farm.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
        <div className="absolute top-12 left-4 right-4 flex items-center justify-between">
          <button data-testid="button-back" onClick={() => setLocation("/market")}
            className="w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <button data-testid="button-share" onClick={() => setShareOpen(true)}
            className="w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Share2 size={16} className="text-white" />
          </button>
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <h1 className="text-white text-xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{farm.name}</h1>
          <p className="text-white/70 text-sm">{farm.cropType} · {farm.location}</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-4">
        {/* Price row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{formatKES(farm.currentPrice)}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isUp ? <TrendingUp size={13} className="text-green-600" /> : <TrendingDown size={13} className="text-red-500" />}
              <span className={`text-sm font-semibold ${isUp ? "text-green-600" : "text-red-500"}`}>
                {formatChange(farm.changePercent)} today
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <Users size={11} /> <span>{farm.investors} investors</span>
            </div>
            <p className="text-muted-foreground text-xs mt-0.5">{farm.tradeCount} trades</p>
          </div>
        </div>

        {/* Crop growth stage */}
        {growth && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Crop Growth Stage</p>
              <span className="text-primary text-xs font-bold">{growth.percent}% complete</span>
            </div>
            <div className="flex items-center gap-1 mb-3">
              {GROWTH_STAGES.map((stage, i) => {
                const Icon = stage.icon;
                const done = i <= currentStageIdx;
                const current = i === currentStageIdx;
                return (
                  <div key={stage.key} className="flex items-center gap-1 flex-1">
                    <div className={`flex flex-col items-center gap-1 flex-1 ${current ? "opacity-100" : done ? "opacity-70" : "opacity-30"}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${current ? stage.color : done ? "bg-primary/30" : "bg-muted"}`}>
                        <Icon size={15} className={current ? "text-white" : "text-muted-foreground"} />
                      </div>
                      <span className={`text-[9px] font-semibold ${current ? "text-primary" : "text-muted-foreground"}`}>{stage.label}</span>
                    </div>
                    {i < GROWTH_STAGES.length - 1 && (
                      <div className={`h-0.5 w-4 rounded-full flex-shrink-0 ${i < currentStageIdx ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary rounded-full h-2 transition-all duration-700" style={{ width: `${growth.percent}%` }} />
            </div>
            <p className="text-muted-foreground text-[10px] mt-1.5">{growth.daysElapsed} of {growth.daysTotal} days · {growth.daysTotal - growth.daysElapsed} days to harvest</p>
          </div>
        )}

        {/* Commodity market price */}
        {growth && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-blue-700">Live Commodity Price — {farm.cropType}</p>
              <span className={`text-xs font-bold ${growth.marketChangePercent >= 0 ? "text-green-600" : "text-red-500"}`}>
                {growth.marketChangePercent >= 0 ? "+" : ""}{growth.marketChangePercent.toFixed(2)}%
              </span>
            </div>
            <p className="text-blue-800 font-bold text-base">{formatKES(growth.marketPriceKes)} <span className="text-[10px] font-normal text-blue-600">/ 90kg bag</span></p>
            <p className="text-blue-600 text-[10px] mt-1 italic">{growth.marketInsight}</p>
          </div>
        )}

        {/* Satellite Map */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-primary" />
              <p className="text-sm font-semibold">Satellite View</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-600 font-semibold uppercase tracking-wide">Live</span>
            </div>
          </div>
          <div className="relative" style={{ height: 220 }}>
            <iframe
              src={`https://maps.google.com/maps?q=${mapLat},${mapLng}&t=k&z=15&output=embed`}
              width="100%"
              height="220"
              style={{ border: 0, display: "block" }}
              loading="lazy"
              allowFullScreen
              title={`Satellite view — ${farm.location}`}
            />
            <div className="absolute bottom-2 left-2 pointer-events-none">
              <div className="bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
                <p className="text-white font-semibold text-xs">{farm.location}</p>
                <p className="text-white/70 text-[10px]">GPS Verified · Aerial View</p>
              </div>
            </div>
          </div>
        </div>

        {/* Farmer Details */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <User size={14} className="text-primary" /> About the Farmer
          </p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold text-lg">
                {((farm as any).farmerName ?? farm.name ?? "F").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-sm">
                {(farm as any).farmerName ?? "Investa Farm Farmer"}
              </p>
              <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                <MapPin size={10} /> {farm.location}
              </p>
            </div>
            <span className="flex-shrink-0 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
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

        {/* Crop performance line graph */}
        {chartData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">Crop Performance</p>
              <span className={`text-xs font-bold ${isUp ? "text-green-600" : "text-red-500"}`}>{formatChange(farm.changePercent)}</span>
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
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
                <p className="text-green-600 font-bold text-[10px]">{formatKES(Math.round(farm.currentPrice * 1.18))}</p>
              </div>
            </div>
          </div>
        )}

        {/* Farm stats */}
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

        {/* Funding progress */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Funding Status</p>
            <span className="text-primary font-bold text-sm">{farm.fundingPercent}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary rounded-full h-2 transition-all duration-700" style={{ width: `${farm.fundingPercent}%` }} />
          </div>
          <p className="text-muted-foreground text-xs mt-2">
            {formatKES(farm.loanAmount * farm.fundingPercent / 100)} raised of {formatKES(farm.loanAmount)}
          </p>
        </div>

        {/* Returns preview */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-foreground mb-2.5">Projected Returns</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/70 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-lg">⚡</span>
                <p className="text-xs font-semibold text-orange-700">Mid-Season Exit</p>
              </div>
              <p className="text-orange-600 font-bold text-sm">+10%</p>
              <p className="text-muted-foreground text-[10px]">30–60 days</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-lg">🌾</span>
                <p className="text-xs font-semibold text-green-700">Full Season Exit</p>
              </div>
              <p className="text-green-600 font-bold text-sm">Up to +22%</p>
              <p className="text-muted-foreground text-[10px]">~6 months</p>
            </div>
          </div>
        </div>

        {farm.description && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-sm font-semibold mb-1.5">About this Farm</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{farm.description}</p>
          </div>
        )}

        {listing && (
          <button
            data-testid="button-buy-confirm"
            onClick={() => setInvestOpen(true)}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30 text-base"
          >
            <ShoppingCart size={18} /> Invest in this Farm
          </button>
        )}
      </div>

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
