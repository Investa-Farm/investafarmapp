import { useState, useRef } from "react";
import { Captcha } from "@/components/captcha";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, User, Phone,
  CheckSquare, ShieldCheck, Smartphone, TrendingUp, Briefcase, PieChart,
} from "lucide-react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { setToken, storeUser } from "@/lib/auth";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import wealthBg from "@assets/IMG_8016_1781250402404.jpeg";
import { TermsModal } from "@/components/terms-modal";

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

const WELCOME_STEPS = [
  { icon: "💼", title: "Welcome, Wealth Manager!", body: "Manage diversified agricultural fund portfolios across multiple clients with professional-grade tools." },
  { icon: "📊", title: "Track Fund Performance", body: "Monitor AUM, returns, and allocations across all your client funds in real-time with analytics." },
  { icon: "🌾", title: "Build Farm Portfolios", body: "Select from verified farm listings and allocate investments across crops, regions, and risk profiles." },
  { icon: "👥", title: "Manage Multiple Clients", body: "Onboard clients, set portfolio targets, issue fund reports, and distribute dividends — all in one place." },
];

export default function WealthAuth() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("+254");
  const [firmName, setFirmName] = useState("");
  const [aum, setAum] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState<"terms" | "privacy" | null>(null);
  const [error, setError] = useState("");
  const [welcomeStep, setWelcomeStep] = useState<"auth" | "welcome">("auth");
  const [captchaOk, setCaptchaOk] = useState(false);
  const [welcomeIdx, setWelcomeIdx] = useState(0);

  const [totpStep, setTotpStep] = useState(false);
  const [totpCode, setTotpCode] = useState(["", "", "", "", "", ""]);
  const [tempToken, setTempToken] = useState("");
  const totpInputs = useRef<(HTMLInputElement | null)[]>([]);

  const login = useLogin();
  const register = useRegister();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate({ data: { email, password } }, {
      onSuccess: (data: any) => {
        if (data.totpRequired) { setTempToken(data.tempToken ?? ""); setTotpStep(true); return; }
        if (!data.user) { setError("Login failed. Please try again."); return; }
        if (!["investor", "wealth_manager"].includes(data.user.role)) {
          setError("This account is not a wealth management account.");
          return;
        }
        setToken(data.token);
        storeUser({ ...data.user, wealthManager: true });
        sessionStorage.setItem("investa_investor_type", "fund_manager");
        setLocation("/wealth");
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
      setToken(d.token);
      storeUser({ ...d.user, wealthManager: true });
      sessionStorage.setItem("investa_investor_type", "fund_manager");
      setLocation("/wealth");
    } catch (err) { setError((err as Error).message); }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!agreed) { setError("Please accept the Terms & Privacy Policy to continue."); return; }
    const name = fullName || email.split("@")[0]!.replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const fullPhone = (() => {
      const raw = phone.trim();
      if (!raw) return undefined;
      const digits = raw.replace(/\D/g, "");
      if (!digits) return undefined;
      const codeDigits = phoneCode.replace(/\D/g, "");
      if (digits.startsWith(codeDigits)) return "+" + digits;
      return "+" + codeDigits + (digits.startsWith("0") ? digits.slice(1) : digits);
    })();
    register.mutate({
      data: {
        email,
        password,
        name,
        role: "investor",
        ...(fullPhone ? { phone: fullPhone } : {}),
      } as any,
    }, {
      onSuccess: (data: any) => {
        setToken(data.token);
        storeUser({ ...data.user, wealthManager: true, firmName });
        sessionStorage.setItem("investa_investor_type", "fund_manager");
        sessionStorage.setItem("investa_wealth_firm", firmName);
        sessionStorage.setItem("investa_wealth_aum", aum);
        if (data.requiresOtp) {
          setLocation(`/verify-otp?email=${encodeURIComponent(email)}`);
        } else {
          setWelcomeStep("welcome");
        }
      },
      onError: () => setError("Registration failed. Email may already be in use."),
    });
  };

  if (totpStep) {
    return (
      <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
              <Smartphone size={30} className="text-indigo-600" />
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
                  className="w-11 h-14 text-center text-foreground font-bold text-xl bg-muted border border-border rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" />
              ))}
            </div>
            <button onClick={handleTotpSubmit} disabled={totpCode.join("").length !== 6}
              className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
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

  if (welcomeStep === "welcome") {
    const ws = WELCOME_STEPS[welcomeIdx]!;
    return (
      <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col items-center justify-center p-8"
        style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)" }}>
        <div className="text-center space-y-4 max-w-xs">
          <div className="text-6xl mb-2">{ws.icon}</div>
          <h2 className="text-white text-2xl font-bold">{ws.title}</h2>
          <p className="text-white/70 text-sm leading-relaxed">{ws.body}</p>
          <div className="flex gap-1.5 justify-center mt-4">
            {WELCOME_STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === welcomeIdx ? "w-6 bg-white" : "w-1.5 bg-white/30"}`} />
            ))}
          </div>
          <button onClick={() => {
            if (welcomeIdx < WELCOME_STEPS.length - 1) setWelcomeIdx(n => n + 1);
            else setLocation("/wealth");
          }} className="w-full bg-white text-indigo-700 font-bold py-3.5 rounded-xl mt-4 active:scale-95 transition-transform">
            {welcomeIdx < WELCOME_STEPS.length - 1 ? "Next →" : "Go to Dashboard"}
          </button>
          {welcomeIdx < WELCOME_STEPS.length - 1 && (
            <button onClick={() => setLocation("/wealth")} className="text-white/50 text-xs underline">Skip intro</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col" data-testid="wealth-auth">
        <div className="relative pt-14 pb-8 px-6 flex flex-col items-center gap-4 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)" }}>
          <img src={wealthBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
          <div className="relative z-10 w-full">
            <button onClick={() => setLocation("/")}
              className="self-start w-9 h-9 rounded-full bg-white/15 flex items-center justify-center mb-4">
              <ArrowLeft size={18} className="text-white" />
            </button>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                <img src={logoSrc} alt="Investa Farm" className="h-10 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
              </div>
              <div className="text-center">
                <h1 className="text-white text-2xl font-bold">Wealth Management</h1>
                <p className="text-white/60 text-sm mt-1">Professional agricultural fund management</p>
              </div>
              <div className="flex gap-3">
                {[["💼","Fund\nManagement"],["📊","Portfolio\nAnalytics"],["👥","Client\nReporting"]].map(([e, l]) => (
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

          <div className="flex bg-indigo-50 rounded-2xl p-1 mb-6">
            {(["login", "register"] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${t === tab ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-400/70"}`}>
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
                  <WField label="Email address" id="email" type="email" value={email} set={setEmail} placeholder="manager@firm.com" icon={<Mail size={15} />} />
                  <WPwField label="Password" value={password} set={setPassword} show={showPw} toggle={() => setShowPw(s => !s)} />
                  <a href="/forgot-password" className="w-full text-right text-xs text-indigo-600 font-medium -mt-2 pr-1 block">Forgot password?</a>
                  <button type="submit" disabled={login.isPending}
                    className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-indigo-200 mt-2 disabled:opacity-60">
                    {login.isPending && <Loader2 size={16} className="animate-spin" />}
                    {login.isPending ? "Signing in…" : "Sign In to Wealth Portal"}
                  </button>
                  <p className="text-center text-muted-foreground text-xs">New here? <button type="button" onClick={() => setTab("register")} className="text-indigo-600 font-semibold">Create account</button></p>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <WField label="Full Name" id="name" type="text" value={fullName} set={setFullName} placeholder="e.g. Sarah Njoroge" icon={<User size={15} />} />
                  <WField label="Email address" id="email" type="email" value={email} set={setEmail} placeholder="manager@firm.com" icon={<Mail size={15} />} />
                  <WField label="Firm / Company Name" id="firm" type="text" value={firmName} set={setFirmName} placeholder="e.g. Nairobi Capital Partners" icon={<Briefcase size={15} />} />
                  <div className="space-y-1.5">
                    <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">Phone Number</label>
                    <div className="flex gap-2">
                      <select value={phoneCode} onChange={e => setPhoneCode(e.target.value)}
                        className="border border-border rounded-xl px-2 py-3 text-sm bg-gray-50 focus:outline-none focus:border-indigo-500 appearance-none w-[88px] flex-shrink-0 text-center font-medium">
                        {PHONE_CODES.map(c => (
                          <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                        ))}
                      </select>
                      <div className="relative flex-1">
                        <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                          placeholder={phoneCode === "+254" ? "7XX XXX XXX" : "Phone number"}
                          className="w-full border border-border rounded-xl pl-10 pr-4 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">Funds Under Management (KES)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["<10M", "10M–100M", "100M+"].map(r => (
                        <button key={r} type="button" onClick={() => setAum(r)}
                          className={`py-2 rounded-xl border text-xs font-medium transition-all ${aum === r ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-border text-muted-foreground"}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <WPwField label="Password" value={password} set={setPassword} show={showPw} toggle={() => setShowPw(s => !s)} />
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex gap-2">
                    <PieChart size={14} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                    <p className="text-indigo-700 text-xs leading-relaxed">
                      Manage agricultural fund portfolios with <strong>professional analytics</strong>, client reporting, and diversified farm allocations.
                    </p>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <button type="button" onClick={() => setAgreed(a => !a)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${agreed ? "bg-indigo-600 border-indigo-600" : "border-border"}`}>
                      {agreed && <CheckSquare size={12} className="text-white" />}
                    </button>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      I agree to the{" "}
                      <button type="button" onClick={() => setTermsOpen("terms")} className="text-indigo-600 font-medium underline">Terms of Service</button>
                      {" "}and{" "}
                      <button type="button" onClick={() => setTermsOpen("privacy")} className="text-indigo-600 font-medium underline">Privacy Policy</button>
                    </span>
                  </label>
                  <Captcha onVerified={ok => setCaptchaOk(ok)} />
                  <button type="submit" disabled={register.isPending || !captchaOk}
                    className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-indigo-200 mt-2 disabled:opacity-60">
                    {register.isPending && <Loader2 size={16} className="animate-spin" />}
                    {register.isPending ? "Creating account…" : "Create Wealth Manager Account"}
                  </button>
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

function WField({ label, id, type, value, set, placeholder, icon }: {
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
          className={`w-full border border-border rounded-xl py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors ${icon ? "pl-10 pr-4" : "px-4"}`} />
      </div>
    </div>
  );
}

function WPwField({ label, value, set, show, toggle }: { label: string; value: string; set: (v: string) => void; show: boolean; toggle: () => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">{label}</label>
      <div className="relative">
        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input data-testid="input-password" type={show ? "text" : "password"} value={value} onChange={e => set(e.target.value)}
          placeholder="Min. 6 characters" required minLength={6}
          className="w-full border border-border rounded-xl pl-10 pr-12 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors" />
        <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
