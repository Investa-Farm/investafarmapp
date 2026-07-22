import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Bell, Building2, Edit2, X, LogOut, Package, MapPin, Phone, Save, RefreshCw, TrendingUp, Users, Leaf } from "lucide-react";
import { getStoredUser, getToken, clearToken, storeUser } from "@/lib/auth";
import { NotificationsPanel } from "@/components/notifications-panel";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

export default function CooperativeProfile() {
  const user = getStoredUser();
  const token = getToken();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const orgType = (user as any)?.orgType ?? localStorage.getItem("investa_coop_org_type") ?? "cooperative";
  const isInputProvider = orgType === "input_supplier";

  const BRAND: Record<string, { gradient: string; badge: string; label: string }> = {
    input_supplier: { gradient: "linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 60%,#3b82f6 100%)", badge: "bg-blue-500 text-white",    label: "Input Provider"   },
    cooperative:    { gradient: "linear-gradient(135deg,#052e16 0%,#14532d 40%,#16a34a 100%)", badge: "bg-emerald-500 text-white", label: "Farmers Connect"  },
    distributor:    { gradient: "linear-gradient(135deg,#052e16 0%,#14532d 40%,#16a34a 100%)", badge: "bg-emerald-500 text-white", label: "Distributor"      },
    aggregator:     { gradient: "linear-gradient(135deg,#052e16 0%,#14532d 40%,#16a34a 100%)", badge: "bg-emerald-500 text-white", label: "Aggregator"       },
  };
  const brand = BRAND[orgType] ?? BRAND.cooperative!;

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState((user as any)?.phone ?? "");
  const [county, setCounty] = useState((user as any)?.county ?? "");
  const [aboutText, setAboutText] = useState(localStorage.getItem("investa_coop_desc") ?? "");

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
    enabled: !!token,
  });
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const { data: stats } = useQuery<any>({
    queryKey: ["cooperative-stats"],
    queryFn: async () => {
      const r = await fetch("/api/cooperative/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return {};
      return r.json();
    },
    staleTime: 120_000,
    enabled: !!token,
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, phone, county }),
      });
      if (r.ok) {
        const updated = await r.json();
        storeUser(updated.user ?? updated);
        localStorage.setItem("investa_coop_desc", aboutText);
        queryClient.invalidateQueries({ queryKey: ["me"] });
        showToast("Profile updated ✓");
        setEditing(false);
      } else {
        showToast("Failed to save — try again");
      }
    } catch {
      showToast("Network error");
    } finally {
      setSaving(false);
    }
  };

  const KENYA_COUNTIES = [
    "Baringo","Bomet","Bungoma","Busia","Elgeyo Marakwet","Embu","Garissa",
    "Homa Bay","Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi",
    "Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos",
    "Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Murang'a",
    "Nairobi","Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri","Samburu",
    "Siaya","Taita Taveta","Tana River","Tharaka Nithi","Trans Nzoia","Turkana",
    "Uasin Gishu","Vihiga","Wajir","West Pokot",
  ];

  return (
    <div className="app-shell pb-10 page-enter">
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">{toast}</div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden" style={{ minHeight: 184 }}>
        <div className="absolute inset-0" style={{ background: brand.gradient }} />
        <div className="relative z-10 pt-12 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setLocation("/cooperative/dashboard")} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <ArrowLeft size={16} className="text-white" />
              </button>
              <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setNotifOpen(true)} className="relative w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <Bell size={16} className="text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">{Math.min(unreadCount, 9)}</span>
                )}
              </button>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                  <Edit2 size={14} className="text-white" />
                </button>
              ) : (
                <button onClick={() => setEditing(false)} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                  <X size={14} className="text-white" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 mb-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center">
              {isInputProvider ? <Package size={28} className="text-white" /> : <Building2 size={28} className="text-white" />}
            </div>
            <div>
              <h1 className="text-white text-lg font-bold">{user?.name}</h1>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${brand.badge}`}>{brand.label}</span>
              <p className="text-white/70 text-xs mt-1">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4 pb-10">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Farmers", val: stats?.farmerCount ?? 0, icon: <Users size={14} className="text-foreground" /> },
            { label: "Vouchers",  val: stats?.activeLoans ?? 0,     icon: <Leaf size={14} className="text-green-600" /> },
            { label: "Revenue",   val: stats?.totalRevenue ? `KES ${(Number(stats.totalRevenue)/1000).toFixed(0)}K` : "—", icon: <TrendingUp size={14} className="text-blue-600" /> },
          ].map(({ label, val, icon }) => (
            <div key={label} className="bg-card rounded-2xl border border-border p-3 text-center">
              <div className="flex justify-center mb-1">{icon}</div>
              <p className="font-bold text-sm text-foreground">{val}</p>
              <p className="text-muted-foreground text-[10px]">{label}</p>
            </div>
          ))}
        </div>

        {/* Details / Edit */}
        {!editing ? (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <p className="text-sm font-bold text-foreground">Organisation Details</p>
            {[
              { icon: <Building2 size={13} />, label: "Organisation", val: user?.name ?? "—" },
              { icon: <span className="text-[11px]">✉</span>, label: "Email", val: user?.email ?? "—" },
              { icon: <Phone size={13} />, label: "Phone", val: (user as any)?.phone || "Not set" },
              { icon: <MapPin size={13} />, label: "County", val: (user as any)?.county || "Not set" },
            ].map(({ icon, label, val }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-muted-foreground text-[10px]">{label}</p>
                  <p className="text-foreground text-xs font-semibold truncate">{val}</p>
                </div>
              </div>
            ))}
            {aboutText && (
              <div className="border-t border-border pt-3">
                <p className="text-muted-foreground text-[10px] mb-1">About</p>
                <p className="text-foreground text-xs leading-relaxed">{aboutText}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <p className="text-sm font-bold text-foreground">Edit Profile</p>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">Organisation Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full mt-1 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-background" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                className="w-full mt-1 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-background" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">County</label>
              <select value={county} onChange={e => setCounty(e.target.value)}
                className="w-full mt-1 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-background">
                <option value="">Select county…</option>
                {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold">About the Organisation</label>
              <textarea value={aboutText} onChange={e => setAboutText(e.target.value)} rows={3}
                placeholder="Describe your cooperative or organisation…"
                className="w-full mt-1 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none bg-background" />
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full bg-[#16a34a] text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}

        {/* Account actions */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-700 text-xs font-bold mb-3">Account</p>
          <button onClick={() => { clearToken(); setLocation("/"); }}
            className="w-full flex items-center gap-3 text-red-600 py-2.5 border border-red-200 rounded-xl px-3 bg-white active:scale-95 transition-all">
            <LogOut size={14} />
            <span className="text-xs font-semibold">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
