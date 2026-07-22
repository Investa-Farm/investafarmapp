/**
 * WalletPinPad — shared 4-digit PIN number pad
 * Used by WalletPinGate (enter PIN) and WalletPinSetup (create/confirm PIN).
 */
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Loader2 } from "lucide-react";

interface WalletPinPadProps {
  value: string;
  onChange: (pin: string) => void;
  maxLength?: number;
  error?: string | null;
  title?: string;
  subtitle?: string;
  loading?: boolean;
}

export function WalletPinPad({
  value,
  onChange,
  maxLength = 4,
  error,
  title,
  subtitle,
  loading = false,
}: WalletPinPadProps) {
  const add = (d: string) => { if (value.length < maxLength && !loading) onChange(value + d); };
  const del = () => { if (!loading) onChange(value.slice(0, -1)); };

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      {title && (
        <p className="text-foreground font-bold text-lg text-center leading-snug">{title}</p>
      )}
      {subtitle && (
        <p className="text-muted-foreground text-sm text-center leading-snug max-w-[260px]">{subtitle}</p>
      )}

      {/* Animated dots */}
      <motion.div
        className="flex gap-5 my-1"
        animate={error ? { x: [0, -8, 8, -8, 8, 0] } : {}}
        transition={{ duration: 0.35 }}
      >
        {Array.from({ length: maxLength }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              scale: value.length === i + 1 ? [1, 1.35, 1] : 1,
              backgroundColor: i < value.length ? "#16a34a" : "#e5e7eb",
            }}
            transition={{ duration: 0.15 }}
            className="w-[18px] h-[18px] rounded-full border border-border"
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-red-500 text-sm font-semibold text-center"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Keypad */}
      {loading ? (
        <div className="flex items-center justify-center h-[208px]">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 w-full max-w-[288px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <motion.button
              key={d}
              whileTap={{ scale: 0.85 }}
              onClick={() => add(d)}
              className="h-14 rounded-2xl bg-muted text-foreground font-bold text-xl flex items-center justify-center border border-border active:bg-primary/10 transition-colors"
            >
              {d}
            </motion.button>
          ))}
          {/* empty */}
          <div />
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => add("0")}
            className="h-14 rounded-2xl bg-muted text-foreground font-bold text-xl flex items-center justify-center border border-border active:bg-primary/10 transition-colors"
          >
            0
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={del}
            className="h-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center border border-border active:bg-muted/70 transition-colors"
          >
            <Delete size={20} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
