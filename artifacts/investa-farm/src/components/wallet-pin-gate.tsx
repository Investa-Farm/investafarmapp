/**
 * WalletPinGate — bottom-sheet that verifies the user's 4-digit wallet PIN
 * before allowing a transaction to proceed.
 *
 * Usage:
 *   <WalletPinGate
 *     open={pinGateOpen}
 *     onClose={() => setPinGateOpen(false)}
 *     onSuccess={() => { setPinGateOpen(false); doTransaction(); }}
 *     onForgotPin={() => { setPinGateOpen(false); setPinSetupOpen(true); }}
 *   />
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock } from "lucide-react";
import { WalletPinPad } from "./wallet-pin-pad";
import { getToken } from "@/lib/auth";

interface WalletPinGateProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onForgotPin: () => void;
  title?: string;
}

export function WalletPinGate({
  open,
  onClose,
  onSuccess,
  onForgotPin,
  title = "Enter Wallet PIN",
}: WalletPinGateProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const token = getToken();

  // Reset state when sheet opens
  useEffect(() => {
    if (open) { setPin(""); setError(null); setLoading(false); }
  }, [open]);

  async function handlePinChange(newPin: string) {
    setPin(newPin);
    setError(null);
    if (newPin.length === 4) {
      setLoading(true);
      try {
        const r = await fetch("/api/wallet/pin/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pin: newPin }),
        });
        const d = await r.json();
        if (!r.ok) {
          setError(d.error ?? "Incorrect PIN. Try again.");
          setPin("");
        } else {
          setPin("");
          setError(null);
          onSuccess();
        }
      } catch {
        setError("Network error. Please try again.");
        setPin("");
      } finally {
        setLoading(false);
      }
    }
  }

  function handleClose() {
    setPin(""); setError(null);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget && !loading) handleClose(); }}
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
                  <Lock size={14} className="text-primary" />
                </div>
                <h3 className="text-foreground font-bold text-base">{title}</h3>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                disabled={loading}
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>

            <WalletPinPad
              value={pin}
              onChange={handlePinChange}
              error={error}
              loading={loading}
              subtitle="Enter your 4-digit wallet PIN to authorise this transaction"
            />

            <button
              onClick={() => { setPin(""); setError(null); onForgotPin(); }}
              className="w-full mt-5 text-center text-primary text-sm font-semibold active:opacity-60 transition-opacity"
            >
              Forgot PIN? Reset it →
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
