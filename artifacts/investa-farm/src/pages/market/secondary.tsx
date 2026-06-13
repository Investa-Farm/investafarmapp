import { useState } from "react";
import { useListSecondaryMarket } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, formatChange, getToken } from "@/lib/auth";
import { TrendingUp, TrendingDown, ArrowLeft, Users2, MapPin, Tag, X, Clock, CheckCircle2, XCircle, Loader2, RefreshCcw, Layers } from "lucide-react";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestModal } from "@/components/invest-modal";
import { getCropImage } from "@/lib/crops";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function SecondaryMarket() {
  const [, setLocation] = useLocation();
  const { data: listings, isLoading } = useListSecondaryMarket();
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [investOpen, setInvestOpen] = useState(false);
  const [cancelListing, setCancelListing] = useState<Listing | null>(null);
  const [tab, setTab] = useState<"market" | "mine">("market");
  const [cropFilter, setCropFilter] = useState<string>("all");
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

  const activeMyListings = myListings.filter(l => l.isActive !== false);
  const inactiveMyListings = myListings.filter(l => l.isActive === false);
  const totalVolume = (listings ?? []).reduce((s, l) => s + l.pricePerShare * l.sharesAvailable, 0);

  return (
    <div className="app-shell pb-20 page-enter" data-testid="secondary-market">
      {/* Premium header */}
      <div className="relative pt-12 pb-5 px-5 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #052e16 0%, #14532d 40%, #16a34a 80%, #22c55e 100%)" }}>
        {/* Dot matrix texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />

        <div className="relative flex items-center gap-3 mb-4">
          <button data-testid="button-back" onClick={() => setLocation("/market")}
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest">Investor to Investor</p>
              <span className="flex items-center gap-1 bg-green-400/20 border border-green-400/40 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                <span className="text-green-100 text-[9px] font-bold tracking-wider">LIVE</span>
              </span>
            </div>
            <h1 className="text-white text-xl font-extrabold">Secondary Market</h1>
          </div>
        </div>

        {/* Stats */}
        <div className="relative grid grid-cols-3 gap-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10">
            <p className="text-white font-extrabold text-lg leading-none">{listings?.length ?? "—"}</p>
            <p className="text-white/60 text-[9px] mt-1 uppercase tracking-wider">Listings</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10">
            <p className="text-white font-extrabold text-sm leading-none">⚡ +10%</p>
            <p className="text-white/60 text-[9px] mt-1 uppercase tracking-wider">Mid-Season</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10">
            <p className="text-white font-extrabold text-sm leading-none">🌾 +28%</p>
            <p className="text-white/60 text-[9px] mt-1 uppercase tracking-wider">Full Season</p>
          </div>
        </div>

        {/* Volume ticker */}
        {totalVolume > 0 && (
          <div className="relative mt-3 bg-white/8 rounded-xl px-3 py-2 flex items-center gap-2">
            <RefreshCcw size={10} className="text-green-300 animate-spin" style={{ animationDuration: "3s" }} />
            <p className="text-white/70 text-[10px]">
              Total market volume: <span className="text-green-300 font-bold">{formatKES(totalVolume)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 pb-0">
        <div className="flex bg-gray-100 rounded-2xl p-1">
          <button onClick={() => setTab("market")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === "market" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
            All Listings
          </button>
          <button onClick={() => setTab("mine")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${tab === "mine" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
            <Tag size={13} />
            My Listings
            {activeMyListings.length > 0 && (
              <span className="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {activeMyListings.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === "market" ? (
          <motion.div key="market" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="pt-3 space-y-3">
            {/* Crop filter chips */}
            {!isLoading && (listings?.length ?? 0) > 0 && (
              <div className="px-4">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {["all", ...Array.from(new Set(listings?.map(l => l.cropType) ?? []))].map(crop => (
                    <button
                      key={crop}
                      onClick={() => setCropFilter(crop)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                        cropFilter === crop
                          ? "bg-primary text-white shadow-sm shadow-primary/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {crop === "all" ? "🌍 All Crops" : `🌾 ${crop}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4">
              <p className="text-muted-foreground text-xs">Investors reselling shares — prices may differ from primary market</p>
            </div>

            <div className="px-4 space-y-3">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)
            ) : listings?.length === 0 ? (
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
            ) : (listings ?? []).filter(l => cropFilter === "all" || l.cropType === cropFilter).map((listing) => {
              const isUp = listing.changePercent >= 0;
              const sparkData = generateSparkData(listing.pricePerShare, 12, listing.changePercent / 100);
              const imgSrc = getCropImage(listing.cropType, listing.imageUrl ?? undefined);
              return (
                <div key={listing.id} data-testid={`secondary-listing-${listing.id}`}
                  className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">

                  {/* Hero image */}
                  <div className="relative h-44 cursor-pointer" onClick={(e) => handleBuyClick(e, listing as Listing)}>
                    <img src={imgSrc} alt={listing.farmName} className="w-full h-full object-cover" />
                    <div className="absolute inset-0"
                      style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.72) 100%)" }} />

                    {/* Top badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${isUp ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                          {isUp ? "▲" : "▼"} {formatChange(listing.changePercent)}
                        </span>
                        <RiskBadge level={getRiskLevel(listing.cropType, listing.changePercent)} />
                        <span className="text-[9px] font-bold bg-green-600/80 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                          RESALE
                        </span>
                        <span className="text-[9px] font-bold bg-violet-600/80 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                          🤝 1% fee
                        </span>
                      </div>
                      <span className="bg-black/40 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                        <Layers size={9} /> {listing.sharesAvailable}
                      </span>
                    </div>

                    {/* Bottom overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white font-bold text-base leading-tight">{listing.farmName}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-white/70" />
                        <p className="text-white/70 text-xs">{listing.cropType} · {listing.location}</p>
                      </div>
                      {listing.sellerName && (
                        <p className="text-violet-300 text-[10px] mt-0.5 font-medium">
                          📤 Resold by {listing.sellerName}
                        </p>
                      )}
                      <div className="flex items-end justify-between mt-2">
                        <div>
                          <p className="text-white text-xl font-bold">{formatKES(listing.pricePerShare)}</p>
                          <p className="text-white/60 text-[10px]">per share</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 opacity-80">
                            <Sparkline data={sparkData} color={isUp ? "#4ade80" : "#f87171"} height={28} />
                          </div>
                          <button data-testid={`button-buy-${listing.id}`}
                            onClick={(e) => handleBuyClick(e, listing as Listing)}
                            className="text-white font-bold px-4 py-2 rounded-xl text-sm active:scale-95 transition-transform shadow-lg"
                            style={{ background: "linear-gradient(135deg, #14532d, #16a34a)" }}>
                            BUY
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </motion.div>
        ) : (
          <motion.div key="mine" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="px-4 pt-3 space-y-3">
            {myLoading ? (
              Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
            ) : myListings.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <Tag size={28} className="text-primary" />
                </div>
                <p className="text-foreground text-sm font-semibold">No listings yet</p>
                <p className="text-muted-foreground text-xs mt-1 max-w-[220px] mx-auto leading-relaxed">
                  Go to your Portfolio and tap "Sell on Market" to list shares here.
                </p>
                <button onClick={() => setLocation("/portfolio")}
                  className="mt-4 bg-primary text-white text-xs font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-transform">
                  Go to Portfolio
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
                          <div className="relative h-28 overflow-hidden">
                            <img src={imgSrc} alt={listing.farmName} className="w-full h-full object-cover" />
                            <div className="absolute inset-0"
                              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.65) 100%)" }} />
                            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-end justify-between">
                              <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className="text-white text-sm font-bold">{listing.farmName}</p>
                                  <span className="text-[9px] bg-green-400/80 text-white font-bold px-1.5 py-0.5 rounded-full">Live</span>
                                </div>
                                <p className="text-white/70 text-[10px]">{listing.cropType} · {listing.sharesAvailable} shares</p>
                              </div>
                              <div className="text-right">
                                <p className="text-white font-bold text-sm">{formatKES(listing.pricePerShare)}</p>
                                <p className="text-white/60 text-[9px]">per share</p>
                              </div>
                            </div>
                          </div>
                          <div className="px-3 py-2.5 flex items-center justify-between border-t border-border">
                            <div className="flex items-center gap-2">
                              <Clock size={10} className="text-muted-foreground" />
                              <p className="text-muted-foreground text-[10px]">
                                {listing.createdAt ? new Date(listing.createdAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "Recently listed"}
                                {" · "}Total: <span className="text-foreground font-semibold">{formatKES(listing.pricePerShare * listing.sharesAvailable)}</span>
                              </p>
                            </div>
                            <button onClick={() => setCancelListing(listing)}
                              className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 text-[11px] font-semibold active:scale-95 transition-all flex items-center gap-1">
                              <X size={11} /> Cancel
                            </button>
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

      <InvestModal open={investOpen} onClose={() => setInvestOpen(false)} listing={selectedListing} />

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

      <BottomNav role="investor" />
    </div>
  );
}
