import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, CheckCircle2, Loader2, Tag, ChevronRight, Lock, Clock } from "lucide-react";
import { formatKES } from "@/lib/auth";
import { useListSharesForSale } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getCropImage } from "@/lib/crops";

interface SellSharesModalProps {
  open: boolean;
  onClose: () => void;
  holding: {
    id: number; farmName: string; cropType: string; location: string;
    quantity: number; purchasePrice: number; currentPrice: number;
    totalValue: number; imageUrl?: string;
  } | null;
  seasonStatus?: "pre_season" | "mid_season" | "full_season";
  daysRemaining?: number;
  minHoldDays?: number;
}

export function SellSharesModal({ open, onClose, holding, seasonStatus = "mid_season", daysRemaining = 0, minHoldDays = 45 }: SellSharesModalProps) {
  const [step, setStep] = useState<"configure" | "review" | "done">("configure");
  const [quantity, setQuantity] = useState(1);
  const [pricePerShare, setPricePerShare] = useState(0);
  const [apiError, setApiError] = useState("");
  const listShares = useListSharesForSale();
  const qc = useQueryClient();

  if (!holding) return null;

  const isLocked = seasonStatus === "pre_season";
  const suggestedPrice = holding.currentPrice;
  const effectivePrice = pricePerShare || suggestedPrice;
  const totalProceeds = effectivePrice * quantity;
  const invested = holding.purchasePrice * quantity;
  const profit = totalProceeds - invested;

  const handleOpen = () => {
    setQuantity(1);
    setPricePerShare(holding.currentPrice);
    setApiError("");
  };

  const handleSubmit = () => {
    setApiError("");
    listShares.mutate(
      { data: { holdingId: holding.id, quantity, pricePerShare: effectivePrice } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["portfolio"] });
          setStep("done");
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? err?.message ?? "Listing failed. Please try again.";
          setApiError(msg);
        },
      }
    );
  };

  const resetAndClose = () => {
    onClose();
    setTimeout(() => { setStep("configure"); setApiError(""); }, 400);
  };

  const imgSrc = getCropImage(holding.cropType, holding.imageUrl);

  return (
    <AnimatePresence onExitComplete={handleOpen}>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetAndClose} />

          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-xl max-h-[90dvh] overflow-y-auto">

            <div className="sticky top-0 bg-white border-b border-border px-5 pt-5 pb-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                {step === "review" && !isLocked && (
                  <button onClick={() => setStep("configure")} className="text-muted-foreground mr-1">
                    <ChevronRight size={18} className="rotate-180" />
                  </button>
                )}
                <div>
                  <p className="text-foreground font-bold text-base">
                    {isLocked ? "Shares Locked" : step === "configure" ? "List Shares for Sale" : step === "review" ? "Confirm Listing" : "Listed!"}
                  </p>
                  <p className="text-muted-foreground text-xs">{holding.farmName}</p>
                </div>
              </div>
              <button onClick={resetAndClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 pt-4 pb-8 space-y-4">

              {/* ── LOCKED STATE ─────────────────────────────────────────── */}
              {isLocked && (
                <div className="flex flex-col items-center py-8 gap-5">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                    <Lock size={36} className="text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-foreground font-bold text-lg mb-1">Secondary Market Locked</p>
                    <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px] mx-auto">
                      {holding.cropType} shares must be held for at least <strong>{minHoldDays} days</strong> before listing on the secondary market.
                    </p>
                  </div>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock size={22} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-bold text-2xl leading-none">{daysRemaining}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">days until listing opens</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-muted-foreground text-xs">Hold period</p>
                      <p className="text-foreground font-semibold text-sm">{minHoldDays} days</p>
                    </div>
                  </div>
                  <div className="w-full bg-primary/5 border border-primary/20 rounded-2xl p-3 text-center">
                    <p className="text-primary text-xs font-semibold">
                      💡 While you wait, your investment continues to grow. You can still request an exit via the Exit button.
                    </p>
                  </div>
                  <button onClick={resetAndClose}
                    className="w-full bg-muted text-foreground font-semibold py-3.5 rounded-xl active:scale-95 transition-all">
                    Got it
                  </button>
                </div>
              )}

              {/* ── ACTIVE STATE ─────────────────────────────────────────── */}
              {!isLocked && (
                <>
                  {seasonStatus === "mid_season" && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <p className="text-orange-700 text-[11px] font-semibold">Mid-Season Window Open — secondary market listing available</p>
                    </div>
                  )}
                  {seasonStatus === "full_season" && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 flex items-center gap-2">
                      <span className="text-base">🌾</span>
                      <p className="text-green-700 text-[11px] font-semibold">Full-Season Window — premium pricing available on the secondary market</p>
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {step === "configure" && (
                      <motion.div key="configure" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        <div className="flex items-center gap-3 bg-muted/50 rounded-2xl p-3">
                          <img src={imgSrc} alt={holding.farmName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-foreground font-semibold text-sm">{holding.farmName}</p>
                            <p className="text-muted-foreground text-xs">{holding.cropType} · {holding.location}</p>
                            <p className="text-primary text-xs font-medium mt-0.5">You own {holding.quantity} shares</p>
                          </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-2">
                          <Tag size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                          <p className="text-blue-700 text-xs leading-relaxed">
                            Your shares will be listed on the <strong>Secondary Market</strong> for other investors to buy. You set the price.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shares to Sell</p>
                          <div className="flex items-center gap-3">
                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                              className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-foreground text-lg font-bold active:scale-90 transition-transform">−</button>
                            <input type="number" value={quantity}
                              onChange={e => setQuantity(Math.max(1, Math.min(holding.quantity, Number(e.target.value))))}
                              className="flex-1 text-center text-foreground font-bold text-xl border border-border rounded-xl py-2.5 focus:outline-none focus:border-primary" />
                            <button onClick={() => setQuantity(q => Math.min(holding.quantity, q + 1))}
                              className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-foreground text-lg font-bold active:scale-90 transition-transform">+</button>
                          </div>
                          <p className="text-muted-foreground text-xs text-center">{holding.quantity} shares available to sell</p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price Per Share (KES)</p>
                            <button onClick={() => setPricePerShare(suggestedPrice)}
                              className="text-primary text-[10px] font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                              Use market price
                            </button>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">KES</span>
                            <input type="number" value={pricePerShare || ""}
                              onChange={e => setPricePerShare(Number(e.target.value))}
                              placeholder={String(suggestedPrice)}
                              className="w-full border border-border rounded-xl pl-14 pr-4 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-primary bg-gray-50" />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">You paid</span>
                            <span className="font-medium">{formatKES(holding.purchasePrice)} / share</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Current market price</span>
                            <span className="font-medium text-primary">{formatKES(suggestedPrice)} / share</span>
                          </div>
                        </div>

                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{quantity} shares × {formatKES(effectivePrice)}</span>
                            <span className="text-foreground font-bold">{formatKES(totalProceeds)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Profit vs purchase</span>
                            <span className={profit >= 0 ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
                              {profit >= 0 ? "+" : ""}{formatKES(profit)}
                            </span>
                          </div>
                        </div>

                        <button onClick={() => setStep("review")}
                          disabled={!effectivePrice || quantity < 1}
                          className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                          Review Listing →
                        </button>
                      </motion.div>
                    )}

                    {step === "review" && (
                      <motion.div key="review" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div className="bg-muted/50 rounded-2xl overflow-hidden">
                          {[
                            { label: "Farm", val: holding.farmName },
                            { label: "Shares to Sell", val: `${quantity} shares` },
                            { label: "Price Per Share", val: formatKES(effectivePrice) },
                            { label: "Total Proceeds", val: formatKES(totalProceeds) },
                            { label: "Market", val: "Secondary Market" },
                          ].map(({ label, val }) => (
                            <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                              <span className="text-muted-foreground text-sm">{label}</span>
                              <span className="text-foreground font-semibold text-sm">{val}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between px-4 py-4 bg-primary/5">
                            <span className="text-foreground font-bold">Your Profit</span>
                            <span className={`font-bold text-lg ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {profit >= 0 ? "+" : ""}{formatKES(profit)}
                            </span>
                          </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                          <p className="text-amber-700 text-xs leading-relaxed">
                            Once listed, your shares will appear in the Secondary Market. You can cancel before a buyer purchases them.
                          </p>
                        </div>

                        {apiError && (
                          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-600 text-xs leading-relaxed">
                            {apiError}
                          </div>
                        )}

                        <button onClick={handleSubmit} disabled={listShares.isPending}
                          className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                          {listShares.isPending && <Loader2 size={16} className="animate-spin" />}
                          {listShares.isPending ? "Listing..." : "Confirm & List Shares →"}
                        </button>
                      </motion.div>
                    )}

                    {step === "done" && (
                      <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
                          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 size={40} className="text-green-500" />
                          </div>
                        </motion.div>
                        <div className="text-center">
                          <p className="text-foreground font-bold text-xl">Shares Listed!</p>
                          <p className="text-muted-foreground text-sm mt-1">{quantity} shares of {holding.farmName} are now on the Secondary Market</p>
                        </div>
                        <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Listing Price</span>
                            <span className="font-bold text-foreground">{formatKES(effectivePrice)} / share</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total if sold</span>
                            <span className="font-bold text-primary">{formatKES(totalProceeds)}</span>
                          </div>
                        </div>
                        <div className="w-full flex gap-2">
                          <button onClick={resetAndClose}
                            className="flex-1 bg-primary text-white font-bold py-3 rounded-xl active:scale-95 transition-all">
                            Done
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp size={12} className="text-primary" />
                          <p className="text-xs text-muted-foreground">View in Secondary Market to track your listing</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
