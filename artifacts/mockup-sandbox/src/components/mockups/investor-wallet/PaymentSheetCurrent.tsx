import "./_group.css";
import { Check, ChevronDown, CreditCard, Lock, Shield, Smartphone, X, Zap } from "lucide-react";

const methods = [
  { label: "M-Pesa", sub: "Kenya · Tanzania · Mozambique", logo: "mpesa.png", accent: "#15803d", bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "#86efac" },
  { label: "MTN Money", sub: "Uganda · Rwanda · Ghana · Zambia", logo: "mtn.png", accent: "#b45309", bg: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "#fcd34d" },
  { label: "Airtel Money", sub: "Uganda · Kenya · Tanzania · Zambia", logo: "airtel.png", accent: "#dc2626", bg: "linear-gradient(135deg,#fff1f2,#ffe4e6)", border: "#fca5a5" },
];

export function PaymentSheetCurrent() {
  return <div className="investa-current relative min-h-screen overflow-hidden bg-slate-200 text-foreground">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
    <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl">
      <div className="flex justify-center pb-1 pt-3"><div className="h-1 w-10 rounded-full bg-border" /></div>
      <header className="flex items-center justify-between border-b border-border/50 px-5 py-3">
        <div><h3 className="text-lg font-bold">Add Funds</h3><p className="text-xs text-muted-foreground">Choose your payment method</p></div>
        <button className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><X size={15} /></button>
      </header>
      <div className="space-y-4 overflow-y-auto px-5 pb-8 pt-4">
        <div className="flex gap-1.5 rounded-2xl border border-border/60 bg-muted/80 p-1.5">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white shadow-md" style={{ background: "linear-gradient(135deg,#15803d,#16a34a)" }}><Smartphone size={14} /> Mobile Money</button>
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-muted-foreground"><CreditCard size={14} /> Card</button>
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-muted-foreground"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">$</span> USDC</button>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (KES)</label>
          <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">KES</span><div className="w-full rounded-2xl border-2 border-border py-4 pl-14 pr-4 text-lg font-bold text-muted-foreground/60">1,000</div></div>
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5">
            {["KES 500", "KES 1,000", "KES 5,000", "KES 10,000", "KES 25,000"].map((a, i) => <span key={a} className={`shrink-0 rounded-xl border-2 px-3.5 py-1.5 text-xs font-semibold ${i === 1 ? "border-primary bg-primary text-white" : "border-border text-muted-foreground"}`}>{a}</span>)}
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supported Networks</p>
          <div className="grid grid-cols-3 gap-2.5">
            {methods.map((method, i) => <div key={method.label} className="flex min-h-[128px] flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center" style={{ background: i === 0 ? method.bg : "hsl(var(--muted))", borderColor: i === 0 ? "#16a34a" : "hsl(var(--border))", boxShadow: i === 0 ? "0 4px 16px #15803d25" : "none" }}>
              <div className="flex h-10 w-14 items-center justify-center overflow-hidden rounded-xl bg-white p-1"><img src={`/__mockup/images/investa-current/${method.logo}`} alt={method.label} className="h-full w-full object-contain" /></div>
              <div><p className="text-[11px] font-bold leading-tight">{method.label}</p><p className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{method.sub}</p></div>
              {i === 0 && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-700"><Check size={9} className="text-white" /></span>}
            </div>)}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">M-Pesa Phone Number</label>
          <div className="flex gap-2">
            <button className="flex h-[50px] shrink-0 items-center gap-1.5 rounded-2xl border-2 border-green-200 bg-muted px-3 text-sm font-semibold">🇰🇪 +254 <ChevronDown size={11} className="text-muted-foreground" /></button>
            <div className="flex flex-1 items-center rounded-2xl border-2 border-green-200 px-3 text-sm font-semibold text-muted-foreground/70">7XXXXXXXX</div>
          </div>
          <p className="pl-1 text-[10px] text-muted-foreground">You’ll receive a payment push notification on this number.</p>
        </div>

        <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#004d1f] to-[#00A651] py-4 font-bold text-white opacity-50 shadow-lg shadow-green-600/20"><Smartphone size={18} /> Select a network above</button>
        <div className="flex items-center justify-center gap-3 text-muted-foreground/60">
          <span className="flex items-center gap-1 text-[10px]"><Shield size={10} /> Secure payment</span><span className="text-border">·</span>
          <span className="flex items-center gap-1 text-[10px]"><Lock size={10} /> 256-bit SSL</span><span className="text-border">·</span>
          <span className="flex items-center gap-1 text-[10px]"><Zap size={10} /> Instant credit</span>
        </div>
      </div>
    </div>
  </div>;
}
