import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, CheckCircle2, Loader2, Sprout } from "lucide-react";
import { formatKES } from "@/lib/auth";
import { useRequestExit } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface ExitModalProps {
  open: boolean;
  onClose: () => void;
  holding: {
    id: number; farmName: string; cropType: string; quantity: number;
    purchasePrice: number; currentPrice: number; totalValue: number;
    exitType: string;
  } | null;
}

export function ExitModal({ open, onClose, holding }: ExitModalProps) {
  const [exitType, setExitType] = useState<"wide_season" | "full_season">("full_season");
  const [step, setStep] = useState<"choose" | "confirm" | "done">("choose");
  const requestExit = useRequestExit();
  const qc = useQueryClient();

  if (!holding) return null;

  const invested = holding.purchasePrice * holding.quantity;
  const midReturnRate = 0.10;
  const fullReturnRate = 0.22;
  const midPayout = invested * (1 + midReturnRate);
  const fullPayout = invested * (1 + fullReturnRate);
  const selectedPayout = exitType === "wide_season" ? midPayout : fullPayout;
  const selectedReturn = exitType === "wide_season" ? midReturnRate * 100 : fullReturnRate * 100;
  const selectedProfit = selectedPayout - invested;

  const EXIT_OPTIONS = [
    {
      type: "wide_season" as const,
      label: "Mid-Season Exit",
      period: "30–60 days",
      returnPct: 10,
      payout: midPayout,
      icon: "⚡",
      badge: "Quick Return",
      color: "border-orange-300 bg-orange-50",
      badgeCls: "bg-orange-100 text-orange-700",
      desc: "Exit at mid-harvest. Base revenue of 10% on your invested capital. Faster, lower risk.",
    },
    {
      type: "full_season" as const,
      label: "Full Season Exit",
      period: "~6 months",
      returnPct: 22,
      payout: fullPayout,
      icon: "🌾",
      badge: "Max Return",
      color: "border-green-300 bg-green-50",
      badgeCls: "bg-green-100 text-green-700",
      desc: "Hold until full harvest for yield appreciation. Up to 22% on your capital.",
    },
  ];

  const selected = EXIT_OPTIONS.find(e => e.type === exitType)!;

  const handleConfirm = () => {
    requestExit.mutate({ data: { holdingId: holding.id, exitType } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["portfolio"] });
        setStep("done");
      },
    });
  };

  const resetAndClose = () => {
    onClose();
    setTimeout(() => { setStep("choose"); setExitType("full_season"); }, 400);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetAndClose} />

          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: "90vh" }}>

            {/* Fixed header */}
            <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-foreground font-bold text-base">Request Exit</p>
                <p className="text-muted-foreground text-xs">{holding.farmName} · {holding.quantity} shares</p>
              </div>
              <button onClick={resetAndClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={15} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-5 pt-4 pb-6">
              <AnimatePresence mode="wait">
                {step === "choose" && (
                  <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                    <div className="bg-muted/50 rounded-2xl p-3 flex justify-between text-sm">
                      <span className="text-muted-foreground">Invested Capital</span>
                      <span className="font-bold">{formatKES(invested)}</span>
                    </div>

                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Choose Exit Type</p>

                    {EXIT_OPTIONS.map(opt => (
                      <button key={opt.type} onClick={() => setExitType(opt.type)}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${exitType === opt.type ? opt.color : "border-border bg-white"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{opt.icon}</span>
                            <div>
                              <p className="font-bold text-sm text-foreground">{opt.label}</p>
                              <div className="flex items-center gap-1">
                                <Clock size={10} className="text-muted-foreground" />
                                <span className="text-muted-foreground text-[10px]">{opt.period}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${opt.badgeCls}`}>{opt.badge}</span>
                            <p className="text-green-600 font-bold text-sm mt-1">+{opt.returnPct}%</p>
                          </div>
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">{opt.desc}</p>
                        <div className="mt-2 bg-white/60 rounded-xl p-2.5 flex justify-between items-center">
                          <span className="text-muted-foreground text-xs">You receive</span>
                          <span className="text-foreground font-bold text-sm">{formatKES(opt.payout)}</span>
                        </div>
                      </button>
                    ))}

                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Invested</span>
                        <span className="font-semibold">{formatKES(invested)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Return ({selectedReturn.toFixed(0)}%)</span>
                        <span className="text-green-600 font-semibold">+{formatKES(selectedProfit)}</span>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between">
                        <span className="text-foreground font-bold">Total Payout</span>
                        <span className="text-primary font-bold text-lg">{formatKES(selectedPayout)}</span>
                      </div>
                    </div>

                    <button onClick={() => setStep("confirm")}
                      className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all">
                      Request {selected.label} →
                    </button>
                  </motion.div>
                )}

                {step === "confirm" && (
                  <motion.div key="confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="text-center py-4">
                      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                        <Sprout size={28} className="text-primary" />
                      </div>
                      <p className="text-foreground font-bold text-base">Confirm Exit Request</p>
                      <p className="text-muted-foreground text-sm mt-1">
                        You're requesting a <strong>{selected.label}</strong> from {holding.farmName}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-2xl overflow-hidden">
                      {[
                        { label: "Farm", val: holding.farmName },
                        { label: "Shares", val: `${holding.quantity}` },
                        { label: "Exit Type", val: selected.label },
                        { label: "Duration", val: selected.period },
                        { label: "Expected Payout", val: formatKES(selectedPayout) },
                        { label: "Estimated Profit", val: `+${formatKES(selectedProfit)} (+${selectedReturn.toFixed(0)}%)` },
                      ].map(({ label, val }) => (
                        <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                          <span className="text-muted-foreground text-sm">{label}</span>
                          <span className={`font-semibold text-sm ${label === "Estimated Profit" ? "text-green-600" : "text-foreground"}`}>{val}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                      <p className="text-blue-700 text-xs leading-relaxed">
                        Your exit request will be processed by the farm operator. Payout will be sent to your registered M-Pesa number or bank account within the specified period.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setStep("choose")}
                        className="py-3.5 rounded-xl border border-border text-foreground text-sm font-semibold active:scale-95 transition-transform">
                        Back
                      </button>
                      <button onClick={handleConfirm} disabled={requestExit.isPending}
                        className="py-3.5 rounded-xl bg-primary text-white text-sm font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5">
                        {requestExit.isPending && <Loader2 size={14} className="animate-spin" />}
                        {requestExit.isPending ? "Requesting..." : "Confirm"}
                      </button>
                    </div>
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
                      <p className="text-foreground font-bold text-xl">Exit Requested!</p>
                      <p className="text-muted-foreground text-sm mt-1">Your {selected.label} has been submitted</p>
                    </div>
                    <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expected Payout</span>
                        <span className="font-bold text-primary">{formatKES(selectedPayout)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Timeline</span>
                        <span className="font-semibold">{selected.period}</span>
                      </div>
                    </div>
                    <button onClick={resetAndClose}
                      className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all">
                      Done
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
