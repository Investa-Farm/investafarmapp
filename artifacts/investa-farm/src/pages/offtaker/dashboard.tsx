import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Truck, FileText, BarChart2, User,
  MapPin, CheckCircle2, Clock, Package, TrendingUp,
  ChevronRight, Phone, Loader2, LogOut, X, Plus,
  Search, AlertCircle, ShoppingCart, ArrowUpRight,
  Leaf, Calendar, Star, Filter,
} from "lucide-react";
import { getToken, getStoredUser, formatKES } from "@/lib/auth";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

const TABS = [
  { id: "home",      label: "Home",      icon: Home      },
  { id: "farms",     label: "Farms",     icon: Leaf      },
  { id: "contracts", label: "Contracts", icon: FileText  },
  { id: "prices",    label: "Prices",    icon: BarChart2 },
  { id: "profile",   label: "Profile",   icon: User      },
] as const;
type Tab = typeof TABS[number]["id"];

interface Farm {
  id: number; name: string; cropType: string; location: string; status: string;
  fundedPercent: number; farmerName: string; farmerPhone: string | null;
  pricePerKgKes: number; estimatedYieldTons: number; daysToHarvest: number;
  harvestDate: string; certifications: string[]; minOrderTons: number; maxOrderTons: number;
}
interface Contract {
  id: number; farmerName: string; cropType: string; quantityTons: number;
  totalKes: number; status: string; createdAt: string; referenceCode: string;
  pricePerKg: number;
}
interface Stats {
  activeContracts: number; fulfilledContracts: number;
  totalPurchasedKes: number; availableFarms: number;
}
interface Price { crop: string; pricePerKg: number; unit: string; trend: string; exchange: string; }

const STATUS_COLOR: Record<string, string> = {
  pending: "text-amber-600 bg-amber-50 border-amber-200",
  confirmed: "text-blue-600 bg-blue-50 border-blue-200",
  in_transit: "text-indigo-600 bg-indigo-50 border-indigo-200",
  fulfilled: "text-green-600 bg-green-50 border-green-200",
  cancelled: "text-red-500 bg-red-50 border-red-100",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", in_transit: "In Transit",
  fulfilled: "Fulfilled", cancelled: "Cancelled",
};

const CROP_EMOJI: Record<string, string> = {
  maize: "🌽", wheat: "🌾", coffee: "☕", tea: "🍃", rice: "🍚",
  tomatoes: "🍅", avocado: "🥑", beans: "🫘", kale: "🥬",
  cabbage: "🥬", sunflower: "🌻", sorghum: "🌾",
};
function cropEmoji(c: string) { return CROP_EMOJI[c?.toLowerCase()] ?? "🌿"; }

export default function OfftakerDashboard() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const user = getStoredUser() as any;

  const [tab, setTab] = useState<Tab>("home");
  const [stats, setStats] = useState<Stats | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [farmSearch, setFarmSearch] = useState("");
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderTons, setOrderTons] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderDone, setOrderDone] = useState<{ ref: string; total: number } | null>(null);
  const [cropFilter, setCropFilter] = useState<string>("all");

  useEffect(() => {
    if (!token) { setLocation("/cooperative-auth"); return; }
    loadAll();
  }, [token]);

  const headers = { Authorization: `Bearer ${token}` };

  async function loadAll() {
    setLoading(true);
    try {
      const [statsR, farmsR, contractsR, pricesR] = await Promise.all([
        fetch("/api/offtaker/stats", { headers }).catch(() => null),
        fetch("/api/offtaker/farms", { headers }).catch(() => null),
        fetch("/api/offtaker/contracts", { headers }).catch(() => null),
        fetch("/api/offtaker/market-prices", { headers }).catch(() => null),
      ]);
      if (statsR?.ok) setStats(await statsR.json());
      if (farmsR?.ok) setFarms(await farmsR.json());
      if (contractsR?.ok) setContracts(await contractsR.json());
      if (pricesR?.ok) setPrices(await pricesR.json());
    } finally { setLoading(false); }
  }

  async function submitOrder() {
    if (!selectedFarm || !orderTons) return;
    setOrderSubmitting(true);
    try {
      const r = await fetch("/api/offtaker/contract", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          farmId: selectedFarm.id,
          quantityTons: Number(orderTons),
          pricePerKgKes: selectedFarm.pricePerKgKes,
          notes: orderNote || undefined,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setOrderDone({ ref: data.referenceCode, total: data.totalKes });
        setContracts(prev => [{ id: data.contractId, farmerName: selectedFarm.farmerName, cropType: selectedFarm.cropType, quantityTons: Number(orderTons), totalKes: data.totalKes, status: "pending", createdAt: new Date().toISOString(), referenceCode: data.referenceCode, pricePerKg: selectedFarm.pricePerKgKes }, ...prev]);
        setStats(s => s ? { ...s, activeContracts: s.activeContracts + 1 } : s);
        import("@/components/confetti-overlay").then(({ showConfetti }) => showConfetti(3000));
        import("@/components/success-toast").then(({ showSuccessToast }) => {
          showSuccessToast("Order placed! 🎉", `Ref: ${data.referenceCode}`);
        });
      }
    } finally { setOrderSubmitting(false); }
  }

  function openOrderSheet(farm: Farm) {
    setSelectedFarm(farm);
    setOrderTons(String(farm.minOrderTons));
    setOrderNote("");
    setOrderDone(null);
    setOrderOpen(true);
  }
  function closeOrder() { setOrderOpen(false); setTimeout(() => { setSelectedFarm(null); setOrderDone(null); }, 400); }
  function handleLogout() {
    localStorage.removeItem("investa_token");
    localStorage.removeItem("investa_user");
    localStorage.removeItem("investa_coop_sub_type");
    setLocation("/cooperative-auth");
  }

  const uniqueCrops = ["all", ...Array.from(new Set(farms.map(f => f.cropType.toLowerCase())))];
  const filteredFarms = farms.filter(f => {
    const matchCrop = cropFilter === "all" || f.cropType.toLowerCase() === cropFilter;
    const matchSearch = !farmSearch || f.name.toLowerCase().includes(farmSearch.toLowerCase()) || f.cropType.toLowerCase().includes(farmSearch.toLowerCase()) || f.location.toLowerCase().includes(farmSearch.toLowerCase());
    return matchCrop && matchSearch;
  });

  const companyName = user?.name ?? "Your Company";
  const totalKes = contracts.filter(c => c.status === "fulfilled").reduce((s, c) => s + c.totalKes, 0);

  return (
    <div className="app-shell" style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden", background: "#f8f9fb" }}>

      {/* ── HEADER ── */}
      <header className="flex-shrink-0 px-4 pt-safe-top"
        style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 40%, #16a34a 80%, #22c55e 100%)" }}>
        <div className="flex items-center gap-3 py-4">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Truck size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider">Offtaker Portal</p>
            <p className="text-white font-bold text-sm truncate">{companyName}</p>
          </div>
          <img src={logoSrc} alt="Investa" className="h-7 opacity-90" />
        </div>

        {tab === "home" && (
          <div className="grid grid-cols-2 gap-2 pb-5">
            {[
              { label: "Active Contracts", val: stats?.activeContracts ?? 0, icon: "📋", accent: "border-blue-300/30 bg-blue-400/15" },
              { label: "Farms Available", val: stats?.availableFarms ?? farms.length, icon: "🌾", accent: "border-green-300/30 bg-green-400/15" },
              { label: "Fulfilled Orders", val: stats?.fulfilledContracts ?? 0, icon: "✅", accent: "border-emerald-300/30 bg-emerald-400/15" },
              { label: "Total Purchased", val: formatKES(stats?.totalPurchasedKes ?? totalKes), icon: "💰", accent: "border-amber-300/30 bg-amber-400/15" },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-3 border ${s.accent} backdrop-blur-sm`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-base">{s.icon}</span>
                  <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider">{s.label}</p>
                </div>
                <p className="text-white font-extrabold text-xl leading-none">{s.val}</p>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="px-4 py-4">

            {/* ── HOME TAB ── */}
            {tab === "home" && (
              <div className="space-y-4">
                {/* Quick actions */}
                <div>
                  <p className="text-foreground font-bold text-sm mb-2">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Browse Farms", icon: Leaf, color: "bg-green-50 border-green-200 text-green-700", action: () => setTab("farms") },
                      { label: "My Contracts", icon: FileText, color: "bg-primary/5 border-primary/20 text-primary", action: () => setTab("contracts") },
                      { label: "Market Prices", icon: BarChart2, color: "bg-blue-50 border-blue-200 text-blue-700", action: () => setTab("prices") },
                      { label: "My Profile", icon: User, color: "bg-amber-50 border-amber-200 text-amber-700", action: () => setTab("profile") },
                    ].map(a => (
                      <button key={a.label} onClick={a.action}
                        className={`p-3.5 rounded-2xl border flex flex-col items-start gap-2 active:scale-95 transition-all ${a.color}`}>
                        <a.icon size={18} />
                        <p className="font-semibold text-xs">{a.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recent contracts */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-foreground font-bold text-sm">Recent Contracts</p>
                    <button onClick={() => setTab("contracts")} className="text-primary text-xs font-semibold">View all</button>
                  </div>
                  {contracts.length === 0 ? (
                    <div className="bg-white border border-border rounded-2xl p-6 text-center">
                      <ShoppingCart size={28} className="text-muted-foreground mx-auto mb-2 opacity-40" />
                      <p className="text-muted-foreground text-sm">No contracts yet</p>
                      <button onClick={() => setTab("farms")}
                        className="mt-3 text-primary text-xs font-semibold bg-primary/5 px-4 py-2 rounded-xl">Browse Farms →</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contracts.slice(0, 3).map(c => (
                        <div key={c.id} className="bg-white border border-border rounded-2xl p-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
                            {cropEmoji(c.cropType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground font-semibold text-xs truncate">{c.referenceCode}</p>
                            <p className="text-muted-foreground text-[10px]">{c.cropType} · {c.quantityTons} tons</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-foreground font-bold text-xs">{formatKES(c.totalKes)}</p>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[c.status] ?? "text-muted-foreground bg-muted"}`}>
                              {STATUS_LABEL[c.status] ?? c.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available farms preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-foreground font-bold text-sm">Available Farms</p>
                    <button onClick={() => setTab("farms")} className="text-primary text-xs font-semibold">See all</button>
                  </div>
                  <div className="space-y-2">
                    {farms.slice(0, 3).map(f => (
                      <div key={f.id} className="bg-white border border-border rounded-2xl p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl flex-shrink-0">
                          {cropEmoji(f.cropType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground font-semibold text-xs truncate">{f.name}</p>
                          <p className="text-muted-foreground text-[10px]">{f.cropType} · {f.location}</p>
                          <div className="w-full h-1 bg-gray-100 rounded-full mt-1">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${f.fundedPercent}%` }} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-green-700 font-bold text-xs">KES {f.pricePerKgKes}/kg</p>
                          <p className="text-muted-foreground text-[10px]">{f.estimatedYieldTons}t est.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── FARMS TAB ── */}
            {tab === "farms" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={farmSearch} onChange={e => setFarmSearch(e.target.value)}
                    placeholder="Search by crop, farm, or location…"
                    className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-white" />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                  {uniqueCrops.map(c => (
                    <button key={c} onClick={() => setCropFilter(c)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                        cropFilter === c ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"
                      }`}>
                      {c === "all" ? "All Crops" : `${cropEmoji(c)} ${c.charAt(0).toUpperCase() + c.slice(1)}`}
                    </button>
                  ))}
                </div>

                {filteredFarms.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground text-sm">No farms match your search.</p>
                  </div>
                ) : filteredFarms.map(f => (
                  <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
                    {/* Coloured top bar */}
                    <div className="h-1.5 bg-gradient-to-r from-green-500 to-emerald-400" style={{ width: `${f.fundedPercent}%` }} />
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center text-3xl flex-shrink-0 border border-green-200">
                          {cropEmoji(f.cropType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground font-extrabold text-sm truncate">{f.name}</p>
                          <p className="text-muted-foreground text-[11px] flex items-center gap-1 mt-0.5">
                            <MapPin size={10} /> {f.location}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {f.certifications.map(c => (
                              <span key={c} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">{c}</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-green-700 font-extrabold text-sm">KES {f.pricePerKgKes}/kg</p>
                          <p className="text-muted-foreground text-[10px]">market rate</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: "Yield Est.", val: `${f.estimatedYieldTons}t`, color: "bg-blue-50 text-blue-700" },
                          { label: "Harvest In", val: `${f.daysToHarvest}d`, color: "bg-amber-50 text-amber-700" },
                          { label: "Min Order", val: `${f.minOrderTons}t`, color: "bg-green-50 text-green-700" },
                        ].map(s => (
                          <div key={s.label} className={`${s.color} rounded-xl p-2 text-center`}>
                            <p className="font-extrabold text-xs">{s.val}</p>
                            <p className="text-[9px] opacity-70 mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground font-medium">Investment Progress</span>
                          <span className="font-bold text-green-600">{f.fundedPercent}% funded</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all" style={{ width: `${f.fundedPercent}%` }} />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {f.farmerPhone && (
                          <a href={`tel:${f.farmerPhone}`}
                            className="h-10 px-3 rounded-xl border border-border text-muted-foreground text-xs flex items-center gap-1.5 active:scale-95 transition-all font-medium">
                            <Phone size={12} /> Call Farmer
                          </a>
                        )}
                        <button onClick={() => openOrderSheet(f)}
                          className="flex-1 h-10 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-green-200">
                          <Plus size={13} /> Place Order
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* ── CONTRACTS TAB ── */}
            {tab === "contracts" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-foreground font-bold text-sm">{contracts.length} Purchase Orders</p>
                  <button onClick={() => setTab("farms")}
                    className="h-8 px-3 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 active:scale-95">
                    <Plus size={12} /> New Order
                  </button>
                </div>

                {contracts.length === 0 ? (
                  <div className="bg-white border border-border rounded-2xl p-8 text-center">
                    <FileText size={32} className="text-muted-foreground mx-auto mb-3 opacity-30" />
                    <p className="text-foreground font-semibold text-sm mb-1">No contracts yet</p>
                    <p className="text-muted-foreground text-xs mb-4">Browse available farms and place your first purchase order.</p>
                    <button onClick={() => setTab("farms")}
                      className="bg-primary text-white font-bold text-xs px-5 py-2.5 rounded-xl active:scale-95">
                      Browse Farms
                    </button>
                  </div>
                ) : contracts.map(c => (
                  <div key={c.id} className="bg-white border border-border rounded-2xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
                        {cropEmoji(c.cropType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-foreground font-bold text-sm">{c.referenceCode}</p>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[c.status] ?? "text-muted-foreground bg-muted border-border"}`}>
                            {STATUS_LABEL[c.status] ?? c.status}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">{c.cropType} · {c.quantityTons} tons from {c.farmerName}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-50 rounded-xl p-2 text-center">
                        <p className="text-foreground font-bold text-xs">{c.quantityTons}t</p>
                        <p className="text-muted-foreground text-[9px]">Quantity</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2 text-center">
                        <p className="text-foreground font-bold text-xs">KES {c.pricePerKg}/kg</p>
                        <p className="text-muted-foreground text-[9px]">Price</p>
                      </div>
                      <div className="bg-primary/5 rounded-xl p-2 text-center">
                        <p className="text-primary font-bold text-xs">{formatKES(c.totalKes)}</p>
                        <p className="text-muted-foreground text-[9px]">Total</p>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-[10px] mt-2 text-right">
                      {new Date(c.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* ── PRICES TAB ── */}
            {tab === "prices" && (
              <div className="space-y-3">
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-center gap-2.5">
                  <BarChart2 size={16} className="text-primary flex-shrink-0" />
                  <div>
                    <p className="text-green-800 font-bold text-xs">Live Commodity Prices</p>
                    <p className="text-primary text-[10px]">Nairobi Agricultural Commodities Exchange · Updated daily</p>
                  </div>
                </div>

                {prices.map(p => {
                  const isUp = p.trend.startsWith("+");
                  return (
                    <div key={p.crop} className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-xl flex-shrink-0">
                        {cropEmoji(p.crop)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-bold text-sm">{p.crop}</p>
                        <p className="text-muted-foreground text-[10px]">{p.exchange} Exchange</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-foreground font-bold text-sm">KES {p.pricePerKg}/kg</p>
                        <p className={`text-xs font-semibold ${isUp ? "text-green-600" : "text-red-500"}`}>
                          {p.trend} today
                        </p>
                      </div>
                    </div>
                  );
                })}

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-amber-800 font-bold text-xs mb-1">💡 Price Tip</p>
                  <p className="text-amber-700 text-[11px] leading-relaxed">
                    Lock in today's prices by placing a forward contract directly with farms on Investa Farm. Prices are guaranteed at contract time.
                  </p>
                  <button onClick={() => setTab("farms")}
                    className="mt-2 text-amber-700 text-[11px] font-bold underline">Browse Farms →</button>
                </div>
              </div>
            )}

            {/* ── PROFILE TAB ── */}
            {tab === "profile" && (
              <div className="space-y-4">
                <div className="bg-white border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Truck size={24} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-bold text-base">{companyName}</p>
                      <p className="text-muted-foreground text-xs">{user?.email ?? ""}</p>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Offtaker · Verified</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: "Active Contracts", val: String(stats?.activeContracts ?? contracts.filter(c => c.status !== "fulfilled" && c.status !== "cancelled").length) },
                      { label: "Total Purchased", val: formatKES(stats?.totalPurchasedKes ?? totalKes) },
                      { label: "Fulfilled Orders", val: String(stats?.fulfilledContracts ?? contracts.filter(c => c.status === "fulfilled").length) },
                    ].map(s => (
                      <div key={s.label} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                        <p className="text-muted-foreground text-sm">{s.label}</p>
                        <p className="text-foreground font-semibold text-sm">{s.val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-border rounded-2xl divide-y divide-border">
                  {[
                    { icon: "🤝", label: "Browse Partner Farms", action: () => setTab("farms") },
                    { icon: "📋", label: "My Purchase Contracts", action: () => setTab("contracts") },
                    { icon: "📊", label: "Market Price Feed", action: () => setTab("prices") },
                  ].map(item => (
                    <button key={item.label} onClick={item.action}
                      className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-muted/30 transition-colors text-left">
                      <span className="text-lg">{item.icon}</span>
                      <p className="text-foreground text-sm font-medium flex-1">{item.label}</p>
                      <ChevronRight size={15} className="text-muted-foreground" />
                    </button>
                  ))}
                </div>

                <button onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-200 text-red-600 text-sm font-semibold active:scale-95 transition-all">
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav className="flex-shrink-0 bg-white border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}>
        <div className="flex justify-around max-w-[430px] mx-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── ORDER BOTTOM SHEET ── */}
      <AnimatePresence>
        {orderOpen && selectedFarm && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50" onClick={closeOrder} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-xl max-h-[85dvh] overflow-y-auto">

              <div className="sticky top-0 bg-white border-b border-border px-5 pt-5 pb-3 flex items-center justify-between">
                <div>
                  <p className="text-foreground font-bold text-base">{orderDone ? "Order Placed!" : "Place Purchase Order"}</p>
                  <p className="text-muted-foreground text-xs">{selectedFarm.name} · {selectedFarm.cropType}</p>
                </div>
                <button onClick={closeOrder} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={15} className="text-muted-foreground" />
                </button>
              </div>

              <div className="px-5 pt-4 pb-8">
                {orderDone ? (
                  <div className="text-center py-6">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12 }}
                      className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={40} className="text-green-600" />
                    </motion.div>
                    <p className="text-foreground font-extrabold text-xl mb-1">Order Submitted!</p>
                    <p className="text-muted-foreground text-sm mb-4">Reference: <span className="font-bold text-primary">{orderDone.ref}</span></p>
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6">
                      <p className="text-green-800 font-bold text-lg">{formatKES(orderDone.total)}</p>
                      <p className="text-primary text-xs mt-0.5">Total order value</p>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed mb-6">
                      The farmer will be notified. Payment terms will be agreed upon contract confirmation. Track progress in Contracts tab.
                    </p>
                    <button onClick={closeOrder}
                      className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-95">
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-start gap-3">
                      <span className="text-2xl">{cropEmoji(selectedFarm.cropType)}</span>
                      <div>
                        <p className="text-green-800 font-bold text-sm">{selectedFarm.cropType} from {selectedFarm.name}</p>
                        <p className="text-green-700 text-xs mt-0.5">
                          {selectedFarm.estimatedYieldTons}t available · Harvest ~{selectedFarm.daysToHarvest} days · <strong>KES {selectedFarm.pricePerKgKes}/kg</strong>
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Quantity (tons) — min {selectedFarm.minOrderTons}t, max {selectedFarm.maxOrderTons}t
                      </label>
                      <input type="number" value={orderTons}
                        onChange={e => setOrderTons(e.target.value)}
                        min={selectedFarm.minOrderTons} max={selectedFarm.maxOrderTons}
                        className="w-full border border-border rounded-xl px-4 py-3 text-foreground font-bold text-sm focus:outline-none focus:border-primary" />
                    </div>

                    {orderTons && Number(orderTons) >= selectedFarm.minOrderTons && (
                      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-primary">Order value</span>
                          <span className="text-green-800 font-bold">{formatKES(Number(orderTons) * 1000 * selectedFarm.pricePerKgKes)}</span>
                        </div>
                        <p className="text-primary text-[10px] mt-1">{Number(orderTons)} tons × {selectedFarm.pricePerKgKes} KES/kg × 1,000 kg/ton</p>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Notes (optional)</label>
                      <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} rows={2}
                        placeholder="e.g. delivery location, quality grade, packaging specs…"
                        className="w-full border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary resize-none" />
                    </div>

                    <button onClick={submitOrder}
                      disabled={orderSubmitting || !orderTons || Number(orderTons) < selectedFarm.minOrderTons}
                      className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40">
                      {orderSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                      {orderSubmitting ? "Submitting…" : `Submit Order · ${formatKES(Number(orderTons || 0) * 1000 * selectedFarm.pricePerKgKes)}`}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
