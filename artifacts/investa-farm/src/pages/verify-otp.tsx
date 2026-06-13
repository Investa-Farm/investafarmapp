import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, PartyPopper, Mail, MessageCircle } from "lucide-react";
import { getToken, getStoredUser, storeUser, clearToken } from "@/lib/auth";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

export default function VerifyOtp() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const emailParam = params.get("email") ?? "";

  const token = getToken();
  const user = getStoredUser();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const canResend = countdown === 0;

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = digit;
    setCode(next);
    if (digit && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...code];
    text.split("").forEach((d, i) => { next[i] = d; });
    setCode(next);
    inputs.current[Math.min(text.length, 5)]?.focus();
  };

  const handleVerify = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) { setError("Enter the complete 6-digit code"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: fullCode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Verification failed");
      if (user) storeUser({ ...user, emailVerified: true } as typeof user & { emailVerified: boolean });
      setDone(true);
      setTimeout(() => {
        const role = user?.role;
        clearToken();
        if (role === "farmer") setLocation("/farmer-auth?registered=1");
        else if (role === "cooperative") setLocation("/cooperative-auth?registered=1");
        else setLocation("/login?registered=1");
      }, 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResending(true); setError(""); setCountdown(60);
    try {
      await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setError("New code sent! Check your inbox and spam folder.");
    } catch {
      setError("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-gradient-to-b from-[#0a2e10] via-[#0f3d1a] to-[#143d1a] flex flex-col items-center justify-center px-6 pb-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-6">
        <div className="text-center space-y-3">
          <img src={logoSrc} alt="Investa Farm" className="h-16 w-auto mx-auto" style={{ filter: "brightness(0) invert(1)" }} />

          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="success"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="relative">
                  <motion.div
                    className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 0.6, repeat: 2 }}
                  >
                    <PartyPopper size={36} className="text-green-400" />
                  </motion.div>
                  {["🟢","🟡","🟠","🔵","🟣"].map((dot, i) => (
                    <motion.span
                      key={i}
                      className="absolute text-sm"
                      style={{ top: "50%", left: "50%" }}
                      initial={{ x: 0, y: 0, opacity: 1 }}
                      animate={{
                        x: [0, (i % 2 === 0 ? 1 : -1) * (20 + i * 8)],
                        y: [0, -(15 + i * 10)],
                        opacity: [1, 0],
                      }}
                      transition={{ duration: 0.8, delay: i * 0.07 }}
                    >
                      {dot}
                    </motion.span>
                  ))}
                </div>

                <div>
                  <p className="text-white font-extrabold text-2xl">Registration Successful! 🎉</p>
                  <p className="text-green-400 font-semibold text-sm mt-1">Your email has been verified</p>
                  <p className="text-white/50 text-xs mt-2">Redirecting you to sign in…</p>
                </div>

                <motion.div
                  className="w-full bg-green-500/20 border border-green-400/30 rounded-2xl p-4 text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <p className="text-green-300 text-sm font-medium">Welcome to Investa Farm! 🌾</p>
                  <p className="text-white/60 text-xs mt-1">
                    You can now sign in and start {user?.role === "farmer" ? "raising capital for your farm" : user?.role === "investor" ? "investing in real farms" : "managing your network"}.
                  </p>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto border border-green-500/30">
                  <ShieldCheck size={28} className="text-green-400" />
                </div>
                <div className="mt-3">
                  <h1 className="text-2xl font-bold text-white">Verify Your Email</h1>
                  <p className="text-white/60 text-sm mt-1">
                    We sent a 6-digit code to<br />
                    <span className="text-green-400 font-medium">{emailParam || user?.email || "your email"}</span>
                  </p>
                  <p className="text-white/40 text-xs mt-1">Check your inbox and spam folder.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!done && (
          <>
            <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-6 space-y-5">
              {error && (
                <div className={`rounded-xl px-4 py-3 text-sm text-center ${error.includes("sent") || error.includes("Check") ? "bg-green-500/10 border border-green-500/20 text-green-300" : "bg-red-500/10 border border-red-500/20 text-red-300"}`}>
                  {error}
                </div>
              )}

              <div className="flex gap-2 justify-center">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    className="w-11 h-14 text-center text-white font-bold text-xl bg-white/8 border border-white/20 rounded-xl focus:outline-none focus:border-green-400/70 transition-colors"
                  />
                ))}
              </div>

              <button onClick={handleVerify} disabled={loading || code.join("").length !== 6}
                className="w-full bg-green-500 hover:bg-green-400 active:scale-95 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                {loading ? "Verifying…" : "Verify Email"}
              </button>

              <div className="flex items-center justify-center">
                <button
                  onClick={handleResend}
                  disabled={!canResend || resending}
                  className={`text-xs flex items-center gap-1.5 transition-colors ${canResend ? "text-green-400 hover:text-green-300" : "text-white/30 cursor-not-allowed"}`}
                >
                  <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
                  {canResend
                    ? resending ? "Sending…" : "Resend code"
                    : `Resend in ${countdown}s`
                  }
                </button>
              </div>
            </div>

            {/* Contact Support */}
            <div className="text-center space-y-2">
              <p className="text-white/40 text-xs">Having trouble receiving the code?</p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href="mailto:support@investafarm.co.ke"
                  className="flex items-center gap-1.5 text-green-400/80 text-xs font-medium hover:text-green-300 transition-colors"
                >
                  <Mail size={12} />
                  Email Support
                </a>
                <span className="text-white/20 text-xs">·</span>
                <a
                  href="https://wa.me/254700000000"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-green-400/80 text-xs font-medium hover:text-green-300 transition-colors"
                >
                  <MessageCircle size={12} />
                  WhatsApp
                </a>
              </div>
              <p className="text-white/25 text-[10px]">support@investafarm.co.ke</p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
