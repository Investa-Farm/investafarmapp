import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

const TOUR_KEY = "investa_app_tour_v10";
const STABLE_SEEN_KEY = "investa_tour_seen";

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
    // Never show the tour again if ANY previous version was dismissed.
    // We scan localStorage for ANY key that starts with "investa_app_tour_v"
    // so upgrading the version key never forces a re-show for returning users.
    const stableSeen = localStorage.getItem(STABLE_SEEN_KEY);
    if (stableSeen) return undefined;

    // Check current version key
    const versionSeen = localStorage.getItem(`${TOUR_KEY}_${role}`);
    if (versionSeen) {
      // Backfill stable key so future version bumps never re-trigger
      localStorage.setItem(STABLE_SEEN_KEY, "done");
      return undefined;
    }

    // Check any older version key (e.g. investa_app_tour_v8_investor)
    const oldVersionSeen = Object.keys(localStorage).some(
      k => k.startsWith("investa_app_tour_v") && k.endsWith(`_${role}`)
    );
    if (oldVersionSeen) {
      // Backfill the stable key so we never check old keys again
      localStorage.setItem(STABLE_SEEN_KEY, "done");
      return undefined;
    }

    const t = setTimeout(() => {
      setIdx(0);
      setOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [role]);

  const dismiss = () => {
    // Write both versioned key (for this role) AND stable permanent key
    localStorage.setItem(`${TOUR_KEY}_${role}`, "done");
    localStorage.setItem(STABLE_SEEN_KEY, "done");
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
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9998,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
            }}
          />

          {/* Centering shell — static fixed overlay; Framer Motion does NOT touch this div's transform */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              pointerEvents: "none",
            }}
          >
          {/* Card — Framer Motion only animates opacity/scale/y; centering is handled by the parent flex */}
          <motion.div
            key="tour-card"
            initial={{ opacity: 0, scale: 0.88, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 30 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              pointerEvents: "all",
              width: "min(360px, calc(100vw - 32px))",
              maxHeight: "min(600px, calc(100vh - 48px))",
              background: "#ffffff",
              borderRadius: 28,
              border: "1.5px solid #e5e7eb",
              boxShadow: "0 24px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Coloured top accent strip */}
            <div style={{ height: 5, background: "linear-gradient(90deg, #16a34a, #4ade80, #15803d)", flexShrink: 0 }} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src={logoSrc} alt="Investa Farm" style={{ height: 20, width: "auto" }} />
                </div>
                <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>Quick Tour</span>
              </div>
              <button
                onClick={dismiss}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "#f3f4f6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={12} color="#9ca3af" />
              </button>
            </div>

            {/* Slide content */}
            <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={idx}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 60, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: dir * -60, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "0 20px 12px", height: "100%" }}
                >
                  {slide.isWelcome ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingTop: 8, paddingBottom: 4 }}>
                      <div style={{
                        width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                        border: "2px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
                        boxShadow: "0 4px 16px rgba(22,163,74,0.15)"
                      }}>
                        <img src={logoSrc} alt="Investa Farm" style={{ height: 48, width: 48, objectFit: "contain" }} />
                      </div>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>{slide.emoji}</div>
                      <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 22, lineHeight: 1.2, marginBottom: 6, fontFamily: "Space Grotesk, sans-serif" }}>
                        {slide.title}
                      </h1>
                      <p style={{ color: "#16a34a", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{slide.subtitle}</p>
                      <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.6, maxWidth: 260 }}>{slide.body}</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                      <div style={{
                        width: "100%", borderRadius: 14, height: 190, overflow: "hidden",
                        border: "1px solid #f3f4f6", background: "#f9fafb", marginBottom: 14,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
                      }}>
                        <img
                          src={slide.screenshot}
                          alt={slide.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                          loading="eager"
                        />
                      </div>
                      <div style={{ textAlign: "center", width: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 22 }}>{slide.emoji}</span>
                          <span style={{
                            display: "inline-block", padding: "2px 10px", borderRadius: 100, fontSize: 10,
                            fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                            background: slide.accent === "#16a34a" ? "#f0fdf4" : "#fffbeb",
                            color: slide.accent === "#16a34a" ? "#15803d" : "#b45309",
                            border: `1px solid ${slide.accent === "#16a34a" ? "#bbf7d0" : "#fde68a"}`,
                          }}>
                            {slide.subtitle}
                          </span>
                        </div>
                        <h2 style={{ color: "#111827", fontWeight: 900, fontSize: 17, lineHeight: 1.25, marginBottom: 6, fontFamily: "Space Grotesk, sans-serif" }}>
                          {slide.title}
                        </h2>
                        <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.5 }}>{slide.body}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom controls */}
            <div style={{ padding: "8px 20px 20px", flexShrink: 0, borderTop: "1px solid #f3f4f6" }}>
              {/* Progress dots */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14 }}>
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    style={{
                      borderRadius: 100, border: "none", cursor: "pointer", transition: "all 0.3s",
                      width: i === idx ? 20 : 6, height: 6,
                      background: i === idx ? "#16a34a" : "#d1d5db",
                      padding: 0,
                    }}
                  />
                ))}
              </div>

              {/* Nav row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {idx > 0 ? (
                  <button
                    onClick={prev}
                    style={{
                      width: 42, height: 42, borderRadius: 12, border: "1.5px solid #e5e7eb",
                      background: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}
                  >
                    <ChevronLeft size={16} color="#6b7280" />
                  </button>
                ) : (
                  <div style={{ width: 42 }} />
                )}

                <button
                  onClick={next}
                  style={{
                    flex: 1, height: 42, borderRadius: 12, border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                    color: "#fff", fontWeight: 700, fontSize: 14,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: "0 4px 14px rgba(22,163,74,0.35)",
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
                  style={{
                    width: 42, height: 42, borderRadius: 12, border: "1.5px solid #e5e7eb",
                    background: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}
                >
                  <span style={{ color: "#9ca3af", fontSize: 10, fontWeight: 600 }}>Skip</span>
                </button>
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
