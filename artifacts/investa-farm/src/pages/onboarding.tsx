import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, TrendingUp, Users, Shield, Leaf } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import farmerImg from "@assets/onboard-farmer_1778315943101.png";
import financeImg from "@assets/onboard-finance_1778315943102.png";
import teamImg from "@assets/pexels-victor-chijioke-350220031-36846173_1778315943114.jpg";

const slides = [
  {
    id: 0,
    tag: "Africa's Farm Exchange",
    title: "Grow Wealth\nFrom the Soil",
    subtitle: "Buy fractional shares in verified Kenyan farms — starting from just KES 5,000.",
    bg: ["#020d06", "#052e16", "#0a5c2e"],
    accent: "#4ade80",
    accentDark: "#16a34a",
    image: farmerImg,
    stats: [
      { icon: <TrendingUp size={13} />, value: "22%", label: "Max Annual ROI" },
      { icon: <Leaf size={13} />, value: "8", label: "Active Farms" },
    ],
    particles: ["🌱", "🌾", "🌿", "💰"],
  },
  {
    id: 1,
    tag: "Invest in Real Farms",
    title: "Smart Money,\nReal Returns",
    subtitle: "Choose your exit — Mid-Season for quick 10% returns, or Full Season for up to 28% yield appreciation.",
    bg: ["#0f0900", "#3d1a00", "#7c2d00"],
    accent: "#fbbf24",
    accentDark: "#d97706",
    image: financeImg,
    stats: [
      { icon: <TrendingUp size={13} />, value: "KES 2M+", label: "Capital Deployed" },
      { icon: <Shield size={13} />, value: "100%", label: "Insured Holdings" },
    ],
    particles: ["📈", "💎", "💵", "🏦"],
  },
  {
    id: 2,
    tag: "Farmers & Cooperatives",
    title: "Fund Your\nFarm, Your Way",
    subtitle: "Farmers raise capital without bank loans. Register as a cooperative, list your farm, and get funded in days.",
    bg: ["#020a0f", "#0a2540", "#0e4c8c"],
    accent: "#60a5fa",
    accentDark: "#2563eb",
    image: teamImg,
    stats: [
      { icon: <Users size={13} />, value: "50+", label: "Active Investors" },
      { icon: <Leaf size={13} />, value: "Africa #1", label: "Farm Exchange" },
    ],
    particles: ["🤝", "🌍", "🏡", "🚜"],
  },
];

function FloatingParticle({ emoji, delay, duration, x, y }: { emoji: string; delay: number; duration: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute text-lg pointer-events-none select-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1.2, 0.8], y: [20, -40, -80] }}
      transition={{ delay, duration, repeat: Infinity, ease: "easeOut" }}
    >
      {emoji}
    </motion.div>
  );
}

function StatChip({ stat, accent, delay }: { stat: { icon: React.ReactNode; value: string; label: string }; accent: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-2.5"
    >
      <div className="text-white/80">{stat.icon}</div>
      <div>
        <p className="text-white font-extrabold text-sm leading-none">{stat.value}</p>
        <p className="text-white/60 text-[10px] mt-0.5">{stat.label}</p>
      </div>
    </motion.div>
  );
}

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const [, setLocation] = useLocation();
  const [touching, setTouching] = useState(false);
  const touchStartX = useRef(0);

  const slide = slides[current];

  const next = () => {
    if (current < slides.length - 1) setCurrent(c => c + 1);
    else { localStorage.setItem("investa_seen_onboarding", "1"); setLocation("/"); }
  };

  const skip = () => { localStorage.setItem("investa_seen_onboarding", "1"); setLocation("/"); };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
    setTouching(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setTouching(false);
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (dx < -50 && current < slides.length - 1) setCurrent(c => c + 1);
    if (dx > 50 && current > 0) setCurrent(c => c - 1);
  };

  return (
    <div
      className="min-h-dvh w-full max-w-[430px] mx-auto relative overflow-hidden"
      style={{ background: "#000" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid="onboarding-screen"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Background image */}
          <img
            src={slide.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "brightness(0.45) saturate(1.1)" }}
          />

          {/* Gradient overlay layers */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${slide.bg[0]} 0%, transparent 30%, transparent 55%, ${slide.bg[1]} 75%, ${slide.bg[2]} 100%)`,
              opacity: 0.9,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at top center, transparent 40%, ${slide.bg[0]} 100%)`,
            }}
          />

          {/* Floating particles */}
          {slide.particles.map((emoji, i) => (
            <FloatingParticle
              key={i}
              emoji={emoji}
              delay={i * 1.1}
              duration={4 + i * 0.7}
              x={15 + i * 20}
              y={20 + (i % 2) * 15}
            />
          ))}

          {/* Content layer */}
          <div className="absolute inset-0 flex flex-col">
            {/* Top bar */}
            <div className="pt-14 px-6 flex items-center justify-between">
              <motion.img
                src={logoSrc}
                alt="Investa Farm"
                className="h-9 w-auto"
                style={{ filter: "brightness(0) invert(1) drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
              />
              <motion.button
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                onClick={skip}
                className="text-white/70 text-sm font-semibold bg-white/10 backdrop-blur px-4 py-1.5 rounded-full border border-white/15"
              >
                Skip
              </motion.button>
            </div>

            <div className="flex-1" />

            {/* Bottom content */}
            <div className="px-6 pb-10">
              {/* Tag pill */}
              <motion.div
                key={`tag-${current}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4"
                style={{ background: `${slide.accent}25`, border: `1px solid ${slide.accent}50` }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: slide.accent }} />
                <span className="text-xs font-bold tracking-wide" style={{ color: slide.accent }}>{slide.tag}</span>
              </motion.div>

              {/* Title */}
              <motion.h1
                key={`title-${current}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-white font-black leading-none mb-4"
                style={{
                  fontSize: "clamp(36px, 9vw, 42px)",
                  letterSpacing: "-1.5px",
                  lineHeight: 1.08,
                  whiteSpace: "pre-line",
                  fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  textShadow: "0 2px 20px rgba(0,0,0,0.6)",
                }}
              >
                {slide.title}
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                key={`sub-${current}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26, duration: 0.45 }}
                className="text-white/70 text-[15px] leading-relaxed mb-5"
              >
                {slide.subtitle}
              </motion.p>

              {/* Stat chips row */}
              <div className="flex gap-3 mb-7">
                {slide.stats.map((s, i) => (
                  <StatChip key={i} stat={s} accent={slide.accent} delay={0.32 + i * 0.08} />
                ))}
              </div>

              {/* Nav row: dots + CTA */}
              <div className="flex items-center justify-between">
                {/* Dots */}
                <div className="flex gap-2 items-center">
                  {slides.map((_, i) => (
                    <button key={i} onClick={() => setCurrent(i)} data-testid={`dot-${i}`}>
                      <motion.div
                        className="rounded-full"
                        animate={{
                          width: i === current ? 28 : 8,
                          height: 8,
                          backgroundColor: i === current ? slide.accent : "rgba(255,255,255,0.3)",
                        }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </button>
                  ))}
                </div>

                {/* CTA button */}
                <motion.button
                  key={`cta-${current}`}
                  initial={{ opacity: 0, x: 12, scale: 0.92 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
                  onClick={next}
                  data-testid="button-next"
                  className="flex items-center gap-2 pl-6 pr-5 py-3.5 rounded-2xl font-black text-sm active:scale-95 transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${slide.accent}, ${slide.accentDark})`,
                    color: "#0a0a0a",
                    boxShadow: `0 8px 32px ${slide.accent}50`,
                  }}
                >
                  {current === slides.length - 1 ? "Get Started" : "Continue"}
                  <ChevronRight size={17} strokeWidth={3} />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slide progress bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 px-6 pt-6">
        {slides.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: slides[i].accent }}
              initial={{ width: "0%" }}
              animate={{ width: i < current ? "100%" : i === current ? "100%" : "0%" }}
              transition={{ duration: i === current ? 0.5 : 0, ease: "easeOut" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
