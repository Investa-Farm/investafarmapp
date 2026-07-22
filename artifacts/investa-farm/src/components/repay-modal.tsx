import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Loader2, DollarSign } from "lucide-react";
import { formatKES } from "@/lib/auth";
import { PaymentSheet } from "./payment-sheet";
import { getToken } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

interface RepayModalProps {
  open: boolean;
  onClose: () => void;
  loan: {
    id: number; amount: number; purpose: string; repaymentPeriodMonths: number; status: string;
  } | null;
}

const REPAY_OPTIONS = [
  { label: "Full Repayment", multiplier: 1.08, desc: "Pay entire principal + 8% interest", badge: "Clears Loan", cls: "border-green-300 bg-green-50", badgeCls: "bg-green-100 text-green-700" },
  { label: "Mid-Season Payment", multiplier: 0.5, desc: "Pay 50% now, rest at full harvest", badge: "Partial", cls: "border-amber-300 bg-amber-50", badgeCls: "bg-amber-100 text-amber-700" },
  { label: "Custom Amount", multiplier: -1, desc: "Enter an amount to repay", badge: "Flexible", cls: "border-blue-200 bg-blue-50", badgeCls: "bg-blue-100 text-blue-700" },
];

export function RepayModal({ open, onClose, loan }: RepayModalProps) {
  const [step, setStep] = useState<"choose" | "pay" | "processing" | "done">("choose");
  const [option, setOption] = useState(0);
  const [customAmount, setCustomAmount] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  if (!loan) return null;

  const principal = loan.amount;
  const interest = principal * 0.08;
  const totalOwed = principal + interest;
  const selectedOption = REPAY_OPTIONS[option];
  const payAmount = selectedOption.multiplier === -1
    ? (parseFloat(customAmount) || 0)
    : totalOwed * selectedOption.multiplier;

  const handlePaySuccess = async (topUpAmount: number) => {
    setPayOpen(false);
    setStep("processing");
    setError(null);
    try {
      const r = await fetch(`/api/loans/repay/${loan.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ amount: payAmount }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Repayment failed");
      qc.invalidateQueries({ queryKey: ["loan-apps"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet-balance"] });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Repayment failed");
      setStep("choose");
    }
  };

  const resetAndClose = () => {
    onClose();
    setTimeout(() => { setStep("choose"); setOption(0); setCustomAmount(""); setError(null); }, 400);
  };

  return (
    <>
      <AnimatePresence>
        {open && step !== "pay" && (
          <div className="fixed inset-0 z-40 flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetAndClose} />

            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl">

              <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-foreground font-bold text-base">Repay Loan</p>
                  <p className="text-muted-foreground text-xs capitalize">{loan.purpose.replace("_", " ")} · {loan.repaymentPeriodMonths} month plan</p>
                </div>
                <button onClick={resetAndClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X size={15} /></button>
              </div>

              <div className="px-5 pt-4 pb-8 space-y-4">
                <AnimatePresence mode="wait">
                  {step === "choose" && (
                    <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Principal", val: formatKES(principal) },
                          { label: "Interest (8%)", val: formatKES(interest) },
                          { label: "Total Owed", val: formatKES(totalOwed) },
                        ].map(({ label, val }) => (
                          <div key={label} className="bg-muted/60 rounded-xl p-2.5 text-center">
                            <p className="text-muted-foreground text-[9px] uppercase tracking-wider">{label}</p>
                            <p className="text-foreground font-bold text-xs mt-0.5">{val}</p>
                          </div>
                        ))}
                      </div>

                      {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                          <p className="text-red-700 text-xs">{error}</p>
                        </div>
                      )}

                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Repayment Option</p>
                      {REPAY_OPTIONS.map((opt, i) => (
                        <button key={i} onClick={() => setOption(i)}
                          className={`w-full p-3.5 rounded-2xl border-2 text-left transition-all ${option === i ? opt.cls : "border-border bg-white"}`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="font-semibold text-sm text-foreground">{opt.label}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${option === i ? opt.badgeCls : "bg-muted text-muted-foreground"}`}>{opt.badge}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{opt.desc}</p>
                          {i !== 2 && <p className="text-foreground font-bold text-sm mt-1.5">{formatKES(totalOwed * opt.multiplier)}</p>}
                        </button>
                      ))}

                      {option === 2 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Amount (KES)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
                            <input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)} placeholder="0"
                              className="w-full border border-border rounded-xl px-4 py-3 pl-12 text-foreground font-bold text-sm focus:outline-none focus:border-primary" />
                          </div>
                        </div>
                      )}

                      <button disabled={!payAmount} onClick={() => setPayOpen(true)}
                        className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        <DollarSign size={16} /> Pay {payAmount ? formatKES(payAmount) : "…"}
                      </button>
                    </motion.div>
                  )}

                  {step === "processing" && (
                    <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Loader2 size={32} className="text-primary animate-spin" />
                      </div>
                      <p className="text-foreground font-bold text-base">Recording Repayment…</p>
                      <p className="text-muted-foreground text-sm text-center">Please wait while we update your loan status</p>
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
                        <p className="text-foreground font-bold text-xl">Payment Sent!</p>
                        <p className="text-muted-foreground text-sm mt-1">Repayment of {formatKES(payAmount)} submitted</p>
                      </div>
                      <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-4">
                        <p className="text-green-700 text-xs leading-relaxed">Your repayment has been recorded. Thank you for keeping your account in good standing!</p>
                      </div>
                      <button onClick={resetAndClose} className="w-full bg-primary text-white font-bold py-3 rounded-xl active:scale-95 transition-all">Done</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PaymentSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onSuccess={handlePaySuccess}
      />
    </>
  );
}
