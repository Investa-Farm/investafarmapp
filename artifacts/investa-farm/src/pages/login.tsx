import { useState, useRef, useEffect } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { setToken, storeUser } from "@/lib/auth";
import { Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck, Smartphone, ArrowLeft, RefreshCw, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

const PENDING_OTP_KEY = "investa_pending_otp";

function getPendingOtp(): { email: string; ts: number } | null {
  try {
    const raw = localStorage.getItem(PENDING_OTP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > 60 * 60 * 1000) { localStorage.removeItem(PENDING_OTP_KEY); return null; }
    return parsed;
  } catch { return null; }
}

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
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [fieldTouched, setFieldTouched] = useState({ email: false, password: false });
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [pendingOtp, setPendingOtp] = useState<{ email: string; ts: number } | null>(() => getPendingOtp());
  const [quickResendLoading, setQuickResendLoading] = useState(false);
  const [quickResendDone, setQuickResendDone] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const isEmailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const validateFields = () => {
    const errs = { email: "", password: "" };
    if (!email.trim()) errs.email = "Email address is required";
    else if (!isEmailValid(email)) errs.email = "Enter a valid email address (e.g. you@example.com)";
    if (!password) errs.password = "Password is required";
    setFieldErrors(errs);
    return !errs.email && !errs.password;
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setResendDone(false);
    try {
      await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyEmail }),
      });
      setResendDone(true);
      setResendCooldown(60);
      const iv = setInterval(() => {
        setResendCooldown(c => { if (c <= 1) { clearInterval(iv); return 0; } return c - 1; });
      }, 1000);
    } catch {
      // silent — UI stays ready for retry
    } finally {
      setResendLoading(false);
    }
  };

  const handleQuickResendOtp = async (pendingEmail: string) => {
    if (quickResendLoading || quickResendDone) return;
    setQuickResendLoading(true);
    try {
      await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      setQuickResendDone(true);
      setTimeout(() => setQuickResendDone(false), 8000);
    } catch { /* silent */ } finally {
      setQuickResendLoading(false);
    }
  };

  // TOTP 2FA state
  const [totpStep, setTotpStep] = useState(false);
  const [totpCode, setTotpCode] = useState(["", "", "", "", "", ""]);
  const [tempToken, setTempToken] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const totpInputs = useRef<(HTMLInputElement | null)[]>([]);

  const navigateByRole = (role: string) => {
    if (role === "farmer") setLocation("/farmer");
    else if (role === "cooperative") setLocation("/cooperative/dashboard");
    else if (role === "agribusiness") setLocation("/agribusiness");
    else if (role === "admin") setLocation("/admin");
    else setLocation("/market");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldTouched({ email: true, password: true });
    if (!validateFields()) return;
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
        const oEmail = d.email ?? email;
        setVerifyEmail(oEmail);
        setNeedsVerify(true);
        localStorage.setItem(PENDING_OTP_KEY, JSON.stringify({ email: oEmail, ts: Date.now() }));
        setPendingOtp({ email: oEmail, ts: Date.now() });
        return;
      }
      if (d.totpRequired) {
        setTempToken(d.tempToken ?? "");
        setTotpStep(true);
        return;
      }
      if (r.status === 429) {
        const retryMs = d.retryAfterMs ?? d.retryAfter;
        if (retryMs) {
          const mins = Math.ceil(retryMs / 60000);
          setError(`Too many login attempts. Please wait ${mins} minute${mins !== 1 ? "s" : ""} before trying again.`);
        } else {
          setError("Too many login attempts. Please wait a few minutes before trying again.");
        }
        return;
      }
      if (!r.ok) {
        setError(d.error ?? "Invalid email or password.");
        return;
      }
      setToken(d.token);
      storeUser(d.user);
      navigateByRole(d.user?.role);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTotpChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...totpCode];
    next[i] = digit;
    setTotpCode(next);
    if (digit && i < 5) totpInputs.current[i + 1]?.focus();
  };

  const handleTotpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !totpCode[i] && i > 0) {
      totpInputs.current[i - 1]?.focus();
    }
  };

  const handleTotpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...totpCode];
    text.split("").forEach((d, i) => { next[i] = d; });
    setTotpCode(next);
    totpInputs.current[Math.min(text.length, 5)]?.focus();
  };

  // Auto-verify trusted device when TOTP screen appears — skip 2FA entirely if device token valid
  useEffect(() => {
    if (!totpStep || !email || !tempToken) return;
    const key = `investa_device_trust_${email.toLowerCase().trim()}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    try {
      const { deviceToken } = JSON.parse(stored);
      if (!deviceToken) return;
      fetch("/api/auth/totp/verify-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, deviceToken }),
      }).then(r => r.json()).then(d => {
        if (d.token && d.user) {
          setToken(d.token);
          storeUser(d.user);
          navigateByRole(d.user.role);
        } else {
          localStorage.removeItem(key);
        }
      }).catch(() => {});
    } catch {}
  }, [totpStep]);

  const handleTotpSubmit = async () => {
    const code = totpCode.join("");
    if (code.length !== 6) { setError("Enter the 6-digit code from your authenticator app"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/auth/totp/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, tempToken }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Invalid code");
      setToken(d.token);
      storeUser(d.user);
      // Store device trust token if user requested it
      if (trustDevice) {
        try {
          const tr = await fetch("/api/auth/totp/trust-device", {
            method: "POST",
            headers: { Authorization: `Bearer ${d.token}` },
          });
          const td = await tr.json();
          if (td.deviceToken) {
            const key = `investa_device_trust_${email.toLowerCase().trim()}`;
            localStorage.setItem(key, JSON.stringify({ deviceToken: td.deviceToken, until: td.until }));
          }
        } catch {} // non-critical — proceed regardless
      }
      navigateByRole(d.user?.role);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (needsVerify) {
    return (
      <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background flex flex-col items-center justify-center px-6">
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
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Mail size={16} /> Enter Verification Code
          </button>
          <div className="flex items-center justify-center gap-1.5">
            {resendDone ? (
              <p className="text-green-600 text-sm font-medium flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Code resent — check your inbox
              </p>
            ) : (
              <button
                onClick={handleResendOtp}
                disabled={resendLoading || resendCooldown > 0}
                className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:text-primary/80 transition-colors disabled:text-muted-foreground disabled:cursor-not-allowed"
              >
                {resendLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
            )}
          </div>
          <button onClick={() => { setNeedsVerify(false); localStorage.removeItem(PENDING_OTP_KEY); setPendingOtp(null); }} className="text-muted-foreground text-sm hover:text-foreground transition-colors">
            ← Back to sign in
          </button>
        </motion.div>
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
            {error && (
              <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive text-center">
                {error}
              </div>
            )}

            <form onSubmit={e => { e.preventDefault(); handleTotpSubmit(); }} className="space-y-5">
              <div className="flex gap-2 justify-center">
                {totpCode.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { totpInputs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleTotpChange(i, e.target.value)}
                    onKeyDown={e => handleTotpKeyDown(i, e)}
                    onPaste={handleTotpPaste}
                    className="w-11 h-14 text-center text-foreground font-bold text-xl bg-muted border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                ))}
              </div>

              {/* Trust this device — toggle */}
              <button
                type="button"
                onClick={() => setTrustDevice(v => !v)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                  trustDevice
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/40 hover:border-primary/30"
                }`}
              >
                {/* Toggle pill */}
                <div
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                    trustDevice ? "bg-primary" : "bg-border"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      trustDevice ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold leading-tight ${trustDevice ? "text-primary" : "text-foreground"}`}>
                    Remember this device for 30 days
                  </p>
                  <p className="text-muted-foreground text-[10px] mt-0.5 leading-tight">
                    Skip 2FA on your next sign-in from this device
                  </p>
                </div>
                {trustDevice && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={11} className="text-white" />
                  </div>
                )}
              </button>

              <button
                type="submit"
                disabled={loading || totpCode.join("").length !== 6}
                className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                {loading ? "Verifying…" : "Verify & Sign In"}
              </button>
            </form>
          </div>

          <button
            onClick={() => { setTotpStep(false); setTotpCode(["", "", "", "", "", ""]); setError(""); setTrustDevice(false); }}
            className="w-full text-muted-foreground text-sm flex items-center justify-center gap-1.5 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Back to sign in
          </button>

          <p className="text-center text-muted-foreground/60 text-xs">
            Open your authenticator app (Google Authenticator, Authy, etc.) to find the code for Investa Farm.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background flex flex-col" data-testid="login-page">
      <div className="h-1.5 bg-gradient-to-r from-primary to-green-400 w-full" />

      <div className="px-5 pt-4">
        <Link href="/">
          <button className="flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground transition-colors active:scale-95">
            <ArrowLeft size={15} /> Back to home
          </button>
        </Link>
      </div>

      <div className="pt-8 pb-8 px-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mx-auto shadow-lg shadow-primary/20 border border-border">
          <img src={logoSrc} alt="Investa Farm" className="w-12 h-12 object-contain" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to Investa Farm</p>
        </div>
      </div>

      <div className="flex-1 px-6">
        <div className="bg-card rounded-3xl border border-border p-6 space-y-4">

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
            <div data-testid="error-message" className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-foreground text-xs font-semibold uppercase tracking-wider">Email</label>
              <input
                id="login-email"
                data-testid="input-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (fieldTouched.email) {
                    const v = e.target.value;
                    setFieldErrors(fe => ({ ...fe, email: !v.trim() ? "Email address is required" : !isEmailValid(v) ? "Enter a valid email address (e.g. you@example.com)" : "" }));
                  }
                }}
                onBlur={() => {
                  setFieldTouched(ft => ({ ...ft, email: true }));
                  setFieldErrors(fe => ({ ...fe, email: !email.trim() ? "Email address is required" : !isEmailValid(email) ? "Enter a valid email address (e.g. you@example.com)" : "" }));
                }}
                placeholder="you@example.com"
                className={`w-full bg-muted border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 transition-all ${fieldErrors.email ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-border focus:border-primary focus:ring-primary/15"}`}
              />
              {fieldErrors.email && <p className="text-red-500 text-[11px] flex items-center gap-1">⚠ {fieldErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-foreground text-xs font-semibold uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  data-testid="input-password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (fieldTouched.password) setFieldErrors(fe => ({ ...fe, password: !e.target.value ? "Password is required" : "" }));
                  }}
                  onBlur={() => {
                    setFieldTouched(ft => ({ ...ft, password: true }));
                    setFieldErrors(fe => ({ ...fe, password: !password ? "Password is required" : "" }));
                  }}
                  placeholder="••••••••"
                  className={`w-full bg-muted border rounded-xl px-4 py-3 pr-12 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 transition-all ${fieldErrors.password ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-border focus:border-primary focus:ring-primary/15"}`}
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
              {fieldErrors.password && <p className="text-red-500 text-[11px] flex items-center gap-1">⚠ {fieldErrors.password}</p>}
            </div>

            <div className="text-right -mt-2">
              <Link href="/forgot-password" className="text-xs text-primary font-medium hover:underline">Forgot password?</Link>
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

        {/* Pending OTP banner — shown when user closed verify screen mid-flow */}
        {pendingOtp && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl px-4 py-3"
          >
            <p className="text-amber-800 text-xs font-semibold mb-1 flex items-center gap-1.5">
              <ShieldCheck size={13} /> Verification code pending for
            </p>
            <p className="text-amber-700 text-xs font-medium truncate mb-2">{pendingOtp.email}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setLocation(`/verify-otp?email=${encodeURIComponent(pendingOtp.email)}`)}
                className="flex-1 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <Mail size={12} /> Enter Code
              </button>
              {quickResendDone ? (
                <span className="flex-1 py-2 text-green-700 bg-green-50 border border-green-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={12} /> Sent!
                </span>
              ) : (
                <button
                  onClick={() => handleQuickResendOtp(pendingOtp.email)}
                  disabled={quickResendLoading}
                  className="flex-1 py-2 border border-amber-300 text-amber-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-60"
                >
                  {quickResendLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Resend
                </button>
              )}
              <button
                onClick={() => { localStorage.removeItem(PENDING_OTP_KEY); setPendingOtp(null); }}
                className="w-8 h-8 flex-shrink-0 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 hover:bg-amber-200 transition-colors"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}

        {/* Try Demo — collapsed by default; user must opt in */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDemo(v => !v)}
            className="w-full flex items-center justify-between bg-muted/60 border border-border rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground active:scale-[0.98] transition-all"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">🔑</span>
              Try a demo account
            </span>
            <span className={`text-xs transition-transform duration-200 ${showDemo ? "rotate-180" : ""}`}>▾</span>
          </button>

          <AnimatePresence>
            {showDemo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-2 pb-1">
                  <p className="text-muted-foreground text-[10px] text-center mb-2">
                    Tap a role to fill credentials — password is <strong className="text-foreground">password123</strong>
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: "Farmer", email: "john.farmer@investafarm.com", icon: "🌱" },
                      { label: "Investor", email: "david.investor@investafarm.com", icon: "📈" },
                      { label: "Demo Farmer", email: "demo.farmer@investafarm.com", icon: "👨‍🌾" },
                      { label: "Sales Agent", email: "demo.agent@investafarm.com", icon: "🤝" },
                      { label: "Cooperative", email: "demo.coop@investafarm.com", icon: "🏘️" },
                    ].map(({ label, email: demoEmail, icon }) => (
                      <button
                        key={demoEmail}
                        type="button"
                        onClick={() => { setEmail(demoEmail); setPassword("password123"); setShowDemo(false); }}
                        className="text-left bg-card border border-primary/20 rounded-xl px-3 py-2 active:scale-95 transition-all hover:border-primary/40 hover:bg-primary/5"
                      >
                        <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                          <span>{icon}</span>{label}
                        </p>
                        <p className="text-[9px] text-muted-foreground truncate mt-0.5">{demoEmail}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="pb-12" />
    </div>
  );
}
