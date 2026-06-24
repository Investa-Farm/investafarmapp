import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getToken, getStoredUser } from "@/lib/auth";
import { ArrowDownLeft, ArrowUpRight, Plus, TrendingUp, RefreshCw, Loader2, ArrowLeft, CheckCircle2, Wallet, CreditCard, Copy, Check } from "lucide-react";
// CheckCircle2 used in success toast below
import { PaymentSheet } from "@/components/payment-sheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useGetPortfolioSummary } from "@workspace/api-client-react";
import { useCurrency, CURRENCIES } from "@/lib/currency";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

type WalletData = {
  wallet: { id: number; balance: string; currency: string; updatedAt: string };
  transactions: Array<{
    id: number; type: string; amount: string; balanceAfter: string;
    description: string | null; reference: string | null; status: string; createdAt: string;
  }>;
};

const TX_ICONS: Record<string, { emoji: string; color: string }> = {
  deposit:    { emoji: "⬇️", color: "text-green-600" },
  withdrawal: { emoji: "⬆️", color: "text-red-500" },
  investment: { emoji: "📈", color: "text-blue-600" },
  return:     { emoji: "💰", color: "text-green-600" },
  fee:        { emoji: "💳", color: "text-amber-600" },
  transfer:   { emoji: "↔️", color: "text-purple-600" },
};

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000];

export default function InvestorWallet() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const user = getStoredUser();
  const qc = useQueryClient();
  const isFarmer = (user as {role?: string} | null)?.role === "farmer";
  const [modal, setModal] = useState<"deposit" | "withdraw" | "finance" | null>(null);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [stellarCopied, setStellarCopied] = useState(false);
  const { currency, setCurrency, formatAmount } = useCurrency();

  const { data: stellarAcct } = useQuery<{ accountNumber: string } | null>({
    queryKey: ["stellar-account"],
    queryFn: async () => {
      const r = await fetch("/api/stellar/account", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 300_000,
  });

  const { data: escrowData } = useQuery<{ heldTotal: number; releasedTotal: number; escrows: Array<{ id: number; farmId: number | null; amount: string; status: string; description: string | null; releaseAt: string | null; createdAt: string }> }>({
    queryKey: ["wallet-escrow"],
    queryFn: async () => {
      const r = await fetch("/api/wallet/escrow", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { heldTotal: 0, releasedTotal: 0, escrows: [] };
      return r.json();
    },
    staleTime: 60_000,
  });

  type PendingExit = { investmentId: number; farmName: string; cropType: string; shares: number; amount: number; exitType: string; exitDate: string | null };
  const { data: pendingExits } = useQuery<{ pendingTotal: number; count: number; exits: PendingExit[] }>({
    queryKey: ["wallet-pending-exits"],
    queryFn: async () => {
      const r = await fetch("/api/wallet/pending-exits", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { pendingTotal: 0, count: 0, exits: [] };
      return r.json();
    },
    staleTime: 60_000,
    enabled: !isFarmer,
  });

  const handleCopyStellar = async () => {
    if (!stellarAcct?.accountNumber) return;
    await navigator.clipboard.writeText(stellarAcct.accountNumber).catch(() => {});
    setStellarCopied(true);
    setTimeout(() => setStellarCopied(false), 2000);
  };

  const { data, isLoading, refetch } = useQuery<WalletData>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load wallet");
      return r.json();
    },
  });

  const { data: summary } = useGetPortfolioSummary();

  const withdrawMutation = useMutation({
    mutationFn: async ({ amt, phoneNum }: { amt: number; phoneNum: string }) => {
      const r = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, phone: phoneNum }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: (_data: any, vars: any) => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      setModal(null); setAmount(""); setPhone("");
      setSuccess("Withdrawal initiated to M-Pesa.");
      setTimeout(() => setSuccess(null), 4000);
      import("@/components/transaction-notification").then(({ showCompletedTransactionFlow }) => {
        showCompletedTransactionFlow({ type: "withdrawal", amount: vars.amt, label: "Withdrawal", subtitle: "Sending to M-Pesa" });
      });
    },
  });

  const balance = parseFloat(data?.wallet.balance ?? "0");
  const txs = data?.transactions ?? [];

  const cardNumber = `•••• •••• •••• ${String(user?.id ?? 0).padStart(4, "0")}`;
  const expiry = new Date(new Date().setFullYear(new Date().getFullYear() + 4));
  const expiryStr = `${String(expiry.getMonth() + 1).padStart(2, "0")}/${String(expiry.getFullYear()).slice(-2)}`;

  return (
    <div className="app-shell pb-20 page-enter">
      {/* Top nav */}
      <div className="px-4 pt-12 pb-2 flex items-center justify-between">
        <button onClick={() => setLocation("/market")} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft size={16} className="text-foreground" />
        </button>
        <h1 className="text-foreground font-bold text-lg">Investa Wallet</h1>
        <button onClick={() => refetch()} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <RefreshCw size={14} className="text-foreground" />
        </button>
      </div>

      <div className="px-4 pt-2 pb-4">
        {/* ── Grass-green bank card ── */}
        <div className="relative rounded-[22px] overflow-hidden select-none"
          style={{
            background: "linear-gradient(135deg, #052e16 0%, #14532d 30%, #166534 60%, #16a34a 100%)",
            minHeight: 210,
          }}>
          {/* Subtle dot pattern */}
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)", backgroundSize: "22px 22px" }} />
          {/* Large decorative circle */}
          <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #4ade80, transparent)" }} />
          <div className="absolute -left-8 -bottom-8 w-36 h-36 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #86efac, transparent)" }} />
          {/* Wheat / farming decoration */}
          <div className="absolute right-5 bottom-5 opacity-10">
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
              <path d="M30 50V20M30 20c0 0-8-6-12-14M30 20c0 0 8-6 12-14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M30 28c0 0-6-4-9-10M30 28c0 0 6-4 9-10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M30 36c0 0-6-4-9-10M30 36c0 0 6-4 9-10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <div className="absolute inset-0 p-5 flex flex-col justify-between">
            {/* Top row: logo + chip */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <img src={logoSrc} alt="Investa Farm" className="h-6 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
                <div>
                  <p className="text-white/50 text-[8px] font-bold uppercase tracking-widest leading-none">Investa Farm</p>
                  <p className="text-white font-bold text-[11px] leading-none mt-0.5">Investor Wallet</p>
                </div>
              </div>
              <div className="w-10 h-7 rounded-sm bg-amber-300/80 border border-amber-200/50 flex flex-col justify-center items-center gap-0.5 p-1">
                <div className="w-full h-0.5 bg-amber-600/40 rounded" />
                <div className="w-full h-0.5 bg-amber-600/40 rounded" />
              </div>
            </div>

            {/* Balance centre */}
            <div className="text-center">
              <p className="text-white/60 text-[10px] uppercase tracking-wider mb-0.5">Wallet Balance</p>
              {isLoading
                ? <div className="h-8 w-36 bg-white/20 rounded-lg animate-pulse mx-auto" />
                : <motion.p key={balance} initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                    className="text-white font-bold text-3xl">{formatAmount(balance)}</motion.p>}
            </div>

            {/* Bottom row: name + expiry */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/50 text-[8px] uppercase tracking-wider">{user?.name ?? "Cardholder"}</p>
                <p className="text-white font-mono text-xs tracking-widest">{cardNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-white/50 text-[8px] uppercase tracking-wider">Valid Thru</p>
                <p className="text-white font-mono text-xs">{expiryStr}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio stats strip */}
        {summary && (
          <div className="bg-white border border-border rounded-2xl mt-3 p-3">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: "Portfolio", val: formatAmount(summary.totalValue), up: true },
                { label: "Invested", val: formatAmount(summary.totalInvested), up: null },
                { label: "Today P&L", val: formatAmount(summary.todayReturn), up: summary.todayReturn >= 0 },
                { label: "Holdings", val: String(summary.holdings), up: null },
              ].map(({ label, val, up }) => (
                <div key={label} className="text-center">
                  <p className={`font-bold text-xs truncate ${up === null ? "text-foreground" : up ? "text-green-600" : "text-red-500"}`}>{val}</p>
                  <p className="text-muted-foreground text-[9px] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {/* Currency switcher */}
            <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-border overflow-x-auto">
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => setCurrency(c.code)}
                  className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all active:scale-95 ${
                    currency.code === c.code ? "bg-primary border-primary text-white" : "border-border text-muted-foreground"
                  }`}>
                  <span>{c.flag}</span> {c.code}
                </button>
              ))}
            </div>
          </div>
        )}

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
            <p className="text-white/25 text-[9px] mt-1.5">Secure · Stellar blockchain · Custodial</p>
          </div>
        </div>

        {/* Escrow balance strip */}
        {(escrowData?.heldTotal ?? 0) > 0 && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🔒</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-amber-800 text-xs font-semibold">Funds in Escrow</p>
              <p className="text-amber-600 text-[10px]">{escrowData!.escrows.filter(e => e.status === "held").length} active farm investment{escrowData!.escrows.filter(e => e.status === "held").length !== 1 ? "s" : ""} · secured until exit date</p>
            </div>
            <p className="text-amber-800 font-bold text-sm flex-shrink-0">{formatAmount(escrowData!.heldTotal)}</p>
          </div>
        )}

        {/* Pending exit requests */}
        {!isFarmer && (pendingExits?.count ?? 0) > 0 && (
          <div className="mt-2 rounded-2xl border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">⏳</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-blue-800 text-xs font-semibold">Pending Exit Requests</p>
                <p className="text-blue-600 text-[10px]">{pendingExits!.count} investment{pendingExits!.count !== 1 ? "s" : ""} queued for exit · funds released on schedule</p>
              </div>
              <p className="text-blue-800 font-bold text-sm flex-shrink-0">{formatAmount(pendingExits!.pendingTotal)}</p>
            </div>
            <div className="space-y-1.5">
              {pendingExits!.exits.slice(0, 3).map(ex => (
                <div key={ex.investmentId} className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-1.5">
                  <div className="min-w-0">
                    <p className="text-blue-900 text-[11px] font-semibold truncate">{ex.farmName}</p>
                    <p className="text-blue-500 text-[9px]">
                      {ex.shares} shares · {ex.exitType === "wide_season" ? "Wide Season (30–60d)" : "Full Season (~6mo)"}
                      {ex.exitDate ? ` · due ${new Date(ex.exitDate).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}` : ""}
                    </p>
                  </div>
                  <p className="text-blue-800 font-bold text-[11px] flex-shrink-0 ml-2">{formatAmount(ex.amount)}</p>
                </div>
              ))}
              {pendingExits!.exits.length > 3 && (
                <p className="text-blue-500 text-[10px] text-center">+{pendingExits!.exits.length - 3} more</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-3">
          <button onClick={() => { setModal("deposit"); setAmount(""); }}
            className="bg-primary text-white font-bold py-3 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform shadow-md shadow-primary/20">
            <Plus size={16} />
            <span className="text-[10px]">Add Funds</span>
          </button>
          <button onClick={() => { setModal("withdraw"); setAmount(""); }}
            className="bg-muted border border-border text-foreground font-bold py-3 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
            <ArrowUpRight size={16} />
            <span className="text-[10px]">Withdraw</span>
          </button>
          <button onClick={() => isFarmer ? setLocation("/farmer/loan-apply") : setModal("finance")}
            className="bg-blue-50 border border-blue-200 text-blue-700 font-bold py-3 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
            <TrendingUp size={16} />
            <span className="text-[10px]">Finance</span>
          </button>
        </div>
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

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
            <div>
              <p className="text-green-800 font-semibold text-sm">Ready to Invest?</p>
              <p className="text-green-600 text-xs">Use your wallet to buy farm shares instantly</p>
            </div>
          </div>
          <button onClick={() => setLocation("/market/primary")}
            className="w-full bg-primary text-white font-semibold py-2.5 rounded-xl text-sm active:scale-95 transition-transform">
            Browse Primary Market →
          </button>
        </div>

        <div>
          <p className="text-sm font-semibold mb-3">Transaction History</p>
          {isLoading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse mb-2" />)
          ) : txs.length === 0 ? (
            <div className="text-center py-10 bg-muted/40 rounded-2xl">
              <Wallet size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No transactions yet.</p>
              <p className="text-muted-foreground text-xs">Add funds to get started.</p>
            </div>
          ) : txs.map(tx => {
            const cfg = TX_ICONS[tx.type] ?? { emoji: "💳", color: "text-foreground" };
            const isCredit = ["deposit", "return", "transfer"].includes(tx.type);
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
                  <p className={`font-bold text-sm ${isCredit ? "text-green-600" : "text-red-500"}`}>
                    {isCredit ? "+" : "-"}{formatAmount(parseFloat(tx.amount))}
                  </p>
                  <p className="text-muted-foreground text-[10px]">Bal: {formatAmount(parseFloat(tx.balanceAfter))}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deposit — PaymentSheet */}
      <PaymentSheet
        open={modal === "deposit"}
        onClose={() => setModal(null)}
        onSuccess={(amt) => {
          setSuccess(`💰 KES ${amt.toLocaleString()} added to your wallet!`);
          setTimeout(() => setSuccess(null), 5000);
        }}
      />

      {/* Finance modal (investor) */}
      <AnimatePresence>
        {modal === "finance" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
            onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-[430px] bg-background rounded-t-3xl p-6 space-y-4 border-t-4 border-blue-600">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-foreground font-bold text-lg">💼 Finance Options</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">Grow your portfolio faster</p>
                </div>
                <button onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">✕</button>
              </div>

              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center text-white text-lg">🌱</div>
                    <div>
                      <p className="font-semibold text-green-900 text-sm">Farm Share Investing</p>
                      <p className="text-green-600 text-xs">Buy shares in verified Kenyan farms</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-white rounded-xl p-2">
                      <p className="text-green-700 font-bold text-sm">18–32%</p>
                      <p className="text-green-600 text-[10px]">Annual ROI</p>
                    </div>
                    <div className="bg-white rounded-xl p-2">
                      <p className="text-green-700 font-bold text-sm">6–12mo</p>
                      <p className="text-green-600 text-[10px]">Term</p>
                    </div>
                    <div className="bg-white rounded-xl p-2">
                      <p className="text-green-700 font-bold text-sm">KES 5K</p>
                      <p className="text-green-600 text-[10px]">Min. invest</p>
                    </div>
                  </div>
                  <button onClick={() => { setModal(null); setLocation("/market/primary"); }}
                    className="w-full bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm active:scale-95 transition-transform">
                    Browse Primary Market →
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-lg">📊</div>
                    <div>
                      <p className="font-semibold text-blue-900 text-sm">Secondary Market Trading</p>
                      <p className="text-blue-600 text-xs">Trade existing farm shares at market price</p>
                    </div>
                  </div>
                  <button onClick={() => { setModal(null); setLocation("/market/secondary"); }}
                    className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-sm active:scale-95 transition-transform">
                    Open Trading Desk →
                  </button>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white text-lg flex-shrink-0">⚡</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-purple-900 text-sm">Portfolio-Backed Credit</p>
                    <p className="text-purple-600 text-xs">Use farm holdings as collateral — coming soon</p>
                  </div>
                  <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0">Soon</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw modal */}
      <AnimatePresence>
        {modal === "withdraw" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
            onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-[430px] bg-background rounded-t-3xl p-6 space-y-4 border-t-4 border-primary">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground font-bold text-lg">🏦 Withdraw to M-Pesa</h3>
                <button onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">✕</button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const amt = parseFloat(amount);
                if (!amt || amt < 100) return;
                const raw = phone.trim().replace(/\s+/g, "").replace(/^\+254/, "").replace(/^0/, "");
                if (!raw || raw.length < 9) return;
                withdrawMutation.mutate({ amt, phoneNum: "+254" + raw });
              }} className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-amber-700 text-xs">Available: <strong>{formatKES(balance)}</strong>. Funds will be sent to your M-Pesa within 1–2 business days.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">M-Pesa Phone Number</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">+254</span>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="7XXXXXXXX" required
                      className="w-full border border-border rounded-xl pl-14 pr-4 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Amount (KES)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={100} max={balance} placeholder="e.g. 5000" required
                      className="w-full border border-border rounded-xl pl-12 pr-4 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {[1000, 5000, 10000, 25000].filter(a => a <= balance).map(a => (
                      <button key={a} type="button" onClick={() => setAmount(String(a))}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${amount === String(a) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}>
                        {formatKES(a)}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={withdrawMutation.isPending || !amount || !phone.trim()}
                  className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60">
                  {withdrawMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownLeft size={16} />}
                  {withdrawMutation.isPending ? "Processing…" : "Confirm Withdrawal"}
                </button>
                {withdrawMutation.isError && <p className="text-red-500 text-xs text-center">{(withdrawMutation.error as Error).message}</p>}
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav role="investor" />
    </div>
  );
}
