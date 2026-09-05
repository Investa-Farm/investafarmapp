import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoredUser, getToken, clearToken, formatKES } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import {
  Briefcase, Users, BarChart2, Bell, LogOut, Plus, ChevronRight,
  ArrowUpRight, Shield, Wallet, DollarSign, Target, X, FileText,
  Globe, Award, AlertCircle, CheckCircle2, TrendingUp, Download,
  ArrowDownToLine, ArrowUpFromLine, Landmark, Clock3,
} from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { NotificationsPanel } from "@/components/notifications-panel";
import { getCropImage } from "@/lib/crops";
import { LogoutConfirmDialog } from "@/components/logout-confirm-dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartPie, Pie, Cell, Legend,
} from "recharts";

const INDIGO = "#4f46e5";
const COLORS = ["#4f46e5", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

type Tab = "overview" | "funds" | "clients" | "reports" | "wallet";

type ClientEntry = {
  id: string;
  name: string;
  allocation: number;
  risk: "low" | "medium" | "high";
  returns: number;
  joined: string;
};

const DEFAULT_CLIENTS: ClientEntry[] = [
  { id: "c1", name: "Kamau Family Trust", allocation: 5_500_000, risk: "low", returns: 14.2, joined: "Jan 2025" },
  { id: "c2", name: "Rift Valley Pension Fund", allocation: 12_000_000, risk: "medium", returns: 18.7, joined: "Feb 2025" },
  { id: "c3", name: "Nairobi Capital Partners", allocation: 8_300_000, risk: "high", returns: 24.1, joined: "Mar 2025" },
  { id: "c4", name: "East Africa SACCO", allocation: 3_200_000, risk: "low", returns: 11.8, joined: "Apr 2025" },
];

const AUM_HISTORY = [
  { month: "Jan", aum: 18_500_000 },
  { month: "Feb", aum: 22_300_000 },
  { month: "Mar", aum: 25_100_000 },
  { month: "Apr", aum: 27_800_000 },
  { month: "May", aum: 26_400_000 },
  { month: "Jun", aum: 29_000_000 },
];

const ALLOCATION_DATA = [
  { name: "Coffee", value: 28 },
  { name: "Maize", value: 22 },
  { name: "Tea", value: 18 },
  { name: "Avocado", value: 16 },
  { name: "Dairy", value: 10 },
  { name: "Other", value: 6 },
];

const FUND_TEMPLATES = [
  { id: "f1", name: "Agri Growth Fund I", aum: 29_000_000, farms: 8, returns: 18.4, risk: "medium", status: "active" as const },
  { id: "f2", name: "East Africa Coffee Fund", aum: 11_200_000, farms: 3, returns: 22.1, risk: "high", status: "active" as const },
  { id: "f3", name: "Stable Grain Portfolio", aum: 8_500_000, farms: 5, returns: 12.6, risk: "low", status: "active" as const },
];

function riskColor(r: string) {
  if (r === "low") return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900";
  if (r === "high") return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900";
  return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900";
}

export default function WealthDashboard() {
  const user = getStoredUser();
  const token = getToken();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const [notifOpen, setNotifOpen] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientEntry[]>(DEFAULT_CLIENTS);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", allocation: "", risk: "medium" as "low"|"medium"|"high" });
  const firmName = sessionStorage.getItem("investa_wealth_firm") || (user as any)?.name || "Your Fund";

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!token,
  });
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const { data: listings = [], isLoading: listingsLoading } = useQuery<any[]>({
    queryKey: ["primary-market"],
    queryFn: async () => {
      const r = await fetch("/api/market/primary", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
    enabled: !!token,
  });

  const totalAUM = clients.reduce((s, c) => s + c.allocation, 0);
  const avgReturn = clients.length ? clients.reduce((s, c) => s + c.returns, 0) / clients.length : 0;
  const totalFarms = FUND_TEMPLATES.reduce((s, f) => s + f.farms, 0);

  function handleAddClient() {
    if (!newClient.name || !newClient.allocation) return;
    const entry: ClientEntry = {
      id: `c${Date.now()}`,
      name: newClient.name,
      allocation: parseFloat(newClient.allocation) * 1000,
      risk: newClient.risk,
      returns: 12 + Math.random() * 10,
      joined: new Date().toLocaleDateString("en-KE", { month: "short", year: "numeric" }),
    };
    setClients(prev => [...prev, entry]);
    setNewClient({ name: "", allocation: "", risk: "medium" });
    setAddClientOpen(false);
  }

  const handleLogout = () => {
    clearToken();
    sessionStorage.removeItem("investa_investor_type");
    sessionStorage.removeItem("investa_wealth_firm");
    sessionStorage.removeItem("investa_wealth_aum");
    setLocation("/");
  };

  const { data: walletData, isLoading: walletLoading } = useQuery<{ balance: number; transactions: any[] }>({
    queryKey: ["wealth-wallet"],
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) return { balance: 0, transactions: [] };
      return r.json();
    },
    enabled: tab === "wallet",
    staleTime: 60_000,
  });
  const walletBalance = walletData?.balance ?? 0;
  const walletTxns: any[] = walletData?.transactions ?? [];

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart2 size={15} /> },
    { id: "funds",    label: "Funds",    icon: <Briefcase size={15} /> },
    { id: "clients",  label: "Clients",  icon: <Users size={15} /> },
    { id: "reports",  label: "Reports",  icon: <FileText size={15} /> },
    { id: "wallet",   label: "Wallet",   icon: <Wallet size={15} /> },
  ];

  return (
    <div className="min-h-dvh w-full bg-[#e9efe9] text-[#163b35]">
      <div className="mx-auto min-h-dvh max-w-[1180px] overflow-hidden bg-[#f7f8f3] pb-24 shadow-[0_0_0_1px_rgba(20,61,53,0.06)]">
        <header className="relative overflow-hidden px-5 pb-7 pt-8 text-white sm:px-8 sm:pt-10" style={{ background: "linear-gradient(122deg, #123b35 0%, #1c5a4d 58%, #2d7460 100%)" }}>
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#b7d6bd]/15" />
          <div className="pointer-events-none absolute -bottom-28 right-20 h-64 w-64 rounded-full border border-[#b7d6bd]/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                <img src={logoSrc} alt="Investa Farm" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c7dfc6]/75">Wealth desk</p>
                <p className="mt-0.5 text-sm font-semibold tracking-tight text-white">{firmName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button data-testid="button-open-notifications" aria-label={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} onClick={() => setNotifOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-[#dce9b1]">
                <Bell size={17} />
                {unreadCount > 0 && <span data-testid="status-unread-notifications" className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#1c5a4d] bg-[#e6b85c] px-1 text-[9px] font-bold text-[#183b34]">{unreadCount}</span>}
              </button>
              <LogoutConfirmDialog onConfirm={handleLogout}>
                <button data-testid="button-logout" aria-label="Log out" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-[#dce9b1]">
                  <LogOut size={16} className="text-white/80" />
                </button>
              </LogoutConfirmDialog>
            </div>
          </div>

          <div className="relative mt-8 max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c7dfc6]/70">
              <span className="h-1.5 w-1.5 rounded-full bg-[#dce9b1]" />
              Portfolio command centre
            </div>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Good morning, {firmName}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#d9e8d8]/75">A clear view of capital deployed across Kenya’s productive farmland, funds and client mandates.</p>
          </div>

          <div className="relative mt-7 grid gap-2 sm:grid-cols-3 sm:gap-3">
            {[
              { label: "Total AUM", value: formatKES(totalAUM), note: "↑ 8.2% this month", test: "text-total-aum" },
              { label: "Average return", value: `+${avgReturn.toFixed(1)}%`, note: "Per season", test: "text-average-return" },
              { label: "Client mandates", value: `${clients.length}`, note: `${totalFarms} farms tracked`, test: "text-client-count" },
            ].map(stat => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#0f3933]/35 px-4 py-3.5 backdrop-blur-sm">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#c7dfc6]/65">{stat.label}</p>
                <p data-testid={stat.test} className="mt-1 text-xl font-semibold tracking-tight text-white">{stat.value}</p>
                <p className="mt-1 text-[10px] font-medium text-[#dce9b1]">{stat.note}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="border-b border-[#dfe7df] bg-[#f7f8f3] px-4 py-3 sm:px-8">
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {TABS.map(t => (
              <button data-testid={`tab-${t.id}`} aria-current={tab === t.id ? "page" : undefined} key={t.id} onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#8cb8a0] ${tab === t.id ? "bg-[#1c5a4d] text-white shadow-sm" : "text-[#61736c] hover:bg-[#e9efe9] hover:text-[#163b35]"}`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>

        <main className="px-4 py-5 sm:px-8 sm:py-7">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-5">
              {tab === "overview" && (
                <>
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6c8178]">Overview</p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#163b35]">Capital at a glance</h2>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-[#6c8178]"><Clock3 size={13} /> Updated for Q2 2025</p>
                  </div>
                  <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
                    <section data-testid="card-aum-growth" className="rounded-3xl border border-[#dfe7df] bg-white p-4 shadow-[0_8px_28px_rgba(25,76,62,0.05)] sm:p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#163b35]">AUM growth</p>
                          <p className="mt-1 text-xs text-[#74857e]">Managed capital, Jan–Jun 2025</p>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full bg-[#e7f1e6] px-2.5 py-1 text-[10px] font-bold text-[#2e7654]"><TrendingUp size={12} /> 8.2%</div>
                      </div>
                      <div className="mt-5 h-52 sm:h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={AUM_HISTORY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <defs><linearGradient id="aumGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={INDIGO} stopOpacity={0.24} /><stop offset="95%" stopColor={INDIGO} stopOpacity={0} /></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5ebe5" />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#789087" }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 10, fill: "#789087" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v: any) => [formatKES(v), "AUM"]} contentStyle={{ borderRadius: 12, border: "1px solid #dfe7df", boxShadow: "0 8px 24px rgba(25,76,62,.1)", fontSize: 11 }} />
                            <Area type="monotone" dataKey="aum" stroke={INDIGO} strokeWidth={2.5} fill="url(#aumGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </section>

                    <section data-testid="card-crop-allocation" className="rounded-3xl border border-[#dfe7df] bg-white p-4 shadow-[0_8px_28px_rgba(25,76,62,0.05)] sm:p-5">
                      <p className="text-sm font-semibold text-[#163b35]">Crop allocation</p>
                      <p className="mt-1 text-xs text-[#74857e]">Diversification across the portfolio</p>
                      <div className="mt-3 flex items-center gap-3 sm:mt-5 sm:gap-5">
                        <div className="h-36 w-36 shrink-0 sm:h-40 sm:w-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartPie><Pie data={ALLOCATION_DATA} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={2}>{ALLOCATION_DATA.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie></RechartPie>
                          </ResponsiveContainer>
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          {ALLOCATION_DATA.map((d, i) => <div data-testid={`allocation-${d.name.toLowerCase()}`} key={d.name} className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="min-w-0 flex-1 truncate text-xs text-[#405a51]">{d.name}</span><span className="text-xs font-semibold text-[#163b35]">{d.value}%</span></div>)}
                        </div>
                      </div>
                    </section>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { icon: <Target size={16} />, label: "Active funds", value: `${FUND_TEMPLATES.length}`, sub: "All performing", tone: "bg-[#e9eef8] text-[#435da1]" },
                      { icon: <Shield size={16} />, label: "Risk profile", value: "Balanced", sub: "Diversified portfolio", tone: "bg-[#e7f1e6] text-[#2e7654]" },
                      { icon: <Award size={16} />, label: "Best return", value: "+24.1%", sub: "Nairobi Capital", tone: "bg-[#f6eddc] text-[#9b6d27]" },
                      { icon: <Globe size={16} />, label: "Counties", value: "12", sub: "Active regions", tone: "bg-[#e8edf1] text-[#4b6876]" },
                    ].map(k => <div data-testid={`kpi-${k.label.toLowerCase().replace(" ", "-")}`} key={k.label} className={`rounded-2xl border border-transparent p-4 ${k.tone}`}><div className="flex items-center gap-2">{k.icon}<p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-75">{k.label}</p></div><p className="mt-3 text-lg font-semibold tracking-tight text-[#163b35]">{k.value}</p><p className="mt-0.5 text-[10px] opacity-75">{k.sub}</p></div>)}
                  </div>
                  <section data-testid="card-available-farms" className="rounded-3xl border border-[#dfe7df] bg-white p-4 shadow-[0_8px_28px_rgba(25,76,62,0.05)] sm:p-5">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#163b35]">Primary market</p><p className="mt-1 text-xs text-[#74857e]">Opportunities available for the next allocation decision</p></div><button data-testid="button-view-market" onClick={() => setLocation("/market/primary")} className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#2e7654] hover:text-[#163b35] focus:outline-none focus:ring-2 focus:ring-[#8cb8a0]">View market <ChevronRight size={14} /></button></div>
                    {listingsLoading ? <div className="mt-5 space-y-3">{[1, 2, 3].map(i => <div key={i} className="flex animate-pulse items-center gap-3"><div className="h-11 w-11 rounded-xl bg-[#e9efe9]" /><div className="flex-1 space-y-2"><div className="h-3 w-1/2 rounded bg-[#e9efe9]" /><div className="h-2 w-1/3 rounded bg-[#edf2ed]" /></div></div>)}</div> : listings.length > 0 ? <div className="mt-5 grid gap-2 sm:grid-cols-3">{listings.slice(0, 3).map((l: any) => <div data-testid={`market-listing-${l.id}`} key={l.id} className="flex items-center gap-3 rounded-2xl bg-[#f4f7f1] p-3"><div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl"><img src={getCropImage(l.cropType, l.imageUrl)} alt={l.farmName} className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#163b35]">{l.farmName}</p><p className="mt-1 truncate text-[10px] text-[#74857e]">{l.cropType} · {l.location}</p></div><div className="text-right"><p className="text-xs font-bold text-[#2e7654]">{l.changePercent >= 0 ? "+" : ""}{l.changePercent?.toFixed(1)}%</p><p className="mt-1 whitespace-nowrap text-[10px] text-[#74857e]">{formatKES(l.sharePrice)}/share</p></div></div>)}</div> : <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-[#cbd9cc] bg-[#f6f9f4] p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f0e5] text-[#2e7654]"><Landmark size={18} /></div><div><p data-testid="empty-market" className="text-xs font-semibold text-[#365b4d]">No opportunities to review yet</p><p className="mt-1 text-[10px] leading-relaxed text-[#74857e]">The primary market will appear here when new farm allocations are available.</p></div></div>}
                  </section>
                </>
              )}

              {tab === "funds" && (
                <>
                  <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6c8178]">Mandates</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-[#163b35]">Managed funds</h2></div><button data-testid="button-new-fund" onClick={() => setLocation("/market/primary")} className="flex items-center gap-1.5 rounded-xl bg-[#1c5a4d] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#123b35] focus:outline-none focus:ring-2 focus:ring-[#8cb8a0]"><Plus size={14} /> New fund</button></div>
                  <div className="grid gap-4 lg:grid-cols-2">{FUND_TEMPLATES.map((fund, i) => <motion.div data-testid={`card-fund-${fund.id}`} key={fund.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-3xl border border-[#dfe7df] bg-white p-5 shadow-[0_8px_28px_rgba(25,76,62,0.05)]"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#163b35]">{fund.name}</p><p className="mt-1 text-xs text-[#74857e]">{fund.farms} farms · {fund.risk} risk</p></div><span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-wide ${riskColor(fund.risk)}`}>{fund.risk.toUpperCase()}</span></div><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-[#f3f6f1] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[#74857e]">AUM</p><p className="mt-1 text-xs font-bold text-[#163b35]">{formatKES(fund.aum)}</p></div><div className="rounded-xl bg-[#f3f6f1] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[#74857e]">Return</p><p className="mt-1 text-xs font-bold text-[#2e7654]">+{fund.returns}%</p></div><div className="rounded-xl bg-[#f3f6f1] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[#74857e]">Status</p><p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#365b4d]"><span className="h-1.5 w-1.5 rounded-full bg-[#55a76d]" /> Active</p></div></div><div className="mt-4 flex gap-2"><button data-testid={`button-add-farm-${fund.id}`} onClick={() => setLocation("/market/primary")} className="flex-1 rounded-xl border border-[#c1d8c6] bg-[#edf5eb] py-2.5 text-xs font-bold text-[#2e7654] transition-colors hover:bg-[#e2efdf] focus:outline-none focus:ring-2 focus:ring-[#8cb8a0]">Add farm</button><button data-testid={`button-view-report-${fund.id}`} onClick={() => setTab("reports")} className="flex-1 rounded-xl border border-[#dfe7df] bg-[#f7f8f3] py-2.5 text-xs font-bold text-[#365b4d] transition-colors hover:bg-[#edf2eb] focus:outline-none focus:ring-2 focus:ring-[#8cb8a0]">View report</button></div></motion.div>)}</div>
                  <div className="flex items-start gap-3 rounded-3xl border border-[#c9d9c9] bg-[#edf5eb] p-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#dcebd9] text-[#2e7654]"><AlertCircle size={17} /></div><div><p className="text-xs font-bold text-[#365b4d]">Build another allocation</p><p className="mt-1 text-[10px] leading-relaxed text-[#5f796e]">Browse the primary market to select farms and shape a custom portfolio for your clients.</p><button data-testid="button-browse-farms" onClick={() => setLocation("/market/primary")} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#1c5a4d] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#123b35] focus:outline-none focus:ring-2 focus:ring-[#8cb8a0]">Browse farms <ArrowUpRight size={12} /></button></div></div>
                </>
              )}

              {tab === "clients" && (
                <>
                  <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6c8178]">Relationships</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-[#163b35]">Client portfolios</h2></div><button data-testid="button-add-client" onClick={() => setAddClientOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-[#1c5a4d] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#123b35] focus:outline-none focus:ring-2 focus:ring-[#8cb8a0]"><Plus size={14} /> Add client</button></div>
                  <div className="grid grid-cols-3 divide-x divide-[#c8d9ca] rounded-3xl border border-[#c9d9c9] bg-[#edf5eb] py-4"><div className="text-center"><p data-testid="text-total-clients" className="text-lg font-semibold text-[#234e42]">{clients.length}</p><p className="mt-1 text-[10px] font-semibold text-[#648072]">Total clients</p></div><div className="text-center"><p data-testid="text-client-aum" className="text-lg font-semibold text-[#234e42]">{formatKES(totalAUM)}</p><p className="mt-1 text-[10px] font-semibold text-[#648072]">Total AUM</p></div><div className="text-center"><p data-testid="text-client-return" className="text-lg font-semibold text-[#234e42]">+{avgReturn.toFixed(1)}%</p><p className="mt-1 text-[10px] font-semibold text-[#648072]">Average return</p></div></div>
                  {clients.length === 0 ? <div className="rounded-3xl border border-dashed border-[#cbd9cc] bg-white p-10 text-center"><Users size={24} className="mx-auto text-[#87a297]" /><p className="mt-3 text-sm font-semibold text-[#365b4d]">No client mandates yet</p><p className="mt-1 text-xs text-[#74857e]">Add a client to begin tracking allocated capital.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{clients.map((client, i) => <motion.div data-testid={`card-client-${client.id}`} key={client.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-3xl border border-[#dfe7df] bg-white p-5 shadow-[0_8px_28px_rgba(25,76,62,0.05)]"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: COLORS[i % COLORS.length] }}>{client.name.charAt(0)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#163b35]">{client.name}</p><p className="mt-1 text-[10px] text-[#74857e]">Since {client.joined}</p></div></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-wide ${riskColor(client.risk)}`}>{client.risk.toUpperCase()}</span></div><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#f3f6f1] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[#74857e]">Allocation</p><p className="mt-1 text-xs font-bold text-[#163b35]">{formatKES(client.allocation)}</p></div><div className="rounded-xl bg-[#f3f6f1] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[#74857e]">Returns</p><p className="mt-1 text-xs font-bold text-[#2e7654]">+{client.returns.toFixed(1)}%</p></div></div></motion.div>)}</div>}
                </>
              )}

              {tab === "reports" && (
                <>
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6c8178]">Decision support</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-[#163b35]">Fund reports</h2><p className="mt-1 text-xs text-[#74857e]">A concise read on performance, fees and client value.</p></div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <section data-testid="card-performance-summary" className="rounded-3xl border border-[#dfe7df] bg-white p-5 shadow-[0_8px_28px_rgba(25,76,62,0.05)]"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-[#163b35]">Q2 2025 summary</p><span className="rounded-full bg-[#e7f1e6] px-2.5 py-1 text-[9px] font-bold text-[#2e7654]">Live data</span></div>{[{ label: "Total returns generated", value: formatKES(totalAUM * (avgReturn / 100)), positive: true }, { label: "Management fees (1.5%)", value: formatKES(totalAUM * 0.015), positive: false }, { label: "Net client returns", value: formatKES(totalAUM * ((avgReturn - 1.5) / 100)), positive: true }, { label: "New capital raised", value: formatKES(3_500_000), positive: true }].map(row => <div data-testid={`report-row-${row.label.toLowerCase().replaceAll(" ", "-")}`} key={row.label} className="flex items-center justify-between gap-3 border-b border-[#edf1eb] py-3 last:border-0"><p className="text-xs text-[#74857e]">{row.label}</p><p className={`whitespace-nowrap text-xs font-bold ${row.positive ? "text-[#2e7654]" : "text-[#365b4d]"}`}>{row.value}</p></div>)}</section>
                    <section data-testid="card-fund-performance" className="rounded-3xl border border-[#dfe7df] bg-white p-5 shadow-[0_8px_28px_rgba(25,76,62,0.05)]"><p className="text-sm font-semibold text-[#163b35]">Fund performance</p><div className="mt-5 space-y-5">{FUND_TEMPLATES.map(fund => <div key={fund.id}><div className="mb-2 flex items-center justify-between gap-3"><p className="truncate text-xs font-semibold text-[#365b4d]">{fund.name}</p><p className="text-xs font-bold text-[#2e7654]">+{fund.returns}%</p></div><div className="h-2 overflow-hidden rounded-full bg-[#e8eee7]"><div className="h-full rounded-full bg-[#527e6d]" style={{ width: `${(fund.returns / 30) * 100}%` }} /></div></div>)}</div></section>
                  </div>
                  {downloadNotice && <div data-testid="status-download-notice" className="flex items-start gap-3 rounded-3xl border border-[#cbd9ed] bg-[#edf2fa] px-4 py-3.5"><AlertCircle size={15} className="mt-0.5 shrink-0 text-[#526ba6]" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#435d96]">{downloadNotice}</p><p className="mt-1 text-[11px] leading-relaxed text-[#6279ac]">Reports will be available once your fund is CMA-registered. Contact <span className="font-medium">support@investafarm.com</span> to begin the process.</p></div><button data-testid="button-dismiss-download-notice" aria-label="Dismiss report notice" onClick={() => setDownloadNotice(null)} className="shrink-0 text-[#526ba6] hover:text-[#31477d] focus:outline-none focus:ring-2 focus:ring-[#8cb8a0]"><CheckCircle2 size={15} /></button></div>}
                  <div className="grid gap-2 sm:grid-cols-3">{[{ label: "Q2 2025 Full Report", icon: <FileText size={15} /> }, { label: "Client Statement — All", icon: <Users size={15} /> }, { label: "Tax Summary 2024/25", icon: <DollarSign size={15} /> }].map(r => <button data-testid={`button-download-${r.label.toLowerCase().replaceAll(" ", "-")}`} key={r.label} onClick={() => setDownloadNotice(`"${r.label}" requires CMA registration`)} className="flex items-center justify-between gap-3 rounded-2xl border border-[#dfe7df] bg-white px-4 py-3.5 text-left transition-colors hover:bg-[#f3f6f1] focus:outline-none focus:ring-2 focus:ring-[#8cb8a0]"><span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf5eb] text-[#2e7654]">{r.icon}</span><span className="truncate text-xs font-semibold text-[#365b4d]">{r.label}</span></span><Download size={14} className="shrink-0 text-[#74857e]" /></button>)}</div>
                  <div className="flex items-start gap-2.5 rounded-2xl border border-[#ead8ae] bg-[#faf4e7] p-3.5"><AlertCircle size={14} className="mt-0.5 shrink-0 text-[#a57729]" /><p className="text-xs leading-relaxed text-[#87662e]">Reports are generated from live portfolio data. Download functionality requires CMA registration for fund managers in Kenya.</p></div>
                </>
              )}

              {tab === "wallet" && (
                <>
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6c8178]">Treasury</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-[#163b35]">Fund wallet</h2><p className="mt-1 text-xs text-[#74857e]">Move capital into the opportunities you have approved.</p></div>
                  <section data-testid="card-wallet-balance" className="overflow-hidden rounded-3xl bg-[#163f37] text-white shadow-[0_12px_30px_rgba(22,63,55,0.18)]"><div className="flex flex-col justify-between gap-5 px-5 pb-6 pt-5 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8d4bc]/75">Available balance</p>{walletLoading ? <div className="mt-3 h-9 w-44 animate-pulse rounded-lg bg-white/15" /> : <p data-testid="text-wallet-balance" className="mt-2 text-3xl font-semibold tracking-tight">{formatKES(walletBalance)}</p>}<p className="mt-2 text-xs text-[#b8d4bc]/75">Fund manager wallet · {user?.name}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10"><Wallet size={18} /></div></div><div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10"><a data-testid="link-add-funds" href="/wallet" className="flex items-center justify-center gap-2 py-3.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"><ArrowDownToLine size={14} /> Add funds</a><a data-testid="link-withdraw-funds" href="/wallet" className="flex items-center justify-center gap-2 py-3.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"><ArrowUpFromLine size={14} /> Withdraw</a></div></section>
                  <section data-testid="card-transactions" className="rounded-3xl border border-[#dfe7df] bg-white p-5 shadow-[0_8px_28px_rgba(25,76,62,0.05)]"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-[#163b35]">Recent transactions</p><span className="text-[10px] font-medium text-[#74857e]">Last 6</span></div>{walletLoading ? <div className="mt-5 space-y-4">{[1, 2, 3].map(i => <div key={i} className="flex animate-pulse items-center gap-3"><div className="h-9 w-9 rounded-xl bg-[#e9efe9]" /><div className="flex-1 space-y-2"><div className="h-3 w-1/2 rounded bg-[#e9efe9]" /><div className="h-2 w-1/4 rounded bg-[#edf2ed]" /></div></div>)}</div> : walletTxns.length === 0 ? <div data-testid="empty-wallet-transactions" className="py-9 text-center"><Wallet size={25} className="mx-auto text-[#87a297]" /><p className="mt-3 text-sm font-semibold text-[#365b4d]">No transactions yet</p><p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[#74857e]">Add funds to start investing in farm portfolios.</p></div> : <div className="mt-5 space-y-3">{walletTxns.slice(0, 6).map((tx: any, i: number) => { const isIn = (tx.amount ?? 0) > 0 || tx.type === "deposit" || tx.type === "dividend"; return <div data-testid={`transaction-${tx.id ?? i}`} key={tx.id ?? i} className="flex items-center gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isIn ? "bg-[#e7f1e6] text-[#2e7654]" : "bg-[#f8eaea] text-[#b45353]"}`}>{isIn ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#365b4d]">{tx.description ?? tx.type ?? "Transaction"}</p><p className="mt-1 text-[10px] text-[#74857e]">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "—"}</p></div><p className={`shrink-0 text-xs font-bold ${isIn ? "text-[#2e7654]" : "text-[#b45353]"}`}>{isIn ? "+" : "-"}{formatKES(Math.abs(tx.amount ?? 0))}</p></div> })}</div>}</section>
                  <section className="rounded-3xl border border-[#c9d9c9] bg-[#edf5eb] p-5"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#557668]">Shortcuts</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{[{ label: "Invest in farm portfolio", desc: "Browse active farms and allocate capital", icon: <Briefcase size={16} />, href: "/market" }, { label: "View full portfolio", desc: "Track holdings and performance", icon: <BarChart2 size={16} />, href: "/portfolio" }].map(a => <a data-testid={`link-${a.label.toLowerCase().replaceAll(" ", "-")}`} key={a.label} href={a.href} className="flex items-center gap-3 rounded-2xl border border-[#d6e4d4] bg-white/70 px-3.5 py-3 text-left transition-colors hover:bg-white"><span className="text-[#2e7654]">{a.icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#365b4d]">{a.label}</span><span className="mt-1 block truncate text-[10px] text-[#74857e]">{a.desc}</span></span><ArrowUpRight size={13} className="shrink-0 text-[#74857e]" /></a>)}</div></section>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {addClientOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-[#123b35]/10 sm:items-center"><div className="absolute inset-0 bg-[#102d29]/55 backdrop-blur-sm" onClick={() => setAddClientOpen(false)} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="relative w-full max-w-lg rounded-t-3xl bg-[#f7f8f3] p-6 shadow-2xl sm:rounded-3xl"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6c8178]">New relationship</p><p className="mt-1 text-lg font-semibold tracking-tight text-[#163b35]">Add client</p></div><button data-testid="button-close-add-client" aria-label="Close add client dialog" onClick={() => setAddClientOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e9efe9] text-[#365b4d] hover:bg-[#dfe9df] focus:outline-none focus:ring-2 focus:ring-[#8cb8a0]"><X size={16} /></button></div><div className="mt-6 space-y-4"><div><label htmlFor="client-name" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#6c8178]">Client / fund name</label><input id="client-name" data-testid="input-client-name" type="text" value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Kamau Family Trust" className="w-full rounded-xl border border-[#d4e0d5] bg-white px-4 py-3 text-sm text-[#163b35] outline-none placeholder:text-[#9aaba1] focus:border-[#6b9b84] focus:ring-2 focus:ring-[#d9e9d8]" /></div><div><label htmlFor="client-allocation" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#6c8178]">Allocation (KES thousands)</label><input id="client-allocation" data-testid="input-client-allocation" type="text" inputMode="decimal" value={newClient.allocation} onChange={e => setNewClient(p => ({ ...p, allocation: e.target.value.replace(/[^0-9.]/g, "") }))} placeholder="e.g. 5000 = KES 5,000,000" className="w-full rounded-xl border border-[#d4e0d5] bg-white px-4 py-3 text-sm text-[#163b35] outline-none placeholder:text-[#9aaba1] focus:border-[#6b9b84] focus:ring-2 focus:ring-[#d9e9d8]" /></div><fieldset><legend className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#6c8178]">Risk profile</legend><div className="flex gap-2">{(["low", "medium", "high"] as const).map(r => <button data-testid={`button-risk-${r}`} key={r} type="button" aria-pressed={newClient.risk === r} onClick={() => setNewClient(p => ({ ...p, risk: r }))} className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#8cb8a0] ${newClient.risk === r ? riskColor(r) : "border-[#d4e0d5] bg-white text-[#74857e]"}`}>{r.charAt(0).toUpperCase() + r.slice(1)}</button>)}</div></fieldset><button data-testid="button-submit-client" onClick={handleAddClient} className="w-full rounded-xl bg-[#1c5a4d] py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#123b35] focus:outline-none focus:ring-2 focus:ring-[#8cb8a0]">Add client</button></div></motion.div></motion.div>}
        </AnimatePresence>

        <nav aria-label="Dashboard sections" className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-[1180px] -translate-x-1/2 items-center justify-around border-t border-[#dfe7df] bg-[#f7f8f3]/95 px-2 py-2.5 backdrop-blur-md sm:px-8">
          {TABS.map(item => <button data-testid={`bottom-tab-${item.id}`} aria-current={tab === item.id ? "page" : undefined} key={item.id} onClick={() => setTab(item.id)} className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#8cb8a0] ${tab === item.id ? "text-[#1c5a4d]" : "text-[#789087] hover:text-[#365b4d]"}`}>{item.icon}<span>{item.label}</span></button>)}
        </nav>
        <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      </div>
    </div>
  );
}
