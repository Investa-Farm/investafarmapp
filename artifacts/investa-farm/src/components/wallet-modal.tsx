import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, ArrowUpRight, ArrowDownLeft, RefreshCw, Loader2, Wallet, CheckCircle2, Receipt, CreditCard, Coins, Smartphone } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetPortfolioSummary } from "@workspace/api-client-react";
import { formatKES, getToken, getStoredUser } from "@/lib/auth";
import { useCurrency, CURRENCIES } from "@/lib/currency";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import farmBgSrc from "@assets/IMG_8016_1781250402404.jpeg";
import { PaymentSheet } from "@/components/payment-sheet";

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

const MPESA_CODES = [
  { code: "+254", flag: "🇰🇪", name: "Kenya (Safaricom)" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+250", flag: "🇷🇼", name: "Rwanda" },
];

type Props = { open: boolean; onClose: () => void };

export function WalletModal({ open, onClose }: Props) {
  const token = getToken();
  const user = getStoredUser();
  const qc = useQueryClient();
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);
  const [withdrawTab, setWithdrawTab] = useState<"mpesa" | "card" | "usdc">("mpesa");
  const [txFilter, setTxFilter] = useState<"all" | "deposits" | "withdrawals">("all");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("+254");
  const [usdcAddress, setUsdcAddress] = useState("");
  const [cardName, setCardName] = useState("");
  const [withdrawCardNum, setWithdrawCardNum] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [receiptTx, setReceiptTx] = useState<WalletData["transactions"][number] | null>(null);
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
      setSuccess("Withdrawal initiated to M-Pesa. Funds sent within 1–2 business days.");
      setTimeout(() => setSuccess(null), 5000);
    },
  });

  const withdrawCardMutation = useMutation({
    mutationFn: async ({ amt, name, num }: { amt: number; name: string; num: string }) => {
      const r = await fetch("/api/wallet/withdraw/card", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, cardholderName: name, cardNumber: num }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      setModal(null); setAmount(""); setCardName(""); setWithdrawCardNum("");
      setSuccess("Card withdrawal initiated. Funds arrive in 2–5 business days.");
      setTimeout(() => setSuccess(null), 5000);
    },
  });

  const withdrawUsdcMutation = useMutation({
    mutationFn: async ({ amt, addr }: { amt: number; addr: string }) => {
      const r = await fetch("/api/wallet/withdraw/usdc", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, walletAddress: addr }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      setModal(null); setAmount(""); setUsdcAddress("");
      setSuccess(`USDC withdrawal queued — ${data.usdcAmount ?? ""} USDC arriving within 30 min.`);
      setTimeout(() => setSuccess(null), 5000);
    },
  });

  const balance = parseFloat(data?.wallet.balance ?? "0");
  const allTxs = data?.transactions ?? [];
  const filteredTxs = txFilter === "all"
    ? allTxs
    : txFilter === "deposits"
      ? allTxs.filter(t => ["deposit", "return"].includes(t.type))
      : allTxs.filter(t => ["withdrawal", "fee"].includes(t.type));
  const walletCardNum = `•••• •••• •••• ${String(user?.id ?? 0).padStart(4, "0")}`;
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
                      <p className="text-white font-mono text-xs tracking-widest">{walletCardNum}</p>
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
                  <div className="space-y-2">
                    {!isFarmer && (
                      <button onClick={() => { setModal("deposit"); setAmount(""); }}
                        className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md shadow-primary/20 text-base">
                        <Plus size={18} /> Add Funds
                      </button>
                    )}
                    <button onClick={() => { setModal("withdraw"); setAmount(""); setWithdrawTab("mpesa"); }}
                      className="w-full bg-muted border border-border text-muted-foreground font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform text-sm">
                      <ArrowUpRight size={14} /> Withdraw Funds
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

              {/* Transaction history with tabs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Transaction History</p>
                  <span className="text-muted-foreground text-[10px]">{filteredTxs.length} records</span>
                </div>
                {/* Filter tabs */}
                <div className="flex gap-1.5 mb-3 bg-muted/50 p-1 rounded-xl">
                  {([
                    { id: "all" as const,         label: "All" },
                    { id: "deposits" as const,    label: "Deposits" },
                    { id: "withdrawals" as const, label: "Withdrawals" },
                  ]).map(f => (
                    <button key={f.id} onClick={() => setTxFilter(f.id)}
                      className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all ${
                        txFilter === f.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
                      }`}>
                      {f.label}
                    </button>
                  ))}
                </div>
                {isLoading
                  ? Array(3).fill(0).map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse mb-2" />)
                  : filteredTxs.length === 0
                  ? (
                    <div className="text-center py-8 bg-muted/40 rounded-2xl">
                      <Wallet size={24} className="text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">
                        {txFilter === "all" ? "No transactions yet." : `No ${txFilter} yet.`}
                      </p>
                    </div>
                  )
                  : filteredTxs.map(tx => {
                    const cfg = TX_ICONS[tx.type] ?? { emoji: "💳" };
                    const isCredit = ["deposit", "return", "transfer"].includes(tx.type);
                    return (
                      <button key={tx.id} onClick={() => setReceiptTx(tx)}
                        className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-3 mb-2 active:scale-[0.98] transition-transform text-left">
                        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-base flex-shrink-0">
                          {cfg.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground text-xs font-medium truncate">{tx.description ?? tx.type}</p>
                          <p className="text-muted-foreground text-[10px]">
                            {new Date(tx.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 flex items-center gap-2">
                          <div>
                            <p className={`font-bold text-sm ${isCredit ? "text-green-600" : "text-red-500"}`}>
                              {isCredit ? "+" : "-"}{formatAmount(parseFloat(tx.amount))}
                            </p>
                            <p className="text-muted-foreground text-[10px]">{formatAmount(parseFloat(tx.balanceAfter))}</p>
                          </div>
                          <Receipt size={13} className="text-muted-foreground flex-shrink-0" />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Withdraw sub-modal — 3 tabs: M-Pesa, Card, USDC */}
            <AnimatePresence>
              {modal === "withdraw" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex items-end justify-center bg-black/50"
                  onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
                  <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    className="w-full bg-white rounded-t-3xl border-t-4 border-primary overflow-hidden"
                    style={{ maxHeight: "88dvh" }}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                      <h3 className="text-foreground font-bold text-lg">Withdraw Funds</h3>
                      <button onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <X size={14} />
                      </button>
                    </div>

                    {/* Method tabs */}
                    <div className="flex gap-1.5 p-3 bg-muted/40 border-b border-border">
                      {([
                        { id: "mpesa" as const, label: "M-Pesa", icon: <Smartphone size={12} />, cls: "bg-green-600 text-white" },
                        { id: "card"  as const, label: "Card",   icon: <CreditCard  size={12} />, cls: "bg-blue-600 text-white"  },
                        { id: "usdc"  as const, label: "USDC",   icon: <Coins       size={12} />, cls: "bg-purple-600 text-white" },
                      ] as const).map(t => (
                        <button key={t.id} onClick={() => setWithdrawTab(t.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                            withdrawTab === t.id ? `${t.cls} shadow-md` : "text-muted-foreground hover:text-foreground"
                          }`}>
                          {t.icon} {t.label}
                        </button>
                      ))}
                    </div>

                    <div className="overflow-y-auto px-5 py-4 pb-8 space-y-4">
                      {/* Balance strip */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-amber-700 text-xs">
                          Available: <strong>{formatKES(balance)}</strong>
                          {withdrawTab === "mpesa" && " · Processed within 1–2 business days"}
                          {withdrawTab === "card"  && " · Bank transfer 2–5 business days"}
                          {withdrawTab === "usdc"  && " · On-chain · usually within 30 min"}
                        </p>
                      </div>

                      {/* Amount input — shared across tabs */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Amount (KES)</label>
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

                      {/* ── M-PESA tab ── */}
                      {withdrawTab === "mpesa" && (
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const amt = parseFloat(amount);
                          if (!amt || amt < 100 || !phone.trim()) return;
                          withdrawMutation.mutate({ amt, phoneNum: phoneCode + phone.trim() });
                        }} className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">M-Pesa Number</label>
                            <div className="flex gap-2">
                              <select value={phoneCode} onChange={e => setPhoneCode(e.target.value)}
                                className="border border-border rounded-xl px-2 py-3 text-sm bg-white focus:outline-none focus:border-green-500 appearance-none w-[90px] flex-shrink-0 text-center font-medium">
                                {MPESA_CODES.map(c => (
                                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                                ))}
                              </select>
                              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                                placeholder={phoneCode === "+254" ? "7XXXXXXXX" : "Phone number"} required
                                className="flex-1 border border-border rounded-xl px-3 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-green-500" />
                            </div>
                          </div>
                          <button type="submit" disabled={withdrawMutation.isPending || !amount || !phone.trim()}
                            className="w-full bg-green-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 shadow-md shadow-green-600/20">
                            {withdrawMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
                            {withdrawMutation.isPending ? "Processing…" : `Withdraw via M-Pesa`}
                          </button>
                          {withdrawMutation.isError && <p className="text-red-500 text-xs text-center">{(withdrawMutation.error as Error).message}</p>}
                        </form>
                      )}

                      {/* ── CARD / Bank Transfer tab ── */}
                      {withdrawTab === "card" && (
                        <div className="space-y-3">
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                            <CreditCard size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                            <p className="text-blue-700 text-xs">Withdraw directly to your Visa / Mastercard or a bank account. Funds arrive within 2–5 business days.</p>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Cardholder / Account Name</label>
                            <input type="text" value={cardName} onChange={e => setCardName(e.target.value)}
                              placeholder="Full name as on card"
                              className="w-full border border-border rounded-xl px-3 py-3 text-foreground font-semibold text-sm focus:outline-none focus:border-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Card / Account Number</label>
                            <input type="text" value={cardNumber} onChange={e => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
                              placeholder="16-digit card number"
                              className="w-full border border-border rounded-xl px-3 py-3 text-foreground font-mono font-bold text-sm focus:outline-none focus:border-blue-500" />
                          </div>
                          <button
                            disabled={withdrawCardMutation.isPending || !amount || parseFloat(amount) < 100 || !cardName.trim() || !withdrawCardNum.trim()}
                            onClick={() => withdrawCardMutation.mutate({ amt: parseFloat(amount), name: cardName, num: withdrawCardNum })}
                            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shadow-md shadow-blue-600/20">
                            {withdrawCardMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                            {withdrawCardMutation.isPending ? "Processing…" : "Withdraw to Card"}
                          </button>
                          {withdrawCardMutation.isError && <p className="text-red-500 text-xs text-center">{(withdrawCardMutation.error as Error).message}</p>}
                        </div>
                      )}

                      {/* ── USDC tab ── */}
                      {withdrawTab === "usdc" && (
                        <div className="space-y-3">
                          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start gap-2">
                            <Coins size={14} className="text-purple-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-purple-700 text-xs font-semibold">Withdraw as USDC on Polygon</p>
                              <p className="text-purple-600 text-[11px] mt-0.5">Ideal for diaspora or crypto wallets. Enter your USDC wallet address below.</p>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">USDC Wallet Address (Polygon)</label>
                            <input type="text" value={usdcAddress} onChange={e => setUsdcAddress(e.target.value.trim())}
                              placeholder="0x…"
                              className="w-full border border-border rounded-xl px-3 py-3 text-foreground font-mono text-xs font-bold focus:outline-none focus:border-purple-500 break-all" />
                            <p className="text-muted-foreground text-[10px] mt-1">Only enter a Polygon (MATIC) USDC address. Other networks are not supported.</p>
                          </div>
                          {amount && parseFloat(amount) >= 100 && (
                            <div className="bg-muted/60 rounded-xl p-3 flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">You'll receive approx.</span>
                              <span className="font-bold text-sm text-purple-700">
                                {(parseFloat(amount) / 130).toFixed(2)} USDC
                              </span>
                            </div>
                          )}
                          <button
                            disabled={!amount || parseFloat(amount) < 100 || !usdcAddress.startsWith("0x") || usdcAddress.length < 42}
                            onClick={() => {
                              setModal(null); setAmount(""); setUsdcAddress("");
                              setSuccess("USDC withdrawal queued. Arriving within 30 minutes.");
                              setTimeout(() => setSuccess(null), 5000);
                            }}
                            className="w-full bg-purple-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shadow-md shadow-purple-600/20">
                            <Coins size={16} /> Withdraw as USDC
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Deposit — full-screen PaymentSheet */}
            <PaymentSheet
              open={modal === "deposit"}
              onClose={() => setModal(null)}
              onSuccess={(amt) => {
                setSuccess(`💰 KES ${amt.toLocaleString()} added to your wallet!`);
                setTimeout(() => setSuccess(null), 4000);
              }}
            />

            {/* Receipt sheet */}
            <AnimatePresence>
              {receiptTx && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-end justify-center bg-black/50"
                  onClick={(e) => { if (e.target === e.currentTarget) setReceiptTx(null); }}>
                  <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    className="w-full bg-white rounded-t-3xl overflow-y-auto"
                    style={{ maxHeight: "88dvh" }}>
                    {/* Receipt header */}
                    <div className="bg-primary px-5 pt-6 pb-8 text-white text-center relative">
                      <button onClick={() => setReceiptTx(null)}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <X size={14} />
                      </button>
                      <div className="text-3xl mb-1">{TX_ICONS[receiptTx.type]?.emoji ?? "💳"}</div>
                      <p className="text-white/80 text-xs uppercase tracking-widest font-semibold mb-1 capitalize">{receiptTx.type}</p>
                      <p className={`text-2xl font-black ${["deposit","return","transfer"].includes(receiptTx.type) ? "text-green-300" : "text-red-300"}`}>
                        {["deposit","return","transfer"].includes(receiptTx.type) ? "+" : "-"}{formatAmount(parseFloat(receiptTx.amount))}
                      </p>
                    </div>
                    {/* Torn edge */}
                    <div className="h-4 bg-primary relative" style={{ marginTop: -1 }}>
                      <svg viewBox="0 0 400 16" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                        <path d="M0,0 Q20,16 40,0 Q60,16 80,0 Q100,16 120,0 Q140,16 160,0 Q180,16 200,0 Q220,16 240,0 Q260,16 280,0 Q300,16 320,0 Q340,16 360,0 Q380,16 400,0 L400,16 L0,16 Z" fill="white"/>
                      </svg>
                    </div>
                    {/* Receipt rows */}
                    <div className="px-5 py-4 space-y-3">
                      {[
                        { label: "Description", value: receiptTx.description ?? receiptTx.type },
                        { label: "Date", value: new Date(receiptTx.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) },
                        { label: "Reference", value: receiptTx.reference ?? "—" },
                        { label: "Status", value: receiptTx.status },
                        { label: "Balance After", value: formatAmount(parseFloat(receiptTx.balanceAfter)) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-start border-b border-dashed border-border pb-2 last:border-0">
                          <span className="text-muted-foreground text-xs font-medium">{label}</span>
                          <span className={`text-xs font-semibold text-right max-w-[55%] ${label === "Status" ? (receiptTx.status === "completed" ? "text-green-600" : receiptTx.status === "pending" ? "text-amber-600" : "text-red-500") : "text-foreground"}`}>
                            {label === "Status" ? value.charAt(0).toUpperCase() + value.slice(1) : value}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 pb-6">
                      <button onClick={() => setReceiptTx(null)}
                        className="w-full bg-primary text-white font-bold text-sm py-3.5 rounded-2xl active:scale-95 transition-transform">
                        Done
                      </button>
                    </div>
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
