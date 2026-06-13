import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Building2, Loader2, CheckCircle2, MapPin, Phone, CheckSquare } from "lucide-react";
import { setToken, storeUser } from "@/lib/auth";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import coopBg from "@assets/pexels-nc-farm-bureau-mark-27083566_1778315943106.jpg";
import { TermsModal } from "@/components/terms-modal";

const ORG_TYPES = [
  { value: "cooperative", label: "🌾 Farmer Cooperative" },
  { value: "distributor",  label: "🚛 Input Distributor" },
  { value: "aggregator",  label: "📦 Produce Aggregator" },
  { value: "agribusiness",label: "🏭 Agribusiness / Processor" },
  { value: "financial",   label: "🏦 Financial Institution" },
  { value: "ngo",         label: "🤝 NGO / Development Partner" },
];

const WELCOME_STEPS = [
  { icon: "🤝", title: "Welcome, Partner!", body: "Investa Farm connects your organization to Africa's leading farm investment network. Access farmer data, loans, and market intelligence." },
  { icon: "👥", title: "Manage Farmer Networks", body: "Onboard and manage farmer groups in your county. Track KYC status, loan repayments, and crop progress in real time." },
  { icon: "📊", title: "Data & Analytics", body: "Access rich dashboards and reports on your farmer network. Export data to Excel or integrate via our REST API." },
  { icon: "💼", title: "Co-Financing Programs", body: "Co-invest alongside Investa Farm on large farm projects and earn returns as a partner institution." },
];

export default function CooperativeAuth() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const justRegistered = new URLSearchParams(search).get("registered") === "1";
  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("cooperative");
  const [county, setCounty] = useState("");
  const [phone, setPhone] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState<"terms" | "privacy" | null>(null);
  const [welcomeStep, setWelcomeStep] = useState<number | null>(null);

  const deriveName = (em: string) => {
    const local = em.split("@")[0] ?? "";
    return local.replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Sign in failed. Check your credentials."); setLoading(false); return; }
      setToken(data.token);
      storeUser(data.user);
      setLocation("/cooperative/dashboard");
    } catch {
      setError("Connection error. Please check your internet and try again.");
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { setError("Please accept the Terms & Privacy Policy to continue."); return; }
    setLoading(true); setError("");
    try {
      const name = orgName || deriveName(email);
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, role: "cooperative" }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Registration failed. The email may already be in use.");
        setLoading(false);
        return;
      }
      setToken(data.token);
      storeUser(data.user);
      setLocation(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch {
      setError("Connection error. Please check your internet and try again.");
      setLoading(false);
    }
  };

  if (welcomeStep !== null && welcomeStep < WELCOME_STEPS.length) {
    const ws = WELCOME_STEPS[welcomeStep];
    return (
      <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col items-center justify-center p-8"
        style={{ background: "linear-gradient(160deg,#0f2027,#1a3a4f,#0f4c35)" }}>
        <div className="text-center space-y-4 max-w-xs">
          <div className="text-6xl mb-2">{ws.icon}</div>
          <h2 className="text-white text-2xl font-bold">{ws.title}</h2>
          <p className="text-white/70 text-sm leading-relaxed">{ws.body}</p>
          <div className="flex gap-1.5 justify-center mt-4">
            {WELCOME_STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === welcomeStep ? "w-6 bg-white" : "w-1.5 bg-white/30"}`} />
            ))}
          </div>
          <button onClick={() => {
            if (welcomeStep < WELCOME_STEPS.length - 1) setWelcomeStep(w => (w ?? 0) + 1);
            else setLocation("/cooperative/dashboard");
          }} className="w-full bg-white text-green-800 font-bold py-3.5 rounded-xl mt-4 active:scale-95 transition-transform">
            {welcomeStep < WELCOME_STEPS.length - 1 ? "Next →" : "Go to Dashboard"}
          </button>
          {welcomeStep < WELCOME_STEPS.length - 1 && (
            <button onClick={() => setLocation("/cooperative/dashboard")} className="text-white/50 text-xs underline">Skip</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col"
        style={{ background: "linear-gradient(160deg,#0f2027 0%,#1a3a4f 45%,#0f4c35 100%)" }}>

        <div className="relative pt-14 pb-8 px-6 flex flex-col items-start gap-4 flex-shrink-0 overflow-hidden">
          <img src={coopBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
          <button onClick={() => setLocation("/")} className="relative z-10 w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="relative z-10 flex items-center gap-4 w-full">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
              className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
              <Building2 size={28} className="text-white" />
            </motion.div>
            <div className="flex-1">
              <h1 className="text-white text-2xl font-bold">Partner Portal</h1>
              <p className="text-white/60 text-sm mt-0.5">Cooperatives · Distributors · Agribusiness</p>
            </div>
            <img src={logoSrc} alt="Investa Farm" className="h-8 w-auto opacity-60" style={{ filter: "brightness(0) invert(1)" }} />
          </div>
          <div className="relative z-10 flex gap-2 w-full">
            {[["🌾","Cooperatives"],["🏭","Agribusiness"],["🏦","Finance"]].map(([e,l]) => (
              <div key={l} className="flex-1 bg-white/10 rounded-xl p-2 text-center border border-white/10">
                <p className="text-base">{e}</p>
                <p className="text-white/60 text-[9px]">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-t-3xl px-6 pt-6 pb-10 overflow-y-auto">
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
            {(["signin", "register"] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === t ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {t === "signin" ? "Sign In" : "Register Partner"}
              </button>
            ))}
          </div>

          {justRegistered && tab === "signin" && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-700 font-bold text-sm">Registration Successful! 🎉</p>
                <p className="text-green-600/70 text-xs mt-0.5">Email verified. Sign in to access your partner dashboard.</p>
              </div>
            </div>
          )}

          {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>}

          {tab === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="org@example.com" required
                    className="w-full border border-border rounded-xl pl-10 pr-4 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-green-600 focus:bg-white transition-colors" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6}
                    className="w-full border border-border rounded-xl pl-10 pr-12 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-green-600 focus:bg-white transition-colors" />
                  <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-lg"
                style={{ background: "linear-gradient(135deg,#0f4c35,#1a6b4a)" }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? "Signing in…" : "Sign In"}
              </button>
              <button type="button" onClick={() => { setEmail("demo.coop@investafarm.com"); setPassword("demo1234"); }}
                className="w-full py-2.5 border border-green-200 rounded-xl text-green-700 text-xs font-semibold bg-green-50 active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                🤝 Try Demo Cooperative Account
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organisation Name</label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Rift Valley Cooperative"
                    className="w-full border border-border rounded-xl pl-10 pr-4 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-green-600 focus:bg-white transition-colors" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organisation Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {ORG_TYPES.map(o => (
                    <button key={o.value} type="button" onClick={() => setOrgType(o.value)}
                      className={`text-left p-2.5 rounded-xl border text-xs transition-all ${orgType === o.value ? "border-green-600 bg-green-50 text-green-700 font-medium" : "border-border text-foreground"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">County</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" value={county} onChange={e => setCounty(e.target.value)} placeholder="e.g. Nakuru"
                      className="w-full border border-border rounded-xl pl-8 pr-3 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-green-600 focus:bg-white transition-colors" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254 7xx..."
                      className="w-full border border-border rounded-xl pl-8 pr-3 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-green-600 focus:bg-white transition-colors" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@yourorg.co.ke" required
                    className="w-full border border-border rounded-xl pl-10 pr-4 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-green-600 focus:bg-white transition-colors" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6}
                    className="w-full border border-border rounded-xl pl-10 pr-12 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-green-600 focus:bg-white transition-colors" />
                  <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
              <button type="submit" disabled={loading}
                className="w-full text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-lg"
                style={{ background: "linear-gradient(135deg,#0f4c35,#1a6b4a)" }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? "Creating account…" : "Create Partner Account"}
              </button>
            </form>
          )}
        </div>
      </div>
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(null)} />
    </>
  );
}
