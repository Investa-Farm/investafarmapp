import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Loader2, Leaf, Lock, Mail, User, Phone, MapPin, CheckSquare, CheckCircle2 } from "lucide-react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { setToken, storeUser } from "@/lib/auth";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import farmerBg from "@assets/pexels-christian-hembert-1081250355-35553039_1778315943103.jpg";
import { TermsModal } from "@/components/terms-modal";

const COUNTIES = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Malindi","Kitale","Machakos","Nyeri","Meru","Kakamega","Kisii","Kericho","Embu"];

export default function FarmerAuth() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const justRegistered = new URLSearchParams(search).get("registered") === "1";
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [county, setCounty] = useState("");
  const [cropType, setCropType] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState<"terms" | "privacy" | null>(null);
  const [error, setError] = useState("");
  const [welcomeStep, setWelcomeStep] = useState<number | null>(null);

  const login = useLogin();
  const register = useRegister();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    login.mutate({ data: { email, password } }, {
      onSuccess: (data: any) => {
        if (data.totpRequired) {
          setError("Two-factor authentication is required. Please contact support.");
          return;
        }
        if (!data.user) { setError("Login failed. Please try again."); return; }
        if (data.user.role !== "farmer") { setError("This account is not a farmer account."); return; }
        setToken(data.token); storeUser(data.user);
        setLocation("/farmer");
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

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!agreed) { setError("Please accept the Terms & Privacy Policy to continue."); return; }
    const name = fullName || email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    register.mutate({ data: { email, password, name, role: "farmer" } }, {
      onSuccess: (data) => {
        setToken(data.token); storeUser(data.user);
        setLocation(`/verify-otp?email=${encodeURIComponent(email)}`);
      },
      onError: () => setError("Registration failed. Email may already be in use."),
    });
  };

  const WELCOME_STEPS = [
    { icon: "🌾", title: "Welcome, Farmer!", body: "Investa Farm connects you to capital, buyers, and technology to grow your farm business." },
    { icon: "📋", title: "Complete Your KYC", body: "Verify your identity with a national ID and farm ownership proof to unlock full platform access and apply for funding." },
    { icon: "💰", title: "Raise Capital", body: "Once verified, apply for funding and get listed on the exchange — investors across Kenya will back your farm!" },
  ];

  if (welcomeStep !== null && welcomeStep < WELCOME_STEPS.length) {
    const step = WELCOME_STEPS[welcomeStep];
    return (
      <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col items-center justify-center p-8"
        style={{ background: "linear-gradient(160deg, #052e16 0%, #14532d 40%, #16a34a 100%)" }}>
        <div className="text-center space-y-4 max-w-xs">
          <div className="text-6xl mb-2">{step.icon}</div>
          <h2 className="text-white text-2xl font-bold">{step.title}</h2>
          <p className="text-white/70 text-sm leading-relaxed">{step.body}</p>
          <div className="flex gap-1.5 justify-center mt-4">
            {WELCOME_STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === welcomeStep ? "w-6 bg-white" : "w-1.5 bg-white/30"}`} />
            ))}
          </div>
          <button onClick={() => {
            if (welcomeStep < WELCOME_STEPS.length - 1) setWelcomeStep(w => (w ?? 0) + 1);
            else setLocation("/farmer");
          }} className="w-full bg-white text-green-700 font-bold py-3.5 rounded-xl mt-4 active:scale-95 transition-transform">
            {welcomeStep < WELCOME_STEPS.length - 1 ? "Next →" : "Go to Dashboard"}
          </button>
          {welcomeStep < WELCOME_STEPS.length - 1 && (
            <button onClick={() => setLocation("/farmer")} className="text-white/50 text-xs underline">
              Skip intro
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col" data-testid="farmer-auth">
        <div className="relative pt-14 pb-8 px-6 flex flex-col items-center gap-4 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #052e16 0%, #14532d 40%, #16a34a 100%)" }}>
          <img src={farmerBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
          <div className="relative z-10 w-full">
            <button onClick={() => setLocation("/")}
              className="self-start w-9 h-9 rounded-full bg-white/15 flex items-center justify-center mb-4">
              <ArrowLeft size={18} className="text-white" />
            </button>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                <img src={logoSrc} alt="Investa Farm" className="h-14 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
              </div>
              <div className="text-center">
                <h1 className="text-white text-2xl font-bold">Farmer Portal</h1>
                <p className="text-white/60 text-sm mt-1">Grow your farm with investor capital</p>
              </div>
              <div className="flex gap-3 text-center">
                {[["💰","Loans"],["📊","Analytics"],["🌱","Market"]].map(([e,l]) => (
                  <div key={l} className="bg-white/10 rounded-xl px-3 py-1.5 border border-white/20">
                    <p className="text-lg">{e}</p>
                    <p className="text-white/70 text-[9px]">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-t-3xl px-6 pt-6 pb-10 overflow-y-auto">
          <div className="flex items-center justify-center gap-2 mb-5">
            <img src={logoSrc} alt="Investa Farm" className="h-5 w-auto opacity-40" />
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

              {justRegistered && tab === "login" && (
                <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-700 font-bold text-sm">Registration Successful! 🎉</p>
                    <p className="text-green-600/70 text-xs mt-0.5">Email verified. Sign in to access your farmer dashboard.</p>
                  </div>
                </div>
              )}

              {error && (
                <div data-testid="error-message" className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>
              )}

              {tab === "login" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <Field label="Email address" id="email" type="email" value={email} set={setEmail} placeholder="you@example.com" icon={<Mail size={15} />} />
                  <PwField label="Password" value={password} set={setPassword} show={showPw} toggle={() => setShowPw(s => !s)} />
                  <a href="/forgot-password" className="w-full text-right text-xs text-green-600 font-medium -mt-2 pr-1 block">Forgot password?</a>
                  <SubmitBtn loading={login.isPending} label="Sign In" />
                  <button type="button" onClick={() => { setEmail("demo.farmer@investafarm.com"); setPassword("password123"); }}
                    className="w-full py-2.5 border border-green-200 rounded-xl text-green-700 text-xs font-semibold bg-green-50 active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                    🌾 Try Demo Farmer Account
                  </button>
                  <p className="text-center text-muted-foreground text-xs">New here? <button type="button" onClick={() => setTab("register")} className="text-green-600 font-semibold">Create account</button></p>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <Field label="Full Name" id="name" type="text" value={fullName} set={setFullName} placeholder="e.g. John Kamau" icon={<User size={15} />} required />
                  <Field label="Email address" id="email" type="email" value={email} set={setEmail} placeholder="farmer@example.com" icon={<Mail size={15} />} />
                  <Field label="Phone Number" id="phone" type="tel" value={phone} set={setPhone} placeholder="+254 7xx xxx xxx" icon={<Phone size={15} />} required />
                  <div className="space-y-1.5">
                    <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">County</label>
                    <div className="relative">
                      <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <select value={county} onChange={e => setCounty(e.target.value)}
                        className="w-full border border-border rounded-xl pl-10 pr-4 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition-colors appearance-none">
                        <option value="">Select your county...</option>
                        {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">Main Crop Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Maize","Tomatoes","Avocado","Tea","Coffee","Other"].map(c => (
                        <button key={c} type="button" onClick={() => setCropType(c)}
                          className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all ${cropType === c ? "border-green-500 bg-green-50 text-green-700" : "border-border text-muted-foreground"}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <PwField label="Password" value={password} set={setPassword} show={showPw} toggle={() => setShowPw(s => !s)} />
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex gap-2">
                    <Leaf size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-green-700 text-xs leading-relaxed">
                      After registering, <strong>complete KYC</strong> to unlock funding applications and get listed on the investor market.
                    </p>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <button type="button" onClick={() => setAgreed(a => !a)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${agreed ? "bg-green-600 border-green-600" : "border-border"}`}>
                      {agreed && <CheckSquare size={12} className="text-white" />}
                    </button>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      I agree to the{" "}
                      <button type="button" onClick={() => setTermsOpen("terms")} className="text-green-600 font-medium underline">Terms of Service</button>
                      {" "}and{" "}
                      <button type="button" onClick={() => setTermsOpen("privacy")} className="text-green-600 font-medium underline">Privacy Policy</button>
                    </span>
                  </label>
                  <SubmitBtn loading={register.isPending} label="Create Farmer Account" />
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
      <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
        <input data-testid={`input-${id}`} type={type} value={value} onChange={e => set(e.target.value)}
          placeholder={placeholder} required={required !== false}
          className={`w-full border border-border rounded-xl py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition-colors ${icon ? "pl-10 pr-4" : "px-4"}`} />
      </div>
    </div>
  );
}

function PwField({ label, value, set, show, toggle }: { label: string; value: string; set: (v: string) => void; show: boolean; toggle: () => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">{label}</label>
      <div className="relative">
        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input data-testid="input-password" type={show ? "text" : "password"} value={value} onChange={e => set(e.target.value)}
          placeholder="Min. 6 characters" required minLength={6}
          className="w-full border border-border rounded-xl pl-10 pr-12 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition-colors" />
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
      className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-green-200 mt-2">
      {loading && <Loader2 size={16} className="animate-spin" />}
      {loading ? "Please wait..." : label}
    </button>
  );
}
