import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, X, Minus, ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react";
import { useListPrimaryMarket } from "@workspace/api-client-react";
import { formatKES } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type Listing = {
  id: number; farmId: number; farmName: string; cropType: string;
  location: string; pricePerShare: number; sharesAvailable: number;
  changePercent: number; imageUrl?: string;
};

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
  coffee:    "#92400e",
  maize:     "#d97706",
  tea:       "#15803d",
  avocado:   "#16a34a",
  macadamia: "#7c3aed",
  tomatoes:  "#dc2626",
  rice:      "#0891b2",
  sunflower: "#ea580c",
  beans:     "#059669",
  wheat:     "#ca8a04",
  dairy:     "#2563eb",
  poultry:   "#db2777",
};

const CROP_EMOJI: Record<string, string> = {
  coffee: "☕", maize: "🌽", tea: "🍵", avocado: "🥑",
  macadamia: "🌰", tomatoes: "🍅", rice: "🌾", sunflower: "🌻",
  beans: "🫘", wheat: "🌾", dairy: "🐄", poultry: "🐔",
};

function getCropColor(crop: string): string {
  const k = crop.toLowerCase();
  for (const [key, val] of Object.entries(CROP_COLORS)) {
    if (k.includes(key)) return val;
  }
  return "#6b7280";
}

function getCropEmoji(crop: string): string {
  const k = crop.toLowerCase();
  for (const [key, val] of Object.entries(CROP_EMOJI)) {
    if (k.includes(key)) return val;
  }
  return "🌱";
}

function resolveCoords(location: string): [number, number] {
  const l = location.toLowerCase();
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (l.includes(key)) return coords;
  }
  return [-1.2921, 36.8219];
}

/**
 * Generate a deterministic irregular polygon around a centre point
 * to simulate a farm boundary. Uses a seeded approach based on farmId
 * so the shape is stable across renders.
 */
function makeFarmBoundary(
  center: [number, number],
  farmId: number,
  active: boolean
): L.Polygon {
  const [lat, lng] = center;
  // Spread ~0.02–0.06 degrees (roughly 2–6 km)
  const spread = 0.025 + (farmId % 5) * 0.008;
  const sides = 6 + (farmId % 4); // 6-9 sided polygon
  const points: [number, number][] = [];

  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * 2 * Math.PI;
    // Vary radius slightly per vertex for organic feel
    const variance = 0.65 + ((farmId * (i + 3)) % 7) / 10;
    const r = spread * variance;
    // Lat/lng ratio compensation (Kenya ~1.1)
    points.push([lat + r * Math.cos(angle), lng + r * Math.sin(angle) * 1.1]);
  }

  const color = active ? "#16a34a" : getCropColor(""); // will be overridden per crop
  return L.polygon(points as L.LatLngExpression[], {
    color: active ? "#16a34a" : undefined,
    fillColor: active ? "#16a34a" : undefined,
    weight: active ? 2.5 : 1.8,
    fillOpacity: active ? 0.22 : 0.13,
    opacity: active ? 1 : 0.75,
  });
}

function makeLabelIcon(crop: string, active: boolean): L.DivIcon {
  const emoji = getCropEmoji(crop);
  const color = getCropColor(crop);
  const s = active ? 40 : 32;
  return L.divIcon({
    html: `<div style="
      width:${s}px;height:${s}px;border-radius:50%;
      background:${active ? color : "white"};
      border:2.5px solid ${color};
      display:flex;align-items:center;justify-content:center;
      font-size:${active ? 18 : 14}px;
      box-shadow:0 2px 8px rgba(0,0,0,0.22);
      transition:all 0.2s;
    ">${emoji}</div>`,
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

export default function FarmMap() {
  const [, setLocation] = useLocation();
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapInst    = useRef<L.Map | null>(null);
  const layersRef  = useRef<Map<number, { polygon: L.Polygon; marker: L.Marker }>>(new Map());

  const [selected, setSelected] = useState<Listing | null>(null);
  const [filter, setFilter]     = useState<string>("All");

  const { data: listings = [], isLoading } = useListPrimaryMarket();

  const cropTypes = ["All", ...Array.from(new Set((listings as Listing[]).map(l => l.cropType)))];

  const visible = filter === "All"
    ? (listings as Listing[])
    : (listings as Listing[]).filter(l => l.cropType === filter);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, {
      center: [-0.5, 37.0],
      zoom: 6.3,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 12,
      minZoom: 5,
    }).addTo(map);

    L.control.attribution({ position: "bottomright", prefix: false })
      .addAttribution("© OpenStreetMap")
      .addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    mapInst.current = map;
    return () => { map.remove(); mapInst.current = null; };
  }, []);

  // Sync farm boundaries + emoji markers when listings or filter or selection changes
  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;

    // Remove old layers
    layersRef.current.forEach(({ polygon, marker }) => {
      polygon.remove();
      marker.remove();
    });
    layersRef.current.clear();

    visible.forEach(farm => {
      const coords = resolveCoords(farm.location);
      const color  = getCropColor(farm.cropType);
      const isActive = selected?.farmId === farm.farmId;

      const polygon = makeFarmBoundary(coords, farm.farmId, isActive);
      polygon.setStyle({
        color: isActive ? "#16a34a" : color,
        fillColor: isActive ? "#16a34a" : color,
        weight: isActive ? 2.5 : 1.8,
        fillOpacity: isActive ? 0.22 : 0.13,
        opacity: isActive ? 1 : 0.75,
      });
      polygon.addTo(map);
      polygon.on("click", () => setSelected(prev => prev?.farmId === farm.farmId ? null : farm));

      const marker = L.marker(coords, { icon: makeLabelIcon(farm.cropType, isActive) })
        .addTo(map)
        .on("click", () => setSelected(prev => prev?.farmId === farm.farmId ? null : farm));

      layersRef.current.set(farm.farmId, { polygon, marker });
    });
  }, [visible, selected?.farmId]);

  // Update active layers when selection changes (style only)
  useEffect(() => {
    layersRef.current.forEach(({ polygon, marker }, farmId) => {
      const farm = (listings as Listing[]).find(l => l.farmId === farmId);
      if (!farm) return;
      const isActive = selected?.farmId === farmId;
      const color = getCropColor(farm.cropType);
      polygon.setStyle({
        color: isActive ? "#16a34a" : color,
        fillColor: isActive ? "#16a34a" : color,
        weight: isActive ? 2.5 : 1.8,
        fillOpacity: isActive ? 0.22 : 0.13,
        opacity: isActive ? 1 : 0.75,
      });
      marker.setIcon(makeLabelIcon(farm.cropType, isActive));
    });
  }, [selected?.farmId, listings]);

  const risk = selected ? riskLevel(selected.cropType, selected.changePercent) : null;

  return (
    <div className="relative w-full max-w-[430px] mx-auto h-dvh overflow-hidden bg-background">

      {/* Map container */}
      <div ref={mapRef} className="absolute inset-0" style={{ zIndex: 0 }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-12 pb-3 pointer-events-none"
           style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.95) 70%, transparent)" }}>
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={() => setLocation("/market")}
            className="w-9 h-9 rounded-full bg-white shadow border border-border flex items-center justify-center"
          >
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-foreground">Farm Map</h1>
            <p className="text-[10px] text-muted-foreground">
              {isLoading ? "Loading…" : `${visible.length} farm${visible.length !== 1 ? "s" : ""} in Kenya`}
            </p>
          </div>
        </div>

        {/* Crop filter chips */}
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1 scrollbar-hide pointer-events-auto">
          {cropTypes.map(crop => {
            const active = filter === crop;
            const color  = crop === "All" ? "#15803d" : getCropColor(crop);
            const emoji  = crop === "All" ? "🌍" : getCropEmoji(crop);
            return (
              <button
                key={crop}
                onClick={() => setFilter(crop)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={active
                  ? { background: color, borderColor: color, color: "white" }
                  : { background: "white", borderColor: "#e5e7eb", color: "#374151" }
                }
              >
                <span>{emoji}</span>
                {crop}
              </button>
            );
          })}
        </div>
      </div>

      {/* Farm count badge */}
      {!isLoading && (
        <div className="absolute top-4 right-4 z-10 bg-white rounded-full px-3 py-1.5 shadow border border-border">
          <span className="text-xs font-bold text-foreground">{visible.length} farms</span>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-foreground">Loading farm data…</p>
          </div>
        </div>
      )}

      {/* Bottom sheet — selected farm */}
      {selected && (
        <div
          className="absolute bottom-20 left-4 right-4 z-20 bg-white rounded-3xl shadow-2xl border border-border overflow-hidden"
          style={{ animation: "slideUp 0.25s ease-out" }}
        >
          <div className="p-4">
            {/* Header row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0 mr-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-lg">{getCropEmoji(selected.cropType)}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: getCropColor(selected.cropType) }}
                  >
                    {selected.cropType}
                  </span>
                  {risk === "High" && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                      <AlertTriangle size={7} /> High Risk
                    </span>
                  )}
                  {risk === "Moderate" && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      <Minus size={7} /> Moderate
                    </span>
                  )}
                  {risk === "Low" && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                      <ShieldCheck size={7} /> Low Risk
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-foreground truncate">{selected.farmName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">📍 {selected.location}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-muted rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">Price</p>
                <p className="text-sm font-bold text-foreground">{formatKES(selected.pricePerShare)}</p>
              </div>
              <div className="bg-muted rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">Change</p>
                <p className={`text-sm font-bold flex items-center justify-center gap-0.5 ${selected.changePercent >= 0 ? "text-primary" : "text-red-500"}`}>
                  {selected.changePercent >= 0
                    ? <TrendingUp size={12} />
                    : <TrendingDown size={12} />
                  }
                  {selected.changePercent >= 0 ? "+" : ""}{selected.changePercent.toFixed(1)}%
                </p>
              </div>
              <div className="bg-muted rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">Shares</p>
                <p className="text-sm font-bold text-foreground">{selected.sharesAvailable.toLocaleString()}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setLocation(`/market/${selected.farmId}`)}
                className="flex-1 flex items-center justify-center gap-1.5 border border-border rounded-xl py-2.5 text-sm font-semibold text-foreground"
              >
                <ExternalLink size={14} />
                Details
              </button>
              <button
                onClick={() => setLocation(`/market/${selected.farmId}`)}
                className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-transform"
              >
                Invest Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {visible.length > 0 && !selected && (
        <div className="absolute bottom-24 right-4 z-10 bg-white rounded-2xl shadow border border-border p-3 max-w-[140px]">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Crop Types</p>
          {Array.from(new Set(visible.map(l => l.cropType))).slice(0, 6).map(crop => (
            <div key={crop} className="flex items-center gap-1.5 mb-1.5 last:mb-0">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 opacity-60" style={{ background: getCropColor(crop) }} />
              <span className="text-[10px] text-foreground font-medium truncate">{getCropEmoji(crop)} {crop}</span>
            </div>
          ))}
          <p className="text-[8px] text-muted-foreground mt-2 italic">Boundaries are approximate</p>
        </div>
      )}

      {/* Bottom nav */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <BottomNav role="investor" />
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .leaflet-container { background: #e8f4e8; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
