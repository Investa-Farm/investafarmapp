import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, TrendingUp, Wallet, BarChart3, Shield, Star, Bell, Package, FileCheck, Handshake, HelpCircle, ArrowRight, Sparkles, Bot, Navigation } from "lucide-react";
import { useLocation } from "wouter";

const TOUR_KEY = "investa_app_tour_v5";
const TOUR_STATE_KEY = "investa_tour_state";

type TourStep = {
  icon: React.ReactNode;
  gradient: string;
  title: string;
  subtitle: string;
  body: string;
  keyPoints?: string[];
  navigateTo?: string;
  navigateLabel?: string;
  target?: string;
  aiContext?: string;
};

const INVESTOR_STEPS: TourStep[] = [
  {
    icon: <span className="text-3xl">🌾</span>,
    gradient: "from-green-500 to-emerald-600",
    title: "Welcome to Investa Farm",
    subtitle: "Africa's Farm Investment Exchange",
    body: "Buy fractional shares in verified Kenyan farms and earn harvest returns — starting from just KES 5,000.",
    keyPoints: ["Earn 8–28% annual returns", "Exit whenever you're ready", "Backed by real farms"],
  },
  {
    icon: <TrendingUp size={24} className="text-white" />,
    gradient: "from-blue-500 to-indigo-600",
    title: "Live Market",
    subtitle: "Browse real farm listings",
    body: "The Market shows live farm listings with real-time price tickers, sparklines, and risk indicators. Every listing is a real Kenyan farm seeking investors.",
    keyPoints: ["Primary Market — buy from farmers directly", "Secondary Market — trade between investors", "Risk badges: Low / Moderate / High"],
    target: "[data-tour='market-header']",
    navigateTo: "/market/primary",
    navigateLabel: "Explore Primary Market",
    aiContext: "Tell me about the Investa Farm primary market and how to pick the best farm to invest in.",
  },
  {
    icon: <BarChart3 size={24} className="text-white" />,
    gradient: "from-purple-500 to-violet-600",
    title: "Your Portfolio",
    subtitle: "All investments in one place",
    body: "The Portfolio tab shows every farm share you own, unrealised gains, and lets you request an exit when you're ready to cash out.",
    keyPoints: ["Track total value & returns", "Request Mid-Season or Full-Season exit", "View your diversification breakdown"],
    target: "[data-tour='nav-portfolio']",
    navigateTo: "/portfolio",
    navigateLabel: "Open My Portfolio",
    aiContext: "How do I manage my farm investment portfolio and when should I exit?",
  },
  {
    icon: <Wallet size={24} className="text-white" />,
    gradient: "from-amber-500 to-orange-500",
    title: "Wallet & Payouts",
    subtitle: "Seamless M-Pesa integration",
    body: "Top up your Investa Wallet via M-Pesa or card, buy shares instantly, and receive harvest payouts directly to your M-Pesa number.",
    keyPoints: ["Instant M-Pesa top-ups", "No deposit fees", "Harvest payouts in 1–3 days"],
    navigateTo: "/wallet",
    navigateLabel: "Open My Wallet",
    aiContext: "How do deposits and payouts work on Investa Farm?",
  },
  {
    icon: <Shield size={24} className="text-white" />,
    gradient: "from-rose-500 to-pink-600",
    title: "Verify Your Identity",
    subtitle: "KYC unlocks full trading",
    body: "Upload your National ID (front & back) and take a live selfie. Our admin team reviews within 24–48 hours and sends you a confirmation email.",
    keyPoints: ["Takes only 5 minutes", "Required for amounts over KES 10K", "Your data is encrypted"],
    aiContext: "What documents do I need for KYC verification on Investa Farm?",
  },
  {
    icon: <Star size={24} className="text-white" />,
    gradient: "from-yellow-500 to-amber-600",
    title: "Earn Broker Status",
    subtitle: "Invest KES 500K+ to unlock",
    body: "Hit KES 500,000 in portfolio value to automatically upgrade to Broker — unlocking bulk share orders, priority farm access, and higher return tiers.",
    keyPoints: ["Bulk order discounts", "Priority new farm access", "Dedicated support line"],
    aiContext: "What are the benefits of Broker status on Investa Farm?",
  },
];

const FARMER_STEPS: TourStep[] = [
  {
    icon: <span className="text-3xl">🌾</span>,
    gradient: "from-green-500 to-emerald-700",
    title: "Welcome, Farmer!",
    subtitle: "Raise capital for your farm",
    body: "List your farm on Africa's leading investment exchange, attract investors, and access production funding without traditional bank loans.",
    keyPoints: ["List your farm in minutes", "Get funded by real investors", "Retain 55% of all revenue"],
  },
  {
    icon: <FileCheck size={24} className="text-white" />,
    gradient: "from-blue-500 to-cyan-600",
    title: "Complete KYC",
    subtitle: "Verification unlocks funding",
    body: "Upload your National ID and farm documents. Once verified by admin (24–48 hrs), you can list your farm and apply for production funding.",
    keyPoints: ["National ID + farm report", "Approval by email & notification", "One-time process"],
    target: "[data-tour='kyc-prompt']",
    navigateTo: "/farmer/kyc",
    navigateLabel: "Start KYC Process",
    aiContext: "What documents do farmers need to complete KYC verification?",
  },
  {
    icon: <TrendingUp size={24} className="text-white" />,
    gradient: "from-purple-500 to-indigo-600",
    title: "List Your Farm",
    subtitle: "Attract investors to your farm",
    body: "Create your farm listing with crop type, location, and funding target. Investors see your farm in the live market and can buy shares instantly.",
    keyPoints: ["Set your funding target", "Choose share price & quantity", "Go live immediately after KYC"],
    navigateTo: "/farmer/market",
    navigateLabel: "View Farm Listings",
    aiContext: "How do I create a farm listing to attract investors on Investa Farm?",
  },
  {
    icon: <Bell size={24} className="text-white" />,
    gradient: "from-amber-500 to-orange-600",
    title: "Post Field Updates",
    subtitle: "Keep investors informed",
    body: "Post regular crop updates with photos and milestones. Investors love transparency — farms with frequent updates get funded 3× faster.",
    keyPoints: ["Upload field photos", "Share crop milestones", "Build investor trust"],
    navigateTo: "/farmer/updates",
    navigateLabel: "Post an Update",
  },
];

const AGRIBUSINESS_STEPS: TourStep[] = [
  {
    icon: <span className="text-3xl">🤝</span>,
    gradient: "from-green-500 to-teal-600",
    title: "Welcome, Partner!",
    subtitle: "Connect to the farm network",
    body: "Access farmer networks, co-investment opportunities, and real-time agri-market data across Kenya.",
    keyPoints: ["Manage farmer groups", "Process input orders", "Track funding flow"],
  },
  {
    icon: <Handshake size={24} className="text-white" />,
    gradient: "from-blue-500 to-indigo-600",
    title: "Manage Networks",
    subtitle: "Farmers, inputs & logistics",
    body: "Onboard and manage farmer groups in your county. Track KYC status, loan disbursements, and crop progress in real time.",
    keyPoints: ["County-level dashboards", "Group KYC tracking", "Loan status monitoring"],
  },
  {
    icon: <Package size={24} className="text-white" />,
    gradient: "from-amber-500 to-orange-600",
    title: "Input Marketplace",
    subtitle: "Supply & fulfil orders",
    body: "Receive input orders (seeds, fertiliser, equipment) from funded farmers. Fulfil via voucher redemption and earn per order fulfilled.",
    keyPoints: ["Voucher-based fulfilment", "Earn per order", "Real-time inventory sync"],
  },
];

interface Props {
  role?: "investor" | "farmer" | "agribusiness" | "cooperative";
  onAskAI?: (question: string) => void;
}

export function AppTour({ role = "investor", onAskAI }: Props) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [, setLocation] = useLocation();

  const steps =
    role === "farmer" ? FARMER_STEPS
    : role === "agribusiness" || role === "cooperative" ? AGRIBUSINESS_STEPS
    : INVESTOR_STEPS;

  useEffect(() => {
    const pending = localStorage.getItem(TOUR_STATE_KEY);
    if (pending) {
      try {
        const { step, role: pendingRole } = JSON.parse(pending);
        if (pendingRole === role) {
          localStorage.removeItem(TOUR_STATE_KEY);
          setIdx(step);
          setOpen(true);
          return;
        }
      } catch { localStorage.removeItem(TOUR_STATE_KEY); }
    }
    const seen = localStorage.getItem(`${TOUR_KEY}_${role}`);
    if (!seen) {
      const t = setTimeout(() => { setIdx(0); setHighlightRect(null); setOpen(true); }, 2200);
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
    const t = setTimeout(() => setHighlightRect(el.getBoundingClientRect()), 380);
    return () => clearTimeout(t);
  }, [idx, open, steps]);

  const dismiss = () => {
    localStorage.setItem(TOUR_KEY + "_" + role, "done");
    setOpen(false);
    setHighlightRect(null);
    setIdx(0);
  };

  const startTour = () => { setIdx(0); setHighlightRect(null); setOpen(true); };

  const next = () => {
    if (idx < steps.length - 1) setIdx(i => i + 1);
    else dismiss();
  };

  const prev = () => { if (idx > 0) setIdx(i => i - 1); };

  const navigateToStep = (path: string) => {
    const nextIdx = Math.min(idx + 1, steps.length - 1);
    localStorage.setItem(TOUR_STATE_KEY, JSON.stringify({ step: nextIdx, role }));
    setOpen(false);
    setLocation(path);
  };

  const step = open ? steps[idx]! : null;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const inBottomHalf = highlightRect ? highlightRect.top > vh * 0.5 : false;

  const cardPositionStyle: React.CSSProperties = highlightRect
    ? inBottomHalf
      ? { position: "fixed", top: Math.max(12, highlightRect.top - 260), left: 12, right: 12, zIndex: 10000 }
      : { position: "fixed", top: Math.min(vh - 300, highlightRect.bottom + 16), left: 12, right: 12, zIndex: 10000 }
    : { position: "fixed", bottom: 100, left: 12, right: 12, zIndex: 10000 };

  return createPortal(
    <>
      {!open && role !== "investor" && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.5, type: "spring" }}
          onClick={startTour}
          className="fixed bottom-24 right-4 z-[9990] w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 border-2 border-white"
        >
          <HelpCircle size={22} />
        </motion.button>
      )}
      {!open && role === "investor" && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 3, type: "spring" }}
          onClick={startTour}
          className="fixed bottom-24 right-4 z-[9990] w-10 h-10 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-md border-2 border-white"
        >
          <HelpCircle size={18} />
        </motion.button>
      )}

      <AnimatePresence>
        {open && step && (
          <motion.div
            className="fixed inset-0 z-[9999] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Fully transparent — tour card floats over the real app */}
            <div
              className="absolute inset-0 pointer-events-auto"
              style={{ background: "rgba(0,0,0,0.04)" }}
              onClick={dismiss}
            />

            {/* Spotlight glow ring on target */}
            {highlightRect && (
              <div
                style={{
                  position: "fixed",
                  top: highlightRect.top - 6,
                  left: highlightRect.left - 6,
                  width: highlightRect.width + 12,
                  height: highlightRect.height + 12,
                  borderRadius: 16,
                  zIndex: 2,
                  pointerEvents: "none",
                  border: "2px solid rgba(22,163,74,0.6)",
                  boxShadow: "0 0 0 3px rgba(22,163,74,0.15), 0 0 16px rgba(22,163,74,0.2)",
                  animation: "tourPulse 2s ease-in-out infinite",
                }}
              />
            )}

            {/* Tour card */}
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.25, type: "spring", damping: 22 }}
              style={cardPositionStyle}
              className="pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Gradient border wrapper */}
              <div
                className="rounded-2xl p-[1.5px]"
                style={{ background: `linear-gradient(135deg, var(--from-color, #16a34a), var(--to-color, #0f4c35))` }}
              >
                <div className="bg-white dark:bg-card rounded-[14px] overflow-hidden shadow-2xl">
                  {/* Gradient icon strip */}
                  <div className={`bg-gradient-to-r ${step.gradient} px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                        {step.icon}
                      </div>
                      <div>
                        <p className="text-white/70 text-[9px] font-bold uppercase tracking-wider">{step.subtitle}</p>
                        <p className="text-white font-bold text-sm">{step.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/70 text-[10px] font-medium">{idx + 1}/{steps.length}</span>
                      <button onClick={dismiss} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  </div>

                  <div className="px-4 pt-3 pb-2">
                    <p className="text-foreground text-sm leading-relaxed">{step.body}</p>

                    {step.keyPoints && (
                      <ul className="mt-2.5 space-y-1">
                        {step.keyPoints.map(pt => (
                          <li key={pt} className="flex items-start gap-1.5">
                            <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
                            <span className="text-muted-foreground text-xs">{pt}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Navigate button */}
                    {step.navigateTo && (
                      <button
                        onClick={() => navigateToStep(step.navigateTo!)}
                        className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-r ${step.gradient} text-white text-xs font-bold active:scale-95 transition-transform`}
                      >
                        <Navigation size={12} />
                        {step.navigateLabel ?? "Take me there"}
                        <ArrowRight size={12} />
                      </button>
                    )}

                    {/* Ask AI button */}
                    {step.aiContext && onAskAI && (
                      <button
                        onClick={() => { onAskAI(step.aiContext!); dismiss(); }}
                        className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium border border-primary/20 active:scale-95 transition-transform"
                      >
                        <Bot size={11} />
                        Ask AI about this
                        <Sparkles size={10} />
                      </button>
                    )}
                  </div>

                  {/* Progress & nav */}
                  <div className="px-4 pb-3 flex items-center justify-between">
                    <div className="flex gap-1">
                      {steps.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setIdx(i)}
                          className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? "w-5 bg-primary" : "w-1.5 bg-gray-200 dark:bg-muted"}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      {idx > 0 && (
                        <button onClick={prev} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                          <ChevronLeft size={15} className="text-muted-foreground" />
                        </button>
                      )}
                      <button onClick={dismiss} className="text-muted-foreground text-xs font-medium px-2">
                        Skip
                      </button>
                      <button
                        onClick={next}
                        className={`bg-gradient-to-r ${step.gradient} text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1 active:scale-95 transition-transform`}
                      >
                        {idx < steps.length - 1 ? <>Next <ChevronRight size={13} /></> : "Done ✓"}
                      </button>
                    </div>
                  </div>
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
