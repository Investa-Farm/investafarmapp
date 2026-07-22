/**
 * InvestListDrawer — a shopping-cart-style bottom sheet for investors.
 * Farms can be added to the list from the market with a quantity, reviewed
 * here, adjusted, and then invested in together in one pass.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Trash2, Loader2, ListChecks } from "lucide-react";
import { formatKES, getToken } from "@/lib/auth";
import { useInvestList } from "@/lib/invest-list";
import { useQueryClient } from "@tanstack/react-query";
import { getListPrimaryMarketQueryKey } from "@workspace/api-client-react";
import { nonceHeaders } from "@/lib/nonce";
import { showCenterSuccess } from "@/components/center-success-modal";
import { getCropImage } from "@/lib/crops";
import { haptic } from "@/lib/haptic";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InvestListDrawer({ open, onClose }: Props) {
  const { items, remove, setQuantity, clear, total } = useInvestList();
  const [investing, setInvesting] = useState(false);
  const [failedIds, setFailedIds] = useState<number[]>([]);
  const token = getToken();
  const qc = useQueryClient();

  const handleInvestAll = async () => {
    if (items.length === 0) return;
    setInvesting(true);
    setFailedIds([]);
    const failures: number[] = [];
    for (const item of items) {
      try {
        const r = await fetch("/api/market/buy", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...nonceHeaders() },
          body: JSON.stringify({ listingId: item.listingId, quantity: item.quantity, exitType: "full_season" }),
        });
        if (!r.ok) failures.push(item.listingId);
      } catch {
        failures.push(item.listingId);
      }
    }
    setInvesting(false);
    setFailedIds(failures);
    qc.invalidateQueries({ queryKey: getListPrimaryMarketQueryKey() });
    qc.invalidateQueries({ queryKey: ["wallet-balance"] });
    qc.invalidateQueries({ queryKey: ["portfolio-summary"] });

    const succeededCount = items.length - failures.length;
    if (succeededCount > 0) {
      haptic("success");
      showCenterSuccess({
        title: "Investments Placed! 🌱",
        subtitle: `${succeededCount} farm${succeededCount > 1 ? "s" : ""} funded from your list`,
      });
    }
    // Remove only the ones that succeeded — keep failed items in the list for retry.
    const succeededIds = items.filter(i => !failures.includes(i.listingId)).map(i => i.listingId);
    succeededIds.forEach(remove);
    if (failures.length === 0) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: "85dvh" }}>

            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ListChecks size={17} className="text-primary" />
                <div>
                  <p className="text-foreground font-bold text-base">Investment List</p>
                  <p className="text-muted-foreground text-xs">{items.length} farm{items.length !== 1 ? "s" : ""} added</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2.5">
              {items.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
                    <ListChecks size={22} className="text-muted-foreground" />
                  </div>
                  <p className="text-foreground font-semibold text-sm">Your list is empty</p>
                  <p className="text-muted-foreground text-xs mt-1">Add farms from the market to invest in them together.</p>
                </div>
              ) : (
                items.map(item => {
                  const failed = failedIds.includes(item.listingId);
                  return (
                    <div key={item.listingId} className={`rounded-2xl border p-3 flex items-center gap-3 ${failed ? "border-red-300 bg-red-50" : "border-border bg-card"}`}>
                      <img src={item.imageUrl ?? getCropImage(item.cropType)} alt={item.farmName}
                        className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-foreground truncate">{item.farmName}</p>
                        <p className="text-muted-foreground text-[10px]">{formatKES(item.pricePerShare)}/share</p>
                        {failed && <p className="text-red-600 text-[10px] font-semibold mt-0.5">Failed — check wallet balance</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <button onClick={() => setQuantity(item.listingId, item.quantity - 1)}
                            className="w-6 h-6 rounded-md bg-muted flex items-center justify-center active:scale-90">
                            <Minus size={11} className="text-foreground" />
                          </button>
                          <span className="text-xs font-bold text-foreground w-6 text-center">{item.quantity}</span>
                          <button onClick={() => setQuantity(item.listingId, item.quantity + 1)}
                            className="w-6 h-6 rounded-md bg-muted flex items-center justify-center active:scale-90">
                            <Plus size={11} className="text-foreground" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-xs font-black text-foreground">{formatKES(item.pricePerShare * item.quantity)}</p>
                        <button onClick={() => remove(item.listingId)} className="w-6 h-6 rounded-md flex items-center justify-center active:scale-90">
                          <Trash2 size={12} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {items.length > 0 && (
              <div className="flex-shrink-0 border-t border-border px-5 pt-3 pb-6 space-y-2.5" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px) + 1rem)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">Total</span>
                  <span className="text-foreground font-black text-base">{formatKES(total)}</span>
                </div>
                <button onClick={handleInvestAll} disabled={investing}
                  className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {investing ? <Loader2 size={16} className="animate-spin" /> : <span>💰</span>}
                  {investing ? "Investing…" : `Invest in All (${items.length})`}
                </button>
                <button onClick={clear} className="w-full text-muted-foreground text-xs font-semibold py-1">
                  Clear list
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
