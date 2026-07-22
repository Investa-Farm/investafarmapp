/**
 * PaymentSheet — in-app payment bottom-sheet for Investa Farm
 *
 * Tabs:
 *   Mobile Money — select M-Pesa / MTN / Airtel → direct STK push via PesaPal
 *                  or PesaPal new-tab checkout (MTN / Airtel) — no in-app popup
 *   Card          — PesaPal checkout opens in a new browser tab + background polling
 *   USDC          — Circle on-chain deposit address + manual confirm
 */
import { useState, useEffect, useRef } from "react";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CreditCard, Loader2, CheckCircle2,
  Copy, Check, AlertCircle, Wallet, Smartphone,
  Shield, Lock, Zap, ExternalLink, Phone, ChevronRight, ChevronDown,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken, getStoredUser, formatKES } from "@/lib/auth";
import { WalletConnectModal } from "@/components/wallet-connect-modal";
import { TxConfirmationTracker } from "@/components/tx-confirmation-tracker";
import { showCenterSuccess } from "@/components/center-success-modal";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000, 25000];

// Real Circle (circle.com) logo
function CircleLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <path d="M20.022 18.124c0 2.124-1.4 3.544-3.578 3.796v1.338c0 .182-.144.318-.326.318h-1.156c-.182 0-.326-.136-.326-.318V21.92C12.32 21.668 10.92 20.246 10.92 18.124h1.846c0 1.114.742 1.876 1.876 1.876s1.876-.762 1.876-1.876c0-1.272-.858-1.764-2.076-2.236-1.61-.63-3.484-1.37-3.484-3.54 0-2.04 1.372-3.416 3.578-3.668V7.342c0-.182.144-.318.326-.318h1.156c.182 0 .326.136.326.318V8.68c2.02.252 3.392 1.624 3.392 3.668H17.872c0-1.092-.728-1.84-1.848-1.84s-1.848.748-1.848 1.84c0 1.232.858 1.722 2.076 2.194 1.624.63 3.77 1.386 3.77 3.582z" fill="white" />
    </svg>
  );
}

// PesaPal logo mark
function PesaPalLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#00A651" />
      <path d="M8 20C8 13.373 13.373 8 20 8s12 5.373 12 12-5.373 12-12 12S8 26.627 8 20z" fill="white" fillOpacity=".15" />
      <path d="M14 16h7c1.657 0 3 1.343 3 3s-1.343 3-3 3h-4v4h-3V16zm3 4h4c.552 0 1-.448 1-1s-.448-1-1-1h-4v2z" fill="white" />
    </svg>
  );
}

type Tab = "mobile" | "card" | "usdc";
type PayStep = "idle" | "creating" | "push_sent" | "new_tab" | "polling" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

// Currency per dial code — PesaPal requires the correct local currency for USSD push
const DIAL_CURRENCY: Record<string, string> = {
  "+254": "KES", // Kenya
  "+255": "TZS", // Tanzania
  "+258": "MZN", // Mozambique
  "+256": "UGX", // Uganda
  "+250": "RWF", // Rwanda
  "+233": "GHS", // Ghana
  "+260": "ZMW", // Zambia
};

// All mobile money providers — available everywhere, no country restriction
const MOBILE_PROVIDERS = [
  {
    id: "mpesa",
    label: "M-Pesa",
    sub: "Kenya · Tanzania · Mozambique",
    logo: "/logos/mpesa.png",
    accent: "#15803d",
    bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
    border: "#86efac",
    activeBorder: "#16a34a",
    method: "pesapal" as const,
  },
  {
    id: "mtn",
    label: "MTN Money",
    sub: "Uganda · Rwanda · Ghana · Zambia",
    logo: "/logos/mtn.png",
    accent: "#b45309",
    bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
    border: "#fcd34d",
    activeBorder: "#d97706",
    method: "pesapal" as const,
  },
  {
    id: "airtel",
    label: "Airtel Money",
    sub: "Uganda · Kenya · Tanzania · Zambia",
    logo: "/logos/airtel.png",
    accent: "#dc2626",
    bg: "linear-gradient(135deg,#fff1f2,#ffe4e6)",
    border: "#fca5a5",
    activeBorder: "#ef4444",
    method: "pesapal" as const,
  },
] as const;

type ProviderId = typeof MOBILE_PROVIDERS[number]["id"];

// Country dial codes per provider
const PROVIDER_COUNTRIES: Record<ProviderId, Array<{ flag: string; code: string; label: string }>> = {
  mpesa:  [
    { flag: "🇰🇪", code: "+254", label: "Kenya" },
    { flag: "🇹🇿", code: "+255", label: "Tanzania" },
    { flag: "🇲🇿", code: "+258", label: "Mozambique" },
  ],
  mtn:    [
    { flag: "🇺🇬", code: "+256", label: "Uganda" },
    { flag: "🇷🇼", code: "+250", label: "Rwanda" },
    { flag: "🇬🇭", code: "+233", label: "Ghana" },
    { flag: "🇿🇲", code: "+260", label: "Zambia" },
  ],
  airtel: [
    { flag: "🇺🇬", code: "+256", label: "Uganda" },
    { flag: "🇰🇪", code: "+254", label: "Kenya" },
    { flag: "🇹🇿", code: "+255", label: "Tanzania" },
    { flag: "🇿🇲", code: "+260", label: "Zambia" },
  ],
};

function normalizePhone(dialCode: string, raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const code = dialCode.replace("+", "");
  if (digits.startsWith(code)) return "+" + digits;
  if (digits.startsWith("0")) return "+" + code + digits.slice(1);
  return "+" + code + digits;
}

export function PaymentSheet({ open, onClose, onSuccess }: Props) {
  useScrollLock(open);
  const token = getToken();
  const user = getStoredUser();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("mobile");
  const [amount, setAmount] = useState("");

  // Mobile money
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [dialCode, setDialCode] = useState("+254");
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  // Reset dial code and phone when provider changes
  useEffect(() => {
    if (selectedProvider) {
      const countries = PROVIDER_COUNTRIES[selectedProvider];
      setDialCode(countries[0]?.code ?? "+254");
      setPhone("");
      setCountryPickerOpen(false);
    }
  }, [selectedProvider]);

  // Unified payment step (mobile + card)
  const [payStep, setPayStep] = useState<PayStep>("idle");
  const [payError, setPayError] = useState<string | null>(null);
  const [payRef, setPayRef] = useState<string | null>(null);          // PesaPal trackingId
  const [payTabUrl, setPayTabUrl] = useState<string | null>(null);    // PesaPal redirect URL
  const [configured, setConfigured] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const payAmountRef = useRef<number>(0);

  // Circle USDC state
  const [circleInfo, setCircleInfo] = useState<{
    depositAddress: string; chain: string; memo: string; kesRate: number; minUSDC: string; configured: boolean;
  } | null>(null);
  const [circleIntentId, setCircleIntentId] = useState<string | null>(null);
  const [circleAmountUSDC, setCircleAmountUSDC] = useState<string>("");
  const [usdcCopied, setUsdcCopied] = useState(false);
  const [circleConfirming, setCircleConfirming] = useState(false);
  const [circleTxHash, setCircleTxHash] = useState<string | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [trackingTxHash, setTrackingTxHash] = useState<string | null>(null);
  const [circleError, setCircleError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);

  // Fetch Circle info when switching to USDC tab
  useEffect(() => {
    if (tab === "usdc" && !circleInfo && token) {
      fetch("/api/wallet/circle/info", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => { if (!r.ok) throw new Error("fetch failed"); return r.json(); })
        .then(d => setCircleInfo(d))
        .catch(() => {});
    }
  }, [tab, circleInfo, token]);

  useEffect(() => {
    if (!open) resetAll();
  }, [open]);

  function resetAll() {
    setAmount("");
    setSelectedProvider(null);
    setPhone(user?.phone ?? ""); setDialCode("+254"); setCountryPickerOpen(false);
    setPayStep("idle"); setPayRef(null); setPayTabUrl(null); setPayError(null);
    payAmountRef.current = 0;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setCircleIntentId(null); setCircleAmountUSDC(""); setCircleTxHash(null);
    setSuccess(false); setWalletModalOpen(false); setTrackingTxHash(null);
    setCircleError(null);
  }

  function handleSuccess(amt: number) {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPayStep("done");
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["wallet-balance"] });
    setSuccess(true);
    onSuccess(amt);
    import("@/components/confetti-overlay").then(({ showConfetti }) => showConfetti(3200));
    showCenterSuccess({
      title: "Wallet Funded! 💰",
      subtitle: `KES ${amt.toLocaleString("en-KE")} credited to your account`,
    });
    setTimeout(() => { setSuccess(false); onClose(); }, 2200);
  }

  // ─── Mobile Money via PesaPal (M-Pesa STK push / MTN / Airtel USSD) ─────────
  async function handlePesapalMobilePay() {
    const amt = parseFloat(amount);
    if (!amt || amt < 10) return;
    const normalized = normalizePhone(dialCode, phone.trim());
    if (!normalized || !/^\+\d{7,15}$/.test(normalized)) {
      setPayError("Enter a valid phone number for your country."); return;
    }
    payAmountRef.current = amt;
    setPayStep("creating");
    setPayError(null);
    const methodCodeMap: Record<string, string> = { mpesa: "mpesa", mtn: "MTN", airtel: "Airtel" };
    const paymentMethodCode = selectedProvider ? (methodCodeMap[selectedProvider] ?? undefined) : undefined;
    try {
      const r = await fetch("/api/wallet/pesapal/order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, currency: DIAL_CURRENCY[dialCode] ?? "KES", phone: normalized, paymentMethodCode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to create payment order");
      const trackId = d.orderTrackingId as string;
      setPayRef(trackId);
      setConfigured(d.configured !== false);
      // PesaPal triggers the STK push directly to the phone when
      // payment_method + account_number are set — no redirect needed.
      setPayStep("push_sent");
      startPesapalPolling(trackId, amt);
    } catch (err) {
      setPayError((err as Error).message);
      setPayStep("idle");
    }
  }

  // ─── Card via PesaPal (new tab) ──────────────────────────────────────────────
  async function handleCardPay() {
    const amt = parseFloat(amount);
    if (!amt || amt < 100) return;
    payAmountRef.current = amt;
    setPayStep("creating");
    setPayError(null);
    try {
      const r = await fetch("/api/wallet/pesapal/order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, currency: "KES" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to create payment order");
      const trackId = d.orderTrackingId as string;
      setPayRef(trackId);
      setConfigured(d.configured !== false);
      if (d.configured === false) {
        setPayStep("polling");
        startPesapalPolling(trackId, amt);
        return;
      }
      setPayTabUrl(d.redirectUrl);
      window.open(d.redirectUrl, "_blank", "noopener,noreferrer");
      setPayStep("new_tab");
      startPesapalPolling(trackId, amt);
    } catch (err) {
      setPayError((err as Error).message);
      setPayStep("idle");
    }
  }

  function startPesapalPolling(orderTrackingId: string, amt: number) {
    let polls = 0;
    pollRef.current = setInterval(async () => {
      polls++;
      if (polls > 150) {
        clearInterval(pollRef.current!); pollRef.current = null;
        setPayStep("idle");
        setPayError("Payment session expired. Please try again.");
        return;
      }
      try {
        const r = await fetch(`/api/wallet/pesapal/status/${orderTrackingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        if (d.paid) {
          clearInterval(pollRef.current!); pollRef.current = null;
          handleSuccess(amt);
        } else if (d.statusCode === "Failed" || d.statusCode === "Invalid") {
          clearInterval(pollRef.current!); pollRef.current = null;
          setPayStep("idle");
          setPayError("Payment was declined. Please try again.");
        }
      } catch { /* keep polling */ }
    }, 4000);
  }

  // ─── Circle USDC ─────────────────────────────────────────────────────────────
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
        setCircleInfo(prev => ({
          depositAddress: d.depositAddress,
          chain: d.chain ?? prev?.chain ?? "Polygon (MATIC)",
          memo: d.memo ?? prev?.memo ?? "",
          kesRate: d.kesRate ?? prev?.kesRate ?? 130,
          minUSDC: prev?.minUSDC ?? "5.00",
          configured: d.configured ?? prev?.configured ?? false,
        }));
      }
    } catch (e) {
      setCircleError((e as Error).message);
    }
  }

  async function confirmCircle(txHash?: string) {
    if (!circleIntentId) return;
    setCircleConfirming(true);
    setCircleError(null);
    try {
      const r = await fetch("/api/wallet/circle/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ intentId: circleIntentId, amountKes: parseFloat(amount), txHash: txHash ?? circleTxHash ?? undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Not confirmed");
      handleSuccess(parseFloat(amount));
    } catch (e) {
      setCircleError((e as Error).message);
    } finally { setCircleConfirming(false); }
  }

  async function copyUSDC() {
    await navigator.clipboard.writeText(circleInfo?.depositAddress ?? "").catch(() => {});
    setUsdcCopied(true);
    setTimeout(() => setUsdcCopied(false), 2000);
  }

  const amt = parseFloat(amount) || 0;
  const usdcEstimate = circleInfo ? (amt / circleInfo.kesRate).toFixed(2) : "0.00";

  const TABS: { id: Tab; label: string; icon: React.ReactNode; gradient: string }[] = [
    { id: "mobile", label: "Mobile Money", icon: <Smartphone size={14} />, gradient: "linear-gradient(135deg,#15803d,#16a34a)" },
    { id: "card",   label: "Card",         icon: <CreditCard size={14} />, gradient: "linear-gradient(135deg,#1d4ed8,#3b82f6)" },
    { id: "usdc",   label: "USDC",         icon: <CircleLogo size={14} />, gradient: "linear-gradient(135deg,#1652F0,#2D56FA)" },
  ];

  const provider = MOBILE_PROVIDERS.find(p => p.id === selectedProvider) ?? null;

  // Determine if we're showing the checkout step (hide amount input)
  const hidingAmount = payStep === "push_sent" || payStep === "new_tab" || payStep === "polling" || payStep === "done";

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
              {/* Tab selector */}
              <div className="flex gap-1.5 p-1.5 bg-muted/80 rounded-2xl border border-border/60">
                {TABS.map(t => (
                  <button key={t.id}
                    onClick={() => {
                      setTab(t.id);
                      setPayError(null); setCircleError(null);
                      if (payStep !== "idle" && payStep !== "done") {
                        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                        setPayStep("idle");
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      tab === t.id ? "text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={tab === t.id ? { background: t.gradient, boxShadow: "0 4px 14px rgba(0,0,0,0.25)" } : {}}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Amount input — hidden during active payment steps */}
              {!hidingAmount && !circleIntentId && (
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
                        setAmount(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw);
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

              {/* ─── MOBILE MONEY TAB ─────────────────────────────────────────── */}
              {tab === "mobile" && (
                <div className="space-y-4">
                  {payStep === "idle" && (
                    <>
                      {/* Provider grid */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Supported Networks
                        </p>
                        <div className="grid grid-cols-3 gap-2.5">
                          {MOBILE_PROVIDERS.map(p => {
                            const isSelected = selectedProvider === p.id;
                            return (
                              <button
                                key={p.id}
                                onClick={() => setSelectedProvider(isSelected ? null : p.id)}
                                className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all active:scale-95 text-center"
                                style={{
                                  background: isSelected ? p.bg : "var(--muted)",
                                  borderColor: isSelected ? p.activeBorder : "var(--border)",
                                  boxShadow: isSelected ? `0 4px 16px ${p.accent}25` : "none",
                                }}
                              >
                                <div
                                  className="w-14 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                                  style={{ background: isSelected ? "white" : "rgba(255,255,255,0.6)" }}
                                >
                                  <img
                                    src={p.logo}
                                    alt={p.label}
                                    className="w-full h-full object-contain p-1"
                                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                  />
                                </div>
                                <div>
                                  <p className="text-foreground font-bold text-[11px] leading-tight">{p.label}</p>
                                  <p className="text-muted-foreground text-[9px] leading-tight mt-0.5">{p.sub}</p>
                                </div>
                                {isSelected && (
                                  <div
                                    className="w-4 h-4 rounded-full flex items-center justify-center"
                                    style={{ background: p.accent }}
                                  >
                                    <Check size={9} className="text-white" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Phone input — shown when provider selected */}
                      {selectedProvider && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                          className="space-y-1.5"
                        >
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                            {provider?.label} Phone Number
                          </label>
                          <div className="flex gap-2">
                            {/* Country picker */}
                            <div className="relative flex-shrink-0">
                              <button type="button"
                                onClick={() => setCountryPickerOpen(o => !o)}
                                className="h-full flex items-center gap-1.5 px-3 border-2 border-border rounded-2xl text-sm font-semibold text-foreground bg-muted hover:bg-muted/70 transition-colors whitespace-nowrap"
                                style={{ borderColor: countryPickerOpen ? provider?.activeBorder : provider?.border }}
                              >
                                {PROVIDER_COUNTRIES[selectedProvider].find(c => c.code === dialCode)?.flag ?? "🌍"} {dialCode}
                                <ChevronDown size={11} className={`text-muted-foreground transition-transform ${countryPickerOpen ? "rotate-180" : ""}`} />
                              </button>
                              {countryPickerOpen && (
                                <div className="absolute left-0 top-full mt-1 z-30 bg-background border border-border rounded-2xl shadow-xl overflow-hidden min-w-[150px]">
                                  {PROVIDER_COUNTRIES[selectedProvider].map(c => (
                                    <button key={c.code} type="button"
                                      onClick={() => { setDialCode(c.code); setCountryPickerOpen(false); }}
                                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors ${c.code === dialCode ? "bg-primary/10 text-primary font-semibold" : "text-foreground"}`}>
                                      <span className="text-base">{c.flag}</span>
                                      <div>
                                        <p className="font-semibold text-[11px]">{c.label}</p>
                                        <p className="text-muted-foreground text-[10px]">{c.code}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Phone input */}
                            <div className="relative flex-1">
                              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              <input
                                type="tel"
                                inputMode="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="7XXXXXXXX"
                                className="w-full border-2 border-border rounded-2xl pl-9 pr-3 py-3.5 text-foreground font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                                style={{ borderColor: provider?.border }}
                              />
                            </div>
                          </div>
                          <p className="text-muted-foreground text-[10px] pl-1">
                            You'll receive a payment push notification on this number.
                          </p>
                        </motion.div>
                      )}

                      {payError && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{payError}</p>
                        </motion.div>
                      )}

                      <button
                        onClick={() => {
                          if (!selectedProvider) return;
                          handlePesapalMobilePay();
                        }}
                        disabled={!amount || amt < 10 || !selectedProvider}
                        className="w-full text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        style={{
                          background: provider
                            ? `linear-gradient(135deg, ${provider.accent}dd, ${provider.accent})`
                            : "linear-gradient(135deg,#004d1f,#00A651)",
                          boxShadow: provider ? `0 6px 20px ${provider.accent}40` : "0 6px 20px rgba(0,166,81,0.35)",
                        }}
                      >
                        {selectedProvider && provider
                          ? (
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-4 rounded overflow-hidden bg-white/20">
                                <img src={provider.logo} alt="" className="w-full h-full object-contain" />
                              </div>
                              {amt >= 10 ? `Pay ${formatKES(amt)} via ${provider.label}` : "Enter at least KES 10"}
                            </div>
                          )
                          : (
                            <>
                              <Smartphone size={18} />
                              {!selectedProvider ? "Select a network above" : amt >= 10 ? `Pay ${formatKES(amt)}` : "Enter at least KES 10"}
                            </>
                          )
                        }
                      </button>

                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center gap-1 text-muted-foreground/60">
                          <Shield size={10} />
                          <span className="text-[10px]">Secure payment</span>
                        </div>
                        <span className="text-border">·</span>
                        <div className="flex items-center gap-1 text-muted-foreground/60">
                          <Lock size={10} />
                          <span className="text-[10px]">256-bit SSL</span>
                        </div>
                        <span className="text-border">·</span>
                        <div className="flex items-center gap-1 text-muted-foreground/60">
                          <Zap size={10} />
                          <span className="text-[10px]">Instant credit</span>
                        </div>
                      </div>
                    </>
                  )}

                  {payStep === "creating" && (
                    <div className="py-10 flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                        <Loader2 size={28} className="animate-spin text-green-600" />
                      </div>
                      <div className="text-center">
                        <p className="text-foreground font-bold">Sending payment request…</p>
                        <p className="text-muted-foreground text-sm mt-0.5">Please wait a moment</p>
                      </div>
                    </div>
                  )}

                  {/* STK / USSD push sent (M-Pesa, MTN, Airtel) */}
                  {payStep === "push_sent" && (
                    <PushSentView
                      amount={payAmountRef.current}
                      phone={phone}
                      provider={provider?.label ?? "Mobile Money"}
                      logoSrc={provider?.logo}
                      accent={provider?.accent ?? "#15803d"}
                      isUssd={selectedProvider !== "mpesa"}
                      configured={configured}
                      onCancel={() => {
                        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                        setPayStep("idle"); setPayError(null);
                      }}
                    />
                  )}

                  {/* MTN/Airtel — new tab opened, polling */}
                  {payStep === "new_tab" && (
                    <NewTabView
                      amount={payAmountRef.current}
                      redirectUrl={payTabUrl ?? ""}
                      provider={provider?.label ?? "Mobile Money"}
                      logoSrc={provider?.logo}
                      accent={provider?.accent ?? "#15803d"}
                      onCancel={() => {
                        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                        setPayStep("idle"); setPayError(null);
                      }}
                    />
                  )}

                  {/* Demo / polling fallback */}
                  {payStep === "polling" && (
                    <PollingWaiter amount={payAmountRef.current} configured={configured} />
                  )}
                </div>
              )}

              {/* ─── CARD TAB ─────────────────────────────────────────────────── */}
              {tab === "card" && (
                <div className="space-y-4">
                  {payStep === "idle" && (
                    <>
                      {/* Premium card visual */}
                      <div className="relative overflow-hidden rounded-2xl h-40"
                        style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#1d4ed8 100%)", boxShadow: "0 12px 40px rgba(29,78,216,0.5)" }}>
                        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(ellipse at 70% 30%, rgba(147,197,253,0.6) 0%, transparent 60%)" }} />
                        <div className="absolute top-0 right-0 w-40 h-40 rounded-full -translate-y-12 translate-x-12" style={{ background: "rgba(96,165,250,0.15)" }} />
                        <div className="absolute inset-0 opacity-5"
                          style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0px,#fff 1px,transparent 1px,transparent 12px)" }} />
                        <div className="relative flex flex-col h-full justify-between p-5">
                          <div className="flex items-start justify-between">
                            <div className="w-10 h-7 rounded-md" style={{ background: "linear-gradient(135deg,#ca8a04,#fbbf24,#d97706)" }}>
                              <div className="w-full h-full rounded-md opacity-60"
                                style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 3px)" }} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              {["VISA", "MC", "AMEX"].map(b => (
                                <span key={b} className="text-[8px] font-black text-white/50 bg-white/10 px-1.5 py-0.5 rounded border border-white/10">{b}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-white/30 text-[8px] font-semibold uppercase tracking-[0.2em] mb-1">Charge amount</p>
                            <p className="text-white font-black text-2xl tracking-tight">
                              {amt > 0 ? formatKES(amt) : "KES ––.––"}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Lock size={9} className="text-blue-300/60" />
                              <span className="text-blue-200/50 text-[9px] font-semibold uppercase tracking-widest">PCI-DSS · Secured by PesaPal</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "1px solid #bfdbfe" }}>
                        <Shield size={13} className="text-blue-600 flex-shrink-0" />
                        <p className="text-blue-700 text-xs font-medium">3D Secure · End-to-end encrypted · Powered by PesaPal</p>
                        <Lock size={11} className="text-blue-400 ml-auto flex-shrink-0" />
                      </div>

                      {payError && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{payError}</p>
                        </motion.div>
                      )}

                      <button
                        onClick={handleCardPay}
                        disabled={!amount || amt < 100}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25">
                        <CreditCard size={18} />
                        {amt >= 100 ? `Pay ${formatKES(amt)} by Card` : "Enter at least KES 100"}
                      </button>
                    </>
                  )}

                  {payStep === "creating" && (
                    <div className="py-10 flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                        <Loader2 size={28} className="animate-spin text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Opening secure checkout…</p>
                    </div>
                  )}

                  {payStep === "new_tab" && (
                    <NewTabView
                      amount={payAmountRef.current}
                      redirectUrl={payTabUrl ?? ""}
                      provider="Card"
                      accent="#1d4ed8"
                      isCard
                      onCancel={() => {
                        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                        setPayStep("idle"); setPayError(null);
                      }}
                    />
                  )}

                  {payStep === "polling" && (
                    <PollingWaiter amount={payAmountRef.current} configured={configured} />
                  )}
                </div>
              )}

              {/* ─── USDC TAB ─────────────────────────────────────────────────── */}
              {tab === "usdc" && (
                <div className="space-y-4">
                  {!circleIntentId ? (
                    <>
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

                      {circleInfo && (
                        <div className="bg-muted/60 rounded-2xl p-3 space-y-1.5">
                          {[
                            { label: "Network", val: circleInfo.chain },
                            { label: "Min deposit", val: `${circleInfo.minUSDC} USDC` },
                            { label: "KES rate", val: `${circleInfo.kesRate.toFixed(0)} KES / USDC` },
                          ].map(({ label, val }) => (
                            <div key={label} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{label}</span>
                              <span className="font-semibold text-foreground">{val}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {amt >= 500 && (
                        <div className="bg-muted/60 rounded-2xl p-3 flex items-center justify-between">
                          <p className="text-muted-foreground text-xs">You'll send approx.</p>
                          <p className="text-foreground font-bold text-sm">{usdcEstimate} USDC</p>
                        </div>
                      )}

                      {circleError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{circleError}</p>
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
                        onClick={async () => { await createCircleIntent(); setWalletModalOpen(true); }}
                        disabled={!amount || amt < 500}
                        className="w-full border-2 border-blue-300 text-blue-700 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 bg-blue-50">
                        <Wallet size={18} />
                        Connect Wallet (MetaMask / Coinbase / Binance)
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

                      {circleTxHash ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-green-600" />
                            <p className="text-green-700 text-[11px] font-semibold">Transaction submitted via wallet</p>
                          </div>
                          <p className="text-green-600 font-mono text-[10px] break-all">{circleTxHash}</p>
                        </div>
                      ) : !circleInfo?.configured && (
                        <div className="space-y-1.5">
                          <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Transaction Hash (required)</p>
                          <input
                            type="text"
                            placeholder="0x… paste your Polygon tx hash"
                            className="w-full border-2 border-border rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-primary"
                            onChange={e => setCircleTxHash(e.target.value.trim() || null)}
                          />
                        </div>
                      )}

                      {circleError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{circleError}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { setCircleIntentId(null); setCircleAmountUSDC(""); setCircleTxHash(null); }}
                          className="border-2 border-border text-foreground font-semibold py-3 rounded-2xl text-sm active:scale-95">
                          ← Back
                        </button>
                        <button
                          onClick={() => {
                            if (!circleInfo?.configured && circleTxHash) {
                              setTrackingTxHash(circleTxHash);
                            } else {
                              void confirmCircle();
                            }
                          }}
                          disabled={circleConfirming || (!circleInfo?.configured && !circleTxHash)}
                          className="text-white font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg,#1652F0,#2D56FA)" }}>
                          {circleConfirming ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          {circleInfo?.configured ? "I've Sent USDC" : "Track Confirmations"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Security footer */}
              <div className="flex items-center justify-center gap-1.5 pt-1 pb-1">
                <Lock size={9} className="text-muted-foreground/50" />
                <p className="text-[10px] text-muted-foreground/50">256-bit SSL · Mobile Money &amp; Cards by PesaPal · PCI-DSS L1</p>
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
      amountUSDC={circleAmountUSDC || usdcEstimate}
      chain={circleInfo?.chain ?? "Polygon (MATIC)"}
      memo={circleInfo?.memo}
      onConnected={(result) => {
        setWalletModalOpen(false);
        if (result.txHash) {
          setCircleTxHash(result.txHash);
          setTrackingTxHash(result.txHash);
        }
      }}
    />

    <TxConfirmationTracker
      open={!!trackingTxHash}
      txHash={trackingTxHash ?? ""}
      onConfirmed={() => {
        const hash = trackingTxHash;
        setTrackingTxHash(null);
        void confirmCircle(hash ?? undefined);
      }}
      onClose={() => setTrackingTxHash(null)}
    />
    </>
  );
}

// ─── Push sent state (M-Pesa STK push) ────────────────────────────────────────
function PushSentView({
  amount, phone, provider, logoSrc, accent, onCancel, isUssd, configured = true,
}: {
  amount: number; phone: string; provider: string;
  logoSrc?: string; accent: string; onCancel: () => void; isUssd?: boolean; configured?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Demo-mode banner */}
      {!configured && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5 flex items-start gap-2">
          <span className="text-amber-500 text-base flex-shrink-0">⚠️</span>
          <div>
            <p className="text-amber-800 font-semibold text-xs">Demo mode — no real push sent</p>
            <p className="text-amber-700 text-[10px] mt-0.5">
              M-Pesa credentials are not yet configured. Payment will auto-confirm for testing. Add MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET / MPESA_SHORTCODE / MPESA_PASSKEY to enable real STK pushes.
            </p>
          </div>
        </div>
      )}
      <div
        className="relative overflow-hidden rounded-2xl p-5 flex flex-col items-center text-center gap-4"
        style={{ background: `linear-gradient(135deg, ${accent}15, ${accent}08)`, border: `2px solid ${accent}30` }}
      >
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: `${accent}15` }}
          >
            {logoSrc ? (
              <img src={logoSrc} alt={provider} className="w-12 h-10 object-contain" />
            ) : (
              <Smartphone size={36} style={{ color: accent }} />
            )}
          </div>
          {/* Pulse ring */}
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: accent }}
          />
        </div>

        <div>
          <p className="text-foreground font-black text-lg">Check Your Phone!</p>
          <p className="text-muted-foreground text-sm mt-1">
            A payment request for <strong>{formatKES(amount)}</strong> has been sent to
          </p>
          <div className="mt-2 px-4 py-2 rounded-xl inline-flex items-center gap-2" style={{ background: `${accent}15` }}>
            <Phone size={13} style={{ color: accent }} />
            <span className="font-bold text-foreground text-sm">{phone || "your phone"}</span>
          </div>
        </div>

        <div className="bg-background/80 rounded-xl p-3 w-full space-y-1.5">
          {[
            isUssd ? "Check your phone for a USSD prompt" : "Open the push notification on your phone",
            `Enter your ${provider} PIN to confirm`,
            "Your wallet will be credited instantly",
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2.5 text-left">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-black"
                style={{ background: accent }}
              >
                {i + 1}
              </div>
              <p className="text-foreground text-xs font-medium">{step}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" style={{ color: accent }} />
          <span className="text-muted-foreground text-xs">Waiting for confirmation…</span>
        </div>
      </div>

      <button
        onClick={onCancel}
        className="w-full border-2 border-border text-muted-foreground font-semibold py-3 rounded-2xl text-sm active:scale-95 transition-all hover:text-foreground hover:border-foreground/30"
      >
        Cancel
      </button>
    </div>
  );
}

// ─── New tab opened state (MTN / Airtel / Card) ────────────────────────────────
function NewTabView({
  amount, redirectUrl, provider, logoSrc, accent, isCard = false, onCancel,
}: {
  amount: number; redirectUrl: string; provider: string;
  logoSrc?: string; accent: string; isCard?: boolean; onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-2xl p-5 flex flex-col items-center text-center gap-4"
        style={{ background: `linear-gradient(135deg, ${accent}12, ${accent}06)`, border: `2px solid ${accent}25` }}
      >
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: `${accent}15` }}
          >
            {isCard ? (
              <CreditCard size={36} style={{ color: accent }} />
            ) : logoSrc ? (
              <img src={logoSrc} alt={provider} className="w-12 h-10 object-contain" />
            ) : (
              <Smartphone size={36} style={{ color: accent }} />
            )}
          </div>
        </div>

        <div>
          <p className="text-foreground font-black text-lg">
            {isCard ? "Complete Card Payment" : `Complete ${provider} Payment`}
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            A secure checkout for <strong>{formatKES(amount)}</strong> has opened in a new tab.
          </p>
        </div>

        <div className="bg-background/80 rounded-xl p-3 w-full space-y-1.5">
          {(isCard
            ? ["Complete payment in the new tab that opened", "Enter your card details securely", "Your wallet will be credited once confirmed"]
            : [`Complete payment in the new tab that opened`, `Approve via your ${provider} prompt`, "Your wallet will be credited instantly"]
          ).map((step, i) => (
            <div key={i} className="flex items-center gap-2.5 text-left">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-black"
                style={{ background: accent }}
              >
                {i + 1}
              </div>
              <p className="text-foreground text-xs font-medium">{step}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" style={{ color: accent }} />
          <span className="text-muted-foreground text-xs">Waiting for payment confirmation…</span>
        </div>
      </div>

      <a
        href={redirectUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full border-2 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
        style={{ borderColor: accent, color: accent, background: `${accent}08` }}
      >
        <ExternalLink size={14} />
        Re-open Checkout Tab
      </a>

      <button
        onClick={onCancel}
        className="w-full border-2 border-border text-muted-foreground font-semibold py-3 rounded-2xl text-sm active:scale-95 transition-all hover:text-foreground hover:border-foreground/30"
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Polling waiter (demo / fallback) ─────────────────────────────────────────
function PollingWaiter({ amount, configured }: { amount: number; configured: boolean }) {
  return (
    <div className="py-8 flex flex-col items-center gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-green-600" />
      </div>
      <div>
        <p className="text-foreground font-bold">
          {configured ? "Waiting for payment confirmation…" : "Processing demo payment…"}
        </p>
        <p className="text-muted-foreground text-sm mt-0.5">
          {formatKES(amount)} · Verifying your payment
        </p>
      </div>
      {!configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 w-full">
          <p className="text-amber-700 text-xs font-medium">Demo mode — crediting automatically…</p>
        </div>
      )}
    </div>
  );
}
