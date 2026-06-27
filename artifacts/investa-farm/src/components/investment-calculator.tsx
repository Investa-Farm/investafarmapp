import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, X, TrendingUp, Leaf, CloudRain, TrendingDown, Sun, Zap, Info, ChevronRight } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"returns" | "whatif" | "math">("returns");
  const [mathExpanded, setMathExpanded] = useState(false);

  if (!listing) return null;

  const amount = parseFloat(inputAmount) || 0;
  const amountInKes = amount * currency.kesPerUnit;
  const sharesAffordable = amountInKes > 0 ? Math.floor(amountInKes / listing.pricePerShare) : 0;
  const actualCost = sharesAffordable * listing.pricePerShare;
  const midReturn = actualCost * 1.10;
  const fullReturn = actualCost * 1.28;
  const midProfit = midReturn - actualCost;
  const fullProfit = fullReturn - actualCost;
  const maxAffordable = Math.min(sharesAffordable, listing.sharesAvailable);
  const maxCost = maxAffordable * listing.pricePerShare;
  const midReturnMax = maxCost * 1.10;
  const fullReturnMax = maxCost * 1.28;
  const midProfitMax = midReturnMax - maxCost;
  const fullProfitMax = fullReturnMax - maxCost;
  const platformFee = maxCost * 0.015;
  const netCost = maxCost + platformFee;

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

  const midAnnualised = ((1.10 ** (365 / 45)) - 1) * 100;
  const fullAnnualised = ((1.28 ** (365 / 180)) - 1) * 100;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div className="relative w-full max-w-[430px] bg-background rounded-t-3xl flex flex-col"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            style={{ maxHeight: "92dvh" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}>

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-2.5 px-5 pt-2 pb-3 border-b border-border flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
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

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Amount input */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  How much to invest? ({currency.code})
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

              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                {quickAmountsKes.map(kes => (
                  <button key={kes}
                    onClick={() => setInputAmount(String(toDisplay(kes).toFixed(2)))}
                    className={`flex-shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${amountInKes === kes ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
                    {formatAmount(kes)}
                  </button>
                ))}
              </div>

              {maxAffordable > 0 ? (
                <>
                  {/* Summary box */}
                  <div className="bg-muted rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Shares you can buy</span>
                      <span className="font-bold text-sm">{maxAffordable.toLocaleString()} shares</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Share cost</span>
                      <span className="font-semibold text-sm">{formatAmount(maxCost)}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground/70">
                      <span className="text-[10px]">Platform fee (1.5%)</span>
                      <span className="text-[10px]">{formatAmount(platformFee)}</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-xs font-semibold">Total you pay</span>
                      <span className="font-bold text-sm text-foreground">{formatAmount(netCost)}</span>
                    </div>
                    {listing.sharesAvailable < sharesAffordable && (
                      <p className="text-amber-600 text-[10px] font-semibold">
                        ⚡ Only {listing.sharesAvailable} shares left — adjusted to max available
                      </p>
                    )}
                  </div>

                  {/* Tab switcher */}
                  <div className="flex gap-1 bg-muted rounded-xl p-1">
                    {[
                      { id: "returns", label: "Returns", icon: TrendingUp },
                      { id: "whatif", label: "What-If", icon: Zap },
                      { id: "math", label: "Math", icon: Info },
                    ].map(t => (
                      <button key={t.id}
                        onClick={() => setActiveTab(t.id as any)}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${activeTab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                        <t.icon size={11} /> {t.label}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    {activeTab === "returns" && (
                      <motion.div key="returns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3.5">
                            <div className="flex items-center gap-1 mb-1.5">
                              <span className="text-sm">⚡</span>
                              <p className="text-orange-700 text-[9px] font-bold uppercase tracking-wider">Mid-Season</p>
                            </div>
                            <p className="text-orange-700 font-bold text-lg leading-tight">{formatAmount(midReturnMax)}</p>
                            <p className="text-orange-500 text-[10px] mt-0.5">+{formatAmount(midProfitMax)} profit</p>
                            <div className="mt-2 inline-flex items-center gap-1 bg-orange-200 rounded-full px-2 py-0.5">
                              <TrendingUp size={8} className="text-orange-700" />
                              <span className="text-orange-700 text-[9px] font-bold">+10% · 30–60 days</span>
                            </div>
                          </div>
                          <div className="bg-green-50 border border-green-200 rounded-2xl p-3.5">
                            <div className="flex items-center gap-1 mb-1.5">
                              <Leaf size={11} className="text-green-600" />
                              <p className="text-green-700 text-[9px] font-bold uppercase tracking-wider">Full Season</p>
                            </div>
                            <p className="text-green-700 font-bold text-lg leading-tight">{formatAmount(fullReturnMax)}</p>
                            <p className="text-green-500 text-[10px] mt-0.5">+{formatAmount(fullProfitMax)} profit</p>
                            <div className="mt-2 inline-flex items-center gap-1 bg-green-200 rounded-full px-2 py-0.5">
                              <TrendingUp size={8} className="text-green-700" />
                              <span className="text-green-700 text-[9px] font-bold">+28% · ~6 months</span>
                            </div>
                          </div>
                        </div>

                        {/* Annualised returns strip */}
                        <div className="bg-muted/60 rounded-xl px-4 py-3 flex items-center justify-between">
                          <div className="text-center">
                            <p className="text-muted-foreground text-[9px] font-medium">Mid-Season Ann. ROI</p>
                            <p className="text-orange-600 font-bold text-xs">{midAnnualised.toFixed(0)}% p.a.</p>
                          </div>
                          <div className="w-px h-8 bg-border" />
                          <div className="text-center">
                            <p className="text-muted-foreground text-[9px] font-medium">Full-Season Ann. ROI</p>
                            <p className="text-green-600 font-bold text-xs">{fullAnnualised.toFixed(0)}% p.a.</p>
                          </div>
                          <div className="w-px h-8 bg-border" />
                          <div className="text-center">
                            <p className="text-muted-foreground text-[9px] font-medium">Shares @ price</p>
                            <p className="text-foreground font-bold text-xs">{formatAmount(listing.pricePerShare)}</p>
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
                          Scenario modelling uses crop rainfall sensitivity and market price elasticity. Illustrative only.
                        </p>
                      </motion.div>
                    )}

                    {activeTab === "math" && (
                      <motion.div key="math" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                          <p className="text-blue-800 font-bold text-xs">📐 How Returns Are Calculated</p>

                          <div className="space-y-2.5">
                            <div className="bg-white/70 rounded-xl p-3">
                              <p className="text-blue-700 text-[10px] font-bold mb-1">⚡ Mid-Season Exit (Secondary Market Sale)</p>
                              <p className="text-muted-foreground text-[10px] font-mono leading-relaxed">
                                P_sell = P₀ × (1 + 0.10) × demand_factor<br />
                                Proceeds = Q × P_sell × (1 − 0.005)<br />
                                ROI = (Proceeds − Cost) / Cost × 100
                              </p>
                              <div className="mt-2 pt-2 border-t border-blue-100 grid grid-cols-2 gap-1.5">
                                <div>
                                  <p className="text-[9px] text-muted-foreground">Your shares (Q)</p>
                                  <p className="font-bold text-xs">{maxAffordable}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-muted-foreground">Sale price/share</p>
                                  <p className="font-bold text-xs">{formatAmount(listing.pricePerShare * 1.10)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-muted-foreground">Trade fee (0.5%)</p>
                                  <p className="font-bold text-xs">{formatAmount(midReturnMax * 0.005)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-muted-foreground">Net proceeds</p>
                                  <p className="font-bold text-xs text-orange-600">{formatAmount(midReturnMax * 0.995)}</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white/70 rounded-xl p-3">
                              <p className="text-blue-700 text-[10px] font-bold mb-1">🌾 Full Season Exit (Harvest Dividend)</p>
                              <p className="text-muted-foreground text-[10px] font-mono leading-relaxed">
                                Revenue = LoanAmt × 1.40<br />
                                InvestorShare = Revenue × α (α = 65%)<br />
                                Payout = Q × (InvestorShare / TotalShares)<br />
                                ROI = (Payout − Cost) / Cost × 100
                              </p>
                              <div className="mt-2 pt-2 border-t border-blue-100 grid grid-cols-2 gap-1.5">
                                <div>
                                  <p className="text-[9px] text-muted-foreground">Investment (Cost)</p>
                                  <p className="font-bold text-xs">{formatAmount(maxCost)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-muted-foreground">Expected payout</p>
                                  <p className="font-bold text-xs text-green-600">{formatAmount(fullReturnMax)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-muted-foreground">Gross profit</p>
                                  <p className="font-bold text-xs text-green-600">+{formatAmount(fullProfitMax)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-muted-foreground">ROI</p>
                                  <p className="font-bold text-xs text-green-600">+28%</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="text-[9px] text-blue-600 leading-relaxed">
                            α (alpha) = investor revenue share · P₀ = purchase price per share · Q = quantity · Fees are deducted from proceeds.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Bottom spacer */}
                  <div className="h-2" />
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Calculator size={32} className="opacity-30" />
                  </div>
                  <p className="text-sm font-medium">Enter an amount to simulate returns</p>
                  <p className="text-xs mt-1 text-muted-foreground/70">Minimum: {formatAmount(listing.pricePerShare)} for 1 share</p>
                </div>
              )}
            </div>

            {/* Sticky buy button */}
            {maxAffordable > 0 && onBuy && (
              <div className="flex-shrink-0 px-5 pb-8 pt-3 border-t border-border bg-background">
                <button onClick={() => { onClose(); onBuy(); }}
                  className="w-full bg-primary text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                  <TrendingUp size={16} />
                  Buy {maxAffordable} Shares — {formatAmount(maxCost)}
                </button>
                <p className="text-center text-[10px] text-muted-foreground mt-2">
                  +{formatAmount(platformFee)} platform fee · Total: {formatAmount(netCost)}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
