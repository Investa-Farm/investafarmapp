import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, TrendingUp, Wallet, BarChart3, Shield, Star, Bell, Package, FileCheck, Handshake, HelpCircle } from "lucide-react";

const TOUR_KEY = "investa_app_tour_v4";

type TourStep = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  body: string;
  target?: string;
};

const INVESTOR_STEPS: TourStep[] = [
  {
    icon: <span className="text-3xl">🌾</span>,
    title: "Welcome to Investa Farm",
    subtitle: "Africa's Farm Investment Exchange",
    body: "Buy shares in verified Kenyan farms and earn returns at harvest time — starting from just KES 5,000.",
  },
  {
    icon: <TrendingUp size={28} className="text-primary" />,
    title: "Live Market",
    subtitle: "Browse & invest in real farms",
    body: "The Market shows live farm listings with price tickers. Each listing shows crop type, return rate, and risk level.",
    target: "[data-tour='market-header']",
  },
  {
    icon: <BarChart3 size={28} className="text-blue-500" />,
    title: "Your Portfolio",
    subtitle: "Track every investment",
    body: "The Portfolio tab shows all your farm holdings, unrealised gains, and lets you request an exit whenever you're ready.",
    target: "[data-tour='nav-portfolio']",
  },
  {
    icon: <Wallet size={28} className="text-amber-500" />,
    title: "Wallet & Payouts",
    subtitle: "Seamless M-Pesa payouts",
    body: "Fund your wallet via M-Pesa, buy farm shares instantly, and receive harvest payouts directly to your phone.",
    target: "[data-tour='wallet-btn']",
  },
  {
    icon: <Shield size={28} className="text-rose-500" />,
    title: "Verify Your Identity",
    subtitle: "KYC unlocks full trading",
    body: "Upload your National ID and a live selfie. Our admin team reviews within 24–48 hours and notifies you when approved.",
  },
  {
    icon: <Star size={28} className="text-yellow-500" />,
    title: "Earn Broker Status",
    subtitle: "Invest KES 500K to unlock",
    body: "Reach KES 500,000 in portfolio value to automatically upgrade to Broker — unlocking bulk orders and priority listings.",
  },
];

const FARMER_STEPS: TourStep[] = [
  {
    icon: <span className="text-3xl">🌾</span>,
    title: "Welcome, Farmer!",
    subtitle: "Investa Farm — Raise Capital for Your Farm",
    body: "List your farm on the exchange, attract investors, and access funding to grow your farm business.",
  },
  {
    icon: <FileCheck size={28} className="text-primary" />,
    title: "Complete Your KYC",
    subtitle: "Verification unlocks funding",
    body: "Upload your National ID and farm documents. Admin reviews in 24–48 hrs and you get notified.",
    target: "[data-tour='kyc-prompt']",
  },
  {
    icon: <Bell size={28} className="text-blue-500" />,
    title: "Stay Updated",
    subtitle: "Track your farm's progress",
    body: "Post field updates, track funding progress, and view earnings — all in one place.",
  },
];

const AGRIBUSINESS_STEPS: TourStep[] = [
  {
    icon: <span className="text-3xl">🤝</span>,
    title: "Welcome, Partner!",
    subtitle: "Connect to the Farm Investment Network",
    body: "Access farmer networks, co-investment opportunities, and real-time agri-data.",
  },
  {
    icon: <Handshake size={28} className="text-primary" />,
    title: "Manage Networks",
    subtitle: "Farmers, inputs & logistics",
    body: "Onboard and manage farmer groups in your county. Track KYC, loans, and crop progress.",
  },
  {
    icon: <Package size={28} className="text-amber-500" />,
    title: "Input Marketplace",
    subtitle: "Supply & fulfil orders",
    body: "Receive input orders from funded farmers. Fulfil via voucher redemption and earn per order.",
  },
];

interface Props {
  role?: "investor" | "farmer" | "agribusiness" | "cooperative";
}

export function AppTour({ role = "investor" }: Props) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const steps =
    role === "farmer" ? FARMER_STEPS
    : role === "agribusiness" || role === "cooperative" ? AGRIBUSINESS_STEPS
    : INVESTOR_STEPS;

  // Auto-start tour for first-time users (2s delay to let UI settle)
  useEffect(() => {
    const seen = localStorage.getItem(`${TOUR_KEY}_${role}`);
    if (!seen) {
      const t = setTimeout(() => {
        setIdx(0);
        setHighlightRect(null);
        setOpen(true);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [role]);

  useEffect(() => {
    if (!open) return;
    const step = steps[idx];
    if (!step?.target) { setHighlightRect(null); return; }
    const el = document.querySelector(step.target);
    if (!el) { setHighlightRect(null); return; }
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const t = setTimeout(() => {
      setHighlightRect(el.getBoundingClientRect());
    }, 360);
    return () => clearTimeout(t);
  }, [idx, open, steps]);

  const dismiss = () => {
    localStorage.setItem(TOUR_KEY + "_" + role, "done");
    setOpen(false);
    setHighlightRect(null);
    setIdx(0);
  };

  const startTour = () => {
    setIdx(0);
    setHighlightRect(null);
    setOpen(true);
  };

  const next = () => {
    if (idx < steps.length - 1) setIdx(i => i + 1);
    else dismiss();
  };

  const step = open ? steps[idx]! : null;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const inBottomHalf = highlightRect ? highlightRect.top > vh * 0.5 : false;

  const cardPositionStyle: React.CSSProperties = highlightRect
    ? inBottomHalf
      ? { position: "fixed", bottom: "auto", top: Math.max(12, highlightRect.top - 230), left: 16, right: 16, zIndex: 10000 }
      : { position: "fixed", top: "auto", bottom: Math.max(16, vh - highlightRect.bottom - 200), left: 16, right: 16, zIndex: 10000 }
    : { position: "fixed", bottom: 90, left: 16, right: 16, zIndex: 10000 };

  return createPortal(
    <>
      {/* Floating "?" help button — hidden for investors, visible for farmers/agribusiness/cooperative */}
      {!open && role !== "investor" && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.2 }}
          onClick={startTour}
          className="fixed bottom-24 right-4 z-[9990] w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 border-2 border-white"
          title="Take the app tour"
        >
          <HelpCircle size={20} />
        </motion.button>
      )}

      <AnimatePresence>
        {open && step && (
          <motion.div
            className="fixed inset-0 z-[9999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop — only when no spotlight target */}
            {!highlightRect && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={dismiss} />
            )}

            {/* Spotlight: dark overlay with transparent hole via box-shadow */}
            {highlightRect && (
              <>
                <div className="absolute inset-0" onClick={dismiss} />
                <div
                  style={{
                    position: "fixed",
                    top: highlightRect.top - 8,
                    left: highlightRect.left - 8,
                    width: highlightRect.width + 16,
                    height: highlightRect.height + 16,
                    borderRadius: 14,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.70)",
                    zIndex: 1,
                    pointerEvents: "none",
                    border: "2px solid rgba(74,222,128,0.85)",
                    animation: "tourPulse 2s ease-in-out infinite",
                  }}
                />
              </>
            )}

            {/* White info card */}
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: inBottomHalf ? -10 : 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22 }}
              style={cardPositionStyle}
              className="bg-white rounded-2xl shadow-2xl p-5 border border-green-100"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center border border-green-200">
                  {step.icon}
                </div>
                <button onClick={dismiss} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 flex-shrink-0">
                  <X size={14} />
                </button>
              </div>

              <p className="text-primary text-[10px] font-bold uppercase tracking-wider mb-0.5">{step.subtitle}</p>
              <h3 className="text-gray-900 font-bold text-base mb-1.5">{step.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">{step.body}</p>

              {/* Progress + navigation */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {steps.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? "w-5 bg-primary" : "w-1.5 bg-gray-200"}`} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={dismiss} className="text-gray-400 text-xs font-medium px-2 py-1">
                    Skip
                  </button>
                  <button
                    onClick={next}
                    className="bg-primary text-white font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    {idx < steps.length - 1 ? <>Next <ChevronRight size={14} /></> : "Done ✓"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
