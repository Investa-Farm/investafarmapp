/**
 * Rich push notification overlay — compact phone-notification style
 * Small toast at the top, auto-dismisses. Mimics iOS/Android lock-screen notifications.
 */
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

export type RichNotifType =
  | "investment" | "deposit" | "withdrawal" | "harvest_payout" | "dividend_paid"
  | "farm_funded" | "price_alert" | "kyc_approved" | "kyc_rejected"
  | "loan_approved" | "new_listing" | "order_filled" | "farm_update"
  | "general";

interface RichNotifOptions {
  type: RichNotifType;
  title: string;
  body?: string;
  amount?: number | string;
  url?: string;
  durationMs?: number;
}

const TYPE_META: Record<RichNotifType, { emoji: string; color: string }> = {
  investment:    { emoji: "📈", color: "#4f46e5" },
  deposit:       { emoji: "💰", color: "#16a34a" },
  withdrawal:    { emoji: "⬆️", color: "#ef4444" },
  harvest_payout:{ emoji: "🌾", color: "#f59e0b" },
  dividend_paid: { emoji: "💸", color: "#d97706" },
  farm_funded:   { emoji: "🎉", color: "#16a34a" },
  price_alert:   { emoji: "📊", color: "#0ea5e9" },
  kyc_approved:  { emoji: "✅", color: "#16a34a" },
  kyc_rejected:  { emoji: "⚠️", color: "#ef4444" },
  loan_approved: { emoji: "🏦", color: "#4f46e5" },
  new_listing:   { emoji: "🌱", color: "#16a34a" },
  order_filled:  { emoji: "✅", color: "#16a34a" },
  farm_update:   { emoji: "🌿", color: "#059669" },
  general:       { emoji: "🔔", color: "#6b7280" },
};

function formatAmt(amount: number | string | undefined): string | null {
  if (amount === undefined || amount === null) return null;
  const n = typeof amount === "string" ? parseFloat(amount.replace(/,/g, "")) : amount;
  if (isNaN(n) || n === 0) return null;
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function RichNotifCard({ type, title, body, amount, url, durationMs = 7000, onDismiss }: RichNotifOptions & { onDismiss: () => void }) {
  const meta = TYPE_META[type] ?? TYPE_META.general;
  const formattedAmt = formatAmt(amount);

  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onDismiss]);

  return (
    <motion.div
      initial={{ y: -80, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -80, opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", damping: 22, stiffness: 320 }}
      onClick={() => { if (url) window.location.href = url; onDismiss(); }}
      className="w-full cursor-pointer"
    >
      <div
        className="bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden"
        style={{
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.14)",
        }}
      >
        {/* Thin color stripe */}
        <div className="h-[2px] w-full" style={{ background: meta.color }} />

        <div className="flex items-start gap-2.5 px-3 py-2.5">
          {/* App icon */}
          <div className="w-8 h-8 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <img src={logoSrc} alt="" className="w-5 h-5 object-contain" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Investa Farm</span>
              <span className="text-[10px]">{meta.emoji}</span>
              {formattedAmt && (
                <span className="text-[10px] font-bold ml-auto" style={{ color: meta.color }}>
                  {formattedAmt}
                </span>
              )}
            </div>
            <p className="text-[13px] font-bold text-gray-900 leading-snug truncate">{title}</p>
            {body && (
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{body}</p>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5"
          >
            <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
              <path d="M1 1L5 5M5 1L1 5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] w-full bg-gray-100 overflow-hidden">
          <motion.div
            className="h-full"
            style={{ background: meta.color }}
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: durationMs / 1000, ease: "linear" }}
          />
        </div>
      </div>
    </motion.div>
  );
}

let containerEl: HTMLDivElement | null = null;
let rootInstance: ReturnType<typeof createRoot> | null = null;
let pendingQueue: Array<RichNotifOptions & { id: number }> = [];
let queueIdCounter = 0;

function getContainer() {
  if (!containerEl) {
    containerEl = document.createElement("div");
    containerEl.id = "rich-notif-root";
    containerEl.style.cssText = `
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      width: calc(100vw - 24px); max-width: 360px;
      z-index: 9999; pointer-events: none;
      display: flex; flex-direction: column; gap: 6px;
    `;
    document.body.appendChild(containerEl);
    rootInstance = createRoot(containerEl);
  }
  return { el: containerEl, root: rootInstance! };
}

function NotifStack({ items, onDismiss }: {
  items: Array<RichNotifOptions & { id: number }>;
  onDismiss: (id: number) => void;
}) {
  return (
    <AnimatePresence mode="popLayout">
      {items.map((item) => (
        <div key={item.id} style={{ pointerEvents: "all" }}>
          <RichNotifCard
            {...item}
            onDismiss={() => onDismiss(item.id)}
          />
        </div>
      ))}
    </AnimatePresence>
  );
}

function renderStack() {
  const { root } = getContainer();
  const snapshot = [...pendingQueue];
  root.render(
    <NotifStack
      items={snapshot}
      onDismiss={(id) => {
        pendingQueue = pendingQueue.filter(n => n.id !== id);
        renderStack();
      }}
    />
  );
}

export function showRichNotification(opts: RichNotifOptions) {
  const id = ++queueIdCounter;
  const durationMs = opts.durationMs ?? 6000;

  pendingQueue = [...pendingQueue, { ...opts, id, durationMs }];
  if (pendingQueue.length > 2) pendingQueue = pendingQueue.slice(-2);
  renderStack();

  setTimeout(() => {
    pendingQueue = pendingQueue.filter(n => n.id !== id);
    renderStack();
  }, durationMs + 600);
}
