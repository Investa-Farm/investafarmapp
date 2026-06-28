import { useState } from "react";
import { useLocation } from "wouter";
import { useListTransactions } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getToken } from "@/lib/auth";
import { TrendingUp, TrendingDown, ArrowUpRight, Clock, Receipt, X, ChevronRight, Calendar, Layers, DollarSign, CheckCircle2, Newspaper, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getCropImage } from "@/lib/crops";

const typeConfig = {
  buy:  { label: "Bought",    color: "text-green-600",  bg: "bg-green-500/10",  icon: TrendingUp },
  sell: { label: "Sold",      color: "text-red-500",    bg: "bg-red-500/10",    icon: TrendingDown },
  exit: { label: "Exit",      color: "text-orange-600", bg: "bg-orange-500/10", icon: ArrowUpRight },
};

type TxItem = {
  id: number; type: string; farmName: string; cropType: string;
  quantity: number; pricePerShare: number; totalAmount: number;
  exitType?: string; status: string; createdAt: string; farmId?: number;
};

function ReceiptSheet({ tx, onClose }: { tx: TxItem; onClose: () => void }) {
  const cfg = typeConfig[tx.type as keyof typeof typeConfig] ?? typeConfig.buy;
  const Icon = cfg.icon;
  const date = new Date(tx.createdAt);
  const ref = `IF-${String(tx.id).padStart(6, "0")}`;
  const isDebit = tx.type === "buy";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="relative w-full max-w-[430px] bg-card rounded-t-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-muted rounded-full mx-auto mt-3 mb-1" />

        {/* Receipt header */}
        <div className="hero-header px-5 pt-4 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                <Icon size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-base">{cfg.label} Receipt</p>
                <p className="text-white/70 text-xs">{ref}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <X size={15} className="text-white" />
            </button>
          </div>
          <div className="mt-4 text-center">
            <p className="text-white/60 text-xs font-medium mb-1">{isDebit ? "Amount Paid" : "Amount Received"}</p>
            <p className={`text-3xl font-black ${isDebit ? "text-white" : "text-green-300"}`}>
              {isDebit ? "−" : "+"}{formatKES(tx.totalAmount)}
            </p>
          </div>
        </div>

        {/* Receipt body */}
        <div className="px-5 pt-4 pb-2 space-y-3">
          <ReceiptRow icon={<Layers size={14} className="text-primary" />} label="Farm" value={tx.farmName} />
          <ReceiptRow icon={<span className="text-sm">🌱</span>} label="Crop" value={tx.cropType} />
          <ReceiptRow icon={<DollarSign size={14} className="text-primary" />} label="Shares" value={`${tx.quantity} × ${formatKES(tx.pricePerShare)}`} />
          {tx.exitType && (
            <ReceiptRow
              icon={<Clock size={14} className="text-amber-500" />}
              label="Exit Plan"
              value={tx.exitType === "wide_season" ? "⚡ Mid-Season (30–60 days)" : "🌾 Full Season (~6 months)"}
            />
          )}
          <ReceiptRow
            icon={<Calendar size={14} className="text-blue-500" />}
            label="Date"
            value={date.toLocaleDateString("en-KE", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
          />
          <ReceiptRow
            icon={<Clock size={14} className="text-muted-foreground" />}
            label="Time"
            value={date.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          />

          <div className="border-t border-dashed border-border pt-3 flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium">Status</p>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
              tx.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}>
              {tx.status === "completed" && <CheckCircle2 size={11} />}
              {tx.status === "completed" ? "Completed" : "Pending"}
            </span>
          </div>
        </div>

        <div className="px-5 pb-8 pt-2">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform"
          >
            Close Receipt
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ReceiptRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
      </div>
      <p className="text-foreground text-xs font-semibold text-right max-w-[55%]">{value}</p>
    </div>
  );
}

type Placement = {
  id: number; farmId: number; farmName: string; cropType: string;
  pricePerShare: number; sharesAvailable: number; changePercent: number;
  createdAt?: string; isActive?: boolean;
};

export default function Activity() {
  const [, setLocation] = useLocation();
  const { data: transactions, isLoading } = useListTransactions();
  const [selectedTx, setSelectedTx] = useState<TxItem | null>(null);
  const [tab, setTab] = useState<"transactions" | "placements" | "feed">("transactions");
  const token = typeof window !== "undefined" ? localStorage.getItem("investa_token") : null;

  const { data: placements = [], isLoading: placementsLoading } = useQuery<Placement[]>({
    queryKey: ["my-listings-activity"],
    queryFn: async () => {
      const r = await fetch("/api/market/my-listings", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: tab === "placements",
  });

  const activePlacements = placements.filter(p => p.isActive !== false);
  const soldPlacements = placements.filter(p => p.isActive === false);

  const { data: feedItems = [], isLoading: feedLoading } = useQuery<any[]>({
    queryKey: ["investor-feed"],
    queryFn: async () => {
      const r = await fetch("/api/investor/feed", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: tab === "feed",
    staleTime: 60_000,
  });

  const totalBought = (transactions ?? []).filter((t: any) => t.type === "buy").reduce((s: number, t: any) => s + Number(t.totalAmount), 0);
  const totalExited = (transactions ?? []).filter((t: any) => t.type === "exit" || t.type === "sell").reduce((s: number, t: any) => s + Number(t.totalAmount), 0);
  const txCount = (transactions ?? []).length;

  return (
    <div className="app-shell pb-20 page-enter" data-testid="activity-page">
      <div className="hero-header pt-12 pb-6 px-5">
        <p className="text-white/80 text-xs font-medium">Transaction History</p>
        <h1 className="text-white text-2xl font-bold mt-0.5">Activity</h1>
        <p className="text-white/60 text-xs mt-0.5">Tap any transaction to view receipt</p>
        {txCount > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: "Transactions", val: String(txCount) },
              { label: "Total Invested", val: `KES ${(totalBought / 1000).toFixed(0)}K` },
              { label: "Total Exits", val: `KES ${(totalExited / 1000).toFixed(0)}K` },
            ].map(({ label, val }) => (
              <div key={label} className="bg-white/10 border border-white/15 rounded-xl py-2 px-1 text-center">
                <p className="text-white font-bold text-sm leading-none">{val}</p>
                <p className="text-white/55 text-[9px] mt-1 leading-none">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex bg-muted rounded-2xl p-1">
          <button
            onClick={() => setTab("transactions")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
              tab === "transactions" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Receipt size={12} />
            Transactions
          </button>
          <button
            onClick={() => setTab("placements")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
              tab === "placements" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Layers size={12} />
            Placements
            {activePlacements.length > 0 && (
              <span className="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {activePlacements.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("feed")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
              tab === "feed" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Newspaper size={12} />
            Farm Feed
          </button>
        </div>
      </div>

      {tab === "transactions" && (
        <div className="px-4 pt-3 space-y-2.5">
          {isLoading
            ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
            : transactions?.length === 0
              ? (
                <div className="text-center py-16">
                  <Receipt size={36} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-semibold text-sm">No activity yet</p>
                  <p className="text-muted-foreground text-xs mt-1">Your transactions will appear here once you invest.</p>
                </div>
              )
              : transactions?.map((tx: any) => {
                  const cfg = typeConfig[tx.type as keyof typeof typeConfig] ?? typeConfig.buy;
                  const Icon = cfg.icon;
                  const date = new Date(tx.createdAt);
                  const dateStr = date.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
                  const timeStr = date.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });

                  return (
                    <button
                      key={tx.id}
                      data-testid={`transaction-${tx.id}`}
                      className="w-full bg-card rounded-2xl border border-border p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
                      onClick={() => setSelectedTx(tx as TxItem)}
                    >
                      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={18} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-foreground text-sm font-semibold">{cfg.label} · {tx.farmName}</p>
                          <p className={`text-sm font-bold ${tx.type === "buy" ? "text-foreground" : "text-green-600"}`}>
                            {tx.type === "buy" ? "-" : "+"}{formatKES(tx.totalAmount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-muted-foreground text-[11px]">{tx.cropType}</span>
                          <span className="text-muted-foreground text-[11px]">·</span>
                          <span className="text-muted-foreground text-[11px]">{tx.quantity} shares @ {formatKES(tx.pricePerShare)}</span>
                        </div>
                        {tx.exitType && (
                          <span className="text-muted-foreground text-[10px]">
                            {tx.exitType === "wide_season" ? "⚡ Mid-Season exit" : "🌾 Full Season exit"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-muted-foreground text-[10px]">{dateStr}</p>
                          <p className="text-muted-foreground text-[10px]">{timeStr}</p>
                          <span className={`text-[10px] font-medium capitalize ${tx.status === "completed" ? "text-green-600" : "text-orange-600"}`}>
                            {tx.status}
                          </span>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </button>
                  );
                })
          }
        </div>
      )}

      {tab === "placements" && (
        <div className="px-4 pt-3 space-y-3">
          {/* Broker fee info */}
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
              <DollarSign size={14} className="text-violet-600" />
            </div>
            <div>
              <p className="text-violet-800 font-semibold text-xs">🤝 Broker Fee: 1% per placement</p>
              <p className="text-violet-600 text-[10px] mt-0.5 leading-relaxed">
                When your listed shares are sold, you earn a 1% placement fee on the total trade value.
              </p>
            </div>
          </div>

          {placementsLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          ) : placements.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
                <Layers size={28} className="text-violet-400" />
              </div>
              <p className="text-foreground font-semibold text-sm">No placements yet</p>
              <p className="text-muted-foreground text-xs mt-1 max-w-[220px] mx-auto leading-relaxed">
                Go to your Portfolio and tap "Sell on Market" to list shares on the Secondary Market.
              </p>
            </div>
          ) : (
            <>
              {activePlacements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Active ({activePlacements.length})
                  </p>
                  {activePlacements.map(p => {
                    const placementFee = p.pricePerShare * p.sharesAvailable * 0.01;
                    return (
                      <div key={p.id} className="bg-card rounded-2xl border border-border p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <Layers size={18} className="text-violet-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground text-sm font-semibold truncate">{p.farmName}</p>
                          <p className="text-muted-foreground text-[10px]">
                            {p.cropType} · {p.sharesAvailable} shares @ {formatKES(p.pricePerShare)}
                          </p>
                          <p className="text-violet-600 text-[10px] font-medium">
                            🤝 Broker fee if sold: {formatKES(placementFee)}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-foreground font-bold text-sm">{formatKES(p.pricePerShare * p.sharesAvailable)}</p>
                          <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">Live</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {soldPlacements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Completed / Cancelled ({soldPlacements.length})
                  </p>
                  {soldPlacements.map(p => (
                    <div key={p.id} className="bg-card rounded-2xl border border-border p-3 flex items-center gap-3 opacity-60">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <Layers size={18} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm font-medium truncate">{p.farmName}</p>
                        <p className="text-muted-foreground text-[10px]">{p.cropType} · {p.sharesAvailable} shares</p>
                      </div>
                      <span className="text-[9px] bg-gray-100 text-gray-500 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">Done</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "feed" && (
        <div className="px-4 pt-3 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Newspaper size={14} className="text-primary" />
            <p className="text-xs font-semibold text-foreground">Updates from farms you're invested in</p>
          </div>
          {feedLoading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          ) : feedItems.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-3">
                <Newspaper size={28} className="text-primary/40" />
              </div>
              <p className="text-foreground font-semibold text-sm">No farm updates yet</p>
              <p className="text-muted-foreground text-xs mt-1 max-w-[240px] mx-auto leading-relaxed">
                Invest in a farm first to see live updates here — harvest progress, field reports, and more.
              </p>
              <button
                onClick={() => setLocation("/market")}
                className="mt-4 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
              >
                Browse Farms →
              </button>
            </div>
          ) : feedItems.map((item: any) => {
            const img = getCropImage(item.cropType, item.updateImageUrl ?? item.imageUrl);
            const date = new Date(item.createdAt);
            return (
              <div key={item.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="relative h-24">
                  <img src={img} alt={item.farmName} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
                  <div className="absolute inset-0 p-3 flex flex-col justify-end">
                    <span className="text-white font-bold text-sm leading-tight">{item.farmName}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={9} className="text-white/60" />
                      <span className="text-white/60 text-[10px]">{item.location}</span>
                      <span className="text-white/40 text-[10px] ml-1">· {item.cropType}</span>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg px-2 py-0.5">
                    <span className="text-white text-[9px] font-semibold">
                      {date.toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-foreground font-semibold text-sm">{item.title}</p>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed line-clamp-2">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedTx && <ReceiptSheet tx={selectedTx} onClose={() => setSelectedTx(null)} />}
      </AnimatePresence>

      <BottomNav role="investor" />
    </div>
  );
}
