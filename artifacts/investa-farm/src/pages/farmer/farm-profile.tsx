import { useState } from "react";
import { useGetMyFarms, useGetFarmerDashboard } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getToken, getStoredUser, isDemoAccount } from "@/lib/auth";
import {
  Settings, Bell, Droplets, CloudRain, BarChart3, MapPin, Leaf, Sun, Wheat,
  TrendingUp, CalendarDays, ChevronRight, Maximize2, CheckCircle2, Clock,
  XCircle, Share2, Users, DollarSign, Activity, ShieldCheck, X, Camera, Plus, Loader2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { getCropImage } from "@/lib/crops";

type GroupInfo = { id: number; name: string; registrationNumber: string; county: string; memberCount: number; status: string } | null;

const CROP_STAGES = [
  { key: "planting",   label: "Planting",   icon: Leaf,       date: "12 Mar" },
  { key: "vegetative", label: "Vegetative",  icon: Droplets,   date: "28 Mar" },
  { key: "flowering",  label: "Flowering",   icon: Sun,        date: "10 May" },
  { key: "fruiting",   label: "Fruiting",    icon: Wheat,      date: "25 May" },
  { key: "harvest",    label: "Harvest",     icon: TrendingUp, date: "20 Jul" },
];

function CircularProgress({ value, size = 60 }: { value: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#16a34a" strokeWidth={5}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.7s ease" }}
      />
    </svg>
  );
}

const FARM_PROFILE_COORDS: Record<string, [number, number]> = {
  nairobi: [-1.2921, 36.8219], kiambu: [-1.1728, 36.8342], nakuru: [-0.3031, 36.0800],
  meru: [0.0500, 37.6500], kirinyaga: [-0.4700, 37.3100], laikipia: [0.0300, 36.8000],
  nyeri: [-0.4167, 36.9500], kisumu: [-0.0917, 34.7679], eldoret: [0.5200, 35.2699],
  machakos: [-1.5177, 37.2634], narok: [-1.0833, 35.8667], thika: [-1.0332, 37.0693],
  nanyuki: [0.0100, 37.0714], embu: [-0.5273, 37.4571], kericho: [-0.3667, 35.2833],
  bungoma: [0.5630, 34.5522], kakamega: [0.2827, 34.7519], muranga: [-0.7167, 37.1500],
};
function getFarmCoords(location: string): [number, number] {
  const lower = (location ?? "").toLowerCase();
  for (const [key, coords] of Object.entries(FARM_PROFILE_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return [-0.3031, 36.0800];
}

function FarmBoundaryMap({ cropType, location }: { cropType: string; location?: string }) {
  const [lat, lng] = getFarmCoords(location ?? "");
  const zoom = 13;
  const tileSize = 256;
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const xTile = Math.floor(((lng + 180) / 360) * n);
  const yTile = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${xTile}/${yTile}.png`;
  const tileUrlL = `https://tile.openstreetmap.org/${zoom}/${xTile - 1}/${yTile}.png`;
  const tileUrlR = `https://tile.openstreetmap.org/${zoom}/${xTile + 1}/${yTile}.png`;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border shadow-sm" style={{ height: 180 }}>
      <div className="absolute inset-0 flex overflow-hidden bg-[#aad3df]">
        <img src={tileUrlL} alt="" width={tileSize} height={tileSize} className="h-full w-auto flex-shrink-0 object-cover" style={{ width: tileSize, height: tileSize, minHeight: "100%" }} />
        <img src={tileUrl}  alt="" width={tileSize} height={tileSize} className="h-full w-auto flex-shrink-0 object-cover" style={{ width: tileSize, height: tileSize, minHeight: "100%" }} />
        <img src={tileUrlR} alt="" width={tileSize} height={tileSize} className="h-full w-auto flex-shrink-0 object-cover" style={{ width: tileSize, height: tileSize, minHeight: "100%" }} />
      </div>
      {/* Pin marker */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center -mt-4">
          <div className="w-7 h-7 rounded-full bg-primary border-2 border-white shadow-lg flex items-center justify-center">
            <MapPin size={13} className="text-white" />
          </div>
          <div className="w-1.5 h-3 bg-primary/80 rounded-b-full" />
          <div className="w-3 h-0.5 bg-black/20 rounded-full mt-0.5 blur-[1px]" />
        </div>
      </div>
      {/* Top badge */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-3 py-2 bg-white/90 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-1.5">
          <MapPin size={11} className="text-primary" />
          <p className="text-[11px] font-semibold text-foreground">{cropType ? `${cropType} Farm` : "Farm"} · GPS Verified</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[9px] text-green-600 font-bold uppercase">Live Map</span>
        </div>
      </div>
      {/* Bottom location badge */}
      <div className="absolute bottom-2 left-2 right-2">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm border border-white/60">
          <MapPin size={11} className="text-primary flex-shrink-0" />
          <p className="text-[11px] font-semibold text-foreground truncate">{location ?? "Kenya"}</p>
          <span className="ml-auto text-[9px] text-muted-foreground font-mono">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  );
}

type Tab = "overview" | "crop" | "activities";

export default function FarmProfile() {
  const token = getToken();
  const user = getStoredUser();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [farmSettingsOpen, setFarmSettingsOpen] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateDesc, setUpdateDesc] = useState("");
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [updateFilePreview, setUpdateFilePreview] = useState<string | null>(null);
  const [updatePosted, setUpdatePosted] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: farms, isLoading } = useGetMyFarms();
  const { data: dashboard } = useGetFarmerDashboard();

  const { data: group } = useQuery<GroupInfo>({
    queryKey: ["my-group"],
    queryFn: async () => {
      const r = await fetch("/api/groups/my", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const { data: kycDocs = [] } = useQuery<any[]>({
    queryKey: ["kyc-docs"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const { data: loans = [] } = useQuery<any[]>({
    queryKey: ["loan-apps"],
    queryFn: async () => {
      const r = await fetch("/api/loans/applications", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const isDemo = isDemoAccount();
  const currentFarm = farms?.[0];
  const farmHealth = dashboard?.growthPercent != null ? Math.round(75 + dashboard.growthPercent * 0.2) : null;
  const currentStageIndex = Math.max(0, CROP_STAGES.findIndex(s => s.key === (dashboard as any)?.growthStage));
  const activeLoan = loans.find((l: any) => ["approved", "submitted", "under_review"].includes(l.status));
  const kycApproved = kycDocs.filter((d: any) => d.status === "approved").length;

  const postUpdateMutation = useMutation({
    mutationFn: async ({ farmId, title, description, imageUrl }: { farmId: number; title: string; description: string; imageUrl?: string }) => {
      const r = await fetch("/api/farmer/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ farmId, title, description, imageUrl }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed to post update"); }
      return r.json();
    },
    onSuccess: () => {
      setUpdatePosted(true);
      setShowUpdateForm(false);
      setUpdateTitle(""); setUpdateDesc(""); setUpdateFile(null); setUpdateFilePreview(null);
      qc.invalidateQueries({ queryKey: ["my-farms"] });
      setTimeout(() => setUpdatePosted(false), 4000);
    },
    onError: (e: Error) => setUpdateError(e.message),
  });

  const handlePostUpdate = async () => {
    if (!currentFarm || !updateTitle.trim() || !updateDesc.trim()) return;
    setUpdateError(null);
    try {
      let imageUrl: string | undefined;
      if (updateFile) {
        const form = new FormData();
        form.append("file", updateFile);
        const r = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
        if (r.ok) { const { url } = await r.json(); imageUrl = url; }
      }
      postUpdateMutation.mutate({ farmId: currentFarm.id, title: updateTitle.trim(), description: updateDesc.trim(), imageUrl });
    } catch (e: any) {
      setUpdateError(e.message ?? "Upload failed");
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview",    label: "Overview" },
    { key: "crop",        label: "Crop Status" },
    { key: "activities",  label: "Activities" },
  ];

  if (kycApproved === 0 && !isDemo) {
    return (
      <div className="app-shell pb-20 bg-white min-h-screen">
        <div className="bg-white px-5 pt-12 pb-3 flex items-center justify-between border-b border-gray-100">
          <img src={logoSrc} alt="Investa Farm" className="h-8 w-auto" />
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white text-sm font-bold">{user?.name?.charAt(0) ?? "F"}</span>
          </div>
        </div>
        <div className="px-5 pt-8 flex flex-col items-center text-center gap-4">
          <div className="w-24 h-24 rounded-3xl bg-amber-100 flex items-center justify-center">
            <ShieldCheck size={40} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-foreground font-bold text-xl">KYC Required</h2>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed max-w-xs">
              Your "My Farm" profile is locked until your identity has been verified. This protects investors and unlocks your farm listing.
            </p>
          </div>
          <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2.5 text-left">
            {[
              { icon: "📋", title: "Upload National ID", body: "Front and back of your Kenyan National ID or Passport." },
              { icon: "🏡", title: "Farm Ownership Proof", body: "Title deed, lease agreement, or county farm certificate." },
              { icon: "📸", title: "Passport Photo", body: "A clear selfie or headshot matching your ID." },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="text-foreground font-semibold text-sm">{item.title}</p>
                  <p className="text-muted-foreground text-xs">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/farmer/kyc" className="w-full">
            <button className="w-full bg-amber-500 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2">
              <ShieldCheck size={16} /> Complete KYC Verification →
            </button>
          </Link>
          <Link href="/farmer">
            <button className="text-muted-foreground text-sm underline">Back to Dashboard</button>
          </Link>
        </div>
        <BottomNav role="farmer" />
      </div>
    );
  }

  return (
    <div className="app-shell pb-20 bg-white min-h-screen">
      {/* Top bar */}
      <div className="bg-white px-5 pt-12 pb-3 flex items-center justify-between border-b border-gray-100">
        <img src={logoSrc} alt="Investa Farm" className="h-8 w-auto" />
        <div className="flex items-center gap-2">
          <button className="relative w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <Bell size={16} className="text-gray-600" />
          </button>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white text-sm font-bold">{user?.name?.charAt(0) ?? "F"}</span>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Farm</h1>
        </div>
        <button onClick={() => setFarmSettingsOpen(true)} className="flex items-center gap-1.5 border border-border rounded-xl px-3 py-1.5 text-xs font-medium text-foreground bg-white shadow-sm active:scale-95 transition-transform">
          <Settings size={13} className="text-muted-foreground" />
          Farm Settings
        </button>
      </div>

      {/* Tabs */}
      <div className="px-5 pt-1 pb-0">
        <div className="flex gap-1 border-b border-gray-100">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 pb-2.5 px-1 mr-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {tab.key === "overview" && <BarChart3 size={13} />}
              {tab.key === "crop"     && <Leaf size={13} />}
              {tab.key === "activities" && <CalendarDays size={13} />}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">

        {/* ─── OVERVIEW TAB ─── */}
        {activeTab === "overview" && (
          <>
            {/* Farm boundary map */}
            {isLoading
              ? <div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
              : <FarmBoundaryMap
                  cropType={currentFarm?.cropType ?? ""}
                  location={currentFarm?.location ?? undefined}
                />
            }

            {/* Stats strip: Current Stage | Health Score | Next Activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="grid grid-cols-3 divide-x divide-gray-100">
                <div className="pr-3">
                  <p className="text-muted-foreground text-[10px] font-medium mb-1">Current Stage</p>
                  <p className="text-primary font-bold text-sm">{CROP_STAGES[currentStageIndex]?.label ?? "Growing"}</p>
                  <div className="mt-1 w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sun size={12} className="text-primary" />
                  </div>
                </div>
                <div className="px-3 flex flex-col items-center">
                  <p className="text-muted-foreground text-[10px] font-medium mb-1">Farm Health Score</p>
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <CircularProgress value={farmHealth ?? 0} size={56} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-foreground font-bold text-xs leading-none">{farmHealth ?? "—"}</p>
                      {farmHealth != null && <p className="text-muted-foreground text-[8px]">/100</p>}
                    </div>
                  </div>
                  {farmHealth != null && <span className="mt-0.5 inline-block bg-green-100 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-full">Good</span>}
                </div>
                <div className="pl-3">
                  <p className="text-muted-foreground text-[10px] font-medium mb-1">Next Activity</p>
                  <div className="flex items-start gap-1">
                    <CalendarDays size={12} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-foreground font-medium text-[11px] leading-tight">No tasks set</p>
                      <p className="text-muted-foreground text-[9px] mt-0.5">Use Farm Settings</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
                <Droplets size={18} className="text-blue-500 mx-auto mb-1" />
                <p className="text-foreground font-bold text-sm">—</p>
                <p className="text-muted-foreground text-[9px]">Soil Moisture</p>
                <span className="text-[9px] bg-blue-50 text-blue-400 px-1.5 py-0.5 rounded-full font-bold mt-0.5 inline-block">No data</span>
              </div>
              <div className="bg-sky-50 border border-sky-100 rounded-2xl p-3 text-center">
                <CloudRain size={18} className="text-sky-500 mx-auto mb-1" />
                <p className="text-foreground font-bold text-sm">—</p>
                <p className="text-muted-foreground text-[9px]">Rainfall (7d)</p>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-2xl p-3 text-center">
                <BarChart3 size={18} className="text-green-600 mx-auto mb-1" />
                <p className="text-foreground font-bold text-sm">—</p>
                <p className="text-muted-foreground text-[9px]">Yield Projection</p>
              </div>
            </div>

            {/* Crop Timeline */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="font-semibold text-sm mb-4">Crop Timeline</p>
              <div className="relative">
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted rounded-full" />
                <div className="absolute top-4 left-4 h-0.5 bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${(currentStageIndex / (CROP_STAGES.length - 1)) * 100}%`, maxWidth: "calc(100% - 32px)" }} />
                <div className="flex justify-between relative z-10">
                  {CROP_STAGES.map((stage, i) => {
                    const Icon = stage.icon;
                    const done = i < currentStageIndex;
                    const current = i === currentStageIndex;
                    return (
                      <div key={stage.key} className="flex flex-col items-center gap-1.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                          current ? "bg-primary border-primary shadow-md shadow-primary/30" :
                          done    ? "bg-primary/20 border-primary" : "bg-white border-border"}`}>
                          <Icon size={13} className={current ? "text-white" : done ? "text-primary" : "text-muted-foreground"} />
                        </div>
                        <p className={`text-[9px] font-medium text-center leading-tight ${current ? "text-primary font-bold" : done ? "text-primary/70" : "text-muted-foreground"}`}>
                          {stage.label}
                        </p>
                        <p className={`text-[8px] ${current ? "text-primary/70" : "text-muted-foreground/60"}`}>{stage.date}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Upcoming Tasks */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="font-semibold text-sm">Upcoming Tasks</p>
                <span className="text-primary text-xs font-medium flex items-center gap-0.5">View all <ChevronRight size={13} /></span>
              </div>
              <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 text-center">
                <CalendarDays size={20} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-foreground text-xs font-medium">No tasks scheduled</p>
                <p className="text-muted-foreground text-[10px] mt-0.5">Farm activity tasks will appear here</p>
              </div>
            </div>
          </>
        )}

        {/* ─── CROP STATUS TAB ─── */}
        {activeTab === "crop" && (
          <>
            {/* All farms listed */}
            {isLoading
              ? Array(2).fill(0).map((_, i) => <div key={i} className="h-44 rounded-2xl bg-gray-100 animate-pulse" />)
              : farms?.length === 0
                ? (
                  <div className="text-center py-16 bg-gray-50 border border-border rounded-2xl">
                    <Leaf size={32} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-foreground font-semibold">No farms registered yet</p>
                    <p className="text-muted-foreground text-xs mt-1">Contact admin to list your farm on the exchange</p>
                  </div>
                )
                : farms?.map((farm: any) => {
                  const isUp = farm.changePercent >= 0;
                  const img = getCropImage(farm.cropType, farm.imageUrl);
                  return (
                    <div key={farm.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="relative h-32">
                        <img src={img} alt={farm.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />
                        <div className="absolute inset-0 p-3 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${farm.status === "active" ? "bg-green-500 text-white" : "bg-white/80 text-foreground"}`}>
                              {farm.status}
                            </span>
                            <button className="w-7 h-7 rounded-full bg-black/30 flex items-center justify-center">
                              <Share2 size={12} className="text-white" />
                            </button>
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{farm.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin size={10} className="text-white/70" />
                              <p className="text-white/70 text-xs">{farm.cropType} · {farm.location}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-foreground font-bold text-sm">{formatKES(farm.currentPrice)}<span className="text-muted-foreground font-normal text-[10px]"> /share</span></p>
                          <span className={`text-xs font-semibold ${isUp ? "text-green-600" : "text-red-500"}`}>{isUp ? "+" : ""}{farm.changePercent}%</span>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-muted-foreground text-[10px]">Funding Progress</span>
                            <span className="text-primary font-bold text-[10px]">{farm.fundingPercent}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${farm.fundingPercent}%` }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-gray-50 rounded-xl p-2">
                            <p className="text-muted-foreground text-[9px]">Loan Target</p>
                            <p className="text-foreground font-bold text-[10px]">{formatKES(farm.loanAmount)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-2">
                            <p className="text-muted-foreground text-[9px]">Total Shares</p>
                            <p className="text-foreground font-bold text-[10px]">{farm.totalShares.toLocaleString()}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-2">
                            <p className="text-muted-foreground text-[9px]">Funded</p>
                            <p className="text-foreground font-bold text-[10px]">{farm.fundingPercent}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            }
          </>
        )}

        {/* ─── ACTIVITIES TAB ─── */}
        {activeTab === "activities" && (
          <>
            {/* Update posted toast */}
            {updatePosted && (
              <div className="bg-green-600 text-white px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 size={15} /> Update posted — investors will be notified!
              </div>
            )}

            {/* Post Field Update card */}
            {currentFarm && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Camera size={15} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Post Field Update</p>
                      <p className="text-muted-foreground text-[10px]">Notify your investors of farm progress</p>
                    </div>
                  </div>
                  {!showUpdateForm && (
                    <button onClick={() => setShowUpdateForm(true)}
                      className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 active:scale-95 transition-transform">
                      <Plus size={11} /> Post Update
                    </button>
                  )}
                </div>

                {showUpdateForm && (
                  <div className="px-4 py-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1.5 block">Update Title *</label>
                      <input value={updateTitle} onChange={e => setUpdateTitle(e.target.value)}
                        placeholder="e.g. Planting complete — 5 acres done!"
                        className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1.5 block">Description *</label>
                      <textarea value={updateDesc} onChange={e => setUpdateDesc(e.target.value)}
                        rows={3} placeholder="Describe what's happening on the farm this week…"
                        className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1.5 block">Photo (optional)</label>
                      <label className={`w-full border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors flex items-center justify-center min-h-[80px] ${updateFilePreview ? "border-green-300 bg-green-50" : "border-border hover:border-primary/50 bg-muted/30"}`}>
                        <input type="file" className="hidden" accept="image/*"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUpdateFile(file);
                            setUpdateFilePreview(URL.createObjectURL(file));
                          }} />
                        {updateFilePreview ? (
                          <img src={updateFilePreview} alt="Preview" className="w-full h-36 object-cover rounded-xl" />
                        ) : (
                          <div className="p-4 text-center">
                            <Camera size={22} className="text-muted-foreground mx-auto mb-1" />
                            <p className="text-foreground text-xs font-medium">Tap to add photo</p>
                            <p className="text-muted-foreground text-[10px]">JPG, PNG or WEBP</p>
                          </div>
                        )}
                      </label>
                    </div>
                    {updateError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        <p className="text-red-700 text-xs">{updateError}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => { setShowUpdateForm(false); setUpdateTitle(""); setUpdateDesc(""); setUpdateFile(null); setUpdateFilePreview(null); setUpdateError(null); }}
                        className="flex-1 border border-border text-muted-foreground font-semibold py-2.5 rounded-xl text-sm active:scale-95 transition-transform">
                        Cancel
                      </button>
                      <button onClick={handlePostUpdate}
                        disabled={!updateTitle.trim() || !updateDesc.trim() || postUpdateMutation.isPending}
                        className="flex-1 bg-primary text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50">
                        {postUpdateMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Posting…</> : "Post Update"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* KYC verification */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 size={15} className="text-primary" /> KYC Verification
              </p>
              {kycDocs.length === 0 ? (
                <p className="text-muted-foreground text-xs">No documents uploaded yet. Open KYC from your dashboard.</p>
              ) : (
                <div className="space-y-1.5">
                  {kycDocs.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-2">
                      {doc.status === "approved" ? <CheckCircle2 size={13} className="text-green-600" />
                        : doc.status === "rejected" ? <XCircle size={13} className="text-red-500" />
                        : <Clock size={13} className="text-amber-500" />}
                      <span className="text-foreground text-xs truncate flex-1">{doc.title}</span>
                      <span className="text-[9px] capitalize text-muted-foreground">{doc.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Group info */}
            {group && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-semibold text-sm">{group.name}</p>
                    <p className="text-muted-foreground text-xs">{group.county} · {group.memberCount} members</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {group.status === "approved" ? <CheckCircle2 size={13} className="text-green-600" />
                      : <Clock size={13} className="text-amber-500" />}
                    <span className="text-[10px] capitalize text-muted-foreground">{group.status}</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5 flex justify-between text-xs">
                  <div><p className="text-muted-foreground">Reg. Number</p><p className="font-mono font-bold text-foreground">{group.registrationNumber || "—"}</p></div>
                  <div className="text-right"><p className="text-muted-foreground">Status</p><p className="font-semibold capitalize text-foreground">{group.status}</p></div>
                </div>
              </div>
            )}

            {/* Active loan */}
            {activeLoan && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-amber-700 font-semibold text-sm mb-2 flex items-center gap-2">
                  <DollarSign size={14} /> Active Loan Application
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-foreground font-bold">{formatKES(activeLoan.amount)}</p>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full capitalize">{activeLoan.status}</span>
                </div>
                <p className="text-muted-foreground text-xs mt-1">{activeLoan.purposeDetails?.slice(0, 80)}…</p>
              </div>
            )}

            {/* Recent activity log */}
            <div>
              <p className="font-semibold text-sm mb-3">Recent Activity</p>
              <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 text-center">
                <Activity size={20} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-foreground text-xs font-medium">No activity yet</p>
                <p className="text-muted-foreground text-[10px] mt-0.5">Farm events and milestones will appear here</p>
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav role="farmer" />

      {/* Farm Settings bottom sheet */}
      <AnimatePresence>
        {farmSettingsOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setFarmSettingsOpen(false)} />
            <motion.div className="relative w-full max-w-[430px] bg-white rounded-t-3xl pb-10"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              <div className="w-10 h-1 bg-muted rounded-full mx-auto mt-3 mb-1" />
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <p className="font-bold text-base">Farm Settings</p>
                  <p className="text-muted-foreground text-xs mt-0.5">View & manage your farm profile</p>
                </div>
                <button onClick={() => setFarmSettingsOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                  <p className="text-primary font-semibold text-sm">Current Farm</p>
                  <p className="text-foreground font-bold mt-0.5">{currentFarm?.name ?? "No farm listed yet"}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {currentFarm ? `${currentFarm.cropType ?? "—"} · ${currentFarm.location ?? "—"}` : "Contact admin to list your farm"}
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    { icon: "📍", label: "Location", value: currentFarm?.location ?? "Not set" },
                    { icon: "🌾", label: "Crop Type", value: currentFarm?.cropType ?? "Not set" },
                    { icon: "💰", label: "Share Price", value: currentFarm ? formatKES(currentFarm.currentPrice ?? 0) : "Not set" },
                    { icon: "📊", label: "Total Shares", value: currentFarm ? (currentFarm.totalShares ?? 0).toLocaleString() : "Not set" },
                    { icon: "🎯", label: "Funding Target", value: currentFarm ? formatKES(currentFarm.loanAmount ?? 0) : "Not set" },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                      <span className="text-base">{icon}</span>
                      <div className="flex-1">
                        <p className="text-muted-foreground text-[10px] font-medium">{label}</p>
                        <p className="text-foreground font-semibold text-sm">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                  <p className="text-amber-700 text-xs leading-relaxed">
                    To update farm details or request changes, contact us at{" "}
                    <a href="mailto:investafarm@proton.me" className="font-semibold underline">investafarm@proton.me</a>
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
