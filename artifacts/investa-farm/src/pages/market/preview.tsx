import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, MapPin, Users, ArrowRight, Leaf, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { getCropImage } from "@/lib/crops";
import { formatKES } from "@/lib/auth";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

type Listing = {
  id: number; farmId: number; farmName: string; cropType: string;
  location: string; pricePerShare: number; sharesAvailable: number;
  changePercent: number; imageUrl?: string; totalShares?: number;
};

function RiskDot({ crop }: { crop: string }) {
  const high = new Set(["coffee", "avocado", "tobacco"]);
  const mod  = new Set(["tea", "wheat", "tomatoes"]);
  const c = crop.toLowerCase();
  const level = high.has(c) ? "High" : mod.has(c) ? "Med" : "Low";
  const col   = level === "High" ? "bg-red-500" : level === "Med" ? "bg-amber-400" : "bg-green-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${col} mr-1`} />;
}

export default function MarketPreview() {
  const [, setLocation] = useLocation();

  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["market-preview"],
    queryFn: async () => {
      const r = await fetch("/api/market/primary");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.listings ?? []);
    },
    staleTime: 60_000,
  });

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background flex flex-col">
      {/* Hero header */}
      <div className="relative overflow-hidden px-5 pt-12 pb-8"
        style={{ background: "linear-gradient(135deg,#052e16 0%,#14532d 50%,#16a34a 100%)" }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='1.5' fill='%23fff'/%3E%3C/svg%3E\")" }} />
        <div className="relative flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <img src={logoSrc} alt="Investa Farm" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <p className="text-white font-extrabold text-lg leading-none">Investa Farm</p>
              <p className="text-green-300 text-[10px] font-semibold tracking-wider">LIVE MARKET PREVIEW</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-400/30 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-300 text-[10px] font-bold">LIVE</span>
          </div>
        </div>
        <h1 className="text-white font-extrabold text-2xl leading-tight mb-1">Farm Investment<br />Exchange</h1>
        <p className="text-green-200 text-sm mb-5">Buy fractional shares in verified Kenyan farms — starting from KES 5,000.</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Active Farms", val: listings.length > 0 ? String(listings.length) : "8+", icon: "🌾" },
            { label: "Avg. ROI", val: "14–22%", icon: "📈" },
            { label: "Min. Entry", val: "KES 5K", icon: "💳" },
          ].map(({ label, val, icon }) => (
            <div key={label} className="bg-white/10 border border-white/20 rounded-2xl p-2.5 text-center">
              <p className="text-xl mb-1">{icon}</p>
              <p className="text-white font-bold text-sm">{val}</p>
              <p className="text-green-200 text-[9px]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sign-in CTA banner */}
      <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
        <ShieldCheck size={18} className="text-amber-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-amber-800 font-bold text-xs">Sign in to start investing</p>
          <p className="text-amber-600 text-[10px]">Create a free account to buy farm shares & track your returns.</p>
        </div>
        <button onClick={() => setLocation("/register")}
          className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-xl flex-shrink-0 active:scale-95 transition-transform">
          Join Free
        </button>
      </div>

      {/* Listings */}
      <div className="flex-1 px-4 pt-3 pb-24 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-foreground text-sm">Live Listings</h2>
          <span className="text-muted-foreground text-[10px]">{listings.length} farms available</span>
        </div>

        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted animate-pulse" />
          ))
        ) : (
          <AnimatePresence>
            {listings.map((listing, i) => {
              const up = listing.changePercent >= 0;
              const spark = generateSparkData(listing.pricePerShare, 12, listing.changePercent / 100);
              const funded = listing.totalShares
                ? Math.round((listing.totalShares - listing.sharesAvailable) / listing.totalShares * 100)
                : 0;
              return (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
                >
                  <div className="relative h-28">
                    <img src={getCropImage(listing.cropType, listing.imageUrl)}
                      alt={listing.farmName} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <div className={`absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${up ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                      {up ? "▲" : "▼"} {Math.abs(listing.changePercent).toFixed(1)}%
                    </div>
                    <div className="absolute bottom-2 left-3 right-3">
                      <p className="text-white font-bold text-sm leading-tight truncate">{listing.farmName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <MapPin size={9} className="text-white/60" />
                        <span className="text-white/70 text-[10px]">{listing.location}</span>
                        <span className="text-white/50 text-[10px]">·</span>
                        <RiskDot crop={listing.cropType} />
                        <span className="text-white/70 text-[10px]">{listing.cropType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-foreground font-extrabold text-base">{formatKES(listing.pricePerShare)}</p>
                        <p className="text-muted-foreground text-[10px]">per share</p>
                      </div>
                      <div style={{ width: 80, height: 36 }}>
                        <Sparkline data={spark} positive={up} width={80} height={36} />
                      </div>
                    </div>

                    {listing.totalShares && (
                      <div className="mb-2">
                        <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                          <span>{funded}% funded</span>
                          <span>{listing.sharesAvailable.toLocaleString()} shares left</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${funded}%` }} />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setLocation("/register")}
                      className="w-full bg-primary text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                    >
                      Sign up to invest <ArrowRight size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-background/95 backdrop-blur border-t border-border px-4 py-3">
        <div className="flex gap-2">
          <button onClick={() => setLocation("/login")}
            className="flex-1 h-11 rounded-2xl border border-border text-foreground font-bold text-sm active:scale-95 transition-transform">
            Log In
          </button>
          <button onClick={() => setLocation("/register")}
            className="flex-1 h-11 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2">
            <Leaf size={14} /> Get Started Free
          </button>
        </div>
      </div>
    </div>
  );
}
