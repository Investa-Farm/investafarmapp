import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, Clock, ChevronRight, CheckCircle2, Loader2, Shield, Wallet } from "lucide-react";
import { formatKES, formatChange, getToken, isDemoAccount } from "@/lib/auth";
import { getCropImage } from "@/lib/crops";
import { useBuyShares, getListPrimaryMarketQueryKey, getGetFarmQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { InvestorKycModal } from "./investor-kyc-modal";

interface InvestModalProps {
  open: boolean;
  onClose: () => void;
  listing: {
    id: number; farmId: number; farmName: string; cropType: string;
    location: string; pricePerShare: number; sharesAvailable: number;
    changePercent: number; imageUrl?: string;
  } | null;
}

type ExitType = "wide_season" | "full_season";

const EXIT_OPTIONS = [
  {
    type: "wide_season" as ExitType,
    label: "Mid-Season Exit",
    period: "30–60 days",
    returnMin: 8, returnMax: 12,
    icon: "⚡",
    desc: "Exit at mid-harvest for a quick return. Base revenue 10%.",
    color: "border-orange-300 bg-orange-50",
    badge: "bg-orange-100 text-orange-700",
  },
  {
    type: "full_season" as ExitType,
    label: "Full Season Exit",
    period: "~6 months",
    returnMin: 15, returnMax: 28,
    icon: "🌾",
    desc: "Hold until harvest for full yield appreciation. Up to 28% return.",
    color: "border-green-300 bg-green-50",
    badge: "bg-green-100 text-green-700",
  },
];

export function InvestModal({ open, onClose, listing }: InvestModalProps) {
  const [step, setStep] = useState<"configure" | "review" | "pay" | "done">("configure");
  const [exitType, setExitType] = useState<ExitType>("full_season");
  const [quantity, setQuantity] = useState(10);
  const [kycOpen, setKycOpen] = useState(false);
  const [, setLocation] = useLocation();
  const buyShares = useBuyShares();
  const qc = useQueryClient();
  const token = getToken();

  const { data: kycStatus } = useQuery<{ isVerified: boolean; approved: number; total: number }>({
    queryKey: ["kyc-status"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/kyc/status", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const { data: walletData } = useQuery<{ wallet: { balance: string } }>({
    queryKey: ["wallet-balance"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const resetAndClose = () => {
    onClose();
    setTimeout(() => { setStep("configure"); setQuantity(10); setExitType("full_season"); }, 400);
  };

  useEffect(() => {
    if (step === "done") {
      const t = setTimeout(() => resetAndClose(), 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [step]);

  if (!listing) return null;

  const isDemo = isDemoAccount();
  const isKycVerified = isDemo || (kycStatus?.isVerified ?? false);
  const total = listing.pricePerShare * quantity;
  const selectedExit = EXIT_OPTIONS.find(e => e.type === exitType)!;
  const estimatedReturnMin = total * (selectedExit.returnMin / 100);
  const estimatedReturnMax = total * (selectedExit.returnMax / 100);
  const walletBalance = parseFloat(walletData?.wallet?.balance ?? "0");
  const hasEnoughBalance = walletBalance >= total;

  const handlePayFromWallet = () => {
    buyShares.mutate({ data: { listingId: listing.id, quantity, exitType } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPrimaryMarketQueryKey() });
        qc.invalidateQueries({ queryKey: getGetFarmQueryKey(listing.farmId) });
        qc.invalidateQueries({ queryKey: ["wallet-balance"] });
        qc.invalidateQueries({ queryKey: ["portfolio-summary"] });
        localStorage.setItem("investa_first_investment", "1");
        import("@/components/transaction-notification").then(({ showCompletedTransactionFlow }) => {
          showCompletedTransactionFlow({ type: "investment", amount: total, label: "Investment", subtitle: listing.farmName });
        });
        setStep("done");
      },
    });
  };

  const handleProceedToReview = () => {
    if (!isKycVerified) { setKycOpen(true); return; }
    setStep("review");
  };

  return (
    <>
      <AnimatePresence>
        {open && step !== "pay" && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetAndClose} />

            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl flex flex-col"
              style={{ maxHeight: "92dvh" }}>

              <div className="flex-shrink-0 bg-white border-b border-border px-5 pt-5 pb-3 flex items-center justify-between rounded-t-3xl z-10">
                <div className="flex items-center gap-2">
                  {step === "review" && (
                    <button onClick={() => setStep("configure")} className="text-muted-foreground mr-1">
                      <ChevronRight size={18} className="rotate-180" />
                    </button>
                  )}
                  <div>
                    <p className="text-foreground font-bold text-base">{step === "configure" ? "Buy Shares" : "Review Order"}</p>
                    <p className="text-muted-foreground text-xs">{listing.farmName}</p>
                  </div>
                </div>
                <button onClick={resetAndClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={15} className="text-muted-foreground" />
                </button>
              </div>

              <div className="px-5 pt-4 pb-10 space-y-4 overflow-y-auto flex-1" style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
                {/* KYC gate banner */}
                {!isKycVerified && (
                  <button onClick={() => setKycOpen(true)}
                    className="w-full bg-orange-50 border border-orange-300 rounded-2xl p-3 flex items-center gap-3 text-left active:scale-98 transition-transform">
                    <Shield size={18} className="text-orange-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-orange-700 font-semibold text-xs">KYC Verification Required</p>
                      <p className="text-orange-600 text-[10px]">Tap to verify your identity before buying shares</p>
                    </div>
                    <ChevronRight size={14} className="text-orange-500" />
                  </button>
                )}

                <AnimatePresence mode="wait">
                  {step === "configure" && (
                    <motion.div key="configure" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                      <div className="flex items-center gap-3 bg-muted/50 rounded-2xl p-3">
                        <img src={getCropImage(listing.cropType, listing.imageUrl)} alt={listing.farmName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-foreground font-semibold text-sm">{listing.farmName}</p>
                          <p className="text-muted-foreground text-xs">{listing.cropType} · {listing.location}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <TrendingUp size={10} className="text-green-600" />
                            <span className="text-green-600 text-[10px] font-semibold">{formatChange(listing.changePercent)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-foreground font-bold text-sm">{formatKES(listing.pricePerShare)}</p>
                          <p className="text-muted-foreground text-[10px]">per share</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Number of Shares</p>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setQuantity(q => Math.max(1, q - 5))}
                            className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-foreground text-lg font-bold active:scale-90 transition-transform">−</button>
                          <input type="number" value={quantity} min={1}
                            onChange={e => { const v = Number(e.target.value); setQuantity(v < 1 ? 1 : Math.min(listing.sharesAvailable, v)); }}
                            onFocus={e => e.target.select()}
                            className="flex-1 text-center text-foreground font-bold text-xl border border-border rounded-xl py-2.5 focus:outline-none focus:border-primary" />
                          <button onClick={() => setQuantity(q => Math.min(listing.sharesAvailable, q + 5))}
                            className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-foreground text-lg font-bold active:scale-90 transition-transform">+</button>
                        </div>
                        <p className="text-muted-foreground text-xs text-center">{listing.sharesAvailable.toLocaleString()} available</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exit Strategy</p>
                        {EXIT_OPTIONS.map(opt => (
                          <button key={opt.type} onClick={() => setExitType(opt.type)}
                            className={`w-full p-3.5 rounded-2xl border-2 text-left transition-all ${exitType === opt.type ? opt.color : "border-border bg-white"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{opt.icon}</span>
                                <p className="font-semibold text-sm text-foreground">{opt.label}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${exitType === opt.type ? opt.badge : "bg-muted text-muted-foreground"}`}>
                                {opt.returnMin}–{opt.returnMax}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock size={10} className="text-muted-foreground" />
                              <span className="text-muted-foreground text-xs">{opt.period}</span>
                              <span className="text-muted-foreground text-[10px]">· {opt.desc}</span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Wallet balance indicator */}
                      <div className={`border rounded-2xl p-3 flex items-center gap-3 ${hasEnoughBalance ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${hasEnoughBalance ? "bg-green-100" : "bg-red-100"}`}>
                          <span className="text-base">{hasEnoughBalance ? "💰" : "⚠️"}</span>
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold text-xs ${hasEnoughBalance ? "text-green-700" : "text-red-700"}`}>
                            Wallet Balance: {formatKES(walletBalance)}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${hasEnoughBalance ? "text-green-600" : "text-red-600"}`}>
                            {hasEnoughBalance
                              ? `Sufficient — ${formatKES(walletBalance - total)} remaining after this investment`
                              : `Need ${formatKES(total - walletBalance)} more — top up your wallet first`}
                          </p>
                        </div>
                      </div>

                      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{quantity} shares × {formatKES(listing.pricePerShare)}</span>
                          <span className="text-foreground font-bold">{formatKES(total)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Est. return at exit</span>
                          <span className="text-green-600 font-semibold">+{formatKES(estimatedReturnMin)} – +{formatKES(estimatedReturnMax)}</span>
                        </div>
                      </div>

                      <button onClick={handleProceedToReview}
                        className={`w-full font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${isKycVerified ? "bg-primary text-white" : "bg-orange-500 text-white"}`}>
                        {isKycVerified ? "Review Order →" : <><Shield size={15} /> Verify KYC to Continue</>}
                      </button>
                    </motion.div>
                  )}

                  {step === "review" && (
                    <motion.div key="review" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                      <div className="bg-muted/50 rounded-2xl overflow-hidden">
                        {[
                          { label: "Farm", val: listing.farmName },
                          { label: "Shares", val: `${quantity} shares` },
                          { label: "Price per share", val: formatKES(listing.pricePerShare) },
                          { label: "Exit strategy", val: selectedExit.label },
                          { label: "Expected duration", val: selectedExit.period },
                          { label: "Estimated return", val: `${formatKES(estimatedReturnMin)} – ${formatKES(estimatedReturnMax)}` },
                        ].map(({ label, val }) => (
                          <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                            <span className="text-muted-foreground text-sm">{label}</span>
                            <span className="text-foreground font-semibold text-sm">{val}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between px-4 py-4 bg-primary/5">
                          <span className="text-foreground font-bold">Total to Pay</span>
                          <span className="text-primary font-bold text-lg">{formatKES(total)}</span>
                        </div>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-2xl p-3">
                        <p className="text-green-700 text-xs leading-relaxed">
                          By proceeding, you agree to the investment terms. Your funds will be used to finance this farm's operations and repaid from harvest proceeds.
                        </p>
                      </div>

                      {/* Error from backend */}
                      {buyShares.error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                          <p className="text-red-700 text-xs">{(buyShares.error as any)?.message ?? "Payment failed. Please try again."}</p>
                        </div>
                      )}

                      {hasEnoughBalance ? (
                        <button
                          onClick={handlePayFromWallet}
                          disabled={buyShares.isPending}
                          className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                          {buyShares.isPending ? <Loader2 size={16} className="animate-spin" /> : <span>💰</span>}
                          {buyShares.isPending ? "Processing…" : `Pay from Wallet · ${formatKES(total)}`}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <p className="text-red-700 text-xs font-semibold mb-0.5">Insufficient wallet balance</p>
                            <p className="text-red-600 text-[11px]">
                              Top up {formatKES(total - walletBalance)} to proceed with this investment.
                            </p>
                          </div>
                          <button
                            onClick={() => { resetAndClose(); setLocation("/wallet"); }}
                            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                            <Wallet size={15} /> Go to Wallet & Top Up →
                          </button>
                        </div>
                      )}
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
                        <p className="text-foreground font-bold text-xl">Investment Complete!</p>
                        <p className="text-muted-foreground text-sm mt-1">You now own {quantity} shares of {listing.farmName}</p>
                      </div>
                      <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Amount Invested</span>
                          <span className="font-bold text-foreground">{formatKES(total)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Exit Strategy</span>
                          <span className="font-semibold text-foreground">{selectedExit.label}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Est. Return</span>
                          <span className="font-bold text-green-600">+{formatKES(estimatedReturnMin)} – +{formatKES(estimatedReturnMax)}</span>
                        </div>
                      </div>
                      <button onClick={resetAndClose} className="w-full bg-primary text-white font-bold py-3 rounded-xl active:scale-95 transition-all">
                        View Portfolio
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <InvestorKycModal
        open={kycOpen}
        onClose={() => setKycOpen(false)}
        onVerified={() => { setKycOpen(false); qc.invalidateQueries({ queryKey: ["kyc-status"] }); setStep("review"); }}
      />
    </>
  );
}
