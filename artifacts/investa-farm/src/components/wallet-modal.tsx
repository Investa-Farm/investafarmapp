import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, ArrowUpRight, ArrowDownLeft, RefreshCw, TrendingUp, CheckCircle2, ExternalLink, Loader2, Wallet } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetPortfolioSummary } from "@workspace/api-client-react";
import { formatKES, getToken, getStoredUser } from "@/lib/auth";
import { useCurrency, CURRENCIES } from "@/lib/currency";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import farmBgSrc from "@assets/IMG_8016_1781250402404.jpeg";

type WalletData = {
  wallet: { id: number; balance: string; currency: string; updatedAt: string };
  transactions: Array<{
    id: number; type: string; amount: string; balanceAfter: string;
    description: string | null; reference: string | null; status: string; createdAt: string;
  }>;
};

const TX_ICONS: Record<string, { emoji: string }> = {
  deposit:    { emoji: "⬇️" },
  withdrawal: { emoji: "⬆️" },
  investment: { emoji: "📈" },
  return:     { emoji: "💰" },
  fee:        { emoji: "💳" },
  transfer:   { emoji: "↔️" },
};

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000];

type Props = { open: boolean; onClose: () => void };

export function WalletModal({ open, onClose }: Props) {
  const token = getToken();
  const user = getStoredUser();
  const qc = useQueryClient();
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [paystackRef, setPaystackRef] = useState<string | null>(null);
  const [paystackVerifying, setPaystackVerifying] = useState(false);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const { currency, setCurrency, formatAmount } = useCurrency();

  const { data, isLoading, refetch } = useQuery<WalletData>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load wallet");
      return r.json();
    },
    enabled: open,
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
      setIframeUrl(data.authorizationUrl);
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
    } catch (err) { alert((err as Error).message); }
    finally { setPaystackVerifying(false); }
  };

  const balance = parseFloat(data?.wallet.balance ?? "0");
  const txs = (data?.transactions ?? []).slice(0, 8);
  const cardNumber = `•••• •••• •••• ${String(user?.id ?? 0).padStart(4, "0")}`;
  const expiry = new Date(new Date().setFullYear(new Date().getFullYear() + 4));
  const expiryStr = `${String(expiry.getMonth() + 1).padStart(2, "0")}/${String(expiry.getFullYear()).slice(-2)}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ maxHeight: "92dvh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-2 pb-3">
              <h2 className="font-bold text-lg">Investa Wallet</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => refetch()} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <RefreshCw size={13} className="text-foreground" />
                </button>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={15} className="text-foreground" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-4 pb-8 space-y-3">
              {/* Bank card with farm image background */}
              <div className="relative rounded-[22px] overflow-hidden select-none" style={{ minHeight: 200 }}>
                {/* Farm photo background */}
                <img
                  src={farmBgSrc}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(135deg, rgba(5,46,22,0.88) 0%, rgba(20,83,45,0.82) 40%, rgba(22,101,52,0.72) 70%, rgba(22,163,74,0.75) 100%)" }}
                />
                {/* Subtle dot pattern */}
                <div className="absolute inset-0 opacity-[0.06]"
                  style={{ backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)", backgroundSize: "20px 20px" }} />

                <div className="absolute inset-0 p-5 flex flex-col justify-between">
                  {/* Top: logo + chip */}
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

                  {/* Balance */}
                  <div className="text-center">
                    <p className="text-white/60 text-[10px] uppercase tracking-wider mb-0.5">Available Balance</p>
                    {isLoading
                      ? <div className="h-9 w-40 bg-white/20 rounded-lg animate-pulse mx-auto" />
                      : <motion.p key={balance} initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                          className="text-white font-bold text-3xl drop-shadow-lg">{formatAmount(balance)}</motion.p>}
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <p className="text-green-300 text-[9px] font-semibold uppercase tracking-wider">Live Balance</p>
                    </div>
                  </div>

                  {/* Bottom: name + expiry */}
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

              {/* Portfolio strip */}
              {summary && (
                <div className="bg-card border border-border rounded-2xl p-3">
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: "Portfolio", val: formatAmount(summary.totalValue), up: true },
                      { label: "Invested", val: formatAmount(summary.totalInvested), up: null },
                      { label: "P&L", val: formatAmount(summary.todayReturn), up: summary.todayReturn >= 0 },
                      { label: "Holdings", val: String(summary.holdings), up: null },
                    ].map(({ label, val, up }) => (
                      <div key={label} className="text-center">
                        <p className={`font-bold text-xs truncate ${up === null ? "text-foreground" : up ? "text-green-600" : "text-red-500"}`}>{val}</p>
                        <p className="text-muted-foreground text-[9px] mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {(() => {
                const isFarmer = (user as { role?: string } | null)?.role === "farmer";
                return (
                  <div className={`grid ${isFarmer ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
                    {!isFarmer && (
                      <button onClick={() => { setModal("deposit"); setAmount(""); }}
                        className="bg-primary text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md shadow-primary/20">
                        <Plus size={16} /> Add Funds
                      </button>
                    )}
                    <button onClick={() => { setModal("withdraw"); setAmount(""); }}
                      className="bg-muted border border-border text-foreground font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                      <ArrowUpRight size={16} /> Withdraw
                    </button>
                  </div>
                );
              })()}

              <AnimatePresence>
                {success && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                    <p className="text-green-700 text-sm font-medium">{success}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Transaction history */}
              <div>
                <p className="text-sm font-semibold mb-2">Recent Transactions</p>
                {isLoading
                  ? Array(3).fill(0).map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse mb-2" />)
                  : txs.length === 0
                  ? (
                    <div className="text-center py-8 bg-muted/40 rounded-2xl">
                      <Wallet size={24} className="text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No transactions yet.</p>
                    </div>
                  )
                  : txs.map(tx => {
                    const cfg = TX_ICONS[tx.type] ?? { emoji: "💳" };
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
                          <p className="text-muted-foreground text-[10px]">{formatAmount(parseFloat(tx.balanceAfter))}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Deposit/Withdraw sub-modal */}
            <AnimatePresence>
              {modal && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex items-end justify-center bg-black/50"
                  onClick={(e) => { if (e.target === e.currentTarget) { setModal(null); setPaystackRef(null); } }}>
                  <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    className="w-full bg-white rounded-t-3xl p-6 space-y-4 border-t-4 border-primary">
                    <div className="flex items-center justify-between">
                      <h3 className="text-foreground font-bold text-lg">
                        {modal === "deposit" ? "💳 Add Funds via Paystack" : "🏦 Withdraw to M-Pesa"}
                      </h3>
                      <button onClick={() => { setModal(null); setPaystackRef(null); }} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">✕</button>
                    </div>

                    {modal === "deposit" && !paystackRef && (
                      <>
                        {initPaystack.isError ? (
                          <div className="space-y-3">
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                              <p className="text-red-700 font-semibold text-sm">Payment Gateway Unavailable</p>
                              <p className="text-red-600 text-xs mt-1">{(initPaystack.error as Error).message}</p>
                            </div>
                            <button onClick={() => initPaystack.reset()} className="w-full border border-border text-foreground font-semibold py-3 rounded-xl text-sm active:scale-95">↩ Try Again</button>
                          </div>
                        ) : (
                          <>
                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                              <p className="text-primary text-xs">Pay via <strong>Paystack</strong> — M-Pesa, Visa, Mastercard, or bank transfer. Funds credited instantly.</p>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Amount (KES)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={100} placeholder="e.g. 5000"
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
                          </>
                        )}
                      </>
                    )}

                    {modal === "deposit" && paystackRef && (
                      <div className="space-y-3">
                        {iframeUrl && (
                          <div className="rounded-2xl overflow-hidden border border-border bg-white shadow-sm" style={{ height: 420 }}>
                            <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border">
                              <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate flex-1 text-center">Paystack Secure Payment</p>
                            </div>
                            <iframe
                              src={iframeUrl}
                              title="Paystack Payment"
                              className="w-full"
                              style={{ height: 382, border: "none" }}
                              allow="payment"
                              sandbox="allow-scripts allow-same-origin allow-forms allow-top-navigation allow-popups"
                            />
                          </div>
                        )}
                        <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
                          <p className="text-primary text-xs">Ref: <span className="font-mono font-bold">{paystackRef.slice(0, 16)}…</span></p>
                          <p className="text-primary/60 text-[10px]">Secure · 256-bit SSL</p>
                        </div>
                        <button onClick={() => { setIframeUrl(null); verifyPaystack(); }} disabled={paystackVerifying}
                          className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60">
                          {paystackVerifying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                          {paystackVerifying ? "Verifying payment…" : "I've Completed Payment"}
                        </button>
                      </div>
                    )}

                    {modal === "withdraw" && (
                      <form onSubmit={(e) => { e.preventDefault(); const amt = parseFloat(amount); if (!amt || amt < 100 || !phone.trim()) return; withdrawMutation.mutate({ amt, phoneNum: phone.trim() }); }} className="space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                          <p className="text-amber-700 text-xs">Available: <strong>{formatKES(balance)}</strong>. Sent to M-Pesa within 1–2 business days.</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">M-Pesa Number</label>
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
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={100} max={balance} placeholder="e.g. 5000"
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
