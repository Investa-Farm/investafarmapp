/**
 * Global center-screen success popup — replaces top-corner toasts for all
 * transaction confirmations (deposits, investments, payouts, withdrawals).
 * Usage: showCenterSuccess({ title, subtitle, emoji })
 * Mount <CenterSuccessHost /> once near the root of the app (App.tsx).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export interface CenterSuccessOptions {
  title: string;
  subtitle?: string;
  emoji?: string;
  durationMs?: number;
}

type Listener = (opts: CenterSuccessOptions) => void;
let listener: Listener | null = null;

export function showCenterSuccess(opts: CenterSuccessOptions) {
  listener?.(opts);
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([30, 10, 20]);
}

export function CenterSuccessHost() {
  const [opts, setOpts] = useState<CenterSuccessOptions | null>(null);

  useEffect(() => {
    listener = (o) => setOpts(o);
    return () => { listener = null; };
  }, []);

  useEffect(() => {
    if (!opts) return undefined;
    const t = setTimeout(() => setOpts(null), opts.durationMs ?? 2600);
    return () => clearTimeout(t);
  }, [opts]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {opts && (
        <motion.div
          key="center-success"
          className="fixed inset-0 z-[300] flex items-center justify-center px-6 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpts(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-white rounded-3xl shadow-2xl px-6 py-8 max-w-[320px] w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 260, delay: 0.1 }}
              className="w-16 h-16 mx-auto rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mb-4"
            >
              <CheckCircle2 size={34} className="text-green-600" />
            </motion.div>
            {opts.emoji && <div className="text-3xl mb-1">{opts.emoji}</div>}
            <p className="text-foreground font-black text-lg leading-tight">{opts.title}</p>
            {opts.subtitle && <p className="text-muted-foreground text-sm mt-1.5">{opts.subtitle}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
