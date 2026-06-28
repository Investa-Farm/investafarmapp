import { useState } from "react";
import { useListSecondaryMarket } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, formatChange, getToken, getStoredUser } from "@/lib/auth";
import { TrendingUp, TrendingDown, ArrowLeft, Users2, Tag, X, Clock, CheckCircle2, XCircle, Loader2, BookOpen, Bell, Search, ChevronRight, ChevronDown } from "lucide-react";
import { PriceAlertModal } from "@/components/price-alert-modal";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestModal } from "@/components/invest-modal";
import { getCropImage } from "@/lib/crops";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { getRiskLevel, RiskBadge } from "@/components/risk-badge";

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
        className="relative w-full max-w-[430px] rounded-t-3xl shadow-2xl px-5 pt-5 pb-10 bg-background border border-border">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-foreground text-sm">Cancel Listing</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
        {step === "confirm" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl p-3 bg-muted border border-border">
              <img src={getCropImage(listing.cropType, listing.imageUrl)} alt={listing.farmName}
                className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
              <div>
                <p className="font-bold text-foreground text-sm">{listing.farmName}</p>
                <p className="text-muted-foreground text-xs">{listing.sharesAvailable} shares · {formatKES(listing.pricePerShare)}/share</p>
              </div>
            </div>
            <div className="rounded-xl p-3 bg-amber-50 border border-amber-200">
              <p className="text-amber-700 text-xs leading-relaxed">
                Cancelling will remove this listing from the exchange. Your shares return to your portfolio.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose}
                className="py-3 rounded-xl text-sm font-semibold text-muted-foreground active:scale-95 transition-transform bg-muted border border-border">
                Keep Listing
              </button>
              <button onClick={handleCancel} disabled={loading}
                className="py-3 rounded-xl text-sm font-bold text-red-600 active:scale-95 transition-all flex items-center justify-center gap-1.5 bg-red-50 border border-red-200">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} className="text-red-500" />}
                <span>{loading ? "Cancelling…" : "Cancel"}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-green-50">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <p className="font-bold text-foreground text-lg">Listing Removed</p>
            <p className="text-muted-foreground text-sm">Your shares are back in your portfolio.</p>
            <button onClick={onClose} className="w-full font-bold py-3 rounded-xl text-white text-sm active:scale-95 transition-all bg-primary">
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

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
  const [alertOpen, setAlertOpen] = useState(false);
  const [tab, setTab] = useState<"market" | "mine" | "orders">("market");
  const [cropFilter, setCropFilter] = useState<string>("all");
  const [expandedCrop, setExpandedCrop] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const token = getToken();
  const qc = useQueryClient();

  const { data: myListings = [], isLoading: myLoading } = useQuery<Listing[]>({
    queryKey: ["my-listings"],
    queryFn: async () => {
      const r = await fetch("/api/market/my-listings", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

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
      import("@/components/success-toast").then(({ showSuccessToast }) => {
        showSuccessToast(
          orderSide === "buy" ? "Buy order placed! 📈" : "Sell order placed! 📊",
          "Order entered the exchange book"
        );
      });
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

  const allFarms = listings ? (() => {
    const m = new globalThis.Map<number, { id: number; name: string; price: number }>();
    for (const l of listings as Listing[]) m.set(l.farmId, { id: l.farmId, name: l.farmName, price: l.pricePerShare });
    return [...m.values()];
  })() : [];

  const activeMyListings = myListings.filter(l => l.isActive !== false);
  const inactiveMyListings = myListings.filter(l => l.isActive === false);
  const totalVolume = (listings as Listing[] ?? []).reduce((s, l) => s + l.pricePerShare * l.sharesAvailable, 0);
  const allListings = (listings as Listing[] ?? []);

  let filtered = allListings.filter(l => cropFilter === "all" || l.cropType === cropFilter);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(l => l.farmName.toLowerCase().includes(q) || l.cropType.toLowerCase().includes(q) || (l.location ?? "").toLowerCase().includes(q));
  }
  const grouped = groupByCrop(filtered);
  const cropKeys = Object.keys(grouped);
  const uniqueCrops = [...new Set(allListings.map(l => l.cropType))];

  const gainers = allListings.filter(l => l.changePercent > 0).length;
  const losers = allListings.filter(l => l.changePercent < 0).length;

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
              <span className="text-[9px] font-bold tracking-[0.15em] text-primary/70 uppercase">P2P Exchange</span>
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 border border-green-200">
                <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[8px] font-black text-green-700 tracking-wider">LIVE</span>
              </span>
            </div>
            <h1 className="text-foreground font-extrabold text-lg tracking-tight leading-none">Secondary Market</h1>
          </div>
        </div>

        {/* Market stats */}
        <div className="grid grid-cols-4 border-t border-border">
          {[
            { label: "LISTINGS", value: allListings.length || "—", color: "text-foreground" },
            { label: "GAINERS",  value: gainers, color: "text-green-600" },
            { label: "LOSERS",   value: losers,  color: "text-red-500" },
            { label: "VOLUME",   value: totalVolume > 0 ? `${(totalVolume / 1_000_000).toFixed(1)}M` : "—", color: "text-green-700" },
          ].map((s, i) => (
            <div key={i} className="px-3 py-2 text-center border-r border-border last:border-0">
              <p className={`text-sm font-black leading-none font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[8px] font-bold text-muted-foreground tracking-widest mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex px-4 pb-0 pt-1 gap-1">
          {/* Market tab */}
          <button onClick={() => setTab("market")}
            className={`flex-1 py-2.5 text-[10px] font-black tracking-wide transition-all flex items-center justify-center gap-1 relative ${tab === "market" ? "text-primary" : "text-muted-foreground"}`}>
            Market
            {tab === "market" && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />}
          </button>

          {/* Order Book tab — distinct blue "pro" chip */}
          <button onClick={() => setTab("orders")}
            className={`flex-1 py-2 text-[10px] font-black tracking-wide transition-all flex items-center justify-center gap-1 relative ${tab === "orders" ? "text-blue-600" : "text-muted-foreground"}`}>
            {tab === "orders" ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-700">
                <BookOpen size={9} /> Order Book
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                <BookOpen size={9} /> Order Book
              </span>
            )}
            {tab === "orders" && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-blue-500" />}
          </button>

          {/* My Listings tab — count badge always visible */}
          <button onClick={() => setTab("mine")}
            className={`flex-1 py-2.5 text-[10px] font-black tracking-wide transition-all flex items-center justify-center gap-1.5 relative ${tab === "mine" ? "text-primary" : "text-muted-foreground"}`}>
            Mine
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center transition-all ${
              tab === "mine"
                ? "bg-primary text-white"
                : activeMyListings.length > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground/60"
            }`}>
              {activeMyListings.length}
            </span>
            {tab === "mine" && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ─── MARKET TAB ─────────────────────────────────────────────── */}
        {tab === "market" && (
          <motion.div key="market" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="pt-3 pb-4 space-y-2 flex-1">

            {/* Search + filter bar */}
            <div className="px-4 space-y-2">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted border border-border">
                <Search size={13} className="text-muted-foreground flex-shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search farm, crop, county…"
                  className="flex-1 bg-transparent text-foreground text-xs placeholder-muted-foreground outline-none font-medium"
                />
                {search && <button onClick={() => setSearch("")}><X size={11} className="text-muted-foreground" /></button>}
              </div>

              {/* Crop filter chips */}
              {uniqueCrops.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                  <button onClick={() => { setCropFilter("all"); setExpandedCrop(null); }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all ${
                      cropFilter === "all" ? "text-white bg-primary" : "text-muted-foreground bg-muted border border-border"
                    }`}>
                    ALL
                  </button>
                  {uniqueCrops.map(crop => (
                    <button key={crop} onClick={() => { setCropFilter(crop); setExpandedCrop(null); }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all ${
                        cropFilter === crop ? "text-white bg-primary" : "text-muted-foreground bg-muted border border-border"
                      }`}>
                      {crop.toUpperCase().slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Listings */}
            <div className="px-4 space-y-2">
              {isLoading
                ? Array(4).fill(0).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl animate-pulse bg-muted" />
                  ))
                : filtered.length === 0
                  ? (
                    <div className="text-center py-16">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-primary/5 border border-primary/10">
                        <Users2 size={24} className="text-primary/30" />
                      </div>
                      <p className="text-muted-foreground text-sm font-semibold">No secondary listings</p>
                      <p className="text-muted-foreground/60 text-xs mt-1">Investors can relist primary shares here</p>
                      <button onClick={() => setLocation("/market/primary")}
                        className="mt-4 text-xs font-black px-5 py-2.5 rounded-xl text-white active:scale-95 bg-primary">
                        Browse Primary Market
                      </button>
                    </div>
                  )
                  : cropKeys.map(crop => {
                    const cropListings = grouped[crop];
                    const isExp = expandedCrop === crop || cropFilter !== "all";
                    const bestPrice = Math.min(...cropListings.map(l => l.pricePerShare));
                    const avgChange = cropListings.reduce((s, l) => s + l.changePercent, 0) / cropListings.length;
                    const isUp = avgChange >= 0;
                    const totalShares = cropListings.reduce((s, l) => s + l.sharesAvailable, 0);

                    return (
                      <div key={crop} className={`rounded-xl overflow-hidden bg-card border shadow-sm ${isUp ? "border-green-200" : "border-red-100"}`}>

                        {/* Crop header */}
                        <button className="w-full flex items-center gap-3 px-3 py-3 active:bg-muted/50 transition-colors"
                          onClick={() => setExpandedCrop(isExp ? null : crop)}>
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                            <img src={getCropImage(crop, undefined)} alt={crop} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-foreground font-extrabold text-sm">{crop}</p>
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full text-primary bg-primary/10 border border-primary/15">
                                {cropListings.length}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[9px] mt-0.5 font-mono">{totalShares.toLocaleString()} shares · {cropListings.length} seller{cropListings.length !== 1 ? "s" : ""}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <p className="text-foreground font-black text-sm leading-none font-mono">{formatKES(bestPrice)}</p>
                            <span className={`text-[9px] font-black flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono ${isUp ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>
                              {isUp ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                              {formatChange(avgChange)}
                            </span>
                          </div>
                          <ChevronRight size={12} className={`text-muted-foreground/40 transition-transform ml-1 ${isExp ? "rotate-90" : ""}`} />
                        </button>

                        {/* Expanded sellers */}
                        <AnimatePresence>
                          {isExp && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden border-t border-border"
                            >
                              {cropListings.map((listing, i) => {
                                const sparkData = generateSparkData(listing.pricePerShare, 12, listing.changePercent / 100);
                                const up = listing.changePercent >= 0;
                                const risk = getRiskLevel(listing.cropType, listing.changePercent);
                                const region = listing.location?.split(",")[0]?.trim() ?? "Kenya";

                                return (
                                  <div key={listing.id}
                                    className={`px-3 py-3 ${i < cropListings.length - 1 ? "border-b border-border" : ""} ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <p className="text-foreground text-[11px] font-extrabold truncate">{listing.farmName}</p>
                                          <span className="text-[7px] font-black px-1 py-0.5 rounded text-primary bg-primary/8 border border-primary/12">P2P</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-muted-foreground text-[9px]">{region}</span>
                                          <span className="text-muted-foreground/30 text-[8px]">·</span>
                                          <RiskBadge level={risk} />
                                          {listing.sellerName && (
                                            <span className="text-muted-foreground/50 text-[9px] truncate">by {listing.sellerName}</span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="w-14 flex-shrink-0">
                                        <Sparkline data={sparkData} color={up ? "#16a34a" : "#ef4444"} height={24} />
                                      </div>

                                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <p className="text-foreground font-black text-sm leading-none font-mono">{formatKES(listing.pricePerShare)}</p>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded font-mono ${up ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>
                                          {formatChange(listing.changePercent)}
                                        </span>
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <button onClick={(e) => { e.stopPropagation(); setAlertListing(listing); setAlertOpen(true); }}
                                            className="w-6 h-6 rounded-md flex items-center justify-center active:scale-90 transition-transform bg-muted border border-border">
                                            <Bell size={9} className="text-muted-foreground" />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedListing(listing); setInvestOpen(true); }}
                                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-black text-white active:scale-90 transition-transform bg-primary">
                                            BUY
                                          </button>
                                        </div>
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
                  })
              }
            </div>
          </motion.div>
        )}

        {/* ─── ORDER BOOK TAB ─────────────────────────────────────────── */}
        {tab === "orders" && (
          <motion.div key="orders" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="pt-4 pb-4 px-4 space-y-4">

            {/* Farm selector */}
            <div>
              <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase mb-2">Select Asset</p>
              <select
                value={orderFarmId}
                onChange={e => setOrderFarmId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl px-4 py-3 text-foreground text-sm font-bold appearance-none outline-none bg-muted border border-border">
                <option value="">Choose a farm…</option>
                {allFarms.map(f => (
                  <option key={f.id} value={f.id}>{f.name} — {formatKES(f.price)}/share</option>
                ))}
              </select>
            </div>

            {/* Order book depth */}
            {orderFarmId && orderBookDepth && (
              <div className="rounded-xl overflow-hidden border border-border bg-card">
                <div className="grid grid-cols-2">
                  {/* Bids */}
                  <div className="border-r border-border">
                    <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 bg-green-50">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <p className="text-[9px] font-black tracking-widest text-green-700 uppercase">Bids</p>
                    </div>
                    {(orderBookDepth.buys ?? []).slice(0, 6).map((b, i) => (
                      <div key={i} className="px-3 py-1.5 relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-green-100/60"
                          style={{ width: `${Math.min(100, (b.quantity / Math.max(...(orderBookDepth.buys ?? [{ quantity: 1 }]).map(x => x.quantity))) * 100)}%` }} />
                        <div className="relative flex justify-between">
                          <span className="text-green-700 font-mono text-[10px] font-bold">{formatKES(b.price)}</span>
                          <span className="text-muted-foreground font-mono text-[10px]">{b.quantity}</span>
                        </div>
                      </div>
                    ))}
                    {(orderBookDepth.buys ?? []).length === 0 && (
                      <p className="text-muted-foreground text-[10px] text-center py-4">No bids</p>
                    )}
                  </div>
                  {/* Asks */}
                  <div>
                    <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 justify-end bg-red-50">
                      <p className="text-[9px] font-black tracking-widest text-red-600 uppercase">Asks</p>
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    </div>
                    {(orderBookDepth.sells ?? []).slice(0, 6).map((s, i) => (
                      <div key={i} className="px-3 py-1.5 relative overflow-hidden">
                        <div className="absolute inset-y-0 right-0 bg-red-100/60"
                          style={{ width: `${Math.min(100, (s.quantity / Math.max(...(orderBookDepth.sells ?? [{ quantity: 1 }]).map(x => x.quantity))) * 100)}%` }} />
                        <div className="relative flex justify-between">
                          <span className="text-muted-foreground font-mono text-[10px]">{s.quantity}</span>
                          <span className="text-red-600 font-mono text-[10px] font-bold">{formatKES(s.price)}</span>
                        </div>
                      </div>
                    ))}
                    {(orderBookDepth.sells ?? []).length === 0 && (
                      <p className="text-muted-foreground text-[10px] text-center py-4">No asks</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Place order */}
            <div className="rounded-xl p-4 space-y-3 bg-card border border-border">
              <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">Place Limit Order</p>

              {/* Buy / Sell toggle */}
              <div className="grid grid-cols-2 rounded-xl overflow-hidden border border-border">
                <button onClick={() => setOrderSide("buy")}
                  className={`py-2.5 text-xs font-black tracking-wide transition-all ${orderSide === "buy" ? "text-white bg-green-600" : "text-muted-foreground bg-background"}`}>
                  BUY
                </button>
                <button onClick={() => setOrderSide("sell")}
                  className={`py-2.5 text-xs font-black tracking-wide transition-all ${orderSide === "sell" ? "text-white bg-red-500" : "text-muted-foreground bg-background"}`}>
                  SELL
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-black tracking-widest text-muted-foreground uppercase block mb-1">Limit Price (KES)</label>
                  <input type="number" value={orderPrice} onChange={e => setOrderPrice(e.target.value)}
                    placeholder="e.g. 12500"
                    className="w-full rounded-lg px-3 py-2.5 text-foreground text-sm font-mono font-bold outline-none bg-muted border border-border" />
                </div>
                <div>
                  <label className="text-[9px] font-black tracking-widest text-muted-foreground uppercase block mb-1">Quantity (shares)</label>
                  <input type="number" value={orderQty} onChange={e => setOrderQty(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full rounded-lg px-3 py-2.5 text-foreground text-sm font-mono font-bold outline-none bg-muted border border-border" />
                </div>
              </div>

              {orderPrice && orderQty && (
                <div className="rounded-lg px-3 py-2 flex justify-between bg-muted">
                  <span className="text-muted-foreground text-[10px]">Order Total</span>
                  <span className="text-foreground font-black text-[10px] font-mono">{formatKES(parseFloat(orderPrice) * parseFloat(orderQty) || 0)}</span>
                </div>
              )}

              {orderSuccess && (
                <div className="rounded-lg px-3 py-2 flex items-center gap-2 bg-green-50 border border-green-200">
                  <CheckCircle2 size={12} className="text-green-600" />
                  <p className="text-green-700 text-xs font-bold">Order placed successfully!</p>
                </div>
              )}

              <button
                onClick={() => placeOrder.mutate()}
                disabled={!orderFarmId || !orderPrice || !orderQty || placeOrder.isPending}
                className={`w-full py-3.5 rounded-xl text-sm font-black tracking-wide transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2 text-white ${orderSide === "buy" ? "bg-green-600" : "bg-red-500"}`}>
                {placeOrder.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {placeOrder.isPending ? "Placing…" : `Place ${orderSide === "buy" ? "Buy" : "Sell"} Order`}
              </button>
            </div>

            {/* My open orders */}
            {myOrders.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">Open Orders</p>
                {myOrders.filter(o => o.status === "pending").map(order => (
                  <div key={order.id} className="flex items-center justify-between rounded-xl px-3 py-3 bg-card border border-border">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${order.side === "buy" ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"}`}>
                          {order.side?.toUpperCase()}
                        </span>
                        <p className="text-foreground text-xs font-bold truncate max-w-[130px]">{order.farmName ?? "Farm"}</p>
                      </div>
                      <p className="text-muted-foreground text-[9px] mt-0.5 font-mono">{formatKES(order.limitPrice)} × {order.quantity} shares</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5 text-amber-500 text-[9px]">
                        <Clock size={9} /> Pending
                      </span>
                      <button onClick={() => cancelOrder.mutate(order.id)}
                        disabled={cancelOrder.isPending}
                        className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform bg-red-50 border border-red-200">
                        <X size={11} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── MY LISTINGS TAB ─────────────────────────────────────────── */}
        {tab === "mine" && (
          <motion.div key="mine" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="pt-4 pb-4 px-4 space-y-3">

            {myLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-16 rounded-xl animate-pulse bg-muted" />
              ))
            ) : activeMyListings.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-primary/5 border border-primary/10">
                  <Tag size={22} className="text-primary/30" />
                </div>
                <p className="text-muted-foreground text-sm font-semibold">No active listings</p>
                <p className="text-muted-foreground/60 text-xs mt-1">List shares from your portfolio to earn on the exchange</p>
              </div>
            ) : (
              <>
                <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">Active Listings</p>
                {activeMyListings.map(listing => {
                  const up = listing.changePercent >= 0;
                  return (
                    <div key={listing.id} className="rounded-xl overflow-hidden bg-card border border-border shadow-sm">
                      <div className="flex items-center gap-3 px-3 py-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={getCropImage(listing.cropType, listing.imageUrl)} alt={listing.farmName}
                            className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground font-extrabold text-sm truncate">{listing.farmName}</p>
                          <p className="text-muted-foreground text-[9px] font-mono mt-0.5">{listing.sharesAvailable} shares · {formatKES(listing.pricePerShare)}/share</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded font-mono ${up ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>
                            {formatChange(listing.changePercent)}
                          </span>
                          <button onClick={() => setCancelListing(listing)}
                            className="text-[9px] font-bold text-red-500 px-2 py-1 rounded active:scale-90 transition-transform bg-red-50 border border-red-100">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {inactiveMyListings.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase mb-2">Completed / Removed</p>
                    {inactiveMyListings.map(listing => (
                      <div key={listing.id} className="rounded-xl px-3 py-3 opacity-50 bg-muted border border-border mb-2">
                        <p className="text-foreground font-bold text-sm">{listing.farmName}</p>
                        <p className="text-muted-foreground text-[9px] mt-0.5">{listing.sharesAvailable} shares · {formatKES(listing.pricePerShare)}/share</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      <BottomNav role="investor" />

      <AnimatePresence>
        {selectedListing && investOpen && (
          <InvestModal open={investOpen} onClose={() => setInvestOpen(false)} listing={selectedListing as any} />
        )}
        {cancelListing && (
          <CancelListingModal
            listing={cancelListing}
            onClose={() => setCancelListing(null)}
            onCancelled={() => {
              setCancelListing(null);
              qc.invalidateQueries({ queryKey: ["my-listings"] });
            }}
          />
        )}
        {alertListing && alertOpen && (
          <PriceAlertModal open={alertOpen} onClose={() => setAlertOpen(false)} listing={alertListing as any} />
        )}
      </AnimatePresence>
    </div>
  );
}
