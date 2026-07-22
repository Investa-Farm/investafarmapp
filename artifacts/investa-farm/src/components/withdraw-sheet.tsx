/**
 * WithdrawSheet — full withdrawal bottom-sheet for Investa Farm
 *
 * Tabs:
 *   Mobile Money — M-Pesa / MTN / Airtel with country code picker
 *   Card         — cardholder name + last-4 card number
 *   USDC         — Polygon wallet address
 */
import { useState, useEffect } from "react";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Smartphone, CreditCard, Loader2, CheckCircle2,
  AlertCircle, Phone, ChevronDown, Lock, Shield, ArrowUpRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken, getStoredUser, formatKES } from "@/lib/auth";
import { nonceHeaders } from "@/lib/nonce";
import { showCenterSuccess } from "@/components/center-success-modal";

// ── Shared constants ─────────────────────────────────────────────────────────

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
  },
] as const;

type MobileProviderId = typeof MOBILE_PROVIDERS[number]["id"];

const PROVIDER_COUNTRIES: Record<MobileProviderId, Array<{ flag: string; code: string; label: string }>> = {
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

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];

const FEE_RATE = 0.005;
const FEE_CAP = 260;

function calcFee(amount: number): number {
  return Math.min(Math.round(amount * FEE_RATE * 100) / 100, FEE_CAP);
}

function normalizePhone(dialCode: string, raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const code = dialCode.replace("+", "");
  if (digits.startsWith(code)) return "+" + digits;
  if (digits.startsWith("0")) return "+" + code + digits.slice(1);
  return "+" + code + digits;
}

// ── Component ─────────────────────────────────────────────────────────────────

type Tab = "mobile" | "card" | "usdc";
type Step = "idle" | "processing" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  balance: number;
}

export function WithdrawSheet({ open, onClose, balance }: Props) {
  useScrollLock(open);
  const token = getToken();
  const user = getStoredUser();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("mobile");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Mobile Money
  const [selectedProvider, setSelectedProvider] = useState<MobileProviderId | null>(null);
  const [phone, setPhone] = useState("");
  const [dialCode, setDialCode] = useState("+254");
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  // Card
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");

  // USDC
  const [walletAddress, setWalletAddress] = useState("");

  useEffect(() => {
    if (!open) {
      setAmount(""); setStep("idle"); setError(null); setSuccess(false);
      setSelectedProvider(null); setPhone(""); setDialCode("+254"); setCountryPickerOpen(false);
      setCardholderName(""); setCardNumber(""); setWalletAddress(""); setTab("mobile");
    }
  }, [open]);

  useEffect(() => {
    if (selectedProvider) {
      const countries = PROVIDER_COUNTRIES[selectedProvider];
      setDialCode(countries[0]?.code ?? "+254");
      setPhone("");
      setCountryPickerOpen(false);
    }
  }, [selectedProvider]);

  const amt = parseFloat(amount) || 0;
  const fee = amt > 0 ? calcFee(amt) : 0;
  const youReceive = Math.max(0, amt - fee);
  const sufficient = balance >= amt + fee;

  function handleSuccess(a: number) {
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["wallet-balance"] });
    setSuccess(true); setStep("done");
    showCenterSuccess({
      title: "Withdrawal Initiated ⬆️",
      subtitle: `KES ${a.toLocaleString("en-KE")} sending to your account`,
    });
    setTimeout(() => { setSuccess(false); onClose(); }, 2400);
  }

  // ── Mobile Money ────────────────────────────────────────────────────────────
  async function handleMobileWithdraw() {
    if (!selectedProvider) { setError("Select a provider."); return; }
    const a = parseFloat(amount);
    if (!a || a < 100) { setError("Minimum withdrawal is KES 100."); return; }
    if (!sufficient) { setError(`Insufficient balance. Need KES ${(a + fee).toLocaleString()}.`); return; }
    const normalized = normalizePhone(dialCode, phone.trim());
    if (!normalized || !/^\+\d{7,15}$/.test(normalized)) {
      setError("Enter a valid phone number for your country."); return;
    }
    setStep("processing"); setError(null);
    try {
      const r = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...nonceHeaders() },
        body: JSON.stringify({ amount: a, phone: normalized }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Withdrawal failed");
      handleSuccess(a);
    } catch (e) {
      setError((e as Error).message); setStep("idle");
    }
  }

  // ── Card ────────────────────────────────────────────────────────────────────
  async function handleCardWithdraw() {
    const a = parseFloat(amount);
    if (!a || a < 100) { setError("Minimum withdrawal is KES 100."); return; }
    if (!cardholderName.trim()) { setError("Enter the cardholder name."); return; }
    if (!cardNumber.trim() || cardNumber.replace(/\D/g, "").length < 4) {
      setError("Enter the last 4 digits of your card number."); return;
    }
    if (!sufficient) { setError(`Insufficient balance. Need KES ${(a + fee).toLocaleString()}.`); return; }
    setStep("processing"); setError(null);
    try {
      const r = await fetch("/api/wallet/withdraw/card", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...nonceHeaders() },
        body: JSON.stringify({ amount: a, cardholderName: cardholderName.trim(), cardNumber: cardNumber.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Card withdrawal failed");
      handleSuccess(a);
    } catch (e) {
      setError((e as Error).message); setStep("idle");
    }
  }

  // ── USDC ────────────────────────────────────────────────────────────────────
  async function handleUsdcWithdraw() {
    const a = parseFloat(amount);
    if (!a || a < 500) { setError("Minimum USDC withdrawal is KES 500."); return; }
    if (!walletAddress.startsWith("0x") || walletAddress.length < 42) {
      setError("Enter a valid Polygon wallet address (starts with 0x, 42 chars)."); return;
    }
    if (!sufficient) { setError(`Insufficient balance. Need KES ${(a + fee).toLocaleString()}.`); return; }
    setStep("processing"); setError(null);
    try {
      const r = await fetch("/api/wallet/withdraw/usdc", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...nonceHeaders() },
        body: JSON.stringify({ amount: a, walletAddress: walletAddress.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "USDC withdrawal failed");
      handleSuccess(a);
    } catch (e) {
      setError((e as Error).message); setStep("idle");
    }
  }

  const provider = MOBILE_PROVIDERS.find(p => p.id === selectedProvider) ?? null;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "mobile", label: "Mobile Money", icon: <Smartphone size={14} /> },
    { id: "card",   label: "Card",         icon: <CreditCard size={14} /> },
    { id: "usdc",   label: "USDC",         icon: <span className="font-black text-[11px]">₿</span> },
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
                <h3 className="font-bold text-lg text-foreground">Withdraw Funds</h3>
                <p className="text-muted-foreground text-xs">Balance: {formatKES(balance)}</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                <X size={15} className="text-foreground" />
              </button>
            </div>

            {/* Success overlay */}
            <AnimatePresence>
              {success && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/95">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle2 size={40} className="text-green-600" />
                  </div>
                  <p className="text-foreground font-bold text-xl mb-1">Withdrawal Initiated!</p>
                  <p className="text-muted-foreground text-sm">Processing 1–2 business days</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-y-auto px-5 pb-8 space-y-4 pt-4">
              {/* Tab selector */}
              <div className="flex gap-1.5 p-1.5 bg-muted/80 rounded-2xl border border-border/60">
                {TABS.map(t => (
                  <button key={t.id}
                    onClick={() => { setTab(t.id); setError(null); setStep("idle"); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      tab === t.id
                        ? "bg-primary text-white shadow-md"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Amount — shown on all tabs when idle */}
              {step === "idle" && (
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
                        setError(null);
                      }}
                      placeholder={tab === "usdc" ? "500" : "1000"}
                      className="w-full border-2 border-border rounded-2xl pl-14 pr-4 py-4 text-foreground font-bold text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                    />
                  </div>
                  {/* Quick amounts */}
                  <div className="flex gap-2 mt-2.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                    {QUICK_AMOUNTS.filter(a => a <= balance).map(a => (
                      <button key={a} type="button" onClick={() => setAmount(String(a))}
                        className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95 ${
                          amount === String(a) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}>
                        {formatKES(a)}
                      </button>
                    ))}
                  </div>

                  {/* Fee breakdown */}
                  {amt >= 100 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-2.5 bg-muted/60 rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Withdrawal amount</span>
                        <span className="font-semibold text-foreground">{formatKES(amt)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Fee (0.5%, max KES 260)</span>
                        <span className="font-semibold text-red-500">−{formatKES(fee)}</span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-border pt-1.5">
                        <span className="text-muted-foreground font-semibold">You receive</span>
                        <span className="font-bold text-green-600">{formatKES(youReceive)}</span>
                      </div>
                      {!sufficient && (
                        <p className="text-red-500 text-[10px]">⚠ Insufficient balance (need {formatKES(amt + fee)}, have {formatKES(balance)})</p>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── MOBILE MONEY TAB ─────────────────────────────────────────── */}
              {tab === "mobile" && (
                <div className="space-y-4">
                  {step === "idle" && (
                    <>
                      {/* Provider picker */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Choose Provider</p>
                        <div className="grid grid-cols-3 gap-2.5">
                          {MOBILE_PROVIDERS.map(p => {
                            const isSelected = selectedProvider === p.id;
                            return (
                              <button key={p.id}
                                onClick={() => setSelectedProvider(isSelected ? null : p.id)}
                                className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all active:scale-95 text-center"
                                style={{
                                  background: isSelected ? p.bg : "var(--muted)",
                                  borderColor: isSelected ? p.activeBorder : "var(--border)",
                                  boxShadow: isSelected ? `0 4px 16px ${p.accent}25` : "none",
                                }}>
                                <div className="w-14 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                                  style={{ background: isSelected ? "white" : "rgba(255,255,255,0.6)" }}>
                                  <img src={p.logo} alt={p.label} className="w-full h-full object-contain p-1"
                                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                </div>
                                <div>
                                  <p className="text-foreground font-bold text-[11px] leading-tight">{p.label}</p>
                                  <p className="text-muted-foreground text-[9px] leading-tight mt-0.5">{p.sub}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Country + phone */}
                      {selectedProvider && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                            {provider?.label} Number
                          </label>
                          <div className="flex gap-2">
                            {/* Country picker */}
                            <div className="relative">
                              <button type="button"
                                onClick={() => setCountryPickerOpen(o => !o)}
                                className="h-full flex items-center gap-1.5 px-3 border-2 border-border rounded-xl text-sm font-semibold text-foreground bg-muted hover:bg-muted/70 transition-colors whitespace-nowrap"
                              >
                                {PROVIDER_COUNTRIES[selectedProvider].find(c => c.code === dialCode)?.flag ?? "🌍"} {dialCode}
                                <ChevronDown size={12} className={`text-muted-foreground transition-transform ${countryPickerOpen ? "rotate-180" : ""}`} />
                              </button>
                              {countryPickerOpen && (
                                <div className="absolute left-0 top-full mt-1 z-20 bg-background border border-border rounded-2xl shadow-xl overflow-hidden min-w-[160px]">
                                  {PROVIDER_COUNTRIES[selectedProvider].map(c => (
                                    <button key={c.code} type="button"
                                      onClick={() => { setDialCode(c.code); setCountryPickerOpen(false); }}
                                      className={`w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-muted transition-colors ${c.code === dialCode ? "bg-primary/10 text-primary font-semibold" : "text-foreground"}`}>
                                      <span className="text-base">{c.flag}</span>
                                      <div>
                                        <p className="font-semibold text-xs">{c.label}</p>
                                        <p className="text-muted-foreground text-[10px]">{c.code}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Phone input */}
                            <div className="relative flex-1">
                              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              <input type="tel" inputMode="tel" value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="7XXXXXXXX"
                                className="w-full border-2 border-border rounded-xl pl-9 pr-3 py-3 text-foreground font-semibold text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                              />
                            </div>
                          </div>
                          <p className="text-muted-foreground text-[10px] pl-1">
                            Funds will be sent to this number within 1–2 business days.
                          </p>
                        </motion.div>
                      )}

                      {error && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{error}</p>
                        </motion.div>
                      )}

                      <button
                        onClick={handleMobileWithdraw}
                        disabled={!amount || amt < 100 || !selectedProvider}
                        className="w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg"
                        style={{
                          background: provider
                            ? `linear-gradient(135deg, ${provider.accent}dd, ${provider.accent})`
                            : "linear-gradient(135deg,#16a34a,#15803d)",
                        }}
                      >
                        <ArrowUpRight size={18} />
                        {!selectedProvider
                          ? "Select a provider above"
                          : amt >= 100
                          ? `Withdraw ${formatKES(amt)} via ${provider?.label}`
                          : "Enter at least KES 100"}
                      </button>

                      <SecurityFooter />
                    </>
                  )}
                  {step === "processing" && <ProcessingView />}
                </div>
              )}

              {/* ── CARD TAB ───────────────────────────────────────────────── */}
              {tab === "card" && (
                <div className="space-y-4">
                  {step === "idle" && (
                    <>
                      {/* Premium card visual */}
                      <div className="relative overflow-hidden rounded-2xl h-40"
                        style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#1d4ed8 100%)", boxShadow: "0 12px 40px rgba(29,78,216,0.45)" }}>
                        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(ellipse at 70% 30%, rgba(147,197,253,0.6) 0%, transparent 60%)" }} />
                        <div className="absolute top-0 right-0 w-40 h-40 rounded-full -translate-y-12 translate-x-12" style={{ background: "rgba(96,165,250,0.15)" }} />
                        <div className="absolute inset-0 opacity-5"
                          style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0px,#fff 1px,transparent 1px,transparent 12px)" }} />
                        <div className="relative flex flex-col h-full justify-between p-5">
                          <div className="flex items-start justify-between">
                            {/* Chip */}
                            <div className="w-9 h-6 rounded-md" style={{ background: "linear-gradient(135deg,#ca8a04,#fbbf24,#d97706)" }}>
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
                            <p className="text-white/30 text-[8px] font-semibold uppercase tracking-[0.2em] mb-1">Withdrawal amount</p>
                            <p className="text-white font-black text-2xl tracking-tight">
                              {amt > 0 ? formatKES(amt) : "KES ––.––"}
                            </p>
                            {cardholderName && (
                              <p className="text-blue-200/70 text-[11px] font-semibold mt-1 uppercase tracking-wide truncate">{cardholderName}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              <Lock size={9} className="text-blue-300/60" />
                              <span className="text-blue-200/50 text-[9px] font-semibold uppercase tracking-widest">PCI-DSS · Secured</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Security badge */}
                      <div className="flex items-center gap-2 rounded-xl p-3"
                        style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "1px solid #bfdbfe" }}>
                        <Shield size={13} className="text-blue-600 flex-shrink-0" />
                        <p className="text-blue-700 text-xs font-medium">2–5 business days · 0.5% processing fee · End-to-end encrypted</p>
                        <Lock size={11} className="text-blue-400 ml-auto flex-shrink-0" />
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Cardholder Name</label>
                          <input
                            type="text" value={cardholderName}
                            onChange={e => setCardholderName(e.target.value)}
                            placeholder="Full name on card"
                            className="w-full border-2 border-border rounded-2xl px-4 py-3 text-foreground font-semibold text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Last 4 Digits of Card</label>
                          <input
                            type="text" inputMode="numeric" value={cardNumber}
                            onChange={e => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            placeholder="e.g. 4242"
                            className="w-full border-2 border-border rounded-2xl px-4 py-3 text-foreground font-bold text-lg tracking-[0.5em] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors text-center"
                          />
                        </div>
                      </div>

                      {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{error}</p>
                        </div>
                      )}
                      <button
                        onClick={handleCardWithdraw}
                        disabled={!amount || amt < 100 || !cardholderName.trim() || cardNumber.length < 4}
                        className="w-full text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/25"
                        style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)" }}>
                        <CreditCard size={18} />
                        {amt >= 100 ? `Withdraw ${formatKES(amt)} to Card` : "Enter at least KES 100"}
                      </button>
                      <SecurityFooter />
                    </>
                  )}
                  {step === "processing" && <ProcessingView />}
                </div>
              )}

              {/* ── USDC TAB ───────────────────────────────────────────────── */}
              {tab === "usdc" && (
                <div className="space-y-4">
                  {step === "idle" && (
                    <>
                      <div className="rounded-2xl p-4"
                        style={{ background: "linear-gradient(135deg,#0a1628,#0d3085,#1652F0)", boxShadow: "0 10px 36px rgba(22,82,240,0.35)" }}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                            <span className="text-xl">🪙</span>
                          </div>
                          <div>
                            <p className="text-white font-black text-sm">USDC Withdrawal</p>
                            <p className="text-blue-200/80 text-[11px]">Polygon (MATIC) · Usually within 30 min</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Your Polygon Wallet Address</label>
                        <input type="text" value={walletAddress}
                          onChange={e => setWalletAddress(e.target.value.trim())}
                          placeholder="0x… (42 characters)"
                          className="w-full border-2 border-border rounded-2xl px-4 py-3 text-foreground font-mono text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                        />
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                        <AlertCircle size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-amber-700 text-xs">Only send to a Polygon (MATIC) wallet. Wrong network = permanent loss.</p>
                      </div>
                      {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                          <p className="text-red-700 text-xs">{error}</p>
                        </div>
                      )}
                      <button
                        onClick={handleUsdcWithdraw}
                        disabled={!amount || amt < 500 || walletAddress.length < 42}
                        className="w-full text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg"
                        style={{ background: "linear-gradient(135deg,#1652F0,#2D56FA)" }}>
                        <ArrowUpRight size={18} />
                        {amt >= 500 ? `Withdraw ${formatKES(amt)} as USDC` : "Enter at least KES 500"}
                      </button>
                      <SecurityFooter />
                    </>
                  )}
                  {step === "processing" && <ProcessingView />}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                <Lock size={9} className="text-muted-foreground/50" />
                <p className="text-[10px] text-muted-foreground/50">256-bit SSL · 0.5% fee (max KES 260) · 1–5 business days</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProcessingView() {
  return (
    <div className="py-10 flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-green-600" />
      </div>
      <div className="text-center">
        <p className="text-foreground font-bold">Processing withdrawal…</p>
        <p className="text-muted-foreground text-sm mt-0.5">Please wait</p>
      </div>
    </div>
  );
}

function SecurityFooter() {
  return (
    <div className="flex items-center justify-center gap-3 pt-1">
      <div className="flex items-center gap-1 text-muted-foreground/60">
        <Shield size={10} />
        <span className="text-[10px]">Secure</span>
      </div>
      <span className="text-border">·</span>
      <div className="flex items-center gap-1 text-muted-foreground/60">
        <Lock size={10} />
        <span className="text-[10px]">256-bit SSL</span>
      </div>
    </div>
  );
}
