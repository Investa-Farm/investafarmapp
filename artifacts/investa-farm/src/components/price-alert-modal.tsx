import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, BellOff, Trash2 } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";

interface AlertListing {
  farmId: number;
  farmName: string;
  cropType: string;
  pricePerShare: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  listing: AlertListing | null;
}

type Alert = {
  id: number;
  farmId: number;
  targetPrice: string;
  direction: string;
  isActive: boolean;
  createdAt: string;
  farmName?: string;
};

export function PriceAlertModal({ open, onClose, listing }: Props) {
  const { formatAmount, currency, toDisplay } = useCurrency();
  const [targetInput, setTargetInput] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const token = getToken();
  const qc = useQueryClient();

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["price-alerts"],
    queryFn: async () => {
      const r = await fetch("/api/price-alerts", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const farmAlerts = alerts.filter(a => a.farmId === listing?.farmId);

  const handleSave = async () => {
    const targetInCurrency = parseFloat(targetInput);
    if (!targetInCurrency || !listing) return;
    const targetInKes = targetInCurrency * currency.kesPerUnit;
    setLoading(true);
    try {
      const r = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ farmId: listing.farmId, targetPrice: targetInKes, direction }),
      });
      if (r.ok) {
        qc.invalidateQueries({ queryKey: ["price-alerts"] });
        setSuccess(true);
        setTimeout(() => { setSuccess(false); setTargetInput(""); }, 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/price-alerts/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    qc.invalidateQueries({ queryKey: ["price-alerts"] });
  };

  if (!listing) return null;
  const currentDisplay = toDisplay(listing.pricePerShare);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <motion.div className="relative w-full max-w-[430px] bg-background rounded-t-3xl"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}>
            <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Bell size={18} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">Price Alert</p>
                <p className="text-muted-foreground text-[10px]">{listing.farmName} · now {formatAmount(listing.pricePerShare)}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {farmAlerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Active Alerts</p>
                  {farmAlerts.map(a => (
                    <div key={a.id} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <span className="text-base">{a.direction === "above" ? "📈" : "📉"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          Alert {a.direction} {formatAmount(parseFloat(a.targetPrice))}
                        </p>
                        <p className="text-muted-foreground text-[10px]">{a.direction === "above" ? "Notify when price rises above" : "Notify when price drops below"} target</p>
                      </div>
                      <button onClick={() => handleDelete(a.id)} className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <Trash2 size={12} className="text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Alert direction</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {(["above", "below"] as const).map(d => (
                    <button key={d} onClick={() => setDirection(d)}
                      className={`py-2.5 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${direction === d ? "bg-primary border-primary text-white" : "border-border text-muted-foreground bg-card"}`}>
                      {d === "above" ? "📈 Price rises above" : "📉 Price drops below"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  Target price ({currency.code}) — now {currentDisplay.toFixed(2)}
                </label>
                <div className="mt-1.5 flex items-center border border-border rounded-xl overflow-hidden focus-within:border-primary bg-background">
                  <span className="px-3 text-muted-foreground font-bold text-sm select-none">{currency.symbol}</span>
                  <input
                    type="number"
                    value={targetInput}
                    onChange={e => setTargetInput(e.target.value)}
                    placeholder={currentDisplay.toFixed(2)}
                    className="flex-1 py-3 pr-3 text-sm bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              {success ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-green-700 text-sm font-bold">✓ Alert set!</p>
                  <p className="text-green-600 text-xs mt-0.5">You'll be notified when the price target is hit.</p>
                </div>
              ) : (
                <button onClick={handleSave} disabled={loading || !targetInput}
                  className="w-full bg-amber-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
                  <Bell size={16} />
                  {loading ? "Setting alert…" : `Set ${direction === "above" ? "📈" : "📉"} Alert`}
                </button>
              )}

              {farmAlerts.length > 0 && (
                <button onClick={async () => { await Promise.all(farmAlerts.map(a => handleDelete(a.id))); }}
                  className="w-full flex items-center justify-center gap-2 text-muted-foreground text-xs py-2 hover:text-red-500 transition-colors">
                  <BellOff size={13} /> Remove all alerts for this farm
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
