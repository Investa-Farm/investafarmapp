import { useState } from "react";
import { useListSecondaryMarket } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, formatChange, getToken } from "@/lib/auth";
import { TrendingUp, TrendingDown, ArrowLeft, Users2, MapPin, Tag, X, Clock, CheckCircle2, XCircle, Loader2, ChevronRight, BellRing, ShoppingBag, BookOpen, Plus, Minus, ChevronDown, ChevronUp, BarChart2, Info, ExternalLink, Map } from "lucide-react";
import { PriceAlertModal } from "@/components/price-alert-modal";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestModal } from "@/components/invest-modal";
import { getCropImage } from "@/lib/crops";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { getRiskLevel, RiskBadge } from "@/components/risk-badge";
import { AiSectionBot } from "@/components/ai-section-bot";

type Listing = {
  id: number; farmId: number; farmName: string; cropType: string;
  location: string; pricePerShare: number; sharesAvailable: number;
  changePercent: number; imageUrl?: string; sellerName?: string;
  tradeCount?: number; isActive?: boolean; createdAt?: string;
};

function CancelListingModal({ listing, onClose, onCancelled }: { listing: Listing; onClose: () => void; onCancelled: () => void }) {
  const [step, setStep] = useState<"confirm" | "done">("confirm");
  const [loading, setLoading] = useState(false);
  const token = getToken();

  const handleCancel = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/market/listings/${listing.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) { setStep("done"); onCancelled(); }
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-xl px-5 pt-5 pb-10">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-foreground">Cancel Listing</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X size={14} />
          </button>
        </div>
        {step === "confirm" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-muted/50 rounded-2xl p-3">
              <img src={getCropImage(listing.cropType, listing.imageUrl)} alt={listing.farmName}
                className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">{listing.farmName}</p>
                <p className="text-muted-foreground text-xs">{listing.sharesAvailable} shares · {formatKES(listing.pricePerShare)}/share</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-amber-700 text-xs leading-relaxed">
                Cancelling this listing will remove it from the Secondary Market. You'll keep the shares in your portfolio.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose}
                className="py-3 rounded-xl border border-border text-foreground text-sm font-semibold active:scale-95 transition-transform">
                Keep Listing
              </button>
              <button onClick={handleCancel} disabled={loading}
                className="py-3 rounded-xl bg-red-500 text-white text-sm font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                {loading ? "Cancelling..." : "Cancel Listing"}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <p className="font-bold text-foreground text-lg">Listing Cancelled</p>
            <p className="text-muted-foreground text-sm">Your shares are back in your portfolio.</p>
            <button onClick={onClose} className="w-full bg-primary text-white font-bold py-3 rounded-xl active:scale-95 transition-all">Done</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Group listings by crop type
function groupByCrop(listings: Listing[]): Record<string, Listing[]> {
  return listings.reduce((acc, l) => {
    const key = l.cropType ?? "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {} as Record<string, Listing[]>);
}

export default function SecondaryMarket() {
  const [, setLocation] = useLocation();
  const { data: listings, isLoading } = useListSecondaryMarket();
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [investOpen, setInvestOpen] = useState(false);
  const [cancelListing, setCancelListing] = useState<Listing | null>(null);
  const [alertListing, setAlertListing] = useState<Listing | null>(null);
  const [tab, setTab] = useState<"market" | "mine" | "orders">("market");
  const [cropFilter, setCropFilter] = useState<string>("all");
  const [expandedCrop, setExpandedCrop] = useState<string | null>(null);
  const [moreListing, setMoreListing] = useState<Listing | null>(null);
  const token = getToken();
  const qc = useQueryClient();

  const { data: myListings = [], isLoading: myLoading } = useQuery<Listing[]>({
    queryKey: ["my-listings"],
    queryFn: async () => {
      const r = await fetch("/api/market/my-listings", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const handleBuyClick = (e: React.MouseEvent, listing: Listing) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedListing(listing); setInvestOpen(true);
  };

  // Order book state
  const [orderFarmId, setOrderFarmId] = useState<number | "">("");
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderQty, setOrderQty] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);

  const { data: myOrders = [], refetch: refetchOrders } = useQuery<any[]>({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const r = await fetch("/api/orders/mine", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: tab === "orders",
    staleTime: 15_000,
  });

  const { data: orderBookDepth } = useQuery<{ buys: { price: number; quantity: number }[]; sells: { price: number; quantity: number }[] }>({
    queryKey: ["orderbook", orderFarmId],
    queryFn: async () => {
      const r = await fetch(`/api/orders/book/${orderFarmId}`);
      return r.json();
    },
    enabled: !!orderFarmId,
    refetchInterval: 15_000,
  });

  const placeOrder = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ farmId: orderFarmId, side: orderSide, limitPrice: orderPrice, quantity: orderQty }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      setOrderSuccess(true);
      setOrderPrice(""); setOrderQty("");
      refetchOrders();
      qc.invalidateQueries({ queryKey: ["orderbook", orderFarmId] });
      setTimeout(() => setOrderSuccess(false), 3000);
    },
  });

  const cancelOrder = useMutation({
    mutationFn: async (orderId: number) => {
      const r = await fetch(`/api/orders/${orderId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => refetchOrders(),
  });

  const allFarms = listings ? [...new Map((listings as Listing[]).map(l => [l.farmId, { id: l.farmId, name: l.farmName, price: l.pricePerShare }])).values()] : [];

  const activeMyListings = myListings.filter(l => l.isActive !== false);
  const inactiveMyListings = myListings.filter(l => l.isActive === false);
  const totalVolume = (listings as Listing[] ?? []).reduce((s: number, l: Listing) => s + l.pricePerShare * l.sharesAvailable, 0);
  const filtered = (listings as Listing[] ?? []).filter((l: Listing) => cropFilter === "all" || l.cropType === cropFilter);
  const grouped = groupByCrop(filtered);
  const cropKeys = Object.keys(grouped);

  return (
    <div className="app-shell pb-20 page-enter" data-testid="secondary-market">
      {/* Grass-green header */}
      <div className="relative overflow-hidden pt-10 pb-4 px-4"
        style={{ background: "linear-gradient(160deg, #052e16 0%, #14532d 50%, #16a34a 100%)" }}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #22c55e, transparent)" }} />
        <div className="absolute bottom-0 left-0 w-24 h-20 rounded-full opacity-10 blur-2xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #bbf7d0, transparent)" }} />

        <div className="flex items-center gap-2.5">
          <button data-testid="button-back" onClick={() => setLocation("/market")}
            className="w-8 h-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform">
            <ArrowLeft size={14} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-green-300/80 text-[9px] font-bold uppercase tracking-widest">P2P · Investor to Investor</span>
              <span className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 bg-green-500/20 border border-green-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-300 text-[8px] font-bold tracking-wider">LIVE</span>
              </span>
            </div>
            <h1 className="text-white text-base font-extrabold leading-tight tracking-tight">Secondary Market</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="rounded-xl px-2.5 py-1.5 text-right bg-white/10 border border-white/15">
              <p className="text-white font-bold text-sm leading-none">{listings?.length ?? "—"}</p>
              <p className="text-white/50 text-[8px]">listings</p>
            </div>
            {totalVolume > 0 && (
              <div className="rounded-xl px-2.5 py-1.5 text-right bg-green-500/20 border border-green-400/30">
                <p className="text-green-200 text-[9px] font-bold leading-none">{formatKES(totalVolume)}</p>
                <p className="text-white/40 text-[8px]">volume</p>
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(134,239,172,0.5), transparent)" }} />
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 pb-0">
        <div className="flex rounded-2xl p-1 gap-0.5 bg-muted border border-border">
          <button onClick={() => setTab("market")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab === "market" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            All Listings
          </button>
          <button onClick={() => setTab("orders")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${tab === "orders" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <BookOpen size={11} /> Order Book
          </button>
          <button onClick={() => setTab("mine")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${tab === "mine" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Tag size={11} />
            Mine
            {activeMyListings.length > 0 && (
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full ml-0.5 ${tab === "mine" ? "bg-white/20 text-white" : "bg-primary/15 text-primary"}`}>
                {activeMyListings.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === "market" && (
          <motion.div key="market" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="pt-3 pb-4 space-y-1">
            {/* Crop filter + info */}
            {!isLoading && (listings?.length ?? 0) > 0 && (
              <div className="px-4 mb-3">
                {/* Horizontal chip filter */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    onClick={() => { setCropFilter("all"); setExpandedCrop(null); }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${cropFilter === "all" ? "bg-primary text-white border-primary shadow-sm shadow-green-500/30" : "bg-white text-muted-foreground border-border"}`}
                  >
                    🌍 All
                  </button>
                  {Array.from(new Set((listings as Listing[] ?? []).map((l: Listing) => l.cropType))).map((crop: string) => (
                    <button
                      key={crop}
                      onClick={() => { setCropFilter(crop); setExpandedCrop(null); }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${cropFilter === crop ? "bg-primary text-white border-primary shadow-sm shadow-green-500/30" : "bg-white text-muted-foreground border-border"}`}
                    >
                      🌾 {crop}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-2 px-1">
                  <p className="text-muted-foreground text-xs">Investors reselling shares · prices reflect market conditions</p>
                  <AiSectionBot context="How does the secondary market work on Investa Farm? There is a 0.5% broker fee on both buyer and seller. How does this affect returns compared to the primary market?" label="secondary market" />
                </div>
              </div>
            )}

            <div className="px-4 space-y-4">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Users2 size={28} className="text-primary" />
                </div>
                <p className="text-foreground text-sm font-semibold">No secondary listings yet</p>
                <p className="text-muted-foreground text-xs mt-1 max-w-[220px] mx-auto">
                  Investors who bought primary shares can list them here for resale.
                </p>
                <button onClick={() => setLocation("/market/primary")}
                  className="mt-4 bg-primary text-white text-xs font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-transform">
                  Browse Primary Market
                </button>
              </div>
            ) : cropKeys.map(crop => {
              const cropListings = grouped[crop];
              const isExpanded = expandedCrop === crop || cropFilter !== "all";
              const bestPrice = Math.min(...cropListings.map(l => l.pricePerShare));
              const avgChange = cropListings.reduce((s, l) => s + l.changePercent, 0) / cropListings.length;
              const isUp = avgChange >= 0;
              const regions = [...new Set(cropListings.map(l => l.location?.split(",")[0]?.trim() ?? "Kenya"))].slice(0, 3);
              return (
                <div key={crop} className="rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: isUp ? "rgba(22,163,74,0.25)" : undefined, background: "var(--card)" }}>
                  {/* Crop group header */}
                  <button
                    className="w-full flex items-center gap-3 p-2.5 active:bg-green-50/50 transition-colors"
                    onClick={() => setExpandedCrop(isExpanded ? null : crop)}
                  >
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={getCropImage(crop, undefined)} alt={crop} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-foreground font-bold text-sm">{crop}</p>
                        <span className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">{cropListings.length} seller{cropListings.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <MapPin size={9} className="text-muted-foreground" />
                        <span className="text-muted-foreground text-[10px] truncate">{regions.join(" · ")}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <p className="text-foreground font-bold text-sm">{formatKES(bestPrice)}</p>
                      <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isUp ? "text-green-600" : "text-red-500"}`}>
                        {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {formatChange(avgChange)}
                      </span>
                      <ChevronRight size={13} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                  </button>

                  {/* Expanded: individual sellers */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        key="expanded"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-green-100"
                      >
                        {cropListings.map((listing, i) => {
                          const sparkData = generateSparkData(listing.pricePerShare, 12, listing.changePercent / 100);
                          const up = listing.changePercent >= 0;
                          const risk = getRiskLevel(listing.cropType, listing.changePercent);
                          const region = listing.location?.split(",")[0]?.trim() ?? "Kenya";
                          return (
                            <div key={listing.id}
                              data-testid={`secondary-listing-${listing.id}`}
                              className={`flex items-center gap-3 px-3 py-2.5 ${i < cropListings.length - 1 ? "border-b border-border" : ""}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className="text-foreground text-xs font-semibold truncate">{listing.farmName}</p>
                                  <span className="text-[8px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">RESALE</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <MapPin size={9} className="text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground text-[10px] truncate">{region}</span>
                                  <span className="text-muted-foreground/40 text-[10px]">·</span>
                                  <RiskBadge level={risk} />
                                </div>
                                {listing.sellerName && (
                                  <p className="text-muted-foreground text-[9px] mt-0.5">📤 {listing.sellerName}</p>
                                )}
                              </div>
                              <div className="w-14 flex-shrink-0">
                                <Sparkline data={sparkData} color={up ? "#16a34a" : "#dc2626"} height={24} />
                              </div>
                              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                <p className="text-foreground font-bold text-sm">{formatKES(listing.pricePerShare)}</p>
                                <span className={`text-[9px] font-bold ${up ? "text-green-600" : "text-red-500"}`}>
                                  {formatChange(listing.changePercent)}
                                </span>
                                {(listing as any).dcfFairValue && (
                                  <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${
                                    (listing as any).dcfPremiumPct > 5
                                      ? "bg-amber-50 text-amber-600"
                                      : (listing as any).dcfPremiumPct < -5
                                        ? "bg-green-50 text-green-600"
                                        : "bg-muted text-muted-foreground"
                                  }`}>
                                    {(listing as any).dcfPremiumPct > 0 ? "+" : ""}{(listing as any).dcfPremiumPct?.toFixed(1)}% vs DCF
                                  </span>
                                )}
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setMoreListing(listing); }}
                                    title="More details"
                                    className="w-7 h-7 rounded-lg border border-border flex items-center justify-center active:scale-95 transition-transform hover:bg-primary/5 hover:border-primary/30"
                                  >
                                    <Info size={11} className="text-muted-foreground" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setAlertListing(listing); }}
                                    title="Set price alert"
                                    className="w-7 h-7 rounded-lg border border-border flex items-center justify-center active:scale-95 transition-transform hover:bg-amber-50 hover:border-amber-300 group"
                                  >
                                    <BellRing size={12} className="text-muted-foreground group-hover:text-amber-500" />
                                  </button>
                                  <button
                                    data-testid={`button-buy-${listing.id}`}
                                    onClick={(e) => handleBuyClick(e, listing)}
                                    className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform shadow-sm"
                                  >
                                    BUY
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            </div>
          </motion.div>
        )}
        {tab === "mine" && (
          <motion.div key="mine" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="px-4 pt-3 space-y-3">
            {myLoading ? (
              Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
            ) : myListings.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <Tag size={28} className="text-primary" />
                </div>
                <p className="text-foreground text-sm font-semibold">No listings yet</p>
                <p className="text-muted-foreground text-xs mt-1 max-w-[220px] mx-auto leading-relaxed">
                  Go to your Portfolio and tap "Sell" on any holding to list shares here.
                </p>
                <button onClick={() => setLocation("/portfolio")}
                  className="mt-4 bg-primary text-white text-xs font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-transform flex items-center gap-1.5 mx-auto">
                  <ShoppingBag size={13} /> Go to Portfolio → Sell
                </button>
              </div>
            ) : (
              <>
                {activeMyListings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Active ({activeMyListings.length})
                    </p>
                    {activeMyListings.map(listing => {
                      const imgSrc = getCropImage(listing.cropType, listing.imageUrl);
                      const isUp = listing.changePercent >= 0;
                      return (
                        <div key={listing.id} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                          <div className="flex items-center gap-3 p-3">
                            <img src={imgSrc} alt={listing.farmName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <p className="text-foreground font-bold text-sm truncate">{listing.farmName}</p>
                                <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">Live</span>
                              </div>
                              <p className="text-muted-foreground text-[10px]">{listing.cropType} · {listing.sharesAvailable} shares</p>
                              <p className="text-foreground font-semibold text-xs mt-0.5">{formatKES(listing.pricePerShare)}/share</p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <span className={`text-[10px] font-bold ${isUp ? "text-green-600" : "text-red-500"}`}>
                                {formatChange(listing.changePercent)}
                              </span>
                              <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
                                <Clock size={9} />
                                <span>{listing.createdAt ? new Date(listing.createdAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "Recent"}</span>
                              </div>
                              <button onClick={() => setCancelListing(listing)}
                                className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-[10px] font-semibold active:scale-95 flex items-center gap-1">
                                <X size={10} /> Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {inactiveMyListings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Cancelled / Sold ({inactiveMyListings.length})
                    </p>
                    {inactiveMyListings.map(listing => (
                      <div key={listing.id} className="bg-card rounded-2xl border border-border overflow-hidden opacity-60">
                        <div className="flex items-center gap-3 p-3">
                          <img src={getCropImage(listing.cropType, listing.imageUrl)}
                            alt={listing.farmName} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 grayscale" />
                          <div className="flex-1">
                            <p className="text-foreground text-sm font-medium">{listing.farmName}</p>
                            <p className="text-muted-foreground text-[10px]">{listing.sharesAvailable} shares · {formatKES(listing.pricePerShare)}/share</p>
                            <span className="text-[9px] bg-gray-100 text-gray-500 font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block">Inactive</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ORDER BOOK TAB ── */}
      <AnimatePresence mode="wait">
        {tab === "orders" && (
          <motion.div key="orders" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="pt-3 pb-4 space-y-3 px-4">

            {/* Explainer */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
              <p className="text-blue-800 font-semibold text-xs mb-0.5">📖 Limit Order Book</p>
              <p className="text-blue-700 text-[11px] leading-relaxed">Place a buy or sell order at a specific price. The matching engine pairs compatible orders automatically every 2 minutes. Your order stays open until it fills or you cancel it.</p>
            </div>

            {/* Farm selector */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Select Farm</label>
              <select
                value={orderFarmId}
                onChange={e => setOrderFarmId(Number(e.target.value) || "")}
                className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">— Choose a farm —</option>
                {allFarms.map(f => (
                  <option key={f.id} value={f.id}>{f.name} · {formatKES(f.price)}/share</option>
                ))}
              </select>
            </div>

            {/* Order book depth — light theme */}
            {orderFarmId && (
              <div className="rounded-2xl overflow-hidden bg-card border border-border">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                  <p className="font-semibold text-sm flex items-center gap-1.5 text-foreground"><BarChart2 size={14} className="text-primary" /> Market Depth</p>
                  <span className="flex items-center gap-1 text-[9px] font-bold text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
                  </span>
                </div>
                {/* Asks */}
                <div className="px-4 pt-2 pb-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-1 text-red-500">Asks · Sell Orders</p>
                  {(!orderBookDepth?.sells || orderBookDepth.sells.length === 0) ? (
                    <p className="text-center text-xs py-2 text-muted-foreground">No sell orders</p>
                  ) : orderBookDepth.sells.slice(0, 5).map((level, i) => {
                    const maxQty = Math.max(...orderBookDepth.sells.map(s => s.quantity));
                    const pct = (level.quantity / maxQty) * 100;
                    return (
                      <div key={i} className="relative flex items-center justify-between py-1 text-xs">
                        <div className="absolute inset-y-0 right-0 rounded-sm bg-red-50" style={{ width: `${pct}%` }} />
                        <span className="relative font-bold text-red-500">{formatKES(level.price)}</span>
                        <span className="relative text-muted-foreground">{level.quantity.toFixed(2)} sh</span>
                      </div>
                    );
                  })}
                </div>
                {/* Spread */}
                {orderBookDepth?.buys?.length && orderBookDepth?.sells?.length ? (
                  <div className="mx-4 py-1.5 flex items-center justify-center gap-2 border-t border-b border-border">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-primary">
                      Spread {formatKES(Math.abs((orderBookDepth.sells[0]?.price ?? 0) - (orderBookDepth.buys[0]?.price ?? 0)))}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                ) : <div className="my-1 border-t border-border" />}
                {/* Bids */}
                <div className="px-4 pt-1 pb-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-1 text-green-600">Bids · Buy Orders</p>
                  {(!orderBookDepth?.buys || orderBookDepth.buys.length === 0) ? (
                    <p className="text-center text-xs py-2 text-muted-foreground">No buy orders</p>
                  ) : orderBookDepth.buys.slice(0, 5).map((level, i) => {
                    const maxQty = Math.max(...orderBookDepth.buys.map(b => b.quantity));
                    const pct = (level.quantity / maxQty) * 100;
                    return (
                      <div key={i} className="relative flex items-center justify-between py-1 text-xs">
                        <div className="absolute inset-y-0 left-0 rounded-sm bg-green-50" style={{ width: `${pct}%` }} />
                        <span className="relative font-bold text-green-600">{formatKES(level.price)}</span>
                        <span className="relative text-muted-foreground">{level.quantity.toFixed(2)} sh</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Place limit order — light card */}
            <div className="rounded-2xl p-4 bg-card border border-border">
              <p className="font-semibold text-sm mb-1 flex items-center gap-1.5 text-foreground"><Plus size={14} className="text-primary" /> Place Limit Order</p>
              <p className="text-muted-foreground text-[11px] mb-3">Your order stays open until matched or cancelled</p>
              {orderSuccess && (
                <div className="rounded-xl px-3 py-2 flex items-center gap-2 mb-3 bg-green-50 border border-green-200">
                  <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-green-700">Order placed! Matching engine will fill it automatically.</p>
                </div>
              )}
              {/* Side toggle */}
              <div className="flex rounded-xl p-0.5 mb-3 gap-0.5 bg-muted">
                <button onClick={() => setOrderSide("buy")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${orderSide === "buy" ? "bg-green-500 text-white shadow-sm" : "text-muted-foreground"}`}>
                  <ChevronUp size={12} /> Buy
                </button>
                <button onClick={() => setOrderSide("sell")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${orderSide === "sell" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground"}`}>
                  <ChevronDown size={12} /> Sell
                </button>
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1 text-muted-foreground">Limit Price (KES)</label>
                  <input type="number" value={orderPrice} onChange={e => setOrderPrice(e.target.value)} placeholder="e.g. 28.50"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1 text-muted-foreground">Quantity (shares)</label>
                  <input type="number" value={orderQty} onChange={e => setOrderQty(e.target.value)} placeholder="e.g. 10"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-primary" />
                </div>
                {orderPrice && orderQty && (
                  <div className="rounded-xl px-3 py-2 flex items-center justify-between bg-muted/50 border border-border">
                    <span className="text-xs text-muted-foreground">Order total</span>
                    <span className="text-sm font-bold text-foreground">{formatKES(Number(orderPrice) * Number(orderQty))}</span>
                  </div>
                )}
                <button
                  onClick={() => placeOrder.mutate()}
                  disabled={!orderFarmId || !orderPrice || !orderQty || placeOrder.isPending}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 ${orderSide === "buy" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}
                >
                  {placeOrder.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  {orderSide === "buy" ? "Place Buy Order" : "Place Sell Order"}
                </button>
              </div>
            </div>

            {/* My open orders */}
            <div>
              <p className="font-semibold text-sm mb-2 px-1 text-foreground">My Orders</p>
              {myOrders.length === 0 ? (
                <div className="rounded-2xl p-5 text-center bg-card border border-border">
                  <BookOpen size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">No orders yet</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">Place a limit order above to start trading</p>
                </div>
              ) : myOrders.map((order: any) => (
                <div key={order.id} className="rounded-2xl p-3.5 mb-2 bg-card border border-border">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${order.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {order.side.toUpperCase()}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          order.status === "filled" ? "bg-blue-100 text-blue-700" :
                          order.status === "cancelled" ? "bg-gray-100 text-gray-500" :
                          order.status === "partially_filled" ? "bg-amber-100 text-amber-700" :
                          "bg-purple-100 text-purple-700"
                        }`}>{order.status.replace("_", " ")}</span>
                      </div>
                      <p className="text-foreground font-semibold text-sm">{order.farmName ?? `Farm #${order.farmId}`}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {order.filledQuantity > 0 ? `${order.filledQuantity}/${order.quantity}` : order.quantity} shares · {formatKES(order.limitPrice)}/share
                      </p>
                    </div>
                    {(order.status === "open" || order.status === "partially_filled") && (
                      <button
                        onClick={() => cancelOrder.mutate(order.id)}
                        disabled={cancelOrder.isPending}
                        className="text-red-500 text-xs font-semibold flex items-center gap-1 border border-red-200 rounded-lg px-2 py-1 active:scale-95"
                      >
                        <XCircle size={11} /> Cancel
                      </button>
                    )}
                  </div>
                  {order.status === "partially_filled" && (
                    <div className="mt-2">
                      <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(order.filledQuantity / order.quantity) * 100}%` }} />
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{((order.filledQuantity / order.quantity) * 100).toFixed(0)}% filled</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InvestModal open={investOpen} onClose={() => setInvestOpen(false)} listing={selectedListing} />

      <PriceAlertModal
        open={!!alertListing}
        onClose={() => setAlertListing(null)}
        listing={alertListing ? {
          farmId: alertListing.farmId,
          farmName: alertListing.farmName,
          pricePerShare: alertListing.pricePerShare,
          cropType: alertListing.cropType,
        } : null}
      />

      <AnimatePresence>
        {cancelListing && (
          <CancelListingModal
            listing={cancelListing}
            onClose={() => setCancelListing(null)}
            onCancelled={() => {
              qc.invalidateQueries({ queryKey: ["my-listings"] });
              qc.invalidateQueries({ queryKey: ["secondary"] });
              setCancelListing(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* "More Details" bottom sheet */}
      <AnimatePresence>
        {moreListing && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
              onClick={() => setMoreListing(null)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[61] max-w-[430px] mx-auto bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-10"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <img src={getCropImage(moreListing.cropType)} alt={moreListing.cropType}
                    className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                  <div>
                    <p className="text-foreground font-bold text-base leading-tight">{moreListing.farmName}</p>
                    <p className="text-muted-foreground text-xs">{moreListing.cropType} · {moreListing.location}</p>
                  </div>
                </div>
                <button onClick={() => setMoreListing(null)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: "Price / Share", val: formatKES(moreListing.pricePerShare), cls: "text-foreground" },
                  { label: "Shares Listed", val: moreListing.sharesAvailable.toLocaleString(), cls: "text-foreground" },
                  { label: "Market Change", val: `${moreListing.changePercent >= 0 ? "+" : ""}${moreListing.changePercent.toFixed(2)}%`, cls: moreListing.changePercent >= 0 ? "text-green-600" : "text-red-500" },
                  { label: "Est. Mid-Season", val: "+10%", cls: "text-orange-500" },
                  { label: "Est. Full Season", val: "+22%", cls: "text-green-600" },
                  { label: "Status", val: "Active Resale", cls: "text-primary" },
                ].map(({ label, val, cls }) => (
                  <div key={label} className="bg-muted/50 rounded-xl p-3">
                    <p className="text-muted-foreground text-[10px]">{label}</p>
                    <p className={`font-bold text-sm ${cls}`}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Broker fee note */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                <span className="text-base">🤝</span>
                <div>
                  <p className="text-violet-700 font-semibold text-xs">1% Broker Fee Applies</p>
                  <p className="text-violet-600 text-[10px]">A 1% platform fee is charged on secondary market trades to support market liquidity.</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setMoreListing(null); setLocation(`/market/exchange/${moreListing.farmId}`); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-border text-foreground text-sm font-semibold active:scale-95 transition-all"
                >
                  <Map size={14} /> Farm Map
                </button>
                <button
                  onClick={(e) => { setAlertListing(moreListing); setMoreListing(null); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm font-semibold active:scale-95 transition-all"
                >
                  <BellRing size={14} /> Alert
                </button>
                <button
                  onClick={(e: React.MouseEvent) => { handleBuyClick(e, moreListing); setMoreListing(null); }}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold active:scale-95 transition-all"
                >
                  BUY
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav role="investor" />
    </div>
  );
}
