import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoredUser, getToken, clearToken, formatKES } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import {
  Briefcase, TrendingUp, TrendingDown, Users, PieChart, BarChart2,
  Bell, LogOut, Plus, ChevronRight, ArrowUpRight, Shield, Star, Wallet,
  RefreshCw, DollarSign, Target, Activity, X, Percent
} from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { NotificationsPanel } from "@/components/notifications-panel";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { getCropImage } from "@/lib/crops";
import { motion, AnimatePresence } from "framer-motion";

type ClientEntry = { id: string; name: string; allocation: number; note?: string };

const formatPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

export default function FundManagerDashboard() {
  const user = getStoredUser();
  const token = getToken();
  const [, setLocation] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [tab, setTab] = useState<"overview" | "farms" | "clients" | "analytics">("overview");
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", allocation: "" });
  const [clients, setClients] = useState<ClientEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("investa_fund_clients") ?? "[]"); } catch { return []; }
  });

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const { data: portfolio } = useQuery<any>({
    queryKey: ["portfolio-summary"],
    queryFn: async () => {
      const r = await fetch("/api/portfolio/summary", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 60_000,
    enabled: !!token,
  });

  const { data: investments = [] } = useQuery<any[]>({
    queryKey: ["investments"],
    queryFn: async () => {
      const r = await fetch("/api/investments", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
    enabled: !!token,
  });

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

  const { data: wallet } = useQuery<{ balance: string }>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { balance: "0" };
      return r.json();
    },
    staleTime: 30_000,
    enabled: !!token,
  });

  const aum = portfolio?.totalInvested ?? 0;
  const totalReturn = portfolio?.totalReturn ?? 0;
  const returnPct = portfolio?.returnPercent ?? 0;
  const walletBalance = parseFloat(wallet?.balance ?? "0");

  const totalAum = aum + walletBalance;
  const totalClients = clients.length;
  const allocatedPct = totalAum > 0 ? Math.min(100, (aum / totalAum) * 100) : 0;

  const saveClient = () => {
    if (!newClient.name || !newClient.allocation) return;
    const entry: ClientEntry = {
      id: Date.now().toString(),
      name: newClient.name,
      allocation: parseFloat(newClient.allocation),
    };
    const updated = [...clients, entry];
    setClients(updated);
    localStorage.setItem("investa_fund_clients", JSON.stringify(updated));
    setNewClient({ name: "", allocation: "" });
    setClientModalOpen(false);
  };

  const removeClient = (id: string) => {
    const updated = clients.filter(c => c.id !== id);
    setClients(updated);
    localStorage.setItem("investa_fund_clients", JSON.stringify(updated));
  };

  const totalClientAlloc = clients.reduce((s, c) => s + c.allocation, 0);

  const cropBreakdown: Record<string, { amount: number; count: number; change: number }> = {};
  investments.forEach((inv: any) => {
    const crop = inv.farm?.cropType ?? "Other";
    if (!cropBreakdown[crop]) cropBreakdown[crop] = { amount: 0, count: 0, change: 0 };
    cropBreakdown[crop]!.amount += parseFloat(inv.purchasePrice ?? "0") * (inv.quantity ?? 0);
    cropBreakdown[crop]!.count++;
    cropBreakdown[crop]!.change = inv.farm?.changePercent ?? 0;
  });

  return (
    <div className="app-shell pb-20 page-enter">
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

      {/* Header */}
      <div className="relative overflow-hidden" style={{ minHeight: 210 }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 50%, #4f46e5 80%, #6366f1 100%)" }} />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='20' cy='20' r='2'/%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative z-10 pt-12 px-5">
          <div className="flex items-center justify-between">
            <img src={logoSrc} alt="Investa Farm" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            <div className="flex items-center gap-2">
              <button onClick={() => setNotifOpen(true)} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center relative">
                <Bell size={16} className="text-white" />
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">{Math.min(unreadCount, 9)}</span>}
              </button>
              <button onClick={() => { clearToken(); setLocation("/"); }} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <LogOut size={14} className="text-white" />
              </button>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500 text-white">Wealth Fund Manager</span>
            </div>
            <h1 className="text-white text-2xl font-bold">Welcome, {user?.name?.split(" ")[0] ?? "Manager"} 👋</h1>
            <p className="text-white/70 text-xs mt-0.5">Agricultural Investment Portfolio</p>
          </div>

          {/* AUM banner */}
          <div className="mt-4 mb-2 bg-white/10 rounded-2xl p-4 border border-white/20">
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider">Total Assets Under Management</p>
            <p className="text-white text-3xl font-bold mt-1">{formatKES(totalAum)}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${returnPct >= 0 ? "text-green-300" : "text-red-300"}`}>
                {returnPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {formatPct(returnPct)} return
              </span>
              <span className="text-white/40">·</span>
              <span className="text-white/60 text-xs">{totalClients} client{totalClients !== 1 ? "s" : ""}</span>
              <span className="text-white/40">·</span>
              <span className="text-white/60 text-xs">{investments.length} farm{investments.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto border-b border-border sticky top-0 bg-background z-10">
        {[
          ["overview", "Overview"],
          ["farms", "Farms"],
          ["clients", "Clients"],
          ["analytics", "Analytics"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${tab === id ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="px-5 pt-4 space-y-4">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Deployed Capital", val: formatKES(aum), sub: `${allocatedPct.toFixed(0)}% invested`, color: "text-indigo-600" },
                { label: "Available Cash", val: formatKES(walletBalance), sub: "Ready to deploy", color: "text-green-600" },
                { label: "Total Returns", val: formatKES(Math.abs(totalReturn)), sub: returnPct >= 0 ? `+${returnPct.toFixed(2)}%` : `${returnPct.toFixed(2)}%`, color: returnPct >= 0 ? "text-green-600" : "text-red-500" },
                { label: "Farm Holdings", val: String(investments.length), sub: "Active positions", color: "text-blue-600" },
              ].map(({ label, val, sub, color }) => (
                <div key={label} className="bg-card rounded-2xl border border-border p-3.5">
                  <p className="text-muted-foreground text-[10px]">{label}</p>
                  <p className={`font-bold text-xl mt-1 ${color}`}>{val}</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="space-y-2">
              <p className="font-semibold text-sm">Quick Actions</p>
              <Link href="/market/primary">
                <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Plus size={20} className="text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Invest in New Farm</p>
                    <p className="text-muted-foreground text-xs">{listings.length} farms available on primary market</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </Link>
              <Link href="/wallet">
                <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Wallet size={20} className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Fund Manager Wallet</p>
                    <p className="text-muted-foreground text-xs">Balance: {formatKES(walletBalance)}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </Link>
              <button onClick={() => setTab("clients")} className="w-full flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-[0.98] transition-transform text-left">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Users size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Client Allocations</p>
                  <p className="text-muted-foreground text-xs">{totalClients} client{totalClients !== 1 ? "s" : ""} · {formatKES(totalClientAlloc)} allocated</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Top farms */}
            {investments.length > 0 && (
              <div>
                <p className="font-semibold text-sm mb-2">Top Holdings</p>
                <div className="space-y-2">
                  {investments.slice(0, 3).map((inv: any) => {
                    const invested = parseFloat(inv.purchasePrice ?? "0") * (inv.quantity ?? 0);
                    const chg = inv.farm?.changePercent ?? 0;
                    const sparkData = generateSparkData(parseFloat(inv.purchasePrice ?? "100"), 12, chg / 100);
                    return (
                      <div key={inv.id} className="bg-card rounded-2xl border border-border p-3.5 flex items-center gap-3">
                        <img src={getCropImage(inv.farm?.cropType ?? "", inv.farm?.imageUrl)} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{inv.farm?.name ?? "Farm"}</p>
                          <p className="text-muted-foreground text-[10px]">{inv.quantity} shares · {formatKES(invested)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Sparkline data={sparkData} width={50} height={22} positive={chg >= 0} />
                          <span className={`text-[10px] font-bold ${chg >= 0 ? "text-green-600" : "text-red-500"}`}>{formatPct(chg)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {investments.length > 3 && (
                    <button onClick={() => setTab("farms")} className="w-full text-center text-xs text-indigo-600 font-semibold py-2">
                      View all {investments.length} farms →
                    </button>
                  )}
                </div>
              </div>
            )}

            {investments.length === 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 text-center">
                <Briefcase size={32} className="text-indigo-400 mx-auto mb-3" />
                <p className="text-indigo-800 font-semibold text-sm">No Active Positions</p>
                <p className="text-indigo-600 text-xs mt-1 mb-3">Start building your agricultural fund portfolio by investing in farms.</p>
                <Link href="/market/primary">
                  <button className="bg-indigo-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl">Browse Farms →</button>
                </Link>
              </div>
            )}
          </>
        )}

        {/* ── FARMS ── */}
        {tab === "farms" && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-bold text-base">Farm Portfolio ({investments.length})</p>
              <Link href="/market/primary">
                <button className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-bold">
                  <Plus size={13} /> Add Farm
                </button>
              </Link>
            </div>
            {investments.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <BarChart2 size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No farm positions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Invest in farms to build your portfolio</p>
              </div>
            ) : (
              <div className="space-y-3">
                {investments.map((inv: any) => {
                  const invested = parseFloat(inv.purchasePrice ?? "0") * (inv.quantity ?? 0);
                  const currentPrice = inv.farm?.currentPrice ?? inv.purchasePrice;
                  const currentVal = parseFloat(currentPrice ?? "0") * (inv.quantity ?? 0);
                  const gain = currentVal - invested;
                  const gainPct = invested > 0 ? ((gain / invested) * 100) : 0;
                  const chg = inv.farm?.changePercent ?? 0;
                  const sparkData = generateSparkData(parseFloat(inv.purchasePrice ?? "100"), 16, chg / 100);
                  return (
                    <div key={inv.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <img src={getCropImage(inv.farm?.cropType ?? "", inv.farm?.imageUrl)} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{inv.farm?.name ?? "Unknown Farm"}</p>
                            <p className="text-muted-foreground text-[10px]">{inv.farm?.cropType} · {inv.farm?.location}</p>
                            <p className="text-[10px] mt-0.5">
                              <span className={`font-bold ${gainPct >= 0 ? "text-green-600" : "text-red-500"}`}>
                                {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(2)}%
                              </span>
                              <span className="text-muted-foreground"> · {inv.quantity} shares</span>
                            </p>
                          </div>
                          <Sparkline data={sparkData} width={60} height={28} positive={chg >= 0} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-muted rounded-xl p-2 text-center">
                            <p className="text-[9px] text-muted-foreground">Invested</p>
                            <p className="text-xs font-bold">{formatKES(invested)}</p>
                          </div>
                          <div className="bg-muted rounded-xl p-2 text-center">
                            <p className="text-[9px] text-muted-foreground">Current Val.</p>
                            <p className="text-xs font-bold">{formatKES(currentVal)}</p>
                          </div>
                          <div className={`rounded-xl p-2 text-center ${gain >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                            <p className="text-[9px] text-muted-foreground">Gain/Loss</p>
                            <p className={`text-xs font-bold ${gain >= 0 ? "text-green-600" : "text-red-500"}`}>{gain >= 0 ? "+" : ""}{formatKES(Math.abs(gain))}</p>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-border px-4 py-2 flex gap-2">
                        <Link href={`/market/${inv.farmId}`}>
                          <button className="flex-1 text-xs text-indigo-600 font-semibold">View Details →</button>
                        </Link>
                        <Link href="/market/secondary">
                          <button className="flex-1 text-xs text-muted-foreground font-semibold">List for Sale</button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── CLIENTS ── */}
        {tab === "clients" && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-bold text-base">Client Allocations ({clients.length})</p>
              <button onClick={() => setClientModalOpen(true)} className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-bold">
                <Plus size={13} /> Add Client
              </button>
            </div>

            {clients.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                <p className="text-indigo-800 font-bold text-sm">Total Client Capital</p>
                <p className="text-indigo-700 text-2xl font-bold">{formatKES(totalClientAlloc)}</p>
                <p className="text-indigo-600 text-xs mt-0.5">Across {clients.length} client{clients.length !== 1 ? "s" : ""}</p>
              </div>
            )}

            {clients.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <Users size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No clients added</p>
                <p className="text-xs text-muted-foreground mt-1">Track capital allocation per client</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clients.map(client => {
                  const sharePct = totalClientAlloc > 0 ? ((client.allocation / totalClientAlloc) * 100) : 0;
                  return (
                    <div key={client.id} className="bg-card rounded-2xl border border-border p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm">{client.name}</p>
                          <p className="text-muted-foreground text-xs">{sharePct.toFixed(1)}% of total AUM</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-indigo-600">{formatKES(client.allocation)}</span>
                          <button onClick={() => removeClient(client.id)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                            <X size={12} className="text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${sharePct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <AnimatePresence>
              {clientModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50" onClick={() => setClientModalOpen(false)} />
                  <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 28, stiffness: 300 }}
                    className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-10">
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-bold text-foreground">Add Client</p>
                      <button onClick={() => setClientModalOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Client Name</label>
                        <input type="text" value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))}
                          placeholder="e.g. James Mwangi" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Allocated Capital (KES)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">KES</span>
                          <input type="number" value={newClient.allocation} onChange={e => setNewClient(p => ({ ...p, allocation: e.target.value }))}
                            placeholder="0" className="w-full border border-border rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => setClientModalOpen(false)} className="flex-1 border border-border text-foreground py-3 rounded-xl text-sm font-semibold">Cancel</button>
                      <button onClick={saveClient} disabled={!newClient.name || !newClient.allocation}
                        className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50">
                        Add Client
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* ── ANALYTICS ── */}
        {tab === "analytics" && (
          <>
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="font-semibold text-sm mb-3">Portfolio Allocation by Crop</p>
              {Object.keys(cropBreakdown).length === 0 ? (
                <div className="text-center py-4">
                  <PieChart size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Invest in farms to see breakdown</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(cropBreakdown)
                    .sort((a, b) => b[1].amount - a[1].amount)
                    .map(([crop, data]) => {
                      const pct = aum > 0 ? ((data.amount / aum) * 100) : 0;
                      return (
                        <div key={crop}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{crop}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold ${data.change >= 0 ? "text-green-600" : "text-red-500"}`}>{formatPct(data.change)}</span>
                              <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{formatKES(data.amount)} · {data.count} farm{data.count !== 1 ? "s" : ""}</p>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Avg. Return / Farm</p>
                <p className="text-foreground font-bold text-xl mt-1">
                  {investments.length > 0 ? `${(returnPct / Math.max(investments.length, 1)).toFixed(2)}%` : "—"}
                </p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Portfolio Diversity</p>
                <p className="text-foreground font-bold text-xl mt-1">{Object.keys(cropBreakdown).length} crops</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Capital at Work</p>
                <p className="text-indigo-600 font-bold text-xl mt-1">{allocatedPct.toFixed(0)}%</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Unrealised P&L</p>
                <p className={`font-bold text-xl mt-1 ${totalReturn >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {totalReturn >= 0 ? "+" : ""}{formatKES(Math.abs(totalReturn))}
                </p>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
              <p className="text-indigo-800 font-semibold text-sm mb-2">Risk Assessment</p>
              <div className="space-y-2 text-xs text-indigo-700">
                <div className="flex items-center justify-between">
                  <span>Diversification score</span>
                  <span className="font-bold">{Object.keys(cropBreakdown).length >= 4 ? "High" : Object.keys(cropBreakdown).length >= 2 ? "Moderate" : "Low"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total deployed capital</span>
                  <span className="font-bold">{formatKES(aum)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cash reserve</span>
                  <span className="font-bold">{formatKES(walletBalance)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav role="investor" />
    </div>
  );
}
