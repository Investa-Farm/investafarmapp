import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getToken, getStoredUser } from "@/lib/auth";
import { ArrowLeft, RefreshCw, TrendingUp, Wallet, ArrowDownLeft, Plus, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [modal, setModal] = useState<"deposit" | "withdraw" | "paystack" | null>(null);
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

  const mutation = useMutation({
    mutationFn: async ({ type, amt }: { type: "deposit" | "withdraw"; amt: number }) => {
      const r = await fetch(`/api/wallet/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      setModal(null); setAmount("");
      setSuccess(vars.type === "deposit" ? "Funds added to your wallet!" : "Withdrawal initiated.");
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
        <h1 className="text-foreground font-bold text-lg">My Wallet</h1>
        <button onClick={() => refetch()} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <RefreshCw size={14} className="text-foreground" />
        </button>
      </div>

      <div className="px-4 pt-2 pb-4">
        {/* Visa-style card */}
        <div className="relative rounded-[20px] overflow-hidden h-52 select-none"
          style={{ background: "linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 70%, #059669 100%)" }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 1px, transparent 1px), radial-gradient(circle at 20% 80%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
          <div className="absolute top-5 right-5 w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border border-white/50" style={{ background: "rgba(255,255,255,0.1)" }} />
          </div>
          <div className="absolute inset-0 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest">Investa Farm</p>
                <p className="text-white font-bold text-sm">Farm Earnings Wallet</p>
              </div>
              <div className="w-10 h-7 rounded-sm bg-amber-300/80 border border-amber-200/50 flex flex-col justify-center items-center gap-0.5 p-1">
                <div className="w-full h-0.5 bg-amber-600/40 rounded" />
                <div className="w-full h-0.5 bg-amber-600/40 rounded" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white/60 text-[10px] uppercase tracking-wider mb-0.5">Available Balance</p>
              {isLoading
                ? <div className="h-8 w-36 bg-white/20 rounded-lg animate-pulse mx-auto" />
                : <p className="text-white font-bold text-3xl">{formatKES(balance)}</p>}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/50 text-[9px] uppercase tracking-wider">Card Number</p>
                <p className="text-white font-mono text-xs tracking-widest">{cardNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-white/50 text-[9px] uppercase tracking-wider">Valid Thru</p>
                <p className="text-white font-mono text-xs">{expiryStr}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <button onClick={() => { setModal("paystack"); setAmount(""); }}
            className="bg-primary text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <Plus size={16} /> Add Funds
          </button>
          <button onClick={() => { setModal("withdraw"); setAmount(""); }}
            className="bg-muted border border-border text-foreground font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <ArrowDownLeft size={16} /> Withdraw
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

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-[10px]">Total Received</p>
              <TrendingUp size={13} className="text-primary" />
            </div>
            <p className="text-foreground font-bold text-lg">{formatKES(totalEarned)}</p>
            <p className="text-primary text-[10px] font-medium">From investors</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-[10px]">Transactions</p>
              <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">All</span>
            </div>
            <p className="text-foreground font-bold text-lg">{txs.length}</p>
            <p className="text-muted-foreground text-[10px]">Lifetime</p>
          </div>
        </div>

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
              className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground font-bold text-lg">
                  {modal === "paystack" ? "💳 Top Up via Paystack" : "🏦 Withdraw"}
                </h3>
                <button onClick={() => { setModal(null); setPaystackRef(null); }} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm">✕</button>
              </div>

              {modal === "paystack" && !paystackRef && (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-green-700 text-xs">Pay securely via <strong>Paystack</strong> using M-Pesa, Visa, or bank card. Funds credited instantly.</p>
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
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
                    {initPaystack.isPending ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                    {initPaystack.isPending ? "Opening Paystack…" : "Pay with Paystack"}
                  </button>
                  {initPaystack.isError && <p className="text-red-500 text-xs text-center">{(initPaystack.error as Error).message}</p>}
                </>
              )}

              {modal === "paystack" && paystackRef && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-blue-700 font-semibold text-sm">Payment Window Opened</p>
                    <p className="text-blue-600 text-xs mt-1">Complete your payment in the Paystack window, then click below to confirm.</p>
                    <p className="text-blue-500 text-[10px] mt-1 font-mono">Ref: {paystackRef}</p>
                  </div>
                  <button onClick={verifyPaystack} disabled={paystackVerifying}
                    className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
                    {paystackVerifying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {paystackVerifying ? "Verifying…" : "I've Completed Payment"}
                  </button>
                  <button onClick={() => { window.open(`https://checkout.paystack.com/${paystackRef}`, "_blank"); }}
                    className="w-full border border-border text-foreground font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform">
                    <ExternalLink size={14} /> Reopen Payment Window
                  </button>
                </div>
              )}

              {modal === "withdraw" && (
                <form onSubmit={(e) => { e.preventDefault(); const amt = parseFloat(amount); if (!amt || amt < 100) return; mutation.mutate({ type: "withdraw", amt }); }} className="space-y-4">
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
                  </div>
                  <button type="submit" disabled={mutation.isPending || !amount}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
                    {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownLeft size={16} />}
                    {mutation.isPending ? "Processing…" : "Confirm Withdrawal"}
                  </button>
                  {mutation.isError && <p className="text-red-500 text-xs text-center">{(mutation.error as Error).message}</p>}
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
