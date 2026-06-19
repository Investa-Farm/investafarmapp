/**
 * PaymentSheet — in-app payment bottom-sheet for Investa Farm
 *
 * Tabs:
 *   M-Pesa  — Paystack STK push → user approves on phone → polls status
 *   Card    — Paystack Inline (access_code) → in-page iframe → verify
 *   USDC    — Circle USDC on-chain deposit address + manual confirm
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Smartphone, CreditCard, Coins, Loader2, CheckCircle2,
  Copy, Check, ExternalLink, RefreshCw, AlertCircle, ChevronRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken, getStoredUser, formatKES } from "@/lib/auth";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000, 25000];
const MPESA_CODES = [
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+250", flag: "🇷🇼", name: "Rwanda" },
];

type Tab = "mpesa" | "card" | "usdc";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

export function PaymentSheet({ open, onClose, onSuccess }: Props) {
  const token = getToken();
  const user = getStoredUser();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("mpesa");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("+254");

  // Paystack card state
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardRef, setCardRef] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Paystack M-Pesa state
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [mpesaRef, setMpesaRef] = useState<string | null>(null);
  const [mpesaStatus, setMpesaStatus] = useState<string>("pending");
  const [mpesaMessage, setMpesaMessage] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Circle USDC state
  const [circleInfo, setCircleInfo] = useState<{
    depositAddress: string; chain: string; memo: string; kesRate: number; minUSDC: string; configured: boolean;
  } | null>(null);
  const [circleIntentId, setCircleIntentId] = useState<string | null>(null);
  const [circleAmountUSDC, setCircleAmountUSDC] = useState<string>("");
  const [usdcCopied, setUsdcCopied] = useState(false);
  const [circleConfirming, setCircleConfirming] = useState(false);

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

  // Stop polling when unmounted or closed
  useEffect(() => {
    if (!open) {
      clearPoll();
      resetAll();
    }
    return () => clearPoll();
  }, [open]);

  function clearPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function resetAll() {
    setAmount(""); setPhone("");
    setCardLoading(false); setCardError(null); setCardRef(null); setVerifying(false);
    setMpesaLoading(false); setMpesaRef(null); setMpesaStatus("pending"); setMpesaMessage("");
    setCircleIntentId(null); setCircleAmountUSDC(""); setSuccess(false);
  }

  function handleSuccess(amt: number) {
    clearPoll();
    qc.invalidateQueries({ queryKey: ["wallet"] });
    setSuccess(true);
    onSuccess(amt);
    setTimeout(() => { setSuccess(false); onClose(); }, 2200);
  }

  // ─── PAYSTACK CARD ──────────────────────────────────────────────────────────
  async function loadPaystackScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).PaystackPop) { resolve(); return; }
      const s = document.createElement("script");
      s.src = "https://js.paystack.co/v1/inline.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Paystack script"));
      document.head.appendChild(s);
    });
  }

  async function handleCardPay() {
    const amt = parseFloat(amount);
    if (!amt || amt < 100) return;
    setCardLoading(true); setCardError(null);
    try {
      const r = await fetch("/api/wallet/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to initialize payment");

      setCardRef(data.reference);

      if (!data.configured || !data.publicKey) {
        // Demo mode: show manual verify button
        setCardLoading(false);
        return;
      }

      await loadPaystackScript();
      const PopAPI = (window as any).PaystackPop;

      if (data.accessCode && PopAPI?.newTransaction) {
        // Paystack Popup v2 — preferred: uses access_code, creates in-page iframe
        PopAPI.newTransaction({
          key: data.publicKey,
          accessCode: data.accessCode,
          onSuccess: async (tx: { reference: string }) => {
            await verifyCard(tx.reference ?? data.reference, data.amountKobo);
          },
          onLoad: () => setCardLoading(false),
          onError: (e: Error) => { setCardError(e.message ?? "Payment error"); setCardLoading(false); },
          onCancel: () => { setCardLoading(false); },
        });
      } else if (PopAPI?.setup) {
        // Paystack Popup v1 — fallback
        const handler = PopAPI.setup({
          key: data.publicKey,
          email: data.email,
          amount: data.amountKobo,
          ref: data.reference,
          currency: "KES",
          callback: async (resp: { reference: string }) => {
            await verifyCard(resp.reference, data.amountKobo);
          },
          onClose: () => { setCardLoading(false); },
        });
        handler.openIframe();
      } else {
        setCardLoading(false);
      }
    } catch (err) {
      setCardError((err as Error).message);
      setCardLoading(false);
    }
  }

  async function verifyCard(ref: string, amtKobo: number) {
    setVerifying(true);
    try {
      const r = await fetch("/api/wallet/paystack/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reference: ref, amount: amtKobo / 100 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Not confirmed");
      handleSuccess(amtKobo / 100);
    } catch (e) {
      setCardError((e as Error).message);
    } finally { setVerifying(false); }
  }

  // ─── PAYSTACK MPESA ─────────────────────────────────────────────────────────
  async function handleMpesaPay() {
    const amt = parseFloat(amount);
    const fullPhone = phoneCode + phone.replace(/^0/, "");
    if (!amt || amt < 10 || !phone) return;
    setMpesaLoading(true); setMpesaMessage(""); setMpesaRef(null);
    try {
      const r = await fetch("/api/wallet/paystack/mpesa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, phone: fullPhone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "M-Pesa failed");
      setMpesaRef(d.reference);
      setMpesaStatus(d.status ?? "pay_offline");
      setMpesaMessage(d.displayText ?? "Check your phone for the M-Pesa prompt");
      // Start polling
      pollRef.current = setInterval(() => pollMpesa(d.reference, amt), 5000);
    } catch (err) {
      setMpesaMessage((err as Error).message);
    } finally { setMpesaLoading(false); }
  }

  async function pollMpesa(ref: string, amt: number) {
    try {
      const r = await fetch(`/api/wallet/paystack/status/${encodeURIComponent(ref)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setMpesaStatus(d.status ?? "pending");
      if (d.paid) {
        clearPoll();
        handleSuccess(d.amount || amt);
      } else if (d.status === "failed" || d.status === "declined") {
        clearPoll();
        setMpesaMessage("Payment declined. Please try again.");
      }
    } catch { /* ignore poll errors */ }
  }

  async function manualMpesaVerify() {
    if (!mpesaRef) return;
    setVerifying(true);
    try {
      const r = await fetch("/api/wallet/paystack/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reference: mpesaRef, amount: parseFloat(amount) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Not confirmed yet");
      handleSuccess(parseFloat(amount));
    } catch (e) {
      setMpesaMessage((e as Error).message);
    } finally { setVerifying(false); }
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
    { id: "card", label: "Card", icon: <CreditCard size={15} />, color: "bg-blue-600" },
    { id: "usdc", label: "USDC", icon: <Coins size={15} />, color: "bg-purple-600" },
  ];

  return (
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

              {/* Amount input (shared) */}
              {!mpesaRef && !circleIntentId && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Amount (KES)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">KES</span>
                    <input
                      type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      min={tab === "usdc" ? 500 : 100} placeholder={tab === "usdc" ? "500" : "1000"}
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

              {/* ─── M-PESA TAB ──────────────────────────────────────────── */}
              {tab === "mpesa" && (
                <div className="space-y-4">
                  {!mpesaRef ? (
                    <>
                      {/* Info banner */}
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-start gap-2.5">
                        <span className="text-xl">📱</span>
                        <div>
                          <p className="text-green-800 font-semibold text-xs">Safaricom M-Pesa STK Push</p>
                          <p className="text-green-600 text-xs mt-0.5">Enter your M-Pesa number — you'll get a payment prompt on your phone to approve.</p>
                        </div>
                      </div>

                      {/* Phone input */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">M-Pesa Phone</label>
                        <div className="flex gap-2">
                          <select value={phoneCode} onChange={e => setPhoneCode(e.target.value)}
                            className="border border-border rounded-xl px-2 py-3 text-sm bg-background text-foreground focus:outline-none focus:border-primary">
                            {MPESA_CODES.map(c => (
                              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                            ))}
                          </select>
                          <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                            placeholder="712345678" maxLength={9}
                            className="flex-1 border border-border rounded-xl px-4 py-3 text-foreground text-sm font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        </div>
                      </div>

                      {mpesaMessage && !mpesaRef && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{mpesaMessage}</p>
                        </div>
                      )}

                      <button
                        onClick={handleMpesaPay}
                        disabled={mpesaLoading || !amount || amt < 10 || (phone.replace(/^0/, "").length < 9)}
                        className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-green-600/20">
                        {mpesaLoading ? <Loader2 size={18} className="animate-spin" /> : <Smartphone size={18} />}
                        {mpesaLoading ? "Sending STK Push…" : `Pay ${formatKES(amt)} via M-Pesa`}
                      </button>
                    </>
                  ) : (
                    /* STK Push sent — waiting for user to approve */
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                          <span className="text-3xl">📱</span>
                        </div>
                        <div>
                          <p className="text-green-800 font-bold text-base">Check Your Phone</p>
                          <p className="text-green-600 text-sm mt-1">{mpesaMessage || "An M-Pesa prompt has been sent to your phone"}</p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          {["pending", "send_otp", "pay_offline"].includes(mpesaStatus) ? (
                            <><Loader2 size={14} className="animate-spin text-green-600" /><span className="text-green-600 text-xs font-semibold">Awaiting payment…</span></>
                          ) : mpesaStatus === "success" ? (
                            <><CheckCircle2 size={14} className="text-green-600" /><span className="text-green-600 text-xs font-semibold">Payment received!</span></>
                          ) : (
                            <><AlertCircle size={14} className="text-red-500" /><span className="text-red-600 text-xs font-semibold">Payment failed</span></>
                          )}
                        </div>
                        <div className="bg-white/60 rounded-xl p-2">
                          <p className="text-muted-foreground text-[10px] font-mono">{mpesaRef?.slice(0, 24)}…</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { clearPoll(); setMpesaRef(null); setMpesaMessage(""); }}
                          className="border border-border text-foreground font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 active:scale-95">
                          <RefreshCw size={14} /> Try Again
                        </button>
                        <button onClick={manualMpesaVerify} disabled={verifying}
                          className="bg-primary text-white font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60">
                          {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          I've Paid
                        </button>
                      </div>

                      <p className="text-center text-muted-foreground text-[11px]">Auto-confirms in 30–60 seconds · No action needed if you approved the prompt</p>
                    </div>
                  )}
                </div>
              )}

              {/* ─── CARD TAB ──────────────────────────────────────────────── */}
              {tab === "card" && (
                <div className="space-y-4">
                  {!cardRef ? (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-2.5">
                        <span className="text-xl">💳</span>
                        <div>
                          <p className="text-blue-800 font-semibold text-xs">Visa, Mastercard & Bank Transfer</p>
                          <p className="text-blue-600 text-xs mt-0.5">Secure checkout powered by Paystack. A payment window will open in-app.</p>
                        </div>
                      </div>

                      {cardError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{cardError}</p>
                        </div>
                      )}

                      <button
                        onClick={handleCardPay}
                        disabled={cardLoading || !amount || amt < 100}
                        className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20">
                        {cardLoading ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                        {cardLoading ? "Opening Paystack…" : `Pay ${formatKES(amt)}`}
                      </button>

                      {/* Payment method logos */}
                      <div className="flex items-center justify-center gap-3 pt-1">
                        {["VISA", "MC", "M-Pesa", "Bank"].map(m => (
                          <span key={m} className="text-[9px] font-bold bg-muted border border-border px-2 py-1 rounded text-muted-foreground">{m}</span>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* card ref set but popup not opened (no public key configured) */
                    <div className="space-y-4">
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                          <AlertCircle size={22} className="text-amber-600" />
                        </div>
                        <p className="text-amber-800 font-bold text-sm">Paystack not configured</p>
                        <p className="text-amber-600 text-xs">Add your PAYSTACK_PUBLIC_KEY and PAYSTACK_SECRET_KEY in the environment secrets to enable card payments.</p>
                      </div>
                      <div className="bg-muted/60 rounded-xl px-4 py-2 flex items-center justify-between">
                        <p className="text-muted-foreground text-xs">Reference</p>
                        <p className="text-foreground text-xs font-mono">{cardRef.slice(0, 22)}…</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { setCardRef(null); setCardError(null); }}
                          className="border border-border text-foreground font-semibold py-3 rounded-2xl text-sm active:scale-95">
                          ← Back
                        </button>
                        <button onClick={() => verifyCard(cardRef, amt * 100)} disabled={verifying}
                          className="bg-primary text-white font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60">
                          {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          Verify
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
                <p className="text-[10px] text-muted-foreground/60">256-bit SSL · Paystack PCI-DSS · Circle regulated</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
