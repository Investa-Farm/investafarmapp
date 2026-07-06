import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Leaf, CloudRain, Wind, Thermometer, Droplets, Sun, Moon,
  Sparkles, ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, TrendingUp,
  BarChart2, Bug, Calendar, CalendarDays, ChevronRight, Droplet, CloudSun, CloudSnow,
  Satellite, ExternalLink, Map,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "leaflet/dist/leaflet.css";

// ─── Open-Meteo types ─────────────────────────────────────────────────────────
type WeatherRes = {
  current: {
    temperature_2m: number; precipitation: number;
    relative_humidity_2m: number; windspeed_10m: number;
    apparent_temperature: number; weathercode: number;
  };
  daily: {
    temperature_2m_max: number[]; temperature_2m_min: number[];
    precipitation_sum: number[]; precipitation_probability_max: number[];
    time: string[];
  };
};

// ─── Weather code → label / emoji ────────────────────────────────────────────
function weatherLabel(code: number) {
  if (code === 0) return { label: "Clear Sky", emoji: "☀️" };
  if (code <= 2) return { label: "Partly Cloudy", emoji: "⛅" };
  if (code <= 9) return { label: "Overcast", emoji: "☁️" };
  if (code <= 49) return { label: "Foggy", emoji: "🌫️" };
  if (code <= 69) return { label: "Drizzle", emoji: "🌦️" };
  if (code <= 79) return { label: "Rain", emoji: "🌧️" };
  if (code <= 99) return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "Unknown", emoji: "🌡️" };
}

// ─── NDVI helpers ─────────────────────────────────────────────────────────────
function ndviStatus(v: number) {
  if (v >= 0.65) return { label: "Excellent", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", bar: "#16a34a" };
  if (v >= 0.50) return { label: "Good",      color: "text-blue-600",    bg: "bg-blue-50 border-blue-200",     bar: "#3b82f6" };
  if (v >= 0.35) return { label: "Fair",      color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",   bar: "#f59e0b" };
  return             { label: "Low",       color: "text-red-500",     bg: "bg-red-50 border-red-200",       bar: "#ef4444" };
}

// ─── Health score ring ────────────────────────────────────────────────────────
function HealthRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = size / 2 - 12;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? "#16a34a" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label = score >= 75 ? "Good" : score >= 50 ? "Fair" : "Poor";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black text-foreground">{score}</span>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
    </div>
  );
}

// ─── Satellite / NDVI Map component ──────────────────────────────────────────
function SatelliteNdviMap({ lat, lng, ndvi, farmName }: { lat: number; lng: number; ndvi: number; farmName?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapRef.current) return;
      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({ iconRetinaUrl: "", iconUrl: "", shadowUrl: "" });

      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: true,
        touchZoom: true,
        attributionControl: false,
      });
      mapInstanceRef.current = map;

      // Esri World Imagery (satellite) — free, no API key
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
      }).addTo(map);

      // NDVI colour: green → yellow → red
      const ndviColor = ndvi >= 0.65 ? "#16a34a" : ndvi >= 0.5 ? "#65a30d" : ndvi >= 0.35 ? "#ca8a04" : "#dc2626";
      const ndviOpacity = 0.35;

      // Farm boundary circle — radius ≈ 150m to give a farm-sized overlay
      L.circle([lat, lng], {
        radius: 220,
        color: ndviColor,
        fillColor: ndviColor,
        fillOpacity: ndviOpacity,
        weight: 2,
        opacity: 0.9,
      }).addTo(map);

      // Custom farm marker
      const farmIcon = L.divIcon({
        className: "",
        html: `<div style="background:${ndviColor};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;">🌿</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker([lat, lng], { icon: farmIcon }).addTo(map);
      if (farmName) {
        marker.bindTooltip(farmName, { permanent: false, direction: "top", offset: [0, -16], className: "leaflet-farm-tooltip" });
      }

      // Small attribution
      L.control.attribution({ position: "bottomright", prefix: "" })
        .addAttribution('<span style="font-size:9px;opacity:0.6">Esri Satellite</span>')
        .addTo(map);

      setMapLoaded(true);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, ndvi, farmName]);

  const ndviStatus = ndvi >= 0.65 ? "Excellent" : ndvi >= 0.5 ? "Good" : ndvi >= 0.35 ? "Fair" : "Low";
  const ndviColor = ndvi >= 0.65 ? "text-emerald-600 bg-emerald-100" : ndvi >= 0.5 ? "text-lime-700 bg-lime-100" : ndvi >= 0.35 ? "text-amber-700 bg-amber-100" : "text-red-600 bg-red-100";
  const googleMapsUrl = `https://www.google.com/maps/@${lat},${lng},300m/data=!3m1!1e3`;

  return (
    <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
      {/* Map */}
      <div ref={mapRef} style={{ height: 180, width: "100%" }} className="bg-muted/30">
        {!mapLoaded && (
          <div className="h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {/* Footer bar */}
      <div className="bg-card px-3 py-2 flex items-center gap-2">
        <Satellite size={13} className="text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground leading-none">Live Satellite View · NDVI {ndvi.toFixed(2)}</p>
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ndviColor}`}>{ndviStatus}</span>
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
          className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <ExternalLink size={11} className="text-muted-foreground" />
        </a>
      </div>
    </div>
  );
}

// ─── Rainfall risk colours ────────────────────────────────────────────────────
const RISK_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  green:  { bg: "bg-emerald-50",  border: "border-emerald-200", text: "text-emerald-700", label: "Optimal" },
  yellow: { bg: "bg-amber-50",    border: "border-amber-200",   text: "text-amber-700",   label: "Watch"   },
  red:    { bg: "bg-red-50",      border: "border-red-200",     text: "text-red-700",     label: "At Risk" },
};

export default function FarmerHealth() {
  const [, setLocation] = useLocation();
  const [refreshTs, setRefreshTs] = useState(Date.now());

  // ─── Farm health API ────────────────────────────────────────────────────────
  const { data: health, isLoading: healthLoading, refetch } = useQuery<any>({
    queryKey: ["farmer-health", refreshTs],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch("/api/farmer/health", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error("Failed to load health data");
      return r.json();
    },
  });

  // ─── Live weather (Open-Meteo, no API key) ──────────────────────────────────
  const lat = health?.coords?.lat ?? -1.2921;
  const lng = health?.coords?.lng ?? 36.8219;
  const { data: wx, isLoading: wxLoading } = useQuery<WeatherRes>({
    queryKey: ["farm-weather", lat.toFixed(3), lng.toFixed(3)],
    enabled: !!health?.hasFarm,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const url = [
        `https://api.open-meteo.com/v1/forecast`,
        `?latitude=${lat}&longitude=${lng}`,
        `&current=temperature_2m,apparent_temperature,precipitation,relative_humidity_2m,windspeed_10m,weathercode`,
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max`,
        `&timezone=Africa%2FNairobi&forecast_days=7`,
      ].join("");
      const r = await fetch(url);
      return r.json();
    },
  });

  const loading = healthLoading;
  const farm    = health?.farm;
  const score   = health?.healthScore ?? 0;
  const rainfall = health?.rainfall;
  const ndvi    = health?.ndvi ?? 0.62;
  const ndviMeta = ndviStatus(ndvi);
  const breakdown = health?.breakdown ?? {};
  const recommendations: string[] = health?.recommendations ?? [];
  const pestRisks: any[]          = health?.pestRisks ?? [];
  const rainColors = RISK_COLORS[rainfall?.riskColor ?? "green"]!;

  // ─── Day labels for forecast ────────────────────────────────────────────────
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const forecastDays = wx?.daily?.time?.slice(0, 7).map((t, i) => ({
    day: i === 0 ? "Today" : DAY_NAMES[new Date(t).getDay()]!,
    max: Math.round(wx.daily.temperature_2m_max[i] ?? 0),
    min: Math.round(wx.daily.temperature_2m_min[i] ?? 0),
    rain: Math.round(wx.daily.precipitation_sum[i] ?? 0),
    prob: wx.daily.precipitation_probability_max[i] ?? 0,
  })) ?? [];

  const wxMeta = wx ? weatherLabel(wx.current.weathercode) : { label: "Loading…", emoji: "🌤️" };

  return (
    <div className="app-shell pb-24 page-enter">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="flex items-center gap-3 px-4 pt-12 pb-3">
          <button onClick={() => setLocation("/farmer")}
            className="w-9 h-9 rounded-full border border-border flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-foreground text-base">Farm Health Dashboard</h1>
            <p className="text-muted-foreground text-[11px]">
              {farm?.location ?? "Live monitoring"} · {farm?.cropType ?? "—"}
            </p>
          </div>
          <button
            onClick={() => { setRefreshTs(Date.now()); refetch(); }}
            className="w-9 h-9 rounded-full border border-border flex items-center justify-center active:scale-95 transition-transform">
            <RefreshCw size={15} className={healthLoading ? "animate-spin text-primary" : "text-muted-foreground"} />
          </button>
        </div>
      </div>

      {loading && !health && (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Loading farm health data…</p>
        </div>
      )}

      {health?.hasFarm === false && !loading && (
        <div className="flex flex-col items-center justify-center h-64 gap-4 px-8 text-center">
          <Leaf size={48} className="text-muted-foreground/40" />
          <p className="text-foreground font-semibold">No farm listed yet</p>
          <p className="text-muted-foreground text-sm">List your farm to unlock live health monitoring, weather tracking, and AI recommendations.</p>
          <button onClick={() => setLocation("/farmer/farm-profile")}
            className="bg-primary text-white text-sm font-semibold px-6 py-2.5 rounded-xl active:scale-95 transition-transform">
            List Your Farm →
          </button>
        </div>
      )}

      {health?.hasFarm && (
        <div className="px-4 pt-4 space-y-4">

          {/* ── Health Score Card ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <HealthRing score={score} size={108} />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Overall Health Score</p>
                <p className="text-foreground text-sm leading-relaxed mb-3">
                  {score >= 75 ? "Your farm is in great shape." : score >= 50 ? "Moderate health — a few areas need attention." : "Action required — several risk factors detected."}
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: "Rainfall",  val: breakdown.rainfall ?? 0, max: 30, color: "bg-sky-400" },
                    { label: "Funding",   val: breakdown.funding  ?? 0, max: 25, color: "bg-violet-400" },
                    { label: "Market",    val: breakdown.market   ?? 0, max: 25, color: "bg-amber-400" },
                    { label: "Vegetation",val: breakdown.ndvi     ?? 0, max: 20, color: "bg-emerald-400" },
                  ].map(({ label, val, max, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground w-16 shrink-0">{label}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div className={`h-full ${color} rounded-full`}
                          initial={{ width: 0 }} animate={{ width: `${(val / max) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }} />
                      </div>
                      <span className="text-[9px] font-bold text-foreground w-8 text-right">{val}/{max}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Live Weather ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
            className="bg-gradient-to-br from-sky-500 to-blue-700 rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center gap-1.5 mb-3">
              <CloudSun size={14} className="text-white/80" />
              <p className="text-sm font-semibold">Live Weather</p>
              <span className="text-white/50 text-[10px] ml-auto">Open-Meteo · {farm?.location ?? "Kenya"}</span>
            </div>

            {wxLoading && (
              <div className="flex items-center gap-2 py-2">
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span className="text-white/70 text-sm">Fetching live data…</span>
              </div>
            )}

            {wx && (
              <>
                <div className="flex items-end gap-3 mb-4">
                  <span className="text-5xl">{wxMeta.emoji}</span>
                  <div>
                    <p className="text-3xl font-black">{wx.current.temperature_2m.toFixed(0)}°C</p>
                    <p className="text-white/80 text-xs">Feels {wx.current.apparent_temperature.toFixed(0)}°C · {wxMeta.label}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="flex items-center gap-1 justify-end mb-0.5">
                      <Droplet size={11} className="text-white/60" />
                      <span className="text-white/80 text-xs">{wx.current.relative_humidity_2m}%</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end mb-0.5">
                      <Wind size={11} className="text-white/60" />
                      <span className="text-white/80 text-xs">{wx.current.windspeed_10m} km/h</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <CloudRain size={11} className="text-white/60" />
                      <span className="text-white/80 text-xs">{wx.current.precipitation} mm</span>
                    </div>
                  </div>
                </div>

                {/* 7-day forecast strip */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {forecastDays.map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 bg-white/15 rounded-xl px-2.5 py-2 min-w-[52px] flex-shrink-0">
                      <span className="text-[9px] font-bold text-white/70">{d.day}</span>
                      <span className="text-base">{d.rain > 5 ? "🌧️" : d.rain > 1 ? "🌦️" : d.prob > 50 ? "⛅" : "☀️"}</span>
                      <span className="text-[10px] font-bold">{d.max}°</span>
                      <span className="text-[9px] text-white/60">{d.min}°</span>
                      {d.rain > 0 && <span className="text-[8px] text-sky-200">{d.rain}mm</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          {/* ── NDVI + Rainfall row ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* NDVI */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              className={`bg-card rounded-2xl border p-4 ${ndviMeta.bg}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Leaf size={13} className={ndviMeta.color} />
                <p className="text-xs font-semibold text-foreground">Vegetation NDVI</p>
              </div>
              <div className="flex items-end gap-2 mb-2.5">
                <span className={`text-2xl font-black ${ndviMeta.color}`}>{ndvi.toFixed(2)}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ndviMeta.bg} ${ndviMeta.color} border mb-0.5`}>{ndviMeta.label}</span>
              </div>
              <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden">
                <motion.div className="h-2 rounded-full"
                  style={{ background: `linear-gradient(90deg, #eab308 0%, ${ndviMeta.bar} 100%)` }}
                  initial={{ width: 0 }} animate={{ width: `${ndvi * 100}%` }}
                  transition={{ duration: 1, delay: 0.3 }} />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1.5">Based on crop type + growth stage</p>
            </motion.div>

            {/* Rainfall Summary */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
              className={`bg-card rounded-2xl border p-4 ${rainColors.bg} ${rainColors.border}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <CloudRain size={13} className={rainColors.text} />
                <p className="text-xs font-semibold text-foreground">Rainfall</p>
              </div>
              {rainfall ? (
                <>
                  <p className={`text-2xl font-black ${rainColors.text}`}>{rainfall.seasonalTotalMm}<span className="text-sm font-medium">mm</span></p>
                  <p className={`text-[10px] font-bold ${rainColors.text} mb-1`}>{rainColors.label} · {rainfall.riskLevel}</p>
                  <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden">
                    <motion.div className={`h-2 rounded-full ${rainfall.riskColor === "green" ? "bg-emerald-500" : rainfall.riskColor === "yellow" ? "bg-amber-500" : "bg-red-500"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (rainfall.seasonalTotalMm / rainfall.optimalRangeMax) * 100)}%` }}
                      transition={{ duration: 1, delay: 0.35 }} />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1.5">Optimal: {rainfall.optimalRangeMin}–{rainfall.optimalRangeMax}mm</p>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">No data</p>
              )}
            </motion.div>
          </div>

          {/* ── Rainfall bar chart ── */}
          {rainfall?.dailyMm?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.14 }}
              className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <BarChart2 size={13} className="text-sky-500" />
                <p className="text-sm font-semibold">Seasonal Rainfall Trend</p>
                {rainfall.criticalDrought && (
                  <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠️ Drought</span>
                )}
                {rainfall.floodRisk && (
                  <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🌊 Flood Risk</span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={90}>
                <AreaChart data={rainfall.dailyMm.slice(0, 14).map((mm: number, i: number) => ({
                  day: rainfall.dailyDates?.[i]
                    ? new Date(rainfall.dailyDates[i]).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : `D${i + 1}`,
                  mm: Math.max(0, mm),
                }))}>
                  <defs>
                    <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={3} />
                  <Tooltip contentStyle={{ fontSize: 10, padding: "4px 8px", borderRadius: 8 }} formatter={(v: any) => [`${v}mm`, "Rain"]} />
                  <Area type="monotone" dataKey="mm" stroke="#38bdf8" fill="url(#rainGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-between mt-2">
                <span className="text-[9px] text-muted-foreground">Yield adj: <span className={rainfall.yieldAdjustmentPercent < 0 ? "text-red-500 font-bold" : "text-emerald-600 font-bold"}>{rainfall.yieldAdjustmentPercent > 0 ? "+" : ""}{rainfall.yieldAdjustmentPercent}%</span></span>
                {rainfall.extremeDays > 0 && <span className="text-[9px] text-orange-600 font-bold">⚡ {rainfall.extremeDays} heavy rain days</span>}
              </div>
            </motion.div>
          )}

          {/* ── Pest & Disease Risk ── */}
          {pestRisks.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.16 }}
              className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Bug size={14} className="text-orange-500" />
                <p className="text-sm font-semibold">Pest &amp; Disease Alerts</p>
              </div>
              <div className="space-y-2.5">
                {pestRisks.map((r: any, i: number) => (
                  <div key={i} className={`rounded-xl p-3 border ${
                    r.severity === "high"   ? "bg-red-50 border-red-200" :
                    r.severity === "medium" ? "bg-amber-50 border-amber-200" :
                    "bg-emerald-50 border-emerald-200"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {r.severity === "high" ? <AlertTriangle size={12} className="text-red-500" /> :
                       r.severity === "medium" ? <AlertTriangle size={12} className="text-amber-500" /> :
                       <CheckCircle size={12} className="text-emerald-500" />}
                      <span className={`text-xs font-bold ${
                        r.severity === "high" ? "text-red-700" : r.severity === "medium" ? "text-amber-700" : "text-emerald-700"
                      }`}>{r.risk}</span>
                      <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        r.severity === "high"   ? "bg-red-100 text-red-600" :
                        r.severity === "medium" ? "bg-amber-100 text-amber-600" :
                        "bg-emerald-100 text-emerald-600"}`}>{r.severity}</span>
                    </div>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">{r.tip}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Crop Planting Calendar ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.17 }}
            className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <CalendarDays size={14} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Kenya Planting Calendar</p>
                <p className="text-[10px] text-muted-foreground">Long rains (Mar–Jun) · Short rains (Oct–Dec)</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { crop: "Maize",    icon: "🌽", longRain: "Mar–Apr", shortRain: "Oct–Nov", highlight: farm?.cropType?.toLowerCase().includes("maize") },
                { crop: "Beans",    icon: "🫘", longRain: "Mar–May", shortRain: "Oct–Nov", highlight: farm?.cropType?.toLowerCase().includes("bean") },
                { crop: "Coffee",   icon: "☕", longRain: "Mar–May", shortRain: "Oct–Nov", highlight: farm?.cropType?.toLowerCase().includes("coffee") },
                { crop: "Tea",      icon: "🍵", longRain: "Year-round", shortRain: "—",    highlight: farm?.cropType?.toLowerCase().includes("tea") },
                { crop: "Avocado",  icon: "🥑", longRain: "Mar–Apr", shortRain: "Oct",     highlight: farm?.cropType?.toLowerCase().includes("avocado") },
                { crop: "Tomatoes", icon: "🍅", longRain: "Feb–Mar", shortRain: "Sep–Oct", highlight: farm?.cropType?.toLowerCase().includes("tomato") },
                { crop: "Wheat",    icon: "🌾", longRain: "Mar–Apr", shortRain: "Oct–Nov", highlight: farm?.cropType?.toLowerCase().includes("wheat") },
                { crop: "Sorghum",  icon: "🌿", longRain: "Apr–May", shortRain: "Nov",     highlight: farm?.cropType?.toLowerCase().includes("sorghum") },
              ].map(({ crop, icon, longRain, shortRain, highlight }) => (
                <div key={crop} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${
                  highlight ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-transparent"
                }`}>
                  <span className="text-base flex-shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold leading-none ${highlight ? "text-primary" : "text-foreground"}`}>
                      {crop} {highlight && <span className="text-[9px] font-bold text-primary ml-1">YOUR CROP</span>}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-[8px] text-sky-500 font-bold">LR</p>
                      <p className="text-[10px] text-foreground font-semibold">{longRain}</p>
                    </div>
                    <div className="w-px h-full bg-border" />
                    <div className="text-center">
                      <p className="text-[8px] text-amber-500 font-bold">SR</p>
                      <p className="text-[10px] text-foreground font-semibold">{shortRain}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2.5 px-1">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" /><span className="text-[9px] text-muted-foreground">LR = Long Rains</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-[9px] text-muted-foreground">SR = Short Rains</span></div>
            </div>
          </motion.div>

          {/* ── AI Weekly Recommendations ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}
            className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">AI Weekly Recommendations</p>
                <p className="text-[10px] text-muted-foreground">Tailored to your crop, location &amp; conditions</p>
              </div>
            </div>
            {recommendations.length === 0 ? (
              <div className="flex items-center gap-2 py-3">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-muted-foreground text-xs">Generating recommendations…</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recommendations.map((rec, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.07 }}
                    className="flex items-start gap-2.5 bg-primary/5 rounded-xl p-3 border border-primary/10">
                    <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-foreground text-xs leading-relaxed">{rec}</p>
                  </motion.div>
                ))}
              </div>
            )}
            <p className="text-[9px] text-muted-foreground mt-2.5 text-center">Refreshes every 2 hours · Powered by Groq AI</p>
          </motion.div>

          {/* ── Satellite Farm Map ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.19 }}
            className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center">
                <Satellite size={14} className="text-sky-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Satellite Farm Map</p>
                <p className="text-[10px] text-muted-foreground">Live imagery · NDVI vegetation overlay</p>
              </div>
            </div>
            <SatelliteNdviMap lat={lat} lng={lng} ndvi={ndvi} farmName={farm?.name} />
          </motion.div>

          {/* ── Growth stage + quick actions ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.20 }}
            className="bg-card rounded-2xl border border-border p-4">
            <p className="text-sm font-semibold mb-3">Growth Stage</p>
            <div className="flex items-center gap-2 mb-4">
              {["planting", "growing", "harvest"].map((s, i) => {
                const done = ["planting", "growing", "harvest"].indexOf(farm?.stage ?? "growing") > i;
                const current = farm?.stage === s;
                return (
                  <div key={s} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-base ${
                      current ? "bg-primary border-primary" : done ? "bg-primary/20 border-primary/50" : "bg-muted border-muted-foreground/20"}`}>
                      {s === "planting" ? "🌱" : s === "growing" ? "🌿" : "🌾"}
                    </div>
                    <p className={`text-[9px] font-medium capitalize ${current ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground"}`}>{s}</p>
                    {i < 2 && <div className="absolute" />}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Day {farm?.ageDays ?? 0} of crop cycle · Currently in <strong className="text-foreground">{farm?.stage ?? "growing"}</strong> stage
            </p>
          </motion.div>

          {/* ── Quick Actions ── */}
          <div className="grid grid-cols-3 gap-2.5 pb-2">
            {[
              { label: "Post Update", icon: "📝", path: "/farmer/updates" },
              { label: "Market",      icon: "📈", path: "/farmer/market"  },
              { label: "Operations",  icon: "⚙️", path: "/farmer/operations" },
            ].map(({ label, icon, path }) => (
              <button key={path} onClick={() => setLocation(path)}
                className="bg-card border border-border rounded-2xl p-3 text-center active:scale-95 transition-transform">
                <span className="text-xl block mb-1">{icon}</span>
                <p className="text-[10px] font-medium text-foreground">{label}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <BottomNav role="farmer" />
    </div>
  );
}
