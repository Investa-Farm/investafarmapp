import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

const TOUR_KEY = "investa_app_tour_v8";

type TourSlide = {
  screenshot?: string;
  emoji: string;
  title: string;
  subtitle: string;
  body: string;
  accent: string;
  isWelcome?: boolean;
};

const INVESTOR_SLIDES: TourSlide[] = [
  {
    isWelcome: true,
    emoji: "🌾",
    title: "Welcome to Investa Farm",
    subtitle: "Africa's Farm Investment Exchange",
    body: "Buy fractional shares in verified Kenyan farms and earn harvest returns — starting from just KES 5,000.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/market-home.png",
    emoji: "📈",
    title: "Live Market",
    subtitle: "Browse real farm listings",
    body: "Discover farms with live price tickers, risk ratings, and AI insights on every listing.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/farm-detail.png",
    emoji: "🗺️",
    title: "Farm Details",
    subtitle: "Know before you invest",
    body: "Price charts, funding progress, farm map, crop type, and AI market signals — all in one place.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/buy-shares.png",
    emoji: "💳",
    title: "Buy Shares Instantly",
    subtitle: "M-Pesa · Card · USDC",
    body: "Tap Buy, choose your amount, pay via M-Pesa or card, and your shares are credited in seconds.",
    accent: "#d97706",
  },
  {
    screenshot: "/tour/portfolio.png",
    emoji: "💼",
    title: "Your Portfolio",
    subtitle: "Track all your investments",
    body: "Monitor total value, unrealised gains, and week-over-week performance — all in one chart.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/holdings.png",
    emoji: "🏦",
    title: "My Holdings",
    subtitle: "Exit when you're ready",
    body: "See every farm share you own, AI exit projections, and request a Mid-Season or Full-Season exit anytime.",
    accent: "#16a34a",
  },
];

const FARMER_SLIDES: TourSlide[] = [
  {
    isWelcome: true,
    emoji: "👨‍🌾",
    title: "Welcome, Farmer!",
    subtitle: "Raise capital for your farm",
    body: "List your farm on Africa's leading investment exchange and access production funding without bank loans.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/farmer-dashboard.png",
    emoji: "📊",
    title: "Your Dashboard",
    subtitle: "Everything in one place",
    body: "Track your wallet, apply for funding, monitor your crop timeline, and post field updates.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/market-home.png",
    emoji: "🚀",
    title: "Get Funded",
    subtitle: "List your farm to investors",
    body: "Once KYC is approved, list your farm. Investors across Kenya buy shares in your crop instantly.",
    accent: "#d97706",
  },
  {
    screenshot: "/tour/receipt.png",
    emoji: "💰",
    title: "Receive Payments",
    subtitle: "Straight to your wallet",
    body: "Every investment generates a receipt. Funds land in your Investa Wallet — withdraw to M-Pesa anytime.",
    accent: "#16a34a",
  },
];

const AGRIBUSINESS_SLIDES: TourSlide[] = [
  {
    isWelcome: true,
    emoji: "🤝",
    title: "Welcome, Partner!",
    subtitle: "Connect to the farm network",
    body: "Access farmer networks, co-investment opportunities, and real-time agri-market data across Kenya.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/farmer-dashboard.png",
    emoji: "👥",
    title: "Farmer Network",
    subtitle: "Manage groups & KYC",
    body: "Onboard and manage farmer groups. Track KYC status, loan disbursements, and crop progress in real time.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/market-home.png",
    emoji: "🏪",
    title: "Input Marketplace",
    subtitle: "Supply & fulfil orders",
    body: "Receive input orders from funded farmers. Fulfil via voucher redemption and earn per order.",
    accent: "#d97706",
  },
];

interface Props {
  role?: "investor" | "farmer" | "agribusiness" | "cooperative";
  onAskAI?: (question: string) => void;
}

export function AppTour({ role = "investor" }: Props) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const slides =
    role === "farmer"
      ? FARMER_SLIDES
      : role === "agribusiness" || role === "cooperative"
      ? AGRIBUSINESS_SLIDES
      : INVESTOR_SLIDES;

  useEffect(() => {
    const seen = localStorage.getItem(`${TOUR_KEY}_${role}`);
    if (!seen) {
      const t = setTimeout(() => {
        setIdx(0);
        setOpen(true);
      }, 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [role]);

  const dismiss = () => {
    localStorage.setItem(`${TOUR_KEY}_${role}`, "done");
    setOpen(false);
  };

  const next = () => {
    if (idx < slides.length - 1) {
      setDir(1);
      setIdx((i) => i + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (idx > 0) {
      setDir(-1);
      setIdx((i) => i - 1);
    }
  };

  const goTo = (i: number) => {
    setDir(i > idx ? 1 : -1);
    setIdx(i);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartY.current = e.touches[0]!.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    const dy = e.changedTouches[0]!.clientY - (touchStartY.current ?? 0);
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const slide = slides[idx]!;

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="tour-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
            className="fixed inset-0 z-[9998]"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
          />

          {/* Card */}
          <motion.div
            key="tour-card"
            initial={{ opacity: 0, scale: 0.88, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 30 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="fixed z-[9999] flex flex-col"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(360px, 92vw)",
              maxHeight: "min(580px, 90vh)",
              background: "linear-gradient(160deg, #052e16 0%, #0f3d20 55%, #1a5c2e 100%)",
              borderRadius: 28,
              border: "1.5px solid rgba(74,222,128,0.18)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Header strip */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <img src={logoSrc} alt="Investa Farm" className="h-6 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
                <span className="text-white/50 text-[11px] font-medium tracking-wide">Quick Tour</span>
              </div>
              <button
                onClick={dismiss}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
              >
                <X size={12} className="text-white/70" />
              </button>
            </div>

            {/* Slide content */}
            <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={idx}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 60, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: dir * -60, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="flex flex-col items-center w-full px-5 pb-4"
                  style={{ height: "100%" }}
                >
                  {slide.isWelcome ? (
                    /* Welcome slide */
                    <div className="flex flex-col items-center justify-center text-center pt-4 pb-2">
                      <div
                        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 shadow-xl"
                        style={{
                          background: "linear-gradient(135deg,rgba(22,163,74,0.25) 0%,rgba(5,46,22,0.5) 100%)",
                          border: "1.5px solid rgba(22,163,74,0.35)",
                        }}
                      >
                        <img
                          src={logoSrc}
                          alt="Investa Farm"
                          className="h-14 w-14 object-contain"
                          style={{ filter: "brightness(0) invert(1)" }}
                        />
                      </div>
                      <div className="text-4xl mb-3">{slide.emoji}</div>
                      <h1 className="text-white font-black text-2xl leading-tight mb-2" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                        {slide.title}
                      </h1>
                      <p className="text-green-300/80 font-semibold text-sm mb-3">{slide.subtitle}</p>
                      <p className="text-white/55 text-sm leading-relaxed max-w-[260px]">{slide.body}</p>
                    </div>
                  ) : (
                    /* Screenshot slide */
                    <div className="flex flex-col items-center w-full">
                      {/* Compact screenshot — no phone frame, just a clipped rounded preview */}
                      <div
                        className="w-full overflow-hidden shadow-2xl mb-4"
                        style={{
                          borderRadius: 16,
                          height: 200,
                          border: "1.5px solid rgba(255,255,255,0.10)",
                          background: "#0a1a0f",
                        }}
                      >
                        <img
                          src={slide.screenshot}
                          alt={slide.title}
                          className="w-full h-full object-cover object-top"
                          loading="eager"
                        />
                      </div>

                      {/* Text */}
                      <div className="text-center w-full">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className="text-2xl">{slide.emoji}</span>
                          <div
                            className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                            style={{
                              background: `${slide.accent}25`,
                              color: slide.accent === "#16a34a" ? "#4ade80" : "#fbbf24",
                              border: `1px solid ${slide.accent}40`,
                            }}
                          >
                            {slide.subtitle}
                          </div>
                        </div>
                        <h2 className="text-white font-black text-lg mb-1.5 leading-tight" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                          {slide.title}
                        </h2>
                        <p className="text-white/50 text-[13px] leading-relaxed">{slide.body}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom controls */}
            <div className="px-5 pb-5 pt-2 flex-shrink-0">
              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1.5 mb-4">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === idx ? 18 : 5,
                      height: 5,
                      background: i === idx ? "#4ade80" : "rgba(255,255,255,0.2)",
                    }}
                  />
                ))}
              </div>

              {/* Nav row */}
              <div className="flex items-center gap-2.5">
                {idx > 0 ? (
                  <button
                    onClick={prev}
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                    style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <ChevronLeft size={16} className="text-white/70" />
                  </button>
                ) : (
                  <div className="w-11" />
                )}

                <button
                  onClick={next}
                  className="flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                    boxShadow: "0 6px 20px rgba(22,163,74,0.4)",
                    color: "#fff",
                  }}
                >
                  {idx < slides.length - 1 ? (
                    <>Next <ChevronRight size={14} /></>
                  ) : (
                    "Get Started →"
                  )}
                </button>

                <button
                  onClick={dismiss}
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <span className="text-white/35 text-[10px] font-medium leading-tight text-center">Skip</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
