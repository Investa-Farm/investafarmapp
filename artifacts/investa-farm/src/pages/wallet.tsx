import { useState } from "react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getToken, getStoredUser } from "@/lib/auth";
import { ArrowDownLeft, ArrowUpRight, Plus, TrendingUp, RefreshCw, Loader2, ArrowLeft, CheckCircle2, ExternalLink, Wallet } from "lucide-react";
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
  const [modal, setModal] = useState<"deposit" | "withdraw" | "paystack" | null>(null);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [paystackRef, setPaystackRef] = useState<string | null>(null);
  const [paystackVerifying, setPaystackVerifying] = useState(false);
  const { currency, setCurrency, formatAmount } = useCurrency();

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      setModal(null); setAmount(""); setPhone("");
      setSuccess("Withdrawal initiated to M-Pesa.");
      setTimeout(() => setSuccess(null), 4000);
    },
  });

  const initPaystack = useMutation({
    mutationFn: async (amt: number) => {
      const r = await fetch("/api/wallet/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: (data) => {
      setPaystackRef(data.reference);
      window.open(data.authorizationUrl, "_blank", "width=600,height=700");
    },
  });

  const verifyPaystack = async () => {
    if (!paystackRef) return;
    setPaystackVerifying(true);
    try {
      const r = await fetch("/api/wallet/paystack/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reference: paystackRef }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Not confirmed yet");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      setModal(null); setAmount(""); setPaystackRef(null);
      setSuccess("Payment confirmed! Funds added to your wallet.");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setPaystackVerifying(false);
    }
  };

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

        <div className="grid grid-cols-2 gap-3 mt-3">
          <button onClick={() => { setModal("paystack"); setAmount(""); }}
            className="bg-primary text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md shadow-primary/20">
            <Plus size={16} /> Add Funds
          </button>
          <button onClick={() => { setModal("withdraw"); setAmount(""); }}
            className="bg-muted border border-border text-foreground font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <ArrowUpRight size={16} /> Withdraw
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

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            onClick={(e) => { if (e.target === e.currentTarget) { setModal(null); setPaystackRef(null); } }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 space-y-4 border-t-4 border-primary">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground font-bold text-lg">
                  {modal === "paystack" ? "💳 Add Funds via Paystack" : "🏦 Withdraw to M-Pesa"}
                </h3>
                <button onClick={() => { setModal(null); setPaystackRef(null); }} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">✕</button>
              </div>

              {modal === "paystack" && !paystackRef && (
                <>
                  {initPaystack.isError ? (
                    <div className="space-y-3">
                      <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                        <p className="text-red-700 font-semibold text-sm">Payment Gateway Unavailable</p>
                        <p className="text-red-600 text-xs mt-1 leading-relaxed">
                          {(initPaystack.error as Error).message}
                        </p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <p className="text-amber-800 font-semibold text-sm mb-1">💡 Alternative Options</p>
                        <ul className="text-amber-700 text-xs space-y-1.5">
                          <li>• M-Pesa send money: <strong>0700 000 000</strong> — acc: <strong>InvestaFarm</strong></li>
                          <li>• Email receipt to: <strong>support@investafarm.co.ke</strong></li>
                        </ul>
                      </div>
                      <button onClick={() => initPaystack.reset()} className="w-full border border-border text-foreground font-semibold py-3 rounded-xl text-sm active:scale-95">↩ Try Again</button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                        <p className="text-primary text-xs">Pay securely via <strong>Paystack</strong> — M-Pesa, Visa, Mastercard, or bank transfer. Funds credited instantly.</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Amount (KES)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
                          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={100} placeholder="e.g. 5000" required
                            className="w-full border border-border rounded-xl pl-12 pr-4 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-primary" />
                        </div>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {QUICK_AMOUNTS.map(a => (
                            <button key={a} type="button" onClick={() => setAmount(String(a))}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${amount === String(a) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}>
                              {formatKES(a)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => initPaystack.mutate(parseFloat(amount))}
                        disabled={initPaystack.isPending || !amount || parseFloat(amount) < 100}
                        className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
                        {initPaystack.isPending ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                        {initPaystack.isPending ? "Opening Paystack…" : "Pay with Paystack"}
                      </button>
                    </>
                  )}
                </>
              )}

              {modal === "paystack" && paystackRef && (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                    <p className="text-primary font-semibold text-sm">Payment Window Opened</p>
                    <p className="text-primary/70 text-xs mt-1">Complete your payment, then click below to confirm.</p>
                    <p className="text-muted-foreground text-[10px] mt-1 font-mono">Ref: {paystackRef}</p>
                  </div>
                  <button onClick={verifyPaystack} disabled={paystackVerifying}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60">
                    {paystackVerifying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {paystackVerifying ? "Verifying…" : "I've Completed Payment"}
                  </button>
                  <button onClick={() => window.open(`https://checkout.paystack.com/${paystackRef}`, "_blank")}
                    className="w-full border border-border text-foreground font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm active:scale-95">
                    <ExternalLink size={14} /> Reopen Payment Window
                  </button>
                </div>
              )}

              {modal === "withdraw" && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const amt = parseFloat(amount);
                  if (!amt || amt < 100) return;
                  if (!phone.trim()) return;
                  withdrawMutation.mutate({ amt, phoneNum: phone.trim() });
                }} className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-amber-700 text-xs">Available: <strong>{formatKES(balance)}</strong>. Funds will be sent to the M-Pesa number below within 1–2 business days.</p>
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
                      {QUICK_AMOUNTS.filter(a => a <= balance).map(a => (
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
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav role="investor" />
    </div>
  );
}
