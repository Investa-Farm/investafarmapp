import { useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Eye, EyeOff, Loader2, Leaf, Lock, Mail,
  User, Phone, MapPin, CheckSquare, CheckCircle2, ShieldCheck, Smartphone, Linkedin,
} from "lucide-react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { setToken, storeUser } from "@/lib/auth";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import farmerBg from "@assets/pexels-christian-hembert-1081250355-35553039_1778315943103.jpg";
import { TermsModal } from "@/components/terms-modal";

const COUNTIES = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Malindi","Kitale","Machakos","Nyeri","Meru","Kakamega","Kisii","Kericho","Embu"];

const COUNTRY_CODES = [
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+250", flag: "🇷🇼", name: "Rwanda" },
  { code: "+251", flag: "🇪🇹", name: "Ethiopia" },
  { code: "+27",  flag: "🇿🇦", name: "South Africa" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "+263", flag: "🇿🇼", name: "Zimbabwe" },
  { code: "+260", flag: "🇿🇲", name: "Zambia" },
  { code: "+265", flag: "🇲🇼", name: "Malawi" },
  { code: "+258", flag: "🇲🇿", name: "Mozambique" },
  { code: "+249", flag: "🇸🇩", name: "Sudan" },
  { code: "+252", flag: "🇸🇴", name: "Somalia" },
  { code: "+257", flag: "🇧🇮", name: "Burundi" },
  { code: "+253", flag: "🇩🇯", name: "Djibouti" },
  { code: "+44",  flag: "🇬🇧", name: "UK" },
  { code: "+1",   flag: "🇺🇸", name: "USA" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+49",  flag: "🇩🇪", name: "Germany" },
  { code: "+33",  flag: "🇫🇷", name: "France" },
  { code: "+31",  flag: "🇳🇱", name: "Netherlands" },
];

const CROPS = [
  { emoji: "🌽", name: "Maize" },
  { emoji: "🍅", name: "Tomatoes" },
  { emoji: "🥑", name: "Avocado" },
  { emoji: "🍵", name: "Tea" },
  { emoji: "☕", name: "Coffee" },
  { emoji: "🌿", name: "Other" },
];

// Floating particle
function Particle({ x, y, size, dur }: { x: string; y: string; size: number; dur: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-white/10 pointer-events-none"
      style={{ left: x, top: y, width: size, height: size }}
      animate={{ y: [0, -16, 0], opacity: [0.12, 0.35, 0.12] }}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// Google SVG logo
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function FarmerAuth() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const justRegistered = new URLSearchParams(search).get("registered") === "1";
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+254");
  const [county, setCounty] = useState("");
  const [cropType, setCropType] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState<"terms" | "privacy" | null>(null);
  const [error, setError] = useState("");
  const [welcomeStep, setWelcomeStep] = useState<number | null>(null);
  const [socialMsg, setSocialMsg] = useState("");

  const [totpStep, setTotpStep] = useState(false);
  const [totpCode, setTotpCode] = useState(["", "", "", "", "", ""]);
  const [tempToken, setTempToken] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const totpInputs = useRef<(HTMLInputElement | null)[]>([]);

  const login = useLogin();
  const register = useRegister();

  function handleGoogleAuth() {
    window.location.href = "/api/auth/google?role=farmer";
  }

  function handleLinkedInAuth() {
    window.location.href = "/api/auth/linkedin?role=farmer";
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    login.mutate({ data: { email, password } }, {
      onSuccess: (data: any) => {
        if (data.totpRequired) { setTempToken(data.tempToken ?? ""); setTotpStep(true); return; }
        if (!data.user) { setError("Login failed. Please try again."); return; }
        if (data.user.role !== "farmer") { setError("This account is not a farmer account."); return; }
        setToken(data.token); storeUser(data.user); setLocation("/farmer");
      },
      onError: (err: any) => {
        if (err?.data?.requiresOtp) {
          setToken(err.data.token); storeUser(err.data.user);
          setLocation(`/verify-otp?email=${encodeURIComponent(err.data.email ?? email)}`); return;
        }
        const msg = err?.data?.error ?? "";
        if (msg === "conflict:google") { setError("This email was signed up with Google. Please use the Google button to sign in."); return; }
        if (msg === "conflict:linkedin") { setError("This email was signed up with LinkedIn. Please use the LinkedIn button to sign in."); return; }
        setError("Invalid email or password.");
      },
    });
  };

  const handleTotpChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...totpCode]; next[i] = digit; setTotpCode(next);
    if (digit && i < 5) totpInputs.current[i + 1]?.focus();
  };
  const handleTotpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !totpCode[i] && i > 0) totpInputs.current[i - 1]?.focus();
  };
  const handleTotpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...totpCode];
    text.split("").forEach((d, i) => { next[i] = d; });
    setTotpCode(next);
    totpInputs.current[Math.min(text.length, 5)]?.focus();
  };
  const handleTotpSubmit = async () => {
    const code = totpCode.join("");
    if (code.length !== 6) { setError("Enter the 6-digit code from your authenticator app"); return; }
    setError("");
    try {
      const r = await fetch("/api/auth/totp/verify-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, tempToken }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Invalid code");
      if (d.user?.role !== "farmer") { setError("This account is not a farmer account."); return; }
      setToken(d.token); storeUser(d.user);
      if (trustDevice) {
        const tr = await fetch("/api/auth/totp/trust-device", { method: "POST", headers: { Authorization: `Bearer ${d.token}` } }).catch(() => null);
        if (tr?.ok) {
          const td = await tr.json();
          if (td.deviceToken) localStorage.setItem(`investa_device_trust_${email.toLowerCase().trim()}`, JSON.stringify({ deviceToken: td.deviceToken, until: td.until }));
        }
      }
      setLocation("/farmer");
    } catch (err) { setError((err as Error).message); }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!agreed) { setError("Please accept the Terms & Privacy Policy to continue."); return; }
    const name = fullName || email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    register.mutate({ data: { email, password, name, role: "farmer" } }, {
      onSuccess: (data: any) => {
        setToken(data.token); storeUser(data.user);
        setLocation(`/verify-otp?email=${encodeURIComponent(email)}`);
      },
      onError: (err: any) => {
        const msg = err?.data?.error ?? "";
        if (msg === "conflict:google") { setError("This email was signed up with Google. Please use the Google button to sign in."); return; }
        if (msg === "conflict:linkedin") { setError("This email was signed up with LinkedIn. Please use the LinkedIn button to sign in."); return; }
        setError("Registration failed. Email may already be in use.");
      },
    });
  };

  const WELCOME_STEPS = [
    { icon: "🌾", title: "Welcome, Farmer!", body: "Investa Farm connects you to capital, buyers, and technology to grow your farm business." },
    { icon: "📋", title: "Complete Your KYC", body: "Verify your identity with a national ID and farm ownership proof to unlock full platform access and apply for funding." },
    { icon: "💰", title: "Raise Capital", body: "Once verified, apply for funding and get listed on the exchange — investors across Kenya will back your farm!" },
  ];

  /* ── Welcome Carousel ─────────────────────────── */
  if (welcomeStep !== null && welcomeStep < WELCOME_STEPS.length) {
    const ws = WELCOME_STEPS[welcomeStep]!;
    return (
      <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col items-center justify-center p-8"
        style={{ background: "linear-gradient(160deg, #052e16 0%, #14532d 40%, #16a34a 100%)" }}>
        <AnimatePresence mode="wait">
          <motion.div key={welcomeStep} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.28 }}
            className="text-center space-y-4 max-w-xs">
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}
              className="text-7xl mb-2">{ws.icon}</motion.div>
            <h2 className="text-white text-2xl font-bold">{ws.title}</h2>
            <p className="text-white/70 text-sm leading-relaxed">{ws.body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-1.5 justify-center mt-8">
          {WELCOME_STEPS.map((_, i) => (
            <motion.div key={i} animate={{ width: i === welcomeStep ? 24 : 6 }}
              className={`h-1.5 rounded-full ${i === welcomeStep ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => { if (welcomeStep < WELCOME_STEPS.length - 1) setWelcomeStep(w => (w ?? 0) + 1); else setLocation("/farmer"); }}
          className="w-full max-w-xs bg-white text-green-700 font-bold py-3.5 rounded-2xl mt-6 shadow-lg">
          {welcomeStep < WELCOME_STEPS.length - 1 ? "Next →" : "Go to Dashboard"}
        </motion.button>
        {welcomeStep < WELCOME_STEPS.length - 1 && (
          <button onClick={() => setLocation("/farmer")} className="text-white/50 text-xs underline mt-3">Skip intro</button>
        )}
      </div>
    );
  }

  /* ── 2FA ─────────────────────────────────────── */
  if (totpStep) {
    return (
      <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-6">
          <div className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}
              className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Smartphone size={30} className="text-primary" />
            </motion.div>
            <h2 className="text-foreground font-bold text-2xl">Two-Factor Auth</h2>
            <p className="text-muted-foreground text-sm mt-1">Enter the 6-digit code from your authenticator app</p>
          </div>
          <div className="bg-card rounded-3xl border border-border p-6 space-y-5 shadow-sm">
            {error && <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive text-center">{error}</div>}
            <div className="flex gap-2 justify-center">
              {totpCode.map((digit, i) => (
                <input key={i} ref={el => { totpInputs.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handleTotpChange(i, e.target.value)}
                  onKeyDown={e => handleTotpKeyDown(i, e)} onPaste={handleTotpPaste}
                  className="w-11 h-14 text-center text-foreground font-bold text-xl bg-muted border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
              ))}
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={trustDevice} onChange={e => setTrustDevice(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer" />
              <span className="text-muted-foreground text-xs">Remember this device for <span className="text-foreground font-medium">30 days</span></span>
            </label>
            <button onClick={handleTotpSubmit} disabled={totpCode.join("").length !== 6}
              className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              <ShieldCheck size={18} /> Verify & Sign In
            </button>
          </div>
          <button onClick={() => { setTotpStep(false); setTotpCode(["","","","","",""]); setError(""); }}
            className="w-full text-muted-foreground text-sm flex items-center justify-center gap-1.5">
            <ArrowLeft size={14} /> Back to sign in
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── Main Auth UI ─────────────────────────────── */
  return (
    <>
      <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col" data-testid="farmer-auth">

        {/* ── Hero Header ── */}
        <div className="relative pt-14 pb-10 px-6 flex flex-col items-center gap-4 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #021a0a 0%, #052e16 40%, #14532d 75%, #16a34a 100%)" }}>
          <img src={farmerBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity" />
          {/* Decorative orbs */}
          <div className="absolute -top-8 -right-8 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(34,197,94,0.22) 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 -left-4 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(22,163,74,0.2) 0%, transparent 70%)" }} />
          {/* Floating particles */}
          <Particle x="10%" y="25%" size={5} dur={3.0} />
          <Particle x="78%" y="18%" size={4} dur={2.6} />
          <Particle x="55%" y="60%" size={6} dur={3.5} />
          <Particle x="30%" y="70%" size={3} dur={2.2} />

          <div className="relative z-10 w-full">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setLocation("/")}
              className="self-start w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-5">
              <ArrowLeft size={18} className="text-white" />
            </motion.button>

            <div className="flex flex-col items-center gap-4">
              <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="relative">
                <motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.25, 0.1, 0.25] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -inset-3 rounded-3xl"
                  style={{ background: "rgba(34,197,94,0.28)" }} />
                <div className="w-20 h-20 rounded-2xl border border-white/25 flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
                  <img src={logoSrc} alt="Investa Farm" className="h-13 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="text-center">
                <h1 className="text-white text-2xl font-bold tracking-tight">Farmer Portal</h1>
                <p className="text-white/60 text-sm mt-1">Grow your farm with investor capital</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="flex gap-2.5">
                {[["💰","Loans"],["📊","Analytics"],["🌱","Market"]].map(([e,l]) => (
                  <div key={l} className="rounded-xl px-3 py-2 border border-white/20 text-center"
                    style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}>
                    <p className="text-base">{e}</p>
                    <p className="text-white/70 text-[9px] font-medium">{l}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>

        {/* ── Form Card ── */}
        <div className="flex-1 bg-white rounded-t-3xl -mt-4 px-5 pt-6 pb-12 overflow-y-auto shadow-[0_-8px_40px_rgba(0,0,0,0.12)]">

          {/* Social notice */}
          <AnimatePresence>
            {socialMsg && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-700 text-xs text-center mb-4">
                {socialMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success banner */}
          <AnimatePresence>
            {justRegistered && tab === "login" && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-start gap-3 mb-4">
                <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-700 font-bold text-sm">Registration Successful! 🎉</p>
                  <p className="text-green-600/70 text-xs mt-0.5">Email verified. Sign in to access your farmer dashboard.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab switcher */}
          <div className="flex bg-green-50 rounded-2xl p-1 mb-5 border border-green-100">
            {(["login", "register"] as const).map(t => (
              <motion.button key={t} data-testid={`tab-${t}`} onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${t === tab ? "bg-white text-green-700 shadow-sm" : "text-green-500/70"}`}
                whileTap={{ scale: 0.97 }}>
                {t === "login" ? "Sign In" : "Create Account"}
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, x: tab === "login" ? -14 : 14 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  data-testid="error-message" className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                  {error}
                </motion.div>
              )}

              {/* ── Social Auth Buttons ── */}
              <div className="grid grid-cols-2 gap-2.5">
                <motion.button type="button" whileTap={{ scale: 0.97 }}
                  onClick={handleGoogleAuth}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-semibold text-sm active:scale-95 transition-all hover:border-gray-300 hover:bg-gray-50 shadow-sm">
                  <GoogleLogo />
                  Google
                </motion.button>
                <motion.button type="button" whileTap={{ scale: 0.97 }}
                  onClick={handleLinkedInAuth}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-white font-semibold text-sm active:scale-95 transition-all shadow-sm"
                  style={{ background: "linear-gradient(135deg, #0077b5, #0a66c2)", borderColor: "#0077b5" }}>
                  <Linkedin size={18} />
                  LinkedIn
                </motion.button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">or continue with email</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {tab === "login" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <Field label="Email address" id="email" type="email" value={email} set={setEmail} placeholder="you@example.com" icon={<Mail size={15} />} />
                  <PwField label="Password" value={password} set={setPassword} show={showPw} toggle={() => setShowPw(s => !s)} />
                  <a href="/forgot-password" className="w-full text-right text-xs text-green-600 font-medium -mt-2 pr-1 block">Forgot password?</a>
                  <SubmitBtn loading={login.isPending} label="Sign In" />
                  <motion.button type="button" whileTap={{ scale: 0.97 }}
                    onClick={() => { setEmail("demo.farmer@investafarm.com"); setPassword("password123"); }}
                    className="w-full py-3 border-2 border-green-200 rounded-xl text-green-700 text-xs font-semibold bg-green-50 active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                    🌾 Try Demo Farmer Account
                  </motion.button>
                  <p className="text-center text-gray-400 text-xs pt-1">
                    New here?{" "}
                    <button type="button" onClick={() => setTab("register")} className="text-green-600 font-semibold">Create account</button>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <Field label="Full Name" id="name" type="text" value={fullName} set={setFullName} placeholder="e.g. John Kamau" icon={<User size={15} />} required />
                  <Field label="Email address" id="email" type="email" value={email} set={setEmail} placeholder="farmer@example.com" icon={<Mail size={15} />} />
                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"><Phone size={11} /> Phone Number</label>
                    <div className="flex gap-2">
                      <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
                        className="border-2 border-gray-200 rounded-xl px-2 py-3 text-sm bg-gray-50 focus:outline-none focus:border-green-500 appearance-none w-[88px] flex-shrink-0 text-center font-semibold">
                        {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                      </select>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder={countryCode === "+254" ? "7xx xxx xxx" : "Phone number"} required
                        className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-3 text-gray-900 bg-gray-50 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition-colors" />
                    </div>
                  </div>
                  {/* County */}
                  <div className="space-y-1.5">
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">County / Region</label>
                    <div className="relative">
                      <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select value={county} onChange={e => setCounty(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 bg-gray-50 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition-colors appearance-none">
                        <option value="">Select your county…</option>
                        {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Crop type */}
                  <div className="space-y-1.5">
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Main Crop Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CROPS.map(c => (
                        <motion.button key={c.name} type="button" whileTap={{ scale: 0.93 }} onClick={() => setCropType(c.name)}
                          className={`py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all flex flex-col items-center gap-0.5 ${cropType === c.name ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-400"}`}>
                          <span className="text-base">{c.emoji}</span>
                          <span>{c.name}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                  <PwField label="Password" value={password} set={setPassword} show={showPw} toggle={() => setShowPw(s => !s)} />
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-3.5 flex gap-3">
                    <Leaf size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-green-700 text-xs leading-relaxed">
                      After registering, <strong>complete KYC</strong> to unlock funding applications and get listed on the investor market.
                    </p>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => setAgreed(a => !a)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${agreed ? "bg-green-600 border-green-600" : "border-gray-300"}`}>
                      {agreed && <CheckSquare size={12} className="text-white" />}
                    </motion.button>
                    <span className="text-xs text-gray-400 leading-relaxed">
                      I agree to the{" "}
                      <button type="button" onClick={() => setTermsOpen("terms")} className="text-green-600 font-medium underline">Terms of Service</button>
                      {" "}and{" "}
                      <button type="button" onClick={() => setTermsOpen("privacy")} className="text-green-600 font-medium underline">Privacy Policy</button>
                    </span>
                  </label>
                  <SubmitBtn loading={register.isPending} label="Create Farmer Account" />
                  <p className="text-center text-gray-400 text-xs pt-1">
                    Already have an account?{" "}
                    <button type="button" onClick={() => setTab("login")} className="text-green-600 font-semibold">Sign in</button>
                  </p>
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <TermsModal open={termsOpen} onClose={() => setTermsOpen(null)} />
    </>
  );
}

function Field({ label, id, type, value, set, placeholder, icon, required }: {
  label: string; id: string; type: string; value: string;
  set: (v: string) => void; placeholder: string; icon?: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
        <input data-testid={`input-${id}`} type={type} value={value} onChange={e => set(e.target.value)}
          placeholder={placeholder} required={required !== false}
          className={`w-full border-2 border-gray-200 rounded-xl py-3 text-gray-900 bg-gray-50 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition-colors ${icon ? "pl-10 pr-4" : "px-4"}`} />
      </div>
    </div>
  );
}

function PwField({ label, value, set, show, toggle }: { label: string; value: string; set: (v: string) => void; show: boolean; toggle: () => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</label>
      <div className="relative">
        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input data-testid="input-password" type={show ? "text" : "password"} value={value} onChange={e => set(e.target.value)}
          placeholder="Min. 6 characters" required minLength={6}
          className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-12 py-3 text-gray-900 bg-gray-50 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition-colors" />
        <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
      className="w-full text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-200/60 mt-1 disabled:opacity-60"
      style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 40%, #16a34a 80%, #22c55e 100%)" }}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {loading ? "Please wait…" : label}
    </motion.button>
  );
}
