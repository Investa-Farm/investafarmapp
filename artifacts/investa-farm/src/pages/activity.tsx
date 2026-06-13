import { useListTransactions } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES } from "@/lib/auth";
import { TrendingUp, TrendingDown, ArrowUpRight, Clock, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const typeConfig = {
  buy:  { label: "Bought",    color: "text-green-600",  bg: "bg-green-500/10",  icon: TrendingUp },
  sell: { label: "Sold",      color: "text-red-500",    bg: "bg-red-500/10",    icon: TrendingDown },
  exit: { label: "Exit",      color: "text-orange-600",  bg: "bg-orange-500/10",  icon: ArrowUpRight },
};

export default function Activity() {
  const { data: transactions, isLoading } = useListTransactions();

  return (
    <div className="app-shell pb-20 page-enter" data-testid="activity-page">
      <div className="hero-header pt-12 pb-5 px-5">
        <p className="text-white/80 text-xs font-medium">Transaction History</p>
        <h1 className="text-white text-xl font-bold">Activity</h1>
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
                  <div key={tx.id} data-testid={`transaction-${tx.id}`} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
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
                    <div className="text-right flex-shrink-0">
                      <p className="text-muted-foreground text-[10px]">{dateStr}</p>
                      <p className="text-muted-foreground text-[10px]">{timeStr}</p>
                      <span className={`text-[10px] font-medium capitalize ${tx.status === "completed" ? "text-green-600" : "text-orange-600"}`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                );
              })
        }
      </div>

      <BottomNav role="investor" />
    </div>
  );
}
