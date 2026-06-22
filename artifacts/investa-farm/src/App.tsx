import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { PriceAlertWatcher } from "@/components/price-alert-watcher";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getToken, getStoredUser } from "@/lib/auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { CurrencyProvider } from "@/lib/currency";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

import Landing from "@/pages/landing";
import FarmerAuth from "@/pages/farmer-auth";
import InvestorAuth from "@/pages/investor-auth";
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

import CooperativeAuth from "@/pages/cooperative-auth";
import CooperativeDashboard from "@/pages/cooperative/dashboard";
import SalesAgentDashboard from "@/pages/sales-agent/dashboard";

import AgribusinessDashboard from "@/pages/agribusiness/dashboard";
import AgribusinessOrders from "@/pages/agribusiness/orders";
import AgribusinessNetwork from "@/pages/agribusiness/network";
import AgribusinessProfile from "@/pages/agribusiness/profile";
import FundManagerDashboard from "@/pages/market/fund-dashboard";
import WealthAuth from "@/pages/wealth-auth";
import WealthDashboard from "@/pages/wealth/dashboard";

import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import FaqPage from "@/pages/faq";
import NotificationsPage from "@/pages/notifications";
import NotFound from "@/pages/not-found";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

setAuthTokenGetter(() => getToken());

// Initialise dark mode from localStorage
if (localStorage.getItem("investa_theme") === "dark") {
  document.documentElement.classList.add("dark");
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
  if (!token) return <Redirect to="/" />;

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
    if (userRole === "agribusiness") return <Redirect to="/agribusiness" />;
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
    if (userRole === "agribusiness") return <Redirect to="/agribusiness" />;
    if (localStorage.getItem("investa_investor_type") === "fund_manager") return <Redirect to="/wealth" />;
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
      <Route path="/verify-otp">
        <VerifyOtp />
      </Route>
      <Route path="/forgot-password">
        <ForgotPassword />
      </Route>
      <Route path="/reset-password">
        <ResetPassword />
      </Route>

      {/* Investor routes */}
      <Route path="/market/fund">
        <AuthGuard role="investor"><FundManagerDashboard /></AuthGuard>
      </Route>
      <Route path="/market">
        <AuthGuard role="investor">
          {localStorage.getItem("investa_investor_type") === "fund_manager"
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
        <AuthGuard role="investor"><CommunityPortfolios /></AuthGuard>
      </Route>
      <Route path="/market/exchange/:id">
        <AuthGuard role="investor"><FarmExchange /></AuthGuard>
      </Route>
      <Route path="/market/:id">
        <AuthGuard role="investor"><FarmDetail /></AuthGuard>
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
      <Route path="/farmer/funding">
        <AuthGuard role="farmer"><LoanApply /></AuthGuard>
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
      <Route path="/farmer/totp">
        <AuthGuard role="farmer"><FarmerTotp /></AuthGuard>
      </Route>

      {/* Sales Agent routes */}
      <Route path="/sales-agent/dashboard">
        <AuthGuard role="agribusiness"><SalesAgentDashboard /></AuthGuard>
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
        <AuthGuard role="agribusiness"><AgribusinessDashboard /></AuthGuard>
      </Route>

      {/* FAQ — accessible from profile for any logged-in user */}
      <Route path="/faq">
        <FaqPage />
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
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e); };
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
              <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img src={logoSrc} alt="Investa Farm" className="h-9 w-9 object-contain" />
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
        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <img src={logoSrc} alt="Investa Farm" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">Install Investa Farm</p>
          <p className="text-white/60 text-[10px]">Add to home screen — fast access, no browser</p>
        </div>
        <button onClick={install}
          className="bg-[#16a34a] text-white text-xs font-bold px-4 py-2.5 rounded-xl flex-shrink-0 active:scale-95 transition-transform shadow-lg shadow-green-900/40">
          Install Now
        </button>
        <button onClick={dismiss} className="text-white/50 text-xl leading-none flex-shrink-0 w-7 flex items-center justify-center">×</button>
      </div>
    </div>
  );
}

function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(160deg, #052e16 0%, #14532d 45%, #16a34a 100%)" }}
    >
      <div style={{ animation: "splash-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) both" }}>
        <img
          src={logoSrc}
          alt="Investa Farm"
          className="h-24 w-auto select-none"
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </div>
      <p
        className="text-white/70 text-sm font-medium mt-5 tracking-widest uppercase"
        style={{ animation: "splash-fade 0.6s 0.4s ease both" }}
      >
        Investa Farm
      </p>
      <div
        className="mt-10 flex gap-1.5"
        style={{ animation: "splash-fade 0.6s 0.7s ease both" }}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-white/60"
            style={{ animation: `splash-dot 1.2s ${i * 0.2}s ease-in-out infinite` }}
          />
        ))}
      </div>
      <style>{`
        @keyframes splash-pop {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes splash-fade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <TooltipProvider>
          {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
          <WouterRouter base={BASE}>
            <Router />
          </WouterRouter>
          <Toaster />
          <SonnerToaster position="top-center" richColors={false} />
          <PriceAlertWatcher />
          <PwaInstallBanner />
        </TooltipProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
}

export default App;
