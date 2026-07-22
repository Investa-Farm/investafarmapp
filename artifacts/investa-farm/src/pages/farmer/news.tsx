import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BottomNav } from "@/components/bottom-nav";
import {
  Newspaper, CloudSun, Scroll, RefreshCw, ExternalLink,
  CloudRain, Wind, Thermometer, Sun, Cloud, CloudSnow,
  TrendingUp, TrendingDown, ArrowUpRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { getCropImage, CROP_IMAGES } from "@/lib/crops";

type NewsTab = "market" | "weather" | "policy";

const NAIROBI_LAT = -1.286389;
const NAIROBI_LON = 36.817223;

const POLICY_ITEMS = [
  { id: 1, title: "Kenya Fertilizer Subsidy Programme 2026", body: "The government has renewed the subsidized fertilizer programme for smallholder farmers. DAP and CAN fertilizers available at approved agro-dealers at 50% below market rates. Target: 2 million bags distributed by May 2026.", tag: "Subsidy", tagBg: "#dcfce7", tagColor: "#15803d", date: "Jan 2026", icon: "🌱", accent: "#16a34a" },
  { id: 2, title: "AFC Loan Restructuring — Repayments Extended", body: "AFC has extended repayment periods for existing agricultural loans by 12 months following drought impacts in 2025. New applications open with interest rates reduced to 8% p.a. for smallholder farmers.", tag: "Finance", tagBg: "#dbeafe", tagColor: "#1e40af", date: "Feb 2026", icon: "💰", accent: "#3b82f6" },
  { id: 3, title: "Export Levy Exemption — Avocado & Macadamia", body: "The Ministry of Agriculture has waived export levies for avocado and macadamia nut exports until December 2026 to boost Kenya's competitive position in EU markets. Farmers must register with KEPHIS.", tag: "Export", tagBg: "#f3e8ff", tagColor: "#7e22ce", date: "Mar 2026", icon: "🥑", accent: "#a855f7" },
  { id: 4, title: "Water Harvesting Infrastructure Grants", body: "County governments offering 60% co-funding for water harvesting infrastructure (tanks, boreholes, drip irrigation) under the Kenya Climate Smart Agriculture Project. Applications open May–July 2026.", tag: "Climate", tagBg: "#e0f2fe", tagColor: "#0369a1", date: "Apr 2026", icon: "💧", accent: "#0ea5e9" },
  { id: 5, title: "Crop Insurance Programme — 50% Premium Subsidy", body: "Kenya Livestock and Crop Insurance expanded to cover maize, wheat, sorghum and beans. Government subsidises 50% of premium. Enroll at any Huduma Centre or via *647# USSD.", tag: "Insurance", tagBg: "#fef3c7", tagColor: "#92400e", date: "May 2026", icon: "🛡️", accent: "#d97706" },
  { id: 6, title: "Digital Farming — Subsidised Internet Access", body: "CA Kenya and KENET partnering to provide subsidised broadband for registered smallholder farmers. Access weather data, market prices, and e-extension services via smartphone or tablet.", tag: "Technology", tagBg: "#ede9fe", tagColor: "#6d28d9", date: "Jun 2026", icon: "📱", accent: "#7c3aed" },
];

function weatherIcon(wmo: number, size = 20) {
  if (wmo === 0) return <Sun size={size} className="text-yellow-400" />;
  if (wmo <= 3) return <Cloud size={size} className="text-slate-400" />;
  if (wmo <= 67) return <CloudRain size={size} className="text-blue-500" />;
  if (wmo <= 77) return <CloudSnow size={size} className="text-blue-300" />;
  return <CloudRain size={size} className="text-indigo-500" />;
}

function weatherDesc(wmo: number) {
  if (wmo === 0) return "Clear sky";
  if (wmo <= 1) return "Mainly clear";
  if (wmo <= 2) return "Partly cloudy";
  if (wmo === 3) return "Overcast";
  if (wmo <= 48) return "Foggy";
  if (wmo <= 57) return "Drizzle";
  if (wmo <= 67) return "Rainy";
  if (wmo <= 77) return "Snow showers";
  if (wmo <= 82) return "Rain showers";
  return "Thunderstorm";
}

function newsImage(item: any): string {
  const t = (item.title ?? "").toLowerCase();
  if (t.includes("avocado")) return CROP_IMAGES.avocado;
  if (t.includes("maize") || t.includes("corn")) return CROP_IMAGES.maize;
  if (t.includes("coffee")) return CROP_IMAGES.coffee;
  if (t.includes("tea")) return CROP_IMAGES.tea;
  if (t.includes("wheat")) return CROP_IMAGES.wheat;
  if (t.includes("bean")) return CROP_IMAGES.beans;
  if (t.includes("tomato")) return CROP_IMAGES.tomatoes;
  if (t.includes("sunflower")) return CROP_IMAGES.sunflower;
  return CROP_IMAGES.maize;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function FarmerNews() {
  const [tab, setTab] = useState<NewsTab>("market");

  const { data: newsItems = [], isLoading: newsLoading, refetch: refetchNews } = useQuery<any[]>({
    queryKey: ["farmer-news"],
    queryFn: async () => {
      const r = await fetch("/api/news");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: tab === "market",
  });

  const { data: weather, isLoading: weatherLoading } = useQuery<any>({
    queryKey: ["farmer-weather"],
    queryFn: async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${NAIROBI_LAT}&longitude=${NAIROBI_LON}&current=temperature_2m,relative_humidity_2m,windspeed_10m,weathercode&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=Africa%2FNairobi&forecast_days=7`;
      const r = await fetch(url);
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 30 * 60 * 1000,
    enabled: tab === "weather",
  });

  const tabs: { key: NewsTab; label: string; icon: React.ReactNode }[] = [
    { key: "market",  label: "Market",  icon: <Newspaper size={12} /> },
    { key: "weather", label: "Weather", icon: <CloudSun size={12} /> },
    { key: "policy",  label: "Policy",  icon: <Scroll size={12} /> },
  ];

  const [featured, ...rest] = newsItems;

  return (
    <div className="app-shell pb-24 page-enter">
      {/* Header */}
      <div className="hero-header pt-12 pb-6 px-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #4ade80 0%, transparent 55%)" }} />
        <div className="relative">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-300/80">Stay Informed</span>
          <h1 className="text-white text-2xl font-extrabold mt-0.5 leading-tight">Farm News</h1>
          <p className="text-white/50 text-xs mt-1">Market · Weather · Policy</p>
        </div>
      </div>

      {/* Tab switcher — pill style */}
      <div className="px-4 -mt-3 relative z-10">
        <div className="flex bg-card shadow-md border border-border rounded-2xl p-1 gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                tab === t.key
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* ─── MARKET NEWS ─── */}
        {tab === "market" && (
          <AnimatePresence mode="wait">
            <motion.div key="market" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Latest Updates</p>
                <button onClick={() => refetchNews()} className="text-primary flex items-center gap-1 text-[11px] font-bold active:scale-95 transition-transform">
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {newsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-52 rounded-2xl" />
                  {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
                </div>
              ) : newsItems.length === 0 ? (
                <div className="text-center py-16 bg-muted/40 rounded-2xl border border-border">
                  <Newspaper size={36} className="text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-foreground font-semibold text-sm">No news right now</p>
                  <p className="text-muted-foreground text-xs mt-1">Check back shortly for the latest updates</p>
                </div>
              ) : (
                <>
                  {/* Featured article — large hero */}
                  {featured && (
                    <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
                      <div className="relative h-44">
                        <img src={newsImage(featured)} alt={featured.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)" }} />
                        {/* Tag + change */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          {featured.tag && (
                            <span className="bg-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                              {featured.tag}
                            </span>
                          )}
                          {featured.changePercent != null && featured.changePercent !== 0 && (
                            <span className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              featured.changePercent > 0 ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
                            }`}>
                              {featured.changePercent > 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                              {featured.changePercent > 0 ? "+" : ""}{featured.changePercent?.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <p className="text-white font-extrabold text-base leading-tight line-clamp-2 mb-1">{featured.title}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-white/50 text-[10px]">
                              {featured.publishedAt ? new Date(featured.publishedAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : ""}
                            </span>
                            {featured.url && (
                              <a href={featured.url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-primary-foreground text-[11px] font-semibold bg-primary/80 px-2.5 py-1 rounded-full">
                                Read <ArrowUpRight size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      {featured.summary && (
                        <div className="px-4 py-3 bg-card">
                          <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">{featured.summary}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Remaining articles — compact list */}
                  {rest.map((item: any) => {
                    const img = newsImage(item);
                    return (
                      <div key={item.id ?? item.title} className="bg-card rounded-2xl border border-border overflow-hidden flex gap-0">
                        <div className="relative w-24 flex-shrink-0">
                          <img src={img} alt={item.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/20" />
                          {item.changePercent != null && item.changePercent !== 0 && (
                            <span className={`absolute top-1.5 left-1.5 flex items-center gap-0.5 text-[8px] font-bold px-1 py-0.5 rounded-full ${
                              item.changePercent > 0 ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
                            }`}>
                              {item.changePercent > 0 ? "+" : ""}{item.changePercent?.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                          <div>
                            {item.tag && (
                              <span className="text-[8px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide mb-1 inline-block">
                                {item.tag}
                              </span>
                            )}
                            <p className="text-foreground font-semibold text-xs leading-tight line-clamp-2 mt-0.5">{item.title}</p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-muted-foreground/60 text-[9px]">
                              {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : ""}
                            </span>
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-0.5 text-primary text-[10px] font-semibold">
                                Read <ExternalLink size={9} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ─── WEATHER ─── */}
        {tab === "weather" && (
          <AnimatePresence mode="wait">
            <motion.div key="weather" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {weatherLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-44 rounded-2xl" />
                  <Skeleton className="h-64 rounded-2xl" />
                </div>
              ) : !weather ? (
                <div className="text-center py-12 bg-muted/40 rounded-2xl border border-border">
                  <CloudSun size={36} className="text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-foreground font-semibold text-sm">Weather unavailable</p>
                  <p className="text-muted-foreground text-xs mt-1">Check your internet connection</p>
                </div>
              ) : (
                <>
                  {/* Current conditions hero */}
                  <div className="relative rounded-2xl overflow-hidden"
                    style={{ background: "linear-gradient(145deg,#0c4a6e 0%,#0369a1 40%,#0ea5e9 80%,#38bdf8 100%)" }}>
                    <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 85% 15%, #fff 0%, transparent 45%)" }} />
                    <div className="relative p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Nairobi · Now</p>
                          <p className="text-white font-black text-6xl mt-1 leading-none tracking-tight">
                            {Math.round(weather.current.temperature_2m)}°
                          </p>
                          <p className="text-white/80 text-sm font-semibold mt-1">
                            {weatherDesc(weather.current.weathercode)}
                          </p>
                        </div>
                        <div className="w-18 h-18 bg-white/20 rounded-2xl flex items-center justify-center p-4 border border-white/15">
                          {weatherIcon(weather.current.weathercode, 36)}
                        </div>
                      </div>
                      <div className="flex gap-5 mt-5 pt-4 border-t border-white/15">
                        <div className="flex items-center gap-1.5">
                          <Thermometer size={12} className="text-white/60" />
                          <span className="text-white/70 text-xs">Humidity {weather.current.relative_humidity_2m}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Wind size={12} className="text-white/60" />
                          <span className="text-white/70 text-xs">Wind {Math.round(weather.current.windspeed_10m)} km/h</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 7-day forecast */}
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">7-Day Forecast</p>
                    </div>
                    {weather.daily.time.map((dateStr: string, i: number) => {
                      const d = new Date(dateStr);
                      const isToday = i === 0;
                      const hasPrecip = weather.daily.precipitation_sum[i] > 0;
                      return (
                        <div key={dateStr}
                          className={`flex items-center gap-3 px-4 py-3 ${i < weather.daily.time.length - 1 ? "border-b border-border/60" : ""} ${isToday ? "bg-primary/4" : ""}`}>
                          <span className={`text-xs font-bold w-10 flex-shrink-0 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                            {isToday ? "Today" : DAYS[d.getDay()]}
                          </span>
                          <div className="w-6 flex-shrink-0 flex justify-center">
                            {weatherIcon(weather.daily.weathercode[i], 18)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground font-medium">{weatherDesc(weather.daily.weathercode[i])}</p>
                            {hasPrecip && (
                              <p className="text-[9px] text-blue-500 font-semibold flex items-center gap-0.5 mt-0.5">
                                <CloudRain size={8} /> {weather.daily.precipitation_sum[i].toFixed(1)} mm
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-foreground text-xs font-extrabold">{Math.round(weather.daily.temperature_2m_max[i])}°</span>
                            <span className="text-muted-foreground/60 text-xs"> / {Math.round(weather.daily.temperature_2m_min[i])}°</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Farming advisory */}
                  <div className="relative overflow-hidden rounded-2xl"
                    style={{ background: "linear-gradient(135deg,#052e16,#14532d)", border: "1px solid rgba(74,222,128,0.15)" }}>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">🌾</span>
                        <p className="text-green-300 font-bold text-xs uppercase tracking-wider">Farming Advisory</p>
                      </div>
                      <p className="text-white/75 text-xs leading-relaxed">
                        {weather.daily.precipitation_sum[0] > 5
                          ? "Heavy rainfall expected today — delay spraying and fertilizer application. Good planting conditions for maize and beans."
                          : weather.daily.precipitation_sum[0] > 0
                          ? "Light showers forecast — ideal for transplanting seedlings. Monitor for fungal disease risk."
                          : "Dry conditions today — ensure crops have adequate irrigation. Good for harvesting and field operations."}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ─── POLICY ─── */}
        {tab === "policy" && (
          <AnimatePresence mode="wait">
            <motion.div key="policy" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Government Programmes</p>
              {POLICY_ITEMS.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="bg-card border border-border rounded-2xl overflow-hidden flex"
                >
                  {/* Accent stripe */}
                  <div className="w-1 flex-shrink-0" style={{ background: item.accent }} />
                  <div className="flex-1 p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: item.tagBg }}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                            style={{ background: item.tagBg, color: item.tagColor }}
                          >
                            {item.tag}
                          </span>
                          <span className="text-muted-foreground/60 text-[9px] font-medium">{item.date}</span>
                        </div>
                        <p className="text-foreground font-bold text-xs leading-tight mb-1.5">{item.title}</p>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">{item.body}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              <div className="text-center py-4">
                <p className="text-muted-foreground/40 text-[10px]">Sourced from Ministry of Agriculture & AFA Kenya</p>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

      </div>

      <BottomNav role="farmer" />
    </div>
  );
}
