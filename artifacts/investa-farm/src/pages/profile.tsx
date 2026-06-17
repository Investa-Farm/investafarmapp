import { useState } from "react";
import { useGetMe, useGetPortfolioSummary } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { clearToken, formatKES, getToken, storeUser, getStoredUser } from "@/lib/auth";
import { LogOut, ChevronRight, Shield, HelpCircle, Settings, CheckCircle2, Clock, Briefcase, TrendingUp, Wallet, Star, Zap, X, Eye, EyeOff, Save, RefreshCw, ArrowUpRight } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InvestorKycModal } from "@/components/investor-kyc-modal";
import { NotificationStatusRow } from "@/components/notification-prompt";
import { InlineMicBot } from "@/components/ai-assistant";
import { AiMatchmaker } from "@/components/ai-matchmaker";
import { WalletModal } from "@/components/wallet-modal";
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
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [matcherOpen, setMatcherOpen] = useState(false);
  const token = getToken();
  const stored = getStoredUser();
  const queryClient = useQueryClient();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => localStorage.getItem("investa_profile_photo"));

  const [settingsName, setSettingsName] = useState(user?.name ?? stored?.name ?? "");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

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

  const { data: kycStatus } = useQuery<{ isVerified: boolean; approved: number; total: number }>({
    queryKey: ["kyc-status"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/status", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
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

  const menuItems = [
    {
      icon: Shield, label: "KYC Verification",
      sublabel: kycStatus?.isVerified ? "Verified ✓" : `${kycStatus?.approved ?? 0} docs approved`,
      action: () => setKycOpen(true),
      badge: kycStatus?.isVerified ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700",
      badgeLabel: kycStatus?.isVerified ? "Verified" : "Pending",
    },
    { icon: Settings, label: "Account Settings", sublabel: "Name, password", action: () => { setSettingsName(user?.name ?? stored?.name ?? ""); setSettingsOpen(true); }, badge: null, badgeLabel: null },
    { icon: HelpCircle, label: "Help & FAQs", sublabel: "Answers & support", action: () => setLocation("/faq"), badge: null, badgeLabel: null },
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
        {/* KYC status banner */}
        <button onClick={() => setKycOpen(true)}
          className={`w-full rounded-2xl p-3.5 border flex items-center gap-3 text-left active:scale-98 transition-transform ${kycStatus?.isVerified ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
          {kycStatus?.isVerified
            ? <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
            : <Clock size={20} className="text-orange-600 flex-shrink-0" />}
          <div className="flex-1">
            <p className={`font-semibold text-sm ${kycStatus?.isVerified ? "text-green-700" : "text-orange-700"}`}>
              {kycStatus?.isVerified ? "Identity Verified" : "Complete KYC to Trade"}
            </p>
            <p className={`text-xs ${kycStatus?.isVerified ? "text-green-600" : "text-orange-600"}`}>
              {kycStatus?.isVerified
                ? "You can buy and trade shares freely"
                : `${kycStatus?.approved ?? 0} documents approved — ${2 - (kycStatus?.approved ?? 0)} more needed`}
            </p>
          </div>
          <ChevronRight size={15} className={kycStatus?.isVerified ? "text-green-400" : "text-orange-400"} />
        </button>

        {/* Broker badge card */}
        {isBroker ? (
          <div className="rounded-2xl p-3.5 border border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <Star size={20} className="text-yellow-600" fill="currentColor" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-yellow-800">Stock Broker Status</p>
              <p className="text-yellow-700 text-xs mt-0.5">Portfolio ≥ KES 500K · Bulk orders & priority listings unlocked</p>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-900">ACTIVE</span>
          </div>
        ) : (
          <div className="rounded-2xl p-3.5 border border-border bg-card flex items-center gap-3">
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
          </div>
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
          <NotificationStatusRow className="border-t border-border" />
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
      <div className="mx-4 mb-4 bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-slate-700 text-xs font-bold mb-2 flex items-center gap-1.5">🔒 Account Security</p>
        <ul className="space-y-1.5">
          <li className="text-slate-600 text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>Use a strong, unique password — at least 8 characters with numbers and symbols.</li>
          <li className="text-slate-600 text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>Keep your email verified — it's how we send dividend notices and security alerts.</li>
          <li className="text-slate-600 text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>Complete KYC to unlock full withdrawal and trading limits.</li>
          <li className="text-slate-600 text-xs flex items-start gap-1.5"><span className="mt-0.5 flex-shrink-0">•</span>Never share your password or OTP codes with anyone, including support staff.</li>
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
            <motion.div className="relative w-full max-w-[430px] bg-white rounded-t-3xl pb-10"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <p className="font-bold text-base">Account Settings</p>
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
    </div>
  );
}
