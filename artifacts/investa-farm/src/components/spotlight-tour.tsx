import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

export type SpotlightStep = {
  selector: string;
  title: string;
  body: string;
  emoji?: string;
  placement?: "top" | "bottom" | "auto";
};

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function useTargetRect(selector: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!selector) { setRect(null); return; }

    let raf = 0;
    const measure = () => {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
    };

    measure();
    raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const t = setTimeout(measure, 250);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearTimeout(t);
    };
  }, [selector]);

  return rect;
}

interface Props {
  steps: SpotlightStep[];
  storageKey: string;
  active: boolean;
  onFinish?: () => void;
  startDelayMs?: number;
}

export function SpotlightTour({ steps, storageKey, active, onFinish, startDelayMs = 900 }: Props) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (localStorage.getItem(storageKey)) return;
    const t = setTimeout(() => { setIdx(0); setOpen(true); }, startDelayMs);
    return () => clearTimeout(t);
  }, [active, storageKey, startDelayMs]);

  const step = steps[idx];
  const rect = useTargetRect(open ? step?.selector ?? null : null);

  const finish = useCallback(() => {
    localStorage.setItem(storageKey, "done");
    setOpen(false);
    onFinish?.();
  }, [storageKey, onFinish]);

  const next = () => {
    if (idx < steps.length - 1) setIdx(i => i + 1);
    else finish();
  };
  const back = () => { if (idx > 0) setIdx(i => i - 1); };

  if (!open || !step) return null;

  const PAD = 8;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 430;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;

  const hasTarget = !!rect;
  const spotTop = hasTarget ? rect!.top - PAD : viewportH / 2 - 40;
  const spotLeft = hasTarget ? rect!.left - PAD : viewportW / 2 - 100;
  const spotW = hasTarget ? rect!.width + PAD * 2 : 200;
  const spotH = hasTarget ? rect!.height + PAD * 2 : 80;

  const preferBelow = hasTarget ? spotTop + spotH < viewportH - 220 : true;
  const cardTop = preferBelow ? Math.min(spotTop + spotH + 14, viewportH - 210) : Math.max(spotTop - 210, 70);

  let cardLeft = hasTarget ? spotLeft + spotW / 2 - 155 : viewportW / 2 - 155;
  cardLeft = Math.min(Math.max(cardLeft, 12), viewportW - 322);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9997 }}>
          <svg
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <defs>
              <mask id="spotlight-mask-hole">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <motion.rect
                  animate={{ x: spotLeft, y: spotTop, width: spotW, height: spotH, rx: 16 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  fill="black"
                />
              </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.68)" mask="url(#spotlight-mask-hole)" onClick={finish} style={{ pointerEvents: "all" }} />
          </svg>

          {hasTarget && (
            <motion.div
              animate={{ x: spotLeft, y: spotTop, width: spotW, height: spotH }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                position: "absolute",
                borderRadius: 16,
                border: "2px solid #4ade80",
                boxShadow: "0 0 0 4px rgba(74,222,128,0.25), 0 0 24px rgba(74,222,128,0.4)",
                pointerEvents: "none",
              }}
            />
          )}

          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, top: cardTop, left: cardLeft }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            style={{
              position: "absolute",
              width: 310,
              background: "#ffffff",
              borderRadius: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              overflow: "hidden",
              pointerEvents: "all",
            }}
          >
            <div style={{ height: 4, background: "linear-gradient(90deg, #16a34a, #4ade80, #15803d)" }} />
            <div style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {step.emoji && <span style={{ fontSize: 18 }}>{step.emoji}</span>}
                  <h3 style={{ fontWeight: 900, fontSize: 15, color: "#111827", fontFamily: "Space Grotesk, sans-serif" }}>{step.title}</h3>
                </div>
                <button onClick={finish} style={{ width: 24, height: 24, borderRadius: "50%", background: "#f3f4f6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <X size={11} color="#9ca3af" />
                </button>
              </div>
              <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>{step.body}</p>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {steps.map((_, i) => (
                    <div key={i} style={{ width: i === idx ? 16 : 5, height: 5, borderRadius: 100, background: i === idx ? "#16a34a" : "#e5e7eb", transition: "all 0.2s" }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {idx > 0 && (
                    <button onClick={back} style={{ width: 32, height: 32, borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ChevronLeft size={14} color="#6b7280" />
                    </button>
                  )}
                  <button
                    onClick={next}
                    style={{
                      height: 32, padding: "0 14px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", color: "#fff",
                      fontWeight: 700, fontSize: 12.5, display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    {idx < steps.length - 1 ? <>Next <ChevronRight size={13} /></> : "Got it"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
