import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Shield, Users, Tractor, DollarSign, TrendingUp, FileText,
  CheckCircle2, Clock, XCircle, LogOut, RefreshCw, LayoutGrid,
  Search, Activity, Sprout, MapPin, UserPlus, X, Eye, EyeOff, ChevronDown, Loader2,
  Settings, Bell, Percent, Coins, ChevronRight, BarChart3, Trash2, ExternalLink, Star, MessageSquare
} from "lucide-react";
import { getToken } from "@/lib/auth";

interface AdminStats {
  totalUsers: number; totalFarmers: number; totalInvestors: number; totalCooperatives: number;
  totalFarms: number; totalLoans: number; totalInvested: number; aum: number;
  totalTransactions: number; totalDeposits: number; totalWithdrawals: number;
  pendingKyc: number; pendingLoans: number; completedLoans: number;
  recentUsers: Array<{ id: number; name: string; email: string; role: string; createdAt: string }>;
  recentLoans: Array<{ id: number; farmerName: string; amount: number; status: string; cropType: string; createdAt: string }>;
}

interface UserRecord {
  id: number; name: string; email: string; role: string;
  emailVerified: boolean; kycStatus: "approved" | "pending" | "rejected" | "none";
  kycDocCount: number; createdAt: string;
}

interface KycDoc {
  id: number; userId: number; docType: string; status: string;
  userName: string; userEmail: string; fileUrl: string; createdAt: string;
}

interface TxRecord {
  id: number; userId: number; userName: string; userEmail: string;
  type: string; amount: string; balanceAfter: string;
  description: string | null; status: string; createdAt: string;
}

type Tab = "overview" | "users" | "kyc" | "transactions" | "farms" | "payouts" | "proposals" | "reviews" | "settings";

interface PlatformSettings {
  withdrawalFeePct: number;
  withdrawalFeeCap: number;
  primaryPurchaseFeePct: number;
  secondaryTradeFeePct: number;
  minInvestmentKES: number;
  minSharePurchase: number;
  priceAlertThresholdPct: number;
}

const TX_EMOJI: Record<string, string> = {
  deposit: "⬇️", withdrawal: "⬆️", investment: "📈", return: "💰", fee: "💳", transfer: "↔️",
};

const TX_COLOR: Record<string, string> = {
  deposit: "text-green-600", withdrawal: "text-red-500", investment: "text-blue-600",
  return: "text-green-700", fee: "text-amber-600", transfer: "text-purple-600",
};

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [kycdocs, setKycDocs] = useState<KycDoc[]>([]);
  const [transactions, setTransactions] = useState<TxRecord[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [dividends, setDividends] = useState<{ totalPaid: number; count: number; dividends: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [harvestLoading, setHarvestLoading] = useState<number | null>(null);
  const [fundingFarmId, setFundingFarmId] = useState<number | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [fundLoading, setFundLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", password: "" });
  const [showNewPass, setShowNewPass] = useState(false);
  const [addAdminLoading, setAddAdminLoading] = useState(false);
  const [roleEditId, setRoleEditId] = useState<number | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [broadcast, setBroadcast] = useState({ title: "", body: "" });
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [clearDbLoading, setClearDbLoading] = useState(false);
  const [kycOnly, setKycOnly] = useState(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<KycDoc | null>(null);
  const [reviews, setReviews] = useState<{ reviews: any[]; avgRating: number; total: number; distribution: { rating: number; count: number }[] } | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Use admin session token (from /api/admin/login) as primary auth; fall back to regular JWT
  const adminSessionToken = sessionStorage.getItem("admin_token") ?? "";
  const token = adminSessionToken || getToken();

  useEffect(() => {
    const auth = sessionStorage.getItem("admin_auth");
    if (!auth) { setLocation("/admin"); return; }
    // Detect token type
    try {
      const tok = sessionStorage.getItem("admin_token") ?? "";
      const decoded = atob(tok);
      if (decoded.startsWith("kyc-admin-session:")) {
        setKycOnly(true);
        setTab("kyc");
      } else if (decoded.includes(":master:")) {
        setIsMasterAdmin(true);
      }
      // sub-admin tokens contain ":sub:" — they get full nav but restricted KYC actions
    } catch {
      // Regular JWT admin user — treat as master
      setIsMasterAdmin(true);
    }
    fetchStats();
  }, []);

  useEffect(() => {
    if (tab === "users") fetchUsers();
    if (tab === "kyc") fetchKyc();
    if (tab === "transactions") fetchTransactions();
    if (tab === "farms") fetchFarms();
    if (tab === "payouts") fetchPayouts();
    if (tab === "proposals") fetchProposals();
    if (tab === "settings") fetchSettings();
    if (tab === "reviews") fetchReviews();
  }, [tab]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setStats(await r.json());
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const r = await fetch(`/api/admin/users?role=${roleFilter}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setUsers(await r.json());
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchKyc = async () => {
    setKycLoading(true);
    try {
      const r = await fetch("/api/admin/kyc", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setKycDocs(await r.json());
    } finally {
      setKycLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setTxLoading(true);
    try {
      const r = await fetch("/api/admin/transactions", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setTransactions(await r.json());
    } finally {
      setTxLoading(false);
    }
  };

  const fetchFarms = async () => {
    setFarmsLoading(true);
    try {
      const r = await fetch("/api/admin/farms", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setFarms(await r.json());
    } finally {
      setFarmsLoading(false);
    }
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const r = await fetch("/api/admin/settings", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        setSettings(data);
        setSettingsDraft(data);
      }
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settingsDraft) return;
    setSettingsSaving(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settingsDraft),
      });
      const data = await r.json();
      if (r.ok) {
        setSettings(data.settings);
        setSettingsDraft(data.settings);
        showToast("Platform settings saved ✓");
      } else {
        showToast(data.error ?? "Save failed", "error");
      }
    } finally {
      setSettingsSaving(false);
    }
  };

  const fetchReviews = async () => {
    setReviewsLoading(true);
    try {
      const r = await fetch("/api/admin/reviews", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setReviews(await r.json());
    } finally { setReviewsLoading(false); }
  };

  const sendBroadcast = async () => {
    if (!broadcast.title.trim() || !broadcast.body.trim()) {
      showToast("Title and message are required", "error"); return;
    }
    setBroadcastSending(true);
    try {
      const r = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(broadcast),
      });
      const data = await r.json();
      if (r.ok) {
        showToast(`📢 Sent to ${data.sent} users ✓`);
        setBroadcast({ title: "", body: "" });
      } else {
        showToast(data.error ?? "Broadcast failed", "error");
      }
    } finally {
      setBroadcastSending(false);
    }
  };

  const fetchProposals = async () => {
    setProposalsLoading(true);
    try {
      const r = await fetch("/api/admin/farms", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const all = await r.json();
        setProposals(all.filter((f: any) => f.status === "pending"));
      }
    } finally {
      setProposalsLoading(false);
    }
  };

  const approveProposal = async (farmId: number, approve: boolean) => {
    const status = approve ? "active" : "rejected";
    const r = await fetch(`/api/admin/farms/${farmId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      showToast(approve ? "Proposal approved — now live for investors ✓" : "Proposal rejected");
      fetchProposals();
      fetchStats();
    } else {
      showToast("Action failed", "error");
    }
  };

  const fetchPayouts = async () => {
    setPayoutsLoading(true);
    try {
      const r = await fetch("/api/admin/dividends", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setDividends(await r.json());
    } finally {
      setPayoutsLoading(false);
    }
  };

  const adminFundFarm = async (farmId: number) => {
    const amt = parseFloat(fundAmount);
    if (!amt || amt <= 0) return;
    setFundLoading(true);
    try {
      const r = await fetch(`/api/admin/farms/${farmId}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountKes: amt }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      showToast(`✓ Bought ${d.sharesBought} shares for KES ${Number(d.totalCost).toLocaleString("en-KE")}`);
      setFundingFarmId(null);
      setFundAmount("");
      fetchFarms();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setFundLoading(false);
    }
  };

  const deleteFarm = async (farmId: number, farmName: string) => {
    if (!confirm(`Delete "${farmName}"? This permanently removes all investments, listings, and data for this farm.`)) return;
    setDeleteLoading(farmId);
    try {
      const r = await fetch(`/api/admin/farms/${farmId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Delete failed");
      showToast("Farm deleted");
      fetchFarms();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setDeleteLoading(null);
    }
  };

  const triggerHarvest = async (farmId: number, farmName: string) => {
    if (!confirm(`Trigger harvest payout for "${farmName}"? This will pay all active investors their dividends.`)) return;
    setHarvestLoading(farmId);
    try {
      const r = await fetch(`/api/admin/farms/${farmId}/harvest`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (r.ok) {
        showToast(`✅ Paid ${data.paid} investors for ${farmName}`);
        fetchFarms();
        if (tab === "payouts") fetchPayouts();
      } else {
        showToast(data.error ?? "Harvest failed", "error");
      }
    } finally {
      setHarvestLoading(null);
    }
  };

  const updateFarmStatus = async (farmId: number, status: string) => {
    const r = await fetch(`/api/admin/farms/${farmId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (r.ok) { showToast(`Farm status → ${status} ✓`); fetchFarms(); }
    else showToast("Status update failed", "error");
  };

  const approveUser = async (userId: number, approve: boolean) => {
    setActionLoading(userId);
    try {
      const r = await fetch(`/api/admin/users/${userId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approved: approve }),
      });
      if (r.ok) {
        showToast(approve ? "User approved & notified ✓" : "User rejected & notified");
        fetchUsers();
      } else {
        showToast("Action failed", "error");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const approveKycDoc = async (docId: number, status: "approved" | "rejected") => {
    setActionLoading(docId);
    try {
      const r = await fetch(`/api/admin/kyc/${docId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        showToast(status === "approved" ? "Document approved ✓" : "Document rejected");
        fetchKyc();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const sendKycReminder = async (userId: number) => {
    setActionLoading(userId);
    try {
      const r = await fetch(`/api/admin/kyc/${userId}/remind`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) showToast("KYC reminder sent ✓");
      else showToast("Failed to send reminder", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const addAdmin = async () => {
    if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
      showToast("All fields are required", "error"); return;
    }
    setAddAdminLoading(true);
    try {
      const r = await fetch("/api/admin/create-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newAdmin),
      });
      const data = await r.json();
      if (r.ok) {
        showToast(`✅ Admin created: ${newAdmin.email}`);
        setNewAdmin({ name: "", email: "", password: "" });
        setAddAdminOpen(false);
        fetchUsers();
      } else {
        showToast(data.error ?? "Failed to create admin", "error");
      }
    } finally {
      setAddAdminLoading(false);
    }
  };

  const deleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Delete user "${userName}"? This cannot be undone and will remove all their data.`)) return;
    setActionLoading(userId);
    try {
      const r = await fetch(`/api/admin/users/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { showToast(`User "${userName}" deleted ✓`); fetchUsers(); fetchStats(); }
      else { const d = await r.json(); showToast(d.error ?? "Delete failed", "error"); }
    } finally { setActionLoading(null); }
  };

  const changeUserRole = async (userId: number, role: string) => {
    const r = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    });
    if (r.ok) { showToast(`Role changed to ${role} ✓`); setRoleEditId(null); fetchUsers(); }
    else showToast("Role change failed", "error");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    sessionStorage.removeItem("admin_token");
    setLocation("/");
  };

  const statusIcon = (status: string) => {
    if (status === "approved" || status === "completed") return <CheckCircle2 size={13} className="text-green-500" />;
    if (status === "rejected") return <XCircle size={13} className="text-red-500" />;
    return <Clock size={13} className="text-amber-500" />;
  };

  const kycBadge = (status: string) => {
    if (status === "approved") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">KYC ✓</span>;
    if (status === "pending") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>;
    if (status === "rejected") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Rejected</span>;
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">No KYC</span>;
  };

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const fmtKES = (n: number) => `KES ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

  const PRIMARY_TABS: { id: Tab; label: string; icon: React.ReactNode; color: string; bg: string; badge?: number }[] = [
    { id: "overview",  label: "Overview",  icon: <BarChart3 size={18} />,  color: "text-indigo-600",  bg: "bg-indigo-50" },
    { id: "kyc",       label: "KYC",       icon: <FileText size={18} />,   color: "text-amber-600",   bg: "bg-amber-50",  badge: stats?.pendingKyc },
    { id: "users",     label: "Users",     icon: <Users size={18} />,      color: "text-blue-600",    bg: "bg-blue-50" },
    { id: "proposals", label: "Proposals", icon: <Sprout size={18} />,     color: "text-green-600",   bg: "bg-green-50",  badge: proposals.length },
  ];
  const SECONDARY_TABS: { id: Tab; label: string; icon: React.ReactNode; color: string; bg: string; badge?: number }[] = [
    { id: "transactions", label: "Transactions", icon: <Activity size={18} />,   color: "text-purple-600",  bg: "bg-purple-50" },
    { id: "farms",        label: "Farms",        icon: <Tractor size={18} />,    color: "text-teal-600",    bg: "bg-teal-50" },
    { id: "payouts",      label: "Payouts",      icon: <DollarSign size={18} />, color: "text-orange-600",  bg: "bg-orange-50" },
    { id: "reviews",      label: "Reviews",      icon: <Star size={18} />,       color: "text-amber-600",   bg: "bg-amber-50" },
    { id: "settings",     label: "Settings",     icon: <Settings size={18} />,   color: "text-gray-600",    bg: "bg-gray-100" },
  ];
  const ALL_TABS = [...PRIMARY_TABS, ...SECONDARY_TABS];
  const activeTabMeta = ALL_TABS.find(t => t.id === tab);

  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  const goTab = (t: Tab) => { setTab(t); setMoreSheetOpen(false); };

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-gray-50 pb-24">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="hero-header pt-12 pb-4 px-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-white/80" />
            <div>
              <p className="text-white/70 text-xs font-medium">Admin Portal</p>
              <h1 className="text-white text-xl font-bold">Investa Admin</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { fetchStats(); if (tab === "users") fetchUsers(); if (tab === "kyc") fetchKyc(); if (tab === "transactions") fetchTransactions(); }}
              className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <RefreshCw size={14} className={`text-white ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-red-500/30 flex items-center justify-center">
              <LogOut size={14} className="text-white" />
            </button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Users", val: stats.totalUsers },
              { label: "Farmers", val: stats.totalFarmers },
              { label: "Investors", val: stats.totalInvestors },
              { label: "KYC Pend.", val: stats.pendingKyc },
            ].map(({ label, val }) => (
              <div key={label} className="bg-white/10 rounded-xl p-2 text-center">
                <p className="text-white font-bold text-lg leading-none">{val}</p>
                <p className="text-white/60 text-[9px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active tab label pill */}
      {activeTabMeta && (
        <div className="px-4 pt-3 pb-1">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${activeTabMeta.bg} ${activeTabMeta.color} text-xs font-bold`}>
            <span>{activeTabMeta.icon}</span>
            <span>{activeTabMeta.label}</span>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
          ) : stats ? (
            <>
              {/* AUM Hero */}
              <div className="bg-gradient-to-r from-green-700 to-emerald-500 rounded-2xl p-4">
                <p className="text-white/80 text-xs font-medium uppercase tracking-wide">Assets Under Management</p>
                <p className="text-white font-extrabold text-2xl mt-0.5">{fmtKES(stats.aum ?? 0)}</p>
                <div className="flex gap-4 mt-2">
                  <div>
                    <p className="text-white/60 text-[10px]">Total Volume</p>
                    <p className="text-white text-xs font-bold">{fmtKES(stats.totalInvested)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-[10px]">Transactions</p>
                    <p className="text-white text-xs font-bold">{stats.totalTransactions}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-[10px]">Deposits</p>
                    <p className="text-white text-xs font-bold">{fmtKES(stats.totalDeposits ?? 0)}</p>
                  </div>
                </div>
              </div>

              {/* Platform stats */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Platform</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Active Farms", val: stats.totalFarms, icon: Tractor },
                    { label: "Total Loans", val: stats.totalLoans, icon: DollarSign },
                    { label: "Pending KYC", val: stats.pendingKyc, icon: FileText },
                    { label: "Pending Loans", val: stats.pendingLoans, icon: Clock },
                  ].map(({ label, val, icon: Icon }) => (
                    <div key={label} className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon size={14} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-foreground font-bold text-sm">{val}</p>
                        <p className="text-muted-foreground text-[10px]">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent users */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Registrations</p>
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  {stats.recentUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-4">No users yet</p>
                  ) : stats.recentUsers.map((u, i) => (
                    <div key={u.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-xs">{u.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-xs font-semibold truncate">{u.name}</p>
                        <p className="text-muted-foreground text-[10px] truncate">{u.email}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        u.role === "farmer" ? "bg-green-100 text-green-700" :
                        u.role === "investor" ? "bg-amber-100 text-amber-700" :
                        "bg-blue-100 text-blue-700"}`}>
                        {u.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent loans */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Loan Applications</p>
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  {stats.recentLoans.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-4">No loans yet</p>
                  ) : stats.recentLoans.map((l, i) => (
                    <div key={l.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-xs font-semibold truncate">{l.farmerName}</p>
                        <p className="text-muted-foreground text-[10px]">{l.cropType} · {fmtKES(Number(l.amount))}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {statusIcon(l.status)}
                        <span className="text-[9px] text-muted-foreground capitalize">{l.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">Failed to load stats</div>
          )
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <>
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-700 to-indigo-600 rounded-2xl p-4 mb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Users size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">All Users</p>
                    <p className="text-blue-200 text-[10px]">Manage accounts, roles & KYC</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-2xl">{users.length}</p>
                  <p className="text-blue-200 text-[9px]">Registered</p>
                </div>
              </div>
            </div>

            {/* Add Admin Banner — master admin only */}
            {isMasterAdmin && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Shield size={14} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-indigo-900 font-semibold text-xs">Admin Accounts</p>
                  <p className="text-indigo-600 text-[10px]">Grant dashboard access to team members</p>
                </div>
              </div>
              <button onClick={() => setAddAdminOpen(true)}
                className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform">
                <UserPlus size={12} /> Add Admin
              </button>
            </div>
            )}

            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full bg-white border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {["all", "admin", "farmer", "investor", "cooperative"].map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${roleFilter === r ? "bg-primary text-white" : "bg-white border border-border text-muted-foreground"}`}>
                    {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
                <button onClick={fetchUsers} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-border text-muted-foreground flex items-center gap-1">
                  <RefreshCw size={11} className={usersLoading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            </div>

            {usersLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading users…</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No users found</div>
            ) : filteredUsers.map((u) => (
              <div key={u.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${u.role === "admin" ? "bg-indigo-100" : "bg-primary/10"}`}>
                    {u.role === "admin"
                      ? <Shield size={16} className="text-indigo-600" />
                      : <span className="text-primary font-bold text-sm">{u.name.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-foreground text-sm font-semibold truncate">{u.name}</p>
                      {u.role === "admin" && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">ADMIN</span>}
                      {kycBadge(u.kycStatus)}
                    </div>
                    <p className="text-muted-foreground text-[11px] truncate">{u.email}</p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      {u.role} · {u.kycDocCount} doc{u.kycDocCount !== 1 ? "s" : ""} · {new Date(u.createdAt).toLocaleDateString("en-KE")}
                    </p>
                  </div>
                  {/* Role change */}
                  <div className="relative flex-shrink-0">
                    <button onClick={() => setRoleEditId(roleEditId === u.id ? null : u.id)}
                      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-muted border border-border text-muted-foreground">
                      Role <ChevronDown size={10} />
                    </button>
                    {roleEditId === u.id && (
                      <div className="absolute right-0 top-8 z-20 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[130px]">
                        {["farmer", "investor", "cooperative", "agribusiness", "admin"].map(r => (
                          <button key={r} onClick={() => changeUserRole(u.id, r)}
                            className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-muted transition-colors ${u.role === r ? "text-primary font-semibold" : "text-foreground"}`}>
                            {u.role === r ? "✓ " : ""}{r.charAt(0).toUpperCase() + r.slice(1)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {u.role !== "admin" && u.kycStatus !== "approved" && (
                  <div className="border-t border-border px-4 py-2.5 flex gap-2">
                    {isMasterAdmin ? (
                      <>
                        <button onClick={() => approveUser(u.id, true)} disabled={actionLoading === u.id}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                          <CheckCircle2 size={13} />
                          {actionLoading === u.id ? "Processing…" : "Approve KYC"}
                        </button>
                        <button onClick={() => approveUser(u.id, false)} disabled={actionLoading === u.id}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                          <XCircle size={13} /> Reject
                        </button>
                      </>
                    ) : (
                      <button onClick={() => sendKycReminder(u.id)} disabled={actionLoading === u.id}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                        <Bell size={13} />
                        {actionLoading === u.id ? "Sending…" : "Send KYC Reminder"}
                      </button>
                    )}
                  </div>
                )}
                {u.role !== "admin" && u.kycStatus === "approved" && (
                  <div className="border-t border-border px-4 py-2 bg-green-50/50">
                    <p className="text-green-600 text-[11px] font-medium flex items-center gap-1">
                      <CheckCircle2 size={11} /> Account fully approved
                    </p>
                  </div>
                )}
                {u.role === "admin" && (
                  <div className="border-t border-border px-4 py-2 bg-indigo-50/50">
                    <p className="text-indigo-600 text-[11px] font-medium flex items-center gap-1">
                      <Shield size={11} /> Full admin access — can log in to this dashboard
                    </p>
                  </div>
                )}
                {/* Delete user */}
                {u.role !== "admin" && (
                  <div className="border-t border-border px-4 py-2">
                    <button onClick={() => deleteUser(u.id, u.name)} disabled={actionLoading === u.id}
                      className="flex items-center gap-1.5 text-red-500 text-[11px] font-semibold hover:text-red-700 transition-colors disabled:opacity-50">
                      <Trash2 size={11} /> Delete account
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* KYC DOCS TAB */}
        {tab === "kyc" && (
          <>
            {/* Header */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <FileText size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">KYC Documents</p>
                    <p className="text-amber-100 text-[10px]">Identity & document verification</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-2xl">{kycdocs.filter(d => d.status === "pending").length}</p>
                  <p className="text-amber-100 text-[9px]">Pending</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {kycdocs.length} total documents
              </p>
              <button onClick={fetchKyc} className="text-xs text-primary flex items-center gap-1">
                <RefreshCw size={11} className={kycLoading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            {kycLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading documents…</div>
            ) : kycdocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No KYC documents yet</div>
            ) : kycdocs.map(doc => (
              <div key={doc.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-xs font-semibold">{doc.userName}</p>
                      <p className="text-muted-foreground text-[10px] truncate">{doc.userEmail}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{doc.docType}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          doc.status === "approved" ? "bg-green-100 text-green-700" :
                          doc.status === "rejected" ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"}`}>{doc.status}</span>
                      </div>
                    </div>
                    {doc.fileUrl && !doc.fileUrl.startsWith("selfie://") && !doc.fileUrl.startsWith("uploaded://") && (
                      <button onClick={() => setViewingDoc(doc)}
                        className="ml-2 w-14 flex-shrink-0 flex flex-col items-center gap-1 active:scale-95 transition-transform">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-primary/30 bg-gray-100 flex items-center justify-center">
                          {(doc.fileUrl.startsWith("data:image/") || doc.fileUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i))
                            ? <img src={doc.fileUrl} alt="Doc" className="w-full h-full object-cover" />
                            : (doc.fileUrl.startsWith("data:application/pdf") || doc.fileUrl.match(/\.pdf$/i))
                              ? <div className="flex flex-col items-center justify-center w-full h-full bg-red-50">
                                  <FileText size={20} className="text-red-500" />
                                </div>
                              : <div className="flex flex-col items-center justify-center w-full h-full bg-blue-50">
                                  <FileText size={20} className="text-blue-500" />
                                </div>
                          }
                        </div>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                          (doc.fileUrl.startsWith("data:image/") || doc.fileUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i)) ? "bg-green-100 text-green-700" :
                          (doc.fileUrl.startsWith("data:application/pdf") || doc.fileUrl.match(/\.pdf$/i)) ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {(doc.fileUrl.startsWith("data:image/") || doc.fileUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i)) ? "IMG" :
                           (doc.fileUrl.startsWith("data:application/pdf") || doc.fileUrl.match(/\.pdf$/i)) ? "PDF" : "DOC"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                {doc.status === "pending" && (
                  <div className="border-t border-border px-4 py-2.5 flex gap-2">
                    {isMasterAdmin ? (
                      <>
                        <button onClick={() => approveKycDoc(doc.id, "approved")} disabled={actionLoading === doc.id}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                          <CheckCircle2 size={13} />
                          {actionLoading === doc.id ? "…" : "Approve"}
                        </button>
                        <button onClick={() => approveKycDoc(doc.id, "rejected")} disabled={actionLoading === doc.id}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                          <XCircle size={13} /> Reject
                        </button>
                      </>
                    ) : (
                      <button onClick={() => sendKycReminder(doc.userId)} disabled={actionLoading === doc.userId}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                        <Bell size={13} />
                        {actionLoading === doc.userId ? "Sending…" : "Send KYC Reminder"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* TRANSACTIONS TAB */}
        {tab === "transactions" && (
          <>
            {/* Header */}
            <div className="bg-gradient-to-br from-purple-700 to-violet-600 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Activity size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">Transactions</p>
                    <p className="text-purple-200 text-[10px]">Platform-wide money movement</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-2xl">{transactions.length}</p>
                  <p className="text-purple-200 text-[9px]">Recent</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {transactions.length} recent transactions
              </p>
              <button onClick={fetchTransactions} className="text-xs text-primary flex items-center gap-1">
                <RefreshCw size={11} className={txLoading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            {txLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading transactions…</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No transactions yet</div>
            ) : transactions.map(tx => (
              <div key={tx.id} className="bg-card border border-border rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-base flex-shrink-0">
                    {TX_EMOJI[tx.type] ?? "💳"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-foreground text-xs font-semibold truncate">{tx.userName}</p>
                      <p className={`text-xs font-bold flex-shrink-0 ${TX_COLOR[tx.type] ?? "text-foreground"}`}>
                        {tx.type === "deposit" || tx.type === "return" ? "+" : "-"}KES {Number(tx.amount).toLocaleString("en-KE", { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-[10px] truncate">{tx.description ?? tx.type}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-muted-foreground text-[10px] truncate">{tx.userEmail}</p>
                      <p className="text-muted-foreground text-[10px] flex-shrink-0">{new Date(tx.createdAt).toLocaleDateString("en-KE")}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        {/* PROPOSALS TAB */}
        {tab === "proposals" && (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-green-700 to-emerald-500 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Sprout size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">Crop Proposals</p>
                    <p className="text-green-200 text-[10px]">Farmer submissions awaiting review</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-2xl">{proposals.length}</p>
                  <p className="text-green-200 text-[9px]">Pending</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {proposals.length} pending proposal{proposals.length !== 1 ? "s" : ""}
              </p>
              <button onClick={fetchProposals} className="text-xs text-primary flex items-center gap-1">
                <RefreshCw size={11} className={proposalsLoading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            {proposalsLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading proposals…</div>
            ) : proposals.length === 0 ? (
              <div className="bg-muted/40 rounded-2xl border border-border p-8 text-center">
                <Sprout size={28} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-semibold text-sm">No pending proposals</p>
                <p className="text-muted-foreground text-xs mt-1">Farmer crop proposals will appear here for review.</p>
              </div>
            ) : (
              proposals.map((f: any) => (
                <div key={f.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  {/* Proposal header */}
                  <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">⏳ PENDING REVIEW</span>
                    </div>
                    <p className="text-muted-foreground text-[9px]">{new Date(f.createdAt).toLocaleDateString("en-KE")}</p>
                  </div>

                  <div className="px-4 py-3.5">
                    {/* Farmer info */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-bold text-[10px]">{f.farmerName?.charAt(0) ?? "F"}</span>
                          </div>
                          <p className="text-foreground font-bold text-sm">{f.farmerName ?? "Unknown Farmer"}</p>
                        </div>
                        <p className="text-muted-foreground text-[10px] ml-8.5">{f.farmerEmail}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-primary font-bold text-base">{fmtKES(f.loanAmount)}</p>
                        <p className="text-muted-foreground text-[9px]">Capital needed</p>
                      </div>
                    </div>

                    {/* Crop details grid */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-green-50 rounded-xl p-2.5">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Sprout size={10} className="text-green-600" />
                          <p className="text-muted-foreground text-[9px]">Crop</p>
                        </div>
                        <p className="text-foreground font-bold text-xs">{f.cropType}</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-2.5">
                        <div className="flex items-center gap-1 mb-0.5">
                          <MapPin size={10} className="text-blue-600" />
                          <p className="text-muted-foreground text-[9px]">Location</p>
                        </div>
                        <p className="text-foreground font-bold text-xs truncate">{f.location}</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-2.5">
                        <div className="flex items-center gap-1 mb-0.5">
                          <TrendingUp size={10} className="text-purple-600" />
                          <p className="text-muted-foreground text-[9px]">Total Shares</p>
                        </div>
                        <p className="text-foreground font-bold text-xs">{f.totalShares.toLocaleString()}</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-2.5">
                        <div className="flex items-center gap-1 mb-0.5">
                          <DollarSign size={10} className="text-amber-600" />
                          <p className="text-muted-foreground text-[9px]">Share Price</p>
                        </div>
                        <p className="text-foreground font-bold text-xs">{fmtKES(f.sharePrice)}</p>
                      </div>
                    </div>

                    {/* Farm name */}
                    <div className="bg-muted/40 rounded-xl px-3 py-2 mb-3">
                      <p className="text-muted-foreground text-[9px]">Farm Name</p>
                      <p className="text-foreground text-xs font-semibold">{f.name}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={() => approveProposal(f.id, false)}
                        className="flex-1 border border-red-300 text-red-600 bg-red-50 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                        <XCircle size={14} /> Reject
                      </button>
                      <button
                        onClick={() => approveProposal(f.id, true)}
                        className="flex-1 bg-primary text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                        <CheckCircle2 size={14} /> Approve
                      </button>
                    </div>
                    <p className="text-muted-foreground text-[9px] text-center mt-2">
                      Approving makes this farm visible to investors on the marketplace
                    </p>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* FARMS TAB */}
        {tab === "farms" && (
          <>
            {/* Header */}
            <div className="bg-gradient-to-br from-teal-700 to-emerald-600 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Tractor size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">Farm Registry</p>
                    <p className="text-teal-200 text-[10px]">All farms, status & harvest control</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-2xl">{farms.length}</p>
                  <p className="text-teal-200 text-[9px]">Total Farms</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {farms.length} total farms
              </p>
              <button onClick={fetchFarms} className="text-xs text-primary flex items-center gap-1">
                <RefreshCw size={11} className={farmsLoading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            {farmsLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading farms…</div>
            ) : farms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No farms yet</div>
            ) : farms.map((f: any) => (
              <div key={f.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-semibold text-sm truncate">{f.name}</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{f.cropType} · {f.location}</p>
                      <p className="text-muted-foreground text-[10px]">Farmer: {f.farmerName}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        f.status === "active" ? "bg-green-100 text-green-700" :
                        f.status === "funded" ? "bg-blue-100 text-blue-700" :
                        f.status === "harvested" ? "bg-gray-100 text-gray-600" :
                        "bg-amber-100 text-amber-700"}`}>
                        {f.status}
                      </span>
                      <p className="text-foreground font-bold text-xs mt-1">{fmtKES(f.loanAmount)}</p>
                    </div>
                  </div>

                  {/* Funding progress */}
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">Funded: {fmtKES(f.fundedAmount)}</span>
                      <span className="text-primary font-semibold">{f.fundedPercent}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, f.fundedPercent)}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                    <span>{f.investorCount} investors</span>
                    <span>·</span>
                    <span>{f.totalShares - f.sharesAvailable}/{f.totalShares} shares sold</span>
                  </div>
                </div>

                <div className="border-t border-border px-3 py-2 flex gap-1.5 flex-wrap">
                  {["pending", "active", "funded", "harvested"].filter(s => s !== f.status).map(s => (
                    <button key={s} onClick={() => updateFarmStatus(f.id, s)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-50 border border-gray-200 text-gray-600 active:scale-95 transition-transform">
                      → {s}
                    </button>
                  ))}
                  {f.status !== "harvested" && (
                    <button
                      onClick={() => triggerHarvest(f.id, f.name)}
                      disabled={harvestLoading === f.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 border border-amber-300 text-amber-700 active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1"
                    >
                      {harvestLoading === f.id ? "Paying…" : "🌾 Harvest & Pay"}
                    </button>
                  )}
                  {f.status === "active" && f.sharesAvailable > 0 && (
                    <button
                      onClick={() => setFundingFarmId(fundingFarmId === f.id ? null : f.id)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-50 border border-green-300 text-green-700 active:scale-95 transition-transform flex items-center gap-1"
                    >
                      💰 Fund
                    </button>
                  )}
                  <button
                    onClick={() => deleteFarm(f.id, f.name)}
                    disabled={deleteLoading === f.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-50 border border-red-200 text-red-600 active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1 ml-auto"
                  >
                    {deleteLoading === f.id ? "…" : "🗑 Delete"}
                  </button>
                </div>
                {fundingFarmId === f.id && (
                  <div className="border-t border-green-200 bg-green-50 px-3 py-3 flex gap-2 items-center">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-green-700 text-[10px] font-bold">KES</span>
                      <input
                        type="number"
                        value={fundAmount}
                        onChange={e => setFundAmount(e.target.value)}
                        placeholder={`Max: ${(f.sharesAvailable * f.sharePrice).toLocaleString("en-KE")}`}
                        className="w-full border border-green-300 rounded-xl pl-10 pr-3 py-2 text-xs focus:outline-none focus:border-green-500 bg-white"
                      />
                    </div>
                    <button
                      onClick={() => adminFundFarm(f.id)}
                      disabled={fundLoading || !fundAmount}
                      className="px-3 py-2 rounded-xl text-[10px] font-bold bg-green-600 text-white disabled:opacity-50 active:scale-95 transition-transform flex items-center gap-1"
                    >
                      {fundLoading ? "…" : "Invest"}
                    </button>
                    <button onClick={() => { setFundingFarmId(null); setFundAmount(""); }}
                      className="px-2 py-2 rounded-xl text-[10px] bg-white border border-border text-muted-foreground">
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* PAYOUTS TAB */}
        {tab === "payouts" && (
          <>
            {/* Header */}
            <div className="bg-gradient-to-br from-orange-600 to-amber-500 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <DollarSign size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">Dividend Payouts</p>
                    <p className="text-orange-100 text-[10px]">Harvest returns paid to investors</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-lg leading-tight">{dividends ? fmtKES(dividends.totalPaid) : "—"}</p>
                  <p className="text-orange-100 text-[9px]">Total Paid</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Dividend History
              </p>
              <button onClick={fetchPayouts} className="text-xs text-primary flex items-center gap-1">
                <RefreshCw size={11} className={payoutsLoading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            {dividends && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gradient-to-br from-green-600 to-emerald-500 rounded-2xl p-3">
                  <p className="text-white/70 text-[10px]">Total Paid Out</p>
                  <p className="text-white font-extrabold text-lg leading-tight">{fmtKES(dividends.totalPaid)}</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-3">
                  <p className="text-muted-foreground text-[10px]">Dividend Records</p>
                  <p className="text-foreground font-extrabold text-lg leading-tight">{dividends.count}</p>
                </div>
              </div>
            )}

            {payoutsLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading payouts…</div>
            ) : !dividends || dividends.dividends.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">No dividends paid yet</p>
                <p className="text-muted-foreground text-xs mt-1">Use the Farms tab to trigger harvest payouts</p>
              </div>
            ) : dividends.dividends.map((d: any) => (
              <div key={d.id} className="bg-card border border-border rounded-2xl px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-xs font-semibold">{d.investorName}</p>
                    <p className="text-muted-foreground text-[10px] truncate">{d.investorEmail}</p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">🌾 {d.farmName} · {d.shares} shares</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-green-600 font-extrabold text-sm">+{fmtKES(d.amount)}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${d.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {d.status}
                    </span>
                    <p className="text-muted-foreground text-[9px] mt-0.5">
                      {d.paidAt ? new Date(d.paidAt).toLocaleDateString("en-KE") : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* REVIEWS TAB */}
        {tab === "reviews" && (
          <>
            {reviewsLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-amber-500" /></div>
            ) : !reviews ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No reviews data</div>
            ) : (
              <>
                {/* Summary card */}
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-3xl p-5 text-white mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Star size={24} className="fill-white text-white" />
                    </div>
                    <div>
                      <p className="text-white/80 text-xs font-medium">Average Rating</p>
                      <p className="text-4xl font-black leading-none">{reviews.avgRating.toFixed(1)}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-white/80 text-xs">Total Reviews</p>
                      <p className="text-3xl font-black">{reviews.total}</p>
                    </div>
                  </div>
                  {/* Star distribution bars */}
                  <div className="space-y-1.5">
                    {[5,4,3,2,1].map(s => {
                      const entry = reviews.distribution.find(d => d.rating === s);
                      const cnt = entry?.count ?? 0;
                      const pct = reviews.total > 0 ? (cnt / reviews.total) * 100 : 0;
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <span className="text-[11px] text-white/70 w-4 shrink-0">{s}★</span>
                          <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-white rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] text-white/70 w-5 text-right shrink-0">{cnt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent reviews list */}
                {reviews.reviews.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No reviews yet</div>
                ) : (
                  <div className="space-y-3">
                    {reviews.reviews.map((rv: any) => (
                      <div key={rv.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-amber-700 font-bold text-sm">{(rv.userName ?? "?")[0]?.toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-foreground font-semibold text-sm">{rv.userName ?? "Anonymous"}</p>
                              {rv.context && (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{rv.context}</span>
                              )}
                              <span className="text-muted-foreground text-[10px] ml-auto">
                                {new Date(rv.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10px] mb-1.5">{rv.userEmail}</p>
                            <div className="flex items-center gap-0.5 mb-2">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} size={13} className={`${rv.rating >= s ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                              ))}
                              <span className="ml-1 text-xs font-semibold text-foreground">{rv.rating}/5</span>
                            </div>
                            {rv.review && (
                              <div className="bg-gray-50 rounded-xl px-3 py-2 flex items-start gap-2">
                                <MessageSquare size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                                <p className="text-foreground text-xs leading-relaxed">{rv.review}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <>
            {settingsLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading settings…</div>
            ) : settingsDraft ? (
              <>
                {/* Fee Settings */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-amber-50">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Percent size={13} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-amber-900 font-bold text-xs">Fee Configuration</p>
                      <p className="text-amber-600 text-[10px]">Platform fees charged on transactions</p>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {[
                      { label: "Withdrawal Fee", sub: "% of withdrawal amount", key: "withdrawalFeePct" as const, suffix: "%" },
                      { label: "Withdrawal Fee Cap", sub: "Maximum fee charged (KES)", key: "withdrawalFeeCap" as const, suffix: "KES" },
                      { label: "Primary Purchase Fee", sub: "% charged on new share purchases", key: "primaryPurchaseFeePct" as const, suffix: "%" },
                      { label: "Secondary Trade Fee", sub: "% charged on P2P market trades", key: "secondaryTradeFeePct" as const, suffix: "%" },
                    ].map(({ label, sub, key, suffix }) => (
                      <div key={key} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground text-xs font-semibold">{label}</p>
                          <p className="text-muted-foreground text-[10px]">{sub}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <input
                            type="number"
                            min={0}
                            step={suffix === "%" ? 0.1 : 1}
                            value={settingsDraft[key]}
                            onChange={e => setSettingsDraft(d => d ? { ...d, [key]: Number(e.target.value) } : d)}
                            className="w-20 border border-border rounded-lg px-2 py-1.5 text-xs text-right text-foreground bg-gray-50 focus:outline-none focus:border-primary"
                          />
                          <span className="text-muted-foreground text-[10px] w-6">{suffix}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Investment Limits */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-blue-50">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Coins size={13} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-blue-900 font-bold text-xs">Investment Limits</p>
                      <p className="text-blue-600 text-[10px]">Minimum thresholds for investor participation</p>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {[
                      { label: "Minimum Investment", sub: "Smallest wallet amount to invest (KES)", key: "minInvestmentKES" as const, suffix: "KES" },
                      { label: "Minimum Shares", sub: "Fewest shares per purchase", key: "minSharePurchase" as const, suffix: "shares" },
                      { label: "Price Alert Threshold", sub: "Send push alert when holding moves by this % (default 5%)", key: "priceAlertThresholdPct" as const, suffix: "%" },
                    ].map(({ label, sub, key, suffix }) => (
                      <div key={key} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground text-xs font-semibold">{label}</p>
                          <p className="text-muted-foreground text-[10px]">{sub}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={settingsDraft[key]}
                            onChange={e => setSettingsDraft(d => d ? { ...d, [key]: Number(e.target.value) } : d)}
                            className="w-20 border border-border rounded-lg px-2 py-1.5 text-xs text-right text-foreground bg-gray-50 focus:outline-none focus:border-primary"
                          />
                          <span className="text-muted-foreground text-[10px] w-10 leading-tight">{suffix}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={saveSettings}
                  disabled={settingsSaving}
                  className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {settingsSaving ? <Loader2 size={15} className="animate-spin" /> : <Settings size={15} />}
                  {settingsSaving ? "Saving…" : "Save Platform Settings"}
                </button>

                {/* Danger Zone — Clear Database */}
                <div className="bg-card border border-red-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-red-200 bg-red-50">
                    <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                      <XCircle size={13} className="text-red-600" />
                    </div>
                    <div>
                      <p className="text-red-900 font-bold text-xs">Danger Zone</p>
                      <p className="text-red-600 text-[10px]">Clear all non-demo users and their data from the database</p>
                    </div>
                  </div>
                  <div className="px-4 py-4 space-y-3">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      This permanently deletes all real user accounts (investments, KYC docs, transactions, farms, etc.) while preserving the demo accounts. <span className="text-red-600 font-semibold">This action cannot be undone.</span>
                    </p>
                    <button
                      onClick={async () => {
                        if (!confirm("⚠️ This will permanently delete ALL non-demo users and their data. Demo accounts will be preserved.\n\nAre you absolutely sure?")) return;
                        if (!confirm("Final confirmation: delete all non-demo user data?")) return;
                        setClearDbLoading(true);
                        try {
                          const r = await fetch("/api/admin/clear-database", {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          const data = await r.json();
                          if (r.ok) showToast(`✅ ${data.message}`);
                          else showToast(data.error ?? "Clear failed", "error");
                        } finally {
                          setClearDbLoading(false);
                          fetchStats();
                        }
                      }}
                      disabled={clearDbLoading}
                      className="w-full bg-red-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                    >
                      {clearDbLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                      {clearDbLoading ? "Clearing…" : "Clear Non-Demo User Data"}
                    </button>
                  </div>
                </div>

                {/* Broadcast Notifications */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-purple-50">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Bell size={13} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-purple-900 font-bold text-xs">Broadcast Notification</p>
                      <p className="text-purple-600 text-[10px]">Send a message to all users on the platform</p>
                    </div>
                  </div>
                  <div className="px-4 py-4 space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Title</label>
                      <input
                        type="text"
                        value={broadcast.title}
                        onChange={e => setBroadcast(b => ({ ...b, title: e.target.value }))}
                        placeholder="e.g. Harvest season is here! 🌾"
                        className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground bg-gray-50 focus:outline-none focus:border-purple-400 focus:bg-white transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Message</label>
                      <textarea
                        value={broadcast.body}
                        onChange={e => setBroadcast(b => ({ ...b, body: e.target.value }))}
                        placeholder="Write your message to all users…"
                        rows={3}
                        className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground bg-gray-50 focus:outline-none focus:border-purple-400 focus:bg-white transition-colors resize-none"
                      />
                    </div>
                    <button
                      onClick={sendBroadcast}
                      disabled={broadcastSending || !broadcast.title.trim() || !broadcast.body.trim()}
                      className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                    >
                      {broadcastSending ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                      {broadcastSending ? "Sending…" : "Send to All Users"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">Failed to load settings</div>
            )}
          </>
        )}

      </div>

      {/* Add Admin Modal */}
      {addAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddAdminOpen(false)} />
          <div className="relative bg-white rounded-t-3xl w-full max-w-[430px] px-6 pt-5 pb-10 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-foreground font-bold text-base flex items-center gap-2">
                  <UserPlus size={16} className="text-indigo-600" /> Add Admin Account
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">New admin can log in at /admin with the password you set</p>
              </div>
              <button onClick={() => setAddAdminOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Full Name</label>
                <input type="text" value={newAdmin.name} onChange={e => setNewAdmin(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Sarah Odhiambo"
                  className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-gray-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Email Address</label>
                <input type="email" value={newAdmin.email} onChange={e => setNewAdmin(p => ({ ...p, email: e.target.value }))}
                  placeholder="sarah@investafarm.com"
                  className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-gray-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Password (min 8 chars)</label>
                <div className="relative">
                  <input type={showNewPass ? "text" : "password"} value={newAdmin.password}
                    onChange={e => setNewAdmin(p => ({ ...p, password: e.target.value }))}
                    placeholder="Secure password"
                    className="w-full border border-border rounded-xl px-3.5 pr-11 py-3 text-sm text-foreground bg-gray-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
                  <button type="button" onClick={() => setShowNewPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
                    {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3.5 py-2.5">
                <p className="text-indigo-800 text-[11px] font-medium">ℹ️ The new admin will log in at <strong>/admin</strong> using their email and this password. They'll have full dashboard access including KYC, farms, users, and payouts.</p>
              </div>
              <button onClick={addAdmin} disabled={addAdminLoading}
                className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {addAdminLoading ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                {addAdminLoading ? "Creating…" : "Create Admin Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      {!kycOnly && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-200 z-[60] safe-area-pb">
          <div className="grid grid-cols-5 h-16">
            {[
              { id: "overview" as Tab,      label: "Overview",  Icon: BarChart3,  badge: 0 },
              { id: "users" as Tab,         label: "Users",     Icon: Users,      badge: 0 },
              { id: "kyc" as Tab,           label: "KYC",       Icon: FileText,   badge: stats?.pendingKyc ?? 0 },
              { id: "transactions" as Tab,  label: "Activity",  Icon: Activity,   badge: 0 },
            ].map(({ id, label, Icon, badge }) => (
              <button key={id} onClick={() => goTab(id)}
                className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${tab === id && !moreSheetOpen ? "text-indigo-600" : "text-gray-400"}`}>
                <div className="relative">
                  <Icon size={20} strokeWidth={tab === id && !moreSheetOpen ? 2.5 : 1.8} />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-semibold">{label}</span>
                {tab === id && !moreSheetOpen && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-full" />
                )}
              </button>
            ))}
            {/* More button */}
            <button onClick={() => setMoreSheetOpen(s => !s)}
              className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${moreSheetOpen ? "text-indigo-600" : "text-gray-400"}`}>
              <LayoutGrid size={20} strokeWidth={moreSheetOpen ? 2.5 : 1.8} />
              <span className="text-[9px] font-semibold">More</span>
              {moreSheetOpen && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          </div>
        </nav>
      )}

      {/* KYC-only bottom nav */}
      {kycOnly && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-200 z-[60]">
          <div className="flex items-center justify-center h-16">
            <div className="flex items-center gap-2 text-amber-600">
              <FileText size={20} />
              <span className="text-sm font-bold">KYC Review Mode</span>
            </div>
          </div>
        </nav>
      )}

      {/* ── MORE SHEET ── */}
      {moreSheetOpen && (
        <div className="fixed inset-0 z-[55]" onClick={() => setMoreSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px]"
            onClick={e => e.stopPropagation()}>
            <div className="bg-white rounded-t-3xl px-5 pt-4 pb-6 shadow-2xl">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">More Tools</p>
              <div className="grid grid-cols-2 gap-3">
                {SECONDARY_TABS.map(t => (
                  <button key={t.id} onClick={() => goTab(t.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all active:scale-95 ${
                      tab === t.id ? `${t.bg} border-transparent` : "bg-gray-50 border-gray-100"
                    }`}>
                    <div className={`w-9 h-9 rounded-xl ${t.bg} flex items-center justify-center ${t.color}`}>
                      {t.icon}
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-bold ${tab === t.id ? t.color : "text-foreground"}`}>{t.label}</p>
                      {t.badge != null && t.badge > 0 && (
                        <p className="text-[9px] text-red-500 font-semibold">{t.badge} pending</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {isMasterAdmin && (
                <button onClick={() => { setAddAdminOpen(true); setMoreSheetOpen(false); }}
                  className="mt-3 w-full flex items-center gap-3 p-3.5 rounded-2xl border border-indigo-100 bg-indigo-50 active:scale-95 transition-all">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <UserPlus size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-indigo-700">Add Sub-Admin</p>
                    <p className="text-[9px] text-indigo-500">Create admin account</p>
                  </div>
                </button>
              )}
              <button onClick={() => { handleLogout(); setMoreSheetOpen(false); }}
                className="mt-3 w-full flex items-center gap-3 p-3.5 rounded-2xl border border-red-100 bg-red-50 active:scale-95 transition-all">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-red-500">
                  <LogOut size={16} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-red-600">Sign Out</p>
                  <p className="text-[9px] text-red-400">Log out of admin panel</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KYC Document Viewer Modal */}
      {viewingDoc && (() => {
        const rawUrl = viewingDoc.fileUrl;
        // Handle data: URIs directly; build absolute URL only for relative paths
        const docUrl = rawUrl.startsWith("data:") || rawUrl.startsWith("http")
          ? rawUrl
          : `${window.location.origin}${rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl}`;
        const isImage = rawUrl.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif)/i.test(rawUrl);
        const isPdf = rawUrl.startsWith("data:application/pdf") || /\.pdf/i.test(rawUrl);
        const isPlaceholder = rawUrl.startsWith("selfie://") || rawUrl.startsWith("uploaded://");
        return (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setViewingDoc(null)}
          >
            <div
              className="relative w-full max-w-lg bg-background rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <p className="font-bold text-sm text-foreground">{viewingDoc.docType}</p>
                  <p className="text-muted-foreground text-[10px]">{viewingDoc.userName} · {viewingDoc.userEmail}</p>
                </div>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Document preview */}
              <div className="bg-gray-100 flex items-center justify-center" style={{ minHeight: 300 }}>
                {isPlaceholder ? (
                  <div className="flex flex-col items-center gap-3 p-8 text-center">
                    <FileText size={40} className="text-muted-foreground" />
                    <p className="text-muted-foreground text-sm font-medium">Document was submitted before file upload was enabled.</p>
                    <p className="text-muted-foreground text-xs">Ask the user to re-submit their document.</p>
                  </div>
                ) : isImage ? (
                  <img
                    src={docUrl}
                    alt={viewingDoc.docType}
                    className="w-full object-contain"
                    style={{ maxHeight: 400 }}
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.onerror = null;
                      t.style.display = "none";
                    }}
                  />
                ) : isPdf ? (
                  <iframe
                    src={docUrl}
                    title={viewingDoc.docType}
                    className="w-full"
                    style={{ height: 420, border: "none" }}
                  />
                ) : /\.(doc|docx|xls|xlsx|ppt|pptx)/i.test(rawUrl) ? (
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(docUrl)}&embedded=true`}
                    title={viewingDoc.docType}
                    className="w-full"
                    style={{ height: 420, border: "none" }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 p-8 text-center">
                    <FileText size={48} className="text-muted-foreground" />
                    <p className="text-muted-foreground text-sm font-medium">Click "Open in Browser" to view this document</p>
                    <a href={docUrl} target="_blank" rel="noreferrer"
                      className="mt-1 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5">
                      <ExternalLink size={12} /> Open Document
                    </a>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-4 py-3 flex gap-2 border-t border-border">
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold py-2.5 rounded-xl"
                >
                  <ExternalLink size={13} /> Open in Browser
                </a>
                {viewingDoc.status === "pending" && isMasterAdmin ? (
                  <div className="flex gap-1.5 flex-1">
                    <button onClick={() => { approveKycDoc(viewingDoc.id, "approved"); setViewingDoc(null); }}
                      className="flex-1 flex items-center justify-center gap-1 bg-green-50 border border-green-200 text-green-700 text-xs font-bold py-2.5 rounded-xl active:scale-95">
                      <CheckCircle2 size={12} /> OK
                    </button>
                    <button onClick={() => { approveKycDoc(viewingDoc.id, "rejected"); setViewingDoc(null); }}
                      className="flex-1 flex items-center justify-center gap-1 bg-red-50 border border-red-200 text-red-600 text-xs font-bold py-2.5 rounded-xl active:scale-95">
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                ) : (
                  <span className={`flex-1 flex items-center justify-center text-xs font-bold rounded-xl py-2.5 ${
                    viewingDoc.status === "approved" ? "bg-green-100 text-green-700" :
                    viewingDoc.status === "rejected" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {viewingDoc.status === "approved" ? "✓ Approved" : viewingDoc.status === "rejected" ? "✗ Rejected" : "⏳ Pending"}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
