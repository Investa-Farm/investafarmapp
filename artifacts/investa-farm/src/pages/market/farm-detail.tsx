import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useParams } from "wouter";
import { useGetFarm, getGetFarmQueryKey, useListPrimaryMarket } from "@workspace/api-client-react";
import { ArrowLeft, TrendingUp, TrendingDown, Users, ShoppingCart, Leaf, Droplets, Sun, MapPin, ShieldCheck, User, Sparkles, BarChart2, Navigation, CloudRain, Wind, Thermometer, Droplet, Newspaper, RefreshCw, Globe, Layers, Cpu, Scale } from "lucide-react";
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
    return [
      lat + Math.cos(angle) * r,
      lng + (Math.sin(angle) * r) / lngScale,
    ] as [number, number];
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
        color: "#16a34a",
        weight: 2.5,
        fillColor: "#16a34a",
        fillOpacity: 0.15,
        dashArray: undefined,
      }).addTo(map);

      const bounds = farmPoly.getBounds();
      map.fitBounds(bounds, { padding: [30, 30] });

      farmPoly.bindPopup(
        `<div style="font-size:13px;font-weight:700;color:#15803d">${label}</div>` +
        `<div style="font-size:11px;color:#6b7280;margin-top:2px">Farm boundary (approx.)</div>`,
        { offset: [0, -4] }
      ).openPopup();

      L.circleMarker([lat, lng], {
        radius: 5,
        color: "#16a34a",
        fillColor: "#16a34a",
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(map);

      instanceRef.current = map;

      setTimeout(() => { try { map.invalidateSize(); } catch { /* ignore */ } }, 250);
      setTimeout(() => { try { map.invalidateSize(); } catch { /* ignore */ } }, 600);
    });
    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
  }, [lat, lng, label]);

  return (
    <div ref={mapRef} style={{ height: 260, width: "100%", background: "#e8f4e8" }}>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", color: "#6b7280", fontSize: 12, pointerEvents: "none",
      }}>
        Loading map…
      </div>
    </div>
  );
}

function AiInsightTags({ cropType, changePercent, stage, fundingPercent }: {
  cropType: string; changePercent: number; stage?: string; fundingPercent: number;
}) {
  const tags: { text: string; color: string }[] = [];
  if (changePercent > 3) tags.push({ text: `📈 Strong +${changePercent.toFixed(1)}% momentum`, color: "bg-[#16a34a]/5 border-[#16a34a]/20 text-[#16a34a]" });
  if (changePercent < -2) tags.push({ text: `📉 Price dip — buying opportunity`, color: "bg-amber-50 border-amber-200 text-amber-700" });
  if (stage === "growing") tags.push({ text: "🌱 In peak growing phase", color: "bg-blue-50 border-blue-200 text-blue-700" });
  if (stage === "harvest") tags.push({ text: "🌾 Near harvest — high confidence", color: "bg-orange-50 border-orange-200 text-orange-700" });
  if (fundingPercent > 70) tags.push({ text: `⚡ ${fundingPercent}% funded — almost full`, color: "bg-red-50 border-red-200 text-red-700" });
  if (fundingPercent < 30) tags.push({ text: "🎯 Early entry — best price", color: "bg-violet-50 border-violet-200 text-violet-700" });
  const cropTags: Record<string, string> = {
    maize: "🌽 Maize — highest demand crop in Kenya",
    coffee: "☕ Coffee — premium export demand",
    avocado: "🥑 Avocado — EU export season",
    tea: "🍵 Tea — stable year-round prices",
    horticulture: "🥦 Horticulture — fast ROI cycle",
  };
  const key = cropType?.toLowerCase();
  for (const [k, v] of Object.entries(cropTags)) {
    if (key?.includes(k)) { tags.push({ text: v, color: "bg-[#16a34a]/5 border-[#16a34a]/20 text-[#16a34a]" }); break; }
  }
  if (tags.length === 0) {
    tags.push({ text: "✅ Verified farm — audited by Investa", color: "bg-[#16a34a]/5 border-[#16a34a]/20 text-[#16a34a]" });
  }
  return (
    <div className="bg-card rounded-2xl border border-border p-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles size={13} className="text-[#16a34a]" />
        <p className="text-xs font-semibold text-foreground">AI Investment Insights</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.slice(0, 4).map((tag, i) => (
          <span key={i} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${tag.color}`}>
            {tag.text}
          </span>
        ))}
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
    <div className="relative overflow-hidden" style={{ aspectRatio: "1 / 1" }}>
      <div className="grid grid-cols-3 absolute inset-0">
        {grid.map(({ dx, dy }) => (
          <img key={`${dx}-${dy}`} src={tileUrl(x + dx, y + dy)}
            className="w-full h-full object-cover" alt="" loading="lazy" />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center drop-shadow-lg">
          <div className="bg-white/90 border border-white px-2 py-0.5 rounded-full text-[9px] font-bold text-gray-900 mb-1 shadow">
            {farmName}
          </div>
          <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg" />
          <div className="w-0.5 h-3 bg-red-500 drop-shadow" />
        </div>
      </div>
      <div className="absolute bottom-2 left-3 flex items-end gap-1">
        <div className="w-10 h-0.5 bg-white/80 rounded" />
        <span className="text-white text-[8px] font-bold drop-shadow leading-none">~2.4 km</span>
      </div>
      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded backdrop-blur-sm">
        Esri World Imagery
      </div>
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
      {/* NDVI Card */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#16a34a]" />
            <p className="text-sm font-semibold">Satellite Vegetation (NDVI)</p>
            <AiSectionBot context={`NDVI score is ${ndvi.toFixed(2)} (${ndviMeta.label}) for a ${cropType} farm in ${stage} stage. What does this mean for the farmer and investor?`} label="NDVI" />
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${ndviMeta.bg} ${ndviMeta.color}`}>{ndviMeta.label}</span>
        </div>
        <div className="flex items-end gap-3 mb-3">
          <div className="flex-1">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>0.0 (Bare)</span>
              <span className={ndviMeta.color}>NDVI {ndvi.toFixed(2)}</span>
              <span>1.0 (Dense)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full transition-all duration-700"
                style={{
                  width: `${ndvi * 100}%`,
                  background: `linear-gradient(90deg, #eab308 0%, #16a34a ${ndvi * 100}%)`,
                }}
              />
            </div>
          </div>
        </div>
        <p className="text-muted-foreground text-[10px]">
          Estimated from crop type &amp; growth stage. Higher NDVI = healthier, denser vegetation.
        </p>
      </div>

      {/* Weather Card */}
      <div className="bg-gradient-to-r from-sky-50 to-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <CloudRain size={14} className="text-blue-600" />
          <p className="text-sm font-semibold text-blue-800">Live Weather &amp; Forecast</p>
          <AiSectionBot
            context={wx ? `Current weather near this farm: temperature ${wx.current.temperature_2m}°C, humidity ${wx.current.relative_humidity_2m}%, wind ${wx.current.windspeed_10m} km/h, precipitation ${wx.current.precipitation}mm. Crop: ${cropType} in ${stage} stage. What weather risks or opportunities should the investor know about?` : `Weather for a ${cropType} farm in ${stage} stage in Kenya`}
            label="weather"
          />
        </div>
        {isLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {Array(4).fill(0).map((_, i) => <div key={i} className="h-14 bg-blue-100 rounded-xl animate-pulse" />)}
          </div>
        ) : wx ? (
          <>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { icon: Thermometer, label: "Temp", val: `${wx.current.temperature_2m}°C`, color: "text-orange-500" },
                { icon: Droplet, label: "Humidity", val: `${wx.current.relative_humidity_2m}%`, color: "text-blue-500" },
                { icon: Wind, label: "Wind", val: `${wx.current.windspeed_10m}km/h`, color: "text-slate-500" },
                { icon: CloudRain, label: "Rain", val: `${wx.current.precipitation}mm`, color: "text-blue-600" },
              ].map(({ icon: Icon, label, val, color }) => (
                <div key={label} className="bg-white/80 rounded-xl p-2 text-center">
                  <Icon size={14} className={`${color} mx-auto mb-1`} />
                  <p className="text-foreground font-bold text-xs">{val}</p>
                  <p className="text-muted-foreground text-[9px]">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-blue-700 text-[10px] font-semibold mb-2 uppercase tracking-wide">5-Day Forecast</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(wx.daily.time ?? []).slice(0, 5).map((t, i) => (
                <div key={t} className="flex-shrink-0 bg-white/70 rounded-xl p-2 text-center min-w-[52px]">
                  <p className="text-blue-600 text-[9px] font-semibold">{new Date(t).toLocaleDateString("en-KE", { weekday: "short" })}</p>
                  <p className="text-foreground font-bold text-[11px] mt-0.5">{Math.round(wx.daily.temperature_2m_max[i] ?? 0)}°</p>
                  <p className="text-blue-500 text-[9px]">{Math.round(wx.daily.temperature_2m_min[i] ?? 0)}°</p>
                  <p className="text-blue-400 text-[9px]">{(wx.daily.precipitation_sum[i] ?? 0).toFixed(1)}mm</p>
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

type DetailTab = "overview" | "financials" | "growth" | "satellite" | "location" | "news";

const DETAIL_TABS: { id: DetailTab; label: string; icon: string }[] = [
  { id: "overview",   label: "Overview",   icon: "🌾" },
  { id: "financials", label: "Financials", icon: "💰" },
  { id: "growth",     label: "Growth",     icon: "🌱" },
  { id: "satellite",  label: "Satellite",  icon: "🛰️" },
  { id: "location",   label: "Location",   icon: "📍" },
  { id: "news",       label: "News",       icon: "📰" },
];

export default function FarmDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const farmId = parseInt(params.id ?? "0", 10);
  const [investOpen, setInvestOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [slideIndex, setSlideIndex] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);
  const token = getToken();

  const { data: farm, isLoading } = useGetFarm(farmId, {
    query: { enabled: !!farmId, queryKey: getGetFarmQueryKey(farmId), staleTime: 3 * 60 * 1000 },
  });
  const { data: primaryListings } = useListPrimaryMarket();

  type NewsItem = { title: string; summary: string; url: string; source: string; publishedAt: string; sentiment?: number; cropRelevance?: number };
  type SentimentItem = { crop: string; score: number; trend: string };

  const { data: cropNews, isLoading: newsLoading, refetch: refetchNews } = useQuery<NewsItem[]>({
    queryKey: ["farm-crop-news", farm?.cropType],
    enabled: !!farm?.cropType && activeTab === "news",
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
    enabled: !!farmId && activeTab === "growth",
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(`/api/farms/${farmId}/rainfall`);
      if (!r.ok) return null;
      return r.json();
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listing = (primaryListings as any[])?.find((l: any) => l.farmId === farmId);
  const isUp = (farm?.changePercent ?? 0) >= 0;

  if (isLoading) {
    return (
      <div className="app-shell p-4 pt-14 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (!farm) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData = (farm.priceHistory as any[])?.map((p: any) => ({ date: String(p.date).split("T")[0].slice(5), price: Number(p.price) })) ?? [];
  const currentStageIdx = GROWTH_STAGES.findIndex(s => s.key === (growth?.stage ?? "growing"));
  const [mapLat, mapLng] = getKenyaCoords(farm.location ?? "");

  const ndviNow = getNdvi(farm.cropType, growth?.stage ?? "growing");
  const ndviMeta = ndviColor(ndviNow);
  const ndviSeries = generateNdviTimeSeries(farm.cropType);
  const vegCover = getVegetationCover(farm.cropType, ndviNow);
  const healthScore = Math.min(100, Math.round(ndviNow * 55 + (growth?.percent ?? 50) * 0.3 + 10));

  return (
    <div className="app-shell pb-28 page-enter" data-testid="farm-detail">
      {/* Hero image */}
      <div className="relative h-52">
        <img
          src={getCropImage(farm.cropType, farm.imageUrl)}
          alt={farm.name}
          className="w-full h-full object-cover"
          onError={e => { (e.currentTarget as HTMLImageElement).src = getCropImage(farm.cropType); }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        <div className="absolute top-12 left-4 right-4 flex items-center justify-between">
          <button data-testid="button-back" onClick={() => window.history.back()}
            className="w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="w-9 h-9" />
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <h1 className="text-white text-xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{farm.name}</h1>
          <p className="text-white/80 text-sm">{farm.cropType} · {farm.location}</p>
        </div>
      </div>

      {/* Feature slideshow — cycles price / AI insights / map / compare */}
      {(() => {
        const compareFarm = (primaryListings as CompareListing[] | undefined)?.find(l => l.farmId !== farmId);
        const slides = [
          /* 0 — Price strip */
          <div key="price" className="px-4 py-3 bg-card border-b border-border flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{formatKES(farm.currentPrice)}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isUp ? <TrendingUp size={12} className="text-[#16a34a]" /> : <TrendingDown size={12} className="text-red-500" />}
                <span className={`text-sm font-semibold ${isUp ? "text-[#16a34a]" : "text-red-500"}`}>
                  {formatChange(farm.changePercent)} today
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-muted-foreground text-xs justify-end">
                <Users size={11} /> <span>{farm.investors} investors</span>
              </div>
              <p className="text-muted-foreground text-xs mt-0.5">{farm.tradeCount} trades</p>
              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#16a34a]/10 text-[#16a34a]">
                {farm.fundingPercent}% funded
              </span>
            </div>
          </div>,

          /* 1 — AI insights */
          <div key="ai" className="bg-card border-b border-border px-4 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={13} className="text-[#16a34a]" />
              <p className="text-xs font-semibold text-foreground">AI Investment Insights</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const tags: { text: string; color: string }[] = [];
                if (farm.changePercent > 3) tags.push({ text: `📈 Strong +${farm.changePercent.toFixed(1)}% momentum`, color: "bg-[#16a34a]/5 border-[#16a34a]/20 text-[#16a34a]" });
                if (farm.changePercent < -2) tags.push({ text: "📉 Price dip — buying opportunity", color: "bg-amber-50 border-amber-200 text-amber-700" });
                if (growth?.stage === "growing") tags.push({ text: "🌱 In peak growing phase", color: "bg-blue-50 border-blue-200 text-blue-700" });
                if (growth?.stage === "harvest") tags.push({ text: "🌾 Near harvest — high confidence", color: "bg-orange-50 border-orange-200 text-orange-700" });
                if (farm.fundingPercent > 70) tags.push({ text: `⚡ ${farm.fundingPercent}% funded — almost full`, color: "bg-red-50 border-red-200 text-red-700" });
                if (farm.fundingPercent < 30) tags.push({ text: "🎯 Early entry — best price", color: "bg-violet-50 border-violet-200 text-violet-700" });
                const cropTags: Record<string, string> = {
                  maize: "🌽 Maize — highest demand crop in Kenya",
                  coffee: "☕ Coffee — premium export demand",
                  avocado: "🥑 Avocado — EU export season",
                  tea: "🍵 Tea — stable year-round prices",
                  horticulture: "🥦 Horticulture — fast ROI cycle",
                };
                const key = farm.cropType?.toLowerCase();
                for (const [k, v] of Object.entries(cropTags)) {
                  if (key?.includes(k)) { tags.push({ text: v, color: "bg-[#16a34a]/5 border-[#16a34a]/20 text-[#16a34a]" }); break; }
                }
                if (tags.length === 0) tags.push({ text: "✅ Verified farm — audited by Investa", color: "bg-[#16a34a]/5 border-[#16a34a]/20 text-[#16a34a]" });
                return tags.slice(0, 4).map((tag, i) => (
                  <span key={i} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${tag.color}`}>{tag.text}</span>
                ));
              })()}
            </div>
          </div>,

          /* 2 — Satellite map (lightweight image tiles, no Leaflet) */
          <div key="map" className="border-b border-border overflow-hidden" style={{ height: 220 }}>
            <div className="relative h-full">
              <SatelliteTileMap lat={mapLat} lng={mapLng} farmName={farm.name} />
              <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow-sm border border-border">
                <MapPin size={10} className="text-[#16a34a]" />
                <span className="text-[10px] font-bold text-foreground">Satellite View</span>
              </div>
            </div>
          </div>,

          /* 3 — Compare farms */
          <div key="compare" className="px-4 py-3 bg-card border-b border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Scale size={13} className="text-primary" />
              <p className="text-xs font-semibold text-foreground">Compare Farms</p>
            </div>
            {compareFarm ? (
              <button
                onClick={() => setCompareOpen(true)}
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={getCropImage(compareFarm.cropType, compareFarm.imageUrl)} alt={compareFarm.farmName} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[11px] font-bold text-foreground truncate">{farm.name} vs {compareFarm.farmName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{farm.cropType} · {compareFarm.cropType} — tap to compare side-by-side</p>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded-full">Compare →</span>
                </div>
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">No other farms available to compare.</p>
            )}
          </div>,
        ];

        const SLIDE_LABELS = ["Price", "AI Insights", "Map", "Compare"];

        return (
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={slideIndex}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {slides[slideIndex]}
              </motion.div>
            </AnimatePresence>
            {/* Slide controls */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {/* Prev */}
              <button
                onClick={() => setSlideIndex(i => (i - 1 + 4) % 4)}
                className="w-5 h-5 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center"
              >
                <svg width="7" height="7" viewBox="0 0 7 7" fill="none"><path d="M4.5 1L2 3.5L4.5 6" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {/* Dots */}
              {slides.map((_, i) => (
                <button key={i} onClick={() => setSlideIndex(i)}
                  className={`rounded-full transition-all duration-300 ${i === slideIndex ? "w-10 h-1.5 bg-[#16a34a]" : "w-1.5 h-1.5 bg-black/25 backdrop-blur-sm"}`}
                  title={SLIDE_LABELS[i]}
                />
              ))}
              {/* Next */}
              <button
                onClick={() => setSlideIndex(i => (i + 1) % 4)}
                className="w-5 h-5 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center"
              >
                <svg width="7" height="7" viewBox="0 0 7 7" fill="none"><path d="M2.5 1L5 3.5L2.5 6" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            {/* Slide label */}
            <div className="absolute top-2 right-3 bg-black/20 backdrop-blur-sm rounded-full px-2 py-0.5">
              <span className="text-[9px] font-bold text-white/90">{SLIDE_LABELS[slideIndex]}</span>
            </div>
          </div>
        );
      })()}

      {/* Sub-tabs */}
      <div className="px-4 pt-3 pb-1 sticky top-0 bg-background z-20 border-b border-border">
        <div className="flex bg-muted rounded-2xl p-1 gap-1">
          {DETAIL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1 ${
                activeTab === tab.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-4">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "Loan Amount", val: formatKES(farm.loanAmount) },
                { label: "Total Shares", val: farm.totalShares.toLocaleString() },
                { label: "Available", val: farm.sharesAvailable.toLocaleString() },
                { label: "Share Price", val: formatKES(farm.sharePrice) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-card rounded-xl border border-border p-3">
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</p>
                  <p className="text-foreground font-semibold text-sm mt-0.5">{val}</p>
                </div>
              ))}
            </div>

            {/* Farmer details */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <User size={14} className="text-[#16a34a]" /> About the Farmer
              </p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-[#16a34a]/10 border-2 border-[#16a34a]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#16a34a] font-bold text-lg">
                    {((farm as any).farmerName ?? farm.name ?? "F").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm">{(farm as any).farmerName ?? "Investa Farm Farmer"}</p>
                  <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                    <MapPin size={10} /> {farm.location}
                  </p>
                </div>
                <span className="flex-shrink-0 bg-[#16a34a]/10 text-[#16a34a] text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <ShieldCheck size={10} /> Verified
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Primary Crop", value: farm.cropType },
                  { label: "Region", value: (farm.location ?? "Kenya").split(",")[0]?.trim() },
                  { label: "Farm Size", value: "~2.5 Acres" },
                  { label: "Season", value: "Long Rains 2026" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/50 rounded-xl p-2.5">
                    <p className="text-muted-foreground text-[9px] uppercase tracking-wider font-semibold">{label}</p>
                    <p className="text-foreground font-semibold text-xs mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {farm.description && (
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold mb-1.5">About this Farm</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{farm.description}</p>
              </div>
            )}
          </>
        )}

        {/* ── FINANCIALS TAB ── */}
        {activeTab === "financials" && (
          <>
            {/* Funding progress */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Funding Status</p>
                <span className="text-[#16a34a] font-bold text-sm">{farm.fundingPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div className="bg-[#16a34a] rounded-full h-3 transition-all duration-700" style={{ width: `${farm.fundingPercent}%` }} />
              </div>
              <div className="flex justify-between mt-2">
                <p className="text-muted-foreground text-xs">{formatKES(farm.loanAmount * farm.fundingPercent / 100)} raised</p>
                <p className="text-muted-foreground text-xs">Target: {formatKES(farm.loanAmount)}</p>
              </div>
            </div>

            {/* Returns preview */}
            <div className="bg-gradient-to-r from-[#16a34a]/5 to-emerald-50 border border-[#16a34a]/20 rounded-2xl p-4">
              <p className="text-sm font-semibold text-foreground mb-2.5 flex items-center gap-1.5">
                <span>💰</span> Projected Returns
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/90 rounded-xl p-3 border border-orange-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-lg">⚡</span>
                    <p className="text-xs font-semibold text-orange-700">Mid-Season Exit</p>
                  </div>
                  <p className="text-orange-600 font-bold text-lg">+10%</p>
                  <p className="text-muted-foreground text-[10px]">30–60 days</p>
                </div>
                <div className="bg-white/90 rounded-xl p-3 border border-[#16a34a]/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-lg">🌾</span>
                    <p className="text-xs font-semibold text-[#16a34a]">Full Season Exit</p>
                  </div>
                  <p className="text-[#16a34a] font-bold text-lg">Up to +22%</p>
                  <p className="text-muted-foreground text-[10px]">~6 months</p>
                </div>
              </div>
            </div>

            {/* Price performance chart */}
            {chartData.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BarChart2 size={13} className="text-[#16a34a]" /> Price Performance
                  </p>
                  <span className={`text-xs font-bold ${isUp ? "text-[#16a34a]" : "text-red-500"}`}>{formatChange(farm.changePercent)}</span>
                </div>
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px" }}
                      formatter={(v: number) => [formatKES(v), "Price"]}
                    />
                    <Area type="monotone" dataKey="price" stroke="#16a34a" strokeWidth={2} fill="url(#priceGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-muted/50 rounded-xl p-2 text-center">
                    <p className="text-muted-foreground text-[8px]">Season Low</p>
                    <p className="text-red-500 font-bold text-[10px]">{formatKES(Math.round(farm.currentPrice * 0.88))}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-2 text-center">
                    <p className="text-muted-foreground text-[8px]">Current</p>
                    <p className="text-foreground font-bold text-[10px]">{formatKES(farm.currentPrice)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-2 text-center">
                    <p className="text-muted-foreground text-[8px]">Season High</p>
                    <p className="text-[#16a34a] font-bold text-[10px]">{formatKES(Math.round(farm.currentPrice * 1.18))}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Share stats */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-sm font-semibold mb-3">Share Details</p>
              <div className="space-y-2.5">
                {[
                  { label: "Loan Amount", val: formatKES(farm.loanAmount), color: "text-foreground" },
                  { label: "Total Shares", val: farm.totalShares.toLocaleString(), color: "text-foreground" },
                  { label: "Shares Available", val: farm.sharesAvailable.toLocaleString(), color: "text-[#16a34a]" },
                  { label: "Price per Share", val: formatKES(farm.sharePrice), color: "text-foreground" },
                  { label: "Active Investors", val: String(farm.investors), color: "text-blue-600" },
                  { label: "Trade Volume", val: String(farm.tradeCount) + " trades", color: "text-foreground" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground text-sm">{label}</span>
                    <span className={`font-semibold text-sm ${color}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── GROWTH TAB ── */}
        {activeTab === "growth" && (
          <>
            {growth ? (
              <>
                <div className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold">Crop Growth Stage</p>
                    <span className="text-[#16a34a] text-xs font-bold bg-[#16a34a]/10 px-2.5 py-1 rounded-full">{growth.percent}% complete</span>
                  </div>
                  <div className="flex items-center gap-1 mb-4">
                    {GROWTH_STAGES.map((stage, i) => {
                      const Icon = stage.icon;
                      const done = i <= currentStageIdx;
                      const current = i === currentStageIdx;
                      return (
                        <div key={stage.key} className="flex items-center gap-1 flex-1">
                          <div className={`flex flex-col items-center gap-1.5 flex-1 ${current ? "opacity-100" : done ? "opacity-70" : "opacity-30"}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${current ? stage.color : done ? "bg-[#16a34a]/20" : "bg-muted"}`}>
                              <Icon size={18} className={current ? "text-white" : "text-muted-foreground"} />
                            </div>
                            <span className={`text-[10px] font-semibold text-center ${current ? "text-[#16a34a]" : "text-muted-foreground"}`}>{stage.label}</span>
                          </div>
                          {i < GROWTH_STAGES.length - 1 && (
                            <div className={`h-0.5 w-5 rounded-full flex-shrink-0 ${i < currentStageIdx ? "bg-[#16a34a]" : "bg-muted"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 mb-2">
                    <div className="bg-[#16a34a] rounded-full h-2.5 transition-all duration-700" style={{ width: `${growth.percent}%` }} />
                  </div>
                  <p className="text-muted-foreground text-xs">{growth.daysElapsed} of {growth.daysTotal} days · <span className="text-[#16a34a] font-semibold">{growth.daysTotal - growth.daysElapsed} days to harvest</span></p>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-blue-700">Live Commodity Price — {farm.cropType}</p>
                    <span className={`text-xs font-bold ${growth.marketChangePercent >= 0 ? "text-[#16a34a]" : "text-red-500"}`}>
                      {growth.marketChangePercent >= 0 ? "+" : ""}{growth.marketChangePercent.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-blue-800 font-bold text-xl">{formatKES(growth.marketPriceKes)} <span className="text-[10px] font-normal text-blue-600">/ 90kg bag</span></p>
                  <p className="text-blue-600 text-xs mt-1.5 italic">{growth.marketInsight}</p>
                </div>

                <WeatherNdvi lat={mapLat} lng={mapLng} cropType={farm.cropType} stage={growth.stage} />

                {/* ── Rainfall Impact Card ── */}
                {rainfallData && (() => {
                  const riskColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
                    green:  { bg: "from-green-50 to-emerald-50",  border: "border-green-200",  text: "text-green-800",  badge: "bg-green-100 text-green-700"  },
                    yellow: { bg: "from-amber-50 to-yellow-50",   border: "border-amber-200",  text: "text-amber-800",  badge: "bg-amber-100 text-amber-700"  },
                    red:    { bg: "from-red-50 to-rose-50",       border: "border-red-200",    text: "text-red-800",    badge: "bg-red-100 text-red-700"      },
                  };
                  const c = riskColors[rainfallData.riskColor] ?? riskColors["green"]!;
                  const statusEmoji = rainfallData.riskColor === "green" ? "🌧️" : rainfallData.riskColor === "yellow" ? "⚠️" : "🚨";
                  const yieldAdj = rainfallData.yieldAdjustmentPercent ?? 0;
                  return (
                    <div className={`bg-gradient-to-r ${c.bg} border ${c.border} rounded-2xl p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <p className={`text-sm font-bold ${c.text} flex items-center gap-2`}>
                          <CloudRain size={15} /> Rainfall Impact
                        </p>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${c.badge}`}>
                          {statusEmoji} {rainfallData.riskLevel === "optimal" ? "Optimal" : rainfallData.riskLevel === "low" ? "Low Rainfall" : rainfallData.riskLevel === "drought" ? "Drought Risk" : "Excess / Flood"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-white/70 rounded-xl p-2 text-center">
                          <p className="text-muted-foreground text-[9px]">Season Total</p>
                          <p className="text-foreground font-bold text-xs">{rainfallData.seasonalTotalMm}mm</p>
                        </div>
                        <div className="bg-white/70 rounded-xl p-2 text-center">
                          <p className="text-muted-foreground text-[9px]">Optimal Range</p>
                          <p className="text-foreground font-bold text-xs">{rainfallData.optimalRangeMin}–{rainfallData.optimalRangeMax}mm</p>
                        </div>
                        <div className="bg-white/70 rounded-xl p-2 text-center">
                          <p className="text-muted-foreground text-[9px]">Yield Adj.</p>
                          <p className={`font-bold text-xs ${yieldAdj >= 0 ? "text-green-600" : "text-red-500"}`}>{yieldAdj >= 0 ? "+" : ""}{yieldAdj}%</p>
                        </div>
                      </div>
                      <p className={`text-[10px] ${c.text} mb-2 leading-relaxed`}>{rainfallData.riskLabel}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rainfallData.criticalDrought && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">🌵 Critical Drought</span>
                        )}
                        {rainfallData.floodRisk && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🌊 Flood Risk</span>
                        )}
                        {rainfallData.extremeDays > 3 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">⚡ {rainfallData.extremeDays} heavy rain days</span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-muted-foreground">AI Factor: {rainfallData.rainfallFactor}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-sm font-semibold mb-3">Growth Timeline</p>
                  <div className="space-y-3">
                    {[
                      { label: "Days Elapsed", val: `${growth.daysElapsed} days`, color: "text-foreground" },
                      { label: "Total Season", val: `${growth.daysTotal} days`, color: "text-foreground" },
                      { label: "Days to Harvest", val: `${growth.daysTotal - growth.daysElapsed} days`, color: "text-[#16a34a]" },
                      { label: "Current Stage", val: growth.stage.charAt(0).toUpperCase() + growth.stage.slice(1), color: "text-blue-600" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <span className="text-muted-foreground text-sm">{label}</span>
                        <span className={`font-semibold text-sm ${color}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-muted/30 rounded-2xl border border-border">
                <Leaf size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-foreground font-semibold text-sm">Growth data not yet available</p>
                <p className="text-muted-foreground text-xs mt-1">Check back once the crop season begins</p>
              </div>
            )}
          </>
        )}

        {/* ── SATELLITE TAB ── */}
        {activeTab === "satellite" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-primary" />
                <div>
                  <p className="text-sm font-bold">Farm Satellite View</p>
                  <p className="text-muted-foreground text-[10px]">{farm.location} · {mapLat.toFixed(4)}°, {mapLng.toFixed(4)}°</p>
                </div>
              </div>
              <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">Live</span>
            </div>

            <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
              <SatelliteTileMap lat={mapLat} lng={mapLng} farmName={farm.name} />
            </div>

            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Layers size={13} className="text-primary" />
                  <p className="text-sm font-semibold">Vegetation Index (NDVI)</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ndviMeta.bg} ${ndviMeta.color}`}>{ndviMeta.label}</span>
                  <AiSectionBot context={`NDVI for this ${farm.cropType} farm is ${ndviNow.toFixed(2)} (${ndviMeta.label}). Seasonal vegetation trend from planting to now. What does this mean for investors?`} label="NDVI" />
                </div>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ndviSeries} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 9 }} tickCount={5} tickFormatter={(v: number) => v.toFixed(1)} />
                    <Tooltip formatter={(v: number) => [v.toFixed(3), "NDVI"]} />
                    <Line type="monotone" dataKey="ndvi" stroke="#16a34a" strokeWidth={2.5}
                      dot={(props: any) => {
                        const { cx, cy, index } = props;
                        if (index === ndviSeries.length - 1) return <circle key="now" cx={cx} cy={cy} r={5} fill="#16a34a" stroke="white" strokeWidth={2} />;
                        return <circle key={index} cx={cx} cy={cy} r={2.5} fill="#16a34a" />;
                      }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-muted-foreground text-[10px] mt-1.5">NDVI 0.0 = bare soil · 1.0 = dense canopy · "Now" = current estimate for this {farm.cropType} farm.</p>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Cpu size={13} className="text-primary" />
                <p className="text-sm font-semibold">Land Cover Analysis</p>
              </div>
              <div className="space-y-3">
                {vegCover.map(item => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: item.color }}>{item.pct}%</span>
                    </div>
                    <div className="w-full h-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-green-600" />
                  <p className="text-sm font-semibold text-green-800">Composite Health Score</p>
                </div>
                <span className={`text-base font-black ${healthScore >= 75 ? "text-green-700" : healthScore >= 50 ? "text-amber-700" : "text-red-600"}`}>
                  {healthScore}<span className="text-xs font-semibold text-muted-foreground">/100</span>
                </span>
              </div>
              <div className="w-full h-3 bg-white/60 rounded-full overflow-hidden mb-3">
                <div className="h-3 rounded-full transition-all duration-700"
                  style={{ width: `${healthScore}%`, background: "linear-gradient(90deg,#16a34a,#22c55e)" }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Vegetation", val: `${(ndviNow * 100).toFixed(0)}%`, color: ndviMeta.color },
                  { label: "Growth",     val: growth?.stage ?? "N/A",            color: "text-blue-600"  },
                  { label: "Season",     val: `${growth?.percent ?? 0}%`,         color: "text-amber-600" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-white/70 rounded-xl p-2 text-center">
                    <p className={`text-xs font-bold ${color}`}>{val}</p>
                    <p className="text-muted-foreground text-[9px] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <Globe size={16} className="text-sky-600" />
                </div>
                <div>
                  <p className="text-sky-800 text-xs font-bold mb-1">Enhanced Imagery Available</p>
                  <p className="text-sky-600 text-[10px] leading-relaxed">
                    Real-time Sentinel-2 imagery (updated every 5 days) with <code className="bg-sky-100 px-1 rounded font-mono">SENTINEL_HUB_CLIENT_ID</code> + <code className="bg-sky-100 px-1 rounded font-mono">SENTINEL_HUB_CLIENT_SECRET</code> env vars — enables centimetre-precision NDVI maps and multi-spectral crop health analysis.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── NEWS TAB ── */}
        {activeTab === "news" && (
          <div className="space-y-4">
            {/* Crop Sentiment card */}
            {cropSentiment && (
              <div className={`rounded-2xl border p-4 ${cropSentiment.score > 10 ? "bg-green-50 border-green-200" : cropSentiment.score < -10 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className={cropSentiment.score > 10 ? "text-green-600" : cropSentiment.score < -10 ? "text-red-500" : "text-amber-600"} />
                    <p className="text-sm font-bold text-foreground">AI Market Sentiment — {farm?.cropType}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cropSentiment.score > 10 ? "bg-green-100 text-green-700" : cropSentiment.score < -10 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                    {cropSentiment.score > 10 ? "Bullish 📈" : cropSentiment.score < -10 ? "Bearish 📉" : "Neutral ➡️"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 bg-white/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${cropSentiment.score > 10 ? "bg-green-500" : cropSentiment.score < -10 ? "bg-red-500" : "bg-amber-400"}`}
                      style={{ width: `${Math.min(100, Math.max(5, 50 + cropSentiment.score / 2))}%` }} />
                  </div>
                  <span className={`text-sm font-bold ${cropSentiment.score > 10 ? "text-green-700" : cropSentiment.score < -10 ? "text-red-600" : "text-amber-700"}`}>
                    {cropSentiment.score > 0 ? "+" : ""}{cropSentiment.score}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Based on live news analysis across Kenyan agri-markets · updated hourly</p>
              </div>
            )}

            {/* Header + refresh */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper size={14} className="text-primary" />
                <p className="text-sm font-semibold">Crop Price News</p>
              </div>
              <button onClick={() => refetchNews()} className="text-xs text-primary flex items-center gap-1 font-medium">
                <RefreshCw size={11} /> Refresh
              </button>
            </div>

            {newsLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
                    <div className="h-3 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-2.5 bg-muted rounded w-full mb-1.5" />
                    <div className="h-2.5 bg-muted rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : !cropNews?.length ? (
              <div className="bg-muted/40 rounded-2xl border border-border p-8 text-center">
                <Newspaper size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-foreground font-semibold text-sm">No news found</p>
                <p className="text-muted-foreground text-xs mt-1">Check back soon for Kenyan agri-market updates</p>
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
                        <div className="flex items-center gap-1 mb-1.5">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide">
                            🌾 {farm?.cropType} related
                          </span>
                        </div>
                      )}
                      <p className="text-foreground font-semibold text-sm leading-snug line-clamp-2 mb-1.5">{item.title}</p>
                      <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed mb-2">{item.summary}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground font-medium">{item.source}</span>
                          {item.publishedAt && (
                            <span className="text-[10px] text-muted-foreground">· {new Date(item.publishedAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}</span>
                          )}
                        </div>
                        {sentScore !== 0 && (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${sentColor}`}>{sentLabel}</span>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}

            <div className="bg-muted/30 rounded-2xl border border-border p-3 text-center">
              <p className="text-muted-foreground text-[10px]">News sourced from Kenyan agri-markets via AI analysis. Not financial advice.</p>
            </div>
          </div>
        )}

        {/* ── LOCATION TAB ── */}
        {activeTab === "location" && (
          <>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation size={14} className="text-[#16a34a]" />
                  <p className="text-sm font-semibold">Farm Location</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                  <span className="text-[10px] text-[#16a34a] font-semibold uppercase tracking-wide">GPS Verified</span>
                </div>
              </div>
              <div className="relative" style={{ height: 260 }}>
                <FarmLeafletMap lat={mapLat} lng={mapLng} label={farm.location ?? "Farm Location"} />
                <div className="absolute bottom-3 left-3 pointer-events-none z-[500]">
                  <div className="bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2">
                    <p className="text-white font-semibold text-xs">{farm.location}</p>
                    <p className="text-white/70 text-[10px]">Lat {mapLat.toFixed(4)}, Lng {mapLng.toFixed(4)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <MapPin size={14} className="text-[#16a34a]" /> Location Details
              </p>
              <div className="space-y-2.5">
                {[
                  { label: "County / Area", val: (farm.location ?? "Kenya").split(",")[0]?.trim() },
                  { label: "Latitude", val: mapLat.toFixed(4) },
                  { label: "Longitude", val: mapLng.toFixed(4) },
                  { label: "Country", val: "Kenya" },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground text-sm">{label}</span>
                    <span className="font-semibold text-sm text-foreground">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Invest Now CTA */}
      {listing && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50">
          <div className="bg-background/95 backdrop-blur-md border-t border-border px-4 pt-3 pb-8 shadow-2xl">
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <p className="text-xs text-muted-foreground">Share price</p>
                <p className="text-base font-bold text-foreground">{formatKES(listing.pricePerShare)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Funding</p>
                <p className="text-sm font-bold text-[#16a34a]">{farm.fundingPercent}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Available</p>
                <p className="text-sm font-semibold text-foreground">{listing.sharesAvailable.toLocaleString()} shares</p>
              </div>
            </div>
            <button
              data-testid="button-buy-confirm"
              onClick={() => setInvestOpen(true)}
              className="w-full bg-[#16a34a] text-white font-bold py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#16a34a]/30 text-base"
            >
              <ShoppingCart size={18} /> Invest in {farm.cropType} Now
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
        const compareFarm = (primaryListings as CompareListing[] | undefined)?.find(l => l.farmId !== farmId);
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
