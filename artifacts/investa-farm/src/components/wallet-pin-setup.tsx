/**
 * WalletPinSetup — bottom-sheet for creating or resetting the wallet PIN.
 *
 * Flow (first time):
 *   create → confirm → saving → done
 * Flow (change):
 *   current PIN (or account password) → create → confirm → saving → done
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, CheckCircle2, Loader2 } from "lucide-react";
import { WalletPinPad } from "./wallet-pin-pad";
import { getToken } from "@/lib/auth";

const PIN_LEN = 6;
type SetupStep = "current" | "password" | "create" | "confirm" | "saving" | "done";

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
  const [step, setStep] = useState<SetupStep>(isFirstTime ? "create" : "current");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const token = getToken();

  useEffect(() => {
    if (open) reset();
  }, [open, isFirstTime]);

  function reset() {
    setStep(isFirstTime ? "create" : "current");
    setPin("");
    setConfirm("");
    setCurrentPin("");
    setAccountPassword("");
    setError(null);
  }

  async function savePin(newPin: string) {
    setStep("saving");
    try {
      const body: Record<string, string> = { pin: newPin };
      if (!isFirstTime && currentPin) body.currentPin = currentPin;
      if (!isFirstTime && accountPassword) body.currentPassword = accountPassword;
      const r = await fetch("/api/wallet/pin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "Could not save PIN. Please try again.");
        setStep(isFirstTime ? "create" : "current");
        setPin("");
        setConfirm("");
      } else {
        setStep("done");
        setTimeout(() => { reset(); onSuccess(); }, 1600);
      }
    } catch {
      setError("Network error — please try again.");
      setStep(isFirstTime ? "create" : "current");
      setPin("");
      setConfirm("");
    }
  }

  async function handleCurrent(v: string) {
    setCurrentPin(v);
    setError(null);
    if (v.length === PIN_LEN) setTimeout(() => { setStep("create"); setPin(""); }, 120);
  }

  async function handleCreate(v: string) {
    setPin(v);
    if (v.length === PIN_LEN) setTimeout(() => { setStep("confirm"); setConfirm(""); setError(null); }, 120);
  }

  async function handleConfirm(v: string) {
    setConfirm(v);
    setError(null);
    if (v.length === PIN_LEN) {
      if (v !== pin) {
        setError("PINs don't match — try again.");
        setConfirm("");
        setTimeout(() => { setStep("create"); setPin(""); }, 350);
        return;
      }
      await savePin(v);
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
              ) : step === "password" ? (
                <motion.div key="password" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <p className="text-foreground font-bold text-lg text-center">Confirm with account password</p>
                  <p className="text-muted-foreground text-sm text-center">Enter your Investa Farm password to set a new wallet PIN.</p>
                  <input
                    type="password"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    placeholder="Account password"
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background"
                  />
                  {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}
                  <button
                    type="button"
                    disabled={accountPassword.length < 8}
                    onClick={() => { setError(null); setStep("create"); setPin(""); }}
                    className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAccountPassword(""); setStep("current"); }}
                    className="w-full text-center text-muted-foreground text-sm"
                  >
                    Back to current PIN
                  </button>
                </motion.div>
              ) : (
                <motion.div key={step} initial={{ opacity: 0, x: step === "confirm" || step === "create" ? 20 : 0 }} animate={{ opacity: 1, x: 0 }}>
                  <WalletPinPad
                    value={step === "current" ? currentPin : step === "create" ? pin : confirm}
                    onChange={step === "current" ? handleCurrent : step === "create" ? handleCreate : handleConfirm}
                    error={error}
                    title={
                      step === "current" ? "Enter your current PIN" :
                      step === "create" ? "Create a 6-digit PIN" : "Confirm your PIN"
                    }
                    subtitle={
                      step === "current" ? "Required to change your wallet PIN." :
                      step === "create"
                        ? "Choose a PIN you'll remember. You'll use it to authorise every transaction."
                        : "Re-enter your PIN to confirm"
                    }
                  />
                  {step === "current" && (
                    <button
                      type="button"
                      onClick={() => { setCurrentPin(""); setStep("password"); setError(null); }}
                      className="w-full mt-5 text-center text-primary text-sm font-semibold"
                    >
                      Forgot PIN? Use account password →
                    </button>
                  )}
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
