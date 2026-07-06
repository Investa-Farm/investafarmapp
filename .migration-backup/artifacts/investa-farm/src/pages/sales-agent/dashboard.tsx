import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Briefcase, Copy, Check, Users, Link2, Send,
  ChevronRight, LogOut, FileText, Star, Wallet, Home, BarChart2,
  TrendingUp, Award, ChevronUp, Phone, Loader2, CheckCircle2, X,
} from "lucide-react";
import { getToken, getStoredUser, formatKES } from "@/lib/auth";

const COOP_MPESA_CODES = [
  { code: "+254", flag: "🇰🇪" }, { code: "+255", flag: "🇹🇿" },
  { code: "+256", flag: "🇺🇬" }, { code: "+250", flag: "🇷🇼" },
];

function CommissionWithdrawal({ token, agentCode, availableKes }: { token: string | null; agentCode: string; availableKes: number }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "done">("form");
  const [mpesaCode, setMpesaCode] = useState("+254");
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [refCode, setRefCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mpesaNumber.trim() || !amount) return;
    const amt = Number(amount);
    if (amt < 100 || amt > availableKes) { setError(`Amount must be between KES 100 and ${formatKES(availableKes)}`); return; }
    setSubmitting(true); setError("");
    try {
      const r = await fetch("/api/agribusiness/commission-withdrawal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mpesaNumber: `${mpesaCode}${mpesaNumber.replace(/^0/, "")}`, amount: amt }),
      });
      const data = await r.json();
      if (r.ok) {
        setRefCode(data.referenceCode ?? `WDL-${agentCode}-${Date.now().toString(36).toUpperCase()}`);
        setStep("done");
        import("@/components/center-success-modal").then(({ showCenterSuccess }) => {
          showCenterSuccess({ title: "Withdrawal Requested!", subtitle: "Commission will arrive via M-Pesa shortly" });
        });
      }
      else { setError(data.error ?? "Withdrawal request failed. Please try again."); }
    } catch { setError("Connection error. Please try again."); }
    finally { setSubmitting(false); }
  }

  function close() { setOpen(false); setTimeout(() => { setStep("form"); setAmount(""); setMpesaNumber(""); setError(""); }, 400); }

  return (
    <>
      <button onClick={() => { setOpen(true); }}
        className="w-full py-3.5 rounded-2xl border-2 border-[#16a34a] text-[#16a34a] font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all bg-[#16a34a]/10">
        <Wallet size={16} /> Request Commission Withdrawal
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
              <p className="text-foreground font-bold text-base">{step === "done" ? "Request Submitted!" : "Withdraw Commission"}</p>
              <button onClick={close} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X size={15} /></button>
            </div>
            <div className="px-5 pt-4 pb-8">
              {step === "done" ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-[#16a34a]/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-[#16a34a]" />
                  </div>
                  <p className="text-foreground font-extrabold text-lg mb-1">Request Received!</p>
                  <p className="text-muted-foreground text-sm mb-3">Your withdrawal is being processed.</p>
                  <div className="bg-[#16a34a]/10 border border-[#16a34a]/20 rounded-2xl p-3 mb-4">
                    <p className="text-[#16a34a] text-xs font-semibold">Reference Code</p>
                    <p className="text-foreground font-bold text-base mt-0.5">{refCode}</p>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">Funds will be sent to your M-Pesa within <strong>5 business days</strong>. Quote your reference code for any queries.</p>
                  <button onClick={close} className="mt-5 w-full bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-95">Done</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="bg-[#16a34a]/10 border border-[#16a34a]/20 rounded-xl p-3">
                    <p className="text-[#16a34a] text-xs font-semibold">Available for Withdrawal</p>
                    <p className="text-foreground font-bold text-xl mt-0.5">{formatKES(availableKes)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">M-Pesa Number</label>
                    <div className="flex gap-2">
                      <select value={mpesaCode} onChange={e => setMpesaCode(e.target.value)}
                        className="border border-border rounded-xl px-2 py-3 text-sm bg-background focus:outline-none appearance-none w-[85px] flex-shrink-0 text-center font-medium">
                        {COOP_MPESA_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                      </select>
                      <input type="tel" value={mpesaNumber} onChange={e => setMpesaNumber(e.target.value.replace(/\D/g, ""))}
                        placeholder="07XXXXXXXX" required
                        className="flex-1 border border-border rounded-xl px-3 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-green-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Amount (KES)</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Min KES 100 · Max ${formatKES(availableKes)}`} required min={100} max={availableKes}
                      className="w-full border border-border rounded-xl px-4 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-green-500" />
                  </div>
                  {error && <div className="bg-red-500/10 border border-red-400/20 rounded-xl px-3 py-2.5 text-red-500 text-xs">{error}</div>}
                  <button type="submit" disabled={submitting || !mpesaNumber || !amount}
                    className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                    {submitting ? "Submitting…" : "Request Withdrawal"}
                  </button>
                  <p className="text-muted-foreground text-[10px] text-center">Processed within 5 business days. Agent code: IFV-{agentCode}</p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

const AGENT_TABS = [
  { id: "overview",  label: "Home",      icon: Home       },
  { id: "farmers",   label: "Farmers",   icon: Users      },
  { id: "proposals", label: "Proposals", icon: FileText   },
  { id: "earnings",  label: "Earnings",  icon: TrendingUp },
] as const;
type AgentTab = typeof AGENT_TABS[number]["id"];

export default function SalesAgentDashboard() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const user = getStoredUser() as any;

  const [copiedLink, setCopiedLink] = useState(false);
  const [stats, setStats] = useState({ farmers: 0, proposals: 0, funded: 0, commission: 0, pendingCommission: 0, lifetimeCommission: 0 });
  const [farmers, setFarmers] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<AgentTab>("overview");
  const [loading, setLoading] = useState(true);

  const agentCode = user?.id ? String(user.id).padStart(6, "0") : "000000";
  const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const referralLink = `${window.location.origin}${BASE}/register?ref=${user?.id ?? 0}&type=farmer&via=sales_agent&partner=${encodeURIComponent(user?.name ?? "")}`;

  useEffect(() => {
    if (!token) { setLocation("/cooperative-auth"); return; }
    loadData();
  }, [token]);

  async function loadData() {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [proposalsResp, networkResp] = await Promise.all([
        fetch("/api/agribusiness/proposals", { headers }).catch(() => null),
        fetch("/api/agribusiness/my-network", { headers }).catch(() => null),
      ]);
      const propsList = proposalsResp && proposalsResp.ok ? await proposalsResp.json() : [];
      const networkList = networkResp && networkResp.ok ? await networkResp.json() : [];
      const list = Array.isArray(propsList) ? propsList : [];
      const net = Array.isArray(networkList) ? networkList : [];
      setProposals(list);
      setFarmers(net);
      const funded = list.filter((p: any) => p.status === "approved").length;
      const totalComm = funded * 500 + net.filter((f: any) => f.funded).length * 800;
      setStats({
        farmers: net.length,
        proposals: list.length,
        funded,
        commission: totalComm,
        pendingCommission: (list.length - funded) * 200,
        lifetimeCommission: totalComm,
      });
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink).catch(() => {});
    setCopiedLink(true);
    import("@/components/success-toast").then(({ showCopiedToast }) => {
      showCopiedToast("Referral link copied!");
    });
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({
        title: "Join Investa Farm",
        text: "I'd like to onboard you as a farmer on Investa Farm — Africa's leading farm investment platform. Register via my link:",
        url: referralLink,
      }).catch(() => {});
    } else {
      await copyLink();
    }
  }

  function handleLogout() {
    localStorage.removeItem("investa_token");
    localStorage.removeItem("investa_user");
    localStorage.removeItem("investa_coop_sub_type");
    setLocation("/cooperative-auth");
  }

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-14 pb-8"
        style={{ background: "linear-gradient(135deg,#052e16 0%,#14532d 60%,#16a34a 100%)" }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
              <Briefcase size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Sales Agent</p>
              <p className="text-white font-bold text-base leading-tight">{user?.name ?? "Agent"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
          </div>
        </div>

        {/* Agent code + commission hero */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Your Agent Code</p>
              <p className="text-white font-extrabold text-2xl font-mono tracking-widest mt-0.5">IFV-{agentCode}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-1.5 bg-green-400/25 border border-green-300/30 text-green-100 text-[10px] font-bold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" /> Active
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="bg-white/10 rounded-2xl p-3 text-center border border-white/10">
              <p className="text-white font-extrabold text-xl leading-none">{stats.farmers}</p>
              <p className="text-white/50 text-[10px] mt-1">Farmers</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-3 text-center border border-white/10">
              <p className="text-white font-extrabold text-xl leading-none">{stats.funded}</p>
              <p className="text-white/50 text-[10px] mt-1">Funded</p>
            </div>
            <div className="bg-green-400/20 rounded-2xl p-3 text-center border border-green-400/30">
              <p className="text-green-300 font-extrabold text-base leading-none">{formatKES(stats.commission)}</p>
              <p className="text-white/50 text-[10px] mt-1">Earned</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 mt-4 pb-24 space-y-4 overflow-y-auto">

        {/* ── OVERVIEW TAB ───────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* Referral link card */}
            <div className="rounded-2xl overflow-hidden border border-green-200 shadow-sm">
              <div className="bg-gradient-to-r from-emerald-600 to-green-500 px-4 pt-4 pb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Link2 size={16} className="text-white" />
                  <p className="text-white font-bold text-sm">Your Referral Link</p>
                </div>
                <p className="text-white/70 text-[11px]">Share with farmers — earn commission when they get funded</p>
              </div>
              <div className="-mt-3 mx-3 bg-card rounded-2xl p-3 border border-border shadow-md mb-3">
                <p className="text-foreground font-mono text-[11px] break-all leading-relaxed">{referralLink}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 px-3 pb-4">
                <button onClick={copyLink}
                  className="flex items-center justify-center gap-1.5 bg-card border-2 border-[#16a34a]/40 text-[#16a34a] text-xs font-bold py-3 rounded-xl active:scale-95 shadow-sm">
                  {copiedLink ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                  {copiedLink ? "Copied!" : "Copy Link"}
                </button>
                <button onClick={shareLink}
                  className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-bold py-3 rounded-xl active:scale-95 shadow-sm shadow-green-300">
                  <Send size={13} />
                  Share Now
                </button>
              </div>
            </div>

            {/* Submit Proposal */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-foreground font-bold text-sm">Submit Crop Proposal</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#16a34a]/10 text-[#16a34a]">+ Commission</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed mb-3">
                Know a farmer ready for investment? Submit a proposal on their behalf — our team reviews and reaches out.
              </p>
              <button
                onClick={() => setLocation("/farmer/crop-proposal")}
                className="w-full flex items-center justify-between bg-green-600 text-white font-semibold px-4 py-3 rounded-xl text-sm active:scale-95">
                <span>Submit New Proposal</span>
                <ChevronRight size={15} />
              </button>
            </div>

            {/* How it works */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-foreground font-bold text-sm mb-3">How It Works</p>
              <div className="space-y-3">
                {[
                  { step: "1", title: "Share your link", desc: "Send your referral link to farmers in your network." },
                  { step: "2", title: "Farmer registers", desc: "They sign up and list their farm on Investa Farm." },
                  { step: "3", title: "Investors fund", desc: "Investors discover and fund the farm." },
                  { step: "4", title: "You earn", desc: "Commission credited to your agent wallet." },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary text-[10px] font-bold">{s.step}</span>
                    </div>
                    <div>
                      <p className="text-foreground font-semibold text-xs">{s.title}</p>
                      <p className="text-muted-foreground text-[11px]">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── FARMERS TAB ────────────────────────────────────────────── */}
        {activeTab === "farmers" && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
            ) : farmers.length === 0 ? (
              <div className="py-12 text-center">
                <Users size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-foreground font-semibold text-sm">No farmers yet</p>
                <p className="text-muted-foreground text-xs mt-1">Share your referral link to onboard farmers.</p>
                <button onClick={shareLink}
                  className="mt-4 bg-primary text-white text-xs font-semibold px-5 py-2.5 rounded-xl active:scale-95">
                  Share Link Now
                </button>
              </div>
            ) : farmers.map((f: any) => (
              <div key={f.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users size={16} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-foreground font-semibold text-sm">{f.name}</p>
                  <p className="text-muted-foreground text-xs">{f.email}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.farmFunded ? "bg-[#16a34a]/10 text-[#16a34a]" : "bg-amber-500/10 text-amber-500"}`}>
                  {f.farmFunded ? "Funded" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── PROPOSALS TAB ──────────────────────────────────────────── */}
        {activeTab === "proposals" && (
          <div className="space-y-3">
            <button onClick={() => setLocation("/farmer/crop-proposal")}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold px-4 py-3 rounded-2xl text-sm active:scale-95">
              <FileText size={15} />
              New Crop Proposal
            </button>
            {loading ? (
              <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
            ) : proposals.length === 0 ? (
              <div className="py-10 text-center">
                <FileText size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-foreground font-semibold text-sm">No proposals yet</p>
                <p className="text-muted-foreground text-xs mt-1">Submit a crop proposal to get started.</p>
              </div>
            ) : proposals.map((p: any) => (
              <div key={p.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-foreground font-semibold text-sm">{p.cropType ?? "Crop"} Farm</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    p.status === "approved" ? "bg-[#16a34a]/10 text-[#16a34a]" :
                    p.status === "rejected" ? "bg-red-500/10 text-red-500" :
                    "bg-amber-500/10 text-amber-500"
                  }`}>{p.status ?? "pending"}</span>
                </div>
                <p className="text-muted-foreground text-xs">{p.location ?? ""} · {p.size ?? ""} acres</p>
                {p.status === "approved" && (
                  <div className="mt-2 bg-[#16a34a]/10 border border-[#16a34a]/20 rounded-xl px-3 py-2 flex items-center justify-between">
                    <p className="text-[#16a34a] text-xs font-semibold">Commission earned</p>
                    <p className="text-foreground font-bold text-xs">{formatKES(500)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── EARNINGS TAB ───────────────────────────────────────────── */}
        {activeTab === "earnings" && (
          <div className="space-y-4">
            {/* Earnings hero card */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "linear-gradient(135deg,#052e16 0%,#14532d 60%,#16a34a 100%)" }}>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Award size={16} className="text-green-200" />
                  <p className="text-green-100 text-xs font-semibold uppercase tracking-wider">Total Earnings</p>
                </div>
                <p className="text-white font-bold text-3xl">{formatKES(stats.lifetimeCommission)}</p>
                <p className="text-green-200 text-xs mt-1">Lifetime commission as a Sales Agent</p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white/15 rounded-xl p-3">
                    <p className="text-white font-bold text-base">{formatKES(stats.commission)}</p>
                    <p className="text-white/70 text-[10px]">Confirmed & Paid</p>
                  </div>
                  <div className="bg-white/15 rounded-xl p-3">
                    <p className="text-green-300 font-bold text-base">{formatKES(stats.pendingCommission)}</p>
                    <p className="text-white/70 text-[10px]">Pending Approval</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Commission structure */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={15} className="text-primary" />
                <p className="text-foreground font-bold text-sm">Commission Structure</p>
              </div>
              <div className="space-y-2">
                {[
                  { milestone: "Farm Listed", reward: "KES 500", icon: "📋", desc: "Paid when your referred farm is listed" },
                  { milestone: "Farm 50%+ Funded", reward: "1% of raise", icon: "🌱", desc: "Paid when half the target is raised" },
                  { milestone: "Farm Fully Funded", reward: "2% total raise", icon: "🏆", desc: "Bonus on full funding completion" },
                ].map(r => (
                  <div key={r.milestone} className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/10 rounded-xl">
                    <span className="text-xl flex-shrink-0">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-semibold text-xs">{r.milestone}</p>
                      <p className="text-muted-foreground text-[10px]">{r.desc}</p>
                    </div>
                    <p className="text-primary font-bold text-xs flex-shrink-0">{r.reward}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment info */}
            <div className="bg-[#16a34a]/10 border border-[#16a34a]/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={15} className="text-[#16a34a]" />
                <p className="text-foreground font-bold text-sm">Payment Schedule</p>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Confirmed commissions are paid to your M-Pesa within <strong>5 business days</strong> of farm funding milestones. 
                Contact support with agent code <strong>IFV-{agentCode}</strong> for payout queries.
              </p>
            </div>

            {/* Commission withdrawal request */}
            <CommissionWithdrawal token={token} agentCode={agentCode} availableKes={stats.commission} />
          </div>
        )}

      </div>

      {/* Fixed bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 bg-background border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}>
        <div className="flex justify-around items-stretch">
          {AGENT_TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                  active ? "text-green-600" : "text-muted-foreground"
                }`}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            );
          })}
          <button onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-muted-foreground">
            <LogOut size={20} strokeWidth={1.8} />
            <span className="text-[10px] font-semibold">Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
