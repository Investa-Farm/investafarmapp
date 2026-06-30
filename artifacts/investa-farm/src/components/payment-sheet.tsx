/**
 * PaymentSheet — in-app payment bottom-sheet for Investa Farm
 *
 * Tabs:
 *   M-Pesa — Safaricom Daraja STK push
 *   Card   — Stripe Payment Element → in-page card form → confirm
 *   USDC   — Circle USDC on-chain deposit address + manual confirm
 */
import { useState, useEffect, useRef, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CreditCard, Loader2, CheckCircle2,
  Copy, Check, AlertCircle, Wallet, Smartphone,
  Shield, Lock, Zap, RefreshCw, Clock,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken, getStoredUser, formatKES } from "@/lib/auth";
import { WalletConnectModal } from "@/components/wallet-connect-modal";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000, 25000];

// Real Circle (circle.com) logo — the "C" arc mark, used for USDC branding
function CircleLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <path d="M20.022 18.124c0 2.124-1.4 3.544-3.578 3.796v1.338c0 .182-.144.318-.326.318h-1.156c-.182 0-.326-.136-.326-.318V21.92C12.32 21.668 10.92 20.246 10.92 18.124h1.846c0 1.114.742 1.876 1.876 1.876s1.876-.762 1.876-1.876c0-1.272-.858-1.764-2.076-2.236-1.61-.63-3.484-1.37-3.484-3.54 0-2.04 1.372-3.416 3.578-3.668V7.342c0-.182.144-.318.326-.318h1.156c.182 0 .326.136.326.318V8.68c2.02.252 3.392 1.624 3.392 3.668H17.872c0-1.092-.728-1.84-1.848-1.84s-1.848.748-1.848 1.84c0 1.232.858 1.722 2.076 2.194 1.624.63 3.77 1.386 3.77 3.582z" fill="white" />
    </svg>
  );
}

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

  // M-Pesa (Daraja) state
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaCode, setMpesaCode] = useState("+254");
  const [mpesaStep, setMpesaStep] = useState<"idle" | "sending" | "polling" | "expired" | "done">("idle");
  const [mpesaCheckoutId, setMpesaCheckoutId] = useState<string | null>(null);
  const [mpesaError, setMpesaError] = useState<string | null>(null);
  const [mpesaConfigured, setMpesaConfigured] = useState(true);
  const [mpesaMessage, setMpesaMessage] = useState<string>("");
  const mpesaPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mpesaCountdown, setMpesaCountdown] = useState(120);
  const mpesaCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mpesaAmountRef = useRef<number>(0);
  const mpesaSucceededRef = useRef(false);

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

  useEffect(() => {
    if (mpesaStep === "polling") {
      setMpesaCountdown(120);
      mpesaCountdownRef.current = setInterval(() => {
        setMpesaCountdown(prev => {
          if (prev <= 1) { clearInterval(mpesaCountdownRef.current!); mpesaCountdownRef.current = null; return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (mpesaCountdownRef.current) { clearInterval(mpesaCountdownRef.current); mpesaCountdownRef.current = null; }
    }
    return () => { if (mpesaCountdownRef.current) clearInterval(mpesaCountdownRef.current); };
  }, [mpesaStep]);

  // When countdown hits 0 while still polling → expire + send push notification
  // Guard: mpesaSucceededRef prevents false expiry if payment confirmed just before timeout
  useEffect(() => {
    if (mpesaCountdown === 0 && mpesaStep === "polling" && !mpesaSucceededRef.current) {
      if (mpesaPollRef.current) { clearInterval(mpesaPollRef.current); mpesaPollRef.current = null; }
      setMpesaStep("expired");
      fetch("/api/wallet/daraja/expired", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: mpesaAmountRef.current }),
      }).catch(() => {});
    }
  }, [mpesaCountdown, mpesaStep, token]);

  useEffect(() => {
    if (tab === "usdc" && !circleInfo && token) {
      fetch("/api/wallet/circle/info", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setCircleInfo(d))
        .catch(() => {});
    }
  }, [tab, circleInfo, token]);

  useEffect(() => {
    if (!open) resetAll();
  }, [open]);

  function resetAll() {
    setAmount("");
    setMpesaPhone(""); setMpesaStep("idle"); setMpesaCheckoutId(null); setMpesaError(null); setMpesaMessage("");
    mpesaAmountRef.current = 0;
    mpesaSucceededRef.current = false;
    if (mpesaPollRef.current) { clearInterval(mpesaPollRef.current); mpesaPollRef.current = null; }
    if (mpesaCountdownRef.current) { clearInterval(mpesaCountdownRef.current); mpesaCountdownRef.current = null; }
    setMpesaCountdown(120);
    setStripeStep("idle"); setStripeIntentId(null); setStripeClientSecret(null); setCardError(null);
    stripeInstanceRef.current = null; stripeElementsRef.current = null;
    setCircleIntentId(null); setCircleAmountUSDC(""); setSuccess(false); setWalletModalOpen(false);
  }

  // Retry from expired state — keeps phone + amount pre-filled
  function handleRetry() {
    if (mpesaPollRef.current) { clearInterval(mpesaPollRef.current); mpesaPollRef.current = null; }
    if (mpesaCountdownRef.current) { clearInterval(mpesaCountdownRef.current); mpesaCountdownRef.current = null; }
    setMpesaStep("idle");
    setMpesaError(null);
    setMpesaCheckoutId(null);
    setMpesaCountdown(120);
  }

  // ─── M-PESA via Daraja ──────────────────────────────────────────────────────
  async function handleMpesaSend() {
    const amt = parseFloat(amount);
    if (!amt || amt < 10 || !mpesaPhone.trim()) return;

    const digits = mpesaPhone.replace(/\D/g, "");
    const local = digits.startsWith("0") ? digits.slice(1) : digits;
    if (mpesaCode === "+254" && local.length !== 9) {
      setMpesaError("Enter a valid Safaricom number — 9 digits after country code (e.g. 712 345 678).");
      return;
    }

    const fullPhone = mpesaCode + local;
    mpesaAmountRef.current = amt;
    setMpesaStep("sending");
    setMpesaError(null);

    try {
      const r = await fetch("/api/wallet/daraja/stk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, phone: fullPhone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to initiate M-Pesa payment");

      setMpesaCheckoutId(d.checkoutRequestId);
      setMpesaConfigured(d.configured !== false);
      setMpesaMessage(d.customerMessage ?? "Check your phone for the M-Pesa prompt");
      setMpesaStep("polling");

      // Demo mode: credit immediately
      if (d.configured === false) {
        setTimeout(async () => {
          const sr = await fetch(`/api/wallet/daraja/status/${d.checkoutRequestId}?amount=${amt}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null);
          handleSuccess(amt);
        }, 2000);
        return;
      }

      // Poll every 4 s for up to 2 min (countdown useEffect drives expiry)
      let polls = 0;
      mpesaPollRef.current = setInterval(async () => {
        polls++;
        if (polls > 30) {
          clearInterval(mpesaPollRef.current!); mpesaPollRef.current = null;
          return; // Countdown useEffect handles expired state
        }
        try {
          const sr = await fetch(`/api/wallet/daraja/status/${d.checkoutRequestId}?amount=${amt}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const sd = await sr.json();
          if (sd.paid) {
            clearInterval(mpesaPollRef.current!); mpesaPollRef.current = null;
            handleSuccess(amt);
          } else if (sd.resultCode && sd.resultCode !== "0" && sd.resultCode !== "pending") {
            clearInterval(mpesaPollRef.current!); mpesaPollRef.current = null;
            setMpesaError(sd.resultDesc || "Payment was cancelled or failed. Please try again.");
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
    // Mark succeeded immediately so the expiry effect can't fire a false "expired" notification
    mpesaSucceededRef.current = true;
    if (mpesaCountdownRef.current) { clearInterval(mpesaCountdownRef.current); mpesaCountdownRef.current = null; }
    setMpesaStep("done");
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

  useEffect(() => {
    if (stripeStep !== "form" || !stripeElementsRef.current || !stripeContainerRef.current) return;
    if (stripeContainerRef.current.childElementCount > 0) return;
    const cardEl = stripeElementsRef.current.create("card", {
      style: {
        base: {
          fontSize: "16px",
          color: "#111827",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSmoothing: "antialiased",
          "::placeholder": { color: "#9ca3af" },
        },
        invalid: { color: "#ef4444" },
      },
      hidePostalCode: true,
    });
    cardEl.mount(stripeContainerRef.current);
  }, [stripeStep]);

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
          variables: { colorPrimary: "#2563eb", borderRadius: "14px", fontFamily: "inherit" },
        },
      });
      stripeElementsRef.current = elements;
      setStripeStep("form");
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

  const TABS: { id: Tab; label: string; icon: React.ReactNode; activeClass: string; gradient: string }[] = [
    { id: "mpesa", label: "M-Pesa", icon: <Smartphone size={14} />, activeClass: "text-white shadow-md", gradient: "linear-gradient(135deg,#15803d,#16a34a)" },
    { id: "card",  label: "Card",   icon: <CreditCard size={14} />, activeClass: "text-white shadow-md", gradient: "linear-gradient(135deg,#1d4ed8,#3b82f6)" },
    { id: "usdc",  label: "USDC",   icon: <CircleLogo size={14} />, activeClass: "text-white shadow-md", gradient: "linear-gradient(135deg,#1652F0,#2D56FA)" },
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
            style={{ maxHeight: "92dvh" }}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
              <div>
                <h3 className="font-bold text-lg text-foreground">Add Funds</h3>
                <p className="text-muted-foreground text-xs">Choose your payment method</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
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

            <div className="overflow-y-auto px-5 pb-8 space-y-4 pt-4">
              {/* Tab selector — premium pill tabs */}
              <div className="flex gap-1.5 p-1.5 bg-muted/80 rounded-2xl border border-border/60">
                {TABS.map(t => (
                  <button key={t.id} onClick={() => { setTab(t.id); setCardError(null); setMpesaError(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      tab === t.id ? `${t.activeClass}` : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={tab === t.id ? { background: t.gradient, boxShadow: "0 4px 14px rgba(0,0,0,0.25)" } : {}}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Amount input */}
              {!circleIntentId && !(tab === "card" && stripeStep !== "idle") && !(tab === "mpesa" && mpesaStep !== "idle") && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Amount (KES)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">KES</span>
                    <input
                      type="text" inputMode="decimal" value={amount}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9.]/g, "");
                        const parts = raw.split(".");
                        const val = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
                        setAmount(val);
                      }}
                      placeholder={tab === "usdc" ? "500" : "1000"}
                      className="w-full border-2 border-border rounded-2xl pl-14 pr-4 py-4 text-foreground font-bold text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                    />
                  </div>
                  <div className="flex gap-2 mt-2.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                    {QUICK_AMOUNTS.map(a => (
                      <button key={a} type="button" onClick={() => setAmount(String(a))}
                        className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95 ${
                          amount === String(a)
                            ? "bg-primary text-white border-primary"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}>
                        {formatKES(a)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── M-PESA TAB (Daraja) ─────────────────────────────────── */}
              {tab === "mpesa" && (
                <div className="space-y-4">
                  {mpesaStep === "idle" && (
                    <>
                      {/* M-Pesa premium banner */}
                      <div className="relative overflow-hidden rounded-2xl" style={{ background: "linear-gradient(135deg,#052e16 0%,#166534 55%,#15803d 100%)", boxShadow: "0 8px 32px rgba(21,128,61,0.45)" }}>
                        {/* Decorative circles */}
                        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5" />
                        <div className="absolute top-4 right-8 w-14 h-14 rounded-full bg-white/5" />
                        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />
                        <div className="relative p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
                              <span className="text-2xl">📱</span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-white font-black text-sm tracking-tight">M-Pesa</p>
                                <span className="bg-white/20 text-white/90 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white/20">SAFARICOM</span>
                              </div>
                              <p className="text-green-200/80 text-[11px] leading-relaxed">STK push sent to your phone · Enter PIN to confirm instantly</p>
                            </div>
                          </div>
                          {/* Stats row */}
                          <div className="flex gap-3 mt-3 pt-3 border-t border-white/10">
                            {[{ label: "Instant", icon: "⚡" }, { label: "Secure", icon: "🔒" }, { label: "No fees", icon: "✅" }].map(s => (
                              <div key={s.label} className="flex items-center gap-1">
                                <span className="text-xs">{s.icon}</span>
                                <span className="text-white/70 text-[10px] font-semibold">{s.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Mobile Money Number</label>
                        <div className="flex gap-2">
                          <select
                            value={mpesaCode}
                            onChange={e => setMpesaCode(e.target.value)}
                            className="border-2 border-border rounded-xl px-2 py-3 text-sm bg-background focus:outline-none focus:border-green-500 appearance-none w-[88px] flex-shrink-0 text-center font-semibold transition-colors"
                          >
                            {MPESA_CODES.map(c => (
                              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            value={mpesaPhone}
                            onChange={e => setMpesaPhone(e.target.value.replace(/\D/g, ""))}
                            placeholder={mpesaCode === "+254" ? "712 345 678" : "Phone number"}
                            className="flex-1 border-2 border-border rounded-xl px-3 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
                          />
                        </div>
                      </div>

                      {mpesaError && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{mpesaError}</p>
                        </motion.div>
                      )}

                      <button
                        onClick={handleMpesaSend}
                        disabled={!amount || amt < 10 || !mpesaPhone.trim()}
                        className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-600/25"
                      >
                        <Smartphone size={18} />
                        {amt >= 10 && mpesaPhone.trim()
                          ? `Send ${formatKES(amt)} via M-Pesa`
                          : !mpesaPhone.trim() ? "Enter your M-Pesa number" : "Enter at least KES 10"}
                      </button>

                      {/* Trust badges */}
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center gap-1 text-muted-foreground/60">
                          <Shield size={10} />
                          <span className="text-[10px]">Safaricom Daraja API</span>
                        </div>
                        <span className="text-border">·</span>
                        <div className="flex items-center gap-1 text-muted-foreground/60">
                          <Lock size={10} />
                          <span className="text-[10px]">End-to-end encrypted</span>
                        </div>
                        <span className="text-border">·</span>
                        <div className="flex items-center gap-1 text-muted-foreground/60">
                          <Zap size={10} />
                          <span className="text-[10px]">Instant credit</span>
                        </div>
                      </div>
                    </>
                  )}

                  {(mpesaStep === "sending" || mpesaStep === "polling") && (
                    <div className="py-4 flex flex-col items-center gap-5 text-center">

                      {/* Step indicator with real connector lines */}
                      <div className="w-full flex items-center px-2">
                        {[
                          { label: "Sending", icon: "📤", done: mpesaStep === "polling", active: mpesaStep === "sending" },
                          { label: "Enter PIN", icon: "📱", done: false, active: mpesaStep === "polling" },
                          { label: "Confirmed", icon: "✅", done: false, active: false },
                        ].map((step, i) => (
                          <Fragment key={i}>
                            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border-2 transition-all duration-300 ${
                                step.done
                                  ? "bg-green-600 border-green-600 shadow-md shadow-green-600/25"
                                  : step.active
                                    ? "bg-primary/10 border-primary"
                                    : "bg-muted border-border"
                              }`}>
                                {step.done
                                  ? <span className="text-white font-bold text-sm">✓</span>
                                  : step.active
                                    ? <span className="animate-pulse">{step.icon}</span>
                                    : <span className="opacity-35">{step.icon}</span>}
                              </div>
                              <p className={`text-[9px] font-bold tracking-wide ${step.active ? "text-primary" : step.done ? "text-green-600" : "text-muted-foreground/50"}`}>{step.label}</p>
                            </div>
                            {i < 2 && (
                              <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all duration-500 ${step.done ? "bg-green-400" : "bg-border"}`} />
                            )}
                          </Fragment>
                        ))}
                      </div>

                      {mpesaStep === "sending" ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <Loader2 size={28} className="animate-spin text-primary" />
                          </div>
                          <div>
                            <p className="text-foreground font-bold text-base">Sending STK push…</p>
                            <p className="text-muted-foreground text-sm mt-0.5">Contacting Safaricom for {mpesaCode}{mpesaPhone}</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Circular countdown ring */}
                          <div className="relative w-32 h-32">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
                              <circle
                                cx="50" cy="50" r="42" fill="none"
                                stroke={mpesaCountdown <= 20 ? "#ef4444" : mpesaCountdown <= 60 ? "#f59e0b" : "#16a34a"}
                                strokeWidth="7"
                                strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 42}`}
                                strokeDashoffset={`${2 * Math.PI * 42 * (1 - mpesaCountdown / 120)}`}
                                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className={`text-2xl font-black tabular-nums transition-colors ${
                                mpesaCountdown <= 20 ? "text-red-500 animate-pulse" : mpesaCountdown <= 60 ? "text-amber-500" : "text-green-600"
                              }`}>
                                {String(Math.floor(mpesaCountdown / 60)).padStart(2, "0")}:{String(mpesaCountdown % 60).padStart(2, "0")}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-medium">remaining</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-foreground font-bold text-base">Check your phone 📱</p>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                              {mpesaMessage || `Enter your M-Pesa PIN to confirm ${formatKES(mpesaAmountRef.current || amt)}`}
                            </p>
                          </div>

                          {/* Urgency hint when critically low */}
                          <AnimatePresence>
                            {mpesaCountdown > 0 && mpesaCountdown <= 30 && (
                              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="bg-red-50 border border-red-200 rounded-xl p-2.5 w-full flex items-center gap-2">
                                <Clock size={13} className="text-red-500 flex-shrink-0" />
                                <p className="text-red-700 text-[11px] font-semibold">Hurry! Check your phone — request expires soon</p>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {!mpesaConfigured && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 w-full">
                              <p className="text-amber-700 text-xs font-medium">Demo mode — crediting automatically…</p>
                            </div>
                          )}

                          <div className="bg-muted/60 rounded-2xl p-3.5 w-full space-y-2">
                            {[
                              { label: "Amount", val: formatKES(mpesaAmountRef.current || amt), green: false },
                              { label: "Number", val: `${mpesaCode}${mpesaPhone}`, green: false },
                              { label: "Provider", val: "Safaricom M-Pesa", green: true },
                            ].map(({ label, val, green }) => (
                              <div key={label} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{label}</span>
                                <span className={`font-bold ${green ? "text-green-600" : "text-foreground"}`}>{val}</span>
                              </div>
                            ))}
                          </div>

                          <div className="w-full space-y-2.5">
                            <button
                              onClick={async () => {
                                if (!mpesaCheckoutId) return;
                                try {
                                  const r = await fetch(`/api/wallet/daraja/status/${mpesaCheckoutId}?amount=${mpesaAmountRef.current || amt}`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  const d = await r.json();
                                  if (d.paid) {
                                    if (mpesaPollRef.current) clearInterval(mpesaPollRef.current);
                                    handleSuccess(mpesaAmountRef.current || amt);
                                  }
                                } catch { /* silent */ }
                              }}
                              className="w-full py-3 rounded-2xl border-2 border-green-300 text-green-700 text-sm font-bold active:scale-95 transition-all bg-green-50">
                              I already completed the payment →
                            </button>
                            <button
                              onClick={() => {
                                if (mpesaPollRef.current) { clearInterval(mpesaPollRef.current); mpesaPollRef.current = null; }
                                setMpesaStep("idle"); setMpesaError(null);
                              }}
                              className="text-xs text-muted-foreground underline underline-offset-2 w-full text-center">
                              Cancel and start over
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ─── EXPIRED STATE ─────────────────────────────────── */}
                  {mpesaStep === "expired" && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      className="py-4 flex flex-col items-center gap-4 text-center">

                      {/* Expired icon */}
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                          <Clock size={32} className="text-red-400" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-red-500 border-2 border-background flex items-center justify-center">
                          <span className="text-white text-xs font-black">!</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-foreground font-bold text-lg">Payment Expired</p>
                        <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                          Your {formatKES(mpesaAmountRef.current)} M-Pesa request wasn't approved within 2 minutes
                        </p>
                      </div>

                      <div className="bg-muted/60 rounded-2xl p-4 w-full text-left space-y-3">
                        {[
                          { icon: "💸", text: "No funds were deducted from your M-Pesa" },
                          { icon: "🔔", text: "We've sent you a notification to remind you" },
                          { icon: "🔁", text: "Tap retry — your number is already saved" },
                        ].map(({ icon, text }) => (
                          <div key={text} className="flex items-center gap-2.5">
                            <span className="text-base flex-shrink-0">{icon}</span>
                            <p className="text-sm text-foreground/80">{text}</p>
                          </div>
                        ))}
                      </div>

                      {/* Primary retry CTA */}
                      <button onClick={handleRetry}
                        className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2.5 active:scale-95 transition-all shadow-lg shadow-green-600/20">
                        <RefreshCw size={16} />
                        Retry — Send {formatKES(mpesaAmountRef.current)} Again
                      </button>

                      {/* Check if it secretly went through */}
                      <button
                        onClick={async () => {
                          if (!mpesaCheckoutId) { handleRetry(); return; }
                          try {
                            const r = await fetch(`/api/wallet/daraja/status/${mpesaCheckoutId}?amount=${mpesaAmountRef.current}`, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            const d = await r.json();
                            if (d.paid) {
                              handleSuccess(mpesaAmountRef.current);
                            } else {
                              handleRetry();
                            }
                          } catch { handleRetry(); }
                        }}
                        className="w-full py-3.5 rounded-2xl border-2 border-border text-foreground text-sm font-semibold active:scale-95 transition-all bg-muted/40">
                        I completed the payment — verify
                      </button>

                      <button onClick={() => { setMpesaStep("idle"); setMpesaError(null); setAmount(""); }}
                        className="text-xs text-muted-foreground underline underline-offset-2">
                        Start fresh with a different amount
                      </button>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ─── CARD TAB (Stripe) ─────────────────────────────────────── */}
              {tab === "card" && (
                <div className="space-y-4">
                  {/* Premium credit card visual */}
                  <div className="relative overflow-hidden rounded-2xl h-44"
                    style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#1d4ed8 100%)", boxShadow: "0 12px 40px rgba(29,78,216,0.5)" }}>
                    {/* Holographic shimmer */}
                    <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(ellipse at 70% 30%, rgba(147,197,253,0.6) 0%, transparent 60%)" }} />
                    <div className="absolute top-0 right-0 w-40 h-40 rounded-full -translate-y-12 translate-x-12" style={{ background: "rgba(96,165,250,0.15)" }} />
                    <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full translate-y-8 -translate-x-6" style={{ background: "rgba(37,99,235,0.25)" }} />
                    {/* Diagonal stripe pattern */}
                    <div className="absolute inset-0 opacity-5"
                      style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0px,#fff 1px,transparent 1px,transparent 12px)" }} />
                    <div className="relative flex flex-col h-full justify-between p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-0.5">
                          {/* EMV chip */}
                          <div className="w-10 h-7 rounded-md" style={{ background: "linear-gradient(135deg,#ca8a04,#fbbf24,#d97706)", boxShadow: "inset 0 1px 2px rgba(255,255,255,0.4)" }}>
                            <div className="w-full h-full rounded-md opacity-60"
                              style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 3px)" }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {["VISA", "MC", "AMEX"].map(b => (
                            <span key={b} className="text-[8px] font-black text-white/50 bg-white/10 px-1.5 py-0.5 rounded border border-white/10">{b}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-white/30 text-[8px] font-semibold uppercase tracking-[0.2em] mb-1">Charge amount</p>
                        <p className="text-white font-black text-2xl tracking-tight" style={{ fontFamily: "Space Grotesk, monospace" }}>
                          {amt > 0 ? formatKES(amt) : "KES ––.––"}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Lock size={9} className="text-blue-300/60" />
                          <span className="text-blue-200/50 text-[9px] font-semibold uppercase tracking-widest">PCI-DSS Level 1 · Stripe Secure</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "1px solid #bfdbfe" }}>
                    <Shield size={13} className="text-blue-600 flex-shrink-0" />
                    <p className="text-blue-700 text-xs font-medium">3D Secure · Encrypted end-to-end · Powered by Stripe</p>
                    <Lock size={11} className="text-blue-400 ml-auto flex-shrink-0" />
                  </div>

                  {stripeStep === "idle" && (
                    <>
                      {cardError && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{cardError}</p>
                        </motion.div>
                      )}
                      <button
                        onClick={handleStripeInit}
                        disabled={!amount || amt < 100}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25">
                        <CreditCard size={18} />
                        {amt >= 100 ? `Pay ${formatKES(amt)} by Card` : "Enter at least KES 100"}
                      </button>
                    </>
                  )}

                  {stripeStep === "loading" && (
                    <div className="py-8 flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                        <Loader2 size={24} className="animate-spin text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Setting up secure payment…</p>
                    </div>
                  )}

                  {(stripeStep === "form" || stripeStep === "confirming") && (
                    <div className="space-y-4">
                      {/* Stripe card element container */}
                      <div className="border-2 border-border rounded-2xl overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                        <div className="px-4 pt-3 pb-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Card Details</p>
                        </div>
                        <div ref={stripeContainerRef} className="px-4 pb-4 min-h-[52px]" />
                      </div>

                      {cardError && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{cardError}</p>
                        </motion.div>
                      )}

                      {/* Payment summary */}
                      <div className="bg-muted/60 rounded-xl p-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">Total charge</span>
                        <span className="font-bold text-foreground">{formatKES(amt)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => { setStripeStep("idle"); setCardError(null); stripeElementsRef.current = null; stripeInstanceRef.current = null; }}
                          className="border-2 border-border text-foreground font-semibold py-3.5 rounded-2xl text-sm active:scale-95 transition-all hover:bg-muted">
                          ← Back
                        </button>
                        <button
                          onClick={handleStripeConfirm}
                          disabled={stripeStep === "confirming"}
                          className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 shadow-md shadow-blue-600/20 transition-all">
                          {stripeStep === "confirming"
                            ? <><Loader2 size={14} className="animate-spin" /> Processing…</>
                            : <><Lock size={13} /> Pay Now</>}
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
                      {/* USDC premium crypto card */}
                      <div className="relative overflow-hidden rounded-2xl p-4"
                        style={{ background: "linear-gradient(135deg,#0a1628 0%,#0d3085 50%,#1652F0 100%)", boxShadow: "0 10px 36px rgba(22,82,240,0.45)" }}>
                        <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-blue-400/10" />
                        <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-blue-600/10" />
                        <div className="relative flex items-start gap-3">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
                            <span className="text-2xl">🪙</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-white font-black text-sm">USDC</p>
                              <span className="bg-white/15 text-blue-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white/15">CIRCLE</span>
                            </div>
                            <p className="text-blue-200/80 text-[11px] leading-relaxed">
                              {circleInfo
                                ? `Rate: KES ${circleInfo.kesRate.toFixed(0)} / USDC · ${circleInfo.chain} network`
                                : "Polygon (MATIC) · Ideal for diaspora investors"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3 mt-3 pt-3 border-t border-white/10">
                          {[{ label: "Stablecoin", icon: "💎" }, { label: "On-chain", icon: "⛓️" }, { label: "Global", icon: "🌍" }].map(s => (
                            <div key={s.label} className="flex items-center gap-1">
                              <span className="text-xs">{s.icon}</span>
                              <span className="text-white/60 text-[10px] font-semibold">{s.label}</span>
                            </div>
                          ))}
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
                        className="w-full text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg"
                        style={{ background: "linear-gradient(135deg,#1652F0,#2D56FA)", boxShadow: "0 6px 20px rgba(22,82,240,0.35)" }}>
                        <CircleLogo size={18} />
                        {amt >= 500 ? `Generate USDC Address for ${usdcEstimate} USDC` : "Enter at least KES 500"}
                      </button>

                      <div className="relative flex items-center gap-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-muted-foreground text-[10px] font-semibold uppercase">or</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <button
                        onClick={() => setWalletModalOpen(true)}
                        disabled={!amount || amt < 500}
                        className="w-full border-2 border-blue-300 text-blue-700 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 bg-blue-50">
                        <Wallet size={18} />
                        Connect Wallet (Binance / MetaMask / Coinbase)
                      </button>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                            <CircleLogo size={16} />
                          </div>
                          <div>
                            <p className="text-blue-800 font-bold text-sm">Send {circleAmountUSDC} USDC</p>
                            <p className="text-blue-600 text-xs">{circleInfo?.chain ?? "Polygon (MATIC)"} network</p>
                          </div>
                        </div>

                        <div className="bg-white rounded-xl border border-blue-200 p-3 space-y-2">
                          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Deposit Address</p>
                          <div className="flex items-center gap-2">
                            <p className="text-foreground font-mono text-xs flex-1 break-all leading-relaxed">{circleInfo?.depositAddress}</p>
                            <button onClick={copyUSDC} className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              {usdcCopied ? <Check size={13} className="text-[#1652F0]" /> : <Copy size={13} className="text-[#1652F0]" />}
                            </button>
                          </div>
                        </div>

                        {circleInfo?.memo && (
                          <div className="bg-white rounded-xl border border-blue-200 p-3">
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
                          className="border-2 border-border text-foreground font-semibold py-3 rounded-2xl text-sm active:scale-95">
                          ← Back
                        </button>
                        <button onClick={confirmCircle} disabled={circleConfirming}
                          className="text-white font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60"
                          style={{ background: "linear-gradient(135deg,#1652F0,#2D56FA)" }}>
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
              <div className="flex items-center justify-center gap-1.5 pt-1 pb-1">
                <Lock size={9} className="text-muted-foreground/50" />
                <p className="text-[10px] text-muted-foreground/50">256-bit SSL · M-Pesa by Safaricom Daraja · Cards by Stripe · PCI-DSS L1</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

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
