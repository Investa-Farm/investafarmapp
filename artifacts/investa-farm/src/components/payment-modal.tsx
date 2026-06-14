import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, CreditCard, CheckCircle2, Loader2, ArrowLeft, Lock, Shield } from "lucide-react";
import { formatKES } from "@/lib/auth";

type PayMethod = "mpesa" | "card";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (method: PayMethod) => void;
  amount: number;
  description: string;
  ctaLabel?: string;
}

export function PaymentModal({ open, onClose, onSuccess, amount, description, ctaLabel = "Pay" }: PaymentModalProps) {
  const [method, setMethod] = useState<PayMethod>("mpesa");
  const [step, setStep] = useState<"select" | "mpesa" | "card" | "processing" | "success">("select");
  const [phone, setPhone] = useState("07");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");

  const formatCard = (val: string) => val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (val: string) => { const d = val.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d; };

  const handleProceed = () => {
    if (method === "mpesa") setStep("mpesa");
    else setStep("card");
  };

  const handlePay = () => {
    setStep("processing");
    setTimeout(() => setStep("success"), 2200);
    setTimeout(() => { onSuccess(method); onClose(); resetState(); }, 4000);
  };

  const resetState = () => {
    setStep("select"); setPhone("07"); setCardNumber(""); setExpiry(""); setCvv(""); setCardName("");
  };

  const handleClose = () => { onClose(); resetState(); };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="relative w-full max-w-[430px] bg-white rounded-t-3xl overflow-hidden shadow-2xl"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Investa-green header */}
            <div className="bg-[#16a34a] px-5 pt-4 pb-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Lock size={14} className="text-white" />
                  </div>
                  <div>
                    <span className="text-white text-xs font-semibold">Secure Payment</span>
                    <p className="text-white/60 text-[9px]">256-bit encrypted · Powered by Paystack</p>
                  </div>
                </div>
                <button onClick={handleClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
                  <X size={15} className="text-white" />
                </button>
              </div>
              <div className="bg-white/15 rounded-2xl px-4 py-3">
                <p className="text-white/70 text-xs mb-0.5">{description}</p>
                <p className="text-white text-3xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{formatKES(amount)}</p>
              </div>
            </div>

            <div className="px-5 pt-5 pb-8">
              <AnimatePresence mode="wait">

                {/* Step: select method */}
                {step === "select" && (
                  <motion.div key="select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                    <p className="text-foreground font-semibold text-sm">Choose Payment Method</p>
                    {([
                      { id: "mpesa" as const, label: "M-Pesa", sub: "Pay via mobile money", icon: "📱", selectedBorder: "border-[#16a34a]", selectedBg: "bg-[#16a34a]/5" },
                      { id: "card" as const,  label: "Card",   sub: "Visa · Mastercard",  icon: "💳", selectedBorder: "border-blue-400",   selectedBg: "bg-blue-50"      },
                    ]).map(opt => (
                      <button key={opt.id} onClick={() => setMethod(opt.id)}
                        className={`w-full flex items-center gap-3.5 p-4 rounded-2xl border-2 transition-all text-left ${method === opt.id ? `${opt.selectedBorder} ${opt.selectedBg}` : "border-border bg-white"}`}>
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${method === opt.id ? "bg-white shadow-sm" : "bg-muted"}`}>
                          {opt.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-foreground font-semibold text-sm">{opt.label}</p>
                          <p className="text-muted-foreground text-xs">{opt.sub}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${method === opt.id ? "border-[#16a34a] bg-[#16a34a]" : "border-border"}`}>
                          {method === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    ))}

                    <button onClick={handleProceed}
                      className="w-full bg-[#16a34a] text-white font-bold py-4 rounded-2xl active:scale-95 transition-all mt-2 flex items-center justify-center gap-2 shadow-lg shadow-[#16a34a]/25">
                      {method === "mpesa" ? <Smartphone size={16} /> : <CreditCard size={16} />}
                      Continue with {method === "mpesa" ? "M-Pesa" : "Card"}
                    </button>

                    <div className="flex items-center justify-center gap-1.5 pt-1">
                      <Shield size={11} className="text-muted-foreground" />
                      <p className="text-muted-foreground text-[10px]">Your payment is encrypted and secure</p>
                    </div>
                  </motion.div>
                )}

                {/* Step: M-Pesa */}
                {step === "mpesa" && (
                  <motion.div key="mpesa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <button onClick={() => setStep("select")} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <ArrowLeft size={16} className="text-foreground" />
                      </button>
                      <p className="text-foreground font-semibold text-sm">M-Pesa Payment</p>
                    </div>

                    <div className="bg-[#16a34a]/5 border border-[#16a34a]/20 rounded-2xl p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#16a34a]/10 flex items-center justify-center flex-shrink-0 text-xl">📱</div>
                      <div>
                        <p className="text-[#16a34a] font-semibold text-sm">STK Push to Your Phone</p>
                        <p className="text-[#16a34a]/70 text-xs leading-relaxed mt-0.5">We'll send a payment prompt to your phone. Enter your M-Pesa PIN to confirm — everything stays in the app.</p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone Number</label>
                      <div className="flex gap-2">
                        <div className="flex items-center px-3.5 bg-muted border border-border rounded-xl text-sm font-semibold text-foreground">+254</div>
                        <input
                          value={phone.replace(/^0/, "")}
                          onChange={e => setPhone("0" + e.target.value.replace(/\D/g, "").slice(0, 9))}
                          placeholder="7XXXXXXXX" type="tel" maxLength={9}
                          className="flex-1 border border-border rounded-xl px-3.5 py-3.5 text-foreground text-sm focus:outline-none focus:border-[#16a34a] font-mono text-lg tracking-wider"
                        />
                      </div>
                    </div>

                    <div className="bg-muted rounded-xl p-3.5 flex justify-between">
                      <span className="text-muted-foreground text-sm">You will be charged</span>
                      <span className="text-foreground font-bold">{formatKES(amount)}</span>
                    </div>

                    <button onClick={handlePay}
                      className="w-full bg-[#16a34a] text-white font-bold py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#16a34a]/25">
                      <Smartphone size={16} /> Send STK Push · {formatKES(amount)}
                    </button>
                  </motion.div>
                )}

                {/* Step: Card */}
                {step === "card" && (
                  <motion.div key="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <button onClick={() => setStep("select")} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <ArrowLeft size={16} className="text-foreground" />
                      </button>
                      <p className="text-foreground font-semibold text-sm">Card Payment</p>
                      <div className="ml-auto flex gap-1">
                        {["💳", "🏦"].map((i, idx) => <span key={idx} className="text-base">{i}</span>)}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Card Number</label>
                      <input value={formatCard(cardNumber)} onChange={e => setCardNumber(e.target.value.replace(/\s/g, ""))}
                        placeholder="1234 5678 9012 3456" type="text" maxLength={19}
                        className="w-full border border-border rounded-xl px-4 py-3.5 text-foreground text-sm focus:outline-none focus:border-[#16a34a] font-mono tracking-wider" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name on Card</label>
                      <input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="John Kamau"
                        className="w-full border border-border rounded-xl px-4 py-3.5 text-foreground text-sm focus:outline-none focus:border-[#16a34a]" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiry</label>
                        <input value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5}
                          className="w-full border border-border rounded-xl px-4 py-3.5 text-foreground text-sm focus:outline-none focus:border-[#16a34a] font-mono" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CVV</label>
                        <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="•••" type="password" maxLength={4}
                          className="w-full border border-border rounded-xl px-4 py-3.5 text-foreground text-sm focus:outline-none focus:border-[#16a34a] font-mono" />
                      </div>
                    </div>
                    <button onClick={handlePay}
                      className="w-full bg-[#16a34a] text-white font-bold py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#16a34a]/25 mt-1">
                      <CreditCard size={16} /> Pay {formatKES(amount)}
                    </button>
                  </motion.div>
                )}

                {/* Step: processing */}
                {step === "processing" && (
                  <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 flex flex-col items-center gap-5">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                        <Loader2 size={36} className="text-[#16a34a] animate-spin" />
                      </div>
                      <div className="absolute inset-0 rounded-full border-4 border-[#16a34a]/20 animate-ping" />
                    </div>
                    <div className="text-center">
                      <p className="text-foreground font-bold text-base">Processing Payment…</p>
                      <p className="text-muted-foreground text-sm mt-1">
                        {method === "mpesa" ? "Check your phone for the M-Pesa prompt and enter your PIN" : "Authorizing your card securely"}
                      </p>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <motion.div className="h-full bg-[#16a34a] rounded-full" initial={{ width: "0%" }} animate={{ width: "90%" }} transition={{ duration: 2 }} />
                    </div>
                    <p className="text-muted-foreground text-xs text-center">Please don't close this screen</p>
                  </motion.div>
                )}

                {/* Step: success */}
                {step === "success" && (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
                      <div className="w-24 h-24 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                        <CheckCircle2 size={48} className="text-[#16a34a]" />
                      </div>
                    </motion.div>
                    <div className="text-center">
                      <p className="text-foreground font-bold text-xl">Payment Successful!</p>
                      <p className="text-muted-foreground text-sm mt-1">{formatKES(amount)} via {method === "mpesa" ? "M-Pesa" : "Card"}</p>
                    </div>
                    <div className="w-full bg-[#16a34a]/5 border border-[#16a34a]/20 rounded-2xl p-4 text-center">
                      <p className="text-[#16a34a] text-sm font-semibold">🎉 Transaction complete</p>
                      <p className="text-[#16a34a]/70 text-xs mt-1">Your portfolio has been updated.</p>
                    </div>
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
