/**
 * TxConfirmationTracker — center-screen popup that polls PolygonScan (via our
 * /api/wallet/circle/tx-status backend proxy) for live confirmation counts on
 * a Polygon USDC transfer, so the user can see exactly when their wallet is
 * about to be credited. Calls onConfirmed() once REQUIRED_CONFIRMATIONS is hit.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { getToken } from "@/lib/auth";

interface StatusResp {
  status: "not_found" | "pending" | "failed" | "confirming" | "confirmed";
  confirmations?: number;
  requiredConfirmations?: number;
}

interface Props {
  open: boolean;
  txHash: string;
  onConfirmed: () => void;
  onClose?: () => void;
}

export function TxConfirmationTracker({ open, txHash, onConfirmed, onClose }: Props) {
  const [data, setData] = useState<StatusResp>({ status: "pending" });
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (!open || !txHash) return undefined;
    confirmedRef.current = false;
    setData({ status: "pending" });
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/wallet/circle/tx-status?txHash=${txHash}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok || cancelled) return;
        const json: StatusResp = await res.json();
        if (cancelled) return;
        setData(json);
        if (json.status === "confirmed" && !confirmedRef.current) {
          confirmedRef.current = true;
          onConfirmed();
        }
      } catch { /* keep polling */ }
    }

    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, txHash]);

  if (!open || typeof document === "undefined") return null;

  const confirmations = data.confirmations ?? 0;
  const required = data.requiredConfirmations ?? 6;
  const pct = Math.min(100, (confirmations / required) * 100);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="tx-confirmation-tracker"
        className="fixed inset-0 z-[250] flex items-center justify-center px-6 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", damping: 22, stiffness: 300 }}
          className="bg-white rounded-3xl shadow-2xl px-6 py-7 max-w-[340px] w-full text-center"
        >
          {data.status === "failed" ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mb-4">
                <AlertTriangle size={30} className="text-red-600" />
              </div>
              <p className="text-foreground font-black text-lg">Transaction Failed</p>
              <p className="text-muted-foreground text-sm mt-1.5">The transaction reverted on-chain. No funds were credited.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center mb-4">
                <Loader2 size={28} className="text-[#1652F0] animate-spin" />
              </div>
              <p className="text-foreground font-black text-lg">Confirming Transaction</p>
              <p className="text-muted-foreground text-sm mt-1.5">
                {data.status === "pending"
                  ? "Waiting for the transaction to be mined…"
                  : `${confirmations} of ${required} confirmations on Polygon`}
              </p>
              <div className="w-full h-2 bg-muted rounded-full mt-4 overflow-hidden">
                <motion.div className="h-full bg-[#1652F0] rounded-full" animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
              </div>
              <p className="text-muted-foreground text-[11px] mt-3">Your wallet will be credited automatically once confirmed.</p>
            </>
          )}
          <a
            href={`https://polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-blue-600 text-xs font-semibold mt-4"
          >
            View on PolygonScan <ExternalLink size={11} />
          </a>
          {onClose && (
            <button onClick={onClose} className="w-full mt-4 bg-muted text-foreground font-semibold py-2.5 rounded-xl text-sm active:scale-95 transition-all">
              {data.status === "failed" ? "Close" : "Hide"}
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
