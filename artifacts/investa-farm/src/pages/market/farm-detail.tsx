import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useParams } from "wouter";
import { useGetFarm, getGetFarmQueryKey, useListPrimaryMarket } from "@workspace/api-client-react";
import { ArrowLeft, TrendingUp, TrendingDown, Users, ShoppingCart, Leaf, Droplets, Sun, MapPin, ShieldCheck, User, Sparkles, BarChart2, Navigation, CloudRain, Wind, Thermometer, Droplet, Newspaper, RefreshCw, Globe, Layers, Cpu, Scale, Share2, Star, ChevronRight, ChevronUp } from "lucide-react";
import { ShareModal } from "@/components/share-modal";
import { AiSectionBot } from "@/components/ai-section-bot";
import { CompareFarmsModal, type CompareListing } from "@/components/compare-farms-modal";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, LineChart, Line, YAxis, CartesianGrid } from "recharts";
import { formatKES, formatChange, getToken } from "@/lib/auth";
import { getCropImage } from "@/lib/crops";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestModal } from "@/components/invest-modal";
import { useQuery } from "@tanstack/react-query";
import "leaflet/dist/leaflet.css";

type GrowthData = {
  farmId: number; cropType: string;
  stage: "planting" | "growing" | "harvest";
  percent: number; daysElapsed: number; daysTotal: number;
  marketPriceKes: number; marketChangePercent: number; marketInsight: string;
};

const GROWTH_STAGES = [
  { key: "planting", label: "Planting", icon: Leaf,     color: "bg-emerald-500" },
  { key: "growing",  label: "Growing",  icon: Droplets,  color: "bg-blue-500"   },
  { key: "harvest",  label: "Harvest",  icon: Sun,       color: "bg-orange-500"  },
];

const KENYA_COORDS: Record<string, [number, number]> = {
  nairobi: [-1.2921, 36.8219], kiambu: [-1.1728, 36.8342], nakuru: [-0.3031, 36.0800],
  meru: [0.0500, 37.6500], kirinyaga: [-0.4700, 37.3100], laikipia: [0.0300, 36.8000],
  nyeri: [-0.4167, 36.9500], kisumu: [-0.0917, 34.7679], eldoret: [0.5200, 35.2699],
  machakos: [-1.5177, 37.2634], narok: [-1.0833, 35.8667], thika: [-1.0332, 37.0693],
  ahero: [-0.1667, 34.9167], molo: [-0.2667, 35.7333], limuru: [-1.1133, 36.6428],
  nanyuki: [0.0100, 37.0714], embu: [-0.5273, 37.4571], kitui: [-1.3667, 38.0167],
  mombasa: [-4.0435, 39.6682], kericho: [-0.3667, 35.2833], bungoma: [0.5630, 34.5522],
  kakamega: [0.2827, 34.7519], kisii: [-0.6817, 34.7717], muranga: [-0.7167, 37.1500],
  nyandarua: [-0.1833, 36.4500], bomet: [-0.7833, 35.3500],
};

function getKenyaCoords(location: string): [number, number] {
  const lower = location.toLowerCase();
  for (const [key, coords] of Object.entries(KENYA_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return [-1.2921, 36.8219];
}

function generateFarmPolygon(lat: number, lng: number, seed: number): [number, number][] {
  const lngScale = Math.cos((lat * Math.PI) / 180);
  const baseSize = 0.006 + (seed % 5) * 0.001;
  const sides = 7 + (seed % 3);
  const irregularity = [1.0, 0.88, 1.12, 0.94, 1.08, 0.85, 1.15, 0.92, 1.05, 0.80];
  return Array.from({ length: sides }, (_, i) => {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 3;
    const r = baseSize * (irregularity[i % irregularity.length] ?? 1.0);
    return [lat + Math.cos(angle) * r, lng + (Math.sin(angle) * r) / lngScale] as [number, number];
  });
}

function FarmLeafletMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return;
    import("leaflet").then((L) => {
      if (!mapRef.current || instanceRef.current) return;
      const seed = Math.abs(label.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
      const polygon = generateFarmPolygon(lat, lng, seed);
      const map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);
      const farmPoly = L.polygon(polygon, {
        color: "#16a34a", weight: 2.5, fillColor: "#16a34a", fillOpacity: 0.15,
      }).addTo(map);
      const bounds = farmPoly.getBounds();
      map.fitBounds(bounds, { padding: [30, 30] });
      farmPoly.bindPopup(
        `<div style="font-size:13px;font-weight:700;color:#15803d">${label}</div>` +
        `<div style="font-size:11px;color:#6b7280;margin-top:2px">Farm boundary (approx.)</div>`,
        { offset: [0, -4] }
      ).openPopup();
      L.circleMarker([lat, lng], { radius: 5, color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.9, weight: 2 }).addTo(map);
      instanceRef.current = map;
      setTimeout(() => { try { map.invalidateSize(); } catch { /* ignore */ } }, 250);
      setTimeout(() => { try { map.invalidateSize(); } catch { /* ignore */ } }, 600);
    });
    return () => { if (instanceRef.current) { instanceRef.current.remove(); instanceRef.current = null; } };
  }, [lat, lng, label]);

  return (
    <div ref={mapRef} style={{ height: 280, width: "100%", background: "#e8f4e8", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 12, pointerEvents: "none", zIndex: 1 }}>
        Loading map…
      </div>
    </div>
  );
}

const NDVI_BY_STAGE: Record<string, Record<string, number>> = {
  planting: { maize: 0.28, wheat: 0.25, tea: 0.55, coffee: 0.45, avocado: 0.50, dairy: 0.58, default: 0.30 },
  growing:  { maize: 0.72, wheat: 0.65, tea: 0.78, coffee: 0.63, avocado: 0.69, dairy: 0.73, default: 0.62 },
  harvest:  { maize: 0.54, wheat: 0.48, tea: 0.71, coffee: 0.57, avocado: 0.61, dairy: 0.69, default: 0.52 },
};

function getNdvi(cropType: string, stage: string) {
  const stageData = NDVI_BY_STAGE[stage] ?? NDVI_BY_STAGE["growing"]!;
  const key = Object.keys(stageData).find(k => k !== "default" && cropType.toLowerCase().includes(k));
  return key ? stageData[key]! : stageData["default"]!;
}

function ndviColor(v: number) {
  if (v >= 0.65) return { label: "Excellent", color: "text-[#16a34a]", bg: "bg-[#16a34a]/10" };
  if (v >= 0.50) return { label: "Good", color: "text-blue-600", bg: "bg-blue-50" };
  if (v >= 0.35) return { label: "Fair", color: "text-amber-600", bg: "bg-amber-50" };
  return { label: "Low", color: "text-red-500", bg: "bg-red-50" };
}

function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function generateNdviTimeSeries(cropType: string) {
  const isPerennial = /tea|coffee|avocado|macadamia/.test(cropType.toLowerCase());
  const peak = isPerennial ? 0.72 : 0.70;
  const offSeason = isPerennial ? 0.60 : 0.20;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Now"];
  return months.map((month, i) => {
    const t = i / (months.length - 1);
    const ndvi = isPerennial
      ? offSeason + (peak - offSeason) * Math.sin(t * Math.PI)
      : t < 0.5
        ? offSeason + (peak - offSeason) * (t * 2)
        : peak - (peak - getNdvi(cropType, "harvest")) * ((t - 0.5) * 2);
    return { month, ndvi: parseFloat(Math.max(0.05, ndvi).toFixed(3)) };
  });
}

function getVegetationCover(cropType: string, ndvi: number) {
  const crop = cropType.toLowerCase();
  const canopy = Math.round(Math.min(88, ndvi * 85));
  const trees = /avocado|coffee|macadamia|tea/.test(crop) ? 12 : 4;
  const water = /rice|kale|tomato|horticulture|greenhouse/.test(crop) ? 6 : 1;
  const bare = Math.max(0, 100 - canopy - trees - water);
  return [
    { name: "Crop Canopy",        pct: canopy, color: "#16a34a" },
    { name: "Bare Soil",          pct: bare,   color: "#d97706" },
    { name: "Tree Cover",         pct: trees,  color: "#166534" },
    { name: "Water / Irrigation", pct: water,  color: "#3b82f6" },
  ];
}

function SatelliteTileMap({ lat, lng, farmName }: { lat: number; lng: number; farmName: string }) {
  const ZOOM = 14;
  const { x, y } = latLngToTile(lat, lng, ZOOM);
  const tileUrl = (tx: number, ty: number) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${ZOOM}/${ty}/${tx}`;
  const grid = [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => ({ dx, dy })));
  return (
    <div className="relative overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
      <div className="grid grid-cols-3 absolute inset-0">
        {grid.map(({ dx, dy }) => (
          <img key={`${dx}-${dy}`} src={tileUrl(x + dx, y + dy)} className="w-full h-full object-cover" alt="" loading="lazy" />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center drop-shadow-lg">
          <div className="bg-white/90 border border-white px-2.5 py-1 rounded-full text-[10px] font-bold text-gray-900 mb-1.5 shadow">{farmName}</div>
          <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg" />
          <div className="w-0.5 h-3 bg-red-500 drop-shadow" />
        </div>
      </div>
      <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[9px] px-2 py-1 rounded-lg backdrop-blur-sm">Esri World Imagery</div>
    </div>
  );
}

type WeatherRes = {
  current: { temperature_2m: number; precipitation: number; relative_humidity_2m: number; windspeed_10m: number };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; time: string[] };
};

function WeatherNdvi({ lat, lng, cropType, stage }: { lat: number; lng: number; cropType: string; stage: string }) {
  const { data: wx, isLoading } = useQuery<WeatherRes>({
    queryKey: ["weather-ndvi", lat.toFixed(3), lng.toFixed(3)],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,relative_humidity_2m,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Africa%2FNairobi&forecast_days=5`;
      const r = await fetch(url);
      return r.json();
    },
  });

  const ndvi = getNdvi(cropType, stage);
  const ndviMeta = ndviColor(ndvi);

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#16a34a]/10 flex items-center justify-center">
              <Sparkles size={14} className="text-[#16a34a]" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Satellite Vegetation</p>
              <p className="text-[10px] text-muted-foreground">NDVI Index</p>
            </div>
            <AiSectionBot context={`NDVI score is ${ndvi.toFixed(2)} (${ndviMeta.label}) for a ${cropType} farm in ${stage} stage. What does this mean for the farmer and investor?`} label="NDVI" />
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${ndviMeta.bg} ${ndviMeta.color}`}>{ndviMeta.label}</span>
        </div>
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-2">
            <span>0.0 Bare soil</span>
            <span className={`font-bold ${ndviMeta.color}`}>NDVI {ndvi.toFixed(2)}</span>
            <span>1.0 Dense</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3.5 overflow-hidden">
            <motion.div
              className="h-3.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${ndvi * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ background: `linear-gradient(90deg, #eab308 0%, #16a34a ${ndvi * 100}%)` }}
            />
          </div>
        </div>
        <p className="text-muted-foreground text-[10px]">Estimated from crop type & growth stage. Higher NDVI = healthier vegetation.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <CloudRain size={14} className="text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Live Weather</p>
            <p className="text-[10px] text-muted-foreground">Near this farm · Open-Meteo</p>
          </div>
          <AiSectionBot
            context={wx ? `Current weather near this farm: temperature ${wx.current.temperature_2m}°C, humidity ${wx.current.relative_humidity_2m}%, wind ${wx.current.windspeed_10m} km/h, precipitation ${wx.current.precipitation}mm. Crop: ${cropType} in ${stage} stage. What weather risks or opportunities should the investor know about?` : `Weather for a ${cropType} farm in ${stage} stage in Kenya`}
            label="weather"
          />
        </div>
        {isLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {Array(4).fill(0).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : wx ? (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { icon: Thermometer, label: "Temp", val: `${wx.current.temperature_2m}°C`, color: "text-orange-500", bg: "bg-orange-50" },
                { icon: Droplet,     label: "Humidity", val: `${wx.current.relative_humidity_2m}%`, color: "text-blue-500", bg: "bg-blue-50" },
                { icon: Wind,        label: "Wind",  val: `${wx.current.windspeed_10m}km/h`, color: "text-slate-500", bg: "bg-slate-50" },
                { icon: CloudRain,   label: "Rain",  val: `${wx.current.precipitation}mm`, color: "text-blue-600", bg: "bg-blue-50" },
              ].map(({ icon: Icon, label, val, color, bg }) => (
                <div key={label} className={`${bg} rounded-xl p-2.5 text-center`}>
                  <Icon size={14} className={`${color} mx-auto mb-1`} />
                  <p className="text-foreground font-bold text-xs">{val}</p>
                  <p className="text-muted-foreground text-[9px]">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">5-Day Forecast</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {(wx.daily.time ?? []).slice(0, 5).map((t, i) => (
                <div key={t} className="flex-shrink-0 bg-muted/60 rounded-xl p-2.5 text-center min-w-[56px]">
                  <p className="text-primary text-[9px] font-bold">{new Date(t).toLocaleDateString("en-KE", { weekday: "short" })}</p>
                  <p className="text-foreground font-bold text-sm mt-1">{Math.round(wx.daily.temperature_2m_max[i] ?? 0)}°</p>
                  <p className="text-muted-foreground text-[9px]">{Math.round(wx.daily.temperature_2m_min[i] ?? 0)}°</p>
                  <p className="text-blue-500 text-[9px] mt-0.5">{(wx.daily.precipitation_sum[i] ?? 0).toFixed(1)}mm</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-blue-600 text-xs">Unable to fetch weather data.</p>
        )}
      </div>
    </div>
  );
}

type DetailTab = "overview" | "financials" | "farm-health" | "location" | "news";

const DETAIL_TABS: { id: DetailTab; label: string; emoji: string }[] = [
  { id: "overview",    label: "Overview",    emoji: "🌾" },
  { id: "financials",  label: "Financials",  emoji: "💰" },
  { id: "farm-health", label: "Farm Health", emoji: "🌿" },
  { id: "location",    label: "Location",    emoji: "📍" },
  { id: "news",        label: "News",        emoji: "📰" },
];

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-3.5 flex flex-col gap-1">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-base font-bold ${accent ?? "text-foreground"}`} style={{ fontFamily: "Space Grotesk, sans-serif" }}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function FarmDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const farmId = parseInt(params.id ?? "0", 10);
  const [investOpen, setInvestOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [compareOpen, setCompareOpen] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const token = getToken();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => setScrollY(el.scrollTop);
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  // Check watchlist status on load
  useEffect(() => {
    if (!token || !farmId) return;
    fetch("/api/watchlist", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((list: any[]) => { if (Array.isArray(list)) setInWatchlist(list.some((w: any) => w.farmId === farmId)); })
      .catch(() => {});
  }, [farmId, token]);

  const { data: farm, isLoading } = useGetFarm(farmId, {
    query: { enabled: !!farmId, queryKey: getGetFarmQueryKey(farmId), staleTime: 3 * 60 * 1000 },
  });
  const { data: primaryListings } = useListPrimaryMarket();

  type NewsItem = { title: string; summary: string; url: string; source: string; publishedAt: string; sentiment?: number; cropRelevance?: number };
  type SentimentItem = { crop: string; score: number; trend: string };

  const { data: cropNews, isLoading: newsLoading, refetch: refetchNews } = useQuery<NewsItem[]>({
    queryKey: ["farm-crop-news", farm?.cropType],
    enabled: !!farm?.cropType,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch("/api/news");
      const all: NewsItem[] = await r.json().catch(() => []);
      const crop = farm?.cropType?.toLowerCase() ?? "";
      const keywords = crop.split(/\s+/).filter((w: string) => w.length > 3);
      return all.map((item: NewsItem) => ({
        ...item,
        cropRelevance: keywords.some((k: string) =>
          item.title?.toLowerCase().includes(k) || item.summary?.toLowerCase().includes(k)
        ) ? 1 : 0,
      })).sort((a, b) => (b.cropRelevance ?? 0) - (a.cropRelevance ?? 0));
    },
  });

  const { data: sentimentData } = useQuery<SentimentItem[]>({
    queryKey: ["news-sentiment"],
    enabled: activeTab === "news",
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch("/api/news/sentiment");
      const d = await r.json().catch(() => ({}));
      return d.scores ?? [];
    },
  });

  const cropSentiment = sentimentData?.find(
    s => farm?.cropType && s.crop?.toLowerCase().includes(farm.cropType.toLowerCase().split(" ")[0] ?? "")
  );

  const { data: growth } = useQuery<GrowthData>({
    queryKey: ["farm-growth", farmId],
    enabled: !!farmId,
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(`/api/farmer/growth/${farmId}`, { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const { data: rainfallData } = useQuery<any>({
    queryKey: ["farm-rainfall", farmId],
    enabled: !!farmId && activeTab === "farm-health",
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(`/api/farms/${farmId}/rainfall`);
      if (!r.ok) return null;
      return r.json();
    },
  });

  const listing = (primaryListings as any[])?.find((l: any) => l.farmId === farmId);
  const isUp = (farm?.changePercent ?? 0) >= 0;

  if (isLoading) {
    return (
      <div className="app-shell">
        <Skeleton className="h-72 w-full" />
        <div className="px-4 pt-4 space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-12 rounded-full" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!farm) return null;

  const chartData = (farm.priceHistory as any[])?.map((p: any) => ({ date: String(p.date).split("T")[0].slice(5), price: Number(p.price) })) ?? [];
  const currentStageIdx = GROWTH_STAGES.findIndex(s => s.key === (growth?.stage ?? "growing"));
  const [mapLat, mapLng] = getKenyaCoords(farm.location ?? "");

  const ndviNow = getNdvi(farm.cropType, growth?.stage ?? "growing");
  const ndviMeta = ndviColor(ndviNow);
  const ndviSeries = generateNdviTimeSeries(farm.cropType);
  const vegCover = getVegetationCover(farm.cropType, ndviNow);
  const healthScore = Math.min(100, Math.round(ndviNow * 55 + (growth?.percent ?? 50) * 0.3 + 10));

  const compareFarm = (primaryListings as CompareListing[] | undefined)?.find(l => l.farmId !== farmId);

  const aiTags: { text: string; color: string }[] = [];
  if (farm.changePercent > 3) aiTags.push({ text: `📈 +${farm.changePercent.toFixed(1)}% momentum`, color: "bg-[#16a34a]/10 border-[#16a34a]/20 text-[#16a34a]" });
  if (farm.changePercent < -2) aiTags.push({ text: "📉 Price dip — buy opportunity", color: "bg-amber-50 border-amber-200 text-amber-700" });
  if (growth?.stage === "growing") aiTags.push({ text: "🌱 Peak growing phase", color: "bg-blue-50 border-blue-200 text-blue-700" });
  if (growth?.stage === "harvest") aiTags.push({ text: "🌾 Near harvest", color: "bg-orange-50 border-orange-200 text-orange-700" });
  if (farm.fundingPercent > 70) aiTags.push({ text: `⚡ ${farm.fundingPercent}% funded`, color: "bg-red-50 border-red-200 text-red-700" });
  if (farm.fundingPercent < 30) aiTags.push({ text: "🎯 Early entry", color: "bg-violet-50 border-violet-200 text-violet-700" });
  const cropTagMap: Record<string, string> = {
    maize: "🌽 Highest demand crop", coffee: "☕ Premium export", avocado: "🥑 EU export season",
    tea: "🍵 Stable prices", horticulture: "🥦 Fast ROI cycle",
  };
  const ck = farm.cropType?.toLowerCase();
  for (const [k, v] of Object.entries(cropTagMap)) {
    if (ck?.includes(k)) { aiTags.push({ text: v, color: "bg-[#16a34a]/10 border-[#16a34a]/20 text-[#16a34a]" }); break; }
  }
  if (aiTags.length === 0) aiTags.push({ text: "✅ Verified farm", color: "bg-[#16a34a]/10 border-[#16a34a]/20 text-[#16a34a]" });

  const galleryImages = [
    getCropImage(farm.cropType, farm.imageUrl ?? undefined),
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/${latLngToTile(mapLat, mapLng, 14).y}/${latLngToTile(mapLat, mapLng, 14).x}`,
    getCropImage(farm.cropType),
  ];

  const toggleWatchlist = async () => {
    if (!token || watchlistLoading) return;
    setWatchlistLoading(true);
    try {
      if (inWatchlist) {
        await fetch(`/api/watchlist/${farmId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        setInWatchlist(false);
      } else {
        await fetch("/api/watchlist", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ farmId }) });
        setInWatchlist(true);
      }
    } catch { /* ignore */ } finally {
      setWatchlistLoading(false);
    }
  };

  return (
    <div ref={scrollRef} className="app-shell pb-36 page-enter overflow-y-auto h-screen" data-testid="farm-detail">

      {/* ── HERO GALLERY ── */}
      <div className="relative h-72 overflow-hidden select-none">
        <AnimatePresence mode="wait">
          <motion.img
            key={imgIdx}
            src={galleryImages[imgIdx]}
            alt={farm.name}
            className="w-full h-full object-cover absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            onError={e => { (e.currentTarget as HTMLImageElement).src = getCropImage(farm.cropType); }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/80" />

        {/* Back */}
        <button
          data-testid="button-back"
          onClick={() => window.history.back()}
          className="absolute top-11 left-4 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/10 active:scale-90 transition-transform z-10"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>

        {/* Gallery dots */}
        <div className="absolute top-12 right-4 flex flex-col gap-1.5 z-10">
          {galleryImages.map((_, i) => (
            <button key={i} onClick={() => setImgIdx(i)}
              className={`w-1.5 rounded-full transition-all ${i === imgIdx ? "h-5 bg-white" : "h-1.5 bg-white/50"}`} />
          ))}
        </div>

        {/* Gallery label */}
        {imgIdx === 1 && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-10">
            🛰️ Satellite View
          </div>
        )}
        {imgIdx === 2 && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-10">
            📸 Crop Photo
          </div>
        )}

        {/* Farm name & meta — pinned bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="bg-[#16a34a] text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <ShieldCheck size={9} /> Verified
                </span>
                {growth?.stage && (
                  <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full capitalize">
                    {growth.stage === "growing" ? "🌱" : growth.stage === "harvest" ? "🌾" : "🌿"} {growth.stage}
                  </span>
                )}
              </div>
              <h1 className="text-white text-2xl font-black drop-shadow-lg leading-tight" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{farm.name}</h1>
              <p className="text-white/80 text-sm mt-0.5 flex items-center gap-1">
                <MapPin size={11} /> {farm.cropType} · {farm.location}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-white/70 text-[10px]">Share price</p>
              <p className="text-white text-xl font-black drop-shadow" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{formatKES(farm.sharePrice)}</p>
              <div className={`flex items-center justify-end gap-1 mt-0.5 ${isUp ? "text-green-400" : "text-red-400"}`}>
                {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                <span className="text-xs font-bold">{formatChange(farm.changePercent)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS ROW ── */}
      <div className="px-4 py-3 flex gap-2 border-b border-border bg-background">
        <button
          onClick={() => setShareOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#16a34a]/10 rounded-xl py-2.5 text-xs font-semibold text-[#16a34a] active:scale-95 transition-transform"
        >
          <Share2 size={13} /> Share
        </button>
        {compareFarm && (
          <button
            onClick={() => setCompareOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 rounded-xl py-2.5 text-xs font-semibold text-blue-600 active:scale-95 transition-transform"
          >
            <Scale size={13} /> Compare
          </button>
        )}
        <button
          onClick={toggleWatchlist}
          disabled={watchlistLoading}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold active:scale-95 transition-all ${
            inWatchlist
              ? "bg-amber-50 text-amber-600 border border-amber-200"
              : "bg-muted text-muted-foreground"
          } ${watchlistLoading ? "opacity-60" : ""}`}
        >
          <Star size={13} className={inWatchlist ? "fill-amber-500 text-amber-500" : ""} />
          {inWatchlist ? "Saved" : "Watchlist"}
        </button>
      </div>

      {/* ── PRICE CARD ── */}
      <div className="px-4 pt-4">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Current Price</p>
              <p className="text-3xl font-black text-foreground leading-none" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{formatKES(farm.currentPrice)}</p>
              <div className={`flex items-center gap-1.5 mt-1.5 ${isUp ? "text-[#16a34a]" : "text-red-500"}`}>
                {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                <span className="text-sm font-bold">{formatChange(farm.changePercent)} today</span>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1.5">
              {/* Investor avatar stack */}
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-2">
                  {["#16a34a","#3b82f6","#f59e0b","#ef4444","#8b5cf6"].slice(0, Math.min(5, farm.investors ?? 3)).map((color, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                      style={{ backgroundColor: color, zIndex: 5 - i }}>
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <span className="text-xs font-bold text-foreground">{farm.investors}</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">{farm.investors} investors · {farm.tradeCount} trades</p>
            </div>
          </div>

          {/* Funding progress */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-muted-foreground font-semibold">Funding progress</p>
              <span className={`text-xs font-bold ${farm.fundingPercent > 70 ? "text-red-500" : "text-[#16a34a]"}`}>{farm.fundingPercent}% raised</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <motion.div
                className={`h-2.5 rounded-full ${farm.fundingPercent > 70 ? "bg-gradient-to-r from-amber-400 to-red-500" : "bg-gradient-to-r from-emerald-500 to-green-400"}`}
                initial={{ width: 0 }}
                animate={{ width: `${farm.fundingPercent}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-[10px] text-muted-foreground">{formatKES(farm.loanAmount * farm.fundingPercent / 100)} raised</p>
              <p className="text-[10px] text-muted-foreground">Goal: {formatKES(farm.loanAmount)}</p>
            </div>
          </div>

          {/* AI tags */}
          {aiTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
              {aiTags.slice(0, 4).map((tag, i) => (
                <span key={i} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${tag.color}`}>{tag.text}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div className="px-4 pt-4 pb-1 sticky top-0 bg-background z-20 border-b border-border">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {DETAIL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-full text-[11px] font-semibold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[#16a34a] text-white shadow-md shadow-[#16a34a]/25"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="px-4 pt-4 space-y-4 pb-4"
        >

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <StatCard label="Loan Amount"    value={formatKES(farm.loanAmount)} />
                <StatCard label="Total Shares"   value={farm.totalShares.toLocaleString()} />
                <StatCard label="Available"      value={farm.sharesAvailable.toLocaleString()} accent="text-[#16a34a]" />
                <StatCard label="Per Share"      value={formatKES(farm.sharePrice)} />
              </div>

              {/* Farmer card */}
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-[#16a34a] to-emerald-400" />
                <div className="p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <User size={11} /> About the Farmer
                  </p>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#16a34a]/20 to-emerald-100 border-2 border-[#16a34a]/20 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="text-[#16a34a] font-black text-xl">
                        {((farm as any).farmerName ?? farm.name ?? "F").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-foreground text-base">{(farm as any).farmerName ?? "Investa Farm Farmer"}</p>
                        <span className="bg-[#16a34a]/10 text-[#16a34a] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldCheck size={9} /> Verified
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {farm.location}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Primary Crop", value: farm.cropType },
                      { label: "Region", value: (farm.location ?? "Kenya").split(",")[0]?.trim() },
                      { label: "Farm Size", value: "~2.5 Acres" },
                      { label: "Season", value: "Long Rains 2026" },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-muted/60 rounded-xl p-3">
                        <p className="text-muted-foreground text-[9px] uppercase tracking-wider font-bold mb-0.5">{label}</p>
                        <p className="text-foreground font-semibold text-xs">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {farm.description && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-sm font-bold mb-2">About this Farm</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{farm.description}</p>
                </div>
              )}
            </>
          )}

          {/* ── FINANCIALS ── */}
          {activeTab === "financials" && (
            <>
              {/* Projected returns */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl p-4 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-lg">⚡</span>
                    <p className="text-xs font-bold text-orange-600">Mid-Season Exit</p>
                  </div>
                  <p className="text-orange-500 font-black text-2xl" style={{ fontFamily: "Space Grotesk, sans-serif" }}>+10%</p>
                  <p className="text-orange-400 text-[10px] mt-0.5">30–60 days</p>
                </div>
                <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-50 to-green-50 border border-[#16a34a]/25">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-lg">🌾</span>
                    <p className="text-xs font-bold text-[#16a34a]">Full Season Exit</p>
                  </div>
                  <p className="text-[#16a34a] font-black text-2xl" style={{ fontFamily: "Space Grotesk, sans-serif" }}>+22%</p>
                  <p className="text-[#16a34a]/60 text-[10px] mt-0.5">~6 months</p>
                </div>
              </div>

              {/* Price chart */}
              {chartData.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart2 size={14} className="text-[#16a34a]" />
                      <p className="text-sm font-bold">Price Performance</p>
                    </div>
                    <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${isUp ? "bg-[#16a34a]/10 text-[#16a34a]" : "bg-red-50 text-red-500"}`}>
                      {formatChange(farm.changePercent)}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="priceGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "11px", color: "var(--foreground)" }}
                        formatter={(v: number) => [formatKES(v), "Price"]}
                      />
                      <Area type="monotone" dataKey="price" stroke="#16a34a" strokeWidth={2.5} fill="url(#priceGrad2)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                      { label: "Season Low",  val: formatKES(Math.round(farm.currentPrice * 0.88)), color: "text-red-500" },
                      { label: "Current",     val: formatKES(farm.currentPrice),                   color: "text-foreground" },
                      { label: "Season High", val: formatKES(Math.round(farm.currentPrice * 1.18)), color: "text-[#16a34a]" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="bg-muted/60 rounded-xl p-2.5 text-center">
                        <p className="text-muted-foreground text-[9px] font-semibold mb-0.5">{label}</p>
                        <p className={`font-bold text-xs ${color}`}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Share details list */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-sm font-bold mb-3">Share Details</p>
                <div className="space-y-0">
                  {[
                    { label: "Loan Amount",      val: formatKES(farm.loanAmount),                    color: "text-foreground" },
                    { label: "Total Shares",      val: farm.totalShares.toLocaleString(),              color: "text-foreground" },
                    { label: "Shares Available",  val: farm.sharesAvailable.toLocaleString(),          color: "text-[#16a34a]" },
                    { label: "Price per Share",   val: formatKES(farm.sharePrice),                    color: "text-foreground" },
                    { label: "Active Investors",  val: String(farm.investors),                        color: "text-blue-600" },
                    { label: "Trade Volume",      val: `${farm.tradeCount} trades`,                   color: "text-foreground" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <span className="text-muted-foreground text-sm">{label}</span>
                      <span className={`font-bold text-sm ${color}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── FARM HEALTH (merged Growth + Satellite) ── */}
          {activeTab === "farm-health" && (
            <>
              {/* Satellite tile at the top of Farm Health */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Globe size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Satellite + NDVI</p>
                      <p className="text-muted-foreground text-[10px]">{mapLat.toFixed(4)}°N, {mapLng.toFixed(4)}°E · Esri World Imagery</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-green-700">Live</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
                  <SatelliteTileMap lat={mapLat} lng={mapLng} farmName={farm.name} />
                </div>
                {/* NDVI overlay on satellite */}
                <div className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-primary" />
                      <p className="text-sm font-bold">Vegetation Index (NDVI)</p>
                      <AiSectionBot context={`NDVI for this ${farm.cropType} farm is ${ndviNow.toFixed(2)} (${ndviMeta.label}). What does this mean for investors?`} label="NDVI" />
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ndviMeta.bg} ${ndviMeta.color}`}>{ndviMeta.label}</span>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-2">
                      <span>0.0 Bare soil</span>
                      <span className={`font-bold ${ndviMeta.color}`}>NDVI {ndviNow.toFixed(2)}</span>
                      <span>1.0 Dense</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3.5 overflow-hidden">
                      <motion.div className="h-3.5 rounded-full" initial={{ width: 0 }} animate={{ width: `${ndviNow * 100}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                        style={{ background: `linear-gradient(90deg, #eab308 0%, #16a34a ${ndviNow * 100}%)` }} />
                    </div>
                  </div>
                  <div className="h-36 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ndviSeries} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                        <YAxis domain={[0, 1]} tick={{ fontSize: 9 }} tickCount={5} tickFormatter={(v: number) => v.toFixed(1)} />
                        <Tooltip formatter={(v: number) => [v.toFixed(3), "NDVI"]} />
                        <Line type="monotone" dataKey="ndvi" stroke="#16a34a" strokeWidth={2.5}
                          dot={(props: any) => {
                            const { cx, cy, index } = props;
                            if (index === ndviSeries.length - 1) return <circle key="now" cx={cx} cy={cy} r={6} fill="#16a34a" stroke="white" strokeWidth={2.5} />;
                            return <circle key={index} cx={cx} cy={cy} r={2.5} fill="#16a34a" />;
                          }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Land cover */}
                  <div className="mt-4 space-y-2.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Cpu size={10} /> Land Cover</p>
                    {vegCover.map(item => (
                      <div key={item.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-xs text-muted-foreground">{item.name}</span>
                          </div>
                          <span className="text-xs font-bold" style={{ color: item.color }}>{item.pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div className="h-1.5 rounded-full" initial={{ width: 0 }} animate={{ width: `${item.pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }} style={{ backgroundColor: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Health score */}
                <div className="bg-card border border-[#16a34a]/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-[#16a34a]" />
                      <p className="text-sm font-bold">Composite Health Score</p>
                    </div>
                    <span className={`text-2xl font-black ${healthScore >= 75 ? "text-[#16a34a]" : healthScore >= 50 ? "text-amber-500" : "text-red-500"}`} style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                      {healthScore}<span className="text-sm font-semibold text-muted-foreground">/100</span>
                    </span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-3">
                    <motion.div className="h-3 rounded-full" initial={{ width: 0 }} animate={{ width: `${healthScore}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                      style={{ background: "linear-gradient(90deg,#16a34a,#22c55e)" }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Vegetation", val: `${(ndviNow * 100).toFixed(0)}%`, color: ndviMeta.color },
                      { label: "Growth", val: growth?.stage ?? "N/A", color: "text-blue-500" },
                      { label: "Season", val: `${growth?.percent ?? 0}%`, color: "text-amber-500" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="bg-muted/60 rounded-xl p-2.5 text-center">
                        <p className={`text-xs font-bold ${color}`}>{val}</p>
                        <p className="text-muted-foreground text-[9px] mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Growth section */}
              {growth ? (
                <>
                  {/* Stage tracker */}
                  <div className="bg-card rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold">Crop Growth Stage</p>
                      <span className="text-[#16a34a] text-sm font-bold bg-[#16a34a]/10 px-3 py-1 rounded-full">{growth.percent}% complete</span>
                    </div>
                    <div className="flex items-center gap-1 mb-4">
                      {GROWTH_STAGES.map((stage, i) => {
                        const Icon = stage.icon;
                        const done = i <= currentStageIdx;
                        const current = i === currentStageIdx;
                        return (
                          <div key={stage.key} className="flex items-center gap-1 flex-1">
                            <div className={`flex flex-col items-center gap-1.5 flex-1 transition-opacity ${current ? "opacity-100" : done ? "opacity-60" : "opacity-25"}`}>
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${current ? stage.color : done ? "bg-[#16a34a]/15" : "bg-muted"}`}>
                                <Icon size={20} className={current ? "text-white" : "text-muted-foreground"} />
                              </div>
                              <span className={`text-[10px] font-bold text-center ${current ? "text-[#16a34a]" : "text-muted-foreground"}`}>{stage.label}</span>
                            </div>
                            {i < GROWTH_STAGES.length - 1 && (
                              <div className={`h-0.5 w-6 rounded-full flex-shrink-0 ${i < currentStageIdx ? "bg-[#16a34a]" : "bg-muted"}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="w-full bg-muted rounded-full h-3 mb-2.5 overflow-hidden">
                      <motion.div
                        className="bg-gradient-to-r from-emerald-500 to-green-400 rounded-full h-3"
                        initial={{ width: 0 }}
                        animate={{ width: `${growth.percent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">{growth.daysElapsed} of {growth.daysTotal} days ·{" "}
                      <span className="text-[#16a34a] font-bold">{growth.daysTotal - growth.daysElapsed} days to harvest</span>
                    </p>
                  </div>

                  {/* Commodity price */}
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Live Commodity · {farm.cropType}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-foreground font-black text-2xl" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                        {formatKES(growth.marketPriceKes)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">/ 90kg bag</span>
                      </p>
                      <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${growth.marketChangePercent >= 0 ? "bg-[#16a34a]/10 text-[#16a34a]" : "bg-red-50 text-red-500"}`}>
                        {growth.marketChangePercent >= 0 ? "+" : ""}{growth.marketChangePercent.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-2 italic">{growth.marketInsight}</p>
                  </div>

                  <WeatherNdvi lat={mapLat} lng={mapLng} cropType={farm.cropType} stage={growth.stage} />

                  {rainfallData && (() => {
                    const riskColors: Record<string, { border: string; text: string; badge: string }> = {
                      green:  { border: "border-[#16a34a]/30",  text: "text-[#16a34a]",  badge: "bg-[#16a34a]/10 text-[#16a34a]"  },
                      yellow: { border: "border-amber-400/40",  text: "text-amber-500",  badge: "bg-amber-500/10 text-amber-500"   },
                      red:    { border: "border-red-400/40",    text: "text-red-500",    badge: "bg-red-500/10 text-red-500"       },
                    };
                    const c = riskColors[rainfallData.riskColor] ?? riskColors["green"]!;
                    const statusEmoji = rainfallData.riskColor === "green" ? "🌧️" : rainfallData.riskColor === "yellow" ? "⚠️" : "🚨";
                    const yieldAdj = rainfallData.yieldAdjustmentPercent ?? 0;
                    return (
                      <div className={`bg-card border ${c.border} rounded-2xl p-4`}>
                        <div className="flex items-center justify-between mb-3">
                          <p className={`text-sm font-bold ${c.text} flex items-center gap-2`}>
                            <CloudRain size={14} /> Rainfall Impact
                          </p>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${c.badge}`}>
                            {statusEmoji} {rainfallData.riskLevel === "optimal" ? "Optimal" : rainfallData.riskLevel === "low" ? "Low Rainfall" : rainfallData.riskLevel === "drought" ? "Drought Risk" : "Excess / Flood"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {[
                            { label: "Season Total", val: `${rainfallData.seasonalTotalMm}mm` },
                            { label: "Optimal Range", val: `${rainfallData.optimalRangeMin}–${rainfallData.optimalRangeMax}mm` },
                            { label: "Yield Adj.", val: `${yieldAdj >= 0 ? "+" : ""}${yieldAdj}%`, color: yieldAdj >= 0 ? "text-[#16a34a]" : "text-red-500" },
                          ].map(({ label, val, color }) => (
                            <div key={label} className="bg-muted/60 rounded-xl p-2.5 text-center">
                              <p className="text-muted-foreground text-[9px] font-semibold mb-0.5">{label}</p>
                              <p className={`font-bold text-xs ${color ?? "text-foreground"}`}>{val}</p>
                            </div>
                          ))}
                        </div>
                        <p className={`text-[10px] ${c.text} mb-2 leading-relaxed`}>{rainfallData.riskLabel}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {rainfallData.criticalDrought && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">🌵 Critical Drought</span>}
                          {rainfallData.floodRisk && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🌊 Flood Risk</span>}
                          {rainfallData.extremeDays > 3 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">⚡ {rainfallData.extremeDays} heavy rain days</span>}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="bg-card rounded-2xl border border-border p-4">
                    <p className="text-sm font-bold mb-3">Growth Timeline</p>
                    <div className="space-y-0">
                      {[
                        { label: "Days Elapsed",    val: `${growth.daysElapsed} days`,                                            color: "text-foreground" },
                        { label: "Total Season",     val: `${growth.daysTotal} days`,                                             color: "text-foreground" },
                        { label: "Days to Harvest",  val: `${growth.daysTotal - growth.daysElapsed} days`,                       color: "text-[#16a34a]" },
                        { label: "Current Stage",    val: growth.stage.charAt(0).toUpperCase() + growth.stage.slice(1),          color: "text-blue-600" },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                          <span className="text-muted-foreground text-sm">{label}</span>
                          <span className={`font-bold text-sm ${color}`}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 bg-muted/30 rounded-2xl border border-border">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Leaf size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-foreground font-bold">Growth data not yet available</p>
                  <p className="text-muted-foreground text-sm mt-1">Check back once the crop season begins</p>
                </div>
              )}
            </>
          )}

          {/* ── LOCATION ── */}
          {activeTab === "location" && (
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation size={14} className="text-[#16a34a]" />
                    <p className="text-sm font-bold">Farm Location</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                    <span className="text-[10px] text-[#16a34a] font-bold uppercase tracking-wide">GPS Verified</span>
                  </div>
                </div>
                <div className="relative" style={{ height: 280 }}>
                  <FarmLeafletMap lat={mapLat} lng={mapLng} label={farm.location ?? "Farm Location"} />
                  <div className="absolute bottom-3 left-3 pointer-events-none z-[500]">
                    <div className="bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg">
                      <p className="text-white font-bold text-xs">{farm.location}</p>
                      <p className="text-white/70 text-[10px]">{mapLat.toFixed(4)}°, {mapLng.toFixed(4)}°</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-sm font-bold mb-3 flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#16a34a]" /> Location Details
                </p>
                <div className="space-y-0">
                  {[
                    { label: "County / Area", val: (farm.location ?? "Kenya").split(",")[0]?.trim() },
                    { label: "Latitude",       val: `${mapLat.toFixed(4)}°N` },
                    { label: "Longitude",      val: `${mapLng.toFixed(4)}°E` },
                    { label: "Country",        val: "Kenya" },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <span className="text-muted-foreground text-sm">{label}</span>
                      <span className="font-bold text-sm text-foreground">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── NEWS ── */}
          {activeTab === "news" && (
            <div className="space-y-4">
              {cropSentiment && (
                <div className={`rounded-2xl border p-4 ${cropSentiment.score > 10 ? "bg-green-50 border-green-200" : cropSentiment.score < -10 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className={cropSentiment.score > 10 ? "text-green-600" : cropSentiment.score < -10 ? "text-red-500" : "text-amber-600"} />
                      <p className="text-sm font-bold text-foreground">AI Market Sentiment — {farm?.cropType}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cropSentiment.score > 10 ? "bg-green-100 text-green-700" : cropSentiment.score < -10 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                      {cropSentiment.score > 10 ? "Bullish 📈" : cropSentiment.score < -10 ? "Bearish 📉" : "Neutral ➡️"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2.5 bg-white/60 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${cropSentiment.score > 10 ? "bg-green-500" : cropSentiment.score < -10 ? "bg-red-500" : "bg-amber-400"}`}
                        style={{ width: `${Math.min(100, Math.max(5, 50 + cropSentiment.score / 2))}%` }} />
                    </div>
                    <span className={`text-sm font-bold ${cropSentiment.score > 10 ? "text-green-700" : cropSentiment.score < -10 ? "text-red-600" : "text-amber-700"}`}>
                      {cropSentiment.score > 0 ? "+" : ""}{cropSentiment.score}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Based on live news analysis · updated hourly</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Newspaper size={14} className="text-primary" />
                  <p className="text-sm font-bold">Crop Price News</p>
                </div>
                <button onClick={() => refetchNews()} className="flex items-center gap-1.5 text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1.5 rounded-full active:scale-95 transition-transform">
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {newsLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse space-y-2">
                      <div className="h-3.5 bg-muted rounded-lg w-3/4" />
                      <div className="h-2.5 bg-muted rounded w-full" />
                      <div className="h-2.5 bg-muted rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : !cropNews?.length ? (
                <div className="bg-muted/40 rounded-2xl border border-border p-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Newspaper size={24} className="text-muted-foreground" />
                  </div>
                  <p className="text-foreground font-bold">No news found</p>
                  <p className="text-muted-foreground text-sm mt-1">Check back soon for Kenyan agri-market updates</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cropNews.map((item, i) => {
                    const isCropRelated = !!item.cropRelevance;
                    const sentScore = item.sentiment ?? 0;
                    const sentColor = sentScore > 10 ? "text-green-600 bg-green-50 border-green-200"
                      : sentScore < -10 ? "text-red-500 bg-red-50 border-red-200"
                      : "text-amber-600 bg-amber-50 border-amber-200";
                    const sentLabel = sentScore > 10 ? `+${sentScore} Bullish` : sentScore < -10 ? `${sentScore} Bearish` : "Neutral";
                    return (
                      <a key={i} href={item.url || "#"} target="_blank" rel="noreferrer"
                        className={`block bg-card border rounded-2xl p-4 active:scale-[0.98] transition-transform ${isCropRelated ? "border-primary/30 ring-1 ring-primary/10" : "border-border"}`}>
                        {isCropRelated && (
                          <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide mb-2">
                            🌾 {farm?.cropType} related
                          </span>
                        )}
                        <p className="text-foreground font-bold text-sm leading-snug line-clamp-2 mb-1.5">{item.title}</p>
                        <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed mb-3">{item.summary}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-semibold">{item.source}</span>
                            {item.publishedAt && (
                              <span className="text-[10px] text-muted-foreground">· {new Date(item.publishedAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {sentScore !== 0 && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${sentColor}`}>{sentLabel}</span>}
                            <ChevronRight size={12} className="text-muted-foreground" />
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}

              <div className="text-center">
                <p className="text-muted-foreground text-[10px]">News sourced from Kenyan agri-markets via AI analysis. Not financial advice.</p>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* ── SCROLL TO TOP ── */}
      <AnimatePresence>
        {scrollY > 200 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-36 right-4 z-[55] w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center shadow-xl active:scale-90 transition-transform"
          >
            <ChevronUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── FLOATING CTA ── */}
      {listing && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 pointer-events-none">
          <div className="pointer-events-auto bg-background/95 backdrop-blur-xl border-t border-border px-4 pt-3 pb-8 shadow-2xl">
            {/* Avatar social proof above CTA */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  {["#16a34a","#3b82f6","#f59e0b","#ef4444"].map((color, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border-2 border-background flex items-center justify-center text-white text-[7px] font-bold"
                      style={{ backgroundColor: color }}>
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium">
                  <span className="text-foreground font-bold">{farm.investors}</span> investors backing this farm
                </p>
              </div>
              <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${farm.fundingPercent > 70 ? "bg-red-50 text-red-600" : "bg-[#16a34a]/10 text-[#16a34a]"}`}>
                {farm.fundingPercent}% funded
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-muted/60 rounded-xl p-2.5 text-center">
                <p className="text-[9px] text-muted-foreground font-semibold uppercase mb-0.5">Per Share</p>
                <p className="text-sm font-black text-foreground" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{formatKES(listing.pricePerShare)}</p>
              </div>
              <div className="bg-[#16a34a]/10 rounded-xl p-2.5 text-center">
                <p className="text-[9px] text-[#16a34a] font-semibold uppercase mb-0.5">Target ROI</p>
                <p className="text-sm font-black text-[#16a34a]">+22%</p>
              </div>
              <div className="bg-muted/60 rounded-xl p-2.5 text-center">
                <p className="text-[9px] text-muted-foreground font-semibold uppercase mb-0.5">Available</p>
                <p className="text-sm font-black text-foreground">{listing.sharesAvailable.toLocaleString()}</p>
              </div>
            </div>
            <button
              data-testid="button-buy-confirm"
              onClick={() => setInvestOpen(true)}
              className="w-full bg-gradient-to-r from-[#16a34a] to-emerald-500 text-white font-black py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-[#16a34a]/30 text-base"
              style={{ boxShadow: "0 8px 32px 0 rgba(22,163,74,0.35)" }}
            >
              <ShoppingCart size={18} />
              Add Funds — Invest in {farm.cropType}
            </button>
          </div>
        </div>
      )}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={farm.name}
        text={`🌱 Invest in ${farm.name} on Investa Farm! ${farm.cropType} · ${farm.location} · Up to +22% returns`}
        url={typeof window !== "undefined" ? window.location.href : ""}
      />

      <InvestModal
        open={investOpen}
        onClose={() => setInvestOpen(false)}
        listing={listing ? {
          id: listing.id,
          farmId: listing.farmId,
          farmName: listing.farmName,
          cropType: listing.cropType,
          location: listing.location,
          pricePerShare: listing.pricePerShare,
          sharesAvailable: listing.sharesAvailable,
          changePercent: listing.changePercent,
          imageUrl: farm.imageUrl ?? undefined,
        } : null}
      />

      {(() => {
        const thisListing: CompareListing | null = listing ? {
          id: listing.id,
          farmId: listing.farmId,
          farmName: listing.farmName,
          cropType: listing.cropType,
          location: listing.location,
          pricePerShare: listing.pricePerShare,
          sharesAvailable: listing.sharesAvailable,
          changePercent: listing.changePercent,
          imageUrl: farm.imageUrl ?? undefined,
          totalShares: farm.totalShares,
        } : null;
        return (
          <CompareFarmsModal
            open={compareOpen}
            onClose={() => setCompareOpen(false)}
            farmA={thisListing}
            farmB={compareFarm ?? null}
          />
        );
      })()}
    </div>
  );
}
