import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Smartphone, Key, Copy, CheckCircle2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { getToken } from "@/lib/auth";
import { useMutation } from "@tanstack/react-query";

export default function FarmerTotp() {
  const [, setLocation] = useLocation();
  const token = getToken();

  const [step, setStep] = useState<"intro" | "setup" | "verify" | "done">("intro");
  const [secret, setSecret] = useState<string>("");
  const [qrUrl, setQrUrl] = useState<string>("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const setupMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/auth/totp/setup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error ?? "Failed to set up 2FA"); }
      return r.json() as Promise<{ secret: string; qrCode: string }>;
    },
    onSuccess: (data) => {
      setSecret(data.secret);
      setQrUrl(data.qrCode);
      setStep("setup");
    },
    onError: (e: Error) => setError(e.message),
  });

  const verifyMutation = useMutation({
    mutationFn: async (otp: string) => {
      const r = await fetch("/api/auth/totp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: otp }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error ?? "Invalid code — please try again"); }
      return r.json();
    },
    onSuccess: () => { setStep("done"); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="app-shell pb-20 page-enter">
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setLocation("/farmer/profile")}
            className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-white/70 text-xs font-medium">Account Security</p>
            <h1 className="text-white text-xl font-bold">Two-Factor Auth</h1>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {step === "intro" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-5 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck size={32} className="text-primary" />
              </div>
              <div>
                <h2 className="text-foreground font-extrabold text-lg">Secure Your Account</h2>
                <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                  Two-factor authentication adds an extra layer of security. You'll need a code from your authenticator app every time you sign in.
                </p>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <p className="text-foreground font-semibold text-sm">How it works</p>
              {[
                { icon: <Smartphone size={14} className="text-primary" />, title: "Download an authenticator app", desc: "Google Authenticator, Authy, or any TOTP app" },
                { icon: <Key size={14} className="text-primary" />, title: "Scan the QR code", desc: "Link your account to the app in seconds" },
                { icon: <ShieldCheck size={14} className="text-primary" />, title: "Enter verification codes", desc: "Use the 6-digit rotating code when signing in" },
              ].map(({ icon, title, desc }, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">{icon}</div>
                  <div>
                    <p className="text-foreground text-xs font-semibold">{title}</p>
                    <p className="text-muted-foreground text-[10px]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-xs">{error}</p>
              </div>
            )}

            <button onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
              {setupMutation.isPending
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Setting up…</>
                : <><ShieldCheck size={16} />Enable 2FA</>}
            </button>
          </motion.div>
        )}

        {step === "setup" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-foreground font-semibold text-sm mb-3">1. Scan with your authenticator app</p>
              {qrUrl ? (
                <div className="flex justify-center mb-3">
                  <img src={qrUrl} alt="2FA QR Code" className="w-44 h-44 rounded-xl border border-border" />
                </div>
              ) : (
                <div className="w-44 h-44 rounded-xl border border-border bg-muted/30 flex items-center justify-center mx-auto mb-3">
                  <p className="text-muted-foreground text-xs text-center px-4">QR code unavailable — use the secret key below</p>
                </div>
              )}
              <p className="text-muted-foreground text-[10px] text-center">Can't scan? Enter the secret key manually</p>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-foreground font-semibold text-sm mb-2">2. Or enter the secret key manually</p>
              <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5 border border-border">
                <code className={`flex-1 text-xs font-mono text-foreground tracking-widest ${showSecret ? "" : "blur-sm select-none"}`}>
                  {secret || "XXXX XXXX XXXX XXXX"}
                </code>
                <button onClick={() => setShowSecret(s => !s)} className="text-muted-foreground active:scale-90 transition-transform flex-shrink-0">
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={copySecret} className="text-muted-foreground active:scale-90 transition-transform flex-shrink-0">
                  {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <button onClick={() => setStep("verify")}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-sm active:scale-[0.98] transition-transform">
              I've scanned it → Enter Code
            </button>
          </motion.div>
        )}

        {step === "verify" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-5 text-center">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Key size={24} className="text-primary" />
              </div>
              <h2 className="text-foreground font-bold text-base mb-1">Enter Verification Code</h2>
              <p className="text-muted-foreground text-xs">Enter the 6-digit code from your authenticator app to confirm setup</p>
            </div>

            <div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setError(null); }}
                placeholder="000000"
                className="w-full text-center text-2xl font-bold tracking-[0.5em] bg-muted/50 border border-border rounded-2xl px-4 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-xs">{error}</p>
              </div>
            )}

            <button onClick={() => verifyMutation.mutate(code)}
              disabled={code.length !== 6 || verifyMutation.isPending}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
              {verifyMutation.isPending
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Verifying…</>
                : <><ShieldCheck size={16} />Verify & Enable</>}
            </button>

            <button onClick={() => setStep("setup")} className="w-full text-center text-muted-foreground text-sm py-2">
              ← Back to QR code
            </button>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="space-y-4 text-center">
            <div className="bg-card rounded-2xl border border-border p-8 flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-green-100 border-4 border-green-300 flex items-center justify-center">
                <CheckCircle2 size={40} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-foreground font-extrabold text-xl mb-2">2FA Enabled!</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your account is now protected. You'll need to enter a code from your authenticator app each time you sign in.
                </p>
              </div>
              <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
                <p className="text-amber-800 text-xs font-bold mb-1">⚠️ Keep your recovery codes safe</p>
                <p className="text-amber-700 text-[10px] leading-relaxed">Save your secret key in a secure place. If you lose access to your authenticator app, you'll need it to recover your account.</p>
              </div>
            </div>
            <button onClick={() => setLocation("/farmer/profile")}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-sm active:scale-[0.98] transition-transform">
              Back to Profile
            </button>
          </motion.div>
        )}
      </div>

      <BottomNav role="farmer" />
    </div>
  );
}
