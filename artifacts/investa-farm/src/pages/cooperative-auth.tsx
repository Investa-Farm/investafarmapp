import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Building2, Loader2, CheckCircle2, MapPin, Phone, CheckSquare, Users, Package, Briefcase, Truck } from "lucide-react";
import { setToken, storeUser } from "@/lib/auth";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import coopBg from "@assets/pexels-nc-farm-bureau-mark-27083566_1778315943106.jpg";
import { TermsModal } from "@/components/terms-modal";

const FARMERS_CONNECT_ORG_TYPES = [
  { value: "cooperative",  label: "🌾 Farmer Cooperative" },
  { value: "aggregator",   label: "📦 Produce Aggregator" },
  { value: "ngo",          label: "🤝 NGO / Development Partner" },
];

const INPUT_PROVIDER_ORG_TYPES = [
  { value: "distributor",  label: "🚛 Input Distributor" },
  { value: "agribusiness", label: "🏭 Agribusiness / Processor" },
  { value: "financial",    label: "🏦 Financial Institution" },
];

const COOP_PHONE_CODES = [
  { code: "+254", flag: "🇰🇪" },
  { code: "+255", flag: "🇹🇿" },
  { code: "+256", flag: "🇺🇬" },
  { code: "+250", flag: "🇷🇼" },
  { code: "+251", flag: "🇪🇹" },
  { code: "+27",  flag: "🇿🇦" },
  { code: "+234", flag: "🇳🇬" },
  { code: "+233", flag: "🇬🇭" },
  { code: "+263", flag: "🇿🇼" },
  { code: "+260", flag: "🇿🇲" },
  { code: "+265", flag: "🇲🇼" },
  { code: "+258", flag: "🇲🇿" },
  { code: "+44",  flag: "🇬🇧" },
  { code: "+1",   flag: "🇺🇸" },
  { code: "+971", flag: "🇦🇪" },
];

const WELCOME_STEPS = [
  { icon: "🤝", title: "Welcome, Partner!", body: "Investa Farm connects your organization to Africa's leading farm investment network. Access farmer data, loans, and market intelligence." },
  { icon: "👥", title: "Manage Farmer Networks", body: "Onboard and manage farmer groups in your county. Track KYC status, loan repayments, and crop progress in real time." },
  { icon: "📊", title: "Data & Analytics", body: "Access rich dashboards and reports on your farmer network. Export data to Excel or integrate via our REST API." },
  { icon: "💼", title: "Co-Financing Programs", body: "Co-invest alongside Investa Farm on large farm projects and earn returns as a partner institution." },
];

type CoopSubType = "farmers_connect" | "input_provider" | "sales_agent" | "offtaker" | null;

export default function CooperativeAuth() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const justRegistered = new URLSearchParams(search).get("registered") === "1";
  const [subType, setSubType] = useState<CoopSubType>(null);
  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("cooperative");
  const [county, setCounty] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("+254");
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
      if (subType) localStorage.setItem("investa_coop_sub_type", subType);
      if (subType === "sales_agent") {
        setLocation("/sales-agent/dashboard");
      } else if (subType === "offtaker") {
        setLocation("/offtaker/dashboard");
      } else {
        setLocation("/cooperative/dashboard");
      }
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
        body: JSON.stringify({ email, password, name, role: (subType === "sales_agent" || subType === "offtaker") ? "agribusiness" : "cooperative" }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Registration failed. The email may already be in use.");
        setLoading(false);
        return;
      }
      setToken(data.token);
      storeUser(data.user);
      if (subType) localStorage.setItem("investa_coop_sub_type", subType);
      localStorage.setItem("investa_org_type", orgType);
      if (subType === "sales_agent") {
        setLocation(`/verify-otp?email=${encodeURIComponent(email)}&next=/sales-agent/dashboard`);
      } else if (subType === "offtaker") {
        setLocation(`/verify-otp?email=${encodeURIComponent(email)}&next=/offtaker/dashboard`);
      } else {
        setLocation(`/verify-otp?email=${encodeURIComponent(email)}`);
      }
    } catch {
      setError("Connection error. Please check your internet and try again.");
      setLoading(false);
    }
  };

  const orgTypes = subType === "farmers_connect" ? FARMERS_CONNECT_ORG_TYPES
    : subType === "input_provider" ? INPUT_PROVIDER_ORG_TYPES
    : subType === "offtaker" ? [{ value: "offtaker", label: "🚛 Offtaker / Buyer" }]
    : [{ value: "sales_agent", label: "🤝 Field Sales Agent" }];

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

        {/* Hero header */}
        <div className="relative pt-14 pb-6 px-6 flex flex-col items-start gap-4 flex-shrink-0 overflow-hidden">
          <img src={coopBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
          <button onClick={() => subType ? setSubType(null) : setLocation("/")} className="relative z-10 w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="relative z-10 flex items-center gap-4 w-full">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
              className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
              {subType === "farmers_connect" ? <Users size={28} className="text-white" /> :
               subType === "input_provider" ? <Package size={28} className="text-white" /> :
               subType === "sales_agent" ? <Briefcase size={28} className="text-white" /> :
               <Building2 size={28} className="text-white" />}
            </motion.div>
            <div className="flex-1">
              <h1 className="text-white text-2xl font-bold">Partner Portal</h1>
              <p className="text-white/60 text-sm mt-0.5">
                {subType === "farmers_connect" ? "Farmers Connect Cooperative" :
                 subType === "input_provider" ? "Input Provider / Agribusiness" :
                 subType === "sales_agent" ? "Sales Agent · Field Onboarding" :
                 "Cooperatives · Distributors · Sales Agents"}
              </p>
            </div>
            <img src={logoSrc} alt="Investa Farm" className="h-8 w-auto opacity-60" style={{ filter: "brightness(0) invert(1)" }} />
          </div>
        </div>

        <div className="flex-1 bg-white rounded-t-3xl px-6 pt-6 pb-10 overflow-y-auto">

          {/* Step 1: Pick account sub-type */}
          <AnimatePresence mode="wait">
            {!subType ? (
              <motion.div key="pick-type" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <p className="text-foreground font-bold text-lg mb-1">Choose your account type</p>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">Select the type of organization that best describes you.</p>

                {/* Top row: Farmers Connect + Input Providers side by side */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    onClick={() => { setSubType("farmers_connect"); setOrgType("cooperative"); }}
                    className="p-4 rounded-2xl border-2 border-[#16a34a] bg-[#16a34a]/5 text-left active:scale-95 transition-all"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-[#16a34a] flex items-center justify-center mb-3 shadow-md">
                      <Users size={18} className="text-white" />
                    </div>
                    <p className="text-foreground font-bold text-sm leading-tight">Farmers Connect</p>
                    <p className="text-muted-foreground text-[11px] mt-1 leading-relaxed">Cooperatives & NGOs managing farmer groups</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {["Cooperatives", "NGOs"].map(tag => (
                        <span key={tag} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#16a34a]/10 text-[#16a34a]">{tag}</span>
                      ))}
                    </div>
                  </button>

                  <button
                    onClick={() => { setSubType("input_provider"); setOrgType("distributor"); }}
                    className="p-4 rounded-2xl border-2 border-blue-500 bg-blue-50 text-left active:scale-95 transition-all"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center mb-3 shadow-md">
                      <Package size={18} className="text-white" />
                    </div>
                    <p className="text-foreground font-bold text-sm leading-tight">Input Providers</p>
                    <p className="text-muted-foreground text-[11px] mt-1 leading-relaxed">Supply seeds, fertilizer & farm inputs</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {["Distributors", "Agribiz"].map(tag => (
                        <span key={tag} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{tag}</span>
                      ))}
                    </div>
                  </button>
                </div>

                {/* Bottom row: Sales Agent + Offtaker side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setSubType("sales_agent"); setOrgType("sales_agent"); }}
                    className="p-4 rounded-2xl border-2 border-amber-500 bg-amber-50 text-left active:scale-95 transition-all"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center mb-3 shadow-md">
                      <Briefcase size={18} className="text-white" />
                    </div>
                    <p className="text-foreground font-bold text-sm leading-tight">Sales Agent</p>
                    <p className="text-muted-foreground text-[11px] mt-1 leading-relaxed">Onboard farmers & earn commission</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {["Commission", "Proposals"].map(tag => (
                        <span key={tag} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{tag}</span>
                      ))}
                    </div>
                  </button>

                  <button
                    onClick={() => { setSubType("offtaker"); setOrgType("offtaker"); }}
                    className="p-4 rounded-2xl border-2 border-violet-500 bg-violet-50 text-left active:scale-95 transition-all"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center mb-3 shadow-md">
                      <Truck size={18} className="text-white" />
                    </div>
                    <p className="text-foreground font-bold text-sm leading-tight">Offtaker / Buyer</p>
                    <p className="text-muted-foreground text-[11px] mt-1 leading-relaxed">Buy produce direct from farms</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {["Contracts", "Terralima"].map(tag => (
                        <span key={tag} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{tag}</span>
                      ))}
                    </div>
                  </button>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  <button
                    onClick={() => { setSubType("farmers_connect"); setEmail("demo.coop@investafarm.com"); setPassword("password123"); setTab("signin"); }}
                    className="w-full py-2.5 border border-[#16a34a]/30 rounded-xl text-[#16a34a] text-xs font-semibold bg-[#16a34a]/5 active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                    🤝 Try Demo Cooperative Account
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="auth-form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                {/* Account type badge */}
                <div className={`flex items-center gap-2 mb-5 px-4 py-2.5 rounded-2xl ${
                  subType === "farmers_connect" ? "bg-[#16a34a]/10 border border-[#16a34a]/20" :
                  subType === "sales_agent" ? "bg-amber-50 border border-amber-200" :
                  subType === "offtaker" ? "bg-violet-50 border border-violet-200" :
                  "bg-blue-50 border border-blue-200"}`}>
                  {subType === "farmers_connect" ? <Users size={14} className="text-[#16a34a] flex-shrink-0" /> :
                   subType === "sales_agent" ? <Briefcase size={14} className="text-amber-600 flex-shrink-0" /> :
                   subType === "offtaker" ? <Truck size={14} className="text-violet-600 flex-shrink-0" /> :
                   <Package size={14} className="text-blue-600 flex-shrink-0" />}
                  <p className={`text-xs font-semibold ${
                    subType === "farmers_connect" ? "text-[#16a34a]" :
                    subType === "sales_agent" ? "text-amber-700" :
                    subType === "offtaker" ? "text-violet-700" :
                    "text-blue-700"}`}>
                    {subType === "farmers_connect" ? "Farmers Connect Cooperative" :
                     subType === "sales_agent" ? "Sales Agent · Field Onboarding" :
                     subType === "offtaker" ? "Offtaker · Farm Produce Buyer" :
                     "Input Provider / Agribusiness"}
                  </p>
                  <button onClick={() => setSubType(null)} className="ml-auto text-muted-foreground text-[10px] underline">Change</button>
                </div>

                <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
                  {(["signin", "register"] as const).map(t => (
                    <button key={t} onClick={() => { setTab(t); setError(""); }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === t ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
                      {t === "signin" ? "Sign In" : "Register Partner"}
                    </button>
                  ))}
                </div>

                {justRegistered && tab === "signin" && (
                  <div className="mb-4 bg-[#16a34a]/5 border border-[#16a34a]/20 rounded-2xl px-4 py-3 flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-[#16a34a] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[#16a34a] font-bold text-sm">Registration Successful! 🎉</p>
                      <p className="text-[#16a34a]/70 text-xs mt-0.5">Email verified. Sign in to access your partner dashboard.</p>
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
                          className="w-full border border-border rounded-xl pl-10 pr-4 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-[#16a34a] focus:bg-white transition-colors" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6}
                          className="w-full border border-border rounded-xl pl-10 pr-12 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-[#16a34a] focus:bg-white transition-colors" />
                        <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
                          {show ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-lg"
                      style={{ background: "linear-gradient(135deg,#15803d,#16a34a)" }}>
                      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                      {loading ? "Signing in…" : "Sign In →"}
                    </button>
                    <button type="button" onClick={() => { setEmail("demo.coop@investafarm.com"); setPassword("demo1234"); }}
                      className="w-full py-2.5 border border-[#16a34a]/30 rounded-xl text-[#16a34a] text-xs font-semibold bg-[#16a34a]/5 active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                      🤝 Use Demo Account
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organisation Name</label>
                      <div className="relative">
                        <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Rift Valley Cooperative"
                          className="w-full border border-border rounded-xl pl-10 pr-4 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-[#16a34a] focus:bg-white transition-colors" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organisation Type</label>
                      <div className="grid grid-cols-1 gap-2">
                        {orgTypes.map(o => (
                          <button key={o.value} type="button" onClick={() => setOrgType(o.value)}
                            className={`text-left p-3 rounded-xl border text-sm transition-all flex items-center gap-3 ${orgType === o.value ? "border-[#16a34a] bg-[#16a34a]/5 text-[#16a34a] font-semibold" : "border-border text-foreground"}`}>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${orgType === o.value ? "border-[#16a34a]" : "border-muted-foreground"}`}>
                              {orgType === o.value && <div className="w-2 h-2 rounded-full bg-[#16a34a]" />}
                            </div>
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
                            className="w-full border border-border rounded-xl pl-8 pr-3 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-[#16a34a] focus:bg-white transition-colors" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Phone size={10} /> Phone</label>
                        <div className="flex gap-1.5">
                          <select value={phoneCode} onChange={e => setPhoneCode(e.target.value)}
                            className="border border-border rounded-xl px-1 py-3 text-xs bg-gray-50 focus:outline-none focus:border-[#16a34a] appearance-none w-[62px] flex-shrink-0 text-center">
                            {COOP_PHONE_CODES.map(c => (
                              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                            ))}
                          </select>
                          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="7xx..."
                            className="flex-1 border border-border rounded-xl px-2 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-[#16a34a] focus:bg-white transition-colors min-w-0" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@yourorg.co.ke" required
                          className="w-full border border-border rounded-xl pl-10 pr-4 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-[#16a34a] focus:bg-white transition-colors" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6}
                          className="w-full border border-border rounded-xl pl-10 pr-12 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-[#16a34a] focus:bg-white transition-colors" />
                        <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
                          {show ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <button type="button" onClick={() => setAgreed(a => !a)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${agreed ? "bg-[#16a34a] border-[#16a34a]" : "border-border"}`}>
                        {agreed && <CheckSquare size={12} className="text-white" />}
                      </button>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        I agree to the{" "}
                        <button type="button" onClick={() => setTermsOpen("terms")} className="text-[#16a34a] font-medium underline">Terms of Service</button>
                        {" "}and{" "}
                        <button type="button" onClick={() => setTermsOpen("privacy")} className="text-[#16a34a] font-medium underline">Privacy Policy</button>
                      </span>
                    </label>
                    <button type="submit" disabled={loading}
                      className="w-full text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-lg"
                      style={{ background: "linear-gradient(135deg,#15803d,#16a34a)" }}>
                      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                      {loading ? "Creating account…" : "Create Partner Account →"}
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(null)} />
    </>
  );
}
