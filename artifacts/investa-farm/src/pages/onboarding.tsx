import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import farmerImg from "@assets/onboard-farmer_1778315943101.png";
import financeImg from "@assets/onboard-finance_1778315943102.png";
import teamImg from "@assets/pexels-victor-chijioke-350220031-36846173_1778315943114.jpg";

const slides = [
  {
    id: 0,
    title: "Farm the Future",
    subtitle: "Kenyan farmers raise capital by listing their farm shares — just like a stock exchange, but rooted in the soil.",
    bg: "from-[#052e16] via-[#14532d] to-[#16a34a]",
    accent: "#4ade80",
    image: farmerImg,
    stat: "4 farms listed",
    statSub: "across Kenya",
    overlay: "from-black/30 via-black/10 to-transparent",
  },
  {
    id: 1,
    title: "Invest Like a Pro",
    subtitle: "Buy shares in real Kenyan farms. Choose your exit — Mid-Season for quick 10% returns, or Full Season for up to 28% yield appreciation.",
    bg: "from-[#1c1917] via-[#292524] to-[#78350f]",
    accent: "#fbbf24",
    image: financeImg,
    stat: "KES 500K+",
    statSub: "managed by investors",
    overlay: "from-black/30 via-black/10 to-transparent",
  },
  {
    id: 2,
    title: "Groups & Cooperatives",
    subtitle: "Farmers register as cooperatives. Apply for farm financing as a group, upload KYC documents, and repay from your harvest.",
    bg: "from-[#0c1a0e] via-[#14532d] to-[#065f46]",
    accent: "#34d399",
    image: teamImg,
    stat: "Africa's #1",
    statSub: "farm investment platform",
    overlay: "from-black/30 via-black/10 to-transparent",
  },
];

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const [, setLocation] = useLocation();

  const slide = slides[current];

  const next = () => {
    if (current < slides.length - 1) setCurrent(c => c + 1);
    else setLocation("/");
  };

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto relative overflow-hidden bg-black" data-testid="onboarding-screen">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0"
        >
          {/* Background photo */}
          <img src={slide.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className={`absolute inset-0 bg-gradient-to-t ${slide.overlay}`} />
          <div className={`absolute inset-0 bg-gradient-to-b ${slide.bg} opacity-40`} />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col">
            {/* Logo header */}
            <div className="pt-14 px-8 flex items-center justify-between">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2"
              >
                <img src={logoSrc} alt="Investa Farm" className="h-10 w-auto drop-shadow-lg" style={{ filter: "brightness(0) invert(1)" }} />
              </motion.div>
              <button
                data-testid="button-skip"
                onClick={() => setLocation("/")}
                className="text-white/60 text-sm font-medium bg-white/10 px-3 py-1 rounded-full"
              >
                Skip
              </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Bottom content card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="px-6 pb-12 space-y-5"
            >
              {/* Stat pill */}
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/20 rounded-full px-4 py-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: slide.accent }} />
                <span className="text-white text-xs font-semibold">{slide.stat}</span>
                <span className="text-white/60 text-xs">{slide.statSub}</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-white text-3xl font-bold leading-tight" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  {slide.title}
                </h1>
                <p className="text-white/75 text-base leading-relaxed">{slide.subtitle}</p>
              </div>

              {/* Dots + CTA */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {slides.map((_, i) => (
                    <button key={i} data-testid={`dot-${i}`} onClick={() => setCurrent(i)}>
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: i === current ? 24 : 8,
                          background: i === current ? slide.accent : "rgba(255,255,255,0.3)",
                        }}
                      />
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <button
                  data-testid="button-next"
                  onClick={next}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform shadow-lg"
                  style={{ background: slide.accent, color: "#052e16" }}
                >
                  {current === slides.length - 1 ? "Get Started" : "Continue"}
                  <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
