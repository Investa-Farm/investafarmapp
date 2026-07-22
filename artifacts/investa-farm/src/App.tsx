import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { PriceAlertWatcher } from "@/components/price-alert-watcher";
import { PushScheduler } from "@/components/push-scheduler";
import { RateAppModal, useRateAppTrigger } from "@/components/rate-app-modal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getToken, getStoredUser } from "@/lib/auth";
import { setInstallPrompt } from "@/lib/pwa";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { CurrencyProvider } from "@/lib/currency";
import { SecurityGuard } from "@/components/security-guard";
import { ErrorBoundary } from "@/components/error-boundary";
import { CenterSuccessHost } from "@/components/center-success-modal";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

import Landing from "@/pages/landing";
import FarmerAuth from "@/pages/farmer-auth";
import InvestorAuth from "@/pages/investor-auth";
import AuthCallback from "@/pages/auth-callback";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Onboarding from "@/pages/onboarding";
import VerifyOtp from "@/pages/verify-otp";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";

import MarketHome from "@/pages/market/index";
import PrimaryMarket from "@/pages/market/primary";
import SecondaryMarket from "@/pages/market/secondary";
import FarmMap from "@/pages/market/farm-map";
import MarketPreview from "@/pages/market/preview";
import FarmDetail from "@/pages/market/farm-detail";
import FarmExchange from "@/pages/market/farm-exchange";
import CommunityPortfolios from "@/pages/market/community-portfolios";
import Portfolio from "@/pages/portfolio";
import Activity from "@/pages/activity";
import Profile from "@/pages/profile";
import InvestorWallet from "@/pages/wallet";

import FarmerDashboard from "@/pages/farmer/dashboard";
import FarmerOperations from "@/pages/farmer/operations";
import FarmerMarket from "@/pages/farmer/market";
import FarmerNews from "@/pages/farmer/news";
import FarmProfile from "@/pages/farmer/farm-profile";
import FarmerUpdates from "@/pages/farmer/updates";
import GroupSetup from "@/pages/farmer/group-setup";
import FarmerKyc from "@/pages/farmer/kyc";
import LoanApply from "@/pages/farmer/loan-apply";
import FarmerProfile from "@/pages/farmer/profile";
import FarmerWallet from "@/pages/farmer/wallet";
import FarmerHealth from "@/pages/farmer/health";
import FarmerTotp from "@/pages/farmer/totp";
import CropProposal from "@/pages/farmer/crop-proposal";
import FarmerNotifications from "@/pages/farmer/notifications";
import FarmerVouchers from "@/pages/farmer/vouchers";

import CooperativeAuth from "@/pages/cooperative-auth";
import CooperativeDashboard from "@/pages/cooperative/dashboard";
import CooperativeProfile from "@/pages/cooperative/profile";
import SalesAgentDashboard from "@/pages/sales-agent/dashboard";
import OfftakerDashboard from "@/pages/offtaker/dashboard";

import AgribusinessDashboard from "@/pages/agribusiness/dashboard";
import AgribusinessOrders from "@/pages/agribusiness/orders";
import AgribusinessNetwork from "@/pages/agribusiness/network";
import AgribusinessProfile from "@/pages/agribusiness/profile";
import AgribusinessKyc from "@/pages/agribusiness/kyc";
import FundManagerDashboard from "@/pages/market/fund-dashboard";
import WealthAuth from "@/pages/wealth-auth";
import WealthDashboard from "@/pages/wealth/dashboard";

import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import BetsPage from "@/pages/bets/index";
import SyndicatesPage from "@/pages/syndicates/index";
import FaqPage from "@/pages/faq";
import NotificationsPage from "@/pages/notifications";
import SystemArchitecture from "@/pages/architecture";
import NotFound from "@/pages/not-found";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

setAuthTokenGetter(() => getToken());

// Initialise dark mode from the logged-in account's saved preference.
// Token now lives in sessionStorage (cleared on browser close), so read
// the user ID from there to look up their per-account theme key.
{
  const _raw = sessionStorage.getItem("investa_user");
  const _uid = _raw ? (() => { try { return JSON.parse(_raw).id; } catch { return null; } })() : null;
  if (_uid && localStorage.getItem(`investa_theme_${_uid}`) === "dark") {
    document.documentElement.classList.add("dark");
  }
}

type AppRole = "farmer" | "investor" | "cooperative" | "agribusiness";

function VerifyBanner({ email, createdAt }: { email?: string; createdAt?: string }) {
  const [, setLocation] = useLocation();
  const token = getToken();
  const dismissKey = "investa_verify_dismissed";

  const registeredMs = createdAt ? new Date(createdAt).getTime() : 0;
  const daysSinceReg = registeredMs ? (Date.now() - registeredMs) / 86_400_000 : 0;
  const isOverdue = daysSinceReg >= 7;

  const [dismissed, setDismissed] = useState(() => {
    const v = localStorage.getItem(dismissKey);
    return !isOverdue && v ? Date.now() - parseInt(v) < 86_400_000 : false;
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (dismissed) return null;

  const handleResend = async () => {
    if (sending || sent) return;
    setSending(true);
    try {
      await fetch("/api/auth/send-otp", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setSent(true);
      setTimeout(() => setSent(false), 60_000);
    } catch { /* silent */ } finally { setSending(false); }
  };

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, String(Date.now()));
    setDismissed(true);
  };

  const bg = isOverdue ? "bg-red-600" : "bg-amber-500";
  const label = isOverdue
    ? "⚠️ Verify email now — account may be restricted."
    : "📧 Email not verified. Verify to protect your account.";

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${bg} text-white text-xs font-semibold flex items-center gap-2 px-3 py-2 shadow-md max-w-[430px] mx-auto`}>
      <span className="flex-1 leading-snug truncate">{label}</span>
      <button
        onClick={handleResend}
        disabled={sending || sent}
        className="bg-white/20 border border-white/40 rounded-lg px-2 py-0.5 text-[10px] font-bold shrink-0 disabled:opacity-60"
      >
        {sent ? "✓ Sent!" : sending ? "…" : "Resend"}
      </button>
      <button
        onClick={() => { const em = encodeURIComponent(email ?? ""); setLocation(`/verify-otp?email=${em}`); }}
        className="bg-white/30 border border-white/50 rounded-lg px-2 py-0.5 text-[10px] font-bold shrink-0"
      >
        Verify
      </button>
      {!isOverdue && (
        <button onClick={handleDismiss} className="opacity-70 hover:opacity-100 text-base leading-none shrink-0">×</button>
      )}
    </div>
  );
}

function AuthGuard({ children, role }: { children: React.ReactNode; role?: AppRole }) {
  const token = getToken();
  const user = getStoredUser();
  if (!token) return <Redirect to="/login" />;

  const emailVerified = (user as any)?.emailVerified;
  const createdAt = (user as any)?.createdAt as string | undefined;

  // Hard-block only after 7-day grace period
  if (emailVerified === false && createdAt) {
    const daysSince = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
    if (daysSince >= 7) {
      const email = encodeURIComponent((user as any)?.email ?? "");
      return <Redirect to={`/verify-otp?email=${email}`} />;
    }
  }

  const userRole = (user as any)?.role as string | undefined;
  if (role && userRole !== role) {
    if (userRole === "farmer") return <Redirect to="/farmer" />;
    if (userRole === "cooperative") return <Redirect to="/cooperative/dashboard" />;
    if (userRole === "agribusiness") {
      const subType = localStorage.getItem("investa_coop_sub_type");
      if (subType === "sales_agent") return <Redirect to="/sales-agent/dashboard" />;
      if (subType === "offtaker") return <Redirect to="/offtaker/dashboard" />;
      return <Redirect to="/agribusiness" />;
    }
    return <Redirect to="/market" />;
  }
  return (
    <>
      {emailVerified === false && (
        <VerifyBanner email={(user as any)?.email} createdAt={createdAt} />
      )}
      {children}
    </>
  );
}

function GuestGuard({ children }: { children: React.ReactNode }) {
  const token = getToken();
  const user = getStoredUser();
  const userRole = (user as any)?.role as string | undefined;
  if (token && userRole) {
    if (userRole === "farmer") return <Redirect to="/farmer" />;
    if (userRole === "cooperative") return <Redirect to="/cooperative/dashboard" />;
    if (userRole === "agribusiness") {
      const subType = localStorage.getItem("investa_coop_sub_type");
      if (subType === "sales_agent") return <Redirect to="/sales-agent/dashboard" />;
      if (subType === "offtaker") return <Redirect to="/offtaker/dashboard" />;
      return <Redirect to="/agribusiness" />;
    }
    if (sessionStorage.getItem("investa_investor_type") === "fund_manager") return <Redirect to="/wealth" />;
    return <Redirect to="/market" />;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public landing & auth */}
      <Route path="/">
        <GuestGuard><Landing /></GuestGuard>
      </Route>
      <Route path="/farmer-auth">
        <GuestGuard><FarmerAuth /></GuestGuard>
      </Route>
      <Route path="/investor-auth">
        <GuestGuard><InvestorAuth /></GuestGuard>
      </Route>
      <Route path="/wealth-auth">
        <GuestGuard><InvestorAuth /></GuestGuard>
      </Route>
      <Route path="/login">
        <GuestGuard><Login /></GuestGuard>
      </Route>
      <Route path="/register">
        <GuestGuard><Register /></GuestGuard>
      </Route>
      <Route path="/onboarding">
        <GuestGuard><Onboarding /></GuestGuard>
      </Route>
      <Route path="/auth-callback">
        <AuthCallback />
      </Route>
      <Route path="/verify-otp">
        <VerifyOtp />
      </Route>
      <Route path="/forgot-password">
        <ForgotPassword />
      </Route>
      <Route path="/reset-password">
        <ResetPassword />
      </Route>

      {/* Public market preview — no login required */}
      <Route path="/market/preview">
        <MarketPreview />
      </Route>

      {/* Investor routes */}
      <Route path="/market/fund">
        <AuthGuard role="investor"><FundManagerDashboard /></AuthGuard>
      </Route>
      <Route path="/market">
        <AuthGuard role="investor">
          {sessionStorage.getItem("investa_investor_type") === "fund_manager"
            ? <Redirect to="/market/fund" />
            : <MarketHome />}
        </AuthGuard>
      </Route>
      <Route path="/market/primary">
        <AuthGuard role="investor"><PrimaryMarket /></AuthGuard>
      </Route>
      <Route path="/market/secondary">
        <AuthGuard role="investor"><SecondaryMarket /></AuthGuard>
      </Route>
      <Route path="/market/map">
        <AuthGuard role="investor"><FarmMap /></AuthGuard>
      </Route>
      <Route path="/market/portfolios">
        <AuthGuard role="investor"><CommunityPortfolios /></AuthGuard>
      </Route>
      <Route path="/market/portfolios/:id">
        <CommunityPortfolios />
      </Route>
      <Route path="/market/exchange/:id">
        <AuthGuard role="investor"><FarmExchange /></AuthGuard>
      </Route>
      <Route path="/market/:id">
        <FarmDetail />
      </Route>
      <Route path="/portfolio">
        <AuthGuard role="investor"><Portfolio /></AuthGuard>
      </Route>
      <Route path="/activity">
        <AuthGuard role="investor"><Activity /></AuthGuard>
      </Route>
      <Route path="/profile">
        <AuthGuard role="investor"><Profile /></AuthGuard>
      </Route>
      <Route path="/wallet">
        <AuthGuard role="investor"><InvestorWallet /></AuthGuard>
      </Route>
      <Route path="/notifications">
        <AuthGuard role="investor"><NotificationsPage /></AuthGuard>
      </Route>

      {/* Wealth Management routes */}
      <Route path="/wealth">
        <AuthGuard role="investor"><WealthDashboard /></AuthGuard>
      </Route>

      {/* Cooperative routes */}
      <Route path="/cooperative-auth">
        <GuestGuard><CooperativeAuth /></GuestGuard>
      </Route>
      <Route path="/cooperative/dashboard">
        <AuthGuard role="cooperative"><CooperativeDashboard /></AuthGuard>
      </Route>
      <Route path="/cooperative/profile">
        <AuthGuard role="cooperative"><CooperativeProfile /></AuthGuard>
      </Route>

      {/* Farmer routes */}
      <Route path="/farmer">
        <AuthGuard role="farmer"><FarmerDashboard /></AuthGuard>
      </Route>
      <Route path="/farmer/group">
        <AuthGuard role="farmer"><GroupSetup /></AuthGuard>
      </Route>
      <Route path="/farmer/kyc">
        <AuthGuard role="farmer"><FarmerKyc /></AuthGuard>
      </Route>
      <Route path="/farmer/loans">
        <AuthGuard role="farmer"><LoanApply /></AuthGuard>
      </Route>
      <Route path="/farmer/vouchers">
        <AuthGuard role="farmer"><FarmerVouchers /></AuthGuard>
      </Route>
      <Route path="/farmer/funding">
        <AuthGuard role="farmer"><CropProposal /></AuthGuard>
      </Route>
      <Route path="/farmer/operations">
        <AuthGuard role="farmer"><FarmerOperations /></AuthGuard>
      </Route>
      <Route path="/farmer/market">
        <AuthGuard role="farmer"><FarmerMarket /></AuthGuard>
      </Route>
      <Route path="/farmer/news">
        <AuthGuard role="farmer"><FarmerNews /></AuthGuard>
      </Route>
      <Route path="/farmer/farm-profile">
        <AuthGuard role="farmer"><FarmProfile /></AuthGuard>
      </Route>
      <Route path="/farmer/wallet">
        <AuthGuard role="farmer"><FarmerWallet /></AuthGuard>
      </Route>
      <Route path="/farmer/updates">
        <AuthGuard role="farmer"><FarmerUpdates /></AuthGuard>
      </Route>
      <Route path="/farmer/profile">
        <AuthGuard role="farmer"><FarmerProfile /></AuthGuard>
      </Route>
      <Route path="/farmer/health">
        <AuthGuard role="farmer"><FarmerHealth /></AuthGuard>
      </Route>
      <Route path="/farmer/crop-proposal">
        <AuthGuard role="farmer"><CropProposal /></AuthGuard>
      </Route>
      <Route path="/farmer/notifications">
        <AuthGuard role="farmer"><FarmerNotifications /></AuthGuard>
      </Route>
      <Route path="/farmer/totp">
        <AuthGuard role="farmer"><FarmerTotp /></AuthGuard>
      </Route>

      {/* Sales Agent routes */}
      <Route path="/sales-agent/dashboard">
        <AuthGuard role="agribusiness"><SalesAgentDashboard /></AuthGuard>
      </Route>

      {/* Offtaker routes */}
      <Route path="/offtaker/dashboard">
        <AuthGuard role="agribusiness"><OfftakerDashboard /></AuthGuard>
      </Route>

      {/* Agribusiness routes */}
      <Route path="/agribusiness">
        <AuthGuard role="agribusiness"><AgribusinessDashboard /></AuthGuard>
      </Route>
      <Route path="/agribusiness/orders">
        <AuthGuard role="agribusiness"><AgribusinessOrders /></AuthGuard>
      </Route>
      <Route path="/agribusiness/network">
        <AuthGuard role="agribusiness"><AgribusinessNetwork /></AuthGuard>
      </Route>
      <Route path="/agribusiness/profile">
        <AuthGuard role="agribusiness"><AgribusinessProfile /></AuthGuard>
      </Route>
      <Route path="/agribusiness/kyc">
        <AuthGuard role="agribusiness"><AgribusinessKyc /></AuthGuard>
      </Route>

      {/* Bets — prediction market for investors */}
      <Route path="/bets">
        <AuthGuard role="investor"><BetsPage /></AuthGuard>
      </Route>

      {/* Syndicates — farmer groups + investor funding */}
      <Route path="/syndicates">
        <AuthGuard><SyndicatesPage /></AuthGuard>
      </Route>
      <Route path="/farmer/syndicates">
        <AuthGuard role="farmer"><SyndicatesPage /></AuthGuard>
      </Route>

      {/* FAQ — accessible from profile for any logged-in user */}
      <Route path="/faq">
        <FaqPage />
      </Route>

      {/* System architecture docs — admin only */}
      <Route path="/architecture">
        {(() => {
          const adminAuth = typeof window !== "undefined" && sessionStorage.getItem("admin_auth");
          return adminAuth ? <SystemArchitecture /> : <Redirect to="/admin/dashboard" />;
        })()}
      </Route>

      {/* Admin routes — no AuthGuard, uses sessionStorage */}
      <Route path="/admin">
        <AdminLogin />
      </Route>
      <Route path="/admin/dashboard">
        <AdminDashboard />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem("investa_pwa_dismissed"));
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const standalone = (window.navigator as any).standalone === true;
    setIsIos(ios);
    setIsStandalone(standalone);
    if (ios && !standalone && !localStorage.getItem("investa_pwa_dismissed")) {
      const t = setTimeout(() => setShowIosTip(true), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    setShowIosTip(false);
    localStorage.setItem("investa_pwa_dismissed", "1");
  };

  // iOS: "Install Now" guide for Safari
  if (isIos && !isStandalone && showIosTip && !dismissed) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[70] px-3 pb-4 max-w-[430px] mx-auto">
        <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#052e16 0%,#14532d 60%,#166534 100%)", border: "1px solid rgba(134,239,172,0.25)" }}>
          {/* Header */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl overflow-hidden flex-shrink-0 border border-white/20">
                <img src="/icon-192.png" alt="Investa Farm" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-white font-black text-sm leading-tight tracking-tight">Install Now</p>
                <p className="text-green-300/80 text-[10px] font-medium">Add Investa Farm to your iPhone</p>
              </div>
            </div>
            <button onClick={dismiss} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-lg leading-none">×</button>
          </div>
          {/* Steps */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/30 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">⎋</span>
              </div>
              <p className="text-white/90 text-xs leading-snug">Tap the <strong className="text-white">Share</strong> button at the bottom of Safari</p>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-green-500/30 border border-green-400/30 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">＋</span>
              </div>
              <p className="text-white/90 text-xs leading-snug">Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong></p>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/30 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">✓</span>
              </div>
              <p className="text-white/90 text-xs leading-snug">Tap <strong className="text-white">Add</strong> — the app appears on your home screen instantly</p>
            </div>
          </div>
          {/* CTA row */}
          <div className="px-4 pb-4 flex items-center gap-2">
            <div className="flex-1 text-center bg-white rounded-xl py-2.5 shadow-lg active:scale-95 transition-transform">
              <p className="text-[#052e16] font-black text-xs tracking-tight">📲 Install Now — It's Free</p>
            </div>
            <button onClick={dismiss} className="text-white/40 text-[10px] px-2">Later</button>
          </div>
        </div>
        {/* Down-arrow pointing to Safari toolbar */}
        <div className="flex justify-center mt-1">
          <div className="w-3 h-3 rotate-45 border-b border-r" style={{ background: "#166534", borderColor: "rgba(134,239,172,0.25)" }} />
        </div>
      </div>
    );
  }

  // Android / Chrome: native install prompt
  if (!prompt || dismissed) return null;

  const install = async () => {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") { setPrompt(null); localStorage.setItem("investa_pwa_dismissed", "1"); }
    else setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[70] px-4 max-w-[430px] mx-auto">
      <div className="bg-[#052e16] rounded-2xl shadow-2xl flex items-center gap-3 px-4 py-3.5 border border-green-700">
        <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-green-600/40">
          <img src="/icon-192.png" alt="Investa Farm" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">Install Investa Farm</p>
          <p className="text-white/60 text-[10px]">Add to home screen — works offline, instant access</p>
        </div>
        <button onClick={install}
          className="bg-[#16a34a] text-white text-xs font-bold px-4 py-2.5 rounded-xl flex-shrink-0 active:scale-95 transition-transform shadow-lg shadow-green-900/40">
          Install
        </button>
        <button onClick={dismiss} className="text-white/50 text-xl leading-none flex-shrink-0 w-7 flex items-center justify-center">×</button>
      </div>
    </div>
  );
}

function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "#050d06" }}
    >
      {/* Deep ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 65%, rgba(22,163,74,0.22) 0%, transparent 70%)",
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 40% 30% at 50% 38%, rgba(134,239,172,0.09) 0%, transparent 60%)",
      }} />

      {/* Subtle dot-grid texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }} />

      {/* Floating orbs — different delays so they feel organic */}
      {[
        { size: 5, x: "18%", y: "25%", dur: 3.4, delay: 0.2 },
        { size: 3, x: "75%", y: "20%", dur: 2.7, delay: 0.7 },
        { size: 4, x: "60%", y: "62%", dur: 3.9, delay: 0.0 },
        { size: 3, x: "28%", y: "68%", dur: 2.5, delay: 1.1 },
        { size: 6, x: "82%", y: "55%", dur: 4.1, delay: 0.4 },
        { size: 4, x: "10%", y: "55%", dur: 3.2, delay: 0.9 },
      ].map((p, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none"
          style={{
            left: p.x, top: p.y, width: p.size, height: p.size,
            background: "rgba(74,222,128,0.55)",
            animation: `splash-orb ${p.dur}s ${p.delay}s ease-in-out infinite`,
          }} />
      ))}

      {/* Expanding rings behind logo */}
      <div className="absolute" style={{ animation: "splash-ring 2.8s 0.6s ease-out infinite" }}>
        <div className="w-40 h-40 rounded-full border border-green-500/15" />
      </div>
      <div className="absolute" style={{ animation: "splash-ring 2.8s 1.2s ease-out infinite" }}>
        <div className="w-40 h-40 rounded-full border border-green-500/10" />
      </div>

      {/* Logo badge */}
      <div style={{ animation: "splash-pop 0.7s 0.1s cubic-bezier(0.34,1.56,0.64,1) both", position: "relative", zIndex: 1 }}>
        <div className="relative">
          {/* Inner pulse glow */}
          <div className="absolute -inset-5 rounded-full pointer-events-none" style={{
            background: "radial-gradient(circle, rgba(22,163,74,0.45) 0%, transparent 70%)",
            animation: "splash-pulse 2.6s 0.9s ease-in-out infinite",
          }} />
          <div className="w-28 h-28 rounded-3xl flex items-center justify-center relative"
            style={{
              background: "linear-gradient(145deg, rgba(22,163,74,0.18) 0%, rgba(5,46,22,0.55) 100%)",
              border: "1px solid rgba(74,222,128,0.3)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 0 40px rgba(22,163,74,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}>
            <img
              src={logoSrc}
              alt="Investa Farm"
              className="h-16 w-auto select-none"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>
        </div>
      </div>

      {/* Brand name — staggered reveal */}
      <p className="text-white font-black text-[26px] mt-7 tracking-tight relative z-10"
        style={{ animation: "splash-up 0.65s 0.55s ease both", letterSpacing: "-0.02em" }}>
        Investa <span style={{ color: "#4ade80" }}>Farm</span>
      </p>
      <p className="text-white/35 text-[11px] mt-2 tracking-[0.22em] uppercase relative z-10"
        style={{ animation: "splash-up 0.65s 0.75s ease both" }}>
        Africa's Farm Investment Platform
      </p>

      {/* Loading bar — wider, glowing */}
      <div className="mt-10 relative z-10"
        style={{ animation: "splash-up 0.5s 1.1s ease both" }}>
        <div className="w-44 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="h-full rounded-full" style={{
            background: "linear-gradient(90deg, #15803d, #22c55e, #86efac)",
            animation: "splash-bar 3.2s 1.15s cubic-bezier(0.4,0,0.2,1) both",
            boxShadow: "0 0 10px rgba(34,197,94,0.7)",
          }} />
        </div>
        <p className="text-white/20 text-[9px] text-center mt-2 tracking-widest uppercase"
          style={{ animation: "splash-up 0.4s 1.5s ease both" }}>
          Loading…
        </p>
      </div>

      <style>{`
        @keyframes splash-pop {
          0%   { opacity: 0; transform: scale(0.55) rotate(-6deg); }
          70%  { transform: scale(1.06) rotate(1.5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes splash-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.95); }
          50%       { opacity: 0.55; transform: scale(1.18); }
        }
        @keyframes splash-bar {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes splash-orb {
          0%, 100% { opacity: 0.12; transform: translateY(0); }
          50%       { opacity: 0.45; transform: translateY(-14px); }
        }
        @keyframes splash-ring {
          0%   { opacity: 0.6; transform: scale(0.85); }
          100% { opacity: 0; transform: scale(2.2); }
        }
      `}</style>
    </div>
  );
}

function RateAppWatcher() {
  const { open, setOpen, maybeTrigger } = useRateAppTrigger();
  const [loc] = useLocation();

  // Fire on route changes – random, low-probability
  useEffect(() => {
    const sensitiveRoutes = ["/market", "/portfolio", "/farmer", "/activity"];
    if (sensitiveRoutes.some(r => loc.startsWith(r))) {
      maybeTrigger(loc.replace("/", "").replace(/\//g, "_") || "market");
    }
  }, [loc]);

  return <RateAppModal open={open} onClose={() => setOpen(false)} />;
}

// Routes that should bypass the splash screen (public/shareable pages)
const PUBLIC_BYPASS_PATHS = ["/market/preview"];

const SPLASH_KEY = "investa_pwa_splash_seen";

function App() {
  const isPublicBypass = PUBLIC_BYPASS_PATHS.some(p => window.location.pathname.endsWith(p));

  // Only play the splash when running as an installed PWA (standalone mode) and
  // the user hasn't seen it yet this install.  In a regular browser tab the app
  // opens instantly without the loading screen.
  const isPwa =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
  const shouldShowSplash = isPwa && !isPublicBypass && !localStorage.getItem(SPLASH_KEY);

  const [splashDone, setSplashDone] = useState(!shouldShowSplash);
  const handleSplashDone = useCallback(() => {
    try { localStorage.setItem(SPLASH_KEY, "1"); } catch {}
    setSplashDone(true);
  }, []);

  // When the user installs the app, clear the "seen" flag so the splash plays
  // on the very first PWA launch (appinstalled fires before they open it).
  useEffect(() => {
    const handler = () => { try { localStorage.removeItem(SPLASH_KEY); } catch {} };
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <CurrencyProvider>
          <TooltipProvider>
            <SecurityGuard />
            {!splashDone && <SplashScreen onDone={handleSplashDone} />}
            <WouterRouter base={BASE}>
              <Router />
              <RateAppWatcher />
            </WouterRouter>
            <Toaster />
            <SonnerToaster position="top-center" richColors={false} />
            <CenterSuccessHost />
            <PriceAlertWatcher />
            <PushScheduler />
            <PwaInstallBanner />
          </TooltipProvider>
        </CurrencyProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
