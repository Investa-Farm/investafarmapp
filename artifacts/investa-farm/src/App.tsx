import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { PriceAlertWatcher } from "@/components/price-alert-watcher";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getToken, getStoredUser } from "@/lib/auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { CurrencyProvider } from "@/lib/currency";

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

import CooperativeAuth from "@/pages/cooperative-auth";
import CooperativeDashboard from "@/pages/cooperative/dashboard";

import AgribusinessDashboard from "@/pages/agribusiness/dashboard";
import AgribusinessOrders from "@/pages/agribusiness/orders";
import AgribusinessNetwork from "@/pages/agribusiness/network";
import AgribusinessProfile from "@/pages/agribusiness/profile";
import FundManagerDashboard from "@/pages/market/fund-dashboard";

import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import FaqPage from "@/pages/faq";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <TooltipProvider>
          <WouterRouter base={BASE}>
            <Router />
          </WouterRouter>
          <Toaster />
          <SonnerToaster position="top-center" richColors={false} />
          <PriceAlertWatcher />
        </TooltipProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
}

export default App;
