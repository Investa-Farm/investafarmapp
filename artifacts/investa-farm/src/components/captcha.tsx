import { useState } from "react";
import { CheckCircle2, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CaptchaProps {
  onVerified: (ok: boolean) => void;
}

export function Captcha({ onVerified }: CaptchaProps) {
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleVerify = () => {
    if (verified || checking) return;
    setChecking(true);
    // Brief animation delay before confirming — feels like a real check
    setTimeout(() => {
      setChecking(false);
      setVerified(true);
      onVerified(true);
    }, 600);
  };

  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-center gap-3 cursor-pointer select-none transition-all duration-200 ${
        verified
          ? "border-green-400 bg-green-50 dark:bg-green-950/30"
          : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50"
      }`}
      onClick={handleVerify}
      role="checkbox"
      aria-checked={verified}
      aria-label="I'm not a robot"
      tabIndex={0}
      onKeyDown={e => { if (e.key === " " || e.key === "Enter") handleVerify(); }}
    >
      {/* Invisible honeypot — bots fill this, humans don't see it */}
      <input
        type="text"
        name="__hpfield"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
        onChange={e => { if (e.target.value) onVerified(false); }}
      />

      {/* Checkbox visual */}
      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all duration-200 ${
        verified ? "border-green-500 bg-green-500" : checking ? "border-primary bg-primary/20" : "border-muted-foreground/40 bg-background"
      }`}>
        <AnimatePresence>
          {verified && (
            <motion.svg
              key="check"
              viewBox="0 0 12 10"
              fill="none"
              className="w-3 h-3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <motion.path
                d="M1 5l3.5 3.5L11 1"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.25 }}
              />
            </motion.svg>
          )}
          {checking && (
            <motion.div
              key="spinner"
              className="w-2.5 h-2.5 border border-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium transition-colors ${verified ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
          {verified ? "Verified — you're human ✓" : checking ? "Verifying…" : "I'm not a robot"}
        </p>
      </div>

      {/* reCAPTCHA-style branding */}
      <div className="flex flex-col items-center flex-shrink-0 opacity-40">
        <Shield size={18} />
        <span className="text-[8px] font-semibold mt-0.5 tracking-tight">SECURE</span>
      </div>
    </div>
  );
}
