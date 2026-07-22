import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles, Loader2, ChevronDown } from "lucide-react";

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

  // AI ask state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) return;
    if (localStorage.getItem(storageKey)) return;
    const t = setTimeout(() => { setIdx(0); setOpen(true); }, startDelayMs);
    return () => clearTimeout(t);
  }, [active, storageKey, startDelayMs]);

  // Reset AI state when step changes
  useEffect(() => {
    setAiOpen(false);
    setAiQuestion("");
    setAiAnswer(null);
    setAiLoading(false);
  }, [idx]);

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

  async function askAi() {
    if (!aiQuestion.trim() || aiLoading) return;
    setAiLoading(true);
    setAiAnswer(null);
    const token = localStorage.getItem("auth_token") ?? localStorage.getItem("token") ?? "";
    const context = `The user is viewing the "${step?.title}" section of Investa Farm. Description: "${step?.body}". User's question: "${aiQuestion}"`;
    try {
      const r = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ context }),
      });
      const d = await r.json() as { explanation?: string };
      setAiAnswer(d.explanation ?? "No answer available.");
    } catch {
      setAiAnswer("AI is temporarily unavailable. Please try again shortly.");
    } finally {
      setAiLoading(false);
    }
  }

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
  const cardTop = preferBelow ? Math.min(spotTop + spotH + 14, viewportH - 280) : Math.max(spotTop - 280, 70);

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
              background: "var(--card, #ffffff)",
              color: "var(--card-foreground)",
              borderRadius: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
              overflow: "hidden",
              pointerEvents: "all",
            }}
          >
            {/* Progress bar */}
            <div style={{ height: 4, background: "linear-gradient(90deg, #16a34a, #4ade80, #15803d)" }} />

            <div style={{ padding: "16px 18px 14px" }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {step.emoji && <span style={{ fontSize: 18 }}>{step.emoji}</span>}
                  <h3 style={{ fontWeight: 900, fontSize: 15, color: "var(--foreground)", fontFamily: "Space Grotesk, sans-serif", margin: 0 }}>{step.title}</h3>
                </div>
                <button onClick={finish} style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "var(--muted)", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <X size={11} color="var(--muted-foreground)" />
                </button>
              </div>

              {/* Body */}
              <p style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{step.body}</p>

              {/* AI Ask panel */}
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={() => {
                    setAiOpen(o => !o);
                    if (!aiOpen) setTimeout(() => inputRef.current?.focus(), 120);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    color: "#16a34a", fontSize: 12, fontWeight: 700,
                  }}
                >
                  <Sparkles size={12} />
                  Ask AI ✨
                  <ChevronDown size={11} style={{ transition: "transform 0.2s", transform: aiOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>

                <AnimatePresence>
                  {aiOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: "hidden", marginTop: 8 }}
                    >
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          ref={inputRef}
                          type="text"
                          value={aiQuestion}
                          onChange={e => setAiQuestion(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") askAi(); }}
                          placeholder="Ask anything about this…"
                          style={{
                            flex: 1, padding: "7px 10px", borderRadius: 10,
                            border: "1.5px solid var(--border)", background: "var(--background)",
                            color: "var(--foreground)", fontSize: 12, outline: "none",
                          }}
                        />
                        <button onClick={askAi} disabled={!aiQuestion.trim() || aiLoading}
                          style={{
                            padding: "7px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                            background: "#16a34a", color: "#fff", fontSize: 11, fontWeight: 700,
                            display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                            opacity: !aiQuestion.trim() || aiLoading ? 0.5 : 1,
                          }}
                        >
                          {aiLoading ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : "Ask"}
                        </button>
                      </div>

                      {aiAnswer && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          style={{
                            marginTop: 8, padding: "8px 10px",
                            background: "var(--muted)", borderRadius: 10,
                            fontSize: 12, color: "var(--foreground)", lineHeight: 1.5,
                            borderLeft: "3px solid #16a34a",
                          }}
                        >
                          {aiAnswer}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Nav row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {steps.map((_, i) => (
                    <div key={i} style={{
                      width: i === idx ? 16 : 5, height: 5, borderRadius: 100,
                      background: i === idx ? "#16a34a" : "var(--border)",
                      transition: "all 0.2s",
                    }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {idx > 0 && (
                    <button onClick={back} style={{
                      width: 32, height: 32, borderRadius: 10,
                      border: "1.5px solid var(--border)", background: "var(--muted)",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <ChevronLeft size={14} color="var(--muted-foreground)" />
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
