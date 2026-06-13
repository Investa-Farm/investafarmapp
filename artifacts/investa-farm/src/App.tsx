import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getToken, getStoredUser } from "@/lib/auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import Landing from "@/pages/landing";
import FarmerAuth from "@/pages/farmer-auth";
import InvestorAuth from "@/pages/investor-auth";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Onboarding from "@/pages/onboarding";
import VerifyOtp from "@/pages/verify-otp";

import MarketHome from "@/pages/market/index";
import PrimaryMarket from "@/pages/market/primary";
import SecondaryMarket from "@/pages/market/secondary";
import FarmMap from "@/pages/market/farm-map";
import FarmDetail from "@/pages/market/farm-detail";
import Portfolio from "@/pages/portfolio";
import Activity from "@/pages/activity";
import Profile from "@/pages/profile";
import InvestorWallet from "@/pages/wallet";

import FarmerDashboard from "@/pages/farmer/dashboard";
import FarmerOperations from "@/pages/farmer/operations";
import FarmerMarket from "@/pages/farmer/market";
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

function AuthGuard({ children, role }: { children: React.ReactNode; role?: AppRole }) {
  const token = getToken();
  const user = getStoredUser();
  if (!token) return <Redirect to="/" />;

  // Block access until email is verified — always redirect back to OTP page
  const emailVerified = (user as any)?.emailVerified;
  if (emailVerified === false) {
    const email = encodeURIComponent((user as any)?.email ?? "");
    return <Redirect to={`/verify-otp?email=${email}`} />;
  }

  const userRole = (user as any)?.role as string | undefined;
  if (role && userRole !== role) {
    if (userRole === "farmer") return <Redirect to="/farmer" />;
    if (userRole === "cooperative") return <Redirect to="/cooperative/dashboard" />;
    if (userRole === "agribusiness") return <Redirect to="/agribusiness" />;
    return <Redirect to="/market" />;
  }
  return <>{children}</>;
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

      {/* Investor routes */}
      <Route path="/market">
        <AuthGuard role="investor"><MarketHome /></AuthGuard>
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
        <AuthGuard role="agribusiness"><AgribusinessDashboard /></AuthGuard>
      </Route>
      <Route path="/agribusiness/profile">
        <AuthGuard role="agribusiness"><AgribusinessDashboard /></AuthGuard>
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
      <TooltipProvider>
        <WouterRouter base={BASE}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
