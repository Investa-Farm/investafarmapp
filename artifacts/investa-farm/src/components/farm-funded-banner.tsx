/**
 * FarmFundedBanner — full-screen celebration overlay shown to the farmer
 * the moment their crop proposal reaches 100% funding.
 *
 * Invoked imperatively via showFarmFundedBanner({ farmName, voucherCode, amount }).
 */
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

interface FarmFundedBannerProps {
  farmName: string;
  voucherCode?: string;
  amount?: number;
  onDismiss: () => void;
}

function FarmFundedBannerCard({ farmName, voucherCode, amount, onDismiss }: FarmFundedBannerProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(onDismiss, 30_000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const copyCode = async () => {
    if (!voucherCode) return;
    await navigator.clipboard.writeText(voucherCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // CSS confetti particles — pure CSS, no library
  const CONFETTI_COLOURS = ["#16a34a","#22c55e","#4ade80","#fbbf24","#f59e0b","#3b82f6","#ffffff"];
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: Math.random() * 1.2,
    dur: 1.8 + Math.random() * 1.4,
    colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
    size: 6 + Math.random() * 7,
    rotate: Math.random() * 360,
  }));

  return (
    <motion.div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onDismiss}
      />

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute rounded-sm"
            style={{
              left: p.left,
              top: "-10px",
              width: p.size,
              height: p.size * 0.45,
              background: p.colour,
              rotate: p.rotate,
            }}
            animate={{
              y: ["0vh", "115vh"],
              rotate: [p.rotate, p.rotate + 540],
              opacity: [1, 0.7, 0],
            }}
            transition={{
              duration: p.dur,
              delay: p.delay,
              ease: "easeIn",
              repeat: 2,
              repeatDelay: 0.5,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <motion.div
        className="relative z-10 w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded-3xl overflow-hidden shadow-2xl"
        initial={{ y: 80, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 60, scale: 0.93, opacity: 0 }}
        transition={{ type: "spring", damping: 18, stiffness: 260 }}
      >
        {/* Green gradient header */}
        <div className="bg-gradient-to-br from-[#052e16] via-[#14532d] to-[#166534] px-5 pt-6 pb-8 text-white relative overflow-hidden">
          {/* Shimmer circles */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-white/5" />

          <div className="relative flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <img src={logoSrc} alt="" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-[0.15em] text-green-300 uppercase">Investa Farm</p>
              <p className="text-[10px] text-white/60">Funding Update</p>
            </div>
            <button
              onClick={onDismiss}
              className="ml-auto w-7 h-7 rounded-full bg-white/15 flex items-center justify-center"
              aria-label="Close"
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M1.5 1.5L7.5 7.5M7.5 1.5L1.5 7.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <motion.p
            className="text-4xl text-center mb-3"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            🎉
          </motion.p>
          <p className="text-center font-black text-xl leading-tight">
            100% Funded!
          </p>
          <p className="text-center text-green-200/90 text-sm mt-1 font-medium">
            "{farmName}"
          </p>
          {amount && (
            <p className="text-center text-white/70 text-xs mt-1">
              KES {amount.toLocaleString("en-KE")} loan disbursed
            </p>
          )}
        </div>

        {/* White body */}
        <div className="bg-white px-5 py-4 space-y-4">
          <p className="text-gray-500 text-xs text-center leading-relaxed">
            Investors have fully funded your crop proposal. Your agribusiness voucher is ready to redeem for farm inputs.
          </p>

          {voucherCode && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-2">Your Voucher Code</p>
              <button
                onClick={copyCode}
                className="w-full flex items-center justify-between bg-green-50 border-2 border-dashed border-green-300 rounded-2xl px-4 py-3"
              >
                <span className="font-mono font-black text-green-800 text-sm tracking-widest">{voucherCode}</span>
                <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                  {copied ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="#16a34a" strokeWidth="1.4"/>
                        <path d="M3 8H2.5A1.5 1.5 0 011 6.5v-5A1.5 1.5 0 012.5 0h5A1.5 1.5 0 019 1.5V2" stroke="#16a34a" strokeWidth="1.4"/>
                      </svg>
                      Tap to copy
                    </>
                  )}
                </span>
              </button>
              <p className="text-[10px] text-gray-400 text-center mt-1.5">Also sent to your phone via SMS</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl text-sm font-semibold"
            >
              Later
            </button>
            <button
              onClick={() => { window.location.href = "/farmer/operations"; onDismiss(); }}
              className="flex-1 bg-gradient-to-r from-[#14532d] to-[#16a34a] text-white py-3 rounded-2xl text-sm font-bold"
            >
              View Voucher →
            </button>
          </div>
        </div>

        {/* Progress drain bar */}
        <div className="h-1 w-full bg-green-100">
          <motion.div
            className="h-full bg-green-500"
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 30, ease: "linear" }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Imperative API ───────────────────────────────────────────────────────────

let bannerRoot: ReturnType<typeof createRoot> | null = null;

function getRoot() {
  if (!bannerRoot) {
    const el = document.createElement("div");
    el.id = "farm-funded-banner-root";
    document.body.appendChild(el);
    bannerRoot = createRoot(el);
  }
  return bannerRoot;
}

function hide() {
  getRoot().render(<AnimatePresence>{null}</AnimatePresence>);
}

export function showFarmFundedBanner(opts: { farmName: string; voucherCode?: string; amount?: number }) {
  getRoot().render(
    <AnimatePresence mode="wait">
      <FarmFundedBannerCard
        key="funded"
        {...opts}
        onDismiss={hide}
      />
    </AnimatePresence>
  );
}

/** Extract a voucher code from a notification body string. */
export function extractVoucherCode(body: string): string | undefined {
  const m =
    body.match(/\b(IF-\d{4}-[A-Z0-9]{3,8}-[A-Z0-9]{3,8})\b/) ??
    body.match(/voucher[:\s]+([A-Z0-9\-]{8,})/i);
  return m?.[1];
}
