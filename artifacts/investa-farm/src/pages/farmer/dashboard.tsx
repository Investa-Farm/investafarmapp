import { useGetFarmerDashboard, useListFarmUpdates, useGetMyFarms } from "@workspace/api-client-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BottomNav } from "@/components/bottom-nav";
import { getStoredUser, clearToken, getToken, isDemoAccount } from "@/lib/auth";
import { Bell, ChevronRight, Leaf, Droplets, Sun, Wheat, DollarSign, ShieldCheck, LogOut, MapPin, TrendingUp, Wallet, Package } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { WalletModal } from "@/components/wallet-modal";
import { useLocation, Link } from "wouter";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { getCropImage } from "@/lib/crops";
import heroImg8 from "@assets/IMG_8016_1781250402404.jpeg";
import { KycModal } from "@/components/kyc-modal";
import { LoanModal } from "@/components/loan-modal";
import { NotificationPrompt } from "@/components/notification-prompt";
import { NotificationsPanel } from "@/components/notifications-panel";
import { InlineMicBot } from "@/components/ai-assistant";
import { SpotlightTour } from "@/components/spotlight-tour";
import { LogoutConfirmDialog } from "@/components/logout-confirm-dialog";

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
  const [walletOpen, setWalletOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: dashboard } = useGetFarmerDashboard({ query: { queryKey: ["farmer-dashboard"], refetchInterval: 30000 } });
  const { data: updates } = useListFarmUpdates();
  const { data: farms } = useGetMyFarms();

  const { data: group } = useQuery<GroupInfo>({
    queryKey: ["my-group"],
    queryFn: async () => {
      const r = await fetch("/api/groups/my", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return undefined;
      return r.json();
    },
  });

  const { data: kycDocs = [] } = useQuery<any[]>({
    queryKey: ["kyc-docs"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: loans = [] } = useQuery<any[]>({
    queryKey: ["loan-apps"],
    queryFn: async () => {
      const r = await fetch("/api/loans/applications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: notifications = [], isError: notifError } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: walletData } = useQuery<{ wallet: { balance: string } }>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { wallet: { balance: "0" } };
      return r.json();
    },
    staleTime: 60_000,
  });

  const { formatAmount } = useCurrency();

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const isDemo = isDemoAccount();
  const kycApproved = isDemo ? 1 : kycDocs.filter((d: any) => d.status === "approved").length;
  const currentFarm = farms?.[0];
  const walletBalance = parseFloat(walletData?.wallet?.balance ?? "0");

  const heroImage = currentFarm?.cropType ? getCropImage(currentFarm.cropType) : heroImg8;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning,";
    if (h < 17) return "Good afternoon,";
    return "Good evening,";
  };
  const detectedStageIndex = CROP_STAGES.findIndex(s => s.key === dashboard?.growthStage);
  const currentStageIndex = detectedStageIndex >= 0 ? detectedStageIndex : 0;
  const farmHealth = dashboard?.growthPercent != null ? Math.round(75 + dashboard.growthPercent * 0.2) : null;
  const farmerShare = dashboard ? Math.round(dashboard.farmValue * 0.55) : 0;


  return (
    <div className="app-shell responsive-shell pb-20 page-enter" data-testid="farmer-dashboard">

      {/* Hero header with one stable crop image */}
      <div className="relative overflow-hidden" style={{ minHeight: 240 }}>
        <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" loading="eager" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.10) 60%, transparent 100%)" }} />

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
                {unreadCount === 0 && notifError && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-white/60 rounded-full border border-white/30" />
                )}
              </button>
              <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <span className="text-white text-sm font-bold">{user?.name?.charAt(0) ?? "F"}</span>
              </div>
              <LogoutConfirmDialog onConfirm={() => { clearToken(); setLocation("/"); }}>
                <button className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                  <LogOut size={14} className="text-white" />
                </button>
              </LogoutConfirmDialog>
            </div>
          </div>

          {/* Greeting */}
          <div className="mt-4 mb-3">
            <p className="text-white/80 text-sm">{getGreeting()}</p>
            <h1 className="text-white text-2xl font-bold flex items-center gap-2">
              {user?.name?.split(" ")[0] ?? "Farmer"} <span>👋</span>
              <InlineMicBot section="farmer-dashboard" role="farmer" />
            </h1>
            <p className="text-white/70 text-xs mt-0.5">Here's what's happening on your farm today.</p>
          </div>
        </div>

        {/* Active Crop Card */}
        <div className="relative z-10 mx-5 mb-4">
          <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.14)" }}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-white/60 text-[10px] uppercase tracking-wider font-semibold">Active Crop</p>
                  <p className="text-white font-bold text-lg leading-tight mt-0.5">
                    {currentFarm?.cropType ?? "No active farm"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <MapPin size={11} className="text-green-300" />
                    <span className="text-green-300 text-xs">{currentFarm?.location ?? "Apply for funding to get started"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-[10px] uppercase tracking-wider font-semibold">Farm Health Score</p>
                  <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                    <p className="text-white font-bold text-2xl">{farmHealth ?? "—"}</p>
                    {farmHealth && <span className="text-white/50 text-sm">/100</span>}
                  </div>
                  {farmHealth && <span className="inline-block bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5">Good</span>}
                  {!farmHealth && <span className="inline-block bg-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5">—</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">

        {/* Wallet summary — balance here, full transactions in the Wallet flow */}
        <div data-tour="farmer-wallet-card" className="rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Wallet size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Wallet balance</p>
              <p className="text-foreground font-bold text-xl">{formatAmount(walletBalance)}</p>
            </div>
            <button onClick={() => setWalletOpen(true)}
              className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform">
              Open wallet <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Apply for Funding — shown when farmer has no active farm */}
        {!currentFarm && (
          <button
            onClick={() => { if (kycApproved >= 1) setLoanOpen(true); else setKycOpen(true); }}
            className="w-full bg-gradient-to-r from-primary to-green-500 rounded-2xl p-5 text-left active:scale-[0.98] transition-transform shadow-lg shadow-primary/30">
            <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mb-1">Get Started</p>
            <p className="text-white font-black text-xl leading-tight mb-1">Apply for Farm Funding</p>
            <p className="text-white/75 text-xs mb-4">List your farm on the investor market and raise capital today</p>
            <div className="flex items-center gap-2 bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 w-fit">
              <DollarSign size={15} className="text-white" />
              <span className="text-white font-bold text-sm">Start Application →</span>
            </div>
          </button>
        )}

        {/* Farm funding progress — rich card with crop image banner */}
        {currentFarm && (
          <button
            onClick={() => setLocation("/farmer/operations")}
            className="w-full rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform shadow-lg shadow-black/10">
            {/* Compact farm status banner */}
            <div className="relative h-24 overflow-hidden bg-gradient-to-br from-[#052e16] via-[#166534] to-[#16a34a]">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
              {/* Top badges */}
              <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between">
                <span className="bg-black/40 backdrop-blur-sm border border-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <MapPin size={8} /> {currentFarm.location}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  (currentFarm.fundingPercent ?? 0) >= 100
                    ? "bg-green-500 text-white"
                    : "bg-amber-400 text-amber-900"
                }`}>
                  {(currentFarm.fundingPercent ?? 0) >= 100 ? "✓ FULLY FUNDED" : "FUNDING"}
                </span>
              </div>
              {/* Bottom crop label */}
              <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
                <div>
                  <p className="text-white font-black text-base leading-tight">{currentFarm.cropType}</p>
                  <p className="text-white/70 text-[9px] font-medium">Active Farm Listing</p>
                </div>
                <p className="text-green-300 font-black text-xl leading-none">{currentFarm.fundingPercent ?? 0}<span className="text-sm">%</span></p>
              </div>
            </div>

            {/* Progress + actions row */}
            <div className="bg-card border-x border-b border-border rounded-b-2xl px-4 py-3 space-y-2.5">
              {/* Funding progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-muted-foreground text-[10px] font-medium">Funding Progress</p>
                  <p className="text-primary text-[10px] font-bold">{currentFarm.fundingPercent ?? 0}% complete</p>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${currentFarm.fundingPercent ?? 0}%`,
                      background: (currentFarm.fundingPercent ?? 0) >= 100
                        ? "linear-gradient(90deg, #16a34a, #4ade80)"
                        : "linear-gradient(90deg, #16a34a, #86efac)"
                    }} />
                </div>
              </div>
              {/* Manage CTA */}
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-[10px]">Tap to manage your listing</p>
                <div className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-lg">
                  <TrendingUp size={11} />
                  <span className="text-[10px] font-bold">Manage</span>
                </div>
              </div>
            </div>
          </button>
        )}


        {/* Agribusiness Voucher — shown when farmer has an approved or disbursed loan */}
        {(isDemo || loans.some((l: any) => ["approved", "disbursed"].includes(l.status))) && (
          <button
            onClick={() => setLocation("/farmer/vouchers")}
            className="w-full bg-green-50 border border-green-300 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Package size={18} className="text-green-700" />
                </div>
                <div>
                  <p className="text-green-900 font-bold text-sm">Order Agri-Inputs</p>
                  <p className="text-green-700 text-[11px]">Seeds, fertilizer &amp; tools — delivered to your farm</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full">FUNDED</span>
                <ChevronRight size={16} className="text-green-500" />
              </div>
            </div>
          </button>
        )}

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

        {/* KYC banner — 3 states: rejected / no-docs / under-review */}
        {!isDemo && (() => {
          const rejectedDocs = kycDocs.filter((d: any) => d.status === "rejected");
          const hasUploads = kycDocs.length > 0;
          if (rejectedDocs.length > 0) {
            return (
              <div data-tour="kyc-prompt" className="bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0 flex-shrink-0">
                    <ShieldCheck size={20} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-red-800 dark:text-red-300 font-bold text-sm">❌ {rejectedDocs.length} Document{rejectedDocs.length > 1 ? "s" : ""} Rejected</p>
                    <div className="mt-1 space-y-0.5">
                      {rejectedDocs.map((d: any) => (
                        <p key={d.id} className="text-red-700 dark:text-red-400 text-xs">
                          <span className="font-semibold">{d.title || d.docType}</span>
                          {d.notes ? <span className="text-red-600 dark:text-red-400"> — {d.notes}</span> : <span className="text-red-500 dark:text-red-400"> — please re-upload a clearer version</span>}
                        </p>
                      ))}
                    </div>
                    <button onClick={() => setLocation("/farmer/kyc")}
                      className="mt-2.5 bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform flex items-center gap-1.5 w-full justify-center">
                      <ShieldCheck size={13} /> Re-upload Documents →
                    </button>
                  </div>
                </div>
              </div>
            );
          }
          if (kycApproved === 0 && !hasUploads) {
            return (
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
            );
          }
          if (kycApproved === 0 && hasUploads) {
            return (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-blue-800 font-bold text-sm">🔍 Documents Under Review</p>
                    <p className="text-blue-700 text-xs mt-0.5 leading-relaxed">
                      Our team is verifying your documents. This takes 24–48 hours. You'll be notified once approved.
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full w-2/3 animate-pulse" />
                      </div>
                      <span className="text-blue-600 text-[10px] font-semibold">{kycDocs.filter((d: any) => d.status === "approved").length}/{kycDocs.length} approved</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

      </div>

      <BottomNav role="farmer" />
      <KycModal open={kycOpen} onClose={() => setKycOpen(false)} onVerified={() => { setKycOpen(false); setLoanOpen(true); }} />
      <LoanModal open={loanOpen} onClose={() => setLoanOpen(false)} />
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
      <NotificationPrompt storageKey="farmer_notif_v1" />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

      <SpotlightTour
        storageKey="investa_spotlight_farmer_v2"
        active={true}
        startDelayMs={2600}
        steps={[
          { selector: '[data-tour="farmer-wallet-card"]', title: "Your Farm Wallet", emoji: "💳", body: "See your balance here. Open the wallet when you need to add funds, withdraw, or view transactions." },
          { selector: '[data-tour="nav-market"]', title: "Sell on the Market", emoji: "🛒", body: "Connect with buyers, check commodity prices, and lock in offtake deals for your harvest." },
          { selector: '[data-tour="kyc-prompt"]', title: "Verify Your Identity", emoji: "🛡️", body: "Complete KYC first — it unlocks funding applications and gets your farm listed to investors." },
        ]}
      />
    </div>
  );
}
