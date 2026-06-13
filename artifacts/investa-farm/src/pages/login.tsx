import { useState } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { setToken, storeUser } from "@/lib/auth";
import { TrendingUp, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
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
        // Store temp token so /verify-otp can authenticate the OTP call
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
      <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-gradient-to-b from-[#0a2e10] via-[#0f3d1a] to-[#143d1a] flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mx-auto">
            <ShieldCheck size={32} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-2xl">Verify Your Email</h2>
            <p className="text-white/60 text-sm mt-2">
              A verification code has been sent to<br />
              <span className="text-green-400 font-semibold">{verifyEmail}</span>
            </p>
            <p className="text-white/40 text-xs mt-1">Check your inbox and spam folder.</p>
          </div>
          <button
            onClick={() => setLocation(`/verify-otp?email=${encodeURIComponent(verifyEmail)}`)}
            className="w-full bg-green-500 hover:bg-green-400 text-white font-semibold py-3.5 rounded-xl transition-all"
          >
            Enter Verification Code
          </button>
          <button onClick={() => setNeedsVerify(false)} className="text-white/40 text-sm hover:text-white/60 transition-colors">
            ← Back to sign in
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-gradient-to-b from-[#0a2e10] via-[#0f3d1a] to-[#143d1a] flex flex-col" data-testid="login-page">
      <div className="pt-16 pb-8 px-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto border border-green-500/30">
          <TrendingUp size={28} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white font-[Space_Grotesk]">Welcome back</h1>
          <p className="text-white/60 text-sm mt-1">Sign in to Investa Farm</p>
        </div>
      </div>

      <div className="flex-1 px-6">
        <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-6 space-y-4">

          <AnimatePresence>
            {justRegistered && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-green-500/15 border border-green-400/40 rounded-2xl px-4 py-3 flex items-start gap-3"
              >
                <CheckCircle2 size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-300 font-bold text-sm">Registration Successful! 🎉</p>
                  <p className="text-green-400/70 text-xs mt-0.5">Your account has been verified. Sign in to get started.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div data-testid="error-message" className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-white/70 text-xs font-medium uppercase tracking-wider">Email</label>
              <input
                data-testid="input-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-green-400/50 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-white/70 text-xs font-medium uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  data-testid="input-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-green-400/50 transition-colors"
                />
                <button
                  type="button"
                  data-testid="button-toggle-password"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              data-testid="button-login"
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-400 active:scale-95 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="border-t border-white/10 pt-4">
            <p className="text-center text-white/50 text-sm">
              No account?{" "}
              <Link href="/register">
                <span data-testid="link-register" className="text-green-400 font-medium hover:text-green-300">Create one</span>
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-300/80 text-xs text-center leading-relaxed">
            Demo: Use <strong className="text-yellow-300">john.farmer@investafarm.com</strong> (farmer) or <strong className="text-yellow-300">david.investor@investafarm.com</strong> with password <strong className="text-yellow-300">password123</strong>
          </p>
        </div>
      </div>

      <div className="pb-12" />
    </div>
  );
}
