import "./_group.css";
import {
  ArrowUpRight, Bell, ChevronRight, Clock, Map, MoreHorizontal,
  Newspaper, Star, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";

const tickers = [
  ["Maize", "4,200", "/bag", "+2.1%"], ["Tomatoes", "120", "/kg", "−1.3%"],
  ["Avocado", "18,500", "/100kg", "+0.8%"], ["Tea", "65", "/kg", "+1.4%"],
  ["Coffee", "680", "/kg", "−0.6%"], ["Beans", "1,450", "/kg", "+3.2%"],
];
const movers = [
  { crop: "Coffee", name: "Kiamaina Coffee Estate", place: "Kirinyaga County", change: "+8.4%", amount: "KES 1,250", img: "coffee.jpg", up: true },
  { crop: "Maize", name: "Green Valley Maize Farm", place: "Trans Nzoia County", change: "+6.2%", amount: "KES 850", img: "maize.jpg", up: true },
];

function BottomNav() {
  return <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex h-[66px] max-w-[960px] items-center justify-around border-t border-border bg-white/95 px-2 backdrop-blur">
    {[["Market", TrendingUp], ["Portfolio", Map], ["Activity", Clock], ["Profile", Star]].map(([label, Icon]: any, i) =>
      <button key={label} className={`flex min-w-[58px] flex-col items-center gap-1 text-[9px] font-semibold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
        <Icon size={18} strokeWidth={i === 0 ? 2.5 : 1.8} />{label}
      </button>)}
  </nav>;
}

export function Current() {
  return <div className="investa-current min-h-screen bg-background text-foreground">
    <main className="app-shell market-shell pb-24">
      <header className="relative border-b border-border bg-background px-5 pt-12">
        <div className="pointer-events-none absolute inset-0 opacity-[.03]" style={{ backgroundImage: "radial-gradient(circle,#16a34a 1px,transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="relative mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <img src="/__mockup/images/investa-current/logo.png" alt="Investa Farm" className="h-7 w-auto" />
                <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-100 px-1.5 py-0.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-green-700">Live</span>
                </span>
              </div>
              <h1 className="flex items-center gap-1.5 text-xl font-bold">Live Market <TrendingUp size={16} className="text-primary" /></h1>
              <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">Compare verified farms, market momentum, and seasonal opportunities.</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1.5 text-white shadow-sm shadow-primary/30">
                <Wallet size={12} /><span className="text-xs font-bold">KES 18,450</span><ArrowUpRight size={11} />
              </button>
              <button className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-sm"><Bell size={15} /><span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[7px] font-bold text-white">2</span></button>
              <button className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-sm"><MoreHorizontal size={16} /></button>
            </div>
          </div>
        </div>
        <div className="relative mb-0 overflow-hidden rounded-xl border-t border-border" style={{ background: "rgba(0,0,0,.03)" }}>
          <div className="ticker-track flex whitespace-nowrap py-2">
            {[...tickers, ...tickers].map(([name, price, unit, change], i) =>
              <span key={i} className="inline-flex shrink-0 items-center gap-1 px-3.5 text-xs">
                <b>{name}</b><span className="text-[10px] text-muted-foreground">KES {price}{unit}</span>
                <b className={`text-[10px] ${change.startsWith("+") ? "text-green-600" : "text-red-500"}`}>{change.startsWith("+") ? "▲" : "▼"}{change.slice(1)}</b><span className="ml-1 text-[10px] text-border">·</span>
              </span>)}
          </div>
        </div>
      </header>

      <section className="px-4 pt-4">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-[#052e16] via-[#14532d] to-[#166534] p-4 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[9px] font-black uppercase tracking-[.2em] text-green-200/70">Investor snapshot</p>
              <p className="mt-1 text-xs font-medium text-green-100/75">Total portfolio value</p>
              <p className="mt-1 text-2xl font-black tracking-tight">KES 284,650</p></div>
            <button className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white px-3 py-2 text-[11px] font-extrabold text-[#14532d] shadow-sm">Browse farms <ChevronRight size={13} /></button>
          </div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-3">
            <div className="pr-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-green-100/55">Today’s P&amp;L</p><p className="mt-1 text-sm font-extrabold text-green-200">+KES 3,420</p><p className="mt-0.5 text-[10px] font-semibold text-green-100/65">+1.2%</p></div>
            <div className="px-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-green-100/55">Wallet balance</p><p className="mt-1 text-sm font-extrabold">KES 18,450</p><p className="mt-0.5 text-[10px] font-medium text-green-100/65">Available to invest</p></div>
            <div className="pl-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-green-100/55">Holdings</p><p className="mt-1 text-sm font-extrabold">4</p><p className="mt-0.5 text-[10px] font-medium text-green-100/65">Active positions</p></div>
          </div>
        </div>
      </section>

      <section className="mx-4 mt-3 rounded-xl bg-gradient-to-br from-[#052e16] to-[#166534] p-3 text-white">
        <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Getting Started</span><span className="text-[10px] text-white/60">3/4</span></div><span className="text-[10px]">75%</span></div>
        <div className="mb-2 h-0.5 w-full rounded-full bg-white/20"><div className="h-0.5 w-3/4 rounded-full bg-green-400" /></div>
        {[["✓", "Verify email", "Done"], ["✓", "Complete KYC", "Done"], ["✓", "Fund wallet", "Done"], ["4", "First investment", "Browse →"]].map(([n, label, status], i) =>
          <div key={label} className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 ${i < 3 ? "bg-green-900/30" : "bg-white/10"}`}>
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${i < 3 ? "bg-green-400 text-white" : "border border-white/30 bg-white/25 text-white"}`}>{n}</span>
            <span className={`flex-1 text-[11px] ${i < 3 ? "text-green-300 line-through" : "font-medium text-white"}`}>{label}</span>
            <span className={`text-[9px] font-bold ${i < 3 ? "text-green-400" : "rounded-full bg-white/20 px-1.5 py-0.5 text-white"}`}>{status}</span>
          </div>)}
      </section>

      <section className="px-4 pt-3">
        <div className="flex gap-1 rounded-2xl border border-border/70 bg-muted/70 p-1">
          {[[TrendingUp, "Market"], [Newspaper, "News"], [Star, "Watchlist"]].map(([Icon, name]: any, i) =>
            <button key={name} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold ${i === 0 ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}><Icon size={13} className={i === 0 ? "text-primary" : ""} />{name}</button>)}
        </div>
      </section>

      <div className="space-y-5 px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          {[["New Issue", "Primary Market", "maize.jpg", "from-primary/85 via-green-800/70 to-green-950/60"], ["Resale", "Secondary Market", "coffee.jpg", "from-amber-800/85 via-amber-900/70 to-amber-950/60"]].map(([tag, title, img, grad]) =>
            <div key={title} className="relative h-16 overflow-hidden rounded-2xl shadow-md"><img src={`/__mockup/images/investa-current/${img}`} alt="" className="absolute inset-0 h-full w-full object-cover" /><div className={`absolute inset-0 flex flex-col items-start justify-center bg-gradient-to-br ${grad} px-3`}><span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white/80">{tag}</span><b className="mt-1 text-xs leading-tight text-white">{title}</b></div></div>)}
        </div>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex gap-0.5 rounded-full bg-muted p-0.5"><button className="flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-1 text-[10px] font-bold text-white"><TrendingUp size={9} /> Gainers</button><button className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold text-muted-foreground"><TrendingDown size={9} /> Decliners</button></div>
            <button className="flex items-center gap-0.5 text-xs font-medium text-primary">All <ChevronRight size={13} /></button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {movers.map(item => <article key={item.name} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
              <img src={`/__mockup/images/investa-current/${item.img}`} alt="" className="h-14 w-14 rounded-xl object-cover" />
              <div className="min-w-0 flex-1"><div className="flex items-center justify-between"><span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{item.crop} · {item.place}</span><span className="text-[10px] font-bold text-green-600">{item.change}</span></div><p className="mt-1 truncate text-xs font-bold">{item.name}</p><p className="mt-1 text-[10px] text-muted-foreground">Share price <b className="text-foreground">{item.amount}</b></p></div>
            </article>)}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold">Featured Listings</h2><button className="text-xs font-semibold text-primary">View all →</button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Green Valley Maize Farm", "Trans Nzoia · Maize", "maize.jpg", "KES 850", "18%", "320 shares left"],
              ["Kiamaina Coffee Estate", "Kirinyaga · Coffee", "coffee.jpg", "KES 1,250", "24%", "184 shares left"],
            ].map(([name, detail, img, price, roi, shares], i) => <article key={name} className="overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-lg shadow-green-600/10">
              {i === 0 && <div className="bg-primary px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-white">Featured Listing</div>}
              <div className={`flex items-center gap-3 p-3 ${i === 0 ? "bg-primary/5" : ""}`}><img src={`/__mockup/images/investa-current/${img}`} className="h-14 w-14 rounded-xl object-cover" alt="" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{name}</p><p className="text-[10px] text-muted-foreground">{detail}</p><p className="mt-1 text-[10px] text-muted-foreground">{shares}</p></div></div>
              <div className="flex items-center justify-between border-t border-border px-3 py-2"><div><b className="text-xs">{price}</b><span className="ml-2 text-[10px] text-muted-foreground">per share</span></div><span className="text-[10px] font-bold text-green-600">+{roi} projected</span></div>
            </article>)}
          </div>
        </section>
      </div>
      <BottomNav />
    </main>
  </div>;
}
