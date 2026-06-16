import { useState } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { setToken, storeUser } from "@/lib/auth";
import { Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const justRegistered = params.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setNeedsVerify(false); setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();

      if (r.status === 403 && d.requiresOtp) {
        setToken(d.token);
        storeUser(d.user);
        setVerifyEmail(d.email ?? email);
        setNeedsVerify(true);
        return;
      }
      if (!r.ok) {
        setError(d.error ?? "Invalid email or password.");
        return;
      }
      setToken(d.token);
      storeUser(d.user);
      const role = d.user?.role;
      if (role === "farmer") setLocation("/farmer");
      else if (role === "cooperative") setLocation("/cooperative/dashboard");
      else if (role === "agribusiness") setLocation("/agribusiness");
      else setLocation("/market");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (needsVerify) {
    return (
      <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-white flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <ShieldCheck size={32} className="text-primary" />
          </div>
          <div>
            <h2 className="text-foreground font-bold text-2xl">Verify Your Email</h2>
            <p className="text-muted-foreground text-sm mt-2">
              A verification code has been sent to<br />
              <span className="text-primary font-semibold">{verifyEmail}</span>
            </p>
            <p className="text-muted-foreground text-xs mt-1">Check your inbox and spam folder.</p>
          </div>
          <button
            onClick={() => setLocation(`/verify-otp?email=${encodeURIComponent(verifyEmail)}`)}
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3.5 rounded-xl transition-all"
          >
            Enter Verification Code
          </button>
          <button onClick={() => setNeedsVerify(false)} className="text-muted-foreground text-sm hover:text-foreground transition-colors">
            ← Back to sign in
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-white flex flex-col" data-testid="login-page">
      {/* Green top accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary to-green-400 w-full" />

      <div className="pt-14 pb-8 px-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/25">
          <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9">
            <path d="M20 6C12.268 6 6 12.268 6 20s6.268 14 14 14 14-6.268 14-14S27.732 6 20 6z" fill="white" fillOpacity="0.2"/>
            <path d="M12 24c2-4 5-7 8-8 3-1 6 1 8 4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M20 14v10M16 18l4-4 4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to Investa Farm</p>
        </div>
      </div>

      <div className="flex-1 px-6">
        <div className="bg-white rounded-3xl border border-border p-6 space-y-4">

          <AnimatePresence>
            {justRegistered && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-primary/8 border border-primary/25 rounded-2xl px-4 py-3 flex items-start gap-3"
              >
                <CheckCircle2 size={18} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-primary font-bold text-sm">Registration Successful! 🎉</p>
                  <p className="text-primary/70 text-xs mt-0.5">Your account has been verified. Sign in to get started.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div data-testid="error-message" className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-semibold uppercase tracking-wider">Email</label>
              <input
                data-testid="input-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
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
                  placeholder="••••••••"
                  required
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 pr-12 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                />
                <button
                  type="button"
                  data-testid="button-toggle-password"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="text-right -mt-2">
              <a href="/forgot-password" className="text-xs text-primary font-medium hover:underline">Forgot password?</a>
            </div>

            <button
              data-testid="button-login"
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 active:scale-95 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 shadow-md shadow-primary/20"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="border-t border-border pt-4">
            <p className="text-center text-muted-foreground text-sm">
              No account?{" "}
              <Link href="/register">
                <span data-testid="link-register" className="text-primary font-semibold hover:text-primary/80">Create one</span>
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-muted-foreground text-xs text-center leading-relaxed">
            Demo: <strong className="text-foreground">john.farmer@investafarm.com</strong> (farmer) or <strong className="text-foreground">david.investor@investafarm.com</strong> (investor) — password <strong className="text-foreground">password123</strong>
          </p>
        </div>
      </div>

      <div className="pb-12" />
    </div>
  );
}
