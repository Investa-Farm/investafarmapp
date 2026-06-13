import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight } from "lucide-react";

export interface CoachStep {
  target: string;
  title: string;
  body: string;
  position?: "top" | "bottom" | "left" | "right";
}

interface Props {
  steps: CoachStep[];
  storageKey: string;
  onDone?: () => void;
}

export function CoachMark({ steps, storageKey, onDone }: Props) {
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const done = localStorage.getItem(storageKey);
    if (!done) {
      timerRef.current = setTimeout(() => setActive(true), 800);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [storageKey]);

  useEffect(() => {
    if (!active) return;
    const el = document.querySelector(steps[idx]?.target ?? "");
    if (el) setRect(el.getBoundingClientRect());
  }, [active, idx, steps]);

  const dismiss = () => {
    localStorage.setItem(storageKey, "done");
    setActive(false);
    onDone?.();
  };

  const next = () => {
    if (idx < steps.length - 1) {
      setIdx(i => i + 1);
    } else {
      dismiss();
    }
  };

  if (!active || !rect) return null;

  const step = steps[idx]!;
  const pos = step.position ?? "top";

  const spotPad = 10;
  const spotLeft  = rect.left   - spotPad;
  const spotTop   = rect.top    - spotPad;
  const spotW     = rect.width  + spotPad * 2;
  const spotH     = rect.height + spotPad * 2;

  const tooltipStyle: React.CSSProperties = {};
  if (pos === "top")    { tooltipStyle.bottom = window.innerHeight - spotTop + 8;  tooltipStyle.left = Math.max(12, spotLeft); }
  if (pos === "bottom") { tooltipStyle.top    = spotTop + spotH + 8;               tooltipStyle.left = Math.max(12, spotLeft); }
  if (pos === "left")   { tooltipStyle.right  = window.innerWidth - spotLeft + 8;  tooltipStyle.top  = spotTop; }
  if (pos === "right")  { tooltipStyle.left   = spotLeft + spotW + 8;              tooltipStyle.top  = spotTop; }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="coachmark"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] pointer-events-none"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          {/* Spotlight cutout */}
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="cm-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={spotLeft} y={spotTop} width={spotW} height={spotH}
                  rx={10} fill="black"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#cm-mask)" />
          </svg>

          {/* Highlight border */}
          <div
            className="absolute rounded-xl"
            style={{
              left: spotLeft, top: spotTop, width: spotW, height: spotH,
              border: "2px solid rgba(22,163,74,0.65)",
              boxShadow: "0 0 12px rgba(22,163,74,0.2)",
            }}
          />

          {/* Tooltip */}
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.92, y: pos === "bottom" ? -6 : 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute pointer-events-auto max-w-[260px] bg-white rounded-2xl shadow-2xl p-4"
            style={tooltipStyle}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-foreground font-bold text-sm leading-snug">{step.title}</p>
              <button onClick={dismiss} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
                <X size={13} />
              </button>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed mb-3">{step.body}</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-green-600" : "w-1.5 bg-gray-200"}`} />
                ))}
              </div>
              <button
                onClick={next}
                className="flex items-center gap-1 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
              >
                {idx < steps.length - 1 ? "Next" : "Got it"}
                {idx < steps.length - 1 && <ChevronRight size={11} />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
