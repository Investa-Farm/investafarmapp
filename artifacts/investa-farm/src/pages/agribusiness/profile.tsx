import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStoredUser, getToken, storeUser } from "@/lib/auth";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, MapPin, Phone, Mail, Shield, ShieldCheck, Clock, Upload, Edit2, Save, X, ChevronRight, Star, Globe, FileText, Bell } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { NotificationsPanel } from "@/components/notifications-panel";

export default function AgribusinessProfile() {
  const user = getStoredUser();
  const token = getToken();
  const [, setLocation] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const agribizType = (user as any)?.agribizType ?? localStorage.getItem("investa_agribiz_type") ?? "farmer_connector";
  const isInputSupplier = agribizType === "input_supplier";

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState((user as any)?.phone ?? "");
  const [county, setCounty] = useState((user as any)?.county ?? "");
  const [businessDesc, setBusinessDesc] = useState(localStorage.getItem("investa_agribiz_desc") ?? "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const { data: kycDocs = [] } = useQuery<any[]>({
    queryKey: ["kyc-docs"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const kycApproved = kycDocs.filter((d: any) => d.status === "approved").length;
  const kycPending = kycDocs.filter((d: any) => d.status === "pending").length;
  const isVerified = kycApproved >= 2;

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
        localStorage.setItem("investa_agribiz_desc", businessDesc);
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
    "Nairobi","Kiambu","Nakuru","Kisumu","Mombasa","Nyeri","Machakos","Eldoret",
    "Thika","Meru","Embu","Kitale","Kakamega","Kisii","Garissa","Isiolo","Lamu",
    "Marsabit","Migori","Narok","Nyandarua","Samburu","Siaya","Taita Taveta",
    "Trans Nzoia","Turkana","Uasin Gishu","Vihiga","West Pokot","Kericho",
    "Baringo","Bungoma","Busia","Elgeyo Marakwet","Homa Bay","Kajiado","Kilifi",
    "Kirinyaga","Kwale","Laikipia","Makueni","Mandera","Murang'a","Tharaka Nithi",
    "Wajir","Nandi","Nyamira","Tana River","Bomet","Chesimba",
  ].sort();

  return (
    <div className="app-shell pb-10 page-enter">
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden" style={{ minHeight: 180 }}>
        <div className="absolute inset-0" style={isInputSupplier
          ? { background: "linear-gradient(135deg, #431407 0%, #9a3412 60%, #ea580c 100%)" }
          : { background: "linear-gradient(135deg, #052e16 0%, #14532d 40%, #16a34a 80%, #22c55e 100%)" }} />
        <div className="relative z-10 pt-12 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setLocation("/agribusiness")} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <ArrowLeft size={16} className="text-white" />
              </button>
              <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setNotifOpen(true)} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center relative">
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
              <span className="text-white text-2xl font-bold">{user?.name?.charAt(0) ?? "A"}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white text-lg font-bold">{user?.name}</h1>
                {isVerified && <ShieldCheck size={16} className="text-green-300" />}
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isInputSupplier ? "bg-orange-500 text-white" : "bg-emerald-500 text-white"}`}>
                {isInputSupplier ? "Input Supplier" : "Farmer Connector"}
              </span>
              <p className="text-white/70 text-xs mt-1">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {/* KYC Status */}
        <div className={`rounded-2xl p-4 border flex items-center gap-3 ${isVerified ? "bg-green-50 border-green-200" : kycPending > 0 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isVerified ? "bg-green-100" : kycPending > 0 ? "bg-blue-100" : "bg-amber-100"}`}>
            {isVerified ? <ShieldCheck size={20} className="text-green-600" /> : <Shield size={20} className={kycPending > 0 ? "text-blue-600" : "text-amber-600"} />}
          </div>
          <div className="flex-1">
            <p className={`font-bold text-sm ${isVerified ? "text-green-800" : kycPending > 0 ? "text-blue-800" : "text-amber-800"}`}>
              {isVerified ? "Business Verified ✓" : kycPending > 0 ? "Documents Under Review" : "KYC Incomplete"}
            </p>
            <p className={`text-xs mt-0.5 ${isVerified ? "text-green-700" : kycPending > 0 ? "text-blue-700" : "text-amber-700"}`}>
              {isVerified ? `${kycApproved} documents approved — full access unlocked` :
               kycPending > 0 ? "Our team will review within 24–48 hours" :
               "Upload your business documents to get verified"}
            </p>
          </div>
          {!isVerified && kycPending === 0 && (
            <button onClick={() => setLocation("/agribusiness/kyc")} className="text-amber-700 text-[10px] font-bold underline shrink-0">Upload →</button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {isInputSupplier ? (
            <>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Orders Fulfilled</p>
                <p className="text-foreground font-bold text-2xl mt-1">{stats?.pendingOrders ?? "—"}</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Total Redeemed</p>
                <p className="text-foreground font-bold text-base mt-1">KES {(stats?.totalRedeemedKes ?? 0).toLocaleString()}</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Farmers Connected</p>
                <p className="text-green-600 font-bold text-2xl mt-1">{stats?.farmersConnected ?? "—"}</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Total Commission</p>
                <p className="text-foreground font-bold text-base mt-1">KES {(stats?.commissionEarned ?? 0).toLocaleString()}</p>
              </div>
            </>
          )}
        </div>

        {/* Profile details / edit form */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="font-semibold text-sm">Business Details</p>
            {editing && (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-60">
                {saving ? "Saving…" : <><Save size={11} /> Save</>}
              </button>
            )}
          </div>
          <div className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Business / Partner Name</label>
              {editing ? (
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="mt-1 w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              ) : (
                <p className="mt-1 text-sm font-medium text-foreground">{user?.name ?? "—"}</p>
              )}
            </div>
            {/* Email */}
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Email Address</label>
              <p className="mt-1 text-sm text-foreground">{user?.email ?? "—"}</p>
            </div>
            {/* Phone */}
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Phone Number</label>
              {editing ? (
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+254 7XX XXX XXX"
                  className="mt-1 w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              ) : (
                <p className="mt-1 text-sm text-foreground">{(user as any)?.phone ?? "Not set"}</p>
              )}
            </div>
            {/* County */}
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">County / Region</label>
              {editing ? (
                <select value={county} onChange={e => setCounty(e.target.value)}
                  className="mt-1 w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white">
                  <option value="">Select county</option>
                  {KENYA_COUNTIES.map(c => <option key={c}>{c}</option>)}
                </select>
              ) : (
                <p className="mt-1 text-sm text-foreground">{(user as any)?.county ?? "Not set"}</p>
              )}
            </div>
            {/* Business description */}
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">About Your Business</label>
              {editing ? (
                <textarea value={businessDesc} onChange={e => setBusinessDesc(e.target.value)}
                  placeholder="Brief description of your business and services…"
                  rows={3}
                  className="mt-1 w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none" />
              ) : (
                <p className="mt-1 text-sm text-foreground leading-relaxed">{businessDesc || "No description added yet."}</p>
              )}
            </div>
            {/* Type */}
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Partner Type</label>
              <p className="mt-1">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isInputSupplier ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"}`}>
                  {isInputSupplier ? "Input Supplier" : "Farmer Connector"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">KYC Documents</p>
          </div>
          <div className="divide-y divide-border">
            {kycDocs.length === 0 ? (
              <div className="p-4 text-center">
                <FileText size={24} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No documents uploaded</p>
                <button onClick={() => setLocation("/agribusiness/kyc")}
                  className="mt-2 text-xs text-primary font-semibold underline">
                  Upload Documents →
                </button>
              </div>
            ) : kycDocs.map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <FileText size={14} className="text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{doc.docType}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString("en-KE")}</p>
                </div>
                {doc.status === "approved" ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Approved</span>
                ) : doc.status === "pending" ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Under Review</span>
                ) : (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Rejected</span>
                )}
              </div>
            ))}
          </div>
          {kycDocs.length > 0 && !isVerified && (
            <div className="px-4 pb-4">
              <button onClick={() => setLocation("/agribusiness/kyc")}
                className="w-full flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-semibold text-foreground">
                <Upload size={14} /> Upload More Documents
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
