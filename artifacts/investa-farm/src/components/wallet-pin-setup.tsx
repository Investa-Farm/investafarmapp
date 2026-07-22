/**
 * WalletPinSetup — bottom-sheet for creating or resetting the wallet PIN.
 *
 * Flow:
 *   1. "create"  — user enters a 4-digit PIN
 *   2. "confirm" — user re-enters for confirmation
 *   3. "saving"  — spinner while calling POST /api/wallet/pin/setup
 *   4. "done"    — success tick; fires onSuccess() after a short delay
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, CheckCircle2, Loader2 } from "lucide-react";
import { WalletPinPad } from "./wallet-pin-pad";
import { getToken } from "@/lib/auth";

type SetupStep = "create" | "confirm" | "saving" | "done";

interface WalletPinSetupProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** True when the user has never set a PIN before */
  isFirstTime?: boolean;
}

export function WalletPinSetup({
  open,
  onClose,
  onSuccess,
  isFirstTime = false,
}: WalletPinSetupProps) {
  const [step, setStep] = useState<SetupStep>("create");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const token = getToken();

  useEffect(() => {
    if (open) reset();
  }, [open]);

  function reset() { setStep("create"); setPin(""); setConfirm(""); setError(null); }

  async function handleCreate(v: string) {
    setPin(v);
    if (v.length === 4) setTimeout(() => { setStep("confirm"); setConfirm(""); setError(null); }, 120);
  }

  async function handleConfirm(v: string) {
    setConfirm(v);
    setError(null);
    if (v.length === 4) {
      if (v !== pin) {
        setError("PINs don't match — try again.");
        setConfirm("");
        setTimeout(() => { setStep("create"); setPin(""); }, 350);
        return;
      }
      setStep("saving");
      try {
        const r = await fetch("/api/wallet/pin/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pin: v }),
        });
        const d = await r.json();
        if (!r.ok) {
          setError(d.error ?? "Could not save PIN. Please try again.");
          setStep("create"); setPin(""); setConfirm("");
        } else {
          setStep("done");
          setTimeout(() => { reset(); onSuccess(); }, 1600);
        }
      } catch {
        setError("Network error — please try again.");
        setStep("create"); setPin(""); setConfirm("");
      }
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget && step !== "saving") { reset(); onClose(); } }}
        >
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="w-full max-w-[430px] bg-background rounded-t-3xl px-6 pt-6 pb-10 border-t-4 border-primary"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield size={14} className="text-primary" />
                </div>
                <h3 className="text-foreground font-bold text-base">
                  {isFirstTime ? "Set Up Wallet PIN" : "Change Wallet PIN"}
                </h3>
              </div>
              {step !== "saving" && step !== "done" && (
                <button
                  onClick={() => { reset(); onClose(); }}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Step content */}
            <AnimatePresence mode="wait">
              {step === "done" ? (
                <motion.div
                  key="done"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-3 py-8"
                >
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 size={32} className="text-green-500" />
                  </div>
                  <p className="text-foreground font-bold text-xl">PIN Set! 🔐</p>
                  <p className="text-muted-foreground text-sm text-center">
                    Your wallet is now protected. You'll enter this PIN before every transaction.
                  </p>
                </motion.div>
              ) : step === "saving" ? (
                <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-3 py-12"
                >
                  <Loader2 size={32} className="animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Saving your PIN…</p>
                </motion.div>
              ) : (
                <motion.div key={step} initial={{ opacity: 0, x: step === "confirm" ? 20 : 0 }} animate={{ opacity: 1, x: 0 }}>
                  <WalletPinPad
                    value={step === "create" ? pin : confirm}
                    onChange={step === "create" ? handleCreate : handleConfirm}
                    error={error}
                    title={step === "create" ? "Create a 4-digit PIN" : "Confirm your PIN"}
                    subtitle={
                      step === "create"
                        ? "Choose a PIN you'll remember. You'll use it to authorise every transaction."
                        : "Re-enter your PIN to confirm"
                    }
                  />
                  {step === "create" && (
                    <p className="text-muted-foreground text-[11px] text-center mt-5">
                      🔒 Your PIN is hashed with bcrypt and never stored in plain text
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
