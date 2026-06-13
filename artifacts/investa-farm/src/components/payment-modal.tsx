import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, CreditCard, CheckCircle2, Loader2, ArrowLeft, Lock } from "lucide-react";
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
  const [pin, setPin] = useState("");

  const formatCard = (val: string) => val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (val: string) => { const d = val.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d; };

  const handleProceed = () => {
    if (method === "mpesa") setStep("mpesa");
    else setStep("card");
  };

  const handlePay = () => {
    setStep("processing");
    setTimeout(() => { setStep("success"); }, 2200);
    setTimeout(() => { onSuccess(method); onClose(); resetState(); }, 4000);
  };

  const resetState = () => {
    setStep("select"); setPhone("07"); setCardNumber(""); setExpiry(""); setCvv(""); setCardName(""); setPin("");
  };

  const handleClose = () => { onClose(); resetState(); };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] bg-white rounded-t-3xl overflow-hidden shadow-2xl"
          >
            {/* Paystack-style header */}
            <div className="bg-[#00B8D9] px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                    <Lock size={13} className="text-white" />
                  </div>
                  <span className="text-white text-xs font-medium">Secured by Paystack</span>
                </div>
                <button onClick={handleClose} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <X size={14} className="text-white" />
                </button>
              </div>
              <p className="text-white/80 text-xs">{description}</p>
              <p className="text-white text-2xl font-bold mt-0.5">{formatKES(amount)}</p>
            </div>

            <div className="px-5 pt-4 pb-8">
              <AnimatePresence mode="wait">
                {/* Step: select method */}
                {step === "select" && (
                  <motion.div key="select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                    <p className="text-foreground font-semibold text-sm">Choose Payment Method</p>
                    {([
                      { id: "mpesa" as const, label: "M-Pesa", sub: "Pay via mobile money", icon: "📱", color: "border-green-300 bg-green-50" },
                      { id: "card" as const, label: "Card", sub: "Visa, Mastercard", icon: "💳", color: "border-blue-200 bg-blue-50" },
                    ]).map(opt => (
                      <button key={opt.id} onClick={() => setMethod(opt.id)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${method === opt.id ? opt.color + " border-opacity-100" : "border-border bg-white"}`}>
                        <span className="text-2xl">{opt.icon}</span>
                        <div className="flex-1">
                          <p className="text-foreground font-semibold text-sm">{opt.label}</p>
                          <p className="text-muted-foreground text-xs">{opt.sub}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${method === opt.id ? "border-primary bg-primary" : "border-border"}`}>
                          {method === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    ))}
                    <button onClick={handleProceed} className="w-full bg-[#00B8D9] text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all mt-2">
                      Continue with {method === "mpesa" ? "M-Pesa" : "Card"}
                    </button>
                  </motion.div>
                )}

                {/* Step: M-Pesa */}
                {step === "mpesa" && (
                  <motion.div key="mpesa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <button onClick={() => setStep("select")} className="text-muted-foreground"><ArrowLeft size={18} /></button>
                      <p className="text-foreground font-semibold text-sm">M-Pesa Payment</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                      <span className="text-3xl">📱</span>
                      <div>
                        <p className="text-green-700 font-semibold text-sm">M-Pesa STK Push</p>
                        <p className="text-green-600 text-xs leading-relaxed">We'll send a payment request to your phone. Enter your M-Pesa PIN to confirm.</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone Number</label>
                      <div className="flex gap-2">
                        <div className="flex items-center px-3 bg-muted border border-border rounded-xl text-sm font-medium text-foreground">+254</div>
                        <input value={phone.replace(/^0/, "")} onChange={e => setPhone("0" + e.target.value.replace(/\D/g,"").slice(0,9))}
                          placeholder="7XXXXXXXX" type="tel" maxLength={9}
                          className="flex-1 border border-border rounded-xl px-3 py-3 text-foreground text-sm focus:outline-none focus:border-primary font-mono" />
                      </div>
                    </div>
                    <div className="bg-muted rounded-xl p-3 flex justify-between text-xs">
                      <span className="text-muted-foreground">You will be charged</span>
                      <span className="text-foreground font-bold">{formatKES(amount)}</span>
                    </div>
                    <button onClick={handlePay} className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                      <Smartphone size={16} /> Send STK Push
                    </button>
                  </motion.div>
                )}

                {/* Step: Card */}
                {step === "card" && (
                  <motion.div key="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <button onClick={() => setStep("select")} className="text-muted-foreground"><ArrowLeft size={18} /></button>
                      <p className="text-foreground font-semibold text-sm">Card Payment</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Card Number</label>
                      <input value={formatCard(cardNumber)} onChange={e => setCardNumber(e.target.value.replace(/\s/g,""))}
                        placeholder="1234 5678 9012 3456" type="text" maxLength={19}
                        className="w-full border border-border rounded-xl px-3 py-3 text-foreground text-sm focus:outline-none focus:border-primary font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name on Card</label>
                      <input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="John Kamau"
                        className="w-full border border-border rounded-xl px-3 py-3 text-foreground text-sm focus:outline-none focus:border-primary" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiry</label>
                        <input value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5}
                          className="w-full border border-border rounded-xl px-3 py-3 text-foreground text-sm focus:outline-none focus:border-primary font-mono" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CVV</label>
                        <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="•••" type="password" maxLength={4}
                          className="w-full border border-border rounded-xl px-3 py-3 text-foreground text-sm focus:outline-none focus:border-primary font-mono" />
                      </div>
                    </div>
                    <button onClick={handlePay} className="w-full bg-[#00B8D9] text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 mt-1">
                      <CreditCard size={16} /> Pay {formatKES(amount)}
                    </button>
                  </motion.div>
                )}

                {/* Step: processing */}
                {step === "processing" && (
                  <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                      <Loader2 size={32} className="text-[#00B8D9] animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-foreground font-bold text-base">Processing Payment</p>
                      <p className="text-muted-foreground text-sm mt-1">
                        {method === "mpesa" ? "Check your phone for the M-Pesa prompt and enter your PIN…" : "Authorizing your card…"}
                      </p>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <motion.div className="h-full bg-[#00B8D9] rounded-full" initial={{ width: "0%" }} animate={{ width: "90%" }} transition={{ duration: 2 }} />
                    </div>
                  </motion.div>
                )}

                {/* Step: success */}
                {step === "success" && (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}
                      className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 size={40} className="text-green-500" />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-foreground font-bold text-lg">Payment Successful!</p>
                      <p className="text-muted-foreground text-sm mt-1">{formatKES(amount)} received via {method === "mpesa" ? "M-Pesa" : "Card"}</p>
                    </div>
                    <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-3 text-center">
                      <p className="text-green-700 text-xs">Transaction complete. Your portfolio has been updated.</p>
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
