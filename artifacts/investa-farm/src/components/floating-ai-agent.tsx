/**
 * FloatingAiAgent — roaming automation bubble
 *
 * Instead of a static "AI Agent" card pinned in one place, this widget
 * randomly appears at different spots on screen every so often, inviting
 * the investor to let the agent automate investing based on rules they set
 * (budget, risk, months) via AiAgentModal. Tapping it opens the same
 * conversational automation flow as before.
 */
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Zap } from "lucide-react";
import { getStoredUser } from "@/lib/auth";
import { AiAgentModal } from "@/components/ai-agent-modal";

// Safe-zone anchor points (percent-based) that avoid the top header and the
// bottom nav bar on mobile, roughly spread across the viewport.
const SPOTS: { x: number; y: number }[] = [
  { x: 8, y: 18 },
  { x: 78, y: 16 },
  { x: 10, y: 68 },
  { x: 74, y: 62 },
  { x: 50, y: 12 },
  { x: 18, y: 42 },
  { x: 72, y: 38 },
];

const PROMPTS = [
  "Let me automate your investing 🤖",
  "Tell me your budget — I'll do the rest",
  "Want hands-free investing? Tap me",
  "I can auto-invest based on your rules",
];

const APPEAR_EVERY_MS = 16000;
const VISIBLE_FOR_MS = 9000;

export function FloatingAiAgent() {
  const [agentOpen, setAgentOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [spot, setSpot] = useState(SPOTS[0]);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const user = getStoredUser();
  const isInvestor = user?.role === "investor";

  useEffect(() => {
    if (!isInvestor) return undefined;

    const pickAndShow = () => {
      const nextSpot = SPOTS[Math.floor(Math.random() * SPOTS.length)];
      const nextPrompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
      setSpot(nextSpot);
      setPrompt(nextPrompt);
      setDismissed(false);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), VISIBLE_FOR_MS);
    };

    const initial = setTimeout(pickAndShow, 4000);
    const interval = setInterval(pickAndShow, APPEAR_EVERY_MS);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isInvestor]);

  if (!isInvestor) return null;

  const showBubble = visible && !dismissed && !agentOpen;

  return (
    <>
      <AnimatePresence>
        {showBubble && (
          <motion.div
            key={`${spot.x}-${spot.y}`}
            className="fixed z-[55] flex flex-col items-center gap-1"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", damping: 18, stiffness: 260 }}
          >
            <div className="relative">
              <button
                onClick={() => { setAgentOpen(true); setVisible(false); }}
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-transform"
                style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #1d4ed8 60%, #6d28d9 100%)" }}
                aria-label="Open AI investing agent"
              >
                <Bot size={22} className="text-white" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                  <Zap size={9} className="text-amber-900" />
                </span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDismissed(true); setVisible(false); }}
                className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center shadow-sm"
                aria-label="Dismiss"
              >
                <X size={10} className="text-muted-foreground" />
              </button>
            </div>
            <button
              onClick={() => { setAgentOpen(true); setVisible(false); }}
              className="max-w-[150px] bg-background/95 backdrop-blur border border-border shadow-lg rounded-xl px-2.5 py-1.5 text-center"
            >
              <p className="text-[10px] font-semibold text-foreground leading-tight">{prompt}</p>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AiAgentModal open={agentOpen} onClose={() => setAgentOpen(false)} />
    </>
  );
}
