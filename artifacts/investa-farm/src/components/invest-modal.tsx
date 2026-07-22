import { useState, useEffect } from "react";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, Clock, ChevronRight, CheckCircle2, Loader2, Shield, Wallet, Sparkles, ShoppingCart, Lock } from "lucide-react";
import { formatKES, formatChange, getToken, isDemoAccount } from "@/lib/auth";
import { WalletPinGate } from "./wallet-pin-gate";
import { WalletPinSetup } from "./wallet-pin-setup";
import { getCropImage } from "@/lib/crops";
import { getListPrimaryMarketQueryKey, getGetFarmQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { nonceHeaders } from "@/lib/nonce";
import { InvestorKycModal } from "./investor-kyc-modal";
import { haptic } from "@/lib/haptic";

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

interface RecommendedListing {
  id: number;
  farmId: number;
  farmName: string;
  cropType: string;
  location: string;
  pricePerShare: number;
  sharesAvailable: number;
  changePercent: number;
  suggestedShares: number;
  reason: string;
}

const RECOMMENDATION_REASONS = [
  "Strong yield forecast this season",
  "High demand crop with rising prices",
  "Complements your current portfolio",
  "Low risk with stable returns",
  "Top performer this month",
  "Diversifies your crop exposure",
];

export function InvestModal({ open, onClose, listing }: InvestModalProps) {
  useScrollLock(open);
  const [step, setStep] = useState<"configure" | "review" | "pay" | "done">("configure");
  const [exitType, setExitType] = useState<ExitType>("full_season");
  const [quantity, setQuantity] = useState(10);
  const [kycOpen, setKycOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedListing[]>([]);
  const [, setLocation] = useLocation();
  // PIN gate for wallet payments
  const [pinGateOpen, setPinGateOpen] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const buyShares = useMutation({
    mutationFn: async (payload: { listingId: number; quantity: number; exitType: string }) => {
      const r = await fetch("/api/market/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...nonceHeaders() },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Purchase failed"); }
      return r.json();
    },
  });
  const qc = useQueryClient();
  const token = getToken();

  // Fetch PIN status once when the review step is reached
  useEffect(() => {
    if (step === "review" && hasPin === null && token) {
      fetch("/api/wallet/pin/status", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setHasPin(d.hasPin as boolean); })
        .catch(() => {});
    }
  }, [step, token, hasPin]);

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

  const { data: allListings } = useQuery<any[]>({
    queryKey: ["primary-listings-recs"],
    enabled: step === "done",
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch("/api/market/primary", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.listings ?? []);
    },
  });

  useEffect(() => {
    if (step === "done" && allListings && listing) {
      const walletBal = parseFloat(walletData?.wallet?.balance ?? "0");
      const recs = allListings
        .filter((l: any) => l.id !== listing.id && l.sharesAvailable > 0)
        .slice(0, 6)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((l: any, i: number) => {
          const budgetForThis = Math.max(500, walletBal * 0.15);
          const suggestedShares = Math.max(1, Math.min(l.sharesAvailable, Math.floor(budgetForThis / l.pricePerShare)));
          return {
            ...l,
            suggestedShares,
            reason: RECOMMENDATION_REASONS[i % RECOMMENDATION_REASONS.length]!,
          } as RecommendedListing;
        });
      setRecommendations(recs);
    }
  }, [step, allListings, listing?.id]);


  useEffect(() => {
    if (step === "done") {
      import("@/components/confetti-overlay").then(({ showConfetti }) => showConfetti(3500));
      import("@/components/center-success-modal").then(({ showCenterSuccess }) => {
        showCenterSuccess({
          title: "Investment Placed! 🌱",
          subtitle: `${quantity} shares in ${listing?.farmName}`,
        });
      });
      // No auto-close — user browses recommendations and closes when ready.
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Demo accounts bypass the PIN gate entirely
    if (isDemo) { executePay(); return; }
    // Gate with PIN before sending the mutation
    if (hasPin === false) { setPinSetupOpen(true); return; }
    if (hasPin === true) { setPinGateOpen(true); return; }
    // hasPin still loading — optimistically proceed
    executePay();
  };

  const executePay = () => {
    haptic("medium");
    buyShares.mutate({ listingId: listing.id, quantity, exitType }, {
      onSuccess: () => {
        haptic("success");
        qc.invalidateQueries({ queryKey: getListPrimaryMarketQueryKey() });
        qc.invalidateQueries({ queryKey: getGetFarmQueryKey(listing.farmId) });
        qc.invalidateQueries({ queryKey: ["wallet-balance"] });
        qc.invalidateQueries({ queryKey: ["portfolio-summary"] });
        localStorage.setItem("investa_first_investment", "1");
        setStep("done");
      },
      onError: () => { haptic("error"); },
    });
  };

  const resetAndClose = () => {
    onClose();
    setTimeout(() => { setStep("configure"); setQuantity(10); setExitType("full_season"); setRecommendations([]); setHasPin(null); }, 400);
  };

  const handleProceedToReview = () => {
    haptic("light");
    if (!isKycVerified) { setKycOpen(true); return; }
    setStep("review");
  };

  return (
    <>
      <AnimatePresence>
        {open && step !== "pay" && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={step === "done" ? undefined : resetAndClose} />

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
                    <p className="text-foreground font-bold text-base">
                      {step === "configure" ? "Buy Shares" : step === "review" ? "Review Order" : step === "done" ? "Investment Complete!" : ""}
                    </p>
                    <p className="text-muted-foreground text-xs">{listing.farmName}</p>
                  </div>
                </div>
                <button onClick={resetAndClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={15} className="text-muted-foreground" />
                </button>
              </div>

              <div className="px-5 pt-4 pb-10 space-y-4 overflow-y-auto flex-1" style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
                {/* KYC gate banner */}
                {step === "configure" && !isKycVerified && (
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
                          {buyShares.isPending ? <Loader2 size={16} className="animate-spin" /> : <Lock size={14} />}
                          {buyShares.isPending ? "Processing…" : `Authorise & Pay · ${formatKES(total)}`}
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
                            onClick={() => {
                              if (listing) {
                                try {
                                  sessionStorage.setItem("investa_pending_invest", JSON.stringify({
                                    listingId: listing.id,
                                    farmName: listing.farmName,
                                    cropType: listing.cropType,
                                    quantity,
                                    exitType: selectedExit?.type ?? "wide_season",
                                    ts: Date.now(),
                                  }));
                                } catch { /* ignore */ }
                              }
                              resetAndClose();
                              setLocation("/wallet");
                            }}
                            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                            <Wallet size={15} /> Go to Wallet & Top Up →
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {step === "done" && (
                    <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                      {/* Success header */}
                      <div className="py-4 flex flex-col items-center gap-3">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
                          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 size={40} className="text-green-500" />
                          </div>
                        </motion.div>
                        <div className="text-center">
                          <p className="text-foreground font-bold text-xl">You're invested! 🌱</p>
                          <p className="text-muted-foreground text-sm mt-1">You now own {quantity} shares of {listing.farmName}</p>
                        </div>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Amount Invested</span>
                          <span className="font-bold text-foreground">{formatKES(total)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Shares Owned</span>
                          <span className="font-semibold text-foreground">{quantity} shares</span>
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

                      {/* AI Shopping List Recommendations */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center flex-shrink-0">
                            <ShoppingCart size={12} className="text-white" />
                          </div>
                          <p className="text-foreground font-bold text-sm">AI Recommends Next</p>
                          <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full">
                            <Sparkles size={9} className="text-primary" />
                            <span className="text-primary text-[9px] font-bold">Smart Picks</span>
                          </div>
                        </div>

                        {recommendations.length === 0 ? (
                          <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                            <Loader2 size={14} className="animate-spin" />
                            <span className="text-xs">Finding top picks for you…</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {recommendations.map((rec, i) => (
                              <motion.button
                                key={rec.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + i * 0.1 }}
                                onClick={() => { resetAndClose(); setLocation(`/market/${rec.farmId}`); }}
                                className="w-full flex items-center gap-3 bg-muted/40 hover:bg-muted/70 border border-border rounded-2xl p-3 text-left active:scale-[0.98] transition-all"
                              >
                                <img
                                  src={getCropImage(rec.cropType)}
                                  alt={rec.cropType}
                                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-foreground font-semibold text-xs leading-tight truncate">{rec.farmName}</p>
                                  <p className="text-muted-foreground text-[10px]">{rec.cropType}</p>
                                  <p className="text-green-700 text-[10px] italic mt-0.5 leading-tight truncate">"{rec.reason}"</p>
                                </div>
                                <div className="text-right flex-shrink-0 space-y-1">
                                  <div className="bg-primary text-white text-[9px] font-bold px-2 py-1 rounded-lg">
                                    {rec.suggestedShares} shares
                                  </div>
                                  <p className="text-muted-foreground text-[9px]">{formatKES(rec.pricePerShare)}/sh</p>
                                  <div className="flex items-center gap-0.5 justify-end">
                                    <TrendingUp size={9} className="text-green-500" />
                                    <span className="text-green-600 text-[9px] font-bold">{rec.changePercent >= 0 ? "+" : ""}{rec.changePercent?.toFixed(1)}%</span>
                                  </div>
                                </div>
                              </motion.button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => { resetAndClose(); setLocation("/portfolio"); }}
                          className="flex-1 bg-primary text-white font-bold py-3 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5">
                          View Portfolio <ChevronRight size={14} />
                        </button>
                        <button onClick={resetAndClose}
                          className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 active:scale-95 transition-all">
                          <X size={16} className="text-muted-foreground" />
                        </button>
                      </div>
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

      {/* PIN gate — verifies existing PIN before authorising the payment */}
      <WalletPinGate
        open={pinGateOpen}
        onClose={() => setPinGateOpen(false)}
        onSuccess={() => { setPinGateOpen(false); executePay(); }}
        onForgotPin={() => { setPinGateOpen(false); setPinSetupOpen(true); }}
        title="Authorise Payment"
      />

      {/* PIN setup — shown to users who haven't created a PIN yet */}
      <WalletPinSetup
        open={pinSetupOpen}
        onClose={() => setPinSetupOpen(false)}
        onSuccess={() => {
          setPinSetupOpen(false);
          setHasPin(true);
          // Re-open the gate immediately so they can confirm and pay
          setPinGateOpen(true);
        }}
        isFirstTime={hasPin === false}
      />
    </>
  );
}
