import { useState } from "react";
import { useGetMe, useGetPortfolioSummary } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { clearToken, formatKES, getToken, storeUser, getStoredUser } from "@/lib/auth";
import { LogOut, ChevronRight, Shield, HelpCircle, Settings, CheckCircle2, Clock, Briefcase, TrendingUp, Wallet, Star, Zap, X, Eye, EyeOff, Save, RefreshCw, ArrowUpRight, Smartphone, KeyRound, Lock, Copy, Check as CheckIcon, MonitorSmartphone } from "lucide-react";
import { getInstallPrompt, triggerInstall, isIosBrowser, isStandalone } from "@/lib/pwa";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InvestorKycModal } from "@/components/investor-kyc-modal";
import { NotificationStatusRow } from "@/components/notification-prompt";
import { InlineMicBot } from "@/components/ai-assistant";
import { AiMatchmaker } from "@/components/ai-matchmaker";
import { WalletModal } from "@/components/wallet-modal";
import { RateAppModal } from "@/components/rate-app-modal";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency, CURRENCIES } from "@/lib/currency";

const BROKER_THRESHOLD = 500_000;

export default function Profile() {
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const { data: summary } = useGetPortfolioSummary();
  const [kycOpen, setKycOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [matcherOpen, setMatcherOpen] = useState(false);
  const token = getToken();
  const stored = getStoredUser();
  const queryClient = useQueryClient();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => localStorage.getItem("investa_profile_photo"));

  const [pwaOpen, setPwaOpen] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [settingsName, setSettingsName] = useState(user?.name ?? stored?.name ?? "");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // MFA / TOTP state
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaPhase, setMfaPhase] = useState<"status" | "setup" | "disable">("status");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaQr, setMfaQr] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSuccess, setMfaSuccess] = useState("");
  const [mfaCopied, setMfaCopied] = useState(false);
  const [mfaShowManual, setMfaShowManual] = useState(false);

  const copySecret = () => {
    navigator.clipboard.writeText(mfaSecret).then(() => {
      setMfaCopied(true);
      setTimeout(() => setMfaCopied(false), 2000);
    });
  };

  const formatSecret = (s: string) => s.match(/.{1,4}/g)?.join(" ") ?? s;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setProfilePhoto(result);
      localStorage.setItem("investa_profile_photo", result);
    };
    reader.readAsDataURL(file);
  };

  const { data: kycStatus } = useQuery<{ isVerified: boolean; approved: number; total: number; allUploaded: boolean }>({
    queryKey: ["kyc-status"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/status", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const { data: totpStatus, refetch: refetchTotpStatus } = useQuery<{ totpEnabled: boolean }>({
    queryKey: ["totp-status"],
    queryFn: async () => {
      const r = await fetch("/api/auth/totp/status", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { totpEnabled: false };
      return r.json();
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const investorType = localStorage.getItem("investa_investor_type") ?? "individual";
  const portfolioValue = summary?.totalValue ?? 0;
  const isBroker = portfolioValue >= BROKER_THRESHOLD;

  const { currency, setCurrency, formatAmount } = useCurrency();

  const { data: stellarAcct } = useQuery<{ accountNumber: string } | null>({
    queryKey: ["stellar-account"],
    queryFn: async () => {
      const r = await fetch("/api/stellar/account", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 300_000,
    enabled: !!token && (user?.role === "investor" || (stored as any)?.role === "investor"),
  });

  const { data: walletData, refetch: refetchWallet, isLoading: walletLoading } = useQuery<{ wallet: { balance: string } }>({
    queryKey: ["wallet-balance-profile"],
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { wallet: { balance: "0" } };
      return r.json();
    },
  });
  const walletBalanceNum = parseFloat(walletData?.wallet?.balance ?? "0");

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleTheme = () => {
    const dark = !isDark;
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("investa_theme", dark ? "dark" : "light");
  };

  const handleLogout = () => { clearToken(); setLocation("/"); };

  const handleSaveSettings = async () => {
    setSettingsError("");
    if (newPw && newPw !== confirmPw) { setSettingsError("New passwords don't match"); return; }
    if (newPw && !currentPw) { setSettingsError("Enter your current password to change it"); return; }
    setSettingsSaving(true);
    try {
      const body: Record<string, string> = {};
      if (settingsName && settingsName !== (user?.name ?? stored?.name)) body.name = settingsName;
      if (currentPw && newPw) { body.currentPassword = currentPw; body.newPassword = newPw; }
      if (!Object.keys(body).length) { setSettingsOpen(false); setSettingsSaving(false); return; }
      const r = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); setSettingsError(d.error ?? "Failed to save"); setSettingsSaving(false); return; }
      const updated = await r.json();
      if (stored) storeUser({ ...stored, name: updated.name });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setSettingsSuccess(true);
      setTimeout(() => { setSettingsSuccess(false); setSettingsOpen(false); }, 1200);
    } catch { setSettingsError("Network error"); }
    setSettingsSaving(false);
  };

  const handleMfaSetup = async () => {
    setMfaError(""); setMfaLoading(true);
    try {
      const r = await fetch("/api/auth/totp/setup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Setup failed");
      setMfaQr(d.qrCode);
      setMfaSecret(d.secret);
      setMfaPhase("setup");
    } catch (err) {
      setMfaError((err as Error).message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaEnable = async () => {
    if (mfaCode.replace(/\s/g, "").length !== 6) { setMfaError("Enter the 6-digit code from your app"); return; }
    setMfaError(""); setMfaLoading(true);
    try {
      const r = await fetch("/api/auth/totp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: mfaCode.replace(/\s/g, "") }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Verification failed");
      setMfaSuccess("Two-factor authentication enabled!");
      setMfaPhase("status");
      setMfaCode("");
      setMfaQr("");
      setMfaSecret("");
      refetchTotpStatus();
      setTimeout(() => setMfaSuccess(""), 3000);
    } catch (err) {
      setMfaError((err as Error).message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaDisable = async () => {
    if (mfaCode.replace(/\s/g, "").length !== 6) { setMfaError("Enter your current authenticator code"); return; }
    setMfaError(""); setMfaLoading(true);
    try {
      const r = await fetch("/api/auth/totp/disable", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: mfaCode.replace(/\s/g, "") }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Disable failed");
      setMfaSuccess("Two-factor authentication disabled.");
      setMfaPhase("status");
      setMfaCode("");
      refetchTotpStatus();
      setTimeout(() => setMfaSuccess(""), 3000);
    } catch (err) {
      setMfaError((err as Error).message);
    } finally {
      setMfaLoading(false);
    }
  };

  const menuItems = [
    {
      icon: Shield, label: "KYC Verification",
      sublabel: kycStatus?.isVerified ? "Verified ✓" : `${kycStatus?.approved ?? 0} docs approved`,
      action: () => setKycOpen(true),
      badge: kycStatus?.isVerified ? "bg-green-100 text-green-700" : kycStatus?.allUploaded ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700",
      badgeLabel: kycStatus?.isVerified ? "Verified" : kycStatus?.allUploaded ? "Under Review" : "Pending",
    },
    { icon: Settings, label: "Account Settings", sublabel: "Name, password", action: () => { setSettingsName(user?.name ?? stored?.name ?? ""); setSettingsOpen(true); }, badge: null, badgeLabel: null },
    {
      icon: Smartphone, label: "Two-Factor Auth",
      sublabel: totpStatus?.totpEnabled ? "Authenticator app active" : "Add extra login security",
      action: () => { setMfaPhase("status"); setMfaError(""); setMfaCode(""); setMfaOpen(true); },
      badge: totpStatus?.totpEnabled ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground",
      badgeLabel: totpStatus?.totpEnabled ? "ON" : "OFF",
    },
    { icon: HelpCircle, label: "Help & FAQs", sublabel: "Answers & support", action: () => setLocation("/faq"), badge: null, badgeLabel: null },
    { icon: Star, label: "Rate Our Services", sublabel: "Share your experience with us", action: () => setRateOpen(true), badge: null, badgeLabel: null },
    { icon: MonitorSmartphone, label: "Add to Home Screen", sublabel: "Install app for instant access", action: () => setPwaOpen(true), badge: null, badgeLabel: null },
  ];

  return (
    <div className="app-shell pb-20 page-enter" data-testid="profile-page">
      {/* ── Grass-green hero header ── */}
      <div className="pt-12 pb-5 px-4"
        style={{ background: "linear-gradient(160deg, #052e16 0%, #14532d 35%, #16a34a 100%)" }}>

        {/* Logo row */}
        <div className="flex justify-center mb-4">
          <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto opacity-90"
            style={{ filter: "brightness(0) invert(1)" }} />
        </div>

        {/* Name / email / wallet — horizontal combined row */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center">
                <span className="text-white text-xl font-bold">{user?.name?.charAt(0) ?? "?"}</span>
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center cursor-pointer shadow-md">
              <span className="text-primary text-[8px] font-bold">✏</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>

          {/* Name + email + role badges */}
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-base leading-tight truncate">{user?.name ?? "—"}</h1>
            <p className="text-white/60 text-xs truncate">{user?.email ?? "—"}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-0.5 bg-white/20 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/20">
                {user?.role ?? "investor"}
              </span>
              <span className="inline-flex items-center gap-0.5 bg-white/15 text-white text-[9px] font-medium px-2 py-0.5 rounded-full border border-white/15">
                {investorType === "fund_manager" ? <><Briefcase size={8} /> Fund Mgr</> : <><TrendingUp size={8} /> Individual</>}
              </span>
              {isBroker && (
                <span className="inline-flex items-center gap-0.5 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-2 py-0.5 rounded-full">
                  <Star size={8} fill="currentColor" /> Broker
                </span>
              )}
            </div>
          </div>

          {/* Wallet balance + account number */}
          <div className="flex-shrink-0 text-right">
            <p className="text-white/60 text-[9px] uppercase tracking-wider">Wallet</p>
            {walletLoading
              ? <div className="h-5 w-20 bg-white/20 rounded animate-pulse" />
              : <p className="text-white font-bold text-sm">{formatAmount(walletBalanceNum)}</p>}
            <button onClick={() => refetchWallet()} className="mt-0.5 text-white/50 text-[9px] flex items-center gap-0.5 ml-auto">
              <RefreshCw size={8} /> Refresh
            </button>
            {stellarAcct?.accountNumber && (
              <p className="text-white/40 text-[8px] font-mono mt-1 tracking-wider">{stellarAcct.accountNumber}</p>
            )}
          </div>
        </div>

        {/* Portfolio stats row */}
        <div className="grid grid-cols-4 gap-1.5 mt-4 bg-white/10 rounded-2xl p-2.5">
          {[
            { label: "Portfolio", value: summary ? formatAmount(summary.totalValue) : "—", up: true },
            { label: "Invested", value: summary ? formatAmount(summary.totalInvested) : "—", up: null },
            { label: "P&L", value: summary ? formatAmount(summary.todayReturn) : "—", up: summary ? summary.todayReturn >= 0 : null },
            { label: "Holdings", value: summary ? String(summary.holdings) : "—", up: null },
          ].map(({ label, value, up }) => (
            <div key={label} className="text-center">
              <p className={`font-bold text-sm ${up === null ? "text-white" : up ? "text-green-300" : "text-red-300"}`}>{value}</p>
              <p className="text-white/50 text-[9px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick action buttons */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={() => setWalletOpen(true)}
            className="bg-white/20 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform border border-white/20">
            <Wallet size={12} /> View Wallet
          </button>
          <button onClick={() => setCurrencyOpen(true)}
            className="bg-white/15 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform border border-white/20">
            <span className="text-xs">{currency.flag}</span> {currency.code}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* KYC status banner — hidden when fully verified */}
        {!kycStatus?.isVerified && (
          <button onClick={() => setKycOpen(true)}
            className={`w-full rounded-2xl p-3.5 border flex items-center gap-3 text-left active:scale-98 transition-transform ${
              kycStatus?.allUploaded
                ? "bg-blue-50 border-blue-200"
                : "bg-orange-50 border-orange-200"
            }`}>
            {kycStatus?.allUploaded
              ? <Clock size={20} className="text-blue-600 flex-shrink-0" />
              : <Shield size={20} className="text-orange-600 flex-shrink-0" />}
            <div className="flex-1">
              <p className={`font-semibold text-sm ${kycStatus?.allUploaded ? "text-blue-700" : "text-orange-700"}`}>
                {kycStatus?.allUploaded ? "Documents Under Review" : "Upload KYC to Trade"}
              </p>
              <p className={`text-xs ${kycStatus?.allUploaded ? "text-blue-600" : "text-orange-600"}`}>
                {kycStatus?.allUploaded
                  ? "Our team is verifying your documents — usually within 24h"
                  : `${kycStatus?.approved ?? 0} of ${kycStatus?.total ?? 4} documents approved`}
              </p>
            </div>
            <ChevronRight size={15} className={kycStatus?.allUploaded ? "text-blue-400" : "text-orange-400"} />
          </button>
        )}

        {/* Broker badge card */}
        {isBroker ? (
          <button onClick={() => setLocation("/portfolio#broker")}
            className="w-full rounded-2xl p-3.5 border border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <Star size={20} className="text-yellow-600" fill="currentColor" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-yellow-800">Stock Broker Status</p>
              <p className="text-yellow-700 text-xs mt-0.5">Portfolio ≥ KES 500K · Bulk orders & priority listings unlocked</p>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-900">ACTIVE</span>
          </button>
        ) : (
          <button onClick={() => setLocation("/portfolio#broker")}
            className="w-full rounded-2xl p-3.5 border border-border bg-card flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <Zap size={20} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">Unlock Broker Status</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Invest {formatAmount(BROKER_THRESHOLD - portfolioValue)} more to reach KES 500K
              </p>
              <div className="mt-1.5 w-full bg-muted rounded-full h-1.5">
                <div className="bg-primary rounded-full h-1.5 transition-all"
                  style={{ width: `${Math.min((portfolioValue / BROKER_THRESHOLD) * 100, 100)}%` }} />
              </div>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {Math.round((portfolioValue / BROKER_THRESHOLD) * 100)}%
            </span>
          </button>
        )}

        {/* AI Smart Match card */}
        <button
          onClick={() => setMatcherOpen(true)}
          className="w-full rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #16a34a 100%)" }}
        >
          <div className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 flex-shrink-0">
                <span className="text-xl">✨</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm flex items-center gap-1.5">
                  AI Smart Match
                  <InlineMicBot section="portfolio" role={user?.role === "farmer" ? "farmer" : "investor"} />
                </p>
                <p className="text-green-200/70 text-[10px]">Tell us your goals · AI finds your best farms</p>
              </div>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 mb-3">
              <p className="text-green-100 text-xs leading-relaxed">
                Our AI analyses risk tolerance, capital, and crop seasons to recommend the perfect farm portfolio for you.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {["Low Risk", "High Yield", "Seasonal"].map(tag => (
                  <span key={tag} className="text-[9px] font-bold bg-white/15 text-green-100 px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
              <div className="bg-white text-primary text-[10px] font-extrabold px-3 py-1.5 rounded-full flex-shrink-0">
                Match Me →
              </div>
            </div>
          </div>
        </button>

        {/* Theme toggle */}
        <button onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-card border border-border rounded-2xl active:scale-98 transition-transform">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-base">{isDark ? "☀️" : "🌙"}</span>
          </div>
          <div className="flex-1 text-left">
            <span className="text-foreground text-sm font-medium">{isDark ? "Light Mode" : "Dark Mode"}</span>
            <p className="text-muted-foreground text-[10px] mt-0.5">Switch app theme</p>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${isDark ? "bg-primary" : "bg-muted"}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${isDark ? "left-[calc(100%-22px)]" : "left-0.5"}`} />
          </div>
        </button>

        {/* Menu items */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {menuItems.map(({ icon: Icon, label, sublabel, action, badge, badgeLabel }, i) => (
            <button key={label} data-testid={`menu-${label.toLowerCase().replace(/ /g, "-")}`}
              onClick={action}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted transition-colors ${i > 0 ? "border-t border-border" : ""}`}>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <span className="text-foreground text-sm font-medium">{label}</span>
                {sublabel && <p className="text-muted-foreground text-[10px] mt-0.5">{sublabel}</p>}
              </div>
              {badge && badgeLabel && (
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badge}`}>{badgeLabel}</span>
              )}
              <ChevronRight size={15} className="text-muted-foreground" />
            </button>
          ))}
        </div>

        <button data-testid="button-logout" onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-4 bg-red-50 border border-red-100 rounded-2xl text-left active:scale-95 transition-transform">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <LogOut size={16} className="text-red-500" />
          </div>
          <span className="flex-1 text-red-500 text-sm font-semibold">Sign Out</span>
          <ChevronRight size={15} className="text-red-300" />
        </button>

        <p className="text-center text-muted-foreground text-[10px] pb-2">
          Investa Farm v2.0 · Africa's leading financially inclusive platform
        </p>
      </div>

      {/* Account security tips */}
      <div className="mx-4 mb-4 bg-card border border-border rounded-2xl p-4">
        <p className="text-foreground text-xs font-bold mb-2 flex items-center gap-1.5">🔒 Account Security</p>
        <ul className="space-y-1.5">
          <li className="text-muted-foreground text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>Use a strong, unique password — at least 8 characters with numbers and symbols.</li>
          <li className="text-muted-foreground text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>Keep your email verified — it's how we send dividend notices and security alerts.</li>
          <li className="text-muted-foreground text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>Complete KYC to unlock full withdrawal and trading limits.</li>
          <li className="text-muted-foreground text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>Never share your password or OTP codes with anyone, including support staff.</li>
        </ul>
      </div>

      <BottomNav role="investor" />
      <InvestorKycModal open={kycOpen} onClose={() => setKycOpen(false)} onVerified={() => setKycOpen(false)} />

      {/* Account Settings Sheet */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setSettingsOpen(false)} />
            <motion.div className="relative w-full max-w-[430px] bg-background rounded-t-3xl pb-10"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <p className="font-bold text-base text-foreground">Account Settings</p>
                <button onClick={() => setSettingsOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Display Name</label>
                  <input value={settingsName} onChange={e => setSettingsName(e.target.value)}
                    className="mt-1.5 w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
                  <input value={user?.email ?? stored?.email ?? ""} readOnly
                    className="mt-1.5 w-full border border-border rounded-xl px-4 py-3 text-sm bg-muted text-muted-foreground cursor-not-allowed" />
                </div>
                <div className="pt-1 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Change Password (optional)</p>
                  <div className="space-y-2.5">
                    <div className="relative">
                      <input type={showPw ? "text" : "password"} placeholder="Current password"
                        value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                        className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:border-primary pr-10" />
                      <button type="button" onClick={() => setShowPw(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <input type={showPw ? "text" : "password"} placeholder="New password (min 6 chars)"
                      value={newPw} onChange={e => setNewPw(e.target.value)}
                      className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:border-primary" />
                    <input type={showPw ? "text" : "password"} placeholder="Confirm new password"
                      value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                      className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:border-primary" />
                  </div>
                </div>
                {settingsError && <p className="text-red-500 text-xs font-medium">{settingsError}</p>}
                {settingsSuccess && <p className="text-green-600 text-xs font-medium">✓ Changes saved!</p>}
                <button onClick={handleSaveSettings} disabled={settingsSaving}
                  className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
                  <Save size={15} />
                  {settingsSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RateAppModal open={rateOpen} onClose={() => setRateOpen(false)} />
      {/* Wallet popup modal */}
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />

      {/* Currency picker popup */}
      <AnimatePresence>
        {currencyOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCurrencyOpen(false)} />
            <motion.div
              className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl px-5 pt-4 pb-10"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-base">Display Currency</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">Currently showing in {currency.name}</p>
                </div>
                <button onClick={() => setCurrencyOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={15} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CURRENCIES.map(c => (
                  <button key={c.code} onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all active:scale-95 ${
                      currency.code === c.code
                        ? "bg-primary border-primary text-white shadow-md shadow-primary/20"
                        : "border-border bg-card text-foreground"
                    }`}>
                    <span className="text-2xl">{c.flag}</span>
                    <div className="text-left">
                      <p className={`font-bold text-sm ${currency.code === c.code ? "text-white" : "text-foreground"}`}>{c.code}</p>
                      <p className={`text-[10px] ${currency.code === c.code ? "text-white/70" : "text-muted-foreground"}`}>{c.name}</p>
                    </div>
                    {currency.code === c.code && (
                      <span className="ml-auto text-white text-xs font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AiMatchmaker open={matcherOpen} onClose={() => setMatcherOpen(false)} />

      {/* ── MFA / TOTP Bottom Sheet ── */}
      <AnimatePresence>
        {mfaOpen && (
          <motion.div className="fixed inset-0 z-[60] flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMfaOpen(false)} />
            <motion.div className="relative w-full max-w-[430px] bg-background rounded-t-3xl pb-10 shadow-2xl overflow-hidden"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Smartphone size={15} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Two-Factor Authentication</p>
                    <p className="text-muted-foreground text-[10px]">Authenticator app (TOTP)</p>
                  </div>
                </div>
                <button onClick={() => setMfaOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={15} className="text-muted-foreground" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
                {mfaSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-green-700 text-sm font-medium">
                    <CheckCircle2 size={16} /> {mfaSuccess}
                  </div>
                )}
                {mfaError && (
                  <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">
                    {mfaError}
                  </div>
                )}

                {/* Phase: status */}
                {mfaPhase === "status" && (
                  <div className="space-y-4">
                    <div className={`rounded-2xl border p-4 flex items-center gap-3 ${totpStatus?.totpEnabled ? "bg-green-50 border-green-200" : "bg-muted border-border"}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totpStatus?.totpEnabled ? "bg-green-100" : "bg-background border border-border"}`}>
                        {totpStatus?.totpEnabled ? <Lock size={18} className="text-green-600" /> : <KeyRound size={18} className="text-muted-foreground" />}
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold text-sm ${totpStatus?.totpEnabled ? "text-green-700" : "text-foreground"}`}>
                          {totpStatus?.totpEnabled ? "2FA is Enabled" : "2FA is Disabled"}
                        </p>
                        <p className={`text-xs mt-0.5 ${totpStatus?.totpEnabled ? "text-green-600/80" : "text-muted-foreground"}`}>
                          {totpStatus?.totpEnabled ? "Your account is protected with an authenticator app." : "Add an extra layer of security to your account."}
                        </p>
                      </div>
                    </div>

                    {!totpStatus?.totpEnabled ? (
                      <>
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 space-y-1.5">
                          <p className="text-xs font-semibold text-foreground">How it works</p>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            <li>• Install Google Authenticator, Authy, or similar</li>
                            <li>• Scan the QR code we provide</li>
                            <li>• Enter the 6-digit code at each sign-in</li>
                          </ul>
                        </div>
                        <button onClick={handleMfaSetup} disabled={mfaLoading}
                          className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
                          {mfaLoading ? <RefreshCw size={15} className="animate-spin" /> : <Smartphone size={15} />}
                          {mfaLoading ? "Generating…" : "Set Up Authenticator"}
                        </button>
                      </>
                    ) : (
                      <button onClick={() => { setMfaPhase("disable"); setMfaCode(""); setMfaError(""); }}
                        className="w-full border border-destructive/40 text-destructive font-semibold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-sm hover:bg-destructive/5">
                        <Lock size={14} /> Disable Two-Factor Auth
                      </button>
                    )}
                  </div>
                )}

                {/* Phase: setup — show QR code + verify */}
                {mfaPhase === "setup" && (
                  <div className="space-y-4">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Smartphone size={13} className="text-primary" /> Step 1 — Add to authenticator app
                      </p>
                      <p className="text-muted-foreground text-[11px]">Open <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app. Tap the <strong>+</strong> button and choose <em>Scan QR code</em> or <em>Enter setup key</em>.</p>
                    </div>

                    {mfaQr && (
                      <div className="flex justify-center">
                        <div className="bg-white p-3 rounded-2xl border-2 border-primary/20 shadow-sm inline-block">
                          <img src={mfaQr} alt="TOTP QR Code" className="w-48 h-48" />
                        </div>
                      </div>
                    )}

                    {mfaSecret && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setMfaShowManual(s => !s)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-muted rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-wide">Can't scan? Enter key manually</span>
                          <span className="text-xs">{mfaShowManual ? "▲" : "▼"}</span>
                        </button>
                        {mfaShowManual && (
                          <div className="mt-2 bg-muted rounded-xl px-4 py-3 space-y-2">
                            <p className="text-muted-foreground text-[10px]">In your authenticator app choose <strong>Enter a setup key</strong>, then type this code exactly:</p>
                            <div className="flex items-center gap-2">
                              <p className="flex-1 text-foreground font-mono text-base tracking-widest break-all select-all font-bold">
                                {formatSecret(mfaSecret)}
                              </p>
                              <button type="button" onClick={copySecret}
                                className="flex-shrink-0 w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-primary/5 transition-colors">
                                {mfaCopied ? <CheckIcon size={14} className="text-green-600" /> : <Copy size={14} className="text-muted-foreground" />}
                              </button>
                            </div>
                            {mfaCopied && <p className="text-green-600 text-[10px] font-medium">Copied to clipboard!</p>}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <KeyRound size={13} className="text-primary" /> Step 2 — Enter the 6-digit code
                      </p>
                      <p className="text-muted-foreground text-[11px]">After adding the account, your app will show a 6-digit rotating code. Enter it below to confirm setup.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">6-digit verification code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={7}
                        placeholder="000 000"
                        value={mfaCode}
                        onChange={e => setMfaCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                        className="w-full text-center text-foreground font-bold text-xl tracking-[0.5em] border border-border rounded-xl py-3 bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => { setMfaPhase("status"); setMfaQr(""); setMfaSecret(""); setMfaCode(""); setMfaError(""); setMfaShowManual(false); }}
                        className="flex-1 border border-border rounded-2xl py-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleMfaEnable} disabled={mfaLoading || mfaCode.length !== 6}
                        className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
                        {mfaLoading ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                        {mfaLoading ? "Verifying…" : "Activate 2FA"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Phase: disable */}
                {mfaPhase === "disable" && (
                  <div className="space-y-4">
                    <div className="bg-destructive/8 border border-destructive/20 rounded-xl p-3.5">
                      <p className="text-destructive text-sm font-semibold mb-1">Disable Two-Factor Auth?</p>
                      <p className="text-destructive/80 text-xs">This will remove the extra layer of protection from your account. Enter your current authenticator code to confirm.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Authenticator code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={mfaCode}
                        onChange={e => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="w-full text-center text-foreground font-bold text-xl tracking-[0.5em] border border-border rounded-xl py-3 bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => { setMfaPhase("status"); setMfaCode(""); setMfaError(""); }}
                        className="flex-1 border border-border rounded-2xl py-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleMfaDisable} disabled={mfaLoading || mfaCode.length !== 6}
                        className="flex-1 bg-destructive text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
                        {mfaLoading ? <RefreshCw size={14} className="animate-spin" /> : null}
                        {mfaLoading ? "Disabling…" : "Disable 2FA"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Sheet */}
      <AnimatePresence>
        {pwaOpen && (
          <motion.div className="fixed inset-0 z-[60] flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPwaOpen(false)} />
            <motion.div className="relative w-full max-w-[430px] bg-card rounded-t-3xl pb-10"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MonitorSmartphone size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-base text-foreground">Add to Home Screen</p>
                    <p className="text-muted-foreground text-[11px]">Install Investa Farm on your device</p>
                  </div>
                </div>
                <button onClick={() => setPwaOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-4">
                {isStandalone() ? (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                      <CheckIcon size={22} className="text-green-600" />
                    </div>
                    <p className="text-green-800 font-bold text-sm">Already Installed!</p>
                    <p className="text-green-600 text-xs">Investa Farm is running as a home screen app.</p>
                  </div>
                ) : isIosBrowser() ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center">Follow these steps in Safari:</p>
                    {[
                      { icon: "⎋", label: "Tap the Share button", sub: "At the bottom of Safari browser", bg: "bg-blue-50 border-blue-200", text: "text-blue-800" },
                      { icon: "＋", label: 'Select "Add to Home Screen"', sub: "Scroll down in the share sheet", bg: "bg-primary/5 border-primary/20", text: "text-primary" },
                      { icon: "✓", label: "Tap Add", sub: "App appears on your home screen instantly", bg: "bg-green-50 border-green-200", text: "text-green-800" },
                    ].map(({ icon, label, sub, bg, text }) => (
                      <div key={label} className={`flex items-center gap-3 p-3 rounded-2xl border ${bg}`}>
                        <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0 text-xl font-bold">{icon}</div>
                        <div>
                          <p className={`text-sm font-semibold ${text}`}>{label}</p>
                          <p className="text-muted-foreground text-xs">{sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : getInstallPrompt() ? (
                  <div className="space-y-4">
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center space-y-2">
                      <div className="text-3xl">📱</div>
                      <p className="text-foreground font-bold text-sm">Install Investa Farm</p>
                      <p className="text-muted-foreground text-xs">Add to your home screen for instant access — works offline too!</p>
                    </div>
                    {pwaInstalled ? (
                      <div className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
                        <CheckIcon size={18} /> Installed!
                      </div>
                    ) : (
                      <button onClick={async () => {
                        const outcome = await triggerInstall();
                        if (outcome === "accepted") { setPwaInstalled(true); setTimeout(() => setPwaOpen(false), 1500); }
                      }} className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                        <MonitorSmartphone size={18} /> Install Now — It's Free
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center">To install, open in Chrome and tap the menu:</p>
                    {[
                      { icon: "⋮", label: "Tap the 3-dot menu", sub: "Top right of Chrome browser" },
                      { icon: "＋", label: 'Select "Add to Home Screen"', sub: 'Or "Install App" if shown' },
                    ].map(({ icon, label, sub }) => (
                      <div key={label} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border">
                        <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center flex-shrink-0 text-xl font-bold text-foreground">{icon}</div>
                        <div>
                          <p className="text-foreground text-sm font-semibold">{label}</p>
                          <p className="text-muted-foreground text-xs">{sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-center text-muted-foreground text-[10px]">Free · No app store required · Works on iPhone &amp; Android</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
