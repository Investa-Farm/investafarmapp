import "./_group.css";
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, BarChart3, BriefcaseBusiness,
  Check, CheckCircle2, Coins, CreditCard, Download, Filter, Lock, Plus,
  RefreshCw, Repeat, Sprout, Trash2, TrendingUp, Wallet,
} from "lucide-react";

const transactions = [
  { kind: "investment", title: "Investment — Green Valley Maize Farm", date: "18 Jun, 10:42", amount: "12,500", balance: "18,450" },
  { kind: "deposit", title: "Wallet deposit · M-Pesa", date: "15 Jun, 14:20", amount: "20,000", balance: "30,950" },
  { kind: "return", title: "Seasonal return — Kiamaina Coffee", date: "12 Jun, 09:15", amount: "2,450", balance: "10,950" },
  { kind: "withdrawal", title: "Withdrawal to M-Pesa", date: "09 Jun, 16:03", amount: "8,000", balance: "8,500" },
];
const txIcons: Record<string, any> = {
  deposit: { icon: ArrowDownLeft, color: "text-green-600" },
  withdrawal: { icon: ArrowUpRight, color: "text-red-500" },
  investment: { icon: TrendingUp, color: "text-blue-600" },
  return: { icon: Coins, color: "text-green-600" },
};
const money = (n: string | number) => `KES ${Number(n).toLocaleString("en-KE")}`;

function BottomNav() {
  return <nav className="fixed bottom-0 left-0 right-0 z-10 mx-auto flex h-[66px] max-w-[960px] items-center justify-around border-t border-border bg-white/95 px-2 backdrop-blur">
    {[[TrendingUp, "Market"], [BriefcaseBusiness, "Portfolio"], [BarChart3, "Activity"], [Wallet, "Wallet"]].map(([Icon, label]: any, i) =>
      <button key={label} className={`flex min-w-[58px] flex-col items-center gap-1 text-[9px] font-semibold ${i === 3 ? "text-primary" : "text-muted-foreground"}`}><Icon size={18} />{label}</button>)}
  </nav>;
}

export function Current() {
  return <div className="investa-current min-h-screen bg-background text-foreground">
    <main className="app-shell responsive-shell page-enter pb-24">
      <div className="flex items-center justify-between px-4 pb-2 pt-12">
        <button className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><ArrowLeft size={16} /></button>
        <h1 className="text-lg font-bold">Investa Wallet</h1>
        <button className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><RefreshCw size={14} /></button>
      </div>

      <div className="px-4 pb-4 pt-2">
        <div className="relative min-h-[210px] select-none overflow-hidden rounded-[22px]" style={{ background: "linear-gradient(135deg,#052e16 0%,#14532d 30%,#166534 60%,#16a34a 100%)" }}>
          <div className="absolute inset-0 opacity-[.07]" style={{ backgroundImage: "radial-gradient(circle,white 1.5px,transparent 1.5px)", backgroundSize: "22px 22px" }} />
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-10" style={{ background: "radial-gradient(circle,#4ade80,transparent)" }} />
          <div className="absolute -bottom-8 -left-8 h-36 w-36 rounded-full opacity-10" style={{ background: "radial-gradient(circle,#86efac,transparent)" }} />
          <div className="absolute bottom-5 right-5 opacity-10">
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none"><path d="M30 50V20M30 20c0 0-8-6-12-14M30 20c0 0 8-6 12-14M30 28c0 0-6-4-9-10M30 28c0 0 6-4 9-10M30 36c0 0-6-4-9-10M30 36c0 0 6-4 9-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
          </div>
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><img src="/__mockup/images/investa-current/logo.png" alt="Investa Farm" className="h-6 w-auto brightness-0 invert" /><div><p className="text-[8px] font-bold uppercase leading-none tracking-widest text-white/50">Investa Farm</p><p className="mt-0.5 text-[11px] font-bold leading-none text-white">Investor Wallet</p></div></div>
              <div className="flex h-7 w-10 flex-col items-center justify-center gap-0.5 rounded-sm border border-amber-200/50 bg-amber-300/80 p-1"><div className="h-0.5 w-full rounded bg-amber-600/40" /><div className="h-0.5 w-full rounded bg-amber-600/40" /></div>
            </div>
            <div className="text-center"><p className="mb-0.5 text-[10px] uppercase tracking-wider text-white/60">Wallet Balance</p><p className="text-3xl font-bold text-white">{money(18450)}</p></div>
            <div className="flex items-end justify-between">
              <div><p className="text-[8px] uppercase tracking-wider text-white/50">Account holder</p><p className="text-xs font-semibold tracking-wide text-white">Investor</p></div>
              <div className="text-right"><p className="text-[8px] uppercase tracking-wider text-white/50">Security</p><p className="flex items-center justify-end gap-1 text-xs font-semibold text-green-200"><Lock size={10} /> Protected</p></div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-card p-3">
          <div className="grid grid-cols-4 gap-1.5">
            {[["Portfolio", "284,650", "text-green-600"], ["Invested", "266,200", "text-foreground"], ["Today P&L", "3,420", "text-green-600"], ["Holdings", "4", "text-foreground"]].map(([label, value, color]) =>
              <div key={label} className="text-center"><p className={`truncate text-xs font-bold ${color}`}>{label === "Holdings" ? value : money(value)}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p></div>)}
          </div>
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto border-t border-border pt-2.5">
            {["KES", "USD", "EUR", "GBP"].map((code, i) => <button key={code} className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold ${i === 0 ? "border-primary bg-primary text-white" : "border-border text-muted-foreground"}`}>{code}</button>)}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-primary py-4 font-bold text-white shadow-md shadow-primary/20"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20"><Plus size={18} /></span><span className="text-xs">Add Funds</span></button>
          <button className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-muted py-4 font-bold text-foreground"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/60"><ArrowUpRight size={18} /></span><span className="text-xs">Withdraw</span></button>
        </div>
        <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 py-3 font-bold text-blue-700"><TrendingUp size={15} /><span className="text-sm">Finance &amp; Invest</span></button>
      </div>

      <div className="space-y-4 px-4">
        <section>
          <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Transaction History</p><div className="flex items-center gap-2"><button className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary"><Download size={10} /> CSV</button><Filter size={13} className="text-muted-foreground" /></div></div>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-2">
            {["All", "Deposits", "Withdrawals", "Investments", "Fees"].map((label, i) => <button key={label} className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold ${i === 0 ? "border-primary bg-primary text-white" : "border-border bg-muted text-muted-foreground"}`}>{label}</button>)}
          </div>
          {transactions.map(tx => {
            const cfg = txIcons[tx.kind] ?? { icon: CreditCard, color: "text-foreground" };
            const Icon = cfg.icon;
            const isCredit = ["deposit", "return"].includes(tx.kind);
            return <div key={tx.title} className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted ${cfg.color}`}><Icon size={16} /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{tx.title}</p><p className="text-[10px] text-muted-foreground">{tx.date}</p></div>
              <div className="flex shrink-0 items-center gap-2 text-right"><div><p className={`text-sm font-bold ${isCredit ? "text-green-600" : "text-red-500"}`}>{isCredit ? "+" : "−"}{money(tx.amount)}</p><p className="text-[10px] text-muted-foreground">Bal: {money(tx.balance)}</p></div><button className="flex h-6 w-6 items-center justify-center text-gray-300"><Trash2 size={13} /></button></div>
            </div>;
          })}
        </section>
      </div>
      <BottomNav />
    </main>
  </div>;
}
