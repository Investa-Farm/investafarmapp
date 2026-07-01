import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, X, Minus, ShieldCheck, AlertTriangle, ExternalLink, Satellite, Map, Leaf, Radio, BarChart2, SlidersHorizontal, Briefcase } from "lucide-react";
import { formatKES, getToken, getStoredUser } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import { useQuery } from "@tanstack/react-query";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type MapFarm = {
  id: number; name: string; cropType: string; location: string;
  latitude: number | null; longitude: number | null;
  riskScore: number; ndviScore: number; ndviClass: "healthy" | "moderate" | "stressed";
  imageUrl?: string; status: string; currentPrice: number; changePercent: number;
  sharePrice: number; sharesAvailable: number; totalShares: number; investorIds: number[];
};

type SentimentRow = { cropType: string; positivePercent: number; negativePercent: number; neutralPercent: number };

const LOCATION_COORDS: Record<string, [number, number]> = {
  kiambu:    [-1.1741, 36.8350],
  nakuru:    [-0.3031, 36.0800],
  kirinyaga: [-0.5597, 37.3487],
  laikipia:  [ 0.3606, 36.7819],
  meru:      [ 0.0466, 37.6494],
  thika:     [-1.0332, 37.0693],
  ahero:     [-0.1667, 34.9167],
  kisumu:    [-0.0917, 34.7680],
  narok:     [-1.0826, 35.8718],
  nairobi:   [-1.2921, 36.8219],
  eldoret:   [ 0.5204, 35.2699],
  nyeri:     [-0.4167, 36.9500],
  kitale:    [ 1.0154, 35.0062],
  machakos:  [-1.5177, 37.2634],
  embu:      [-0.5333, 37.4500],
  rift:      [-0.5000, 35.9000],
  "mt. kenya": [-0.1522, 37.3087],
};

const CROP_COLORS: Record<string, string> = {
  coffee: "#92400e", maize: "#d97706", tea: "#15803d", avocado: "#16a34a",
  macadamia: "#7c3aed", tomatoes: "#dc2626", rice: "#0891b2", sunflower: "#ea580c",
  beans: "#059669", wheat: "#ca8a04", dairy: "#2563eb", poultry: "#db2777",
};

const CROP_EMOJI: Record<string, string> = {
  coffee: "☕", maize: "🌽", tea: "🍵", avocado: "🥑",
  macadamia: "🌰", tomatoes: "🍅", rice: "🌾", sunflower: "🌻",
  beans: "🫘", wheat: "🌾", dairy: "🐄", poultry: "🐔",
};

function getCropColor(crop: string): string {
  const k = crop.toLowerCase();
  for (const [key, val] of Object.entries(CROP_COLORS)) if (k.includes(key)) return val;
  return "#6b7280";
}
function getCropEmoji(crop: string): string {
  const k = crop.toLowerCase();
  for (const [key, val] of Object.entries(CROP_EMOJI)) if (k.includes(key)) return val;
  return "🌱";
}
function resolveCoords(location: string): [number, number] {
  const l = location.toLowerCase();
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) if (l.includes(key)) return coords;
  return [-1.2921, 36.8219];
}

function ndviToColor(ndvi: number): string {
  if (ndvi >= 0.7) return "#16a34a";
  if (ndvi >= 0.5) return "#65a30d";
  if (ndvi >= 0.4) return "#ca8a04";
  if (ndvi >= 0.25) return "#ea580c";
  return "#dc2626";
}

function makeFarmBoundary(center: [number, number], farmId: number, ndvi: number, isActive: boolean, showNdvi: boolean): L.Polygon {
  const [lat, lng] = center;
  const spread = 0.025 + (farmId % 5) * 0.008;
  const sides = 6 + (farmId % 4);
  const points: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * 2 * Math.PI;
    const variance = 0.65 + ((farmId * (i + 3)) % 7) / 10;
    const r = spread * variance;
    points.push([lat + r * Math.cos(angle), lng + r * Math.sin(angle) * 1.1]);
  }
  const fillColor = showNdvi ? ndviToColor(ndvi) : (isActive ? "#16a34a" : "#6b7280");
  return L.polygon(points as L.LatLngExpression[], {
    color: isActive ? "#fff" : fillColor,
    fillColor,
    weight: isActive ? 2.5 : 1.5,
    fillOpacity: showNdvi ? 0.55 : (isActive ? 0.25 : 0.18),
    opacity: isActive ? 1 : 0.8,
  });
}

function makeLabelIcon(crop: string, active: boolean, isPortfolioFarm: boolean, ndvi: number, showNdvi: boolean): L.DivIcon {
  const emoji = getCropEmoji(crop);
  const color = showNdvi ? ndviToColor(ndvi) : (isPortfolioFarm ? "#7c3aed" : getCropColor(crop));
  const s = active ? 42 : 32;
  const ring = isPortfolioFarm ? `box-shadow:0 0 0 3px #7c3aed,0 2px 8px rgba(0,0,0,0.25);` : `box-shadow:0 2px 8px rgba(0,0,0,0.22);`;
  return L.divIcon({
    html: `<div style="
      width:${s}px;height:${s}px;border-radius:50%;
      background:${active ? color : "white"};
      border:2.5px solid ${color};
      display:flex;align-items:center;justify-content:center;
      font-size:${active ? 18 : 14}px;
      ${ring}
      transition:all 0.2s;
    ">${active ? emoji : emoji}</div>`,
    className: "",
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

const HIGH_RISK = new Set(["coffee", "avocado", "tobacco"]);
const MOD_RISK  = new Set(["tea", "wheat", "tomatoes", "potatoes"]);
function riskLevel(crop: string, chg: number) {
  const c = crop.toLowerCase();
  if (HIGH_RISK.has(c) || Math.abs(chg) > 5) return "High";
  if (MOD_RISK.has(c)  || Math.abs(chg) > 2) return "Moderate";
  return "Low";
}

type LayerMode = "crop" | "ndvi" | "sentiment";

export default function FarmMap() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const user  = getStoredUser() as any;

  const mapRef    = useRef<HTMLDivElement>(null);
  const mapInst   = useRef<L.Map | null>(null);
  const layersRef = useRef<Map<number, { polygon: L.Polygon; marker: L.Marker }>>(new Map());
  const sentimentLayersRef = useRef<L.CircleMarker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [selected, setSelected]     = useState<MapFarm | null>(null);
  const [filter, setFilter]         = useState<string>("All");
  const [layerMode, setLayerMode]   = useState<LayerMode>("crop");
  const [satellite, setSatellite]   = useState(false);
  const [portfolioOnly, setPortfolioOnly] = useState(false);
  const [showControls, setShowControls]  = useState(false);

  const { data: farms = [], isLoading } = useQuery<MapFarm[]>({
    queryKey: ["market-map-data"],
    queryFn: async () => {
      const r = await fetch("/api/market/map-data", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 120_000,
  });

  const { data: sentimentRows = [] } = useQuery<SentimentRow[]>({
    queryKey: ["map-sentiment"],
    enabled: layerMode === "sentiment",
    queryFn: async () => {
      const r = await fetch("/api/news/sentiment", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      const d = await r.json();
      return d.scores ?? d ?? [];
    },
    staleTime: 300_000,
  });

  const cropTypes = ["All", ...Array.from(new Set((farms as MapFarm[]).map(f => f.cropType)))];

  const visibleFarms = (() => {
    let f = filter === "All" ? farms : farms.filter(fa => fa.cropType === filter);
    if (portfolioOnly) f = f.filter(fa => fa.investorIds.includes(user?.id));
    return f;
  })();

  const STREET_URL  = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const SAT_URL     = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, {
      center: [-0.5, 37.0], zoom: 6.3, zoomControl: false, attributionControl: false,
    });
    const tile = L.tileLayer(STREET_URL, { maxZoom: 18, minZoom: 5 });
    tile.addTo(map);
    tileLayerRef.current = tile;
    L.control.attribution({ position: "bottomright", prefix: false }).addAttribution("© OpenStreetMap / Esri").addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    mapInst.current = map;
    return () => { map.remove(); mapInst.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInst.current;
    if (!map || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(satellite ? SAT_URL : STREET_URL);
  }, [satellite]);

  const drawSentimentOverlay = useCallback(() => {
    const map = mapInst.current;
    if (!map) return;
    sentimentLayersRef.current.forEach(l => l.remove());
    sentimentLayersRef.current = [];
    if (layerMode !== "sentiment") return;
    const sentimentByCrop: Record<string, number> = {};
    for (const s of sentimentRows) {
      sentimentByCrop[s.cropType.toLowerCase()] = s.positivePercent - s.negativePercent;
    }
    for (const farm of visibleFarms) {
      const coords: [number, number] = farm.latitude && farm.longitude
        ? [farm.latitude, farm.longitude]
        : resolveCoords(farm.location);
      const score = sentimentByCrop[farm.cropType.toLowerCase()] ?? 0;
      const color = score > 20 ? "#16a34a" : score > 0 ? "#65a30d" : score > -20 ? "#ca8a04" : "#dc2626";
      const circle = L.circleMarker(coords, {
        radius: 28, fillColor: color, color: "white", weight: 1.5,
        fillOpacity: 0.45, opacity: 0.7,
      }).addTo(map);
      circle.bindTooltip(`${farm.cropType}: ${score > 0 ? "+" : ""}${score.toFixed(0)}% sentiment`);
      sentimentLayersRef.current.push(circle);
    }
  }, [layerMode, sentimentRows, visibleFarms]);

  useEffect(() => {
    drawSentimentOverlay();
  }, [drawSentimentOverlay]);

  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;
    layersRef.current.forEach(({ polygon, marker }) => { polygon.remove(); marker.remove(); });
    layersRef.current.clear();
    const showNdvi = layerMode === "ndvi";

    visibleFarms.forEach(farm => {
      const coords: [number, number] = farm.latitude && farm.longitude
        ? [farm.latitude, farm.longitude]
        : resolveCoords(farm.location);
      const isActive = selected?.id === farm.id;
      const isMyFarm = farm.investorIds.includes(user?.id);

      const polygon = makeFarmBoundary(coords, farm.id, farm.ndviScore, isActive, showNdvi);
      polygon.addTo(map);
      polygon.on("click", () => setSelected(prev => prev?.id === farm.id ? null : farm));

      const marker = L.marker(coords, {
        icon: makeLabelIcon(farm.cropType, isActive, isMyFarm, farm.ndviScore, showNdvi),
      }).addTo(map).on("click", () => setSelected(prev => prev?.id === farm.id ? null : farm));

      layersRef.current.set(farm.id, { polygon, marker });
    });
  }, [visibleFarms, selected?.id, layerMode]);

  useEffect(() => {
    layersRef.current.forEach(({ polygon, marker }, farmId) => {
      const farm = farms.find(f => f.id === farmId);
      if (!farm) return;
      const isActive = selected?.id === farmId;
      const isMyFarm = farm.investorIds.includes(user?.id);
      const showNdvi = layerMode === "ndvi";
      const fillColor = showNdvi ? ndviToColor(farm.ndviScore) : (isMyFarm ? "#7c3aed" : getCropColor(farm.cropType));
      polygon.setStyle({
        color: isActive ? "#fff" : fillColor, fillColor,
        weight: isActive ? 2.5 : 1.5,
        fillOpacity: showNdvi ? 0.55 : (isActive ? 0.25 : 0.18),
      });
      marker.setIcon(makeLabelIcon(farm.cropType, isActive, isMyFarm, farm.ndviScore, showNdvi));
    });
  }, [selected?.id, farms, layerMode]);

  const risk = selected ? riskLevel(selected.cropType, selected.changePercent) : null;

  return (
    <div className="relative w-full max-w-[430px] mx-auto h-dvh overflow-hidden bg-background">
      <div ref={mapRef} className="absolute inset-0" style={{ zIndex: 0 }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-12 pb-3 pointer-events-none"
           style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.97) 75%, transparent)" }}>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button onClick={() => setLocation("/market")}
            className="w-9 h-9 rounded-full bg-white shadow border border-border flex items-center justify-center flex-shrink-0">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground">Farm Tour</h1>
            <p className="text-[10px] text-muted-foreground">
              {isLoading ? "Loading…" : `${visibleFarms.length} active farms in Kenya`}
            </p>
          </div>
          <button onClick={() => setShowControls(v => !v)}
            className="w-9 h-9 rounded-full bg-white shadow border border-border flex items-center justify-center">
            <SlidersHorizontal size={16} className={showControls ? "text-primary" : "text-foreground"} />
          </button>
        </div>

        {/* Controls panel */}
        {showControls && (
          <div className="mt-2.5 bg-white rounded-2xl border border-border shadow-lg p-3 space-y-3 pointer-events-auto">
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Map Layer</p>
              <div className="flex gap-1.5">
                {([
                  { key: "crop",      icon: <Map size={12} />,    label: "Crop" },
                  { key: "ndvi",      icon: <Leaf size={12} />,   label: "NDVI" },
                  { key: "sentiment", icon: <Radio size={12} />,  label: "Sentiment" },
                ] as { key: LayerMode; icon: React.ReactNode; label: string }[]).map(({ key, icon, label }) => (
                  <button key={key} onClick={() => setLayerMode(key)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-semibold border transition-all ${layerMode === key ? "bg-primary text-white border-primary" : "bg-muted text-foreground border-transparent"}`}>
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSatellite(v => !v)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-semibold border transition-all ${satellite ? "bg-sky-600 text-white border-sky-600" : "bg-muted text-foreground border-transparent"}`}>
                <Satellite size={12} />
                {satellite ? "Satellite ON" : "Satellite"}
              </button>
              <button onClick={() => setPortfolioOnly(v => !v)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-semibold border transition-all ${portfolioOnly ? "bg-violet-600 text-white border-violet-600" : "bg-muted text-foreground border-transparent"}`}>
                <Briefcase size={12} />
                {portfolioOnly ? "My Farms" : "My Farms"}
              </button>
            </div>
          </div>
        )}

        {/* Crop filter chips */}
        <div className="flex gap-2 overflow-x-auto mt-2.5 pb-1 scrollbar-hide pointer-events-auto">
          {cropTypes.map(crop => {
            const active = filter === crop;
            const color = crop === "All" ? "#15803d" : getCropColor(crop);
            const emoji = crop === "All" ? "🌍" : getCropEmoji(crop);
            return (
              <button key={crop} onClick={() => setFilter(crop)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={active ? { background: color, borderColor: color, color: "white" }
                  : { background: "white", borderColor: "#e5e7eb", color: "#374151" }}>
                <span>{emoji}</span>{crop}
              </button>
            );
          })}
        </div>
      </div>

      {/* Layer indicator badge */}
      <div className="absolute top-4 right-14 z-10">
        {layerMode === "ndvi" && (
          <div className="bg-white rounded-full px-3 py-1.5 shadow border border-border flex items-center gap-1.5">
            <Leaf size={12} className="text-green-600" />
            <span className="text-[10px] font-bold text-green-700">NDVI Health</span>
          </div>
        )}
        {layerMode === "sentiment" && (
          <div className="bg-white rounded-full px-3 py-1.5 shadow border border-border flex items-center gap-1.5">
            <Radio size={12} className="text-purple-600" />
            <span className="text-[10px] font-bold text-purple-700">Sentiment Radar</span>
          </div>
        )}
      </div>

      {/* Farm count */}
      {!isLoading && (
        <div className="absolute top-4 right-4 z-10 bg-white rounded-full px-3 py-1.5 shadow border border-border">
          <span className="text-xs font-bold text-foreground">{visibleFarms.length} farms</span>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Loading farm data…</p>
          </div>
        </div>
      )}

      {/* NDVI legend */}
      {layerMode === "ndvi" && !selected && (
        <div className="absolute bottom-24 right-4 z-10 bg-white rounded-2xl shadow border border-border p-3 w-[130px]">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2">NDVI Health</p>
          {[
            { color: "#16a34a", label: "Healthy (>0.7)" },
            { color: "#65a30d", label: "Good (0.5–0.7)" },
            { color: "#ca8a04", label: "Fair (0.4–0.5)" },
            { color: "#ea580c", label: "Stressed (0.25+)" },
            { color: "#dc2626", label: "Critical (<0.25)" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 mb-1 last:mb-0">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
              <span className="text-[9px] text-foreground">{label}</span>
            </div>
          ))}
          <p className="text-[8px] text-muted-foreground mt-1.5 italic">Derived from risk score</p>
        </div>
      )}

      {/* Crop legend */}
      {layerMode === "crop" && visibleFarms.length > 0 && !selected && (
        <div className="absolute bottom-24 right-4 z-10 bg-white rounded-2xl shadow border border-border p-3 max-w-[140px]">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Crop Types</p>
          {Array.from(new Set(visibleFarms.map(f => f.cropType))).slice(0, 5).map(crop => (
            <div key={crop} className="flex items-center gap-1.5 mb-1.5 last:mb-0">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 opacity-70" style={{ background: getCropColor(crop) }} />
              <span className="text-[10px] text-foreground font-medium">{getCropEmoji(crop)} {crop}</span>
            </div>
          ))}
          {portfolioOnly && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-violet-600" />
              <span className="text-[9px] text-violet-700 font-semibold">My Farms</span>
            </div>
          )}
          <p className="text-[8px] text-muted-foreground mt-2 italic">Boundaries approximate</p>
        </div>
      )}

      {/* Selected farm bottom sheet */}
      {selected && (
        <div className="absolute bottom-20 left-4 right-4 z-20 bg-white rounded-3xl shadow-2xl border border-border overflow-hidden"
             style={{ animation: "slideUp 0.25s ease-out" }}>

          {/* Farm image */}
          {selected.imageUrl && (
            <div className="w-full h-28 overflow-hidden relative">
              <img src={selected.imageUrl} alt={selected.name}
                className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
              <div className="absolute bottom-2 left-3 flex gap-1">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full text-white ${
                  selected.ndviClass === "healthy" ? "bg-green-600" :
                  selected.ndviClass === "moderate" ? "bg-amber-500" : "bg-red-500"}`}>
                  NDVI {selected.ndviScore.toFixed(2)} — {selected.ndviClass === "healthy" ? "Healthy" : selected.ndviClass === "moderate" ? "Fair" : "Stressed"}
                </span>
              </div>
              <button onClick={() => setSelected(null)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center">
                <X size={12} className="text-white" />
              </button>
            </div>
          )}

          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0 mr-2">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span className="text-lg">{getCropEmoji(selected.cropType)}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: getCropColor(selected.cropType) }}>
                    {selected.cropType}
                  </span>
                  {risk === "High" && <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600"><AlertTriangle size={7} /> High Risk</span>}
                  {risk === "Moderate" && <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"><Minus size={7} /> Moderate</span>}
                  {risk === "Low" && <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700"><ShieldCheck size={7} /> Low Risk</span>}
                  {selected.investorIds.includes(user?.id) && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">✓ Invested</span>
                  )}
                </div>
                <h2 className="text-base font-bold text-foreground truncate">{selected.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">📍 {selected.location}</p>
              </div>
              {!selected.imageUrl && (
                <button onClick={() => setSelected(null)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <X size={14} className="text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-muted rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">Price</p>
                <p className="text-sm font-bold text-foreground">{formatKES(selected.sharePrice)}</p>
              </div>
              <div className="bg-muted rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">Change</p>
                <p className={`text-sm font-bold flex items-center justify-center gap-0.5 ${selected.changePercent >= 0 ? "text-primary" : "text-red-500"}`}>
                  {selected.changePercent >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {selected.changePercent >= 0 ? "+" : ""}{selected.changePercent.toFixed(1)}%
                </p>
              </div>
              <div className="bg-muted rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">Shares</p>
                <p className="text-sm font-bold text-foreground">{selected.sharesAvailable.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setLocation(`/market/${selected.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 border border-border rounded-xl py-2.5 text-sm font-semibold text-foreground">
                <ExternalLink size={14} />Details
              </button>
              <button onClick={() => setLocation(`/market/${selected.id}`)}
                className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-transform">
                Invest Now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-30">
        <BottomNav role="investor" />
      </div>

      <style>{`
        @keyframes slideUp { from { transform:translateY(20px);opacity:0; } to { transform:translateY(0);opacity:1; } }
        .leaflet-container { background: #e8f4e8; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
