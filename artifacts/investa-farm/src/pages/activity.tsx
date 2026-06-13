import { useState } from "react";
import { useListTransactions } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES } from "@/lib/auth";
import { TrendingUp, TrendingDown, ArrowUpRight, Clock, Receipt, X, ChevronRight, Calendar, Layers, DollarSign, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

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

export default function Activity() {
  const { data: transactions, isLoading } = useListTransactions();
  const [selectedTx, setSelectedTx] = useState<TxItem | null>(null);

  return (
    <div className="app-shell pb-20 page-enter" data-testid="activity-page">
      <div className="hero-header pt-12 pb-5 px-5">
        <p className="text-white/80 text-xs font-medium">Transaction History</p>
        <h1 className="text-white text-xl font-bold">Activity</h1>
        <p className="text-white/60 text-xs mt-1">Tap any transaction to view receipt</p>
      </div>

      <div className="px-4 pt-4 space-y-2.5">
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
            : transactions?.map((tx) => {
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

      <AnimatePresence>
        {selectedTx && <ReceiptSheet tx={selectedTx} onClose={() => setSelectedTx(null)} />}
      </AnimatePresence>

      <BottomNav role="investor" />
    </div>
  );
}
