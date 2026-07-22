import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, Star, ChevronRight } from "lucide-react";
import { getToken } from "@/lib/auth";

interface PortfolioManagerPopupProps {
  onOpen: () => void;
}

export function PortfolioManagerPopup({ onOpen }: PortfolioManagerPopupProps) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem("pm_popup_dismissed") === "true"
  );
  const token = getToken();

  useEffect(() => {
    if (dismissed) return;
    const alreadyShown = localStorage.getItem("pm_popup_shown");
    if (alreadyShown) return;

    fetch("/api/portfolio-manager/qualification", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error("fetch failed"); return r.json(); })
      .then(data => {
        if (data.qualified) {
          setTimeout(() => setShow(true), 1500);
          localStorage.setItem("pm_popup_shown", "true");
        }
      })
      .catch(() => {});
  }, [dismissed, token]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem("pm_popup_dismissed", "true");
  };

  const handleOpen = () => {
    setShow(false);
    onOpen();
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleDismiss}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[380px] bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Green header */}
            <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #16a34a 100%)" }}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
              <div className="relative p-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 260 }}
                  className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3"
                >
                  <Star size={32} className="text-yellow-300 fill-yellow-300" />
                </motion.div>
                <p className="text-green-300 text-xs font-bold uppercase tracking-widest mb-1">Achievement Unlocked</p>
                <h2 className="text-white text-2xl font-extrabold leading-tight">You're a Portfolio<br />Manager!</h2>
                <p className="text-white/70 text-sm mt-2">Your total investment has crossed the KES 500,000 milestone.</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                {[
                  { icon: "🤖", title: "AI Portfolio Builder", desc: "Generate optimised farm mixes in seconds" },
                  { icon: "👥", title: "Build Followers", desc: "Publish portfolios for others to copy" },
                  { icon: "💰", title: "Earn Management Fees", desc: "Charge 0–2%/yr from your followers" },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 bg-muted/40 rounded-xl p-3">
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <p className="text-foreground font-bold text-sm">{item.title}</p>
                      <p className="text-muted-foreground text-xs">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleOpen}
                className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
              >
                <TrendingUp size={16} />
                Build My First Portfolio
                <ChevronRight size={16} />
              </button>

              <button onClick={handleDismiss} className="w-full text-muted-foreground text-xs py-1">
                Maybe later
              </button>
            </div>

            <button onClick={handleDismiss} className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <X size={13} className="text-white" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
