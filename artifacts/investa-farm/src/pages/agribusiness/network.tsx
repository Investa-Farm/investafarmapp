import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoredUser, getToken, formatKES } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Users, MapPin, TrendingUp, Star, Phone, Mail, Calendar, Search, ChevronRight, UserCheck, Clock, CheckCircle2 } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { NotificationsPanel } from "@/components/notifications-panel";
import { Bell } from "lucide-react";

type NetworkFarmer = {
  id: number;
  name: string;
  email: string;
  county?: string;
  phone?: string;
  createdAt: string;
  kycStatus: "none" | "pending" | "approved" | "rejected";
  totalInvested?: number;
  farmCount?: number;
  commissionEarned?: number;
};

export default function AgribusinessNetwork() {
  const user = getStoredUser();
  const token = getToken();
  const [, setLocation] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "kyc_done" | "pending" | "new">("all");
  const agribizType = (user as any)?.agribizType ?? localStorage.getItem("investa_agribiz_type") ?? "farmer_connector";
  const NET_BRAND: Record<string, { gradient: string; title: string; subtitle: string }> = {
    sales_agent:      { gradient: "linear-gradient(135deg,#451a03 0%,#92400e 60%,#f59e0b 100%)", title: "Farmer Prospects",    subtitle: "Farmers you've onboarded & connected"   },
    offtaker:         { gradient: "linear-gradient(135deg,#2e1065 0%,#4c1d95 60%,#7c3aed 100%)", title: "Supply Network",      subtitle: "Farmers available to supply your produce" },
    input_supplier:   { gradient: "linear-gradient(135deg,#431407 0%,#9a3412 60%,#ea580c 100%)", title: "Customer Farmers",    subtitle: "Farmers purchasing your inputs"           },
    farmer_connector: { gradient: "linear-gradient(135deg,#052e16 0%,#14532d 40%,#16a34a 100%)", title: "My Farmer Network",   subtitle: "Farmers you've onboarded to Investa Farm" },
    cooperative:      { gradient: "linear-gradient(135deg,#052e16 0%,#14532d 40%,#16a34a 100%)", title: "Co-operative Members", subtitle: "Registered member farmers"               },
  };
  const netBrand = NET_BRAND[agribizType] ?? NET_BRAND.farmer_connector!;

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const { data: network = [], isLoading } = useQuery<NetworkFarmer[]>({
    queryKey: ["agribiz-network"],
    queryFn: async () => {
      const r = await fetch("/api/agribusiness/my-network", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
    enabled: !!token,
  });

  const { data: stats } = useQuery<{ farmersConnected: number; commissionEarned: number; pendingOrders: number; totalRedeemedKes: number }>({
    queryKey: ["agribiz-stats"],
    queryFn: async () => {
      const r = await fetch("/api/agribusiness/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { farmersConnected: 0, commissionEarned: 0, pendingOrders: 0, totalRedeemedKes: 0 };
      return r.json();
    },
    staleTime: 60_000,
    enabled: !!token,
  });

  const filtered = network.filter(f => {
    const q = search.toLowerCase();
    const matchesSearch = !q || f.name.toLowerCase().includes(q) || (f.county ?? "").toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
    const matchesFilter =
      filter === "all" ? true :
      filter === "kyc_done" ? f.kycStatus === "approved" :
      filter === "pending" ? f.kycStatus === "pending" :
      filter === "new" ? (Date.now() - new Date(f.createdAt).getTime()) < 7 * 86_400_000 : true;
    return matchesSearch && matchesFilter;
  });

  const kycApproved = network.filter(f => f.kycStatus === "approved").length;
  const kycPending = network.filter(f => f.kycStatus === "pending").length;
  const newThisWeek = network.filter(f => (Date.now() - new Date(f.createdAt).getTime()) < 7 * 86_400_000).length;

  const kycBadge = (status: string) => {
    if (status === "approved") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">KYC ✓</span>;
    if (status === "pending") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>;
    if (status === "rejected") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Rejected</span>;
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">No KYC</span>;
  };

  return (
    <div className="app-shell pb-10 page-enter">
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

      {/* Header */}
      <div className="relative overflow-hidden" style={{ minHeight: 160 }}>
        <div className="absolute inset-0" style={{ background: netBrand.gradient }} />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='20' cy='20' r='2'/%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative z-10 pt-12 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setLocation("/agribusiness")} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <ArrowLeft size={16} className="text-white" />
              </button>
              <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            </div>
            <button onClick={() => setNotifOpen(true)} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center relative">
              <Bell size={16} className="text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">{Math.min(unreadCount, 9)}</span>
              )}
            </button>
          </div>
          <div className="mt-4 mb-4">
            <h1 className="text-white text-2xl font-bold">{netBrand.title}</h1>
            <p className="text-white/70 text-xs mt-0.5">{netBrand.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Total", val: network.length, color: "text-foreground" },
            { label: "KYC Done", val: kycApproved, color: "text-green-600" },
            { label: "Pending", val: kycPending, color: "text-amber-600" },
            { label: "This Week", val: newThisWeek, color: "text-blue-600" },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-card rounded-2xl border border-border p-3 text-center">
              <p className={`font-bold text-xl ${color}`}>{val}</p>
              <p className="text-muted-foreground text-[10px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Commission summary */}
        {(stats?.commissionEarned ?? 0) > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-emerald-800 font-bold text-sm">Total Commission Earned</p>
              <p className="text-emerald-700 text-lg font-bold">{formatKES(stats?.commissionEarned ?? 0)}</p>
              <p className="text-emerald-600 text-xs">From {network.length} farmer{network.length !== 1 ? "s" : ""} in your network</p>
            </div>
          </div>
        )}

        {/* Search & filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, county or email…"
              className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(["all", "kyc_done", "pending", "new"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === f ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                {f === "all" ? "All Farmers" : f === "kyc_done" ? "✓ KYC Done" : f === "pending" ? "⏳ Pending" : "🆕 This Week"}
              </button>
            ))}
          </div>
        </div>

        {/* Farmer list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-card rounded-2xl border border-border p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="h-2 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Users size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-semibold text-sm">
              {network.length === 0 ? "No Farmers Yet" : "No Matches"}
            </p>
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
              {network.length === 0
                ? "Share your referral link from the Home tab to start onboarding farmers."
                : "Try adjusting your search or filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(farmer => {
              const joinedDays = Math.floor((Date.now() - new Date(farmer.createdAt).getTime()) / 86_400_000);
              const isNew = joinedDays < 7;
              return (
                <div key={farmer.id} className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-700 font-bold text-base">{farmer.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground truncate">{farmer.name}</p>
                        {isNew && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">New</span>}
                        {kycBadge(farmer.kycStatus)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {farmer.county && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <MapPin size={9} /> {farmer.county}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Calendar size={9} /> Joined {joinedDays === 0 ? "today" : `${joinedDays}d ago`}
                        </span>
                      </div>
                      {(farmer.commissionEarned ?? 0) > 0 && (
                        <p className="text-emerald-600 text-[10px] font-semibold mt-1">
                          Commission: {formatKES(farmer.commissionEarned ?? 0)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {farmer.kycStatus === "approved" ? (
                        <CheckCircle2 size={16} className="text-green-500" />
                      ) : farmer.kycStatus === "pending" ? (
                        <Clock size={16} className="text-amber-500" />
                      ) : (
                        <UserCheck size={16} className="text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground truncate flex-1">{farmer.email}</span>
                    {farmer.phone && (
                      <a href={`tel:${farmer.phone}`} className="flex items-center gap-1 text-[10px] text-primary font-semibold">
                        <Phone size={10} /> Call
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Referral CTA */}
        <Link href="/agribusiness">
          <div className="bg-emerald-600 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">Grow your network</p>
              <p className="text-white/80 text-xs mt-0.5">Share your referral link to onboard more farmers</p>
            </div>
            <ChevronRight size={18} className="text-white" />
          </div>
        </Link>
      </div>

      <style>{`.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </div>
  );
}
