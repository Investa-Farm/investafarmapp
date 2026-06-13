import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Shield, Users, Tractor, DollarSign, TrendingUp, FileText,
  CheckCircle2, Clock, XCircle, LogOut, RefreshCw, LayoutGrid,
  Search, Activity
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

type Tab = "overview" | "users" | "kyc" | "transactions";

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
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const token = getToken();

  useEffect(() => {
    const auth = sessionStorage.getItem("admin_auth");
    if (!auth) { setLocation("/admin"); return; }
    fetchStats();
  }, []);

  useEffect(() => {
    if (tab === "users") fetchUsers();
    if (tab === "kyc") fetchKyc();
    if (tab === "transactions") fetchTransactions();
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

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
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

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <LayoutGrid size={14} /> },
    { id: "users", label: "Users", icon: <Users size={14} /> },
    { id: "kyc", label: "KYC", icon: <FileText size={14} /> },
    { id: "transactions", label: "Transactions", icon: <Activity size={14} /> },
  ];

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-gray-50 pb-10">
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

      {/* Tab bar */}
      <div className="flex bg-white border-b border-border sticky top-0 z-10">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-3 text-[11px] font-semibold transition-colors ${tab === t.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

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
                {["all", "farmer", "investor", "cooperative"].map(r => (
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
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-sm">{u.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-foreground text-sm font-semibold truncate">{u.name}</p>
                      {kycBadge(u.kycStatus)}
                    </div>
                    <p className="text-muted-foreground text-[11px] truncate">{u.email}</p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      {u.role} · {u.kycDocCount} doc{u.kycDocCount !== 1 ? "s" : ""} · {new Date(u.createdAt).toLocaleDateString("en-KE")}
                    </p>
                  </div>
                </div>
                {u.kycStatus !== "approved" && (
                  <div className="border-t border-border px-4 py-2.5 flex gap-2">
                    <button onClick={() => approveUser(u.id, true)} disabled={actionLoading === u.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                      <CheckCircle2 size={13} />
                      {actionLoading === u.id ? "Processing…" : "Approve Account"}
                    </button>
                    <button onClick={() => approveUser(u.id, false)} disabled={actionLoading === u.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                )}
                {u.kycStatus === "approved" && (
                  <div className="border-t border-border px-4 py-2 bg-green-50/50">
                    <p className="text-green-600 text-[11px] font-medium flex items-center gap-1">
                      <CheckCircle2 size={11} /> Account fully approved
                    </p>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* KYC DOCS TAB */}
        {tab === "kyc" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {kycdocs.filter(d => d.status === "pending").length} pending documents
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
                    {doc.fileUrl && (
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                        className="ml-2 w-12 h-12 rounded-xl overflow-hidden border border-border flex-shrink-0 bg-gray-100 flex items-center justify-center">
                        {doc.fileUrl.match(/\.(jpg|jpeg|png|webp)$/i)
                          ? <img src={doc.fileUrl} alt="Doc" className="w-full h-full object-cover" />
                          : <FileText size={18} className="text-muted-foreground" />}
                      </a>
                    )}
                  </div>
                </div>
                {doc.status === "pending" && (
                  <div className="border-t border-border px-4 py-2.5 flex gap-2">
                    <button onClick={() => approveKycDoc(doc.id, "approved")} disabled={actionLoading === doc.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                      <CheckCircle2 size={13} />
                      {actionLoading === doc.id ? "…" : "Approve"}
                    </button>
                    <button onClick={() => approveKycDoc(doc.id, "rejected")} disabled={actionLoading === doc.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* TRANSACTIONS TAB */}
        {tab === "transactions" && (
          <>
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
      </div>
    </div>
  );
}
