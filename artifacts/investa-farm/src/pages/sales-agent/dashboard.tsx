import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Briefcase, Copy, Check, Users, Link2, Send,
  ChevronRight, LogOut, FileText, Star, Wallet, Home, BarChart2,
} from "lucide-react";
import { getToken, getStoredUser } from "@/lib/auth";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

const AGENT_TABS = [
  { id: "overview",  label: "Home",      icon: Home       },
  { id: "farmers",   label: "Farmers",   icon: Users      },
  { id: "proposals", label: "Proposals", icon: FileText   },
] as const;
type AgentTab = typeof AGENT_TABS[number]["id"];

const AMBER = "#d97706";
const AMBER_BG = "bg-amber-50";
const AMBER_BORDER = "border-amber-200";

export default function SalesAgentDashboard() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const user = getStoredUser() as any;

  const [copiedLink, setCopiedLink] = useState(false);
  const [stats, setStats] = useState({ farmers: 0, proposals: 0, funded: 0, commission: 0 });
  const [farmers, setFarmers] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<AgentTab>("overview");
  const [loading, setLoading] = useState(true);

  const agentCode = user?.id ? String(user.id).padStart(6, "0") : "000000";
  const referralLink = `${window.location.origin}/invite/${agentCode}`;

  useEffect(() => {
    if (!token) { setLocation("/cooperative-auth"); return; }
    loadData();
  }, [token]);

  async function loadData() {
    setLoading(true);
    try {
      const [notifsResp, proposalsResp] = await Promise.all([
        fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/agribusiness/proposals", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);
      const notifs = notifsResp.ok ? await notifsResp.json() : [];
      const propsList = proposalsResp && proposalsResp.ok ? await proposalsResp.json() : [];
      setProposals(Array.isArray(propsList) ? propsList : []);
      setStats({
        farmers: 0,
        proposals: Array.isArray(propsList) ? propsList.length : 0,
        funded: 0,
        commission: 0,
      });
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({
        title: "Join Investa Farm",
        text: `I'd like to onboard you as a farmer on Investa Farm — Africa's leading farm investment platform. Register via my link:`,
        url: referralLink,
      }).catch(() => {});
    } else {
      await copyLink();
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("investa_coop_sub_type");
    setLocation("/cooperative-auth");
  }

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-14 pb-8"
        style={{ background: "linear-gradient(135deg,#92400e 0%,#d97706 60%,#fbbf24 100%)" }}>
        <div className="flex items-center justify-between mb-6">
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
            <button onClick={handleLogout} className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center">
              <LogOut size={15} className="text-white" />
            </button>
          </div>
        </div>

        {/* Agent code badge */}
        <div className="bg-white/15 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-semibold">Agent Code</p>
            <p className="text-white font-bold text-xl font-mono tracking-widest">IFV-{agentCode}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="bg-white/20 border border-white/30 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Active</span>
            <span className="text-white/60 text-[10px]">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 -mt-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Farmers", value: stats.farmers, icon: Users },
            { label: "Proposals", value: stats.proposals, icon: FileText },
            { label: "Funded", value: stats.funded, icon: Star },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm border border-border p-3 text-center">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-1.5">
                <Icon size={14} className="text-amber-600" />
              </div>
              <p className="text-foreground font-bold text-lg leading-tight">{value}</p>
              <p className="text-muted-foreground text-[10px]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 mt-4 pb-24 space-y-4 overflow-y-auto">
        {activeTab === "overview" && (
          <>
            {/* Referral link card */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 size={16} className="text-amber-600" />
                <p className="text-amber-800 font-bold text-sm">Your Referral Link</p>
              </div>
              <div className="bg-white border border-amber-200 rounded-xl px-3 py-2.5">
                <p className="text-foreground font-mono text-xs break-all">{referralLink}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={copyLink}
                  className="flex items-center justify-center gap-1.5 bg-white border border-amber-300 text-amber-700 text-xs font-semibold py-2.5 rounded-xl active:scale-95">
                  {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                  {copiedLink ? "Copied!" : "Copy Link"}
                </button>
                <button onClick={shareLink}
                  className="flex items-center justify-center gap-1.5 bg-amber-500 text-white text-xs font-semibold py-2.5 rounded-xl active:scale-95 shadow-sm">
                  <Send size={13} />
                  Share
                </button>
              </div>
              <p className="text-amber-600 text-[10px] leading-relaxed">
                Share this link with farmers. When they register and their farm gets funded, you earn commission on each successful investment.
              </p>
            </div>

            {/* Crop Proposal card */}
            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-foreground font-bold text-sm">Submit Crop Proposal</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">+ Commission</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed mb-3">
                Know a farmer with a crop ready for investment? Submit a proposal on their behalf — Investa Farm's team will review and reach out.
              </p>
              <button
                onClick={() => setLocation("/farmer/crop-proposal")}
                className="w-full flex items-center justify-between bg-amber-500 text-white font-semibold px-4 py-3 rounded-xl text-sm active:scale-95">
                <span>Submit New Proposal</span>
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Commission info */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={15} className="text-green-600" />
                <p className="text-green-800 font-bold text-sm">Commission Structure</p>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: "Farm listed", reward: "KES 500" },
                  { label: "Farm funded (50%+)", reward: "1% of funds raised" },
                  { label: "Farm fully funded", reward: "2% of total raise" },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <p className="text-green-700 text-xs">{r.label}</p>
                    <p className="text-green-800 font-bold text-xs">{r.reward}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="bg-white border border-border rounded-2xl p-4">
              <p className="text-foreground font-bold text-sm mb-3">How It Works</p>
              <div className="space-y-3">
                {[
                  { step: "1", title: "Share your link", desc: "Send your referral link to farmers in your network." },
                  { step: "2", title: "Farmer registers", desc: "They sign up and list their farm on Investa Farm." },
                  { step: "3", title: "Investors fund", desc: "Investors discover and fund the farm." },
                  { step: "4", title: "You earn", desc: "Commission credited to your agent wallet." },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-amber-700 text-[10px] font-bold">{s.step}</span>
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
                  className="mt-4 bg-amber-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl active:scale-95">
                  Share Link Now
                </button>
              </div>
            ) : farmers.map((f: any) => (
              <div key={f.id} className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Users size={16} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-foreground font-semibold text-sm">{f.name}</p>
                  <p className="text-muted-foreground text-xs">{f.email}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.farmFunded ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {f.farmFunded ? "Funded" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "proposals" && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
            ) : proposals.length === 0 ? (
              <div className="py-12 text-center">
                <FileText size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-foreground font-semibold text-sm">No proposals yet</p>
                <p className="text-muted-foreground text-xs mt-1">Submit a crop proposal to get started.</p>
                <button onClick={() => setLocation("/farmer/crop-proposal")}
                  className="mt-4 bg-amber-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl active:scale-95">
                  Submit Proposal
                </button>
              </div>
            ) : proposals.map((p: any) => (
              <div key={p.id} className="bg-white border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-foreground font-semibold text-sm">{p.cropType ?? "Crop"} Farm</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    p.status === "approved" ? "bg-green-100 text-green-700" :
                    p.status === "rejected" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>{p.status ?? "pending"}</span>
                </div>
                <p className="text-muted-foreground text-xs">{p.location ?? ""} · {p.size ?? ""} acres</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed mobile bottom nav — centered max-w-[430px] */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 bg-white border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}>
        <div className="flex justify-around items-stretch">
          {AGENT_TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                  active ? "text-amber-500" : "text-muted-foreground"
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
