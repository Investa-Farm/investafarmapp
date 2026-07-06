import { useGetFarmerDashboard, useListFarmUpdates, useGetMyFarms } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getStoredUser, clearToken, getToken, isDemoAccount } from "@/lib/auth";
import { Bell, ChevronRight, Leaf, Droplets, Sun, Wheat, DollarSign, ShieldCheck, LogOut, MapPin, TrendingUp, Wallet, ArrowUpRight, Globe2, ShoppingBag, Package } from "lucide-react";
import { useCurrency, CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { HarvestPaymentModal } from "@/components/harvest-payment-modal";
import { WalletModal } from "@/components/wallet-modal";
import { useLocation, Link } from "wouter";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { getCropImage } from "@/lib/crops";
import heroImg1 from "@assets/pexels-livier-garcia-645743-1459331_1781945539889.jpg";
import heroImg2 from "@assets/pexels-fatima-yusuf-323522203-30541313_1781945539888.jpg";
import heroImg3 from "@assets/IMG_8010_1781245320473.jpeg";
import heroImg4 from "@assets/pexels-carina-chowanek-297993717-13340333_1781945269230.jpg";
import heroImg5 from "@assets/pexels-elizabeth-tamara-27565957-19239403_1781945269226.jpg";
import heroImg6 from "@assets/pexels-lisa-yakurim-40702902-13076945_1781945269227.jpg";
import heroImg7 from "@assets/pexels-markus-winkler-1430818-2862150_1781945269224.jpg";
import heroImg8 from "@assets/IMG_8016_1781250402404.jpeg";
import { KycModal } from "@/components/kyc-modal";
import { LoanModal } from "@/components/loan-modal";
import { NotificationPrompt } from "@/components/notification-prompt";
import { NotificationsPanel } from "@/components/notifications-panel";
import { InlineMicBot } from "@/components/ai-assistant";
import { AppTour } from "@/components/app-tour";
import { SpotlightTour } from "@/components/spotlight-tour";

const ALL_CROP_SLIDES = [heroImg1, heroImg2, heroImg3, heroImg4, heroImg5, heroImg6, heroImg7, heroImg8];

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
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setHeroIdx(i => (i + 1) % ALL_CROP_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("investa_theme", next ? "dark" : "light");
  };

  const { data: dashboard, isLoading } = useGetFarmerDashboard({ query: { queryKey: ["farmer-dashboard"], refetchInterval: 30000 } });
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

  const { formatAmount, currency, setCurrency } = useCurrency();
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const isDemo = isDemoAccount();
  const kycApproved = isDemo ? 1 : kycDocs.filter((d: any) => d.status === "approved").length;
  const currentFarm = farms?.[0];
  const walletBalance = parseFloat(walletData?.wallet?.balance ?? "0");

  // Build hero slides: if farmer has a crop, lead with that crop's image; then cycle rest
  const heroSlides = (() => {
    if (currentFarm?.cropType) {
      const cropImg = getCropImage(currentFarm.cropType);
      const rest = ALL_CROP_SLIDES.filter(s => s !== cropImg);
      return [cropImg, ...rest];
    }
    return ALL_CROP_SLIDES;
  })();

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning,";
    if (h < 17) return "Good afternoon,";
    return "Good evening,";
  };
  const currentStageIndex = Math.max(0, CROP_STAGES.findIndex(s => s.key === dashboard?.growthStage) ?? 1);
  const farmHealth = dashboard?.growthPercent != null ? Math.round(75 + dashboard.growthPercent * 0.2) : null;
  const farmerShare = dashboard ? Math.round(dashboard.farmValue * 0.55) : 0;


  return (
    <div className="app-shell pb-20 page-enter" data-testid="farmer-dashboard">

      {/* Hero header with crop slideshow background */}
      <div className="relative overflow-hidden" style={{ minHeight: 240 }}>
        {heroSlides.map((img, i) => {
          const current = heroIdx % heroSlides.length;
          const next = (heroIdx + 1) % heroSlides.length;
          if (i !== current && i !== next) return null;
          return (
            <img key={i} src={img} alt="Farm"
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
              style={{ opacity: current === i ? 1 : 0 }}
              loading={i === 0 ? "eager" : "lazy"} />
          );
        })}
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
              <button onClick={() => { clearToken(); setLocation("/"); }}
                className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <LogOut size={14} className="text-white" />
              </button>
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

        {/* Slide indicator dots */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
          {heroSlides.map((_, i) => (
            <button key={i} onClick={() => setHeroIdx(i)}
              className={`rounded-full transition-all duration-300 ${heroIdx % heroSlides.length === i ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`} />
          ))}
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

        {/* Wallet card — styled like a premium bank card */}
        <div
          className="relative rounded-[22px] overflow-hidden select-none shadow-2xl"
          style={{ minHeight: 190 }}
        >
          {/* Crop image background — uses current farm's crop or fallback */}
          <img
            src={currentFarm?.cropType ? getCropImage(currentFarm.cropType) : heroImg8}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Dark green gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg, rgba(5,46,22,0.92) 0%, rgba(20,83,45,0.88) 45%, rgba(22,101,52,0.80) 70%, rgba(22,163,74,0.78) 100%)" }}
          />
          {/* Subtle dot pattern */}
          <div className="absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)", backgroundSize: "18px 18px" }} />

          <div className="relative p-4 flex flex-col justify-between" style={{ minHeight: 190 }}>
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Wallet size={14} className="text-green-300" />
                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Farmer Wallet</p>
              </div>
              {/* Currency picker */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setCurrencyPickerOpen(o => !o)}
                    className="flex items-center gap-1 text-green-300 text-[10px] font-bold bg-white/10 px-2 py-1 rounded-lg active:bg-white/20 transition-colors"
                  >
                    <Globe2 size={9} />
                    {currency.flag} {currency.code}
                  </button>
                  {currencyPickerOpen && (
                    <div className="absolute right-0 top-7 z-20 bg-[#052e16] border border-white/20 rounded-xl shadow-2xl overflow-hidden w-44">
                      {CURRENCIES.map(c => (
                        <button
                          key={c.code}
                          onClick={() => { setCurrency(c.code as CurrencyCode); setCurrencyPickerOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                            c.code === currency.code ? "bg-white/20 text-white font-bold" : "text-white/70 hover:bg-white/10"
                          }`}
                        >
                          <span>{c.flag}</span>
                          <span className="font-semibold">{c.code}</span>
                          <span className="text-white/50 text-[10px] ml-auto">{c.symbol}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Gold chip */}
                <div className="w-8 h-6 rounded-sm bg-amber-300/80 border border-amber-200/50 flex flex-col justify-center items-center gap-0.5 p-1">
                  <div className="w-full h-0.5 bg-amber-600/40 rounded" />
                  <div className="w-full h-0.5 bg-amber-600/40 rounded" />
                </div>
              </div>
            </div>

            {/* Balance — centre */}
            <div className="text-center py-2">
              <p className="text-white/60 text-[9px] uppercase tracking-widest mb-0.5">Available Balance</p>
              <p className="text-white font-bold text-4xl tracking-tight drop-shadow-lg">{formatAmount(walletBalance)}</p>
              {currency.code !== "KES" && (
                <p className="text-white/40 text-[10px] mt-0.5">≈ {formatKES(walletBalance)}</p>
              )}
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-green-300 text-[9px] font-semibold uppercase tracking-wider">Live Balance</p>
              </div>
            </div>

            {/* Bottom row — action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setWalletOpen(true)}
                className="flex items-center justify-center gap-2 py-2.5 bg-white/15 border border-white/25 rounded-xl active:bg-white/25 transition-colors">
                <Wallet size={13} className="text-green-300" />
                <span className="text-white text-xs font-semibold">Open Wallet</span>
              </button>
              <button onClick={() => setLocation("/farmer/wallet")}
                className="flex items-center justify-center gap-2 py-2.5 bg-white/15 border border-white/25 rounded-xl active:bg-white/25 transition-colors">
                <ArrowUpRight size={13} className="text-green-300" />
                <span className="text-white text-xs font-semibold">Withdraw</span>
              </button>
            </div>
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
            {/* Crop image banner */}
            <div className="relative h-28 overflow-hidden">
              <img src={getCropImage(currentFarm.cropType)} alt={currentFarm.cropType}
                className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
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

        {/* Repay Loan — quick access card shown when farmer has active loans */}
        {loans.length > 0 && (
          <button
            onClick={() => setLocation("/farmer/loan-apply")}
            className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <DollarSign size={18} className="text-amber-700" />
                </div>
                <div>
                  <p className="text-amber-900 font-bold text-sm">Repay Your Loan</p>
                  <p className="text-amber-700 text-[11px]">
                    {loans.filter((l: any) => ["approved","disbursed","submitted","under_review"].includes(l.status)).length} active loan{loans.filter((l: any) => ["approved","disbursed","submitted","under_review"].includes(l.status)).length !== 1 ? "s" : ""} · tap to make a repayment
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-amber-500" />
            </div>
          </button>
        )}

        {/* Agribusiness Voucher — shown when farmer has a disbursed loan */}
        {loans.some((l: any) => l.status === "disbursed") && (
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
              <div data-tour="kyc-prompt" className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 flex-shrink-0">
                    <ShieldCheck size={20} className="text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-red-800 font-bold text-sm">❌ {rejectedDocs.length} Document{rejectedDocs.length > 1 ? "s" : ""} Rejected</p>
                    <div className="mt-1 space-y-0.5">
                      {rejectedDocs.map((d: any) => (
                        <p key={d.id} className="text-red-700 text-xs">
                          <span className="font-semibold">{d.title || d.docType}</span>
                          {d.notes ? <span className="text-red-600"> — {d.notes}</span> : <span className="text-red-500"> — please re-upload a clearer version</span>}
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

      {/* Farmer platform guide */}
      <div className="mx-4 mb-4 bg-green-50 border border-green-200 rounded-2xl p-4">
        <p className="text-green-800 text-xs font-bold mb-2 flex items-center gap-1.5">🌾 Getting Started Guide</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
            <p className="text-green-700 text-xs"><strong>Complete KYC</strong> — Upload your ID and farm documents for verification.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
            <p className="text-green-700 text-xs"><strong>Apply for Funding</strong> — List your farm shares on the primary market.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
            <p className="text-green-700 text-xs"><strong>Post Updates</strong> — Keep investors informed to build trust and attract more capital.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">4</span>
            <p className="text-green-700 text-xs"><strong>Repay &amp; Grow</strong> — Share profits with investors and access larger funding rounds.</p>
          </div>
        </div>
      </div>

      <BottomNav role="farmer" />
      <KycModal open={kycOpen} onClose={() => setKycOpen(false)} onVerified={() => { setKycOpen(false); setLoanOpen(true); }} />
      <LoanModal open={loanOpen} onClose={() => setLoanOpen(false)} />
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
      <HarvestPaymentModal open={harvestOpen} onClose={() => setHarvestOpen(false)} />
      <NotificationPrompt storageKey="farmer_notif_v1" />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <AppTour role="farmer" />
      <SpotlightTour
        storageKey="investa_spotlight_farmer_v1"
        active={true}
        startDelayMs={2600}
        steps={[
          { selector: '[data-tour="kyc-prompt"]', title: "Verify Your Identity", emoji: "🛡️", body: "Complete this step first — it unlocks funding applications and gets your farm listed to investors." },
          { selector: '[data-tour="nav-portfolio"]', title: "Track Everything", emoji: "📊", body: "Use the bottom nav to check your wallet, funding progress, and post field updates." },
        ]}
      />
    </div>
  );
}
