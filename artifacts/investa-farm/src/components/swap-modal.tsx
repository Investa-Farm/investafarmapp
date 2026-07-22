import { useState } from "react";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ArrowLeftRight, TrendingUp, MapPin, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCropImage } from "@/lib/crops";
import { getToken } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { useLocation } from "wouter";

type Holding = {
  id: number; farmId: number; farmName: string; cropType: string; location: string;
  quantity: number; purchasePrice: number; currentPrice: number; totalValue: number;
  gainLoss: number; gainLossPercent: number; exitType: string; imageUrl?: string; status: string;
};

type SecListing = {
  id: number; farmId: number; farmName: string; cropType: string; location: string;
  pricePerShare: number; sharesAvailable: number; changePercent: number; imageUrl?: string;
};

type Props = { open: boolean; holding: Holding | null; onClose: () => void };

export function SwapModal({ open, holding, onClose }: Props) {
  useScrollLock(open);
  const token = getToken();
  const [, setLocation] = useLocation();
  const { formatAmount } = useCurrency();
  const [selected, setSelected] = useState<SecListing | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const [marketSource, setMarketSource] = useState<"secondary" | "primary">("secondary");

  const { data: secListings = [] } = useQuery<SecListing[]>({
    queryKey: ["secondary-for-swap"],
    queryFn: async () => {
      const r = await fetch("/api/market/secondary", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.listings ?? []);
    },
    enabled: open,
    staleTime: 30_000,
  });

  const { data: primListings = [] } = useQuery<SecListing[]>({
    queryKey: ["primary-for-swap"],
    queryFn: async () => {
      const r = await fetch("/api/market/primary", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.listings ?? []);
    },
    enabled: open,
    staleTime: 30_000,
  });

  const allListings = marketSource === "secondary" ? secListings : primListings;
  const eligible = allListings.filter(l => l.farmId !== holding?.farmId);

  const handleConfirm = () => {
    if (!selected || !holding) return;
    setConfirmed(true);
    setTimeout(() => {
      onClose();
      setConfirmed(false);
      setSelected(null);
      setLocation(`/market/secondary`);
    }, 1800);
  };

  if (!holding) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex flex-col"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl overflow-hidden flex flex-col"
            style={{ maxHeight: "88dvh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <ArrowLeftRight size={15} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-foreground">Swap Holding</h2>
                  <p className="text-muted-foreground text-[10px]">List & swap into another farm</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={15} className="text-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">

              {/* Current holding */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Swapping Out Of</p>
                </div>
                <div className="flex items-center gap-3 px-3 py-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={getCropImage(holding.cropType, holding.imageUrl)}
                      alt={holding.farmName} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{holding.farmName}</p>
                    <p className="text-muted-foreground text-[10px]">{holding.cropType} · {holding.location}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 rounded-full">
                        {holding.quantity} shares
                      </span>
                      <span className="text-foreground text-[10px] font-semibold">
                        {formatAmount(holding.totalValue)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex-1 h-px bg-border w-16" />
                  <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <ArrowRight size={14} className="text-blue-600" />
                  </div>
                  <div className="flex-1 h-px bg-border w-16" />
                </div>
              </div>

              {/* Market source toggle */}
              <div className="flex gap-1.5 p-1 bg-muted rounded-xl">
                {(["secondary", "primary"] as const).map(src => (
                  <button key={src} onClick={() => { setMarketSource(src); setSelected(null); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      marketSource === src
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground"
                    }`}>
                    {src === "secondary" ? "🔄 Secondary Market" : "🌱 New Listings"}
                  </button>
                ))}
              </div>

              {/* Select target */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {marketSource === "secondary" ? "Available on Secondary Market" : "Primary Market Farms"}
                </p>
                {eligible.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                    <TrendingUp size={24} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-xs">No secondary market listings available right now.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {eligible.slice(0, 8).map(l => {
                      const up = l.changePercent >= 0;
                      const isSelected = selected?.id === l.id;
                      return (
                        <button
                          key={l.id}
                          onClick={() => setSelected(isSelected ? null : l)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border transition-all text-left ${
                            isSelected
                              ? "border-blue-400 bg-blue-50"
                              : "border-border bg-card hover:border-blue-200"
                          }`}
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                            <img src={getCropImage(l.cropType, l.imageUrl)}
                              alt={l.farmName} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs text-foreground truncate">{l.farmName}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin size={8} className="text-muted-foreground" />
                              <p className="text-muted-foreground text-[9px]">{l.location} · {l.cropType}</p>
                            </div>
                            <p className="text-foreground text-[10px] font-semibold mt-0.5">{formatAmount(l.pricePerShare)}/share</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                              {up ? "▲" : "▼"} {Math.abs(l.changePercent).toFixed(1)}%
                            </span>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                <Check size={10} className="text-white" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* How swap works */}
              <div className="bg-muted/40 rounded-2xl p-3 text-[10px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground text-xs">How Swap Works</p>
                <p>① Your current shares are listed on the secondary market at market price.</p>
                <p>② You go to the secondary market to buy shares in your chosen farm.</p>
                <p>③ Both transactions settle instantly once matched.</p>
              </div>

              <div className="h-2" />
            </div>

            {/* Footer */}
            <div className="px-4 pb-6 pt-3 border-t border-border flex-shrink-0">
              {confirmed ? (
                <div className="h-12 rounded-2xl bg-green-500 flex items-center justify-center gap-2 text-white font-bold">
                  <Check size={16} /> Taking you to secondary market…
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={onClose}
                    className="h-12 w-1/3 rounded-2xl border border-border text-foreground font-semibold text-sm active:scale-95 transition-transform">
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!selected}
                    className="flex-1 h-12 rounded-2xl bg-blue-600 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    <ArrowLeftRight size={15} />
                    {selected ? `Swap into ${selected.farmName.split(" ")[0]}…` : "Select a farm to swap into"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
