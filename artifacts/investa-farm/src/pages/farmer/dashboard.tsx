import { useGetFarmerDashboard, useListFarmUpdates, useGetMyFarms } from "@workspace/api-client-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getStoredUser, clearToken, getToken } from "@/lib/auth";
import { Bell, ChevronRight, Leaf, Droplets, Sun, Wheat, DollarSign, Users, ShieldCheck, LogOut, MapPin, TrendingUp, CalendarDays, AlertCircle, Moon, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { FARMER_HERO_IMAGE } from "@/lib/crops";
import { KycModal } from "@/components/kyc-modal";
import { LoanModal } from "@/components/loan-modal";
import { CoachMark, type CoachStep } from "@/components/coach-mark";
import { NotificationPrompt } from "@/components/notification-prompt";
import { NotificationsPanel } from "@/components/notifications-panel";
import { AppTour } from "@/components/app-tour";
import { AiAssistant } from "@/components/ai-assistant";

type GroupInfo = { id: number; name: string; registrationNumber: string; county: string; memberCount: number; status: string } | null;

const CROP_STAGES = [
  { key: "planting",   label: "Planting",   icon: Leaf       },
  { key: "vegetative", label: "Vegetative",  icon: Droplets   },
  { key: "flowering",  label: "Flowering",   icon: Sun        },
  { key: "fruiting",   label: "Fruiting",    icon: Wheat      },
  { key: "harvest",    label: "Harvest",     icon: TrendingUp },
];

export default function FarmerDashboard() {
  const user = getStoredUser();
  const token = getToken();
  const [, setLocation] = useLocation();
  const [kycOpen, setKycOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("investa_theme", next ? "dark" : "light");
  };

  const { data: dashboard, isLoading } = useGetFarmerDashboard({ query: { refetchInterval: 30000 } });
  const { data: updates } = useListFarmUpdates();
  const { data: farms } = useGetMyFarms();

  const { data: group } = useQuery<GroupInfo>({
    queryKey: ["my-group"],
    queryFn: async () => {
      const r = await fetch("/api/groups/my", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const { data: kycDocs = [] } = useQuery<any[]>({
    queryKey: ["kyc-docs"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const { data: loans = [] } = useQuery<any[]>({
    queryKey: ["loan-apps"],
    queryFn: async () => {
      const r = await fetch("/api/loans/applications", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
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

  const kycApproved = kycDocs.filter((d: any) => d.status === "approved").length;
  const currentFarm = farms?.[0];
  const currentStageIndex = Math.max(0, CROP_STAGES.findIndex(s => s.key === dashboard?.growthStage) ?? 1);
  const farmHealth = dashboard ? Math.round(75 + dashboard.growthPercent * 0.2) : null;
  const farmerShare = dashboard ? Math.round(dashboard.farmValue * 0.55) : 0;

  const FARMER_STEPS: CoachStep[] = [
    { target: "[data-testid='farmer-dashboard']", title: "Welcome, Farmer!", body: "This is your farm command centre. Check crop health, funding progress, and earnings here.", position: "bottom" },
    { target: "[data-testid='nav-my-farm']", title: "My Farm Profile", body: "View how your farm looks to investors and manage your public listing.", position: "top" },
    { target: "[data-testid='nav-market']", title: "Buyer Market", body: "Browse buyer offers and manage contracts for your produce.", position: "top" },
  ];

  return (
    <div className="app-shell pb-20 page-enter" data-testid="farmer-dashboard">

      {/* Hero header with farm background */}
      <div className="relative overflow-hidden" style={{ minHeight: 240 }}>
        <img src={FARMER_HERO_IMAGE} alt="Farm" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />

        {/* Top bar */}
        <div className="relative z-10 pt-12 px-5">
          <div className="flex items-center justify-between">
            <img src={logoSrc} alt="Investa Farm" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            <div className="flex items-center gap-2">
              <button onClick={() => setNotifOpen(true)}
                className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center relative">
                <Bell size={16} className="text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">
                    {Math.min(unreadCount, 9)}
                  </span>
                )}
              </button>
              <button onClick={toggleDark}
                className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center"
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
                {isDark ? <Sun size={16} className="text-white" /> : <Moon size={16} className="text-white" />}
              </button>
              <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <span className="text-white text-sm font-bold">{user?.name?.charAt(0) ?? "F"}</span>
              </div>
              <button onClick={() => { clearToken(); setLocation("/"); }}
                className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <LogOut size={14} className="text-white" />
              </button>
            </div>
          </div>

          {/* Greeting */}
          <div className="mt-4 mb-3">
            <p className="text-white/80 text-sm">Good morning,</p>
            <h1 className="text-white text-2xl font-bold flex items-center gap-2">
              {user?.name?.split(" ")[0] ?? "Farmer"} <span>👋</span>
            </h1>
            <p className="text-white/70 text-xs mt-0.5">Here's what's happening on your farm today.</p>
          </div>
        </div>

        {/* Active Crop Card */}
        <div className="relative z-10 mx-5 mb-0">
          <div className="rounded-2xl overflow-hidden shadow-lg" style={{ background: "rgba(15,75,53,0.92)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-white/60 text-[10px] uppercase tracking-wider font-semibold">Active Crop</p>
                  <p className="text-white font-bold text-lg leading-tight mt-0.5">
                    {currentFarm?.cropType ?? "—"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <MapPin size={11} className="text-green-300" />
                    <span className="text-green-300 text-xs">{currentFarm?.location ?? "—"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-[10px] uppercase tracking-wider font-semibold">Farm Health Score</p>
                  <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                    <p className="text-white font-bold text-2xl">{farmHealth ?? "—"}</p>
                    {farmHealth && <span className="text-white/50 text-sm">/100</span>}
                  </div>
                  {farmHealth && <span className="inline-block bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5">Good</span>}
                </div>
              </div>
              <button className="mt-3 w-full flex items-center justify-center gap-2 py-2 border border-white/20 rounded-xl text-white/80 text-xs font-medium active:scale-95 transition-transform">
                View crop details <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl border border-border p-3.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-[10px]">Projected Harvest Revenue</p>
              <TrendingUp size={13} className="text-green-500" />
            </div>
            <p className="text-foreground font-bold text-lg">{dashboard ? formatKES(dashboard.farmValue) : "—"}</p>
            <p className="text-green-600 text-[10px] font-medium">{dashboard?.weekChangePercent ? `+${dashboard.weekChangePercent}% this week` : "Pending data"}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-3.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-[10px]">Harvest In</p>
              <CalendarDays size={13} className="text-primary" />
            </div>
            {dashboard?.harvestDays != null ? (
              <>
                <p className="text-foreground font-bold text-lg">{dashboard.harvestDays} Days</p>
                <p className="text-primary text-[10px] font-medium">{CROP_STAGES[Math.min(currentStageIndex, 4)]?.label ?? "—"} stage</p>
              </>
            ) : (
              <>
                <p className="text-foreground font-bold text-lg">—</p>
                <p className="text-muted-foreground text-[10px]">No active crop</p>
              </>
            )}
          </div>
          <div className="bg-card rounded-2xl border border-border p-3.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-[10px]">Your Estimated Share</p>
              <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">55%</span>
            </div>
            <p className="text-foreground font-bold text-lg">{dashboard ? formatKES(farmerShare) : "—"}</p>
            <p className="text-muted-foreground text-[10px]">After investor split</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-3.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-[10px]">Funds Raised</p>
              <Users size={13} className="text-blue-500" />
            </div>
            <p className="text-foreground font-bold text-lg">{dashboard ? formatKES(dashboard.fundsRaised ?? 0) : "—"}</p>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-muted-foreground text-[10px]">{dashboard?.totalInvestors ?? 0} investors</p>
              {(dashboard?.fundingPercent ?? 0) > 0 && (
                <span className="text-primary text-[9px] font-bold">{dashboard?.fundingPercent}% funded</span>
              )}
            </div>
            {(dashboard?.fundingPercent ?? 0) > 0 && (
              <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${Math.min(dashboard?.fundingPercent ?? 0, 100)}%` }} />
              </div>
            )}
          </div>
        </div>

        {/* Crop Timeline — only show when there's a real active stage */}
        {currentFarm && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-sm">Crop Timeline</p>
              {dashboard?.growthPercent != null && (
                <span className="text-primary text-xs font-semibold">{dashboard.growthPercent}% complete</span>
              )}
            </div>
            <div className="relative">
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted rounded-full" />
              <div className="absolute top-4 left-4 h-0.5 bg-primary rounded-full transition-all duration-700"
                style={{ width: `${Math.min(currentStageIndex / (CROP_STAGES.length - 1) * 100, 100)}%`, right: "auto", maxWidth: "calc(100% - 32px)" }} />
              <div className="flex justify-between relative z-10">
                {CROP_STAGES.map((stage, i) => {
                  const Icon = stage.icon;
                  const done = i < currentStageIndex;
                  const current = i === currentStageIndex;
                  return (
                    <div key={stage.key} className="flex flex-col items-center gap-1.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                        current ? "bg-primary border-primary shadow-md shadow-primary/30" :
                        done ? "bg-primary/20 border-primary" : "bg-white border-border"}`}>
                        <Icon size={13} className={current ? "text-white" : done ? "text-primary" : "text-muted-foreground"} />
                      </div>
                      <p className={`text-[9px] font-medium text-center leading-tight ${current ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground"}`}>
                        {stage.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity — only show real updates */}
        {updates && updates.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="font-semibold text-sm">Recent Activity</p>
              <Link href="/farmer/updates">
                <span className="text-primary text-xs font-medium flex items-center gap-0.5">View all <ChevronRight size={13} /></span>
              </Link>
            </div>
            <div className="space-y-2">
              {updates.slice(0, 3).map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 bg-card rounded-xl border border-border p-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base bg-green-50 text-green-600">🌱</div>
                  <div className="flex-1">
                    <p className="text-foreground text-xs font-medium">{u.title}</p>
                    <p className="text-muted-foreground text-[10px]">{u.farmName}</p>
                  </div>
                  <p className="text-muted-foreground text-[10px] flex-shrink-0">{u.hoursAgo}h ago</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KYC banner — shown prominently if not completed */}
        {kycApproved === 0 && (
          <div data-tour="kyc-prompt" className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-amber-800 font-bold text-sm">Complete KYC First</p>
                <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                  Identity verification is required before you can apply for funding or get listed on the investor market.
                </p>
                <button onClick={() => setKycOpen(true)}
                  className="mt-2.5 bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform flex items-center gap-1.5 w-full justify-center">
                  <ShieldCheck size={13} /> Verify Identity Now →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick access */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => { if (kycApproved >= 1) setLoanOpen(true); else setKycOpen(true); }}
            className={`rounded-2xl p-3 text-center cursor-pointer active:scale-95 transition-transform relative ${
              kycApproved >= 1
                ? "bg-primary/5 border border-primary/20"
                : "bg-gray-50 border border-gray-200 opacity-60"
            }`}
          >
            <DollarSign size={20} className={`mx-auto mb-1 ${kycApproved >= 1 ? "text-primary" : "text-gray-400"}`} />
            <p className="text-foreground text-[10px] font-medium">Funding</p>
            {loans.length > 0
              ? <p className="text-primary text-[9px] font-bold mt-0.5">{loans.length} apps</p>
              : kycApproved === 0
                ? <p className="text-amber-600 text-[9px] font-bold mt-0.5">KYC first</p>
                : <p className="text-primary text-[9px] font-bold mt-0.5">Apply</p>
            }
          </button>
          <button onClick={() => setKycOpen(true)}
            className={`rounded-2xl p-3 text-center cursor-pointer active:scale-95 transition-transform relative ${
              kycApproved >= 1
                ? "bg-green-50 border border-green-100"
                : "bg-amber-50 border-2 border-amber-300 animate-pulse"
            }`}>
            <ShieldCheck size={20} className={`mx-auto mb-1 ${kycApproved >= 1 ? "text-primary" : "text-amber-600"}`} />
            <p className={`text-[10px] font-medium ${kycApproved >= 1 ? "text-foreground" : "text-amber-800 font-bold"}`}>KYC Docs</p>
            {kycDocs.length > 0
              ? <p className={`text-[9px] font-bold mt-0.5 ${kycApproved >= 1 ? "text-primary" : "text-amber-600"}`}>{kycApproved}/{kycDocs.length} ✓</p>
              : <p className="text-amber-600 text-[9px] font-bold mt-0.5">Required ⚠</p>}
          </button>
          <Link href="/farmer/updates">
            <div className="bg-card border border-border rounded-2xl p-3 text-center cursor-pointer active:scale-95 transition-transform">
              <Settings size={20} className="text-primary mx-auto mb-1" />
              <p className="text-foreground text-[10px] font-medium">Farm Updates</p>
            </div>
          </Link>
        </div>
      </div>

      <BottomNav role="farmer" />
      <KycModal open={kycOpen} onClose={() => setKycOpen(false)} onVerified={() => { setKycOpen(false); setLoanOpen(true); }} />
      <LoanModal open={loanOpen} onClose={() => setLoanOpen(false)} />
      <CoachMark steps={FARMER_STEPS} storageKey="farmer_onboarding_v2" />
      <NotificationPrompt storageKey="farmer_notif_v1" />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <AppTour role="farmer" />
      <AiAssistant role="farmer" />
    </div>
  );
}
