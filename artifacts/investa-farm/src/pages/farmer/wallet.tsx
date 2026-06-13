import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getToken, getStoredUser } from "@/lib/auth";
import { ArrowLeft, RefreshCw, TrendingUp, Wallet, ArrowDownLeft, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

type WalletData = {
  wallet: { id: number; balance: string; currency: string; updatedAt: string };
  transactions: Array<{
    id: number; type: string; amount: string; balanceAfter: string;
    description: string | null; reference: string | null; status: string; createdAt: string;
  }>;
};

const TX_ICONS: Record<string, { emoji: string; isCredit: boolean }> = {
  deposit:    { emoji: "⬇️", isCredit: true },
  withdrawal: { emoji: "⬆️", isCredit: false },
  return:     { emoji: "💰", isCredit: true },
  fee:        { emoji: "💳", isCredit: false },
  transfer:   { emoji: "↔️", isCredit: true },
};

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000];

export default function FarmerWallet() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const user = getStoredUser();
  const qc = useQueryClient();
  const [modal, setModal] = useState<"withdraw" | "paystack" | null>(null);
  const [amount, setAmount] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [paystackRef, setPaystackRef] = useState<string | null>(null);
  const [paystackVerifying, setPaystackVerifying] = useState(false);

  const { data, isLoading, refetch } = useQuery<WalletData>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load wallet");
      return r.json();
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

  const withdrawMutation = useMutation({
    mutationFn: async (amt: number) => {
      const r = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      setModal(null); setAmount("");
      setSuccess("Withdrawal initiated. Funds sent to your M-Pesa.");
      setTimeout(() => setSuccess(null), 4000);
    },
  });

  const balance = parseFloat(data?.wallet.balance ?? "0");
  const txs = data?.transactions ?? [];
  const totalEarned = txs.filter(t => ["deposit", "return", "transfer"].includes(t.type)).reduce((s, t) => s + parseFloat(t.amount), 0);

  const cardNumber = `•••• •••• •••• ${String(user?.id ?? 0).padStart(4, "0")}`;
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
                : <p className="text-white font-bold text-3xl">{formatKES(balance)}</p>}
            </div>

            {/* Bottom: name + expiry */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/50 text-[8px] uppercase tracking-wider">{user?.name ?? "Farmer"}</p>
                <p className="text-white font-mono text-xs tracking-widest">{cardNumber}</p>
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
            <p className="text-green-600 font-bold text-sm">{formatKES(totalEarned)}</p>
            <p className="text-muted-foreground text-[10px] mt-0.5">Total Received</p>
          </div>
          <div className="p-3 text-center border-r border-border">
            <p className="text-amber-600 font-bold text-sm">{formatKES(totalEarned * 0.03)}</p>
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

        {/* Currency indicator */}
        <div className="flex items-center gap-2 mt-3 bg-white border border-border rounded-2xl px-3 py-2.5">
          <span className="text-base">🇰🇪</span>
          <div>
            <p className="text-foreground font-semibold text-xs">Currency: KES — Kenyan Shilling</p>
            <p className="text-muted-foreground text-[10px]">All transactions are processed in Kenyan Shillings</p>
          </div>
        </div>

        {/* Withdraw only (farmer) */}
        <button onClick={() => { setModal("withdraw"); setAmount(""); }}
          className="w-full mt-3 bg-primary text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md shadow-primary/20">
          <ArrowDownLeft size={16} /> Withdraw to M-Pesa
        </button>
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
            onClick={(e) => { if (e.target === e.currentTarget) { setModal(null); setPaystackRef(null); } }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 space-y-4 border-t-4 border-primary">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground font-bold text-lg">
                  {modal === "paystack" ? "💳 Top Up via Paystack" : "🏦 Withdraw to M-Pesa"}
                </h3>
                <button onClick={() => { setModal(null); setPaystackRef(null); }} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">✕</button>
              </div>

              {modal === "paystack" && !paystackRef && (
                <>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <p className="text-primary text-xs">Pay securely via <strong>Paystack</strong> using M-Pesa, Visa, or bank card.</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Amount (KES)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
                      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={100} placeholder="e.g. 10000" required
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
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60">
                    {initPaystack.isPending ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                    {initPaystack.isPending ? "Opening Paystack…" : "Pay with Paystack"}
                  </button>
                  {initPaystack.isError && <p className="text-red-500 text-xs text-center">{(initPaystack.error as Error).message}</p>}
                </>
              )}

              {modal === "paystack" && paystackRef && (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                    <p className="text-primary font-semibold text-sm">Payment Window Opened</p>
                    <p className="text-primary/70 text-xs mt-1">Complete your payment, then confirm below.</p>
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
                  withdrawMutation.mutate(amt);
                }} className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-amber-700 text-xs">Available: <strong>{formatKES(balance)}</strong>. Withdrawal sent to your registered M-Pesa within 1–2 business days.</p>
                  </div>
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
                  <button type="submit" disabled={withdrawMutation.isPending || !amount}
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

      <BottomNav role="farmer" />
    </div>
  );
}
