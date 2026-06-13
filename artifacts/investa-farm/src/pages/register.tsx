import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { setToken, storeUser } from "@/lib/auth";
import { Loader2, Tractor, BarChart2, Handshake, Package, Eye, EyeOff, Check, X } from "lucide-react";

type RoleKey = "investor" | "farmer" | "agribusiness";
type AgribizType = "farmer_connector" | "input_supplier";

function pwCheck(pw: string) {
  return {
    hasMinLength: pw.length >= 8,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
  };
}

export default function Register() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<RoleKey>("investor");
  const [agribizType, setAgribizType] = useState<AgribizType>("farmer_connector");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false, password: false });

  const register = useRegister();
  const checks = pwCheck(password);
  const pwValid = checks.hasMinLength && checks.hasUpper && checks.hasLower && checks.hasNumber;
  const pwStarted = password.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTouched({ name: true, email: true, password: true });
    if (!name.trim()) { setError("Please enter your full name."); return; }
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (!pwValid) { setError("Password must be 8+ characters with uppercase, lowercase, and a number."); return; }

    const finalRole = role === "agribusiness" ? "agribusiness" : role;
    register.mutate(
      {
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: finalRole as "farmer" | "investor",
          agribizType: role === "agribusiness" ? agribizType : undefined,
        } as any,
      },
      {
        onSuccess: (data: any) => {
          setToken(data.token);
          storeUser({ ...data.user, agribizType: role === "agribusiness" ? agribizType : undefined });
          if (data.requiresOtp === false) {
            if (data.user.role === "farmer") setLocation("/farmer");
            else setLocation("/market");
          } else {
            setLocation(`/verify-otp?email=${encodeURIComponent(email)}`);
          }
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? err?.message ?? "";
          if (msg.toLowerCase().includes("already")) {
            setError("This email is already registered. Try signing in instead.");
          } else {
            setError("Registration failed. Please check your details and try again.");
          }
        },
      }
    );
  };

  const roles: { key: RoleKey; Icon: any; label: string; desc: string }[] = [
    { key: "investor", Icon: BarChart2, label: "Investor", desc: "Buy farm shares" },
    { key: "farmer", Icon: Tractor, label: "Farmer", desc: "Raise farm capital" },
    { key: "agribusiness", Icon: Handshake, label: "Agribusiness", desc: "Supply chain partner" },
  ];

  const reqItems = [
    { label: "8+ characters", ok: checks.hasMinLength },
    { label: "Uppercase letter", ok: checks.hasUpper },
    { label: "Lowercase letter", ok: checks.hasLower },
    { label: "A number (0–9)", ok: checks.hasNumber },
  ];

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-white flex flex-col pb-10" data-testid="register-page">
      <div className="h-1.5 bg-gradient-to-r from-primary to-green-400 w-full" />

      <div className="pt-12 pb-5 px-8 text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/25">
          <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9">
            <path d="M20 6C12.268 6 6 12.268 6 20s6.268 14 14 14 14-6.268 14-14S27.732 6 20 6z" fill="white" fillOpacity="0.2"/>
            <path d="M12 24c2-4 5-7 8-8 3-1 6 1 8 4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M20 14v10M16 18l4-4 4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Join Investa Farm</h1>
          <p className="text-muted-foreground text-sm mt-1">Create your free account</p>
        </div>
      </div>

      <div className="flex-1 px-6">
        <div className="bg-white rounded-3xl border border-border p-6 space-y-4">
          {error && (
            <div data-testid="error-message" className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-foreground text-xs font-semibold uppercase tracking-wider">I am a</label>
            <div className="grid grid-cols-3 gap-2">
              {roles.map(({ key, Icon, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  data-testid={`role-${key}`}
                  onClick={() => setRole(key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                    role === key ? "border-primary bg-primary/8" : "border-border bg-muted/40"
                  }`}
                >
                  <Icon size={20} className={role === key ? "text-primary" : "text-muted-foreground"} />
                  <span className={`text-xs font-semibold ${role === key ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
                  <span className={`text-[9px] text-center leading-tight ${role === key ? "text-primary/70" : "text-muted-foreground/70"}`}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {role === "agribusiness" && (
            <div className="space-y-2">
              <label className="text-foreground text-xs font-semibold uppercase tracking-wider">Agribusiness Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "farmer_connector" as AgribizType, Icon: Handshake, label: "Farmer Connector", desc: "Onboard & support farmers" },
                  { key: "input_supplier" as AgribizType, Icon: Package, label: "Input Supplier", desc: "Supply seeds & inputs" },
                ].map(({ key, Icon, label, desc }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAgribizType(key)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                      agribizType === key ? "border-primary bg-primary/8" : "border-border bg-muted/40"
                    }`}
                  >
                    <Icon size={20} className={agribizType === key ? "text-primary" : "text-muted-foreground"} />
                    <span className={`text-xs font-semibold ${agribizType === key ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
                    <span className={`text-[9px] text-center leading-tight ${agribizType === key ? "text-primary/70" : "text-muted-foreground/70"}`}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-semibold uppercase tracking-wider">Full Name</label>
              <input
                data-testid="input-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, name: true }))}
                placeholder="John Kamau"
                required
                className={`w-full bg-muted border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 transition-all ${
                  touched.name && !name.trim() ? "border-red-300 focus:ring-red-100" : "border-border focus:border-primary focus:ring-primary/15"
                }`}
              />
              {touched.name && !name.trim() && <p className="text-red-500 text-[11px]">Full name is required</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-semibold uppercase tracking-wider">Email</label>
              <input
                data-testid="input-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                placeholder="you@example.com"
                required
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-semibold uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  data-testid="input-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, password: true }))}
                  placeholder="Min 8 characters"
                  required
                  className={`w-full bg-muted border rounded-xl px-4 py-3 pr-11 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 transition-all ${
                    pwStarted && pwValid
                      ? "border-green-400 focus:ring-green-100"
                      : touched.password && !pwValid && pwStarted
                      ? "border-amber-400 focus:ring-amber-100"
                      : "border-border focus:border-primary focus:ring-primary/15"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {(pwStarted || (touched.password && !pwValid)) && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
                  {reqItems.map(({ label, ok }) => (
                    <div key={label} className={`flex items-center gap-1.5 text-[11px] font-medium ${ok ? "text-green-600" : "text-muted-foreground"}`}>
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? "bg-green-100" : "bg-muted"}`}>
                        {ok ? <Check size={8} className="text-green-600" /> : <X size={7} className="text-muted-foreground/60" />}
                      </div>
                      {label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              data-testid="button-register"
              type="submit"
              disabled={register.isPending}
              className="w-full bg-primary hover:bg-primary/90 active:scale-95 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 shadow-md shadow-primary/20 disabled:opacity-60"
            >
              {register.isPending ? <Loader2 size={18} className="animate-spin" /> : null}
              {register.isPending ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="border-t border-border pt-4">
            <p className="text-center text-muted-foreground text-sm">
              Already have an account?{" "}
              <Link href="/login">
                <span data-testid="link-login" className="text-primary font-semibold hover:text-primary/80">Sign in</span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
