/**
 * Rich push notification overlay — Binance-style white card
 * Big, animated, white background with colored type accent.
 * Usage: showRichNotification({ type, title, amount, body, url })
 */
import React, { useEffect, useRef, useState } from "react";
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

const TYPE_META: Record<RichNotifType, { emoji: string; label: string; color: string; bg: string; textColor: string }> = {
  investment:    { emoji: "📈", label: "Investment",      color: "#4f46e5", bg: "#ede9fe", textColor: "#4338ca" },
  deposit:       { emoji: "💰", label: "Deposit",         color: "#16a34a", bg: "#dcfce7", textColor: "#15803d" },
  withdrawal:    { emoji: "⬆️", label: "Withdrawal",      color: "#ef4444", bg: "#fee2e2", textColor: "#dc2626" },
  harvest_payout:{ emoji: "🌾", label: "Harvest Payout",  color: "#f59e0b", bg: "#fef9c3", textColor: "#b45309" },
  dividend_paid: { emoji: "💸", label: "Dividend Paid",   color: "#d97706", bg: "#fef3c7", textColor: "#92400e" },
  farm_funded:   { emoji: "🎉", label: "Farm Funded",     color: "#16a34a", bg: "#dcfce7", textColor: "#15803d" },
  price_alert:   { emoji: "📊", label: "Price Alert",     color: "#0ea5e9", bg: "#e0f2fe", textColor: "#0369a1" },
  kyc_approved:  { emoji: "✅", label: "KYC Approved",    color: "#16a34a", bg: "#dcfce7", textColor: "#15803d" },
  kyc_rejected:  { emoji: "⚠️", label: "Action Needed",   color: "#ef4444", bg: "#fee2e2", textColor: "#dc2626" },
  loan_approved: { emoji: "🏦", label: "Loan Approved",   color: "#4f46e5", bg: "#ede9fe", textColor: "#4338ca" },
  new_listing:   { emoji: "🌱", label: "New Listing",     color: "#16a34a", bg: "#dcfce7", textColor: "#15803d" },
  order_filled:  { emoji: "✅", label: "Order Filled",    color: "#16a34a", bg: "#dcfce7", textColor: "#15803d" },
  farm_update:   { emoji: "🌿", label: "Farm Update",     color: "#059669", bg: "#d1fae5", textColor: "#047857" },
  general:       { emoji: "🔔", label: "Notification",    color: "#6b7280", bg: "#f3f4f6", textColor: "#374151" },
};

function formatAmt(amount: number | string | undefined): string | null {
  if (amount === undefined || amount === null) return null;
  const n = typeof amount === "string" ? parseFloat(amount.replace(/,/g, "")) : amount;
  if (isNaN(n) || n === 0) return null;
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function CountdownBar({ durationMs }: { durationMs: number }) {
  return (
    <div className="h-[3px] rounded-full bg-gray-100 overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400"
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: durationMs / 1000, ease: "linear" }}
      />
    </div>
  );
}

function RichNotifCard({ type, title, body, amount, url, durationMs = 7000, onDismiss }: RichNotifOptions & { onDismiss: () => void }) {
  const meta = TYPE_META[type] ?? TYPE_META.general;
  const formattedAmt = formatAmt(amount);

  return (
    <motion.div
      initial={{ y: -120, opacity: 0, scale: 0.92 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -120, opacity: 0, scale: 0.92 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      style={{ filter: "drop-shadow(0 20px 48px rgba(0,0,0,0.18))" }}
      className="w-full"
    >
      <div
        className="bg-white rounded-3xl overflow-hidden"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        {/* Colored top stripe */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}99)` }} />

        {/* Header row */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center">
              <img src={logoSrc} alt="" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-[11px] font-black tracking-widest text-gray-400 uppercase leading-none">Investa Farm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: meta.bg, color: meta.textColor }}
            >
              {meta.emoji} {meta.label}
            </span>
            <button
              onClick={onDismiss}
              className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pt-2 pb-3">
          {formattedAmt && (
            <p className="text-[28px] font-black text-gray-900 leading-tight tracking-tight">
              {formattedAmt}
            </p>
          )}
          <p className={`font-bold text-gray-900 leading-snug ${formattedAmt ? "text-sm mt-0.5" : "text-base"}`}>
            {title}
          </p>
          {body && (
            <p className="text-[13px] text-gray-500 mt-1 leading-snug line-clamp-2">
              {body}
            </p>
          )}
        </div>

        {/* Action row */}
        <div className="px-5 pb-4 flex gap-2">
          {url && (
            <button
              onClick={() => { window.location.href = url; onDismiss(); }}
              className="flex-1 py-2.5 rounded-2xl text-[13px] font-bold text-white flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}
            >
              View Details →
            </button>
          )}
          <button
            onClick={onDismiss}
            className={`py-2.5 rounded-2xl text-[13px] font-semibold text-gray-500 bg-gray-100 active:scale-95 transition-transform ${url ? "px-4" : "flex-1"}`}
          >
            {url ? "Dismiss" : "Got it"}
          </button>
        </div>

        {/* Countdown progress */}
        <div className="px-4 pb-4 -mt-1">
          <CountdownBar durationMs={durationMs} />
        </div>
      </div>
    </motion.div>
  );
}

// ── Overlay container ──────────────────────────────────────────────────────────

let containerEl: HTMLDivElement | null = null;
let rootInstance: ReturnType<typeof createRoot> | null = null;
let pendingQueue: Array<RichNotifOptions & { id: number }> = [];
let queueIdCounter = 0;

function getContainer() {
  if (!containerEl) {
    containerEl = document.createElement("div");
    containerEl.id = "rich-notif-root";
    containerEl.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      width: calc(100vw - 32px); max-width: 400px;
      z-index: 9999; pointer-events: none;
      display: flex; flex-direction: column; gap: 10px;
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
  const durationMs = opts.durationMs ?? 8000;

  pendingQueue = [...pendingQueue, { ...opts, id, durationMs }];
  if (pendingQueue.length > 3) pendingQueue = pendingQueue.slice(-3);
  renderStack();

  setTimeout(() => {
    pendingQueue = pendingQueue.filter(n => n.id !== id);
    renderStack();
  }, durationMs + 600);
}
