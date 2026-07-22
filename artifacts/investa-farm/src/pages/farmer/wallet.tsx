import { useScrollLock } from "@/hooks/use-scroll-lock";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getToken, getStoredUser } from "@/lib/auth";
import { ArrowLeft, RefreshCw, TrendingUp, Wallet, ArrowDownLeft, ArrowUpRight, Loader2, CheckCircle2, ExternalLink, ChevronDown, CreditCard, Copy, Check, Phone, Plus, Shield } from "lucide-react";
import { PaymentSheet } from "@/components/payment-sheet";
import { WalletPinGate } from "@/components/wallet-pin-gate";
import { WalletPinSetup } from "@/components/wallet-pin-setup";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { useCurrency, CURRENCIES, type CurrencyCode } from "@/lib/currency";

type WalletData = {
  wallet: { id: number; balance: string; currency: string; updatedAt: string };
  transactions: Array<{
    id: number; type: string; amount: string; balanceAfter: string;
    description: string | null; reference: string | null; status: string; createdAt: string;
  }>;
};

const TX_ICONS: Record<string, { emoji: string; isCredit: boolean }> = {
  deposit:      { emoji: "⬇️",  isCredit: true  },
  withdrawal:   { emoji: "⬆️",  isCredit: false },
  return:       { emoji: "💰",  isCredit: true  },
  fee:          { emoji: "💳",  isCredit: false },
  transfer:     { emoji: "↔️",  isCredit: true  },
  dividend_paid:{ emoji: "🌾",  isCredit: true  },
  wallet_credit:{ emoji: "✅",  isCredit: true  },
};

/** Returns the date of the next Friday (or today if already Friday) */
function getNextFriday(): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun … 5=Fri … 6=Sat
  const daysUntil = day === 5 ? 0 : (5 - day + 7) % 7;
  d.setDate(d.getDate() + daysUntil);
  d.setHours(0, 0, 0, 0);
  return d;
}

const isTodayFriday = new Date().getDay() === 5;

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000];

export default function FarmerWallet() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const user = getStoredUser();
  const qc = useQueryClient();
  const [modal, setModal] = useState<"withdraw" | null>(null);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  useScrollLock(!!modal || addFundsOpen);
  const [amount, setAmount] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  // ── Wallet PIN ──────────────────────────────────────────────────────────────
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pinGateOpen, setPinGateOpen] = useState(false);
  const [pinGateAction, setPinGateAction] = useState<"addFunds" | "withdraw" | null>(null);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch("/api/wallet/pin/status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setHasPin(d.hasPin as boolean); })
      .catch(() => {});
  }, [token]);

  function openWithPin(action: "addFunds" | "withdraw") {
    if (hasPin === false) { setPinGateAction(action); setPinSetupOpen(true); }
    else { setPinGateAction(action); setPinGateOpen(true); }
  }

  function onPinVerified() {
    setPinGateOpen(false);
    if (pinGateAction === "addFunds") setAddFundsOpen(true);
    else if (pinGateAction === "withdraw") { setModal("withdraw"); setAmount(""); }
    setPinGateAction(null);
  }

  function onPinSetupDone() {
    setPinSetupOpen(false);
    setHasPin(true);
    if (pinGateAction) setPinGateOpen(true);
  }

  const { data, isLoading, refetch } = useQuery<WalletData>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load wallet");
      return r.json();
    },
  });

  // Farmer withdraw: provider + country code + phone
  const FARMER_PROVIDERS = [
    { id: "mpesa",  label: "M-Pesa",    sub: "KE · TZ · MZ", accent: "#15803d",
      countries: [{ flag: "🇰🇪", code: "+254", label: "Kenya" }, { flag: "🇹🇿", code: "+255", label: "Tanzania" }, { flag: "🇲🇿", code: "+258", label: "Mozambique" }] },
    { id: "mtn",    label: "MTN Money", sub: "UG · RW · GH",  accent: "#b45309",
      countries: [{ flag: "🇺🇬", code: "+256", label: "Uganda" }, { flag: "🇷🇼", code: "+250", label: "Rwanda" }, { flag: "🇬🇭", code: "+233", label: "Ghana" }] },
    { id: "airtel", label: "Airtel",    sub: "UG · KE · TZ",  accent: "#dc2626",
      countries: [{ flag: "🇺🇬", code: "+256", label: "Uganda" }, { flag: "🇰🇪", code: "+254", label: "Kenya" }, { flag: "🇹🇿", code: "+255", label: "Tanzania" }] },
  ] as const;
  type FarmerProviderId = typeof FARMER_PROVIDERS[number]["id"];
  const [wdProvider, setWdProvider] = useState<FarmerProviderId>("mpesa");
  const [wdDialCode, setWdDialCode] = useState("+254");
  const [wdPhone, setWdPhone] = useState("");
  const [wdCountryOpen, setWdCountryOpen] = useState(false);

  useEffect(() => {
    const p = FARMER_PROVIDERS.find(p => p.id === wdProvider);
    setWdDialCode(p?.countries[0]?.code ?? "+254");
    setWdPhone(""); setWdCountryOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wdProvider]);

  function normalizePhone(dial: string, raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const code = dial.replace("+", "");
    if (digits.startsWith(code)) return "+" + digits;
    if (digits.startsWith("0")) return "+" + code + digits.slice(1);
    return "+" + code + digits;
  }

  const withdrawMutation = useMutation({
    mutationFn: async ({ amt, phone }: { amt: number; phone: string }) => {
      const r = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, phone }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      setModal(null); setAmount(""); setWdPhone("");
      setSuccess("Withdrawal initiated. Funds sent to your mobile money account within 1–2 business days.");
      setTimeout(() => setSuccess(null), 5000);
    },
  });

  const { currency, setCurrency, formatAmount } = useCurrency();
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [stellarCopied, setStellarCopied] = useState(false);

  const { data: stellarAcct } = useQuery<{ accountNumber: string } | null>({
    queryKey: ["stellar-account"],
    queryFn: async () => {
      const r = await fetch("/api/stellar/account", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 300_000,
  });

  const handleCopyStellar = async () => {
    if (!stellarAcct?.accountNumber) return;
    await navigator.clipboard.writeText(stellarAcct.accountNumber).catch(() => {});
    setStellarCopied(true);
    setTimeout(() => setStellarCopied(false), 2000);
  };

  const balance = parseFloat(data?.wallet?.balance ?? "0");
  const txs = data?.transactions ?? [];
  const totalEarned = txs.filter(t => ["deposit", "return", "transfer", "dividend_paid", "wallet_credit"].includes(t.type)).reduce((s, t) => s + parseFloat(t.amount), 0);

  // Set dividend flag so the rate modal can unlock after a payout
  useEffect(() => {
    const hasDividend = txs.some(t => t.type === "dividend_paid");
    if (hasDividend) localStorage.setItem("investa_received_dividend", "1");
  }, [txs]);

  // Show real stellar account number if available, otherwise masked ID-based fallback
  const displayAccountNum = stellarAcct?.accountNumber
    ? stellarAcct.accountNumber
    : `IF-${String(user?.id ?? 0).padStart(8, "0")}`;
  const expiry = new Date(new Date().setFullYear(new Date().getFullYear() + 4));
  const expiryStr = `${String(expiry.getMonth() + 1).padStart(2, "0")}/${String(expiry.getFullYear()).slice(-2)}`;

  return (
    <div className="app-shell pb-20 page-enter">
      <div className="px-4 pt-12 pb-2 flex items-center justify-between">
        <button onClick={() => setLocation("/farmer")} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft size={16} className="text-foreground" />
        </button>
        <h1 className="text-foreground font-bold text-lg">Farm Earnings Wallet</h1>
        <button onClick={() => refetch()} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <RefreshCw size={14} className="text-foreground" />
        </button>
      </div>

      <div className="px-4 pt-2 pb-4">
        {/* ── Grass-green farm bank card ── */}
        <div className="relative rounded-[22px] overflow-hidden select-none"
          style={{
            background: "linear-gradient(135deg, #052e16 0%, #14532d 30%, #166534 60%, #16a34a 100%)",
            minHeight: 210,
          }}>
          {/* Subtle dot pattern */}
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px), radial-gradient(circle at 70% 70%, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          {/* Decorative circles */}
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #4ade80, transparent)" }} />
          {/* Farm decoration */}
          <div className="absolute right-4 bottom-4 opacity-15">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <path d="M28 48V16M28 16c-4-4-8-8-14-10M28 16c4-4 8-8 14-10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M28 24c-3-3-6-5-9-6M28 24c3-3 6-5 9-6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M28 32c-3-2-6-4-9-6M28 32c3-2 6-4 9-6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M14 48h28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>

          <div className="absolute inset-0 p-5 flex flex-col justify-between">
            {/* Top: logo + chip */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <img src={logoSrc} alt="Investa Farm" className="h-6 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
                <div>
                  <p className="text-white/50 text-[8px] font-bold uppercase tracking-widest leading-none">Investa Farm</p>
                  <p className="text-white font-bold text-[11px] leading-none mt-0.5">Farm Earnings Wallet</p>
                </div>
              </div>
              <div className="w-10 h-7 rounded-sm bg-amber-300/80 border border-amber-200/50 flex flex-col justify-center items-center gap-0.5 p-1">
                <div className="w-full h-0.5 bg-amber-600/40 rounded" />
                <div className="w-full h-0.5 bg-amber-600/40 rounded" />
              </div>
            </div>

            {/* Balance centre */}
            <div className="text-center">
              <p className="text-white/60 text-[10px] uppercase tracking-wider mb-0.5">Available Balance</p>
              {isLoading
                ? <div className="h-8 w-36 bg-white/20 rounded-lg animate-pulse mx-auto" />
                : <p className="text-white font-bold text-3xl">{formatAmount(balance)}</p>}
              {currency.code !== "KES" && !isLoading && (
                <p className="text-white/50 text-[10px] mt-0.5">{formatKES(balance)} KES</p>
              )}
            </div>

            {/* Bottom: name + expiry */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/50 text-[8px] uppercase tracking-wider">{user?.name ?? "Farmer"}</p>
                <p className="text-white font-mono text-xs tracking-widest">{displayAccountNum}</p>
              </div>
              <div className="text-right">
                <p className="text-white/50 text-[8px] uppercase tracking-wider">Valid Thru</p>
                <p className="text-white font-mono text-xs">{expiryStr}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="bg-white border border-border rounded-2xl mt-3 grid grid-cols-3 gap-0 overflow-hidden">
          <div className="p-3 text-center border-r border-border">
            <p className="text-green-600 font-bold text-sm">{formatAmount(totalEarned)}</p>
            <p className="text-muted-foreground text-[10px] mt-0.5">Total Received</p>
          </div>
          <div className="p-3 text-center border-r border-border">
            <p className="text-amber-600 font-bold text-sm">{formatAmount(totalEarned * 0.03)}</p>
            <p className="text-muted-foreground text-[10px] mt-0.5">Pension Saved</p>
          </div>
          <div className="p-3 text-center">
            <p className="text-foreground font-bold text-sm">{txs.length}</p>
            <p className="text-muted-foreground text-[10px] mt-0.5">Transactions</p>
          </div>
        </div>

        {/* Pension savings info */}
        {totalEarned > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl mt-3 p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🏦</span>
            </div>
            <div className="flex-1">
              <p className="text-amber-800 font-semibold text-xs">Pension Savings (3% of Revenue)</p>
              <p className="text-amber-700 text-[10px] mt-0.5">
                KES {formatKES(totalEarned * 0.03)} automatically saved for your future from total earnings
              </p>
            </div>
          </div>
        )}

        {/* Interactive Currency Selector */}
        <button
          onClick={() => setCurrencyPickerOpen(s => !s)}
          className="w-full flex items-center gap-2.5 mt-3 bg-white border border-border rounded-2xl px-3 py-2.5 active:scale-[0.98] transition-transform">
          <div className="flex-1 text-left">
            <p className="text-foreground font-semibold text-xs">{currency.code} — {currency.name}</p>
            <p className="text-muted-foreground text-[10px]">Tap to change display currency</p>
          </div>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform flex-shrink-0 ${currencyPickerOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {currencyPickerOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-1">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {CURRENCIES.map((c, i) => (
                  <button key={c.code} onClick={() => { setCurrency(c.code as CurrencyCode); setCurrencyPickerOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/60 ${i > 0 ? "border-t border-border" : ""} ${c.code === currency.code ? "bg-primary/5" : ""}`}>
                    <div className="flex-1">
                      <p className="text-foreground font-semibold text-xs">{c.code} — {c.name}</p>
                      <p className="text-muted-foreground text-[10px]">{c.symbol} {(balance / c.kesPerUnit).toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                    </div>
                    {c.code === currency.code && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stellar / Investa Account Number */}
        <div className="mt-3 rounded-2xl overflow-hidden relative shadow-lg"
          style={{ background: "linear-gradient(135deg, #0a1f11 0%, #0f2d1a 50%, #0a1f11 100%)" }}>
          <div className="absolute top-0 right-0 w-28 h-28 rounded-full bg-green-500/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-green-400/5 translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CreditCard size={13} className="text-green-400" />
                </div>
                <span className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Stellar Account</span>
              </div>
              <span className="text-[9px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded-full border border-green-500/20">Active</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {stellarAcct?.accountNumber ? (
                <>
                  <p className="text-white font-mono text-xs tracking-wider truncate flex-1">{stellarAcct.accountNumber}</p>
                  <button onClick={handleCopyStellar}
                    className="flex-shrink-0 flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-xl px-2.5 py-1.5 transition-all active:scale-95">
                    {stellarCopied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-white/70" />}
                    <span className="text-white/70 text-[10px] font-semibold">{stellarCopied ? "Copied!" : "Copy"}</span>
                  </button>
                </>
              ) : (
                <p className="text-white/30 text-xs font-mono tracking-wider">Loading account…</p>
              )}
            </div>
            <p className="text-white/25 text-[9px] mt-1.5">Secure · Stellar blockchain · Farm earnings</p>
          </div>
        </div>

        {/* PIN setup banner */}
        {hasPin === false && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Shield size={16} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-amber-800 font-semibold text-xs">Secure your wallet</p>
              <p className="text-amber-600 text-[10px]">Set a 4-digit PIN to protect your transactions</p>
            </div>
            <button
              onClick={() => { setPinGateAction(null); setPinSetupOpen(true); }}
              className="flex-shrink-0 bg-amber-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
            >
              Set PIN
            </button>
          </div>
        )}

        {/* Add Funds + Withdraw — horizontal pair */}
        <div className="flex gap-2.5 mt-3">
          {/* Add Funds — PIN-gated */}
          <button
            onClick={() => openWithPin("addFunds")}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl text-white font-bold text-sm active:scale-95 transition-all shadow-lg"
            style={{ background: "linear-gradient(135deg,#15803d,#16a34a)", boxShadow: "0 6px 20px rgba(21,128,61,0.35)" }}
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Plus size={18} />
            </div>
            <span>Add Funds</span>
          </button>

          {/* Withdraw — Friday-gated */}
          {isTodayFriday ? (
            <button
              onClick={() => openWithPin("withdraw")}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all border-2 border-primary/30 bg-primary/5 text-primary"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <ArrowUpRight size={18} />
              </div>
              <span>Withdraw</span>
            </button>
          ) : (
            <button
              disabled
              className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl font-bold text-sm border-2 border-amber-200 bg-amber-50 text-amber-700 cursor-default"
              title={`Next withdrawal: ${getNextFriday().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}`}
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <ArrowUpRight size={18} />
              </div>
              <span>Withdraw</span>
              <span className="text-[9px] font-normal opacity-70">Opens Fridays</span>
            </button>
          )}
        </div>

        {/* Friday notice when withdraw is locked */}
        {!isTodayFriday && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-base">📅</span>
            <p className="text-amber-700 text-xs">
              Next withdrawal: <strong>{getNextFriday().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}</strong>
            </p>
          </div>
        )}
      </div>

      <div className="px-4 space-y-4">
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
              <p className="text-green-700 text-sm font-medium">{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <p className="text-sm font-semibold mb-3">Transaction History</p>
          {isLoading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse mb-2" />)
          ) : txs.length === 0 ? (
            <div className="text-center py-10 bg-muted/40 rounded-2xl">
              <Wallet size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No transactions yet.</p>
              <p className="text-muted-foreground text-xs">Earnings appear here at harvest.</p>
            </div>
          ) : txs.map(tx => {
            const cfg = TX_ICONS[tx.type] ?? { emoji: "💳", isCredit: false };
            return (
              <div key={tx.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-base flex-shrink-0">
                  {cfg.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs font-medium truncate">{tx.description ?? tx.type}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {new Date(tx.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold text-sm ${cfg.isCredit ? "text-green-600" : "text-red-500"}`}>
                    {cfg.isCredit ? "+" : "-"}{formatKES(parseFloat(tx.amount))}
                  </p>
                  <p className="text-muted-foreground text-[10px]">Bal: {formatKES(parseFloat(tx.balanceAfter))}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 space-y-4 border-t-4 border-primary">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground font-bold text-lg">🏦 Withdraw to Mobile Money</h3>
                <button onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">✕</button>
              </div>

              {modal === "withdraw" && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const amt = parseFloat(amount);
                  if (!amt || amt < 100) return;
                  const normalized = normalizePhone(wdDialCode, wdPhone.trim());
                  if (!normalized || !/^\+\d{7,15}$/.test(normalized)) return;
                  withdrawMutation.mutate({ amt, phone: normalized });
                }} className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-amber-700 text-xs">Available: <strong>{formatKES(balance)}</strong>. Funds sent to your mobile money within 1–2 business days.</p>
                  </div>

                  {/* Provider picker */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Mobile Provider</label>
                    <div className="grid grid-cols-3 gap-2">
                      {FARMER_PROVIDERS.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => setWdProvider(p.id)}
                          className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 text-xs font-bold transition-all active:scale-95 ${
                            wdProvider === p.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground"
                          }`}>
                          <span className="text-base">{p.countries[0]?.flag}</span>
                          <span>{p.label}</span>
                          <span className="text-[9px] opacity-70">{p.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Country + Phone */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Phone Number</label>
                    <div className="flex gap-2">
                      {/* Country picker */}
                      <div className="relative flex-shrink-0">
                        <button type="button"
                          onClick={() => setWdCountryOpen(o => !o)}
                          className="h-full flex items-center gap-1.5 px-3 border border-border rounded-xl text-sm font-semibold text-foreground bg-muted hover:bg-muted/70 transition-colors whitespace-nowrap">
                          {FARMER_PROVIDERS.find(p => p.id === wdProvider)?.countries.find(c => c.code === wdDialCode)?.flag ?? "🌍"} {wdDialCode}
                          <ChevronDown size={11} className={`text-muted-foreground transition-transform ${wdCountryOpen ? "rotate-180" : ""}`} />
                        </button>
                        {wdCountryOpen && (
                          <div className="absolute left-0 top-full mt-1 z-30 bg-background border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                            {FARMER_PROVIDERS.find(p => p.id === wdProvider)?.countries.map(c => (
                              <button key={c.code} type="button"
                                onClick={() => { setWdDialCode(c.code); setWdCountryOpen(false); }}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors ${c.code === wdDialCode ? "bg-primary/10 text-primary font-semibold" : "text-foreground"}`}>
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
                        <input type="tel" inputMode="tel" value={wdPhone}
                          onChange={e => setWdPhone(e.target.value)}
                          placeholder="7XXXXXXXX" required
                          className="w-full border border-border rounded-xl pl-9 pr-3 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-primary" />
                      </div>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Amount (KES)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
                      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={100} max={balance} placeholder="e.g. 10000" required
                        className="w-full border border-border rounded-xl pl-12 pr-4 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-primary" />
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {QUICK_AMOUNTS.filter(a => a <= balance).map(a => (
                        <button key={a} type="button" onClick={() => setAmount(String(a))}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${amount === String(a) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}>
                          {formatKES(a)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={withdrawMutation.isPending || !amount || !wdPhone.trim()}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60">
                    {withdrawMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownLeft size={16} />}
                    {withdrawMutation.isPending ? "Processing…" : `Withdraw via ${FARMER_PROVIDERS.find(p => p.id === wdProvider)?.label}`}
                  </button>
                  {withdrawMutation.isError && <p className="text-red-500 text-xs text-center">{(withdrawMutation.error as Error).message}</p>}
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav role="farmer" />

      {/* Add Funds sheet */}
      <PaymentSheet
        open={addFundsOpen}
        onClose={() => setAddFundsOpen(false)}
        onSuccess={() => {
          setAddFundsOpen(false);
          refetch();
          setSuccess("Wallet funded successfully!");
          setTimeout(() => setSuccess(null), 4000);
        }}
      />

      {/* PIN gate — before deposit/withdraw */}
      <WalletPinGate
        open={pinGateOpen}
        onClose={() => { setPinGateOpen(false); setPinGateAction(null); }}
        onSuccess={onPinVerified}
        onForgotPin={() => { setPinGateOpen(false); setPinSetupOpen(true); }}
        title={pinGateAction === "withdraw" ? "Authorise Withdrawal" : "Authorise Deposit"}
      />

      {/* PIN setup */}
      <WalletPinSetup
        open={pinSetupOpen}
        onClose={() => { setPinSetupOpen(false); setPinGateAction(null); }}
        onSuccess={onPinSetupDone}
        isFirstTime={hasPin === false}
      />
    </div>
  );
}
