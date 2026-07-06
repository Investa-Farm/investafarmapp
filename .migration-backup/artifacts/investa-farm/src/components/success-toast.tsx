/**
 * World-class success / error / info toasts using Sonner.
 * showSuccessToast(msg) — green animated checkmark
 * showErrorToast(msg)   — red animated X
 * showInfoToast(msg)    — blue info badge
 * showCopiedToast()     — "Copied!" feedback
 */
import { toast } from "sonner";
import { motion } from "framer-motion";
import React from "react";

interface ToastCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent: string;
  bg: string;
  border: string;
}

function ToastCard({ icon, title, subtitle, accent, bg, border }: ToastCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: "spring", damping: 22, stiffness: 340 }}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-xl ${bg} border ${border}`}
      style={{ boxShadow: `0 8px 32px ${accent}28, 0 2px 8px rgba(0,0,0,0.08)` }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}18`, border: `1.5px solid ${accent}30` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-gray-900 leading-tight">{title}</p>
        {subtitle && (
          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight truncate">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
}

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <motion.path
      d="M3.5 9L7 12.5L14.5 5.5"
      stroke="#16a34a"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    />
  </svg>
);

const CrossIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <motion.path
      d="M3 3L13 13M13 3L3 13"
      stroke="#dc2626"
      strokeWidth="2.2"
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    />
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <motion.path
      d="M2.5 10.5L6 14L13.5 5"
      stroke="#7c3aed"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    />
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke="#0ea5e9" strokeWidth="1.8" />
    <path d="M8 7v4M8 5.5v.5" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const StarIcon = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <motion.path
      d="M8.5 2L10.5 6.5L15.5 7.2L11.8 10.7L12.9 15.6L8.5 13.2L4.1 15.6L5.2 10.7L1.5 7.2L6.5 6.5L8.5 2Z"
      fill="#f59e0b"
      stroke="#f59e0b"
      strokeWidth="0.8"
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", damping: 15, stiffness: 300 }}
    />
  </svg>
);

const opts = {
  position: "top-center" as const,
  duration: 3200,
  unstyled: true,
  classNames: { toast: "!w-[calc(100vw-32px)] !max-w-[400px] !p-0 !bg-transparent !shadow-none !border-none" },
};

export function showSuccessToast(title: string, subtitle?: string) {
  toast.custom(
    () => (
      <ToastCard
        icon={<CheckIcon />}
        title={title}
        subtitle={subtitle}
        accent="#16a34a"
        bg="bg-white"
        border="border-green-100"
      />
    ),
    opts
  );
  if (navigator.vibrate) navigator.vibrate([30, 10, 20]);
}

export function showErrorToast(title: string, subtitle?: string) {
  toast.custom(
    () => (
      <ToastCard
        icon={<CrossIcon />}
        title={title}
        subtitle={subtitle}
        accent="#dc2626"
        bg="bg-white"
        border="border-red-100"
      />
    ),
    { ...opts, duration: 4500 }
  );
  if (navigator.vibrate) navigator.vibrate([80, 30, 80]);
}

export function showCopiedToast(what = "Copied to clipboard!") {
  toast.custom(
    () => (
      <ToastCard
        icon={<CopyIcon />}
        title={what}
        accent="#7c3aed"
        bg="bg-white"
        border="border-violet-100"
      />
    ),
    { ...opts, duration: 2200 }
  );
  if (navigator.vibrate) navigator.vibrate(25);
}

export function showInfoToast(title: string, subtitle?: string) {
  toast.custom(
    () => (
      <ToastCard
        icon={<InfoIcon />}
        title={title}
        subtitle={subtitle}
        accent="#0ea5e9"
        bg="bg-white"
        border="border-sky-100"
      />
    ),
    { ...opts, duration: 3500 }
  );
}

export function showMilestoneToast(title: string, subtitle?: string) {
  toast.custom(
    () => (
      <ToastCard
        icon={<StarIcon />}
        title={title}
        subtitle={subtitle}
        accent="#f59e0b"
        bg="bg-white"
        border="border-amber-100"
      />
    ),
    { ...opts, duration: 4000 }
  );
  if (navigator.vibrate) navigator.vibrate([40, 20, 40, 20, 60]);
}
