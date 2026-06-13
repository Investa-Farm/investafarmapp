import { useState } from "react";
import { useGetPortfolio, useGetPortfolioSummary } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, formatChange } from "@/lib/auth";
import { TrendingUp, TrendingDown, Share2, Tag } from "lucide-react";
import { ShareModal } from "@/components/share-modal";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ExitModal } from "@/components/exit-modal";
import { SellSharesModal } from "@/components/sell-shares-modal";
import { getCropImage } from "@/lib/crops";

type Holding = {
  id: number; farmId: number; farmName: string; cropType: string; location: string;
  quantity: number; purchasePrice: number; currentPrice: number; totalValue: number;
  gainLoss: number; gainLossPercent: number; exitType: string; imageUrl?: string; status: string;
};

export default function Portfolio() {
  const { data: holdings, isLoading } = useGetPortfolio();
  const { data: summary } = useGetPortfolioSummary();
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [shareHolding, setShareHolding] = useState<Holding | null>(null);

  const handleExitClick = (h: Holding) => { setSelectedHolding(h); setExitOpen(true); };
  const handleSellClick = (h: Holding) => { setSelectedHolding(h); setSellOpen(true); };

  return (
    <div className="app-shell pb-20 page-enter" data-testid="portfolio-page">
      <div className="hero-header pt-12 pb-5 px-5">
        <p className="text-white/80 text-xs font-medium">My Portfolio</p>
        {summary ? (
          <>
            <p className="text-white/70 text-sm mt-1">Portfolio Value</p>
            <p className="text-white text-3xl font-bold mt-0.5">{formatKES(summary.totalValue)}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1">
                <TrendingUp size={12} className="text-white/80" />
                <span className="text-white/80 text-xs font-semibold">{formatChange(summary.todayReturnPercent)} today</span>
              </div>
              <span className="text-white/30">|</span>
              <span className="text-white/70 text-xs">{formatChange(summary.weekReturnPercent)} this week</span>
            </div>
            {summary.priceHistory.length > 0 && (
              <div className="mt-2">
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={summary.priceHistory}>
                    <defs>
                      <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgba(255,255,255,0.4)" />
                        <stop offset="95%" stopColor="rgba(255,255,255,0)" />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="rgba(255,255,255,0.9)" strokeWidth={2} fill="url(#portGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { label: "Invested", val: formatKES(summary.totalInvested) },
                { label: "Today's P&L", val: formatKES(summary.todayReturn) },
                { label: "Holdings", val: String(summary.holdings) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white/20 rounded-xl p-2.5 text-center">
                  <p className="text-white text-xs font-bold truncate">{val}</p>
                  <p className="text-white/60 text-[9px] mt-0.5 truncate">{label}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Skeleton className="h-24 mt-2 rounded-2xl bg-white/20" />
        )}
      </div>

      {/* Return info banner */}
      <div className="mx-4 mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-3">
        <p className="text-green-700 text-xs font-semibold mb-2">Exit Options & Payouts</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/70 rounded-xl p-2">
            <div className="flex items-center gap-1.5">
              <span>⚡</span>
              <p className="text-xs font-semibold text-orange-700">Mid-Season</p>
            </div>
            <p className="text-orange-600 font-bold text-sm mt-0.5">+10% base</p>
            <p className="text-muted-foreground text-[10px]">30–60 days</p>
          </div>
          <div className="bg-white/70 rounded-xl p-2">
            <div className="flex items-center gap-1.5">
              <span>🌾</span>
              <p className="text-xs font-semibold text-green-700">Full Season</p>
            </div>
            <p className="text-green-600 font-bold text-sm mt-0.5">Up to +22%</p>
            <p className="text-muted-foreground text-[10px]">~6 months</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <h2 className="font-semibold text-foreground text-sm">My Holdings</h2>
        {isLoading
          ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          : holdings?.length === 0
            ? (
              <div className="text-center py-12">
                <TrendingUp size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No holdings yet.</p>
                <p className="text-muted-foreground text-xs mt-1">Browse the market to buy your first farm shares.</p>
              </div>
            )
            : (holdings as Holding[])?.map((h) => {
                const isUp = h.gainLoss >= 0;
                const isExited = h.status === "exit_requested";
                const invested = h.purchasePrice * h.quantity;
                const midPayout = invested * 1.10;
                const fullPayout = invested * 1.22;
                const farmImg = getCropImage(h.cropType, h.imageUrl);

                return (
                  <div key={h.id} data-testid={`holding-${h.id}`} className="bg-card rounded-2xl border border-border overflow-hidden">
                    {/* Farm image strip — always shown */}
                    <div className="relative h-20">
                      <img src={farmImg} alt={h.farmName} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                      <div className="absolute inset-0 p-3 flex items-end">
                        <div>
                          <p className="text-white font-bold text-sm">{h.farmName}</p>
                          <p className="text-white/70 text-[11px]">{h.cropType} · {h.location}</p>
                        </div>
                      </div>
                      {isExited && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Exit Pending
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-muted/50 rounded-xl p-2 text-center">
                          <p className="text-muted-foreground text-[9px]">Shares</p>
                          <p className="text-foreground font-bold text-xs">{h.quantity}</p>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-2 text-center">
                          <p className="text-muted-foreground text-[9px]">Value</p>
                          <p className="text-foreground font-bold text-xs">{formatKES(h.totalValue)}</p>
                        </div>
                        <div className={`rounded-xl p-2 text-center ${isUp ? "bg-green-50" : "bg-red-50"}`}>
                          <p className="text-muted-foreground text-[9px]">Gain/Loss</p>
                          <p className={`font-bold text-xs ${isUp ? "text-green-600" : "text-red-500"}`}>{formatChange(h.gainLossPercent)}</p>
                        </div>
                      </div>

                      {/* Payout preview */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-2.5">
                        <p className="text-green-700 text-[10px] font-semibold mb-1.5">Estimated Payout on Exit</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-muted-foreground text-[9px]">⚡ Mid-Season (+10%)</p>
                            <p className="text-orange-600 font-bold text-xs">{formatKES(midPayout)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[9px]">🌾 Full Season (+22%)</p>
                            <p className="text-green-600 font-bold text-xs">{formatKES(fullPayout)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setShareHolding(h)}
                          className="py-2.5 px-3 rounded-xl border border-border text-muted-foreground text-xs font-medium active:scale-95 transition-all flex items-center gap-1.5"
                        >
                          <Share2 size={13} /> Share
                        </button>
                        {h.status === "active" && (
                          <>
                            <button
                              onClick={() => handleSellClick(h)}
                              className="flex-1 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Tag size={12} /> Sell on Market
                            </button>
                            <button
                              onClick={() => handleExitClick(h)}
                              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold active:scale-95 transition-all"
                            >
                              Exit Payout
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
        }
      </div>

      <ExitModal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        holding={selectedHolding}
      />

      <SellSharesModal
        open={sellOpen}
        onClose={() => setSellOpen(false)}
        holding={selectedHolding}
      />

      <ShareModal
        open={!!shareHolding}
        onClose={() => setShareHolding(null)}
        title={shareHolding?.farmName ?? ""}
        text={shareHolding ? `🌱 I'm invested in ${shareHolding.farmName} on Investa Farm! ${shareHolding.cropType} · ${shareHolding.location} · Earn up to +22% returns` : ""}
        url="https://investafarm.co.ke"
      />

      <BottomNav role="investor" />
    </div>
  );
}
