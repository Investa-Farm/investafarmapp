/**
 * Binance-style transaction status notification
 * Appears at the top of the screen with a progress pipeline.
 * Usage: showTransactionToast({ type, amount, status, label })
 */
import React from "react";
import { toast } from "sonner";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

export type TxType = "deposit" | "investment" | "return" | "withdrawal" | "harvest" | "fund";

export type TxStatus = "submitted" | "processing" | "credited";

export interface TransactionToastOptions {
  type: TxType;
  amount: number | string;
  status?: TxStatus;
  label?: string;
  subtitle?: string;
  durationMs?: number;
}

const TYPE_META: Record<TxType, { label: string; emoji: string; color: string; stepLabel: string }> = {
  deposit:    { label: "Deposit",    emoji: "⬇️", color: "#16a34a", stepLabel: "Credited" },
  investment: { label: "Investment", emoji: "📈", color: "#4f46e5", stepLabel: "Invested" },
  return:     { label: "Harvest Payout", emoji: "💰", color: "#f59e0b", stepLabel: "Credited" },
  withdrawal: { label: "Withdrawal", emoji: "⬆️", color: "#ef4444", stepLabel: "Sent" },
  harvest:    { label: "Harvest Payout", emoji: "🌾", color: "#16a34a", stepLabel: "Credited" },
  fund:       { label: "Fund Allocation", emoji: "💼", color: "#4f46e5", stepLabel: "Allocated" },
};

function formatAmount(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return String(amount);
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function StepDot({ done, active }: { done: boolean; active: boolean }) {
  return (
    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
      done ? "bg-[#16a34a]" : active ? "bg-white/20 border-2 border-white/50" : "bg-white/10"
    }`}>
      {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      {active && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
    </div>
  );
}

function StepLine({ done }: { done: boolean }) {
  return (
    <div className="flex-1 h-0.5 rounded-full mx-1" style={{ background: done ? "#16a34a" : "rgba(255,255,255,0.15)" }} />
  );
}

interface TxCardProps extends TransactionToastOptions {}

function TxCard({ type, amount, status = "processing", label, subtitle }: TxCardProps) {
  const meta = TYPE_META[type];
  const steps: TxStatus[] = ["submitted", "processing", "credited"];
  const currentIdx = steps.indexOf(status);

  const stepLabels = ["Submitted", "Processing", meta.stepLabel];
  const statusMsg =
    status === "submitted"  ? "Submitted — confirming on network" :
    status === "processing" ? "Processing — usually 2–5 mins" :
    `${meta.stepLabel} to your wallet ✓`;

  return (
    <div
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", border: "1px solid rgba(255,255,255,0.08)" }}
      className="rounded-2xl overflow-hidden w-full shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center overflow-hidden">
            <img src={logoSrc} alt="" className="w-5 h-5 object-contain" style={{ filter: "brightness(0) invert(1)" }} />
          </div>
          <span className="text-white font-black text-xs tracking-wide">INVESTA FARM</span>
        </div>
        <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">{label ?? meta.label}</span>
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-white font-black text-lg leading-tight">{formatAmount(amount)}</p>
        <p className="text-white/50 text-[10px] mt-0.5">{subtitle ?? statusMsg}</p>
      </div>

      {/* Progress pipeline */}
      <div className="px-4 pb-3 pt-2">
        <div className="flex items-center">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <StepDot done={currentIdx > i} active={currentIdx === i} />
              {i < steps.length - 1 && <StepLine done={currentIdx > i} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          {stepLabels.map((l, i) => (
            <span key={l} className={`text-[9px] font-semibold ${
              currentIdx === i ? "text-white" :
              currentIdx > i ? "text-[#16a34a]" : "text-white/30"
            }`}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function showTransactionToast(opts: TransactionToastOptions) {
  const { durationMs = 8000 } = opts;

  toast.custom(
    () => <TxCard {...opts} />,
    {
      duration: durationMs,
      position: "top-center",
      unstyled: true,
      classNames: {
        toast: "!w-[calc(100vw-32px)] !max-w-[398px] !p-0",
      },
    }
  );
}

/**
 * Animate through all 3 stages automatically for a completed transaction.
 * Call this after a successful payment/investment to show the full flow.
 */
export function showCompletedTransactionFlow(opts: Omit<TransactionToastOptions, "status">) {
  // Stage 1: Submitted
  showTransactionToast({ ...opts, status: "submitted", durationMs: 2500 });

  // Stage 2: Processing
  setTimeout(() => {
    showTransactionToast({ ...opts, status: "processing", durationMs: 2500 });
  }, 2600);

  // Stage 3: Credited
  setTimeout(() => {
    showTransactionToast({ ...opts, status: "credited", durationMs: 5000 });
  }, 5200);
}
