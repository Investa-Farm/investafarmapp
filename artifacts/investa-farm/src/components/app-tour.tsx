import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

const TOUR_KEY = "investa_app_tour_v7";

type TourSlide = {
  screenshot?: string;
  title: string;
  subtitle: string;
  body: string;
  accent: string;
  isWelcome?: boolean;
};

const INVESTOR_SLIDES: TourSlide[] = [
  {
    isWelcome: true,
    title: "Welcome to Investa Farm",
    subtitle: "Africa's Farm Investment Exchange",
    body: "Buy fractional shares in verified Kenyan farms and earn harvest returns — starting from just KES 5,000.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/market-home.png",
    title: "Live Market",
    subtitle: "Browse real farm listings",
    body: "Discover farms in the Primary and Secondary Market — with live price tickers, risk ratings, and AI insights on every listing.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/farm-detail.png",
    title: "Farm Details",
    subtitle: "Know before you invest",
    body: "Each farm page shows today's price chart, funding progress, location, crop type, and AI-generated market signals.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/buy-shares.png",
    title: "Buy Shares Instantly",
    subtitle: "M-Pesa · Card · USDC",
    body: "Tap Buy, choose your amount, pay via M-Pesa or card, and your shares are credited in seconds.",
    accent: "#d97706",
  },
  {
    screenshot: "/tour/portfolio.png",
    title: "Your Portfolio",
    subtitle: "Track all your investments",
    body: "Monitor total value, unrealised gains, and week-over-week performance — all in one chart.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/holdings.png",
    title: "My Holdings",
    subtitle: "Exit when you're ready",
    body: "See every farm share you own, AI exit projections, and request a Mid-Season or Full-Season exit at any time.",
    accent: "#16a34a",
  },
];

const FARMER_SLIDES: TourSlide[] = [
  {
    isWelcome: true,
    title: "Welcome, Farmer!",
    subtitle: "Raise capital for your farm",
    body: "List your farm on Africa's leading investment exchange, attract investors, and access production funding without bank loans.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/farmer-dashboard.png",
    title: "Your Dashboard",
    subtitle: "Everything in one place",
    body: "Track your wallet balance, apply for funding, monitor your crop timeline, and post field updates — all from your home screen.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/market-home.png",
    title: "Get Funded",
    subtitle: "List your farm to investors",
    body: "Once KYC is approved, list your farm with your funding target. Investors across Kenya can buy shares in your crop instantly.",
    accent: "#d97706",
  },
  {
    screenshot: "/tour/receipt.png",
    title: "Receive Payments",
    subtitle: "Straight to your wallet",
    body: "Every investment generates a transaction receipt. Funds land in your Investa Wallet and can be withdrawn to M-Pesa.",
    accent: "#16a34a",
  },
];

const AGRIBUSINESS_SLIDES: TourSlide[] = [
  {
    isWelcome: true,
    title: "Welcome, Partner!",
    subtitle: "Connect to the farm network",
    body: "Access farmer networks, co-investment opportunities, and real-time agri-market data across Kenya.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/farmer-dashboard.png",
    title: "Farmer Network",
    subtitle: "Manage groups & KYC",
    body: "Onboard and manage farmer groups in your county. Track KYC status, loan disbursements, and crop progress in real time.",
    accent: "#16a34a",
  },
  {
    screenshot: "/tour/market-home.png",
    title: "Input Marketplace",
    subtitle: "Supply & fulfil orders",
    body: "Receive input orders from funded farmers. Fulfil via voucher redemption and earn per order fulfilled.",
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
  const [, setLocation] = useLocation();
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
    if (idx < slides.length - 1) setIdx((i) => i + 1);
    else dismiss();
  };

  const prev = () => {
    if (idx > 0) setIdx((i) => i - 1);
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
      <motion.div
        key="tour-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col"
        style={{
          background:
            "linear-gradient(160deg, #052e16 0%, #0f3d20 40%, #1a5c2e 100%)",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-10 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            <span className="text-white/60 text-xs font-medium">Quick Tour</span>
          </div>
          <button
            onClick={dismiss}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
          >
            <X size={14} className="text-white/70" />
          </button>
        </div>

        {/* Slide content */}
        <div className="flex-1 flex flex-col items-center justify-between px-5 pb-6 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="flex flex-col items-center w-full h-full"
            >
              {slide.isWelcome ? (
                /* Welcome slide */
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                  <div
                    className="w-28 h-28 rounded-3xl flex items-center justify-center mb-8 shadow-2xl"
                    style={{
                      background:
                        "linear-gradient(135deg,rgba(22,163,74,0.25) 0%,rgba(5,46,22,0.5) 100%)",
                      border: "1.5px solid rgba(22,163,74,0.35)",
                    }}
                  >
                    <img
                      src={logoSrc}
                      alt="Investa Farm"
                      className="h-20 w-20 object-contain"
                      style={{ filter: "brightness(0) invert(1)" }}
                    />
                  </div>
                  <h1 className="text-white font-black text-3xl leading-tight mb-3" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                    {slide.title}
                  </h1>
                  <p className="text-green-300/80 font-semibold text-base mb-4">{slide.subtitle}</p>
                  <p className="text-white/60 text-sm leading-relaxed max-w-xs">{slide.body}</p>
                </div>
              ) : (
                /* Screenshot slide */
                <div className="flex-1 flex flex-col w-full">
                  {/* Phone mockup */}
                  <div className="flex-1 flex items-center justify-center pt-2 pb-4">
                    <div
                      className="relative rounded-[2.8rem] overflow-hidden shadow-2xl"
                      style={{
                        width: "min(260px, 65vw)",
                        aspectRatio: "9/19",
                        border: "2.5px solid rgba(255,255,255,0.15)",
                        background: "#0a1a0f",
                        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
                      }}
                    >
                      {/* Notch */}
                      <div
                        className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-full"
                        style={{ width: 70, height: 20, background: "#0a1a0f" }}
                      />
                      {/* Screenshot */}
                      <img
                        src={slide.screenshot}
                        alt={slide.title}
                        className="w-full h-full object-cover object-top"
                        style={{ paddingTop: 24 }}
                        loading="eager"
                      />
                      {/* Sheen */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Text */}
                  <div className="text-center px-2">
                    <div
                      className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{ background: `${slide.accent}30`, color: slide.accent === "#16a34a" ? "#4ade80" : "#fbbf24" }}
                    >
                      {slide.subtitle}
                    </div>
                    <h2 className="text-white font-black text-xl mb-2 leading-tight" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                      {slide.title}
                    </h2>
                    <p className="text-white/55 text-sm leading-relaxed">{slide.body}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom controls */}
          <div className="w-full mt-4 flex-shrink-0">
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 mb-5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === idx ? 20 : 6,
                    height: 6,
                    background: i === idx ? "#4ade80" : "rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>

            {/* Nav row */}
            <div className="flex items-center gap-3">
              {idx > 0 ? (
                <button
                  onClick={prev}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <ChevronLeft size={18} className="text-white/70" />
                </button>
              ) : (
                <div className="w-12" />
              )}

              <button
                onClick={next}
                className="flex-1 h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  boxShadow: "0 8px 24px rgba(22,163,74,0.4)",
                  color: "#fff",
                }}
              >
                {idx < slides.length - 1 ? (
                  <>
                    Next
                    <ChevronRight size={16} />
                  </>
                ) : (
                  "Get Started →"
                )}
              </button>

              <button
                onClick={dismiss}
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <span className="text-white/40 text-[10px] font-medium leading-tight text-center">
                  Skip
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
