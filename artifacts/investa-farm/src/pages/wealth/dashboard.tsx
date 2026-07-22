import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoredUser, getToken, clearToken, formatKES } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import {
  Briefcase, TrendingUp, TrendingDown, Users, PieChart, BarChart2,
  Bell, LogOut, Plus, ChevronRight, ArrowUpRight, Shield, Wallet,
  DollarSign, Target, Activity, X, Settings, FileText, Star,
  Building2, Globe, Award, AlertCircle, CheckCircle2,
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

  const { data: listings = [] } = useQuery<any[]>({
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

  const { data: walletData } = useQuery<{ balance: number; transactions: any[] }>({
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
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background flex flex-col pb-24">
      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-12 pb-6"
        style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
              <img src={logoSrc} alt="" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            </div>
            <div>
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider">Wealth Management</p>
              <p className="text-white font-bold text-sm leading-tight">{firmName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setNotifOpen(true)} className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <Bell size={16} className="text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadCount}</span>
              )}
            </button>
            <LogoutConfirmDialog onConfirm={handleLogout}>
              <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <LogOut size={15} className="text-white/70" />
              </button>
            </LogoutConfirmDialog>
          </div>
        </div>

        {/* AUM hero stats */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
            <p className="text-white/50 text-[9px] font-semibold uppercase tracking-wider mb-1">Total AUM</p>
            <p className="text-white font-black text-base leading-tight">{formatKES(totalAUM)}</p>
            <p className="text-green-300 text-[9px] font-semibold mt-0.5">↑ 8.2% this month</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
            <p className="text-white/50 text-[9px] font-semibold uppercase tracking-wider mb-1">Avg Return</p>
            <p className="text-white font-black text-base leading-tight">+{avgReturn.toFixed(1)}%</p>
            <p className="text-green-300 text-[9px] font-semibold mt-0.5">Per season</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
            <p className="text-white/50 text-[9px] font-semibold uppercase tracking-wider mb-1">Clients</p>
            <p className="text-white font-black text-base leading-tight">{clients.length}</p>
            <p className="text-green-300 text-[9px] font-semibold mt-0.5">{totalFarms} farms</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-3 bg-background border-b border-border overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              tab === t.id ? "text-white shadow-sm" : "text-muted-foreground bg-muted"
            }`}
            style={tab === t.id ? { background: INDIGO } : {}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-4">

            {/* ── OVERVIEW TAB ── */}
            {tab === "overview" && (
              <>
                {/* AUM chart */}
                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="font-bold text-foreground text-sm mb-3">AUM Growth</p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={AUM_HISTORY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="aumGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={INDIGO} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={INDIGO} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                        <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(v: any) => [formatKES(v), "AUM"]} />
                        <Area type="monotone" dataKey="aum" stroke={INDIGO} strokeWidth={2} fill="url(#aumGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Allocation donut */}
                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="font-bold text-foreground text-sm mb-3">Portfolio Allocation by Crop</p>
                  <div className="flex items-center gap-4">
                    <div className="h-32 w-32 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartPie>
                          <Pie data={ALLOCATION_DATA} cx="50%" cy="50%" innerRadius={28} outerRadius={52}
                            dataKey="value" paddingAngle={2}>
                            {ALLOCATION_DATA.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                        </RechartPie>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {ALLOCATION_DATA.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-foreground text-xs flex-1">{d.name}</span>
                          <span className="text-muted-foreground text-xs font-semibold">{d.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick KPIs */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: <Target size={16} className="text-indigo-600" />, label: "Active Funds", value: `${FUND_TEMPLATES.length}`, sub: "All performing", bg: "bg-indigo-50", border: "border-indigo-100" },
                    { icon: <Shield size={16} className="text-green-600" />, label: "Risk Score", value: "Balanced", sub: "Diversified portfolio", bg: "bg-green-50", border: "border-green-100" },
                    { icon: <Award size={16} className="text-amber-600" />, label: "Best Return", value: "+24.1%", sub: "Nairobi Capital", bg: "bg-amber-50", border: "border-amber-100" },
                    { icon: <Globe size={16} className="text-blue-600" />, label: "Counties", value: "12", sub: "Active regions", bg: "bg-blue-50", border: "border-blue-100" },
                  ].map(k => (
                    <div key={k.label} className={`${k.bg} border ${k.border} rounded-2xl p-3.5`}>
                      <div className="flex items-center gap-2 mb-1.5">{k.icon}<p className="text-foreground/60 text-[10px] font-semibold uppercase tracking-wider">{k.label}</p></div>
                      <p className="text-foreground font-bold text-base">{k.value}</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{k.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Top farms available */}
                {listings.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-bold text-foreground text-sm">Available Farms</p>
                      <button onClick={() => setLocation("/market/primary")} className="text-indigo-600 text-xs font-semibold">View all →</button>
                    </div>
                    <div className="space-y-2.5">
                      {listings.slice(0, 3).map((l: any) => (
                        <div key={l.id} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                            <img src={getCropImage(l.cropType, l.imageUrl)} alt={l.farmName} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground text-xs font-semibold truncate">{l.farmName}</p>
                            <p className="text-muted-foreground text-[10px]">{l.cropType} · {l.location}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-green-600 text-xs font-bold">{l.changePercent >= 0 ? "+" : ""}{l.changePercent?.toFixed(1)}%</p>
                            <p className="text-muted-foreground text-[10px]">{formatKES(l.sharePrice)}/share</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── FUNDS TAB ── */}
            {tab === "funds" && (
              <>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground text-base">Managed Funds</p>
                  <button onClick={() => setLocation("/market/primary")}
                    className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform">
                    <Plus size={13} /> New Fund
                  </button>
                </div>

                {FUND_TEMPLATES.map(fund => (
                  <motion.div key={fund.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl border border-border p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-foreground text-sm">{fund.name}</p>
                        <p className="text-muted-foreground text-[10px] mt-0.5">{fund.farms} farms · {fund.risk} risk</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskColor(fund.risk)}`}>
                        {fund.risk.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted rounded-xl p-2.5 text-center">
                        <p className="text-muted-foreground text-[9px] uppercase font-semibold">AUM</p>
                        <p className="text-foreground font-bold text-xs mt-0.5">{formatKES(fund.aum)}</p>
                      </div>
                      <div className="bg-muted rounded-xl p-2.5 text-center">
                        <p className="text-muted-foreground text-[9px] uppercase font-semibold">Return</p>
                        <p className="text-green-600 font-bold text-xs mt-0.5">+{fund.returns}%</p>
                      </div>
                      <div className="bg-muted rounded-xl p-2.5 text-center">
                        <p className="text-muted-foreground text-[9px] uppercase font-semibold">Status</p>
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <p className="text-foreground font-bold text-[10px]">Active</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setLocation("/market/primary")}
                        className="flex-1 border border-indigo-200 text-indigo-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform bg-indigo-50">
                        Add Farm
                      </button>
                      <button onClick={() => setTab("reports")}
                        className="flex-1 border border-border text-foreground text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform bg-muted">
                        View Report
                      </button>
                    </div>
                  </motion.div>
                ))}

                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle size={16} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-indigo-800 font-semibold text-xs">Create a new fund</p>
                    <p className="text-indigo-600 text-[10px] mt-0.5 leading-snug">Browse the primary market to select farms and build a custom agricultural fund portfolio for your clients.</p>
                    <button onClick={() => setLocation("/market/primary")}
                      className="mt-2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                      Browse Farms →
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── CLIENTS TAB ── */}
            {tab === "clients" && (
              <>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground text-base">Client Portfolios</p>
                  <button onClick={() => setAddClientOpen(true)}
                    className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform">
                    <Plus size={13} /> Add Client
                  </button>
                </div>

                {/* Summary bar */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center gap-4">
                  <div className="flex-1 text-center">
                    <p className="text-indigo-800 font-black text-base">{clients.length}</p>
                    <p className="text-indigo-600 text-[10px] font-semibold">Total Clients</p>
                  </div>
                  <div className="w-px h-8 bg-indigo-200" />
                  <div className="flex-1 text-center">
                    <p className="text-indigo-800 font-black text-base">{formatKES(totalAUM)}</p>
                    <p className="text-indigo-600 text-[10px] font-semibold">Total AUM</p>
                  </div>
                  <div className="w-px h-8 bg-indigo-200" />
                  <div className="flex-1 text-center">
                    <p className="text-indigo-800 font-black text-base">+{avgReturn.toFixed(1)}%</p>
                    <p className="text-indigo-600 text-[10px] font-semibold">Avg Return</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {clients.map((client, i) => (
                    <motion.div key={client.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card rounded-2xl border border-border p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                            style={{ background: COLORS[i % COLORS.length] }}>
                            {client.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-foreground font-semibold text-sm leading-tight">{client.name}</p>
                            <p className="text-muted-foreground text-[10px]">Since {client.joined}</p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${riskColor(client.risk)}`}>
                          {client.risk.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted rounded-xl p-2.5">
                          <p className="text-muted-foreground text-[9px] uppercase font-semibold">Allocation</p>
                          <p className="text-foreground font-bold text-xs mt-0.5">{formatKES(client.allocation)}</p>
                        </div>
                        <div className="bg-muted rounded-xl p-2.5">
                          <p className="text-muted-foreground text-[9px] uppercase font-semibold">Returns</p>
                          <p className="text-green-600 font-bold text-xs mt-0.5">+{client.returns.toFixed(1)}%</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {/* ── REPORTS TAB ── */}
            {tab === "reports" && (
              <>
                <p className="font-bold text-foreground text-base">Fund Reports</p>

                {/* Performance summary */}
                <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                  <p className="font-semibold text-foreground text-sm">Q2 2025 Performance Summary</p>
                  {[
                    { label: "Total Returns Generated", value: formatKES(totalAUM * (avgReturn / 100)), positive: true },
                    { label: "Management Fees (1.5%)", value: formatKES(totalAUM * 0.015), positive: false },
                    { label: "Net Client Returns", value: formatKES(totalAUM * ((avgReturn - 1.5) / 100)), positive: true },
                    { label: "New Capital Raised", value: formatKES(3_500_000), positive: true },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <p className="text-muted-foreground text-xs">{row.label}</p>
                      <p className={`text-xs font-bold ${row.positive ? "text-green-600" : "text-foreground"}`}>{row.value}</p>
                    </div>
                  ))}
                </div>

                {/* Fund performance table */}
                <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                  <p className="font-semibold text-foreground text-sm">Fund Performance</p>
                  {FUND_TEMPLATES.map(fund => (
                    <div key={fund.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-foreground text-xs font-semibold">{fund.name}</p>
                        <p className="text-green-600 text-xs font-bold">+{fund.returns}%</p>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(fund.returns / 30) * 100}%`, background: INDIGO }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Report download buttons */}
                {downloadNotice && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
                    <AlertCircle size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-indigo-800 font-semibold text-xs">{downloadNotice}</p>
                      <p className="text-indigo-600 text-[11px] mt-0.5">Reports will be available once your fund is CMA-registered. Contact <span className="font-medium">support@investafarm.com</span> to begin the process.</p>
                    </div>
                    <button onClick={() => setDownloadNotice(null)} className="text-indigo-400 hover:text-indigo-600 flex-shrink-0">
                      <CheckCircle2 size={14} />
                    </button>
                  </div>
                )}
                <div className="space-y-2">
                  {[
                    { label: "Q2 2025 Full Report", icon: <FileText size={14} /> },
                    { label: "Client Statement — All", icon: <Users size={14} /> },
                    { label: "Tax Summary 2024/25", icon: <DollarSign size={14} /> },
                  ].map(r => (
                    <button key={r.label}
                      onClick={() => setDownloadNotice(`"${r.label}" requires CMA registration`)}
                      className="w-full flex items-center justify-between bg-card border border-border rounded-2xl px-4 py-3.5 active:scale-95 transition-transform">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">{r.icon}</div>
                        <p className="text-foreground text-sm font-medium">{r.label}</p>
                      </div>
                      <ArrowUpRight size={14} className="text-muted-foreground" />
                    </button>
                  ))}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex gap-2">
                  <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-700 text-xs leading-relaxed">Reports are generated from live portfolio data. Download functionality requires CMA registration for fund managers in Kenya.</p>
                </div>
              </>
            )}

            {/* ── WALLET TAB ── */}
            {tab === "wallet" && (
              <>
                <p className="font-bold text-foreground text-base">Fund Wallet</p>

                <div className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 60%,#4f46e5 100%)" }}>
                  <div className="px-5 pt-5 pb-4">
                    <p className="text-indigo-200 text-[10px] font-semibold uppercase tracking-wider mb-1">Available Balance</p>
                    <p className="text-white font-black text-3xl">{formatKES(walletBalance)}</p>
                    <p className="text-indigo-200 text-xs mt-1.5">Fund Manager Wallet · {user?.name}</p>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10">
                    <a href="/wallet" className="py-3 text-center text-white/80 text-xs font-semibold active:bg-white/10 transition-colors block">＋ Add Funds</a>
                    <a href="/wallet" className="py-3 text-center text-white/80 text-xs font-semibold active:bg-white/10 transition-colors block">↑ Withdraw</a>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="font-semibold text-foreground text-sm mb-3">Recent Transactions</p>
                  {walletTxns.length === 0 ? (
                    <div className="text-center py-6">
                      <Wallet size={24} className="text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No transactions yet</p>
                      <p className="text-muted-foreground text-xs mt-0.5">Add funds to start investing in farm portfolios</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {walletTxns.slice(0, 6).map((tx: any, i: number) => {
                        const isIn = (tx.amount ?? 0) > 0 || tx.type === "deposit" || tx.type === "dividend";
                        return (
                          <div key={tx.id ?? i} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isIn ? "bg-green-50" : "bg-red-50"}`}>
                              <span className="text-sm">{isIn ? "↓" : "↑"}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground text-xs font-semibold truncate">{tx.description ?? tx.type ?? "Transaction"}</p>
                              <p className="text-muted-foreground text-[9px]">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "—"}</p>
                            </div>
                            <p className={`text-xs font-bold flex-shrink-0 ${isIn ? "text-green-600" : "text-red-500"}`}>
                              {isIn ? "+" : "-"}{formatKES(Math.abs(tx.amount ?? 0))}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                  <p className="text-indigo-800 text-xs font-bold mb-3">Quick Actions</p>
                  <div className="space-y-2">
                    {[
                      { label: "Invest in Farm Portfolio", desc: "Browse active farms and allocate client capital", icon: "🌾", href: "/market"    },
                      { label: "View Full Portfolio",       desc: "Track all fund holdings and performance",        icon: "📊", href: "/portfolio" },
                    ].map(a => (
                      <a key={a.label} href={a.href}
                        className="w-full flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-indigo-100 active:scale-95 transition-all text-left no-underline">
                        <span className="text-base">{a.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-indigo-800 text-xs font-semibold">{a.label}</p>
                          <p className="text-indigo-400 text-[9px]">{a.desc}</p>
                        </div>
                        <ArrowUpRight size={12} className="text-indigo-400 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Add client modal */}
      <AnimatePresence>
        {addClientOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center max-w-[430px] mx-auto">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAddClientOpen(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full bg-background rounded-t-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="font-bold text-foreground text-base">Add New Client</p>
                <button onClick={() => setAddClientOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider block mb-1.5">Client / Fund Name</label>
                  <input type="text" value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Kamau Family Trust"
                    className="w-full border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-indigo-500 bg-muted" />
                </div>
                <div>
                  <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider block mb-1.5">Allocation (KES thousands)</label>
                  <input type="text" inputMode="decimal" value={newClient.allocation} onChange={e => setNewClient(p => ({ ...p, allocation: e.target.value.replace(/[^0-9.]/g, "") }))}
                    placeholder="e.g. 5000 = KES 5,000,000"
                    className="w-full border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-indigo-500 bg-muted" />
                </div>
                <div>
                  <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider block mb-1.5">Risk Profile</label>
                  <div className="flex gap-2">
                    {(["low","medium","high"] as const).map(r => (
                      <button key={r} type="button" onClick={() => setNewClient(p => ({ ...p, risk: r }))}
                        className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${newClient.risk === r ? riskColor(r) : "border-border text-muted-foreground"}`}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleAddClient}
                  className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-transform">
                  Add Client
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-background border-t border-border px-2 py-3 flex items-center justify-around">
        {[
          { id: "overview", label: "Overview", icon: <BarChart2 size={18} /> },
          { id: "funds",    label: "Funds",    icon: <Briefcase size={18} /> },
          { id: "clients",  label: "Clients",  icon: <Users size={18} /> },
          { id: "reports",  label: "Reports",  icon: <FileText size={18} /> },
          { id: "wallet",   label: "Wallet",   icon: <Wallet size={18} /> },
        ].map(item => (
          <button key={item.id} onClick={() => setTab(item.id as Tab)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${tab === item.id ? "text-indigo-600" : "text-muted-foreground"}`}>
            {item.icon}
            <span className="text-[9px] font-semibold">{item.label}</span>
          </button>
        ))}
      </div>

      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
