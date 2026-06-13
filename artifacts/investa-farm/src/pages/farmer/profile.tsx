import { useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { clearToken, getStoredUser, storeUser, getToken } from "@/lib/auth";
import { LogOut, ChevronRight, Shield, Bell, Settings, HelpCircle, FileText, TrendingUp, Users, Star, X, Eye, EyeOff, Save } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { NotificationsPanel } from "@/components/notifications-panel";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

export default function FarmerProfile() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const queryClient = useQueryClient();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => localStorage.getItem("investa_farmer_profile_photo"));
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const handleLogout = () => {
    clearToken();
    setLocation("/");
  };

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
        { icon: Shield, label: "KYC Status", sublabel: "Verify your identity", action: () => setLocation("/farmer/kyc") },
        { icon: Settings, label: "Account Settings", sublabel: "Name, password", action: openSettings },
      ]
    },
    {
      title: "Farm",
      items: [
        { icon: TrendingUp, label: "Funding History", sublabel: "View all funding applications", action: () => setLocation("/farmer/loans") },
        { icon: Users, label: "Farmer Group", sublabel: "Manage cooperative members", action: () => setLocation("/farmer/group") },
        { icon: FileText, label: "Documents", sublabel: "KYC files and certificates", action: () => setLocation("/farmer/kyc") },
        { icon: Star, label: "My Farms", sublabel: "Listed farms and performance", action: () => setLocation("/farmer/market") },
      ]
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: "Help & Support", sublabel: "FAQs, contact us", action: () => setLocation("/faq") },
      ]
    },
  ];

  const displayName = user?.name ?? storedUser?.name ?? "Farmer";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="app-shell pb-20 page-enter" data-testid="farmer-profile">
      <div className="hero-header pt-12 pb-6 px-5">
        <div className="flex flex-col items-center gap-3">
          <img src={logoSrc} alt="Investa Farm" className="h-10 w-auto opacity-90"
            style={{ filter: "brightness(0) invert(1)" }} />
          <div className="relative">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">{initial}</span>
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center cursor-pointer shadow-md">
              <span className="text-primary text-[10px] font-bold">✏</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>
          <div className="text-center">
            <h1 className="text-white text-lg font-bold">{displayName}</h1>
            <p className="text-white/70 text-sm">{user?.email ?? storedUser?.email ?? "—"}</p>
            <span className="mt-1.5 inline-block bg-white/20 text-white text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full border border-white/30">
              Farmer Account
            </span>
          </div>
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

      <BottomNav role="farmer" />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

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
