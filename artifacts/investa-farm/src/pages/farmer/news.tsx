import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BottomNav } from "@/components/bottom-nav";
import { Newspaper, CloudSun, Scroll, RefreshCw, ExternalLink, Loader2, CloudRain, Wind, Thermometer, Sun, Cloud, CloudSnow, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { getCropImage, CROP_IMAGES } from "@/lib/crops";

type NewsTab = "market" | "weather" | "policy";

const NAIROBI_LAT = -1.286389;
const NAIROBI_LON = 36.817223;

const POLICY_ITEMS = [
  {
    id: 1,
    title: "Kenya Fertilizer Subsidy Programme 2026",
    body: "The government has renewed the subsidized fertilizer programme for smallholder farmers. DAP and CAN fertilizers available at approved agro-dealers at 50% below market rates. Target: 2 million bags distributed by May 2026.",
    tag: "Subsidy",
    tagColor: "bg-green-100 text-green-700",
    date: "Jan 2026",
    icon: "🌱",
  },
  {
    id: 2,
    title: "Agricultural Finance Corporation (AFC) Loan Restructuring",
    body: "AFC has extended repayment periods for existing agricultural loans by 12 months following drought impacts in 2025. New applications now open with interest rates reduced to 8% p.a. for smallholder farmers.",
    tag: "Finance",
    tagColor: "bg-blue-100 text-blue-700",
    date: "Feb 2026",
    icon: "💰",
  },
  {
    id: 3,
    title: "Export Levy Exemption for Avocado & Macadamia",
    body: "The Ministry of Agriculture has waived export levies for avocado and macadamia nut exports until December 2026 to boost Kenya's competitive position in EU markets. Farmers must register with KEPHIS.",
    tag: "Export",
    tagColor: "bg-purple-100 text-purple-700",
    date: "Mar 2026",
    icon: "🥑",
  },
  {
    id: 4,
    title: "Water Harvesting Infrastructure Grants",
    body: "County governments offering 60% co-funding for water harvesting infrastructure (tanks, boreholes, drip irrigation) under the Kenya Climate Smart Agriculture Project. Applications open May–July 2026.",
    tag: "Climate",
    tagColor: "bg-sky-100 text-sky-700",
    date: "Apr 2026",
    icon: "💧",
  },
  {
    id: 5,
    title: "Crop Insurance Programme — Premium Subsidy",
    body: "Kenya Livestock and Crop Insurance (KLCI) expanded to cover maize, wheat, sorghum and beans. Government subsidises 50% of premium. Enroll at any Huduma Centre or via *647# USSD.",
    tag: "Insurance",
    tagColor: "bg-amber-100 text-amber-700",
    date: "May 2026",
    icon: "🛡️",
  },
  {
    id: 6,
    title: "Digital Farming Initiative — Subsidised Internet Access",
    body: "CA Kenya and KENET partnering to provide subsidised broadband for registered smallholder farmers. Access weather data, market prices, and e-extension services via smartphone or tablet.",
    tag: "Technology",
    tagColor: "bg-violet-100 text-violet-700",
    date: "Jun 2026",
    icon: "📱",
  },
];

function weatherIcon(wmo: number) {
  if (wmo === 0) return <Sun size={22} className="text-yellow-400" />;
  if (wmo <= 3) return <Cloud size={22} className="text-gray-400" />;
  if (wmo <= 67) return <CloudRain size={22} className="text-blue-500" />;
  if (wmo <= 77) return <CloudSnow size={22} className="text-blue-300" />;
  return <CloudRain size={22} className="text-indigo-500" />;
}

function weatherDesc(wmo: number) {
  if (wmo === 0) return "Clear sky";
  if (wmo <= 1) return "Mainly clear";
  if (wmo <= 2) return "Partly cloudy";
  if (wmo === 3) return "Overcast";
  if (wmo <= 48) return "Foggy";
  if (wmo <= 57) return "Drizzle";
  if (wmo <= 67) return "Rain";
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
    { key: "market", label: "Market News",  icon: <Newspaper size={13} /> },
    { key: "weather", label: "Weather",     icon: <CloudSun size={13} /> },
    { key: "policy",  label: "Policy",      icon: <Scroll size={13} /> },
  ];

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="app-shell pb-24 page-enter">
      {/* Header */}
      <div className="hero-header pt-12 pb-5 px-5">
        <p className="text-white/70 text-xs font-medium uppercase tracking-widest">Stay Informed</p>
        <h1 className="text-white text-2xl font-bold mt-0.5">Farm News</h1>
        <p className="text-white/60 text-xs mt-1">Market updates, weather & government policy</p>
      </div>

      {/* Tab switcher */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex bg-muted rounded-2xl p-1 gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-1 space-y-3">

        {/* ─── MARKET NEWS ─── */}
        {tab === "market" && (
          <AnimatePresence mode="wait">
            <motion.div key="market" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">Latest agriculture market news</p>
                <button onClick={() => refetchNews()} className="text-primary flex items-center gap-1 text-[11px] font-semibold active:scale-95 transition-transform">
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {newsLoading
                ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
                : newsItems.length === 0
                  ? (
                    <div className="text-center py-16">
                      <Newspaper size={36} className="text-muted-foreground mx-auto mb-3" />
                      <p className="text-foreground font-semibold text-sm">No news available</p>
                      <p className="text-muted-foreground text-xs mt-1">Check back shortly for the latest updates</p>
                    </div>
                  )
                  : newsItems.map((item: any) => {
                    const img = newsImage(item);
                    const changePositive = item.changePercent > 0;
                    const changeNeutral = item.changePercent === 0 || item.changePercent == null;
                    return (
                      <div key={item.id ?? item.title} className="bg-card rounded-2xl border border-border overflow-hidden">
                        <div className="relative h-28">
                          <img src={img} alt={item.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-r from-black/75 to-transparent" />
                          <div className="absolute inset-0 p-3 flex flex-col justify-between">
                            <div className="flex items-center gap-1.5">
                              {item.tag && (
                                <span className="bg-white/20 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                                  {item.tag}
                                </span>
                              )}
                              {!changeNeutral && (
                                <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  changePositive ? "bg-green-500/80 text-white" : "bg-red-500/80 text-white"
                                }`}>
                                  {changePositive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                  {changePositive ? "+" : ""}{item.changePercent?.toFixed(1)}%
                                </span>
                              )}
                            </div>
                            <p className="text-white font-bold text-sm leading-tight line-clamp-2">{item.title}</p>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">{item.summary ?? item.description}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-muted-foreground/60 text-[10px]">
                              {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : ""}
                            </span>
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-primary text-[11px] font-medium">
                                Read more <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
              }
            </motion.div>
          </AnimatePresence>
        )}

        {/* ─── WEATHER ─── */}
        {tab === "weather" && (
          <AnimatePresence mode="wait">
            <motion.div key="weather" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Nairobi region · 7-day forecast</p>

              {weatherLoading
                ? <Skeleton className="h-48 rounded-2xl" />
                : !weather
                  ? (
                    <div className="text-center py-12">
                      <CloudSun size={36} className="text-muted-foreground mx-auto mb-3" />
                      <p className="text-foreground font-semibold text-sm">Weather unavailable</p>
                      <p className="text-muted-foreground text-xs mt-1">Check your internet connection</p>
                    </div>
                  )
                  : (
                    <>
                      {/* Current weather card */}
                      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0369a1 0%, #0ea5e9 50%, #38bdf8 100%)" }}>
                        <div className="p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-white/70 text-xs font-medium">Current · Nairobi</p>
                              <p className="text-white font-extrabold text-5xl mt-1 leading-none">
                                {Math.round(weather.current.temperature_2m)}°C
                              </p>
                              <p className="text-white/80 text-sm mt-1 font-medium">
                                {weatherDesc(weather.current.weathercode)}
                              </p>
                            </div>
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                              {weatherIcon(weather.current.weathercode)}
                            </div>
                          </div>
                          <div className="flex gap-4 mt-4">
                            <div className="flex items-center gap-1.5">
                              <Thermometer size={13} className="text-white/70" />
                              <span className="text-white/80 text-xs">Humidity {weather.current.relative_humidity_2m}%</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Wind size={13} className="text-white/70" />
                              <span className="text-white/80 text-xs">Wind {Math.round(weather.current.windspeed_10m)} km/h</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 7-day forecast */}
                      <div className="bg-card border border-border rounded-2xl p-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">7-Day Forecast</p>
                        <div className="space-y-2.5">
                          {weather.daily.time.map((dateStr: string, i: number) => {
                            const d = new Date(dateStr);
                            const isToday = i === 0;
                            return (
                              <div key={dateStr} className={`flex items-center gap-3 py-1.5 ${i < weather.daily.time.length - 1 ? "border-b border-border/50" : ""}`}>
                                <span className={`text-xs font-semibold w-9 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                                  {isToday ? "Today" : days[d.getDay()]}
                                </span>
                                <div className="w-7 flex justify-center">
                                  {weatherIcon(weather.daily.weathercode[i])}
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-muted-foreground">{weatherDesc(weather.daily.weathercode[i])}</p>
                                  {weather.daily.precipitation_sum[i] > 0 && (
                                    <p className="text-[10px] text-blue-500 font-medium flex items-center gap-0.5">
                                      <CloudRain size={9} /> {weather.daily.precipitation_sum[i].toFixed(1)} mm rain
                                    </p>
                                  )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className="text-foreground text-xs font-bold">{Math.round(weather.daily.temperature_2m_max[i])}°</span>
                                  <span className="text-muted-foreground text-xs"> / {Math.round(weather.daily.temperature_2m_min[i])}°</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Farming advisory */}
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                        <p className="text-green-800 font-semibold text-xs mb-1">🌾 Farming Advisory</p>
                        <p className="text-green-700 text-xs leading-relaxed">
                          {weather.daily.precipitation_sum[0] > 5
                            ? "Heavy rainfall expected today — delay spraying and fertilizer application. Good planting conditions for maize and beans."
                            : weather.daily.precipitation_sum[0] > 0
                            ? "Light showers forecast — ideal for transplanting seedlings. Monitor for fungal disease risk."
                            : "Dry conditions today — ensure crops have adequate irrigation. Good conditions for harvesting and field operations."
                          }
                        </p>
                      </div>
                    </>
                  )
              }
            </motion.div>
          </AnimatePresence>
        )}

        {/* ─── POLICY ─── */}
        {tab === "policy" && (
          <AnimatePresence mode="wait">
            <motion.div key="policy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Government programmes & agriculture policy updates</p>
              {POLICY_ITEMS.map(item => (
                <div key={item.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.tagColor}`}>
                          {item.tag}
                        </span>
                        <span className="text-muted-foreground text-[10px]">{item.date}</span>
                      </div>
                      <p className="text-foreground font-semibold text-sm leading-tight mb-1.5">{item.title}</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-center py-4">
                <p className="text-muted-foreground/50 text-[10px]">Policy information sourced from Ministry of Agriculture & AFA Kenya</p>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

      </div>

      <BottomNav role="farmer" />
    </div>
  );
}
