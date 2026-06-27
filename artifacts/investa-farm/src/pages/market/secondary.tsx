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
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative w-full max-w-[430px] rounded-t-3xl shadow-2xl px-5 pt-5 pb-10"
        style={{ background: "#0d1a0e", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-white text-sm">Cancel Listing</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <X size={14} className="text-white/60" />
          </button>
        </div>
        {step === "confirm" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <img src={getCropImage(listing.cropType, listing.imageUrl)} alt={listing.farmName}
                className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
              <div>
                <p className="font-bold text-white text-sm">{listing.farmName}</p>
                <p className="text-white/40 text-xs">{listing.sharesAvailable} shares · {formatKES(listing.pricePerShare)}/share</p>
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
              <p className="text-amber-300/80 text-xs leading-relaxed">
                Cancelling will remove this listing from the exchange. Your shares return to your portfolio.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose}
                className="py-3 rounded-xl text-sm font-semibold text-white/60 active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                Keep Listing
              </button>
              <button onClick={handleCancel} disabled={loading}
                className="py-3 rounded-xl text-sm font-bold text-white active:scale-95 transition-all flex items-center justify-center gap-1.5"
                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} className="text-red-400" />}
                <span className="text-red-400">{loading ? "Cancelling…" : "Cancel"}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.12)" }}>
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <p className="font-bold text-white text-lg">Listing Removed</p>
            <p className="text-white/40 text-sm">Your shares are back in your portfolio.</p>
            <button onClick={onClose} className="w-full font-bold py-3 rounded-xl text-black text-sm active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>Done</button>
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
    <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col pb-20"
      style={{ background: "linear-gradient(180deg, #070d07 0%, #0a150a 40%, #0d1a0e 100%)" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #050d05 0%, #091409 100%)", borderBottom: "1px solid rgba(34,197,94,0.12)" }}>
        <div className="flex items-center gap-3 px-4 pt-12 pb-3">
          <button onClick={() => setLocation("/market")}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <ArrowLeft size={14} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[9px] font-bold tracking-[0.15em] text-green-400/60 uppercase">P2P Exchange</span>
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.18)" }}>
                <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[8px] font-black text-green-400 tracking-wider">LIVE</span>
              </span>
            </div>
            <h1 className="text-white font-extrabold text-lg tracking-tight leading-none">Secondary Market</h1>
          </div>
        </div>

        {/* Market stats */}
        <div className="grid grid-cols-4 border-t border-white/5">
          {[
            { label: "LISTINGS", value: allListings.length || "—" },
            { label: "GAINERS",  value: gainers, color: "text-green-400" },
            { label: "LOSERS",   value: losers,  color: "text-red-400" },
            { label: "VOLUME",   value: totalVolume > 0 ? `${(totalVolume / 1_000_000).toFixed(1)}M` : "—", color: "text-emerald-300" },
          ].map((s, i) => (
            <div key={i} className="px-3 py-2 text-center border-r border-white/5 last:border-0">
              <p className={`text-sm font-black leading-none font-mono ${(s as any).color ?? "text-white"}`}>{s.value}</p>
              <p className="text-[8px] font-bold text-white/25 tracking-widest mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex px-4 pb-0 pt-1 gap-1">
          {[
            { id: "market", label: "Market", icon: null },
            { id: "orders", label: "Order Book", icon: <BookOpen size={10} /> },
            { id: "mine",   label: "My Listings", badge: activeMyListings.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex-1 py-2.5 text-[10px] font-black tracking-wide transition-all flex items-center justify-center gap-1 relative ${
                tab === t.id ? "text-green-400" : "text-white/30"
              }`}>
              {t.icon}
              {t.label}
              {(t as any).badge > 0 && (
                <span className="text-[8px] font-black px-1 rounded-full ml-0.5"
                  style={{ background: tab === t.id ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)", color: tab === t.id ? "#4ade80" : "rgba(255,255,255,0.3)" }}>
                  {(t as any).badge}
                </span>
              )}
              {tab === t.id && (
                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-green-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ─── MARKET TAB ─────────────────────────────────────────────── */}
        {tab === "market" && (
          <motion.div key="market" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="pt-3 pb-4 space-y-2 flex-1">

            {/* Search + filter bar */}
            <div className="px-4 space-y-2">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Search size={13} className="text-white/30 flex-shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search farm, crop, county…"
                  className="flex-1 bg-transparent text-white text-xs placeholder-white/25 outline-none font-medium"
                />
                {search && <button onClick={() => setSearch("")}><X size={11} className="text-white/40" /></button>}
              </div>

              {/* Crop filter chips */}
              {uniqueCrops.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                  <button onClick={() => { setCropFilter("all"); setExpandedCrop(null); }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all ${
                      cropFilter === "all" ? "text-black" : "text-white/40"
                    }`}
                    style={cropFilter === "all" ? { background: "#22c55e" } : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    ALL
                  </button>
                  {uniqueCrops.map(crop => (
                    <button key={crop} onClick={() => { setCropFilter(crop); setExpandedCrop(null); }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all ${
                        cropFilter === crop ? "text-black" : "text-white/40"
                      }`}
                      style={cropFilter === crop ? { background: "#22c55e" } : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
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
                    <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
                  ))
                : filtered.length === 0
                  ? (
                    <div className="text-center py-16">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.1)" }}>
                        <Users2 size={24} className="text-green-500/30" />
                      </div>
                      <p className="text-white/30 text-sm font-semibold">No secondary listings</p>
                      <p className="text-white/20 text-xs mt-1">Investors can relist primary shares here</p>
                      <button onClick={() => setLocation("/market/primary")}
                        className="mt-4 text-xs font-black px-5 py-2.5 rounded-xl text-black active:scale-95"
                        style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
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
                      <div key={crop} className="rounded-xl overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${isUp ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)"}` }}>

                        {/* Crop header */}
                        <button className="w-full flex items-center gap-3 px-3 py-3 active:bg-white/2 transition-colors"
                          onClick={() => setExpandedCrop(isExp ? null : crop)}>
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                            <img src={getCropImage(crop, undefined)} alt={crop} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-white font-extrabold text-sm">{crop}</p>
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full text-green-400"
                                style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.15)" }}>
                                {cropListings.length}
                              </span>
                            </div>
                            <p className="text-white/30 text-[9px] mt-0.5 font-mono">{totalShares.toLocaleString()} shares · {cropListings.length} seller{cropListings.length !== 1 ? "s" : ""}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <p className="text-white font-black text-sm leading-none font-mono">{formatKES(bestPrice)}</p>
                            <span className={`text-[9px] font-black flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono ${isUp ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
                              {isUp ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                              {formatChange(avgChange)}
                            </span>
                          </div>
                          <ChevronRight size={12} className={`text-white/20 transition-transform ml-1 ${isExp ? "rotate-90" : ""}`} />
                        </button>

                        {/* Expanded sellers */}
                        <AnimatePresence>
                          {isExp && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden border-t border-white/5"
                            >
                              {cropListings.map((listing, i) => {
                                const sparkData = generateSparkData(listing.pricePerShare, 12, listing.changePercent / 100);
                                const up = listing.changePercent >= 0;
                                const risk = getRiskLevel(listing.cropType, listing.changePercent);
                                const region = listing.location?.split(",")[0]?.trim() ?? "Kenya";

                                return (
                                  <div key={listing.id}
                                    className={`px-3 py-3 ${i < cropListings.length - 1 ? "border-b border-white/4" : ""}`}
                                    style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <p className="text-white text-[11px] font-extrabold truncate">{listing.farmName}</p>
                                          <span className="text-[7px] font-black px-1 py-0.5 rounded text-green-400/70"
                                            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.12)" }}>P2P</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-white/25 text-[9px]">{region}</span>
                                          <span className="text-white/15 text-[8px]">·</span>
                                          <RiskBadge level={risk} />
                                          {listing.sellerName && (
                                            <span className="text-white/20 text-[9px] truncate">by {listing.sellerName}</span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="w-14 flex-shrink-0">
                                        <Sparkline data={sparkData} color={up ? "#22c55e" : "#ef4444"} height={24} />
                                      </div>

                                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <p className="text-white font-black text-sm leading-none font-mono">{formatKES(listing.pricePerShare)}</p>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded font-mono ${up ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
                                          {formatChange(listing.changePercent)}
                                        </span>
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <button onClick={(e) => { e.stopPropagation(); setAlertListing(listing); setAlertOpen(true); }}
                                            className="w-6 h-6 rounded-md flex items-center justify-center active:scale-90 transition-transform"
                                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            <Bell size={9} className="text-white/30" />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedListing(listing); setInvestOpen(true); }}
                                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-black text-black active:scale-90 transition-transform"
                                            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
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
              <p className="text-[9px] font-black tracking-widest text-white/30 uppercase mb-2">Select Asset</p>
              <select
                value={orderFarmId}
                onChange={e => setOrderFarmId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl px-4 py-3 text-white text-sm font-bold appearance-none outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="" style={{ background: "#0d1a0e" }}>Choose a farm…</option>
                {allFarms.map(f => (
                  <option key={f.id} value={f.id} style={{ background: "#0d1a0e" }}>{f.name} — {formatKES(f.price)}/share</option>
                ))}
              </select>
            </div>

            {/* Order book depth */}
            {orderFarmId && orderBookDepth && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="grid grid-cols-2">
                  {/* Bids */}
                  <div className="border-r border-white/5">
                    <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <p className="text-[9px] font-black tracking-widest text-green-400/60 uppercase">Bids</p>
                    </div>
                    {(orderBookDepth.buys ?? []).slice(0, 6).map((b, i) => (
                      <div key={i} className="px-3 py-1.5 relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-green-400/6"
                          style={{ width: `${Math.min(100, (b.quantity / Math.max(...(orderBookDepth.buys ?? [{ quantity: 1 }]).map(x => x.quantity))) * 100)}%` }} />
                        <div className="relative flex justify-between">
                          <span className="text-green-400 font-mono text-[10px] font-bold">{formatKES(b.price)}</span>
                          <span className="text-white/30 font-mono text-[10px]">{b.quantity}</span>
                        </div>
                      </div>
                    ))}
                    {(orderBookDepth.buys ?? []).length === 0 && (
                      <p className="text-white/20 text-[10px] text-center py-4">No bids</p>
                    )}
                  </div>
                  {/* Asks */}
                  <div>
                    <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1.5 justify-end">
                      <p className="text-[9px] font-black tracking-widest text-red-400/60 uppercase">Asks</p>
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    </div>
                    {(orderBookDepth.sells ?? []).slice(0, 6).map((s, i) => (
                      <div key={i} className="px-3 py-1.5 relative overflow-hidden">
                        <div className="absolute inset-y-0 right-0 bg-red-400/6"
                          style={{ width: `${Math.min(100, (s.quantity / Math.max(...(orderBookDepth.sells ?? [{ quantity: 1 }]).map(x => x.quantity))) * 100)}%` }} />
                        <div className="relative flex justify-between">
                          <span className="text-white/30 font-mono text-[10px]">{s.quantity}</span>
                          <span className="text-red-400 font-mono text-[10px] font-bold">{formatKES(s.price)}</span>
                        </div>
                      </div>
                    ))}
                    {(orderBookDepth.sells ?? []).length === 0 && (
                      <p className="text-white/20 text-[10px] text-center py-4">No asks</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Place order */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[9px] font-black tracking-widest text-white/30 uppercase">Place Limit Order</p>

              {/* Buy / Sell toggle */}
              <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <button onClick={() => setOrderSide("buy")}
                  className={`py-2.5 text-xs font-black tracking-wide transition-all ${orderSide === "buy" ? "text-black" : "text-white/30"}`}
                  style={orderSide === "buy" ? { background: "#22c55e" } : {}}>
                  BUY
                </button>
                <button onClick={() => setOrderSide("sell")}
                  className={`py-2.5 text-xs font-black tracking-wide transition-all ${orderSide === "sell" ? "text-white" : "text-white/30"}`}
                  style={orderSide === "sell" ? { background: "#ef4444" } : {}}>
                  SELL
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-black tracking-widest text-white/25 uppercase block mb-1">Limit Price (KES)</label>
                  <input type="number" value={orderPrice} onChange={e => setOrderPrice(e.target.value)}
                    placeholder="e.g. 12500"
                    className="w-full rounded-lg px-3 py-2.5 text-white text-sm font-mono font-bold outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} />
                </div>
                <div>
                  <label className="text-[9px] font-black tracking-widest text-white/25 uppercase block mb-1">Quantity (shares)</label>
                  <input type="number" value={orderQty} onChange={e => setOrderQty(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full rounded-lg px-3 py-2.5 text-white text-sm font-mono font-bold outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} />
                </div>
              </div>

              {orderPrice && orderQty && (
                <div className="rounded-lg px-3 py-2 flex justify-between" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <span className="text-white/40 text-[10px]">Order Total</span>
                  <span className="text-white font-black text-[10px] font-mono">{formatKES(parseFloat(orderPrice) * parseFloat(orderQty) || 0)}</span>
                </div>
              )}

              {orderSuccess && (
                <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                  <CheckCircle2 size={12} className="text-green-400" />
                  <p className="text-green-400 text-xs font-bold">Order placed successfully!</p>
                </div>
              )}

              <button
                onClick={() => placeOrder.mutate()}
                disabled={!orderFarmId || !orderPrice || !orderQty || placeOrder.isPending}
                className="w-full py-3.5 rounded-xl text-sm font-black tracking-wide transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2"
                style={orderSide === "buy"
                  ? { background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#000" }
                  : { background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff" }}>
                {placeOrder.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {placeOrder.isPending ? "Placing…" : `Place ${orderSide === "buy" ? "Buy" : "Sell"} Order`}
              </button>
            </div>

            {/* My open orders */}
            {myOrders.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black tracking-widest text-white/25 uppercase">Open Orders</p>
                {myOrders.filter(o => o.status === "pending").map(order => (
                  <div key={order.id} className="flex items-center justify-between rounded-xl px-3 py-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${order.side === "buy" ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
                          {order.side?.toUpperCase()}
                        </span>
                        <p className="text-white text-xs font-bold truncate max-w-[130px]">{order.farmName ?? "Farm"}</p>
                      </div>
                      <p className="text-white/30 text-[9px] mt-0.5 font-mono">{formatKES(order.limitPrice)} × {order.quantity} shares</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5 text-amber-400/70 text-[9px]">
                        <Clock size={9} /> Pending
                      </span>
                      <button onClick={() => cancelOrder.mutate(order.id)}
                        disabled={cancelOrder.isPending}
                        className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <X size={11} className="text-red-400" />
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
                <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
              ))
            ) : activeMyListings.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.1)" }}>
                  <Tag size={22} className="text-green-400/30" />
                </div>
                <p className="text-white/30 text-sm font-semibold">No active listings</p>
                <p className="text-white/20 text-xs mt-1">List shares from your portfolio to earn on the exchange</p>
              </div>
            ) : (
              <>
                <p className="text-[9px] font-black tracking-widest text-white/25 uppercase">Active Listings</p>
                {activeMyListings.map(listing => {
                  const up = listing.changePercent >= 0;
                  return (
                    <div key={listing.id} className="rounded-xl overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="flex items-center gap-3 px-3 py-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={getCropImage(listing.cropType, listing.imageUrl)} alt={listing.farmName}
                            className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-extrabold text-sm truncate">{listing.farmName}</p>
                          <p className="text-white/30 text-[9px] font-mono mt-0.5">{listing.sharesAvailable} shares · {formatKES(listing.pricePerShare)}/share</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded font-mono ${up ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
                            {formatChange(listing.changePercent)}
                          </span>
                          <button onClick={() => setCancelListing(listing)}
                            className="text-[9px] font-bold text-red-400/60 px-2 py-1 rounded active:scale-90 transition-transform"
                            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {inactiveMyListings.length > 0 && (
                  <>
                    <p className="text-[9px] font-black tracking-widest text-white/15 uppercase pt-2">Completed / Cancelled</p>
                    {inactiveMyListings.map(listing => (
                      <div key={listing.id} className="flex items-center gap-3 rounded-xl px-3 py-3 opacity-40"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={getCropImage(listing.cropType, listing.imageUrl)} alt={listing.farmName} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-xs truncate">{listing.farmName}</p>
                          <p className="text-white/40 text-[9px]">Inactive · {listing.sharesAvailable} shares</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav role="investor" />

      {selectedListing && investOpen && (
        <InvestModal open={investOpen} onClose={() => setInvestOpen(false)} listing={selectedListing as any} />
      )}
      {alertListing && alertOpen && (
        <PriceAlertModal open={alertOpen} onClose={() => setAlertOpen(false)} listing={alertListing as any} />
      )}
      {cancelListing && (
        <CancelListingModal
          listing={cancelListing}
          onClose={() => setCancelListing(null)}
          onCancelled={() => { qc.invalidateQueries({ queryKey: ["my-listings"] }); }}
        />
      )}
    </div>
  );
}
