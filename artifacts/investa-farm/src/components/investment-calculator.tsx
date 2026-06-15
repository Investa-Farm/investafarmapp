import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, X, TrendingUp, Leaf, CloudRain, TrendingDown, Sun, Zap } from "lucide-react";
import { useCurrency } from "@/lib/currency";

interface CalcListing {
  farmId: number;
  farmName: string;
  cropType: string;
  pricePerShare: number;
  sharesAvailable: number;
  changePercent: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  listing: CalcListing | null;
  onBuy?: () => void;
}

const CROP_RAINFALL_SENSITIVITY: Record<string, number> = {
  maize: 0.6, beans: 0.5, tomatoes: 0.7, coffee: 0.5, tea: 0.4,
  dairy: 0.2, rice: 0.8, kale: 0.6, sunflower: 0.4, wheat: 0.5,
  avocado: 0.5, poultry: 0.15,
};

const SCENARIOS = [
  {
    id: "drought",
    icon: CloudRain,
    label: "Drought",
    desc: "Rainfall 20% below average",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    rainfallDelta: -0.20,
    priceDelta: -0.05,
    emoji: "🌵",
  },
  {
    id: "optimal",
    icon: Sun,
    label: "Optimal Season",
    desc: "Good rains + favourable prices",
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    rainfallDelta: +0.10,
    priceDelta: +0.08,
    emoji: "☀️",
  },
  {
    id: "price_drop",
    icon: TrendingDown,
    label: "Price Shock",
    desc: "Crop market prices drop 15%",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    rainfallDelta: 0,
    priceDelta: -0.15,
    emoji: "📉",
  },
];

export function InvestmentCalculator({ open, onClose, listing, onBuy }: Props) {
  const { formatAmount, currency, toDisplay } = useCurrency();
  const [inputAmount, setInputAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"returns" | "whatif">("returns");

  if (!listing) return null;

  const amount = parseFloat(inputAmount) || 0;
  const amountInKes = amount * currency.kesPerUnit;
  const sharesAffordable = amountInKes > 0 ? Math.floor(amountInKes / listing.pricePerShare) : 0;
  const actualCost = sharesAffordable * listing.pricePerShare;
  const wideReturn = actualCost * 1.08;
  const fullReturn = actualCost * 1.28;
  const wideProfit = wideReturn - actualCost;
  const fullProfit = fullReturn - actualCost;
  const maxAffordable = Math.min(sharesAffordable, listing.sharesAvailable);
  const maxCost = maxAffordable * listing.pricePerShare;

  const quickAmountsKes = [5_000, 10_000, 25_000, 50_000, 100_000];

  const cropKey = listing.cropType.toLowerCase();
  const rainfallSensitivity = CROP_RAINFALL_SENSITIVITY[cropKey] ?? 0.5;
  const BASE_FULL_RETURN = 0.28;

  const computeScenario = (rainfallDelta: number, priceDelta: number) => {
    const revenueMultiplier = 1 + (rainfallDelta * rainfallSensitivity) + priceDelta;
    const adjustedReturn = Math.max(0, BASE_FULL_RETURN * revenueMultiplier);
    const adjustedPayout = maxCost * (1 + adjustedReturn);
    const profit = adjustedPayout - maxCost;
    return { returnPct: adjustedReturn * 100, payout: adjustedPayout, profit };
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <motion.div className="relative w-full max-w-[430px] bg-background rounded-t-3xl"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            style={{ maxHeight: "90vh" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}>

            <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Calculator size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight truncate">{listing.farmName}</p>
                <p className="text-muted-foreground text-[10px]">
                  {listing.cropType} · {formatAmount(listing.pricePerShare)}/share
                </p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-4" style={{ maxHeight: "calc(90vh - 80px)" }}>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  How much do you want to invest? ({currency.code})
                </label>
                <div className="mt-1.5 flex items-center border border-border rounded-xl overflow-hidden focus-within:border-primary bg-background">
                  <span className="px-3 text-muted-foreground font-bold text-sm select-none">{currency.symbol}</span>
                  <input
                    type="number"
                    value={inputAmount}
                    onChange={e => setInputAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 py-3 pr-3 text-sm bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {quickAmountsKes.map(kes => (
                  <button key={kes}
                    onClick={() => setInputAmount(String(toDisplay(kes).toFixed(2)))}
                    className={`flex-shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${amountInKes === kes ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
                    {formatAmount(kes)}
                  </button>
                ))}
              </div>

              {sharesAffordable > 0 ? (
                <>
                  <div className="bg-muted rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Shares you can buy</span>
                      <span className="font-bold text-sm">{maxAffordable.toLocaleString()} shares</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Total cost</span>
                      <span className="font-semibold text-sm">{formatAmount(maxCost)}</span>
                    </div>
                    {listing.sharesAvailable < sharesAffordable && (
                      <p className="text-amber-600 text-[10px] font-semibold">
                        ⚡ Only {listing.sharesAvailable} shares left — adjusted to max available
                      </p>
                    )}
                  </div>

                  {/* Tab switcher */}
                  <div className="flex gap-1 bg-muted rounded-xl p-1">
                    <button
                      onClick={() => setActiveTab("returns")}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "returns" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                      <TrendingUp size={12} /> Returns
                    </button>
                    <button
                      onClick={() => setActiveTab("whatif")}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "whatif" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                      <Zap size={12} /> What-If
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {activeTab === "returns" && (
                      <motion.div key="returns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-3.5">
                          <div className="flex items-center gap-1 mb-1.5">
                            <Leaf size={11} className="text-green-600" />
                            <p className="text-green-700 text-[9px] font-bold uppercase tracking-wider">Wide Season</p>
                          </div>
                          <p className="text-green-800 font-bold text-lg leading-tight">{formatAmount(wideReturn)}</p>
                          <p className="text-green-600 text-[10px] mt-0.5">+{formatAmount(wideProfit)} profit</p>
                          <div className="mt-2 inline-flex items-center gap-1 bg-green-200 rounded-full px-2 py-0.5">
                            <TrendingUp size={8} className="text-green-700" />
                            <span className="text-green-700 text-[9px] font-bold">+8% · 30-60 days</span>
                          </div>
                        </div>
                        <div className="bg-primary/5 border border-primary/25 rounded-2xl p-3.5">
                          <div className="flex items-center gap-1 mb-1.5">
                            <TrendingUp size={11} className="text-primary" />
                            <p className="text-primary text-[9px] font-bold uppercase tracking-wider">Full Season</p>
                          </div>
                          <p className="text-primary font-bold text-lg leading-tight">{formatAmount(fullReturn)}</p>
                          <p className="text-primary/70 text-[10px] mt-0.5">+{formatAmount(fullProfit)} profit</p>
                          <div className="mt-2 inline-flex items-center gap-1 bg-primary/20 rounded-full px-2 py-0.5">
                            <TrendingUp size={8} className="text-primary" />
                            <span className="text-primary text-[9px] font-bold">+28% · ~6 months</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === "whatif" && (
                      <motion.div key="whatif" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          AI models the impact of Kenyan weather and market shocks on your <span className="font-semibold text-foreground">{listing.cropType}</span> investment (Full Season basis):
                        </p>
                        {SCENARIOS.map(sc => {
                          const result = computeScenario(sc.rainfallDelta, sc.priceDelta);
                          const isPositive = result.profit >= 0;
                          const Icon = sc.icon;
                          return (
                            <div key={sc.id} className={`rounded-2xl border p-3.5 ${sc.bg}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{sc.emoji}</span>
                                  <div>
                                    <p className={`font-bold text-sm ${sc.color}`}>{sc.label}</p>
                                    <p className="text-muted-foreground text-[10px]">{sc.desc}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={`font-extrabold text-base ${isPositive ? "text-green-600" : "text-red-500"}`}>
                                    {isPositive ? "+" : ""}{result.returnPct.toFixed(1)}%
                                  </p>
                                  <p className="text-[9px] text-muted-foreground">est. return</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2">
                                <span className="text-muted-foreground text-xs">You receive</span>
                                <span className={`font-bold text-sm ${isPositive ? "text-foreground" : "text-red-500"}`}>
                                  {formatAmount(result.payout)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
                          Scenario modelling uses crop rainfall sensitivity coefficients and market price elasticity. Results are illustrative.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {onBuy && (
                    <button onClick={() => { onClose(); onBuy(); }}
                      className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-transform">
                      Buy {maxAffordable} Shares — {formatAmount(maxCost)}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Calculator size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">Enter an amount above to simulate returns</p>
                  <p className="text-xs mt-1">Minimum: {formatAmount(listing.pricePerShare)} for 1 share</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
