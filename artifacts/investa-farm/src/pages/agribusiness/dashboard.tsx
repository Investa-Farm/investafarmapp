import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoredUser, getToken, clearToken, formatKES } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { Bell, LogOut, Package, Handshake, TrendingUp, Users, ShieldCheck, ChevronRight, MapPin, Star } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { NotificationsPanel } from "@/components/notifications-panel";
import { AppTour } from "@/components/app-tour";

export default function AgribusinessDashboard() {
  const user = getStoredUser();
  const token = getToken();
  const [, setLocation] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const agribizType = (user as any)?.agribizType ?? localStorage.getItem("investa_agribiz_type") ?? "farmer_connector";
  const isInputSupplier = agribizType === "input_supplier";

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
  const kycPending = kycDocs.filter((d: any) => d.status === "pending").length;
  const kycApproved = kycDocs.filter((d: any) => d.status === "approved").length;

  const { data: agribizStats } = useQuery<{
    pendingOrders: number; totalRedeemedKes: number; farmersConnected: number; commissionEarned: number;
  }>({
    queryKey: ["agribiz-stats"],
    queryFn: async () => {
      const r = await fetch("/api/agribusiness/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { pendingOrders: 0, totalRedeemedKes: 0, farmersConnected: 0, commissionEarned: 0 };
      return r.json();
    },
    staleTime: 60_000,
    enabled: !!token,
  });

  return (
    <div className="app-shell pb-20 page-enter">
      {/* Header */}
      <div className="relative overflow-hidden" style={{ minHeight: 200 }}>
        <div className={`absolute inset-0 ${isInputSupplier ? "bg-gradient-to-br from-amber-800 via-orange-700 to-amber-600" : ""}`}
          style={isInputSupplier ? {} : { background: "linear-gradient(135deg, #052e16 0%, #14532d 40%, #16a34a 80%, #22c55e 100%)" }} />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='20' cy='20' r='2'/%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative z-10 pt-12 px-5">
          <div className="flex items-center justify-between">
            <img src={logoSrc} alt="Investa Farm" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            <div className="flex items-center gap-2">
              <button onClick={() => setNotifOpen(true)} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center relative">
                <Bell size={16} className="text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">{Math.min(unreadCount, 9)}</span>
                )}
              </button>
              <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <span className="text-white text-sm font-bold">{user?.name?.charAt(0) ?? "A"}</span>
              </div>
              <button onClick={() => { clearToken(); setLocation("/"); }} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <LogOut size={14} className="text-white" />
              </button>
            </div>
          </div>
          <div className="mt-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isInputSupplier ? "bg-orange-500 text-white" : "bg-emerald-500 text-white"}`}>
                {isInputSupplier ? "Input Supplier" : "Farmer Connector"}
              </span>
            </div>
            <h1 className="text-white text-2xl font-bold">Welcome, {user?.name?.split(" ")[0] ?? "Partner"} 👋</h1>
            <p className="text-white/70 text-xs mt-0.5">
              {isInputSupplier ? "Manage voucher orders and supply to local farmers" : "Connect farmers to investment and support their growth"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {/* KYC Status Card */}
        {kycApproved < 2 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-amber-800 font-bold text-sm">Complete Business KYC</p>
              <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                {kycPending > 0 ? "Your documents are under review. Our team will notify you within 24–48 hours." : "Upload your business documents to get verified and start operating on the platform."}
              </p>
              {kycPending === 0 && (
                <Link href="/agribusiness/kyc">
                  <button className="mt-2 bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl w-full flex items-center justify-center gap-1.5">
                    <ShieldCheck size={13} /> Upload Documents →
                  </button>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {isInputSupplier ? (
            <>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Pending Voucher Orders</p>
                <p className="text-foreground font-bold text-2xl mt-1">
                  {agribizStats ? String(agribizStats.pendingOrders) : "—"}
                </p>
                <p className="text-orange-500 text-[10px] font-medium mt-0.5">
                  {agribizStats?.pendingOrders === 0 ? "All up to date" : "Awaiting fulfilment"}
                </p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Total Redeemed</p>
                <p className="text-foreground font-bold text-xl mt-1">
                  {agribizStats ? formatKES(agribizStats.totalRedeemedKes) : "—"}
                </p>
                <p className="text-muted-foreground text-[10px] mt-0.5">This season</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Farmers in Network</p>
                <p className="text-foreground font-bold text-2xl mt-1">
                  {agribizStats ? String(agribizStats.farmersConnected) : "—"}
                </p>
                <p className="text-green-500 text-[10px] font-medium mt-0.5">Unique farmers connected</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Commission Earned</p>
                <p className="text-foreground font-bold text-xl mt-1">
                  {agribizStats ? formatKES(agribizStats.commissionEarned) : "—"}
                </p>
                <p className="text-muted-foreground text-[10px] mt-0.5">This season</p>
              </div>
            </>
          )}
          <div className="bg-card rounded-2xl border border-border p-3.5">
            <p className="text-muted-foreground text-[10px]">KYC Status</p>
            <p className={`font-bold text-sm mt-1 ${kycApproved >= 2 ? "text-green-600" : kycPending > 0 ? "text-blue-500" : "text-amber-600"}`}>
              {kycApproved >= 2 ? "✓ Verified" : kycPending > 0 ? "Under Review" : "Pending"}
            </p>
            <p className="text-muted-foreground text-[10px] mt-0.5">{kycApproved}/{kycDocs.length} docs approved</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-3.5">
            <p className="text-muted-foreground text-[10px]">Platform Status</p>
            <p className="text-green-600 font-bold text-sm mt-1">Active</p>
            <p className="text-muted-foreground text-[10px] mt-0.5">Partner account</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <p className="font-semibold text-sm">Quick Actions</p>
          {isInputSupplier ? (
            <>
              <Link href="/agribusiness/orders">
                <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-98 transition-transform">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Package size={20} className="text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Voucher Orders</p>
                    <p className="text-muted-foreground text-xs">View and fulfil incoming farmer voucher orders</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </Link>
              <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-98 transition-transform">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <MapPin size={20} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">My Business Location</p>
                  <p className="text-muted-foreground text-xs">Update your location so nearby farmers can find you</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
              <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-98 transition-transform">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Catalogue & Pricing</p>
                  <p className="text-muted-foreground text-xs">List the inputs you supply and set your prices</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-98 transition-transform">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Handshake size={20} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Refer a Farmer</p>
                  <p className="text-muted-foreground text-xs">Invite farmers to join Investa Farm and earn a commission</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
              <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-98 transition-transform">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Users size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">My Farmer Network</p>
                  <p className="text-muted-foreground text-xs">View all farmers you've onboarded and their progress</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
              <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-98 transition-transform">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Star size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Commission History</p>
                  <p className="text-muted-foreground text-xs">Track your earnings from farmer referrals</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </>
          )}
        </div>

        {/* How it works */}
        <div className={`rounded-2xl p-4 border ${isInputSupplier ? "bg-orange-50 border-orange-200" : "bg-emerald-50 border-emerald-200"}`}>
          <p className={`font-semibold text-sm mb-2 ${isInputSupplier ? "text-orange-800" : "text-emerald-800"}`}>
            {isInputSupplier ? "📦 How Input Vouchers Work" : "🤝 How Farmer Connecting Works"}
          </p>
          {isInputSupplier ? (
            <ul className={`text-xs space-y-1 ${isInputSupplier ? "text-orange-700" : "text-emerald-700"}`}>
              <li>1. Farmer receives funding and a voucher code is generated</li>
              <li>2. You're assigned as their nearest verified input supplier</li>
              <li>3. Farmer presents their voucher code at your business</li>
              <li>4. You fulfil the order and mark it as redeemed</li>
              <li>5. Payment is processed directly to your account</li>
            </ul>
          ) : (
            <ul className="text-xs text-emerald-700 space-y-1">
              <li>1. Refer farmers in your area to the Investa Farm platform</li>
              <li>2. Support them through KYC and funding application</li>
              <li>3. Earn a commission when their farm gets funded by investors</li>
              <li>4. Get ongoing commissions on future funding rounds</li>
            </ul>
          )}
        </div>
      </div>

      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <AppTour role="agribusiness" />
    </div>
  );
}
