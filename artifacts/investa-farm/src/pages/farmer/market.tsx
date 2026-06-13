import { useState } from "react";
import { useGetMyFarms, useListPrimaryMarket } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, isDemoAccount } from "@/lib/auth";
import { Bell, Filter, TrendingUp, Star, MessageCircle, CheckCircle2, Clock, ChevronRight, ChevronDown, MapPin, Award, FileText, DollarSign, Package, Leaf, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const BUYER_OFFERS = [
  {
    id: 1, name: "Green Harvest Ltd.", verified: true, price: 450, priceUnit: "Ton",
    quantity: 50, location: "Nairobi", region: "Central", duration: "60 Days", rating: 4.9,
    contracts: 1248, onTime: 99, bestPrice: true,
    crop: "Tomatoes", color: "#0B6B3A",
  },
  {
    id: 2, name: "FreshLink Traders", verified: true, price: 435, priceUnit: "Ton",
    quantity: 80, location: "Kisumu", region: "Nyanza", duration: "45 Days", rating: 4.7,
    contracts: 876, onTime: 97, bestPrice: false,
    crop: "Tomatoes", color: "#1a6b4a",
  },
  {
    id: 3, name: "Agri Export Co.", verified: true, price: 470, priceUnit: "Ton",
    quantity: 120, location: "Mombasa", region: "Coast", duration: "90 Days", rating: 4.8,
    contracts: 2100, onTime: 98, bestPrice: false,
    crop: "Tomatoes", color: "#22A45D",
  },
  {
    id: 4, name: "Nakuru Grain Traders", verified: true, price: 380, priceUnit: "Ton",
    quantity: 200, location: "Nakuru", region: "Rift Valley", duration: "30 Days", rating: 4.6,
    contracts: 540, onTime: 95, bestPrice: false,
    crop: "Maize", color: "#c97f2b",
  },
  {
    id: 5, name: "Highlands Export Ltd.", verified: true, price: 520, priceUnit: "Ton",
    quantity: 60, location: "Eldoret", region: "North Rift", duration: "60 Days", rating: 4.9,
    contracts: 312, onTime: 98, bestPrice: true,
    crop: "Avocado", color: "#1d6b3a",
  },
  {
    id: 6, name: "Meru Fresh Connect", verified: true, price: 290, priceUnit: "Ton",
    quantity: 40, location: "Meru", region: "Mt Kenya", duration: "21 Days", rating: 4.5,
    contracts: 183, onTime: 94, bestPrice: false,
    crop: "French Beans", color: "#2d6a4f",
  },
];

const INPUT_PROVIDERS = [
  { id: 1, name: "Kenya Seed Company", type: "Seeds", region: "Nakuru", county: "Nakuru", crops: ["Maize","Wheat","Beans"], rating: 4.8, discount: "15% off for Investa members", icon: "🌱" },
  { id: 2, name: "Yara Kenya Ltd.", type: "Fertilizer", region: "Central", county: "Kiambu", crops: ["All crops"], rating: 4.9, discount: "Free delivery above 2 bags", icon: "🧪" },
  { id: 3, name: "Rift Agro Supplies", type: "Inputs", region: "Rift Valley", county: "Nakuru", crops: ["Maize","Tomatoes"], rating: 4.6, discount: "SACCO group pricing available", icon: "🏪" },
  { id: 4, name: "AgroChem East Africa", type: "Pesticides", region: "Coast", county: "Mombasa", crops: ["Tomatoes","French Beans","Coffee"], rating: 4.7, discount: "Buy 3 get 1 free", icon: "🛡️" },
  { id: 5, name: "Kisumu Organic Hub", type: "Organic Inputs", region: "Nyanza", county: "Kisumu", crops: ["Vegetables","Fruits"], rating: 4.5, discount: "Cooperative member discounts", icon: "🌿" },
  { id: 6, name: "Mount Kenya Agri", type: "Seeds & Tools", region: "Mt Kenya", county: "Meru", crops: ["Coffee","Tea","Avocado"], rating: 4.8, discount: "Interest-free credit for verified farmers", icon: "⛰️" },
];

const RECOMMENDED_BUYERS = [
  { id: 1, name: "Nairobi Fresh Markets", match: 96, revenue: "KES 142,500", crop: "Tomatoes", distance: "14 km", region: "Nairobi" },
  { id: 2, name: "Highlands Agro Ltd.", match: 91, revenue: "KES 128,000", crop: "Avocado", distance: "22 km", region: "Kiambu" },
  { id: 3, name: "Rift Valley Grain Co.", match: 88, revenue: "KES 95,000", crop: "Maize", distance: "8 km", region: "Nakuru" },
];

const ACTIVE_CONTRACTS = [
  {
    id: "INV-2401", buyer: "Agri Export Co.", crop: "Tomatoes", quantity: 12.5,
    price: 470, status: "Active",
    progress: ["Contract Signed", "Harvest Started", "Collection Scheduled", "Delivery Pending", "Payment Pending"],
    currentStep: 2, expectedRevenue: 5875,
    signedDate: "12 May 2026", deliveryDate: "20 Jul 2026",
    paymentTerms: "30 days after delivery",
  },
];

const demandData = Array.from({ length: 12 }, (_, i) => ({
  month: i, value: 60 + Math.sin(i * 0.5) * 15 + i * 2,
}));

export default function FarmerMarket() {
  const [tab, setTab] = useState<"offers" | "contracts" | "inputs">("offers");
  const [selectedOffer, setSelectedOffer] = useState<(typeof BUYER_OFFERS)[0] | null>(null);
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  const { data: farms, isLoading } = useGetMyFarms();
  const { data: listings } = useListPrimaryMarket();
  const isDemo = isDemoAccount();

  const maxPrice = Math.max(...BUYER_OFFERS.map(o => o.price));

  return (
    <div className="app-shell pb-20 page-enter" data-testid="farmer-market">

      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/80 text-xs font-medium">Farm Exchange</p>
            <h1 className="text-white text-xl font-bold">Market</h1>
            <p className="text-white/60 text-xs">Find verified buyers for your produce</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center border border-white/30 relative">
              <Bell size={16} className="text-white" />
            </button>
            <button className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
              <Filter size={16} className="text-white" />
            </button>
          </div>
        </div>

        <div className="flex bg-white/15 border border-white/20 rounded-xl p-1 gap-1">
          {(["offers", "inputs", "contracts"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all ${tab === t ? "bg-white text-foreground shadow-sm" : "text-white/80"}`}>
              {t === "offers" ? "🏪 Buyers" : t === "inputs" ? "🌱 Inputs" : "📋 Contracts"}
            </button>
          ))}
        </div>
      </div>

      {tab === "offers" && (
        <div className="px-4 pt-4 space-y-4">
          {/* Market Insights Hero Card */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0B6B3A,#22A45D)" }}>
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-orange-300 text-sm">🔥</span>
                    <span className="text-white/80 text-xs font-semibold">HIGH DEMAND</span>
                  </div>
                  <p className="text-white/60 text-[10px]">Top Crop Right Now</p>
                  <p className="text-white text-xl font-bold">Tomatoes</p>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-[10px]">Avg Market Price</p>
                  <p className="text-white font-bold text-lg">KES 450/Ton</p>
                  <p className="text-green-300 text-xs font-bold">+8% This Week</p>
                </div>
              </div>
              <div className="h-20 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={demandData}>
                    <defs>
                      <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgba(255,255,255,0.3)" />
                        <stop offset="95%" stopColor="rgba(255,255,255,0)" />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="rgba(255,255,255,0.8)" strokeWidth={2} fill="url(#demandGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MapPin size={11} className="text-white/70" />
                  <span className="text-white/70 text-xs">Best Region: Nairobi</span>
                </div>
                <button className="bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 active:scale-95 transition-transform">
                  View Analytics <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>

          {isDemo ? (
            <>
              {/* Live Buyer Offers — demo data */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">Live Buyer Offers</h2>
                  <span className="flex items-center gap-1 text-green-500 text-[10px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
                  </span>
                </div>
                <div className="space-y-3">
                  {BUYER_OFFERS.map(offer => (
                    <div key={offer.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                              style={{ background: offer.color }}>
                              {offer.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-foreground font-semibold text-sm">{offer.name}</p>
                                {offer.verified && <CheckCircle2 size={12} className="text-green-500" />}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Star size={10} className="text-amber-400 fill-amber-400" />
                                <span className="text-muted-foreground text-[10px]">{offer.rating} · {offer.contracts.toLocaleString()} contracts</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {offer.bestPrice && (
                              <span className="inline-block bg-amber-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full mb-1">BEST PRICE</span>
                            )}
                            <p className="text-primary font-bold text-lg">KES {offer.price}/Ton</p>
                            <div className="w-full bg-muted h-1 rounded-full mt-1">
                              <div className="h-1 bg-primary rounded-full" style={{ width: `${(offer.price / maxPrice) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {[
                            { label: "Quantity", val: `${offer.quantity} Tons` },
                            { label: "Location", val: offer.location },
                            { label: "Duration", val: offer.duration },
                          ].map(({ label, val }) => (
                            <div key={label} className="bg-muted/50 rounded-xl p-2 text-center">
                              <p className="text-muted-foreground text-[8px]">{label}</p>
                              <p className="text-foreground text-[10px] font-semibold mt-0.5">{val}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedOffer(offer)}
                            className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-xl text-xs active:scale-95 transition-transform">
                            View Offer
                          </button>
                          <button className="w-10 h-10 rounded-xl border border-border flex items-center justify-center active:scale-95 transition-transform flex-shrink-0">
                            <MessageCircle size={15} className="text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Buyers */}
              <div>
                <div className="mb-3">
                  <h2 className="font-semibold text-sm">Recommended For Your Farm</h2>
                  <p className="text-muted-foreground text-[10px] mt-0.5">Based on crop type, location, and yield projection</p>
                </div>
                <div className="space-y-2.5">
                  {RECOMMENDED_BUYERS.map(buyer => (
                    <div key={buyer.id} className="bg-card rounded-2xl border border-border p-3.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-sm">{buyer.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground font-semibold text-sm">{buyer.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">{buyer.match}% match</span>
                          <span className="text-muted-foreground text-[10px]">{buyer.crop} · {buyer.distance}</span>
                        </div>
                        <p className="text-primary font-bold text-xs mt-0.5">Est. {buyer.revenue}</p>
                      </div>
                      <button className="bg-primary text-white font-semibold text-xs px-3 py-2 rounded-xl active:scale-95 transition-transform flex-shrink-0">
                        Connect
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-muted/50 rounded-2xl border border-border p-8 text-center">
              <TrendingUp size={28} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-semibold text-sm">No buyer offers yet</p>
              <p className="text-muted-foreground text-xs mt-1">Buyer offers will appear here as your farm gets listed and grows. Complete KYC and apply for funding to get started.</p>
            </div>
          )}

          {/* Demand Forecast */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm">Demand Forecast</p>
              <span className="text-[10px] text-muted-foreground">Next 30 days</span>
            </div>
            <div className="h-24 mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={demandData.slice(6)}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a40" />
                      <stop offset="95%" stopColor="#16a34a00" />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} fill="url(#forecastGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-2.5 text-center">
                <p className="text-muted-foreground text-[9px]">Demand Score</p>
                <p className="text-green-700 font-bold text-sm">87/100</p>
              </div>
              <div className="bg-green-50 rounded-xl p-2.5 text-center">
                <p className="text-muted-foreground text-[9px]">Expected Price Increase</p>
                <p className="text-green-700 font-bold text-sm">+12%</p>
              </div>
            </div>
          </div>

          {isDemo && (
            <div className="bg-gradient-to-r from-primary to-green-500 rounded-2xl p-4 text-center">
              <Award size={24} className="text-white/80 mx-auto mb-2" />
              <p className="text-white font-bold text-sm">3 Buyers Match Your Harvest</p>
              <p className="text-white/70 text-xs mt-0.5">Based on your Tomatoes crop · 12.5 tons projected yield</p>
            </div>
          )}
        </div>
      )}

      {tab === "inputs" && (
        <div className="px-4 pt-4 space-y-4">
          {/* Regional input providers header */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#052e16,#16a34a)" }}>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-green-300 text-[9px] font-bold uppercase tracking-widest bg-green-600/30 px-2 py-0.5 rounded-full">Input Marketplace</span>
                  </div>
                  <p className="text-white text-base font-bold">Regional Agri-Input Providers</p>
                  <p className="text-green-200/70 text-[11px] mt-0.5">Seeds, fertilizer & pesticides near you</p>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-green-300 font-extrabold text-xl">{INPUT_PROVIDERS.length}</p>
                  <p className="text-green-200/60 text-[9px]">Verified suppliers</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { label: "Seeds", count: INPUT_PROVIDERS.filter(p => p.type.includes("Seed")).length, icon: "🌱" },
                  { label: "Fertilizer", count: INPUT_PROVIDERS.filter(p => p.type.includes("Fertilizer")).length, icon: "🧪" },
                  { label: "Pesticides", count: INPUT_PROVIDERS.filter(p => p.type.includes("Pest")).length, icon: "🛡️" },
                ].map(({ label, count, icon }) => (
                  <div key={label} className="bg-white/10 rounded-xl p-2 text-center border border-white/10">
                    <p className="text-lg">{icon}</p>
                    <p className="text-white font-bold text-sm">{count}</p>
                    <p className="text-green-200/60 text-[9px]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Input provider cards */}
          <div className="space-y-3">
            {INPUT_PROVIDERS.map(provider => (
              <div key={provider.id} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0 text-2xl">
                      {provider.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-foreground font-bold text-sm">{provider.name}</p>
                        <ShieldCheck size={12} className="text-green-500 flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">{provider.type}</span>
                        <span className="text-muted-foreground text-[10px] flex items-center gap-0.5">
                          <MapPin size={8} /> {provider.county} · {provider.region}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} size={9} className={i <= Math.floor(provider.rating) ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"} />
                        ))}
                        <span className="text-muted-foreground text-[9px] ml-0.5">{provider.rating}</span>
                      </div>
                    </div>
                  </div>

                  {/* Crops served */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {provider.crops.map(crop => (
                      <span key={crop} className="text-[9px] bg-green-50 text-green-700 border border-green-100 font-semibold px-2 py-0.5 rounded-full">
                        🌾 {crop}
                      </span>
                    ))}
                  </div>

                  {/* Investa member discount */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2 mb-3">
                    <Leaf size={12} className="text-amber-600 flex-shrink-0" />
                    <p className="text-amber-700 text-[10px] font-semibold leading-tight">{provider.discount}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-xl text-xs active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                      <Package size={12} /> Order Inputs
                    </button>
                    <button className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl text-xs active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                      <MessageCircle size={12} /> Enquire
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "contracts" && (
        <div className="px-4 pt-4 space-y-4">
          {/* Farm stats */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-card rounded-2xl border border-border p-3 text-center">
              <p className="text-primary font-bold text-lg">{farms?.length ?? "—"}</p>
              <p className="text-muted-foreground text-[10px]">Active Farms</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-3 text-center">
              <p className="text-primary font-bold text-lg">{listings?.length ?? "—"}</p>
              <p className="text-muted-foreground text-[10px]">Market Listings</p>
            </div>
          </div>

          {/* Contracts — demo only */}
          {isDemo ? (
            ACTIVE_CONTRACTS.map(contract => (
              <div key={contract.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Contract #{contract.id}</p>
                      <p className="text-foreground font-bold text-base mt-0.5">{contract.buyer}</p>
                      <p className="text-muted-foreground text-xs">{contract.crop} · {contract.quantity} Tons · KES {contract.price}/Ton</p>
                    </div>
                    <span className="bg-green-100 text-green-700 text-[9px] font-bold px-2.5 py-1 rounded-full">{contract.status}</span>
                  </div>

                  {/* Progress steps */}
                  <div className="space-y-2 mb-4">
                    {contract.progress.map((step, i) => {
                      const done = i <= contract.currentStep;
                      const current = i === contract.currentStep;
                      return (
                        <div key={step} className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-primary" : "bg-muted"}`}>
                            {done && <CheckCircle2 size={12} className="text-white" />}
                          </div>
                          <p className={`text-xs ${current ? "text-primary font-semibold" : done ? "text-foreground" : "text-muted-foreground"}`}>{step}</p>
                          {current && <Clock size={11} className="text-amber-500 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Revenue */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 mb-3">
                    <p className="text-green-700 text-xs font-semibold mb-1">Expected Revenue</p>
                    <p className="text-green-700 font-bold text-2xl">{formatKES(contract.expectedRevenue)}</p>
                    <div className="grid grid-cols-3 gap-1.5 mt-2 text-[9px]">
                      <div className="text-center">
                        <p className="text-muted-foreground">Farmer Share</p>
                        <p className="font-bold text-green-700">{formatKES(Math.round(contract.expectedRevenue * 0.55))}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Investor Share</p>
                        <p className="font-bold text-blue-600">{formatKES(Math.round(contract.expectedRevenue * 0.40))}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Platform Fee</p>
                        <p className="font-bold text-amber-600">{formatKES(Math.round(contract.expectedRevenue * 0.05))}</p>
                      </div>
                    </div>
                  </div>

                  {/* Expand/collapse contract details */}
                  <button
                    onClick={() => setExpandedContractId(expandedContractId === contract.id ? null : contract.id)}
                    className="w-full bg-primary text-white font-semibold py-2.5 rounded-xl text-sm active:scale-95 transition-transform flex items-center justify-center gap-2">
                    <FileText size={14} />
                    {expandedContractId === contract.id ? "Hide Details" : "View Full Details"}
                    <ChevronDown size={14} className={`transition-transform ${expandedContractId === contract.id ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {expandedContractId === contract.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                        className="overflow-hidden">
                        <div className="pt-3 space-y-3">
                          <div className="border border-border rounded-xl overflow-hidden">
                            <div className="bg-muted/50 px-3 py-2 flex items-center gap-2">
                              <FileText size={13} className="text-primary" />
                              <p className="text-xs font-semibold">Contract Terms</p>
                            </div>
                            <div className="divide-y divide-border">
                              {[
                                { label: "Crop Type", value: contract.crop },
                                { label: "Quantity", value: `${contract.quantity} Tons` },
                                { label: "Price Per Ton", value: `KES ${contract.price}` },
                                { label: "Total Value", value: formatKES(contract.expectedRevenue) },
                                { label: "Date Signed", value: contract.signedDate },
                                { label: "Delivery Date", value: contract.deliveryDate },
                                { label: "Payment Terms", value: contract.paymentTerms },
                              ].map(({ label, value }) => (
                                <div key={label} className="flex items-center justify-between px-3 py-2.5">
                                  <span className="text-muted-foreground text-[11px]">{label}</span>
                                  <span className="text-foreground text-[11px] font-semibold">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button className="w-full border border-primary text-primary font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                            <DollarSign size={14} /> Request Payment
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))
          ) : (
            /* New accounts — empty state */
            <>
              {isLoading
                ? Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
                : (
                  <div className="bg-muted/40 rounded-2xl border border-border p-8 text-center">
                    <FileText size={28} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-foreground font-semibold text-sm">No contracts yet</p>
                    <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                      Your active contracts will appear here once you connect with buyers and agree on terms. Start by completing your KYC and listing your farm.
                    </p>
                  </div>
                )}
            </>
          )}

          {/* My farm listings from DB */}
          {farms && farms.length > 0 && (
            <div>
              <p className="font-semibold text-sm mb-2.5">My Listed Farms</p>
              <div className="space-y-2.5">
                {farms.map((farm: any) => (
                  <div key={farm.id} className="bg-card rounded-2xl border border-border p-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp size={18} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground font-semibold text-sm">{farm.name}</p>
                      <p className="text-muted-foreground text-[11px]">{farm.cropType} · {farm.location}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">{farm.fundingPercent}% funded</span>
                        <span className="text-muted-foreground text-[10px]">{farm.sharesAvailable} shares left</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground font-bold text-sm">{formatKES(farm.sharePrice)}</p>
                      <p className="text-muted-foreground text-[10px]">per share</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Buyer Offer Detail Sheet */}
      {selectedOffer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setSelectedOffer(null)}>
          <div className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 space-y-4 pb-10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-lg">{selectedOffer.name}</p>
                  <CheckCircle2 size={14} className="text-green-500" />
                </div>
                <p className="text-muted-foreground text-xs">{selectedOffer.rating} rating · {selectedOffer.onTime}% on-time payments</p>
              </div>
              <button onClick={() => setSelectedOffer(null)} className="text-muted-foreground text-sm font-medium">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Price Per Ton", val: `KES ${selectedOffer.price}` },
                { label: "Required Quantity", val: `${selectedOffer.quantity} Tons` },
                { label: "Delivery Window", val: selectedOffer.duration },
                { label: "Contracts Done", val: selectedOffer.contracts.toLocaleString() },
              ].map(({ label, val }) => (
                <div key={label} className="bg-muted/50 rounded-xl p-3">
                  <p className="text-muted-foreground text-[9px] mb-0.5">{label}</p>
                  <p className="text-foreground font-bold text-sm">{val}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedOffer(null)}
                className="flex-1 py-3 rounded-xl border border-border text-muted-foreground text-sm font-medium">
                Negotiate Terms
              </button>
              <button className="flex-1 bg-primary text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform">
                Accept Contract
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav role="farmer" />
    </div>
  );
}
