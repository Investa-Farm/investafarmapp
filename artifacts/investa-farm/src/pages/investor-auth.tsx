import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, TrendingUp, User, Phone, CheckSquare, ShieldCheck, Smartphone } from "lucide-react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { setToken, storeUser } from "@/lib/auth";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import investorBg from "@assets/pexels-aedrian-10653885_1778315943103.jpg";
import { InvestorTypeModal, type InvestorType } from "@/components/investor-type-modal";
import { TermsModal } from "@/components/terms-modal";

type AuthStep = "auth" | "welcome" | "investor-type";

const WELCOME_STEPS = [
  { icon: "📈", title: "Welcome, Investor!", body: "Investa Farm gives you direct access to high-yield African farm investments with returns of 10–28% per season." },
  { icon: "🌾", title: "Browse Real Farms", body: "View live farm listings with crop data, location, health scores, and projected yields before you invest." },
  { icon: "💎", title: "Buy Farm Shares", body: "Invest in fractional farm shares starting from KES 5,000. Diversify across multiple farms and regions." },
  { icon: "💰", title: "Earn & Exit", body: "Choose Mid-Season exit (+10%) in 30-60 days, or hold to Full Season for up to +28% returns at harvest." },
];

const PHONE_CODES = [
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+250", flag: "🇷🇼", name: "Rwanda" },
  { code: "+251", flag: "🇪🇹", name: "Ethiopia" },
  { code: "+27",  flag: "🇿🇦", name: "South Africa" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+44",  flag: "🇬🇧", name: "UK" },
  { code: "+1",   flag: "🇺🇸", name: "USA" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
];

export default function InvestorAuth() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("+254");
  const [investAmount, setInvestAmount] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState<"terms" | "privacy" | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<AuthStep>("auth");
  const [welcomeIdx, setWelcomeIdx] = useState(0);

  const [totpStep, setTotpStep] = useState(false);
  const [totpCode, setTotpCode] = useState(["", "", "", "", "", ""]);
  const [tempToken, setTempToken] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const totpInputs = useRef<(HTMLInputElement | null)[]>([]);

  const login = useLogin();
  const register = useRegister();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    login.mutate({ data: { email, password } }, {
      onSuccess: (data: any) => {
        if (data.totpRequired) {
          setTempToken(data.tempToken ?? "");
          setTotpStep(true);
          return;
        }
        if (!data.user) { setError("Login failed. Please try again."); return; }
        if (data.user.role !== "investor") { setError("This account is not an investor account."); return; }
        setToken(data.token); storeUser(data.user);
        setLocation("/market");
      },
      onError: (err: any) => {
        if (err?.data?.requiresOtp) {
          setToken(err.data.token); storeUser(err.data.user);
          setLocation(`/verify-otp?email=${encodeURIComponent(err.data.email ?? email)}`);
          return;
        }
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, tempToken }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Invalid code");
      if (d.user?.role !== "investor") { setError("This account is not an investor account."); return; }
      setToken(d.token); storeUser(d.user);
      if (trustDevice) {
        const tr = await fetch("/api/auth/totp/trust-device", { method: "POST", headers: { Authorization: `Bearer ${d.token}` } }).catch(() => null);
        if (tr?.ok) {
          const td = await tr.json();
          if (td.deviceToken) localStorage.setItem(`investa_device_trust_${email.toLowerCase().trim()}`, JSON.stringify({ deviceToken: td.deviceToken, until: td.until }));
        }
      }
      setLocation("/market");
    } catch (err) { setError((err as Error).message); }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!agreed) { setError("Please accept the Terms & Privacy Policy to continue."); return; }
    const name = fullName || email.split("@")[0]!.replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const fullPhone = phone.trim() ? `${phoneCode}${phone.trim().replace(/^0/, "")}` : undefined;
    register.mutate({ data: { email, password, name, role: "investor", ...(fullPhone ? { phone: fullPhone } : {}) } as any }, {
      onSuccess: (data: any) => {
        setToken(data.token); storeUser(data.user);
        if (data.requiresOtp) {
          setLocation(`/verify-otp?email=${encodeURIComponent(email)}`);
        } else {
          setStep("welcome");
        }
      },
      onError: () => setError("Registration failed. Email may already be in use."),
    });
  };

  const handleTypeSelected = (_type: InvestorType) => {
    localStorage.setItem("investa_investor_type", _type);
    setLocation("/market");
  };

  if (step === "welcome") {
    const ws = WELCOME_STEPS[welcomeIdx];
    return (
      <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col items-center justify-center p-8"
        style={{ background: "linear-gradient(160deg, #14532d 0%, #16a34a 50%, #22c55e 100%)" }}>
        <div className="text-center space-y-4 max-w-xs">
          <div className="text-6xl mb-2">{ws!.icon}</div>
          <h2 className="text-white text-2xl font-bold">{ws!.title}</h2>
          <p className="text-white/70 text-sm leading-relaxed">{ws!.body}</p>
          <div className="flex gap-1.5 justify-center mt-4">
            {WELCOME_STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === welcomeIdx ? "w-6 bg-white" : "w-1.5 bg-white/30"}`} />
            ))}
          </div>
          <button onClick={() => {
            if (welcomeIdx < WELCOME_STEPS.length - 1) setWelcomeIdx(n => n + 1);
            else setStep("investor-type");
          }} className="w-full bg-white text-green-700 font-bold py-3.5 rounded-xl mt-4 active:scale-95 transition-transform">
            {welcomeIdx < WELCOME_STEPS.length - 1 ? "Next →" : "Choose Investor Type"}
          </button>
          {welcomeIdx < WELCOME_STEPS.length - 1 && (
            <button onClick={() => setStep("investor-type")} className="text-white/50 text-xs underline">Skip intro</button>
          )}
        </div>
      </div>
    );
  }

  if (totpStep) {
    return (
      <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Smartphone size={30} className="text-primary" />
            </div>
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
                  onKeyDown={e => handleTotpKeyDown(i, e)}
                  onPaste={handleTotpPaste}
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
          <p className="text-center text-muted-foreground/60 text-xs">Open Google Authenticator or Authy to find your Investa Farm code.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col" data-testid="investor-auth">
        <div className="relative pt-14 pb-8 px-6 flex flex-col items-center gap-4 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #14532d 0%, #16a34a 60%, #22c55e 100%)" }}>
          <img src={investorBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
          <div className="relative z-10 w-full">
            <button onClick={() => setLocation("/")}
              className="self-start w-9 h-9 rounded-full bg-white/15 flex items-center justify-center mb-4">
              <ArrowLeft size={18} className="text-white" />
            </button>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center gap-1">
                  <img src={logoSrc} alt="Investa Farm" className="h-10 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
                </div>
              </div>
              <div className="text-center">
                <h1 className="text-white text-2xl font-bold">Investor Portal</h1>
                <p className="text-white/60 text-sm mt-1">Grow your wealth with African farms</p>
              </div>
              <div className="flex gap-3">
                {[["🌾","10–28%\nReturns"],["📊","Live\nMarket"],["🏆","Verified\nFarms"]].map(([e,l]) => (
                  <div key={l} className="bg-white/10 rounded-xl px-3 py-1.5 border border-white/20 text-center">
                    <p className="text-lg">{e}</p>
                    <p className="text-white/70 text-[9px] whitespace-pre">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-t-3xl px-6 pt-6 pb-10 overflow-y-auto">
          <div className="flex items-center justify-center gap-2 mb-5">
            <img src={logoSrc} alt="Investa Farm" className="h-6 w-auto" />
          </div>

          <div className="flex bg-green-50 rounded-2xl p-1 mb-6">
            {(["login", "register"] as const).map(t => (
              <button key={t} data-testid={`tab-${t}`} onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${t === tab ? "bg-white text-green-700 shadow-sm" : "text-green-500/70"}`}>
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, x: tab === "login" ? -12 : 12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-4">

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>
              )}

              {tab === "login" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <IField label="Email address" id="email" type="email" value={email} set={setEmail} placeholder="investor@example.com" icon={<Mail size={15} />} />
                  <IPwField label="Password" value={password} set={setPassword} show={showPw} toggle={() => setShowPw(s => !s)} />
                  <a href="/forgot-password" className="w-full text-right text-xs text-primary font-medium -mt-2 pr-1 block">Forgot password?</a>
                  <SubmitBtn loading={login.isPending} label="Sign In" />
                  <button type="button" onClick={() => { setEmail("demo.investor@investafarm.com"); setPassword("password123"); }}
                    className="w-full py-2.5 border border-green-200 rounded-xl text-green-700 text-xs font-semibold bg-green-50 active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                    📈 Try Demo Investor Account
                  </button>
                  <p className="text-center text-muted-foreground text-xs">New here? <button type="button" onClick={() => setTab("register")} className="text-primary font-semibold">Create account</button></p>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <IField label="Full Name" id="name" type="text" value={fullName} set={setFullName} placeholder="e.g. David Mwangi" icon={<User size={15} />} />
                  <IField label="Email address" id="email" type="email" value={email} set={setEmail} placeholder="investor@example.com" icon={<Mail size={15} />} />
                  {/* Phone with country code */}
                  <div className="space-y-1.5">
                    <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">Phone Number</label>
                    <div className="flex gap-2">
                      <select
                        value={phoneCode}
                        onChange={e => setPhoneCode(e.target.value)}
                        className="border border-border rounded-xl px-2 py-3 text-sm bg-gray-50 focus:outline-none focus:border-primary appearance-none w-[88px] flex-shrink-0 text-center font-medium"
                      >
                        {PHONE_CODES.map(c => (
                          <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                        ))}
                      </select>
                      <div className="relative flex-1">
                        <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder={phoneCode === "+254" ? "7XX XXX XXX" : "Phone number"}
                          className="w-full border border-border rounded-xl pl-10 pr-4 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-primary focus:bg-white transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">Investment Range (KES)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["5K–50K","50K–500K","500K+"].map(r => (
                        <button key={r} type="button" onClick={() => setInvestAmount(r)}
                          className={`py-2 rounded-xl border text-xs font-medium transition-all ${investAmount === r ? "border-primary bg-green-50 text-primary" : "border-border text-muted-foreground"}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <IPwField label="Password" value={password} set={setPassword} show={showPw} toggle={() => setShowPw(s => !s)} />
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex gap-2">
                    <TrendingUp size={14} className="text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-green-700 text-xs leading-relaxed">
                      Browse farms, buy shares, and earn <strong>10–28% returns</strong> per season on Investa Farm.
                    </p>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <button type="button" onClick={() => setAgreed(a => !a)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${agreed ? "bg-primary border-primary" : "border-border"}`}>
                      {agreed && <CheckSquare size={12} className="text-white" />}
                    </button>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      I agree to the{" "}
                      <button type="button" onClick={() => setTermsOpen("terms")} className="text-primary font-medium underline">Terms of Service</button>
                      {" "}and{" "}
                      <button type="button" onClick={() => setTermsOpen("privacy")} className="text-primary font-medium underline">Privacy Policy</button>
                    </span>
                  </label>
                  <SubmitBtn loading={register.isPending} label="Create Investor Account" />
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <InvestorTypeModal open={step === "investor-type"} onSelect={handleTypeSelected} />
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(null)} />
    </>
  );
}

function IField({ label, id, type, value, set, placeholder, icon }: {
  label: string; id: string; type: string; value: string;
  set: (v: string) => void; placeholder: string; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
        <input data-testid={`input-${id}`} type={type} value={value} onChange={e => set(e.target.value)}
          placeholder={placeholder} required={type !== "tel"}
          className={`w-full border border-border rounded-xl py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-primary focus:bg-white transition-colors ${icon ? "pl-10 pr-4" : "px-4"}`} />
      </div>
    </div>
  );
}

function IPwField({ label, value, set, show, toggle }: { label: string; value: string; set: (v: string) => void; show: boolean; toggle: () => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">{label}</label>
      <div className="relative">
        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input data-testid="input-password" type={show ? "text" : "password"} value={value} onChange={e => set(e.target.value)}
          placeholder="Min. 6 characters" required minLength={6}
          className="w-full border border-border rounded-xl pl-10 pr-12 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-primary focus:bg-white transition-colors" />
        <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-green-200 mt-2">
      {loading && <Loader2 size={16} className="animate-spin" />}
      {loading ? "Please wait..." : label}
    </button>
  );
}
