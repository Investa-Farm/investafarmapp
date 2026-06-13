import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, X, TrendingUp, Leaf } from "lucide-react";
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

export function InvestmentCalculator({ open, onClose, listing, onBuy }: Props) {
  const { formatAmount, currency, toDisplay } = useCurrency();
  const [inputAmount, setInputAmount] = useState("");

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <motion.div className="relative w-full max-w-[430px] bg-background rounded-t-3xl"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
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

            <div className="px-5 py-4 space-y-4">
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
                    className="flex-shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
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

                  <div className="grid grid-cols-2 gap-3">
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
                  </div>

                  {onBuy && (
                    <button onClick={() => { onClose(); onBuy(); }}
                      className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-transform">
                      Buy {maxAffordable} Shares — {formatAmount(maxCost)}
                    </button>
                  )}
                  <p className="text-muted-foreground text-[10px] text-center leading-relaxed">
                    Projections are illustrative. Actual returns vary by crop performance and market conditions.
                  </p>
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
