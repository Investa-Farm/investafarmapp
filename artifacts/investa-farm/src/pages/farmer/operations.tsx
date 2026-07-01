import { useState, useEffect } from "react";
import { useGetFarmerDashboard } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, isDemoAccount, getToken } from "@/lib/auth";
import { Leaf, Droplets, Sun, CheckCircle2, Clock, Plus, X, Tag, Copy, Check, ShoppingCart, ChevronRight, AlertTriangle, Search, Loader2, MapPin, DollarSign, BarChart3, TrendingUp, Wallet, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RepayModal } from "@/components/repay-modal";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

type OrderItem = { name: string; qty: string; unit: string };

const AGRO_ITEMS: Record<string, { items: OrderItem[]; icon: string }> = {
  seeds:       { icon: "🌱", items: [{ name: "Certified Hybrid Seeds", qty: "50", unit: "kg" }, { name: "Open Pollinated Seeds", qty: "25", unit: "kg" }] },
  fertilizer:  { icon: "🪣", items: [{ name: "DAP Fertilizer", qty: "1", unit: "bag (50kg)" }, { name: "CAN Fertilizer", qty: "2", unit: "bags (50kg)" }, { name: "NPK 23:23:0", qty: "1", unit: "bag (50kg)" }] },
  pesticides:  { icon: "🛡️", items: [{ name: "Fungicide (Dithane M-45)", qty: "500", unit: "g" }, { name: "Insecticide (Lambda)", qty: "200", unit: "ml" }] },
  default:     { icon: "📦", items: [{ name: "Farm Inputs Package", qty: "1", unit: "set" }] },
};

function getItemsForPurpose(purpose: string) {
  const p = (purpose ?? "").toLowerCase();
  if (p.includes("seed")) return AGRO_ITEMS.seeds;
  if (p.includes("fertil")) return AGRO_ITEMS.fertilizer;
  if (p.includes("pest") || p.includes("spray")) return AGRO_ITEMS.pesticides;
  return AGRO_ITEMS.default;
}

// Rough lat/lng centres for Kenya counties — used only for proximity sort
const COUNTY_COORDS: Record<string, [number, number]> = {
  nairobi: [-1.2921, 36.8219], mombasa: [-4.0435, 39.6682], kisumu: [-0.1022, 34.7617],
  nakuru: [-0.3031, 36.0800], eldoret: [0.5143, 35.2698], thika: [-1.0332, 37.0693],
  machakos: [-1.5177, 37.2634], meru: [0.0467, 37.6500], nyeri: [-0.4167, 36.9500],
  kakamega: [0.2827, 34.7519], kitale: [1.0154, 35.0062], garissa: [-0.4532, 42.0000],
  kisii: [-0.6817, 34.7667], kericho: [-0.3696, 35.2863], bungoma: [0.5635, 34.5606],
  embu: [-0.5300, 37.4581], turkana: [3.1130, 35.5961], mandera: [3.9366, 41.8670],
  wajir: [1.7471, 40.0574], marsabit: [2.3284, 37.9899], isiolo: [0.3541, 37.5820],
  laikipia: [0.3601, 36.7820], samburu: [1.0756, 37.1109], trans_nzoia: [1.0066, 34.9508],
  west_pokot: [1.6223, 35.3476], nandi: [0.1831, 35.1014], baringo: [0.4665, 35.9618],
  elgeyo_marakwet: [1.0285, 35.5116], narok: [-1.0817, 35.8764], kajiado: [-2.0985, 36.7820],
  kwale: [-4.1839, 39.4532], kilifi: [-3.6305, 39.8499], tana_river: [-0.7800, 40.0600],
  lamu: [-2.2686, 40.9020], taita_taveta: [-3.3165, 38.4832], homa_bay: [-0.5233, 34.4571],
  migori: [-1.0634, 34.4731], siaya: [-0.0607, 34.2906], vihiga: [0.0768, 34.7235],
  busia: [0.4605, 34.1116], bomet: [-0.7877, 35.3415], nyamira: [-0.5667, 34.9333],
  kirinyaga: [-0.5618, 37.2976], muranga: [-0.7189, 37.1491], kiambu: [-1.0311, 36.8316],
  nyandarua: [-0.1897, 36.3581],
};

function distKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function VoucherOrderModal({ voucher, token, onClose }: { voucher: any; token: string; onClose: () => void }) {
  const [step, setStep] = useState<"select" | "supplier" | "confirm" | "done">("select");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [countyFilter, setCountyFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedSupplierName, setConfirmedSupplierName] = useState<string>("");
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const { items, icon } = getItemsForPurpose(voucher.purpose);

  // Request geolocation when the supplier step becomes active
  useEffect(() => {
    if (step === "supplier" && !userCoords && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserCoords([pos.coords.latitude, pos.coords.longitude]),
        () => {} // silently ignore if denied
      );
    }
  }, [step]);

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<{ id: number; name: string; county: string; badge: string }[]>({
    queryKey: ["agribusiness-suppliers"],
    queryFn: async () => {
      const r = await fetch("/api/agribusiness/suppliers", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 5 * 60_000,
    enabled: step === "supplier",
  });

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const toggleItem = (name: string) =>
    setSelected(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name]);

  const handleConfirm = async () => {
    if (!selectedSupplierId) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/farmer/voucher-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ agribusinessId: selectedSupplierId, voucherCode: voucher.voucherCode, loanId: voucher.id, items: selected }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Failed to place order");
      }
      const d = await r.json() as { supplierName: string };
      setConfirmedSupplierName(d.supplierName ?? selectedSupplier?.name ?? "the supplier");
      setStep("done");
    } catch (e: unknown) {
      setError((e as Error).message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={step !== "done" ? onClose : undefined} />
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="relative w-full max-w-[430px] bg-card rounded-t-3xl shadow-2xl px-5 pt-5 pb-10 max-h-[85dvh] overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-foreground">
                {step === "select" && "Select Inputs"}
                {step === "supplier" && "Choose Supplier"}
                {step === "confirm" && "Confirm Order"}
                {step === "done" && "Order Placed!"}
              </p>
              <p className="text-muted-foreground text-xs">Voucher {voucher.voucherCode} · {formatKES(voucher.amount)}</p>
            </div>
            {step !== "done" && (
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Step indicator */}
          {step !== "done" && (
            <div className="flex items-center gap-1.5 mb-4">
              {(["select", "supplier", "confirm"] as const).map((s, i) => (
                <div key={s} className={`h-1 rounded-full flex-1 transition-colors ${
                  s === step ? "bg-primary" : (["select","supplier","confirm"].indexOf(step) > i ? "bg-primary/40" : "bg-muted")
                }`} />
              ))}
            </div>
          )}

          {/* Step 1: Select items */}
          {step === "select" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Select inputs to order — covered by your voucher:</p>
              {items.map(item => (
                <button key={item.name} onClick={() => toggleItem(item.name)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${selected.includes(item.name) ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                  <span className="text-lg flex-shrink-0">{icon}</span>
                  <div className="flex-1">
                    <p className="text-foreground font-semibold text-sm">{item.name}</p>
                    <p className="text-muted-foreground text-xs">{item.qty} {item.unit}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected.includes(item.name) ? "border-primary bg-primary" : "border-border"}`}>
                    {selected.includes(item.name) && <Check size={11} className="text-white" />}
                  </div>
                </button>
              ))}
              <button
                disabled={selected.length === 0}
                onClick={() => setStep("supplier")}
                className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                <ShoppingCart size={16} />
                Choose Supplier ({selected.length} item{selected.length !== 1 ? "s" : ""})
              </button>
            </div>
          )}

          {/* Step 2: Pick supplier */}
          {step === "supplier" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Select a registered agro-dealer to fulfil this order:</p>
              {/* County filter */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={countyFilter}
                  onChange={e => setCountyFilter(e.target.value)}
                  placeholder="Filter by county or name…"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-border bg-muted/40 focus:outline-none focus:border-primary"
                />
                {countyFilter && (
                  <button onClick={() => setCountyFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <X size={11} />
                  </button>
                )}
              </div>
              {suppliersLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
                </div>
              ) : suppliers.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-2">
                  <p className="text-2xl">🏪</p>
                  <p className="text-amber-800 font-semibold text-sm">No registered suppliers yet</p>
                  <p className="text-amber-600 text-xs leading-relaxed">
                    Share Investa Farm with your local agro-dealer and ask them to register as an input supplier.
                  </p>
                </div>
              ) : suppliers.filter((s: any) => !countyFilter || s.name?.toLowerCase().includes(countyFilter.toLowerCase()) || s.county?.toLowerCase().includes(countyFilter.toLowerCase())).length === 0 ? (
                <div className="bg-muted rounded-2xl p-4 text-center">
                  <MapPin size={16} className="text-muted-foreground mx-auto mb-1.5" />
                  <p className="text-muted-foreground text-xs">No suppliers found for "{countyFilter}"</p>
                </div>
              ) : (() => {
                const filtered = suppliers.filter((s: any) => !countyFilter || s.name?.toLowerCase().includes(countyFilter.toLowerCase()) || s.county?.toLowerCase().includes(countyFilter.toLowerCase()));
                // Sort by distance if user coords available, otherwise alphabetical
                const sorted = userCoords
                  ? [...filtered].sort((a: any, b: any) => {
                      const getCoords = (county: string) => COUNTY_COORDS[county?.toLowerCase().replace(/\s+/g, "_")] ?? null;
                      const ac = getCoords(a.county);
                      const bc = getCoords(b.county);
                      const da = ac ? distKm(userCoords[0], userCoords[1], ac[0], ac[1]) : Infinity;
                      const db2 = bc ? distKm(userCoords[0], userCoords[1], bc[0], bc[1]) : Infinity;
                      return da - db2;
                    })
                  : filtered;
                return (
                  <>
                    {userCoords && (
                      <div className="flex items-center gap-1.5 text-[10px] text-primary bg-primary/5 px-2.5 py-1.5 rounded-lg">
                        <MapPin size={10} /> Sorted by distance from your location
                      </div>
                    )}
                    {sorted.map((s: any) => {
                      const coords = COUNTY_COORDS[s.county?.toLowerCase().replace(/\s+/g, "_")] ?? null;
                      const dist = userCoords && coords ? distKm(userCoords[0], userCoords[1], coords[0], coords[1]) : null;
                      return (
                        <button key={s.id} onClick={() => setSelectedSupplierId(s.id)}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${selectedSupplierId === s.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0 text-lg">🏪</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground font-semibold text-sm truncate">{s.name}</p>
                            <p className="text-muted-foreground text-xs">{s.county}{dist !== null ? ` · ${dist < 1 ? "<1" : Math.round(dist)} km away` : ""}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{s.badge}</span>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedSupplierId === s.id ? "border-primary bg-primary" : "border-border"}`}>
                              {selectedSupplierId === s.id && <Check size={9} className="text-white" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                );
              })()}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={() => setStep("select")}
                  className="py-3 rounded-xl border border-border text-foreground text-sm font-semibold active:scale-95 transition-transform">
                  ← Back
                </button>
                <button
                  disabled={!selectedSupplierId || suppliersLoading}
                  onClick={() => setStep("confirm")}
                  className="py-3 rounded-xl bg-primary text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-50">
                  Review Order →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === "confirm" && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-2xl p-3.5 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Order Summary</p>
                {selected.map(name => {
                  const item = items.find(i => i.name === name)!;
                  return (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-foreground text-sm">{name}</span>
                      <span className="text-muted-foreground text-xs">{item.qty} {item.unit}</span>
                    </div>
                  );
                })}
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-semibold text-sm">Voucher Value</span>
                    <span className="text-primary font-bold text-sm">{formatKES(voucher.amount)}</span>
                  </div>
                  {selectedSupplier && (
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-muted-foreground text-xs">Supplier</span>
                      <span className="text-foreground text-xs font-medium">{selectedSupplier.name} · {selectedSupplier.county}</span>
                    </div>
                  )}
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-700 text-xs">{error}</p>
                </div>
              )}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-green-700 text-xs leading-relaxed">
                  Once confirmed, <strong>{selectedSupplier?.name}</strong> will receive your order and prepare your inputs.
                  Present voucher <strong>{voucher.voucherCode}</strong> on collection — no cash required.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setStep("supplier")} disabled={submitting}
                  className="py-3 rounded-xl border border-border text-foreground text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50">
                  ← Back
                </button>
                <button onClick={handleConfirm} disabled={submitting}
                  className="py-3 rounded-xl bg-primary text-white text-sm font-bold active:scale-95 transition-transform flex items-center justify-center gap-1.5 disabled:opacity-70">
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><CheckCircle2 size={14} /> Confirm Order</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-green-500" />
              </div>
              <p className="font-bold text-foreground text-lg">Order Placed!</p>
              <p className="text-muted-foreground text-sm max-w-xs">
                <strong>{confirmedSupplierName}</strong> has received your order and will prepare your inputs.
                Show code <span className="font-mono font-bold text-foreground">{voucher.voucherCode}</span> on collection.
              </p>
              <div className="w-full bg-muted/50 rounded-xl p-3 text-left space-y-1">
                <p className="text-xs text-muted-foreground font-medium">What's next?</p>
                <p className="text-xs text-foreground">1. Wait for the supplier to confirm availability</p>
                <p className="text-xs text-foreground">2. Visit the supplier's location</p>
                <p className="text-xs text-foreground">3. Show your voucher code — no cash needed</p>
              </div>
              <button onClick={onClose} className="w-full bg-primary text-white font-bold py-3 rounded-xl active:scale-95 transition-all mt-1">Done</button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function VoucherSection() {
  const token = getToken();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [orderVoucher, setOrderVoucher] = useState<any | null>(null);
  const { data: vouchers = [], isLoading } = useQuery<any[]>({
    queryKey: ["farmer-vouchers"],
    queryFn: async () => {
      const r = await fetch("/api/farmer/vouchers", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });

  const handleCopy = async (code: string, id: number) => {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const approvedVouchers = vouchers.filter(v => v.voucherCode);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
          <Tag size={12} className="text-amber-700" />
        </div>
        <p className="text-sm font-semibold text-foreground">Input Vouchers</p>
      </div>

      {isLoading ? (
        <div className="h-20 rounded-2xl bg-muted animate-pulse" />
      ) : approvedVouchers.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <Tag size={20} className="text-amber-400 mx-auto mb-2" />
          <p className="text-amber-800 font-medium text-sm">No vouchers yet</p>
          <p className="text-amber-600 text-xs mt-0.5">Approved loan applications generate input vouchers redeemable at partner agro-dealers.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {approvedVouchers.map(v => (
            <div key={v.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2 flex items-center justify-between">
                <p className="text-white font-bold text-xs uppercase tracking-wide">🎟 Input Voucher</p>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  v.status === "disbursed" ? "bg-green-100 text-green-700" : "bg-white/20 text-white"
                }`}>
                  {v.status === "disbursed" ? "Disbursed" : "Approved"}
                </span>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-[10px]">Amount</p>
                    <p className="text-foreground font-bold text-base">{formatKES(v.amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-[10px]">Purpose</p>
                    <p className="text-foreground font-semibold text-xs capitalize">{v.purpose}</p>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-muted-foreground text-[9px] mb-0.5">Voucher Code</p>
                    <p className="text-foreground font-mono font-bold text-sm tracking-wider">{v.voucherCode}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(v.voucherCode, v.id)}
                    className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
                  >
                    {copiedId === v.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-primary" />}
                  </button>
                </div>
                <p className="text-muted-foreground text-[10px]">Present this code at any partner agro-dealer to redeem inputs for your farm.</p>
                <button
                  onClick={() => setOrderVoucher(v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-xs font-bold active:scale-95 transition-transform">
                  <ShoppingCart size={13} />
                  Place Order on this Voucher
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {orderVoucher && <VoucherOrderModal voucher={orderVoucher} token={token ?? ""} onClose={() => setOrderVoucher(null)} />}
    </div>
  );
}

const defaultTasks = [
  { id: 1, label: "Seeds Planted", done: true, icon: "🌱", notes: "50 kg certified hybrid seeds — Rows A–D", category: "Planting" },
  { id: 2, label: "Fertilizer Applied", done: true, icon: "🪣", notes: "DAP fertilizer — 25 kg per acre", category: "Nutrition" },
  { id: 3, label: "Irrigation Due", done: false, icon: "💧", notes: "Scheduled for today — drip system", category: "Water" },
  { id: 4, label: "Pesticide Spray", done: false, icon: "🌿", notes: "Week 3 schedule — aphid prevention", category: "Protection" },
  { id: 5, label: "Soil Test", done: false, icon: "🔬", notes: "Send samples to extension officer", category: "Quality" },
];

export default function FarmerOperations() {
  const { data: dashboard, isLoading } = useGetFarmerDashboard();
  const isDemo = isDemoAccount();
  const token = getToken();
  const [tasks, setTasks] = useState(isDemo ? defaultTasks : []);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [showDisasterModal, setShowDisasterModal] = useState(false);
  const [harvestTons, setHarvestTons] = useState("");
  const [harvestNotes, setHarvestNotes] = useState("");
  const [disasterType, setDisasterType] = useState("flood");
  const [disasterNotes, setDisasterNotes] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [repayLoan, setRepayLoan] = useState<any>(null);
  const [repayOpen, setRepayOpen] = useState(false);

  const { data: loans = [] } = useQuery<any[]>({
    queryKey: ["loan-apps"],
    queryFn: async () => {
      const r = await fetch("/api/loans/applications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
    enabled: !!token,
  });

  const activeLoans = loans.filter((l: any) => ["approved","disbursed","submitted","under_review"].includes(l.status));
  const clearedLoans = loans.filter((l: any) => l.status === "disbursed" && false); 

  const { data: farmUpdates } = useQuery<any[]>({
    queryKey: ["farmer-updates"],
    queryFn: async () => {
      const r = await fetch("/api/farmer/updates", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
    enabled: !!token && !isDemo,
  });
  const lastUpdateDate = farmUpdates?.[0]?.createdAt ? new Date(farmUpdates[0].createdAt) : null;
  const daysSinceUpdate = lastUpdateDate ? Math.floor((Date.now() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const showUpdateNudge = !isDemo && daysSinceUpdate !== null && daysSinceUpdate >= 5;

  const submitHarvestReport = async () => {
    if (!harvestTons) return;
    setSubmittingReport(true);
    try {
      await fetch("/api/farmer/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: `Harvest Report: ${harvestTons} tons`, content: harvestNotes || `Harvest completed. Yield: ${harvestTons} metric tons.`, type: "harvest" }),
      });
      setReportDone(true);
      setTimeout(() => { setShowHarvestModal(false); setReportDone(false); setHarvestTons(""); setHarvestNotes(""); }, 1800);
    } finally { setSubmittingReport(false); }
  };

  const submitDisasterReport = async () => {
    if (!disasterNotes) return;
    setSubmittingReport(true);
    try {
      await fetch("/api/farmer/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: `⚠️ ${disasterType.charAt(0).toUpperCase() + disasterType.slice(1)} Alert`, content: disasterNotes, type: "disaster" }),
      });
      setReportDone(true);
      setTimeout(() => { setShowDisasterModal(false); setReportDone(false); setDisasterNotes(""); }, 1800);
    } finally { setSubmittingReport(false); }
  };

  const toggleTask = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setTasks(prev => [...prev, {
      id: Date.now(), label: newLabel, done: false, icon: "📋", notes: newNotes, category: "Custom"
    }]);
    setNewLabel(""); setNewNotes(""); setShowAdd(false);
  };

  const done = tasks.filter(t => t.done).length;

  return (
    <div className="app-shell pb-20 page-enter" data-testid="farmer-operations">
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-xs font-medium">Farm Management</p>
            <h1 className="text-white text-xl font-bold">Operations</h1>
          </div>
          <button onClick={() => setShowAdd(s => !s)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
            <Plus size={17} className="text-white" />
          </button>
        </div>
        <div className="mt-3 bg-white/10 rounded-xl p-3 flex items-center justify-between">
          <span className="text-white/80 text-xs">Tasks completed today</span>
          <span className="text-white font-bold text-sm">{done}/{tasks.length}</span>
        </div>
        <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${(done / tasks.length) * 100}%` }} />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Season stats */}
        {isLoading ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : dashboard && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Farms Active", val: String(dashboard.activeFarms) },
              { label: "Growth", val: `${dashboard.growthPercent}%` },
              { label: "Investors", val: String(dashboard.totalInvestors) },
            ].map(({ label, val }) => (
              <div key={label} className="bg-card rounded-xl border border-border p-3 text-center">
                <p className="text-foreground font-bold text-base">{val}</p>
                <p className="text-muted-foreground text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add task form */}
        <AnimatePresence>
          {showAdd && (
            <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              onSubmit={addTask} className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Add Task</p>
                <button type="button" onClick={() => setShowAdd(false)}>
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                placeholder="Task name" required
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-primary" />
              <input value={newNotes} onChange={e => setNewNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-primary" />
              <button type="submit"
                className="w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-xl active:scale-95 transition-transform">
                Add Task
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Task list */}
        <div>
          <p className="text-sm font-semibold mb-3">Today's Tasks</p>
          <div className="space-y-2">
            {tasks.map((task) => (
              <button key={task.id} data-testid={`task-${task.id}`} onClick={() => toggleTask(task.id)}
                className={`w-full bg-card rounded-2xl border p-4 flex items-start gap-3 text-left transition-all active:scale-[0.98] ${task.done ? "border-green-200 bg-green-50/30" : "border-border"}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${task.done ? "bg-green-100" : "bg-muted"}`}>
                  {task.done ? <CheckCircle2 size={18} className="text-green-600" /> : <span>{task.icon}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${task.done ? "text-green-700 line-through opacity-60" : "text-foreground"}`}>
                      {task.label}
                    </p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${task.done ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {task.done ? "Done" : "Pending"}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">{task.notes}</p>
                  <span className="text-[10px] text-primary/70 font-medium mt-1 inline-block">{task.category}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Earnings summary */}
        {dashboard && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <p className="text-sm font-semibold text-primary mb-3">Season Earnings</p>
            <div className="space-y-2">
              {[
                { label: "Funds Received", val: formatKES(dashboard.fundsReceived) },
                { label: "Profit Estimate", val: formatKES(dashboard.profit) },
                { label: "Funding Target", val: formatKES(dashboard.fundingTarget) },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className="text-foreground font-semibold text-sm">{val}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 h-1.5 bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(100, (dashboard.fundsReceived / dashboard.fundingTarget) * 100)}%` }} />
            </div>
            <p className="text-muted-foreground text-[10px] mt-1 text-right">
              {Math.round((dashboard.fundsReceived / dashboard.fundingTarget) * 100)}% funded
            </p>
          </div>
        )}

        {/* ── Loan Repayment Tracker ────────────────────────────────── */}
        {activeLoans.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
                <Wallet size={12} className="text-amber-700" />
              </div>
              <p className="text-sm font-semibold text-foreground">Loan Repayment</p>
            </div>

            {activeLoans.map((loan: any) => {
              const principal = Number(loan.amount);
              const totalOwed = principal * 1.08;
              const monthlyPayment = totalOwed / (loan.repaymentPeriodMonths || 6);
              const createdAt = new Date(loan.createdAt || loan.submittedAt || Date.now());
              const monthsElapsed = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)));
              const repaid = loan.status === "disbursed" && monthsElapsed === 0 ? 0 : Math.min(monthsElapsed * monthlyPayment, totalOwed);
              const pct = Math.min(100, Math.round((repaid / totalOwed) * 100));
              const remaining = Math.max(0, totalOwed - repaid);
              const canRepay = ["approved","disbursed"].includes(loan.status);

              const statusColors: Record<string,string> = {
                approved: "bg-blue-100 text-blue-700",
                disbursed: "bg-green-100 text-green-700",
                submitted: "bg-amber-100 text-amber-700",
                under_review: "bg-purple-100 text-purple-700",
              };

              return (
                <div key={loan.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                  {/* Card header */}
                  <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-xs uppercase tracking-wide">
                        {loan.cropName ?? loan.purpose ?? "Farm"} Loan
                      </p>
                      <p className="text-white/80 text-[10px] mt-0.5">{loan.farmLocation ?? "Kenya"}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full capitalize ${statusColors[loan.status] ?? "bg-white/20 text-white"}`}>
                      {loan.status?.replace("_", " ")}
                    </span>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Key figures */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Principal", val: formatKES(principal), color: "text-foreground" },
                        { label: "Total Owed", val: formatKES(totalOwed), color: "text-amber-700" },
                        { label: "Monthly", val: formatKES(monthlyPayment), color: "text-primary" },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="bg-muted/50 rounded-xl p-2.5 text-center">
                          <p className="text-muted-foreground text-[9px] uppercase tracking-wider">{label}</p>
                          <p className={`font-bold text-xs mt-0.5 ${color}`}>{val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Repayment progress */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-foreground">Repayment Progress</p>
                        <span className="text-xs font-bold text-primary">{pct}%</span>
                      </div>
                      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: pct >= 75 ? "#16a34a" : pct >= 40 ? "#f59e0b" : "#3b82f6" }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
                        <span>{formatKES(repaid)} repaid</span>
                        <span>{formatKES(remaining)} remaining</span>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                      <Clock size={11} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground text-[10px]">
                        {loan.repaymentPeriodMonths} month plan · {Math.max(0, (loan.repaymentPeriodMonths || 6) - monthsElapsed)} months remaining
                      </span>
                    </div>

                    {/* CTA */}
                    {canRepay && (
                      <button
                        onClick={() => { setRepayLoan(loan); setRepayOpen(true); }}
                        className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 text-sm">
                        <DollarSign size={15} />
                        Make a Repayment
                        <ArrowRight size={13} />
                      </button>
                    )}
                    {!canRepay && (
                      <div className="text-center text-muted-foreground text-[11px] py-1">
                        Repayment available once loan is approved &amp; disbursed
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Revenue Sharing Breakdown ─────────────────────────────── */}
        {dashboard && (dashboard.fundingTarget > 0 || activeLoans.length > 0) && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary/90 to-emerald-600 px-4 py-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-white" />
                <p className="text-white font-bold text-sm">Revenue Sharing at Harvest</p>
              </div>
              <p className="text-white/70 text-[10px] mt-0.5">How your harvest revenue is split between you and investors</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Visual bar */}
              <div className="space-y-1.5">
                <div className="flex h-4 rounded-xl overflow-hidden gap-0.5">
                  <div className="bg-primary flex items-center justify-center" style={{ width: "55%" }}>
                    <span className="text-white text-[9px] font-black">55%</span>
                  </div>
                  <div className="bg-amber-400 flex items-center justify-center" style={{ width: "44.5%" }}>
                    <span className="text-white text-[9px] font-black">44.5%</span>
                  </div>
                  <div className="bg-muted-foreground/30 rounded-r-xl flex items-center justify-center" style={{ width: "0.5%" }} />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-sm" />
                    <span className="font-semibold text-foreground">You (Farmer)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-sm" />
                    <span className="font-semibold text-foreground">Investors</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-muted-foreground/30 rounded-sm" />
                    <span className="text-muted-foreground">Platform</span>
                  </div>
                </div>
              </div>

              {/* Real-number breakdown */}
              {(() => {
                const fundingTarget = dashboard.fundingTarget || (activeLoans[0] ? Number(activeLoans[0].amount) : 0);
                const projectedRevenue = fundingTarget * 1.40;
                const farmerShare = projectedRevenue * 0.55;
                const investorShare = projectedRevenue * 0.445;
                const platformFee = projectedRevenue * 0.005;
                return (
                  <div className="space-y-2">
                    {[
                      { label: "Projected Gross Revenue", val: formatKES(projectedRevenue), color: "text-foreground", bg: "bg-muted/40", icon: "📦" },
                      { label: "Your 55% Share", val: formatKES(farmerShare), color: "text-primary font-black", bg: "bg-primary/5 border border-primary/15", icon: "🌾" },
                      { label: "Investor 44.5% Share", val: formatKES(investorShare), color: "text-amber-700 font-bold", bg: "bg-amber-50 border border-amber-100", icon: "📈" },
                      { label: "Platform Fee (0.5%)", val: formatKES(platformFee), color: "text-muted-foreground", bg: "bg-muted/40", icon: "🏛️" },
                    ].map(({ label, val, color, bg, icon }) => (
                      <div key={label} className={`${bg} rounded-xl px-3 py-2.5 flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{icon}</span>
                          <span className="text-foreground text-xs">{label}</span>
                        </div>
                        <span className={`text-xs ${color}`}>{val}</span>
                      </div>
                    ))}
                    <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                      <p className="text-green-700 text-[10px] leading-relaxed">
                        💡 Based on a 40% revenue multiplier (industry average for Kenya smallholder farms). Your actual payout depends on real harvest yield and market prices.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Update nudge */}
        {showUpdateNudge && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-amber-800 font-bold text-xs">{daysSinceUpdate} days since your last farm update</p>
              <p className="text-amber-700 text-[11px]">Investors are watching — post an update to boost confidence.</p>
            </div>
            <a href="/farmer/updates" className="text-[11px] font-bold text-amber-900 bg-amber-200 px-2.5 py-1.5 rounded-xl active:scale-95 transition-transform flex-shrink-0 no-underline">Post →</a>
          </div>
        )}

        {/* Harvest Report + Disaster Report quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setShowHarvestModal(true)}
            className="bg-green-50 border border-green-200 rounded-2xl p-3.5 flex flex-col items-center gap-1.5 active:scale-95 transition-transform text-center">
            <span className="text-2xl">📊</span>
            <span className="text-green-800 font-bold text-xs">Report Harvest</span>
            <span className="text-green-600 text-[10px]">Submit yield data</span>
          </button>
          <button onClick={() => setShowDisasterModal(true)}
            className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex flex-col items-center gap-1.5 active:scale-95 transition-transform text-center">
            <span className="text-2xl">⚠️</span>
            <span className="text-red-800 font-bold text-xs">Report Disaster</span>
            <span className="text-red-600 text-[10px]">Flood, drought, pest</span>
          </button>
        </div>

        {/* Voucher Section */}
        <VoucherSection />
      </div>

      {/* Harvest Report Modal */}
      <AnimatePresence>
        {showHarvestModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-[430px] bg-background rounded-t-3xl p-5 pb-10">
              <div className="flex justify-center mb-3"><div className="w-10 h-1 bg-border rounded-full" /></div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">📊 Report Harvest</h3>
                <button onClick={() => setShowHarvestModal(false)}><X size={18} className="text-muted-foreground" /></button>
              </div>
              {reportDone ? (
                <div className="text-center py-8 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl mx-auto">✅</div>
                  <p className="font-bold text-foreground">Report submitted!</p>
                  <p className="text-muted-foreground text-sm">Investors have been notified of your harvest results.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Yield (metric tons) *</label>
                    <input value={harvestTons} onChange={e => setHarvestTons(e.target.value)} type="number" min="0" step="0.1"
                      placeholder="e.g. 2.4"
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Notes</label>
                    <textarea value={harvestNotes} onChange={e => setHarvestNotes(e.target.value)} rows={3}
                      placeholder="Quality grade, market price achieved, challenges…"
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-primary resize-none" />
                  </div>
                  <button onClick={submitHarvestReport} disabled={!harvestTons || submittingReport}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                    {submittingReport ? <Loader2 size={15} className="animate-spin" /> : null}
                    {submittingReport ? "Submitting…" : "Submit Harvest Report"}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disaster Report Modal */}
      <AnimatePresence>
        {showDisasterModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-[430px] bg-background rounded-t-3xl p-5 pb-10">
              <div className="flex justify-center mb-3"><div className="w-10 h-1 bg-border rounded-full" /></div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">⚠️ Report Crop Issue</h3>
                <button onClick={() => setShowDisasterModal(false)}><X size={18} className="text-muted-foreground" /></button>
              </div>
              {reportDone ? (
                <div className="text-center py-8 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl mx-auto">📨</div>
                  <p className="font-bold text-foreground">Alert sent!</p>
                  <p className="text-muted-foreground text-sm">Admin and investors have been notified. Our team will reach out shortly.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Issue Type *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["flood", "drought", "pest", "disease", "fire", "other"].map(t => (
                        <button key={t} onClick={() => setDisasterType(t)}
                          className={`py-2 rounded-xl border text-xs font-semibold capitalize transition-all ${disasterType === t ? "border-red-500 bg-red-50 text-red-700" : "border-border text-muted-foreground"}`}>
                          {t === "flood" ? "🌊" : t === "drought" ? "☀️" : t === "pest" ? "🐛" : t === "disease" ? "🦠" : t === "fire" ? "🔥" : "📋"} {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Describe the situation *</label>
                    <textarea value={disasterNotes} onChange={e => setDisasterNotes(e.target.value)} rows={4}
                      placeholder="What happened? Which crops are affected? Estimated damage…"
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-primary resize-none" />
                  </div>
                  <button onClick={submitDisasterReport} disabled={!disasterNotes || submittingReport}
                    className="w-full bg-red-500 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                    {submittingReport ? <Loader2 size={15} className="animate-spin" /> : null}
                    {submittingReport ? "Submitting…" : "Send Alert"}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RepayModal open={repayOpen} onClose={() => setRepayOpen(false)} loan={repayLoan} />
      <BottomNav role="farmer" />
    </div>
  );
}
