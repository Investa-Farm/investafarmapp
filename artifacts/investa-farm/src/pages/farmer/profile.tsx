import { useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { clearToken, getStoredUser, storeUser, getToken, formatKES } from "@/lib/auth";
import { LogOut, ChevronRight, Shield, Bell, Settings, HelpCircle, FileText, TrendingUp, Users, Star, X, Eye, EyeOff, Save, Wallet, RefreshCw, ShieldCheck, Sun, Moon, Leaf, BarChart2, Smartphone, Check } from "lucide-react";
import { getInstallPrompt, triggerInstall, isIosBrowser, isStandalone } from "@/lib/pwa";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { NotificationsPanel } from "@/components/notifications-panel";
import { WalletModal } from "@/components/wallet-modal";
import { RateAppModal } from "@/components/rate-app-modal";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient, useQuery } from "@tanstack/react-query";

export default function FarmerProfile() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const queryClient = useQueryClient();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => localStorage.getItem("investa_farmer_profile_photo"));
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("investa_theme", next ? "dark" : "light");
  };

  const [pwaOpen, setPwaOpen] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [settingsName, setSettingsName] = useState("");
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
      localStorage.setItem("investa_farmer_profile_photo", result);
    };
    reader.readAsDataURL(file);
  };

  const { data: user } = useGetMe();
  const storedUser = getStoredUser();

  const { data: walletData, refetch: refetchWallet, isLoading: walletLoading } = useQuery<{ wallet: { balance: string } }>({
    queryKey: ["wallet-balance-farmer-profile"],
    queryFn: async () => {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { wallet: { balance: "0" } };
      return r.json();
    },
  });
  const walletBalance = parseFloat(walletData?.wallet?.balance ?? "0");

  const handleLogout = () => { clearToken(); setLocation("/"); };

  const openSettings = () => {
    setSettingsName(user?.name ?? storedUser?.name ?? "");
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setSettingsError(""); setSettingsSuccess(false);
    setSettingsOpen(true);
  };

  const handleSaveSettings = async () => {
    setSettingsError("");
    if (newPw && newPw !== confirmPw) { setSettingsError("New passwords don't match"); return; }
    if (newPw && !currentPw) { setSettingsError("Enter your current password to change it"); return; }
    setSettingsSaving(true);
    try {
      const body: Record<string, string> = {};
      const currentName = user?.name ?? storedUser?.name;
      if (settingsName && settingsName !== currentName) body.name = settingsName;
      if (currentPw && newPw) { body.currentPassword = currentPw; body.newPassword = newPw; }
      if (!Object.keys(body).length) { setSettingsOpen(false); setSettingsSaving(false); return; }
      const r = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); setSettingsError(d.error ?? "Failed to save"); setSettingsSaving(false); return; }
      const updated = await r.json();
      if (storedUser) storeUser({ ...storedUser, name: updated.name });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setSettingsSuccess(true);
      setTimeout(() => { setSettingsSuccess(false); setSettingsOpen(false); }, 1200);
    } catch { setSettingsError("Network error"); }
    setSettingsSaving(false);
  };

  const menuSections = [
    {
      title: "Account",
      items: [
        { icon: Bell, label: "Notifications", sublabel: "Loan updates, market alerts", action: () => setNotifOpen(true) },
        { icon: ShieldCheck, label: "Security & 2FA", sublabel: "Two-factor authentication (TOTP)", action: () => setLocation("/farmer/totp") },
        { icon: Settings, label: "Account Settings", sublabel: "Name, password", action: openSettings },
        { icon: isDark ? Sun : Moon, label: isDark ? "Switch to Light Mode" : "Switch to Dark Mode", sublabel: "Toggle app appearance", action: toggleDark },
        { icon: Smartphone, label: "Add to Home Screen", sublabel: "Install app for instant access", action: () => setPwaOpen(true) },
      ]
    },
    {
      title: "Farm",
      items: [
        { icon: Leaf, label: "View Crop Details", sublabel: "Active farm & growth stage", action: () => setLocation("/farmer/farm-profile") },
        { icon: TrendingUp, label: "Funding History", sublabel: "View all funding applications", action: () => setLocation("/farmer/loans") },
        { icon: Users, label: "Farmer Group", sublabel: "Manage cooperative members", action: () => setLocation("/farmer/group") },
        { icon: BarChart2, label: "My Farms", sublabel: "Listed farms and performance", action: () => setLocation("/farmer/market") },
      ]
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: "Help & Support", sublabel: "FAQs, contact us", action: () => setLocation("/faq") },
        { icon: Star, label: "Rate Our Services", sublabel: "Share your experience", action: () => setRateOpen(true) },
      ]
    },
  ];

  const displayName = user?.name ?? storedUser?.name ?? "Farmer";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="app-shell pb-20 page-enter" data-testid="farmer-profile">
      {/* ── Grass-green hero header ── */}
      <div className="pt-12 pb-5 px-4"
        style={{ background: "linear-gradient(160deg, #052e16 0%, #14532d 35%, #16a34a 100%)" }}>

        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto opacity-90"
            style={{ filter: "brightness(0) invert(1)" }} />
        </div>

        {/* Combined row: photo + name/email + balance */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center">
                <span className="text-white text-xl font-bold">{initial}</span>
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center cursor-pointer shadow-md">
              <span className="text-primary text-[8px] font-bold">✏</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>

          {/* Name + email + role */}
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-base leading-tight truncate">{displayName}</h1>
            <p className="text-white/60 text-xs truncate">{user?.email ?? storedUser?.email ?? "—"}</p>
            <span className="mt-1 inline-block bg-white/20 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/20">
              Farmer Account
            </span>
          </div>

          {/* Balance */}
          <div className="flex-shrink-0 text-right">
            <p className="text-white/60 text-[9px] uppercase tracking-wider">Earnings</p>
            {walletLoading
              ? <div className="h-5 w-20 bg-white/20 rounded animate-pulse" />
              : <p className="text-white font-bold text-sm">{formatKES(walletBalance)}</p>}
            <button onClick={() => refetchWallet()} className="mt-0.5 text-white/50 text-[9px] flex items-center gap-0.5 ml-auto">
              <RefreshCw size={8} /> Refresh
            </button>
          </div>
        </div>

        {/* Two CTA buttons */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button onClick={() => setLocation("/farmer/farm-profile")}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/15 text-white text-xs font-bold border border-white/20 active:scale-95 transition-transform">
            <Leaf size={13} /> View Crop Details
          </button>
          <button onClick={() => setWalletOpen(true)}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/15 text-white text-xs font-bold border border-white/20 active:scale-95 transition-transform">
            <Wallet size={13} /> Manage Wallet
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {menuSections.map(section => (
          <div key={section.title}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{section.title}</p>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              {section.items.map(({ icon: Icon, label, sublabel, action }, i) => (
                <button key={label} onClick={action}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted transition-colors ${i > 0 ? "border-t border-border" : ""}`}>
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium">{label}</p>
                    <p className="text-muted-foreground text-[11px]">{sublabel}</p>
                  </div>
                  <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <button data-testid="button-logout" onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-4 bg-red-50 border border-red-100 rounded-2xl text-left active:scale-95 transition-transform">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <LogOut size={16} className="text-red-500" />
          </div>
          <span className="flex-1 text-red-500 text-sm font-semibold">Sign Out</span>
          <ChevronRight size={15} className="text-red-300" />
        </button>

        <p className="text-center text-muted-foreground text-[10px] pb-2">
          Investa Farm · Africa's leading farm investment platform
        </p>
      </div>

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
      <RateAppModal open={rateOpen} onClose={() => setRateOpen(false)} />
      <BottomNav role="farmer" />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

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
                    <Smartphone size={18} className="text-primary" />
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
                      <Check size={22} className="text-green-600" />
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
                      { icon: "✓", label: "Tap Add", sub: "The app appears on your home screen", bg: "bg-green-50 border-green-200", text: "text-green-800" },
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
                        <Check size={18} /> Installed!
                      </div>
                    ) : (
                      <button onClick={async () => {
                        const outcome = await triggerInstall();
                        if (outcome === "accepted") { setPwaInstalled(true); setTimeout(() => setPwaOpen(false), 1500); }
                      }} className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                        <Smartphone size={18} /> Install Now — It's Free
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
                <p className="text-center text-muted-foreground text-[10px]">Free · No app store required · Works on iPhone & Android</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <input value={user?.email ?? storedUser?.email ?? ""} readOnly
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
