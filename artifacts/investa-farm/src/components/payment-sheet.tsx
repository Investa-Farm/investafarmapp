/**
 * PaymentSheet — in-app payment bottom-sheet for Investa Farm
 *
 * Tabs:
 *   Card  — Stripe Payment Element → in-page card form → confirm
 *   USDC  — Circle USDC on-chain deposit address + manual confirm
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CreditCard, Coins, Loader2, CheckCircle2,
  Copy, Check, ExternalLink, AlertCircle, ChevronRight, Wallet, Smartphone,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken, getStoredUser, formatKES } from "@/lib/auth";
import { WalletConnectModal } from "@/components/wallet-connect-modal";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000, 25000];

type Tab = "mpesa" | "card" | "usdc";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

const MPESA_CODES = [
  { code: "+254", flag: "🇰🇪", name: "Kenya (Safaricom)" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+250", flag: "🇷🇼", name: "Rwanda" },
];

export function PaymentSheet({ open, onClose, onSuccess }: Props) {
  const token = getToken();
  const user = getStoredUser();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("mpesa");
  const [amount, setAmount] = useState("");

  // M-Pesa state
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaCode, setMpesaCode] = useState("+254");
  const [mpesaStep, setMpesaStep] = useState<"idle" | "sending" | "polling" | "done">("idle");
  const [mpesaRef, setMpesaRef] = useState<string | null>(null);
  const [mpesaError, setMpesaError] = useState<string | null>(null);
  const [mpesaConfigured, setMpesaConfigured] = useState(true);
  const [mpesaProvider, setMpesaProvider] = useState<"stripe" | "paystack">("stripe");
  const mpesaPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stripe card state
  const [stripeStep, setStripeStep] = useState<"idle" | "loading" | "form" | "confirming">("idle");
  const [stripeIntentId, setStripeIntentId] = useState<string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const stripeInstanceRef = useRef<any>(null);
  const stripeElementsRef = useRef<any>(null);
  const stripeContainerRef = useRef<HTMLDivElement | null>(null);

  // Circle USDC state
  const [circleInfo, setCircleInfo] = useState<{
    depositAddress: string; chain: string; memo: string; kesRate: number; minUSDC: string; configured: boolean;
  } | null>(null);
  const [circleIntentId, setCircleIntentId] = useState<string | null>(null);
  const [circleAmountUSDC, setCircleAmountUSDC] = useState<string>("");
  const [usdcCopied, setUsdcCopied] = useState(false);
  const [circleConfirming, setCircleConfirming] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Success state
  const [success, setSuccess] = useState(false);

  // Load Circle info when USDC tab is opened
  useEffect(() => {
    if (tab === "usdc" && !circleInfo && token) {
      fetch("/api/wallet/circle/info", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setCircleInfo(d))
        .catch(() => {});
    }
  }, [tab, circleInfo, token]);

  // Reset when sheet closes
  useEffect(() => {
    if (!open) resetAll();
  }, [open]);

  function resetAll() {
    setAmount("");
    // M-Pesa
    setMpesaPhone(""); setMpesaStep("idle"); setMpesaRef(null); setMpesaError(null); setMpesaProvider("stripe");
    if (mpesaPollRef.current) { clearInterval(mpesaPollRef.current); mpesaPollRef.current = null; }
    // Stripe
    setStripeStep("idle"); setStripeIntentId(null); setStripeClientSecret(null); setCardError(null);
    stripeInstanceRef.current = null; stripeElementsRef.current = null;
    // Circle
    setCircleIntentId(null); setCircleAmountUSDC(""); setSuccess(false); setWalletModalOpen(false);
  }

  // ─── M-PESA (via Stripe) ────────────────────────────────────────────────────
  async function handleMpesaSend() {
    const amt = parseFloat(amount);
    if (!amt || amt < 100 || !mpesaPhone.trim()) return;

    const digits = mpesaPhone.replace(/\D/g, "");
    const local = digits.startsWith("0") ? digits.slice(1) : digits;
    if (mpesaCode === "+254" && (local.length < 9 || local.length > 9)) {
      setMpesaError("Enter a valid Safaricom number — 9 digits after the country code (e.g. 712 345 678).");
      return;
    }

    const fullPhone = mpesaCode + local;
    setMpesaStep("sending");
    setMpesaError(null);

    try {
      // Use Stripe M-Pesa endpoint (falls back to demo mode if Stripe not configured)
      const r = await fetch("/api/wallet/stripe/mpesa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, phone: fullPhone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to initiate M-Pesa payment");

      setMpesaRef(d.intentId);
      setMpesaConfigured(d.configured !== false);
      setMpesaProvider("stripe");

      // If Stripe is live-configured, trigger STK push via Stripe.js confirmMpesaPayment
      if (d.configured && d.clientSecret && d.publicKey) {
        try {
          const stripe = await loadStripeJs(d.publicKey);
          // confirmMpesaPayment sends the STK push; errors surface as stripe error
          const { error } = await (stripe as any).confirmMpesaPayment(d.clientSecret, {
            payment_method: { billing_details: { phone: fullPhone } },
          });
          if (error) {
            setMpesaError(error.message ?? "M-Pesa confirmation failed");
            setMpesaStep("idle"); return;
          }
        } catch {
          // Stripe.js M-Pesa not available — poll and let webhook handle it
        }
      }

      setMpesaStep("polling");

      // Demo mode: credit immediately after a short delay
      if (d.configured === false) {
        setTimeout(() => { handleSuccess(amt); }, 2500);
        return;
      }

      // Poll Stripe status every 4 seconds for up to 2 minutes
      let polls = 0;
      mpesaPollRef.current = setInterval(async () => {
        polls++;
        if (polls > 30) {
          clearInterval(mpesaPollRef.current!); mpesaPollRef.current = null;
          setMpesaError("Payment timed out. Please check your M-Pesa and try again.");
          setMpesaStep("idle"); return;
        }
        try {
          const sr = await fetch(`/api/wallet/stripe/mpesa/status/${d.intentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const sd = await sr.json();
          if (sd.paid) {
            clearInterval(mpesaPollRef.current!); mpesaPollRef.current = null;
            handleSuccess(amt);
          } else if (sd.status === "canceled" || sd.status === "payment_failed") {
            clearInterval(mpesaPollRef.current!); mpesaPollRef.current = null;
            setMpesaError("Payment was cancelled or failed. Please try again.");
            setMpesaStep("idle");
          }
        } catch { /* keep polling */ }
      }, 4000);
    } catch (err) {
      setMpesaError((err as Error).message);
      setMpesaStep("idle");
    }
  }

  function handleSuccess(amt: number) {
    qc.invalidateQueries({ queryKey: ["wallet"] });
    setSuccess(true);
    onSuccess(amt);
    import("@/components/transaction-notification").then(({ showCompletedTransactionFlow }) => {
      showCompletedTransactionFlow({ type: "deposit", amount: amt });
    });
    import("@/components/confetti-overlay").then(({ showConfetti }) => showConfetti(3200));
    import("@/components/success-toast").then(({ showSuccessToast }) => {
      showSuccessToast("Wallet funded! 💰", `KES ${amt.toLocaleString("en-KE")} credited to your account`);
    });
    setTimeout(() => { setSuccess(false); onClose(); }, 2200);
  }

  // ─── STRIPE CARD ────────────────────────────────────────────────────────────
  async function loadStripeJs(publicKey: string): Promise<any> {
    if ((window as any).Stripe) return (window as any).Stripe(publicKey);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://js.stripe.com/v3/"]');
      if (existing) {
        existing.addEventListener("load", () => resolve((window as any).Stripe(publicKey)));
        return;
      }
      const s = document.createElement("script");
      s.src = "https://js.stripe.com/v3/";
      s.onload = () => resolve((window as any).Stripe(publicKey));
      s.onerror = () => reject(new Error("Failed to load Stripe.js"));
      document.head.appendChild(s);
    });
  }

  async function handleStripeInit() {
    const amt = parseFloat(amount);
    if (!amt || amt < 100) return;
    setStripeStep("loading");
    setCardError(null);
    try {
      const r = await fetch("/api/wallet/stripe/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to create payment");

      setStripeIntentId(data.intentId);
      setStripeClientSecret(data.clientSecret);

      const stripe = await loadStripeJs(data.publicKey);
      stripeInstanceRef.current = stripe;

      const elements = stripe.elements({
        clientSecret: data.clientSecret,
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: "#16a34a", borderRadius: "12px", fontFamily: "inherit" },
        },
      });
      stripeElementsRef.current = elements;

      setStripeStep("form");

      // Mount a card element (not payment element — avoids link/apple_pay warnings)
      requestAnimationFrame(() => {
        if (stripeContainerRef.current) {
          const cardEl = elements.create("card", {
            style: {
              base: { fontSize: "15px", color: "#111827", "::placeholder": { color: "#9ca3af" } },
            },
            hidePostalCode: true,
          });
          cardEl.mount(stripeContainerRef.current);
        }
      });
    } catch (err) {
      setCardError((err as Error).message);
      setStripeStep("idle");
    }
  }

  async function handleStripeConfirm() {
    if (!stripeInstanceRef.current || !stripeElementsRef.current || !stripeIntentId) return;
    setStripeStep("confirming");
    setCardError(null);
    try {
      // Use confirmCardPayment (card element) not confirmPayment (payment element)
      const cardEl = stripeElementsRef.current.getElement("card");
      const { error, paymentIntent } = await stripeInstanceRef.current.confirmCardPayment(
        stripeClientSecret ?? "",
        { payment_method: { card: cardEl } }
      );
      if (error) throw new Error(error.message ?? "Card payment failed");
      if (paymentIntent?.status === "succeeded") {
        const r = await fetch("/api/wallet/stripe/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ intentId: stripeIntentId }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Wallet credit failed");
        handleSuccess(parseFloat(amount));
      } else {
        throw new Error("Payment incomplete. Status: " + paymentIntent?.status);
      }
    } catch (err) {
      setCardError((err as Error).message);
      setStripeStep("form");
    }
  }

  // ─── CIRCLE USDC ────────────────────────────────────────────────────────────
  async function createCircleIntent() {
    const amt = parseFloat(amount);
    if (!amt || amt < 500) return;
    try {
      const r = await fetch("/api/wallet/circle/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountKes: amt }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setCircleIntentId(d.id);
      setCircleAmountUSDC(d.amountUSDC);
      if (d.depositAddress) {
        setCircleInfo(prev => prev ? { ...prev, depositAddress: d.depositAddress, chain: d.chain, memo: d.memo ?? prev.memo, kesRate: d.kesRate ?? prev.kesRate } : prev);
      }
    } catch (e) {
      setCardError((e as Error).message);
    }
  }

  async function confirmCircle() {
    if (!circleIntentId) return;
    setCircleConfirming(true);
    try {
      const r = await fetch("/api/wallet/circle/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ intentId: circleIntentId, amountKes: parseFloat(amount) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Not confirmed");
      handleSuccess(parseFloat(amount));
    } catch (e) {
      setCardError((e as Error).message);
    } finally { setCircleConfirming(false); }
  }

  async function copyUSDC() {
    await navigator.clipboard.writeText(circleInfo?.depositAddress ?? "").catch(() => {});
    setUsdcCopied(true);
    setTimeout(() => setUsdcCopied(false), 2000);
  }

  const amt = parseFloat(amount) || 0;
  const usdcEstimate = circleInfo ? (amt / circleInfo.kesRate).toFixed(2) : "0.00";

  const TABS: { id: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { id: "mpesa", label: "M-Pesa", icon: <Smartphone size={15} />, color: "bg-green-600" },
    { id: "card", label: "Stripe", icon: <CreditCard size={15} />, color: "bg-blue-600" },
    { id: "usdc", label: "USDC", icon: <Coins size={15} />, color: "bg-purple-600" },
  ];

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ maxHeight: "90dvh" }}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <div>
                <h3 className="font-bold text-lg text-foreground">Add Funds</h3>
                <p className="text-muted-foreground text-xs">Choose your payment method</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <X size={15} className="text-foreground" />
              </button>
            </div>

            {/* Success overlay */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/95"
                >
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle2 size={40} className="text-green-600" />
                  </div>
                  <p className="text-foreground font-bold text-xl mb-1">Payment Confirmed!</p>
                  <p className="text-muted-foreground text-sm">{formatKES(amt)} added to your wallet</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-y-auto px-5 pb-8 space-y-4">
              {/* Tab selector */}
              <div className="flex gap-2 p-1 bg-muted rounded-2xl">
                {TABS.map(t => (
                  <button key={t.id} onClick={() => { setTab(t.id); setCardError(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      tab === t.id ? `${t.color} text-white shadow-sm` : "text-muted-foreground"
                    }`}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Amount input (shared — hide when Stripe form is active or M-Pesa is in-flight) */}
              {!circleIntentId && !(tab === "card" && stripeStep !== "idle") && !(tab === "mpesa" && mpesaStep !== "idle") && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Amount (KES)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">KES</span>
                    <input
                      type="text" inputMode="decimal" value={amount}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9.]/g, "");
                        // Allow only one decimal point
                        const parts = raw.split(".");
                        const val = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
                        setAmount(val);
                      }}
                      placeholder={tab === "usdc" ? "500" : "1000"}
                      className="w-full border border-border rounded-2xl pl-14 pr-4 py-3.5 text-foreground font-bold text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                    {QUICK_AMOUNTS.map(a => (
                      <button key={a} type="button" onClick={() => setAmount(String(a))}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                          amount === String(a) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"
                        }`}>
                        {formatKES(a)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── M-PESA TAB ────────────────────────────────────────────── */}
              {tab === "mpesa" && (
                <div className="space-y-4">
                  {mpesaStep === "idle" && (
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-start gap-2.5">
                        <span className="text-xl">📱</span>
                        <div>
                          <p className="text-green-800 font-semibold text-xs">Pay with M-Pesa · mobile money</p>
                          <p className="text-green-700 text-xs mt-0.5">Enter your Safaricom number. An STK push will arrive on your phone — enter your M-Pesa PIN to confirm.</p>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Mobile Money Number</label>
                        <div className="flex gap-2">
                          <select
                            value={mpesaCode}
                            onChange={e => setMpesaCode(e.target.value)}
                            className="border border-border rounded-xl px-2 py-3 text-sm bg-background focus:outline-none focus:border-primary appearance-none w-[90px] flex-shrink-0 text-center font-medium"
                          >
                            {MPESA_CODES.map(c => (
                              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            value={mpesaPhone}
                            onChange={e => setMpesaPhone(e.target.value.replace(/\D/g, ""))}
                            placeholder={mpesaCode === "+254" ? "07XXXXXXXX or 7XXXXXXXX" : "Phone number"}
                            className="flex-1 border border-border rounded-xl px-3 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      {mpesaError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{mpesaError}</p>
                        </div>
                      )}

                      <button
                        onClick={handleMpesaSend}
                        disabled={!amount || amt < 100 || !mpesaPhone.trim()}
                        className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-green-600/20"
                      >
                        <Smartphone size={18} />
                        {amt >= 100 && mpesaPhone.trim()
                          ? `Send KES ${amt.toLocaleString()} via M-Pesa`
                          : !mpesaPhone.trim() ? "Enter your M-Pesa number" : "Enter at least KES 100"}
                      </button>
                    </>
                  )}

                  {(mpesaStep === "sending" || mpesaStep === "polling") && (
                    <div className="py-10 flex flex-col items-center gap-4 text-center">
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                        <Loader2 size={28} className="animate-spin text-green-600" />
                      </div>
                      {mpesaStep === "sending" ? (
                        <>
                          <p className="text-foreground font-semibold">Sending STK push…</p>
                          <p className="text-muted-foreground text-sm">Initiating payment request to {mpesaCode}{mpesaPhone}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-foreground font-semibold">Check your phone 📱</p>
                          <p className="text-muted-foreground text-sm">Enter your M-Pesa PIN on the pop-up to confirm {formatKES(amt)}.</p>
                          {!mpesaConfigured && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 w-full">
                              <p className="text-amber-700 text-xs">Demo mode — no real STK push sent. Crediting automatically…</p>
                            </div>
                          )}
                          <p className="text-muted-foreground text-xs">Waiting for confirmation…</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ─── CARD TAB (Stripe) ─────────────────────────────────────── */}
              {tab === "card" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-2.5">
                    <span className="text-xl">💳</span>
                    <div>
                      <p className="text-blue-800 font-semibold text-xs">Visa, Mastercard & more</p>
                      <p className="text-blue-600 text-xs mt-0.5">Secure checkout powered by Stripe. Your card details are encrypted end-to-end.</p>
                    </div>
                  </div>

                  {stripeStep === "idle" && (
                    <>
                      {cardError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{cardError}</p>
                        </div>
                      )}
                      <button
                        onClick={handleStripeInit}
                        disabled={!amount || amt < 100}
                        className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20">
                        <CreditCard size={18} />
                        {amt >= 100 ? `Pay ${formatKES(amt)} by Card` : "Enter at least KES 100"}
                      </button>
                      <div className="flex items-center justify-center gap-3 pt-1">
                        {["VISA", "MC", "Amex", "Stripe"].map(m => (
                          <span key={m} className="text-[9px] font-bold bg-muted border border-border px-2 py-1 rounded text-muted-foreground">{m}</span>
                        ))}
                      </div>
                    </>
                  )}

                  {stripeStep === "loading" && (
                    <div className="py-10 flex flex-col items-center gap-3">
                      <Loader2 size={28} className="animate-spin text-blue-600" />
                      <p className="text-sm text-muted-foreground">Initialising secure payment…</p>
                    </div>
                  )}

                  {(stripeStep === "form" || stripeStep === "confirming") && (
                    <div className="space-y-4">
                      <div ref={stripeContainerRef} className="min-h-[120px]" />
                      {cardError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{cardError}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => { setStripeStep("idle"); setCardError(null); stripeElementsRef.current = null; stripeInstanceRef.current = null; }}
                          className="border border-border text-foreground font-semibold py-3 rounded-2xl text-sm active:scale-95">
                          ← Back
                        </button>
                        <button
                          onClick={handleStripeConfirm}
                          disabled={stripeStep === "confirming"}
                          className="bg-blue-600 text-white font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60 shadow-sm">
                          {stripeStep === "confirming" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          {stripeStep === "confirming" ? "Processing…" : "Pay Now"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── USDC TAB ──────────────────────────────────────────────── */}
              {tab === "usdc" && (
                <div className="space-y-4">
                  {!circleIntentId ? (
                    <>
                      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 flex items-start gap-2.5">
                        <span className="text-xl">🪙</span>
                        <div>
                          <p className="text-purple-800 font-semibold text-xs">Pay with USDC (via Circle)</p>
                          <p className="text-purple-600 text-xs mt-0.5">
                            Send USDC on Polygon (MATIC) to a deposit address. Ideal for diaspora investors.
                            {circleInfo && ` Rate: KES ${circleInfo.kesRate.toFixed(0)} / USDC`}
                          </p>
                        </div>
                      </div>

                      {amt >= 500 && (
                        <div className="bg-muted/60 rounded-2xl p-3 flex items-center justify-between">
                          <p className="text-muted-foreground text-xs">You'll send approx.</p>
                          <p className="text-foreground font-bold text-sm">{usdcEstimate} USDC</p>
                        </div>
                      )}

                      {cardError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{cardError}</p>
                        </div>
                      )}

                      <button
                        onClick={createCircleIntent}
                        disabled={!amount || amt < 500}
                        className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-purple-600/20">
                        <Coins size={18} />
                        {amt >= 500 ? `Generate USDC Address for ${usdcEstimate} USDC` : "Enter at least KES 500"}
                      </button>

                      {/* Connect Web3 wallet directly */}
                      <div className="relative flex items-center gap-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-muted-foreground text-[10px] font-semibold uppercase">or</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <button
                        onClick={() => setWalletModalOpen(true)}
                        disabled={!amount || amt < 500}
                        className="w-full border-2 border-purple-300 text-purple-700 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 bg-purple-50">
                        <Wallet size={18} />
                        Connect Wallet (MetaMask / Trust / WalletConnect)
                      </button>
                    </>
                  ) : (
                    /* USDC deposit address shown */
                    <div className="space-y-4">
                      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                            <Coins size={16} className="text-purple-600" />
                          </div>
                          <div>
                            <p className="text-purple-800 font-bold text-sm">Send {circleAmountUSDC} USDC</p>
                            <p className="text-purple-600 text-xs">{circleInfo?.chain ?? "Polygon (MATIC)"} network</p>
                          </div>
                        </div>

                        {/* Address */}
                        <div className="bg-white rounded-xl border border-purple-200 p-3 space-y-2">
                          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Deposit Address</p>
                          <div className="flex items-center gap-2">
                            <p className="text-foreground font-mono text-xs flex-1 break-all leading-relaxed">{circleInfo?.depositAddress}</p>
                            <button onClick={copyUSDC} className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                              {usdcCopied ? <Check size={13} className="text-purple-600" /> : <Copy size={13} className="text-purple-600" />}
                            </button>
                          </div>
                        </div>

                        {/* Memo */}
                        {circleInfo?.memo && (
                          <div className="bg-white rounded-xl border border-purple-200 p-3">
                            <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Memo / Tag (required)</p>
                            <p className="text-foreground font-mono text-sm font-bold">{circleInfo.memo}</p>
                          </div>
                        )}

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
                          <AlertCircle size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-amber-700 text-[10px]">Always include the memo. Deposits without a memo cannot be credited to your account.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { setCircleIntentId(null); setCircleAmountUSDC(""); }}
                          className="border border-border text-foreground font-semibold py-3 rounded-2xl text-sm active:scale-95">
                          ← Back
                        </button>
                        <button onClick={confirmCircle} disabled={circleConfirming}
                          className="bg-purple-600 text-white font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60 shadow-sm shadow-purple-600/20">
                          {circleConfirming ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          I've Sent USDC
                        </button>
                      </div>
                      <p className="text-center text-muted-foreground text-[11px]">After sending, tap "I've Sent USDC" — we'll verify on-chain and credit your KES wallet.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Security footer */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground/60">🔒</span>
                <p className="text-[10px] text-muted-foreground/60">256-bit SSL · M-Pesa &amp; Cards by Stripe · Circle USDC · PCI-DSS L1</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Web3 Wallet Connect Modal */}
    <WalletConnectModal
      open={walletModalOpen}
      onClose={() => setWalletModalOpen(false)}
      depositAddress={circleInfo?.depositAddress ?? "0x742d35Cc6634C0532925a3b8D4C9E28E4b9A5bEf"}
      amountUSDC={usdcEstimate}
      chain={circleInfo?.chain ?? "Polygon (MATIC)"}
      memo={circleInfo?.memo}
      onConnected={() => {}}
    />
    </>
  );
}
