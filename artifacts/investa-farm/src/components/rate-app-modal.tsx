import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, MessageSquare, CheckCircle2 } from "lucide-react";
import { getToken, getStoredUser } from "@/lib/auth";

const STORAGE_KEY = "investa_rate_app";
const MIN_DAYS_BETWEEN = 21;
const MAX_SHOWS = 3;
const TRIGGER_CHANCE = 0.18;

interface RateState {
  count: number;
  lastShown: number;
  lastRated: number;
}

function getRateState(): RateState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as RateState;
  } catch { return { count: 0, lastShown: 0, lastRated: 0 }; }
}

function saveRateState(s: Partial<RateState>) {
  const cur = getRateState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...s }));
}

function shouldShow(): boolean {
  // Only prompt after meaningful engagement — first investment OR dividend received
  const hasInvested = !!localStorage.getItem("investa_first_investment");
  const hasReceivedDividend = !!localStorage.getItem("investa_received_dividend");
  if (!hasInvested && !hasReceivedDividend) return false;

  const s = getRateState();
  if ((s.count ?? 0) >= MAX_SHOWS) return false;
  if (s.lastRated && Date.now() - s.lastRated < MIN_DAYS_BETWEEN * 86_400_000 * 3) return false;
  if (s.lastShown && Date.now() - s.lastShown < MIN_DAYS_BETWEEN * 86_400_000) return false;
  return Math.random() < TRIGGER_CHANCE;
}

export function useRateAppTrigger() {
  const [open, setOpen] = useState(false);

  const maybeTrigger = useCallback((context?: string) => {
    const user = getStoredUser();
    if (!user) return;
    if (!shouldShow()) return;
    setTimeout(() => {
      setOpen(true);
      saveRateState({ lastShown: Date.now(), count: (getRateState().count ?? 0) + 1 });
      if (context) sessionStorage.setItem("investa_rate_context", context);
    }, 2500 + Math.random() * 3000);
  }, []);

  return { open, setOpen, maybeTrigger };
}

const PROMPTS = [
  "Enjoying Investa Farm?",
  "How's your experience so far?",
  "Loving the platform?",
  "Rate your experience!",
];

const STARS_LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"];

export function RateAppModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState("");
  const [step, setStep] = useState<"rate" | "review" | "done">("rate");
  const [loading, setLoading] = useState(false);
  const prompt = PROMPTS[Math.floor(Date.now() / 86400000) % PROMPTS.length];

  useEffect(() => {
    if (open) { setRating(0); setHover(0); setReview(""); setStep("rate"); }
  }, [open]);

  const handleStarClick = (s: number) => {
    setRating(s);
    if (s >= 4) setTimeout(() => setStep("review"), 300);
    else setTimeout(() => setStep("review"), 300);
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setLoading(true);
    const context = sessionStorage.getItem("investa_rate_context") ?? "app";
    try {
      const reviewRes = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ rating, review: review.trim() || null, context }),
      });
      if (!reviewRes.ok) throw new Error("review failed");
      saveRateState({ lastRated: Date.now() });
      setStep("done");
      setTimeout(onClose, 2200);
    } catch {
      setStep("done");
      setTimeout(onClose, 2000);
    } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center px-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl pb-safe overflow-hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
              <X size={15} />
            </button>

            <div className="px-6 pb-8 pt-2">
              <AnimatePresence mode="wait">
                {step === "rate" && (
                  <motion.div key="rate" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="text-center">
                    <div className="text-4xl mb-3">🌾</div>
                    <h3 className="text-foreground font-bold text-xl mb-1">{prompt}</h3>
                    <p className="text-muted-foreground text-sm mb-6">Your feedback helps us grow the platform.</p>

                    <div className="flex items-center justify-center gap-2 mb-3">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button
                          key={s}
                          onMouseEnter={() => setHover(s)}
                          onMouseLeave={() => setHover(0)}
                          onClick={() => handleStarClick(s)}
                          className="transition-transform active:scale-90"
                        >
                          <Star
                            size={42}
                            className={`transition-colors ${(hover || rating) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                          />
                        </button>
                      ))}
                    </div>
                    {(hover || rating) > 0 && (
                      <p className="text-amber-600 font-semibold text-sm">{STARS_LABELS[(hover || rating) - 1]}</p>
                    )}
                  </motion.div>
                )}

                {step === "review" && (
                  <motion.div key="review" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                    <div className="flex items-center gap-1 mb-4">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={22} className={`${rating >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                      ))}
                      <span className="ml-2 text-foreground font-semibold text-sm">{STARS_LABELS[rating - 1]}</span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare size={16} className="text-primary" />
                      <p className="text-foreground font-semibold text-sm">Leave a quick note? <span className="text-muted-foreground font-normal">(optional)</span></p>
                    </div>

                    <textarea
                      value={review}
                      onChange={e => setReview(e.target.value)}
                      placeholder="Tell us what you love or what we can improve..."
                      rows={3}
                      className="w-full border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary bg-muted/30 resize-none mb-4"
                    />

                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-60 active:scale-[.98] transition-transform"
                    >
                      {loading ? "Submitting…" : "Submit Review"}
                    </button>
                    <button onClick={onClose} className="w-full mt-2 text-muted-foreground text-sm py-2">
                      Maybe later
                    </button>
                  </motion.div>
                )}

                {step === "done" && (
                  <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} className="text-green-600" />
                    </div>
                    <h3 className="text-foreground font-bold text-lg mb-1">Thank you! 🙏</h3>
                    <p className="text-muted-foreground text-sm">Your feedback helps us build a better platform for African farmers and investors.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
