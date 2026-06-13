import { useState } from "react";
import { useGetMe, useGetPortfolioSummary } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { clearToken, formatKES, getToken, storeUser, getStoredUser } from "@/lib/auth";
import { LogOut, ChevronRight, Shield, HelpCircle, Settings, CheckCircle2, Clock, Briefcase, TrendingUp, Wallet, Star, Zap, X, Eye, EyeOff, Save } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InvestorKycModal } from "@/components/investor-kyc-modal";
import { NotificationStatusRow } from "@/components/notification-prompt";
import { AiAssistant } from "@/components/ai-assistant";
import { motion, AnimatePresence } from "framer-motion";

const BROKER_THRESHOLD = 500_000;

export default function Profile() {
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const { data: summary } = useGetPortfolioSummary();
  const [kycOpen, setKycOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const handleLogout = () => {
    clearToken();
    setLocation("/");
  };

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

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    const dark = !isDark;
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("investa_theme", dark ? "dark" : "light");
  };

  const menuItems = [
    {
      icon: Shield,
      label: "KYC Verification",
      sublabel: kycStatus?.isVerified ? "Verified ✓" : `${kycStatus?.approved ?? 0} docs approved`,
      action: () => setKycOpen(true),
      badge: kycStatus?.isVerified ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700",
      badgeLabel: kycStatus?.isVerified ? "Verified" : "Pending",
    },
    { icon: Wallet, label: "My Wallet", sublabel: "Balance & transactions", action: () => setLocation("/wallet"), badge: null, badgeLabel: null },
    { icon: Settings, label: "Account Settings", sublabel: "Name, password", action: () => { setSettingsName(user?.name ?? stored?.name ?? ""); setSettingsOpen(true); }, badge: null, badgeLabel: null },
    { icon: HelpCircle, label: "Help & FAQs", sublabel: "Answers & support", action: () => setLocation("/faq"), badge: null, badgeLabel: null },
  ];

  return (
    <div className="app-shell pb-20 page-enter" data-testid="profile-page">
      <div className="hero-header pt-12 pb-6 px-5">
        <div className="flex flex-col items-center gap-3">
          <img src={logoSrc} alt="Investa Farm" className="h-14 w-auto opacity-90" style={{ filter: "brightness(0) invert(1)" }} />
          <div className="relative">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">{user?.name?.charAt(0) ?? "?"}</span>
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center cursor-pointer shadow-md">
              <span className="text-primary text-[10px] font-bold">✏</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>
          <div className="text-center">
            <h1 className="text-white text-lg font-bold">{user?.name ?? "—"}</h1>
            <p className="text-white/70 text-sm">{user?.email ?? "—"}</p>
            <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full border border-white/30">
                {user?.role ?? "investor"} account
              </span>
              <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] font-semibold px-2 py-1 rounded-full border border-white/30">
                {investorType === "fund_manager" ? <><Briefcase size={9} /> Fund Manager</> : <><TrendingUp size={9} /> Individual</>}
              </span>
              {isBroker && (
                <span className="inline-flex items-center gap-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-3 py-1 rounded-full border border-yellow-300 shadow-sm">
                  <Star size={9} fill="currentColor" /> Broker
                </span>
              )}
            </div>
          </div>
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
                Invest {formatKES(BROKER_THRESHOLD - portfolioValue)} more to reach KES 500K
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

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-card border border-border rounded-2xl p-3.5 text-center">
            <p className="text-primary font-bold text-lg">{summary ? formatKES(summary.totalValue) : "—"}</p>
            <p className="text-muted-foreground text-xs mt-0.5">Portfolio Value</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3.5 text-center">
            <p className="text-primary font-bold text-xl">{summary ? summary.holdings : "—"}</p>
            <p className="text-muted-foreground text-xs mt-0.5">Active Holdings</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-card border border-border rounded-2xl p-3.5 text-center">
            <p className="text-primary font-bold text-lg">{summary ? formatKES(summary.totalInvested) : "—"}</p>
            <p className="text-muted-foreground text-xs mt-0.5">Total Invested</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3.5 text-center">
            <p className={`font-bold text-lg ${summary && summary.todayReturn >= 0 ? "text-green-600" : "text-red-500"}`}>
              {summary ? formatKES(summary.todayReturn) : "—"}
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">Today's P&L</p>
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-card border border-border rounded-2xl active:scale-98 transition-transform"
        >
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

      <BottomNav role="investor" />
      <InvestorKycModal open={kycOpen} onClose={() => setKycOpen(false)} onVerified={() => setKycOpen(false)} />
      <AiAssistant />

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
    </div>
  );
}
