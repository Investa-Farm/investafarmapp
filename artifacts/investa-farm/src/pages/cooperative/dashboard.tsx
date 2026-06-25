import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Users, Code2, FileSpreadsheet, Plug, Copy, Check, ChevronRight, LogOut, BarChart3, Globe, Phone, Camera, Package, ShoppingCart, Truck, Star, TrendingUp, Key, RefreshCw, Plus, Trash2, Upload, UserPlus, Handshake, Link, QrCode, Search, CheckCircle2, XCircle, Clock, ScanLine, AlertTriangle, MapPin, Leaf } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clearToken, getStoredUser, getToken } from "@/lib/auth";


type LiveVoucher = { id: number; voucherCode: string; amount: number; items: string | null; status: string; farmerName: string; farmerPhone: string | null; createdAt: string };

function VoucherRedemptionTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const [scanCode, setScanCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scannedVoucher, setScannedVoucher] = useState<LiveVoucher | null>(null);
  const [scanError, setScanError] = useState("");
  const [fulfilling, setFulfilling] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "fulfilled" | "expired">("all");

  const { data: voucherList = [], isLoading: vouchersLoading } = useQuery<LiveVoucher[]>({
    queryKey: ["live-voucher-orders"],
    queryFn: async () => {
      const r = await fetch("/api/agribusiness/voucher-orders", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const handleScan = async () => {
    if (!scanCode.trim()) return;
    setScanning(true); setScanError(""); setScannedVoucher(null);
    try {
      const r = await fetch("/api/agribusiness/voucher-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ voucherCode: scanCode.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Voucher not found");
      setScannedVoucher(d);
    } catch (e) {
      setScanError((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const fulfil = async (id: number) => {
    setFulfilling(true);
    try {
      const r = await fetch(`/api/agribusiness/voucher-orders/${id}/fulfil`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed"); }
      setScannedVoucher(null); setScanCode("");
      qc.invalidateQueries({ queryKey: ["live-voucher-orders"] });
      qc.invalidateQueries({ queryKey: ["voucher-orders"] });
    } catch (e) {
      setScanError((e as Error).message);
    } finally {
      setFulfilling(false);
    }
  };

  const listed = voucherList.filter(v => filterStatus === "all" || v.status === filterStatus);
  const pendingCount = voucherList.filter(v => v.status === "pending").length;
  const totalRevenue = voucherList.filter(v => v.status === "fulfilled").reduce((s, v) => s + Number(v.amount), 0);

  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { val: vouchersLoading ? "…" : String(pendingCount), label: "Pending", color: "bg-amber-50 text-amber-700 border-amber-200" },
          { val: vouchersLoading ? "…" : String(voucherList.filter(v => v.status === "fulfilled").length), label: "Fulfilled", color: "bg-green-50 text-green-700 border-green-200" },
          { val: vouchersLoading ? "…" : `${(totalRevenue / 1000).toFixed(0)}K`, label: "KES Earned", color: "bg-blue-50 text-blue-700 border-blue-200" },
        ].map(({ val, label, color }) => (
          <div key={label} className={`rounded-2xl p-3 border text-center ${color}`}>
            <p className="font-bold text-sm">{val}</p>
            <p className="text-[10px] opacity-70">{label}</p>
          </div>
        ))}
      </div>

      {/* Voucher Scanner */}
      <div className="bg-white border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <QrCode size={15} className="text-blue-600" />
          <p className="text-sm font-semibold">Verify Voucher</p>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <ScanLine size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={scanCode} onChange={e => { setScanCode(e.target.value); setScanError(""); setScannedVoucher(null); }}
              onKeyDown={e => e.key === "Enter" && handleScan()}
              placeholder="IFV-2026-TOM-001"
              className="w-full border border-border rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <button onClick={handleScan} disabled={!scanCode.trim() || scanning}
            className="bg-blue-600 text-white px-3 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 active:scale-95">
            {scanning ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
            Verify
          </button>
        </div>

        <AnimatePresence>
          {scanError && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 text-xs">{scanError}</p>
            </motion.div>
          )}
          {scannedVoucher && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mt-3 rounded-2xl border p-4 ${scannedVoucher.status === "pending" ? "bg-green-50 border-green-200" : scannedVoucher.status === "fulfilled" ? "bg-gray-50 border-gray-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center justify-between mb-2">
                <code className="text-[10px] font-mono font-bold text-foreground">{scannedVoucher.voucherCode}</code>
                {scannedVoucher.status === "pending" && (
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">VALID</span>
                )}
                {scannedVoucher.status === "fulfilled" && (
                  <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">USED</span>
                )}
                {scannedVoucher.status === "expired" && (
                  <span className="text-[9px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">EXPIRED</span>
                )}
              </div>
              <p className="text-foreground font-semibold text-sm">{scannedVoucher.farmerName}</p>
              {scannedVoucher.farmerPhone && <p className="text-muted-foreground text-[10px]">{scannedVoucher.farmerPhone}</p>}
              {scannedVoucher.items && <p className="text-muted-foreground text-xs mt-0.5">{scannedVoucher.items}</p>}
              <div className="flex items-center justify-between mt-2.5">
                <p className="text-foreground font-bold text-base">KES {Number(scannedVoucher.amount).toLocaleString("en-KE")}</p>
                {scannedVoucher.status === "pending" && (
                  <button onClick={() => fulfil(scannedVoucher.id)} disabled={fulfilling}
                    className="bg-[#16a34a] text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 active:scale-95">
                    {fulfilling ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                    Mark Fulfilled
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Voucher list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Voucher History</p>
          <div className="flex gap-1">
            {(["all","pending","fulfilled"] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`text-[9px] font-bold px-2 py-1 rounded-full capitalize transition-all ${filterStatus === s ? "bg-[#16a34a] text-white" : "bg-gray-100 text-gray-500"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        {vouchersLoading ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : listed.length === 0 ? (
          <div className="text-center py-8 bg-white border border-border rounded-2xl">
            <Package size={24} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No vouchers found</p>
          </div>
        ) : null}
        <div className="space-y-2">
          {listed.map(v => {
            const isFulfilled = v.status === "fulfilled";
            return (
              <div key={v.id} className="bg-white border border-border rounded-2xl p-3.5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isFulfilled ? "bg-green-100" : v.status === "expired" ? "bg-red-100" : "bg-amber-100"}`}>
                  {isFulfilled ? <CheckCircle2 size={16} className="text-green-600" /> : v.status === "expired" ? <XCircle size={16} className="text-red-500" /> : <Clock size={16} className="text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs font-bold truncate">{v.farmerName}</p>
                  <p className="text-muted-foreground text-[9px] font-mono">{v.voucherCode}</p>
                  {v.items && <p className="text-muted-foreground text-[9px] mt-0.5">{v.items}</p>}
                </div>
                <div className="text-right">
                  <p className="text-foreground text-xs font-bold">KES {(Number(v.amount)/1000).toFixed(1)}K</p>
                  <p className="text-[9px] text-muted-foreground">{new Date(v.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${isFulfilled ? "bg-green-100 text-green-700" : v.status === "expired" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                    {isFulfilled ? "Fulfilled" : v.status === "expired" ? "Expired" : "Pending"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

const API_SNIPPET = `// Investa Farm REST API
fetch("https://api.investafarm.co.ke/v1/farmers", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
})
.then(r => r.json())
.then(farmers => console.log(farmers));`;

const EXCEL_SNIPPET = `=INVESTAFARM_FARMERS("YOUR_KEY","county=Nakuru")`;

const FARMERS_CONNECT_SERVICES = [
  { icon: "🌾", title: "Farmer Group Onboarding", desc: "Register and verify entire SACCO or cooperative farmer groups at once", badge: "Active" },
  { icon: "💳", title: "Group Loan Facilitation", desc: "Apply for bulk input credit on behalf of your farmer network", badge: "Active" },
  { icon: "📦", title: "Bulk Produce Aggregation", desc: "Pool harvests from all member farms and sell as a single bulk consignment", badge: "Active" },
  { icon: "📊", title: "Network Analytics & Reports", desc: "Monitor yield, revenue, and loan repayment across all member farms", badge: "Active" },
  { icon: "🔌", title: "System Integration (API)", desc: "Sync Investa Farm data with your cooperative's existing software", badge: "Beta" },
  { icon: "🤝", title: "Co-investment Programs", desc: "Co-fund large farm seasons alongside Investa Farm investors", badge: "Active" },
];

const INPUT_PROVIDER_SERVICES = [
  { icon: "🌱", title: "Input Catalog Listing", desc: "List seeds, fertilizer, and farm inputs on the Investa platform", badge: "Active" },
  { icon: "💳", title: "Input Voucher Redemption", desc: "Accept Investa Farm loan vouchers as payment from farmers", badge: "Active" },
  { icon: "📦", title: "Order Management", desc: "Track and fulfil input orders from funded farmers", badge: "Active" },
  { icon: "📊", title: "Sales Analytics", desc: "Reports on voucher redemptions, sales volume and crop coverage", badge: "Active" },
  { icon: "🚚", title: "Last-Mile Delivery", desc: "Coordinate input delivery to rural farm locations", badge: "Active" },
  { icon: "🤝", title: "Supply Chain Finance", desc: "Access working capital financing backed by Investa orders", badge: "Active" },
];

type DeliveryStatus = "pending" | "in_transit" | "delivered" | "failed";
type Delivery = {
  id: number; voucherCode: string; farmerName: string; farmerPhone: string;
  location: string; items: string; amountKes: number;
  status: DeliveryStatus; agent?: string; eta?: string; createdAt: string;
};

const MOCK_DELIVERIES: Delivery[] = [
  { id: 1, voucherCode: "IFV-2026-MAI-011", farmerName: "Grace Wanjiku", farmerPhone: "+254712345678", location: "Nakuru, Rift Valley", items: "50kg DAP Fertilizer, 10kg Maize Seed", amountKes: 8500, status: "in_transit", agent: "James Mwangi", eta: "Today 3:00 PM", createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 2, voucherCode: "IFV-2026-TOM-019", farmerName: "Peter Kamau", farmerPhone: "+254798765432", location: "Kiambu, Central", items: "Pesticide Spray (5L), Stakes x200", amountKes: 4200, status: "pending", createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 3, voucherCode: "IFV-2026-WHT-007", farmerName: "Sarah Achieng", farmerPhone: "+254756789012", location: "Trans Nzoia, Western", items: "100kg CAN Fertilizer, 20kg Wheat Seed", amountKes: 12000, status: "delivered", agent: "David Otieno", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 4, voucherCode: "IFV-2026-POT-003", farmerName: "John Muthuri", farmerPhone: "+254733456789", location: "Meru, Eastern", items: "Potato Seed (50kg)", amountKes: 6000, status: "pending", createdAt: new Date(Date.now() - 10800000).toISOString() },
];

const DELIVERY_AGENTS = ["James Mwangi", "David Otieno", "Alice Njeri", "Samuel Odhiambo", "Faith Wafula"];

function LastMileDeliveryTab() {
  const [deliveries, setDeliveries] = useState<Delivery[]>(MOCK_DELIVERIES);
  const [filterStatus, setFilterStatus] = useState<DeliveryStatus | "all">("all");
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedEta, setSelectedEta] = useState("");
  const [marking, setMarking] = useState<number | null>(null);

  const listed = filterStatus === "all" ? deliveries : deliveries.filter(d => d.status === filterStatus);
  const pending = deliveries.filter(d => d.status === "pending").length;
  const inTransit = deliveries.filter(d => d.status === "in_transit").length;
  const delivered = deliveries.filter(d => d.status === "delivered").length;

  const assignAgent = (id: number) => {
    if (!selectedAgent) return;
    setDeliveries(prev => prev.map(d => d.id === id
      ? { ...d, status: "in_transit" as DeliveryStatus, agent: selectedAgent, eta: selectedEta || "2–4 hours" }
      : d));
    setAssigningId(null); setSelectedAgent(""); setSelectedEta("");
  };

  const markDelivered = async (id: number) => {
    setMarking(id);
    await new Promise(r => setTimeout(r, 800));
    setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status: "delivered" as DeliveryStatus } : d));
    setMarking(null);
  };

  const statusConfig: Record<DeliveryStatus, { label: string; color: string; bg: string; dot: string }> = {
    pending:    { label: "Pending",    color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-400" },
    in_transit: { label: "In Transit", color: "text-blue-700",  bg: "bg-blue-50 border-blue-200",  dot: "bg-blue-500 animate-pulse" },
    delivered:  { label: "Delivered",  color: "text-green-700", bg: "bg-green-50 border-green-200", dot: "bg-green-500" },
    failed:     { label: "Failed",     color: "text-red-700",   bg: "bg-red-50 border-red-200",     dot: "bg-red-400" },
  };

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { val: String(pending),    label: "To Dispatch", color: "bg-amber-50 text-amber-700 border-amber-200" },
          { val: String(inTransit),  label: "In Transit",  color: "bg-blue-50 text-blue-700 border-blue-200"   },
          { val: String(delivered),  label: "Delivered",   color: "bg-green-50 text-green-700 border-green-200"},
        ].map(({ val, label, color }) => (
          <div key={label} className={`rounded-2xl p-3 border text-center ${color}`}>
            <p className="font-bold text-base">{val}</p>
            <p className="text-[10px] opacity-70">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all","pending","in_transit","delivered"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize transition-all ${filterStatus === s ? "bg-[#16a34a] text-white" : "bg-gray-100 text-gray-500"}`}>
            {s === "all" ? `All (${deliveries.length})` : s === "in_transit" ? "In Transit" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Delivery cards */}
      <div className="space-y-3">
        {listed.map(d => {
          const cfg = statusConfig[d.status];
          return (
            <motion.div key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-border rounded-2xl overflow-hidden">
              {/* Card header */}
              <div className={`px-4 py-2.5 border-b flex items-center justify-between ${cfg.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                  {d.eta && d.status === "in_transit" && (
                    <span className="text-[9px] text-blue-500 font-medium">· ETA: {d.eta}</span>
                  )}
                </div>
                <code className={`text-[9px] font-mono font-bold ${cfg.color}`}>{d.voucherCode}</code>
              </div>

              {/* Card body */}
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-foreground font-bold text-sm">{d.farmerName}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={9} className="text-muted-foreground" />
                      <p className="text-muted-foreground text-[10px]">{d.location}</p>
                    </div>
                  </div>
                  <p className="text-foreground font-bold text-sm flex-shrink-0">KES {d.amountKes.toLocaleString("en-KE")}</p>
                </div>

                <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3">
                  <p className="text-muted-foreground text-[10px] leading-relaxed">📦 {d.items}</p>
                  {d.farmerPhone && <p className="text-muted-foreground text-[10px] mt-0.5">📞 {d.farmerPhone}</p>}
                </div>

                {d.agent && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold text-blue-700">
                      {d.agent.charAt(0)}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Agent: <span className="font-semibold text-foreground">{d.agent}</span></p>
                  </div>
                )}

                {/* Actions */}
                {d.status === "pending" && (
                  assigningId === d.id ? (
                    <div className="space-y-2">
                      <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
                        className="w-full border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#16a34a]">
                        <option value="">— Select delivery agent —</option>
                        {DELIVERY_AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <input type="text" value={selectedEta} onChange={e => setSelectedEta(e.target.value)}
                        placeholder="ETA (e.g. Today 3:00 PM)" className="w-full border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                      <div className="flex gap-2">
                        <button onClick={() => { setAssigningId(null); setSelectedAgent(""); }}
                          className="flex-1 border border-border text-xs font-medium py-2 rounded-xl">Cancel</button>
                        <button onClick={() => assignAgent(d.id)} disabled={!selectedAgent}
                          className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
                          <Truck size={11} /> Assign & Dispatch
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAssigningId(d.id)}
                      className="w-full bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-95">
                      <Truck size={12} /> Assign Delivery Agent
                    </button>
                  )
                )}
                {d.status === "in_transit" && (
                  <button onClick={() => markDelivered(d.id)} disabled={marking === d.id}
                    className="w-full bg-[#16a34a] text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-95">
                    {marking === d.id ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    {marking === d.id ? "Updating…" : "Mark as Delivered"}
                  </button>
                )}
                {d.status === "delivered" && (
                  <div className="flex items-center justify-center gap-2 py-1.5 bg-green-50 rounded-xl">
                    <CheckCircle2 size={13} className="text-green-600" />
                    <p className="text-green-700 text-xs font-semibold">Delivered successfully</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Route planning card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-4 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Truck size={16} className="text-blue-200" />
          <p className="text-sm font-bold">Route Optimisation</p>
          <span className="text-[9px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full ml-auto">Coming Soon</span>
        </div>
        <p className="text-blue-100 text-xs leading-relaxed">
          AI-powered route planning will group nearby deliveries and calculate optimal drive routes to reduce fuel costs by up to 35%.
        </p>
      </div>
    </>
  );
}

const ORG_TYPE_IMAGES: Record<string, string> = {
  cooperative:  "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=200&q=80",
  distributor:  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=200&q=80",
  aggregator:   "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=200&q=80",
  agribusiness: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&q=80",
  financial:    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&q=80",
  ngo:          "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=200&q=80",
};

function generateApiKey(userId: number) {
  const base = btoa(`ifv_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
  return `ifv_live_${base.replace(/[+/=]/g, "").slice(0, 32)}`;
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0]!.split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
  return { headers, rows };
}

export default function CooperativeDashboard() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const token = getToken();
  const [copiedSnippet, setCopiedSnippet] = useState<"rest" | "excel" | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "api" | "farmers" | "orders" | "coinvest" | "delivery">("overview");

  // API Keys state
  const [apiKeys, setApiKeys] = useState<Array<{ key: string; name: string; createdAt: string }>>(() => {
    try { return JSON.parse(localStorage.getItem("investa_api_keys") ?? "[]"); } catch { return []; }
  });
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // CSV import state
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Co-investment state
  const [coinvestAmount, setCoinvestAmount] = useState("");
  const [coinvestFarm, setCoinvestFarm] = useState("");
  const [coinvestMemberCount, setCoinvestMemberCount] = useState("");
  const [coinvestNotes, setCoinvestNotes] = useState("");
  const [coinvestSubmitting, setCoinvestSubmitting] = useState(false);
  const [coinvestSubmitted, setCoinvestSubmitted] = useState<{ referenceId: string; estimatedReturn: string } | null>(null);
  const [coinvestError, setCoinvestError] = useState<string | null>(null);

  // Invitation link
  const [inviteCopied, setInviteCopied] = useState(false);
  const inviteLink = `https://app.investafarm.com/register?ref=${user?.id ?? 0}&type=farmer&partner=${encodeURIComponent(user?.name ?? "")}`;

  const handleLogout = () => { clearToken(); setLocation("/"); };

  const copy = async (text: string, type: "rest" | "excel") => {
    await navigator.clipboard.writeText(text);
    setCopiedSnippet(type);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const generateKey = () => {
    if (!newKeyName.trim()) return;
    const newKey = { key: generateApiKey(user?.id ?? 0), name: newKeyName.trim(), createdAt: new Date().toISOString() };
    const updated = [...apiKeys, newKey];
    setApiKeys(updated);
    localStorage.setItem("investa_api_keys", JSON.stringify(updated));
    setRevealedKey(newKey.key);
    setNewKeyName("");
  };

  const revokeKey = (key: string) => {
    const updated = apiKeys.filter(k => k.key !== key);
    setApiKeys(updated);
    localStorage.setItem("investa_api_keys", JSON.stringify(updated));
    if (revealedKey === key) setRevealedKey(null);
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvData(parseCSV(text));
      setCsvSuccess(null);
    };
    reader.readAsText(file);
  };

  const importCSV = async () => {
    if (!csvData || csvData.rows.length === 0) return;
    setCsvImporting(true); setCsvError(null);
    try {
      const farmers = csvData.rows.map(row => ({
        name: row.name ?? row.Name ?? "",
        phone: row.phone ?? row.Phone ?? "",
        county: row.county ?? row.County ?? "Kenya",
        email: row.email ?? row.Email ?? "",
        cropType: row.cropType ?? row.crop ?? row.Crop ?? "",
      }));
      const r = await fetch("/api/cooperative/import-farmers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ farmers }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Import failed");
      setCsvSuccess(d.message ?? `${d.imported} farmers imported.`);
      setCsvData(null);
      if (csvRef.current) csvRef.current.value = "";
    } catch (e) {
      setCsvError((e as Error).message);
    } finally {
      setCsvImporting(false);
    }
  };

  const copyInviteLink = async () => {
    await navigator.clipboard.writeText(inviteLink).catch(() => {});
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const orgType = localStorage.getItem("investa_org_type") ?? "cooperative";
  const subType = localStorage.getItem("investa_coop_sub_type") ?? "farmers_connect";
  const isInputProvider = subType === "input_provider";
  const profileImage = ORG_TYPE_IMAGES[orgType] ?? ORG_TYPE_IMAGES.cooperative;
  const services = isInputProvider ? INPUT_PROVIDER_SERVICES : FARMERS_CONNECT_SERVICES;

  type TabId = "overview" | "api" | "farmers" | "orders" | "coinvest" | "delivery";
  const tabs: TabId[] = isInputProvider
    ? ["overview", "api", "orders", "delivery"]
    : ["overview", "api", "farmers", "coinvest"];

  // Cooperative farmer network (real API)
  type NetworkFarmer = { id: number; name: string; county: string; phone: string; joined: string; status: string; funded: boolean };
  const { data: networkFarmers = [], isLoading: farmersLoading } = useQuery<NetworkFarmer[]>({
    queryKey: ["cooperative-farmers"],
    queryFn: async () => {
      const r = await fetch("/api/cooperative/farmers", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !isInputProvider && !!token,
    staleTime: 60_000,
  });

  type VoucherOrder = { id: number; status: string; amount: number };
  const { data: voucherOrders = [] } = useQuery<VoucherOrder[]>({
    queryKey: ["voucher-orders"],
    queryFn: async () => {
      const r = await fetch("/api/agribusiness/voucher-orders", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: isInputProvider && !!token,
  });

  const { data: coopStats } = useQuery<{ farmerCount: number; activeLoanCount: number; totalFundedKes: number }>({
    queryKey: ["cooperative-stats"],
    queryFn: async () => {
      const r = await fetch("/api/cooperative/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { farmerCount: 0, activeLoanCount: 0, totalFundedKes: 0 };
      return r.json();
    },
    enabled: !isInputProvider && !!token,
    staleTime: 120_000,
  });

  const activeOrderCount = voucherOrders.filter(o => o.status === "pending").length;
  const totalVoucherCount = voucherOrders.length;
  const revenueKes = voucherOrders.filter(o => o.status === "fulfilled").reduce((s, o) => s + o.amount, 0);

  const statsRow = isInputProvider
    ? [
        { val: String(activeOrderCount), label: "Active Orders" },
        { val: String(totalVoucherCount), label: "Vouchers" },
        { val: revenueKes > 0 ? `${(revenueKes / 1000).toFixed(0)}K` : "0", label: "Revenue KES" },
      ]
    : [
        { val: coopStats ? String(coopStats.farmerCount) : "—", label: "Farmers" },
        { val: coopStats ? String(coopStats.activeLoanCount) : "—", label: "Active Loans" },
        { val: coopStats ? (coopStats.totalFundedKes > 0 ? `${(coopStats.totalFundedKes / 1_000_000).toFixed(1)}M` : "0") : "—", label: "Funded KES" },
      ];

  const tabLabels: Record<TabId, string> = {
    overview: "Overview",
    api: "API Keys",
    farmers: "Farmers",
    orders: "Orders",
    coinvest: "Co-Invest",
    delivery: "Delivery",
  };

  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const goTab = (t: TabId) => { setActiveTab(t); setMoreSheetOpen(false); };

  const NAV_TABS: { id: TabId; label: string; emoji: string }[] = isInputProvider
    ? [
        { id: "overview",  label: "Home",     emoji: "🏠" },
        { id: "orders",    label: "Vouchers",  emoji: "🎫" },
        { id: "delivery",  label: "Delivery",  emoji: "🚚" },
        { id: "api",       label: "API",       emoji: "🔌" },
      ]
    : [
        { id: "overview",  label: "Home",     emoji: "🏠" },
        { id: "farmers",   label: "Network",  emoji: "👥" },
        { id: "coinvest",  label: "Co-Invest",emoji: "💰" },
        { id: "api",       label: "API",       emoji: "🔌" },
      ];

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-gray-50 pb-24">
      {/* Header */}
      <div className="hero-header rounded-b-3xl px-5 pt-12 pb-5 text-white overflow-hidden relative">
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/30 shadow-lg">
                <img src={profileImage} alt="Organization" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#16a34a] border-2 border-white flex items-center justify-center">
                {isInputProvider ? <Package size={9} className="text-white" /> : <Building2 size={9} className="text-white" />}
              </div>
            </div>
            <div>
              <p className="text-white/70 text-xs">{isInputProvider ? "Input Provider" : "Farmers Connect"} Dashboard</p>
              <h1 className="text-white font-bold text-base leading-tight">{user?.name ?? "Partner"}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isInputProvider ? "bg-blue-500/30 text-blue-200" : "bg-[#16a34a]/40 text-green-200"}`}>
                  {isInputProvider ? "🏭 Input Provider" : "🌾 Farmers Connect"}
                </span>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <LogOut size={15} className="text-white" />
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 relative z-10">
          {statsRow.map(({ val, label }) => (
            <div key={label} className="bg-white/10 rounded-xl p-2.5 text-center border border-white/10">
              <p className="text-white font-bold text-sm">{val}</p>
              <p className="text-white/60 text-[9px]">{label}</p>
            </div>
          ))}
        </div>

      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            <div className={`rounded-2xl p-4 border ${isInputProvider ? "bg-blue-50 border-blue-200" : "bg-[#16a34a]/5 border-[#16a34a]/20"}`}>
              <div className="flex items-center gap-2 mb-2">
                {isInputProvider ? <Package size={15} className="text-blue-600" /> : <Globe size={15} className="text-[#16a34a]" />}
                <p className="text-sm font-semibold">{isInputProvider ? "Input Provider Dashboard" : "Welcome to Investa Farm Partners"}</p>
              </div>
              <p className={`text-xs leading-relaxed ${isInputProvider ? "text-blue-600" : "text-muted-foreground"}`}>
                {isInputProvider
                  ? "As an Input Provider, you can list products, accept voucher payments from Investa-funded farmers, and track order fulfilment across your distribution network."
                  : "You are registered as a Farmers Connect partner. Use this dashboard to manage your farmer network, access loan facilitation, and integrate our data into your operations."}
              </p>
            </div>

            {/* Org profile card */}
            <div className="bg-white border border-green-100 rounded-2xl overflow-hidden shadow-lg shadow-green-500/10">
              <div className="relative h-28">
                <img src={profileImage} alt="Organization" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">{user?.name ?? "Your Organization"}</p>
                    <p className="text-white/70 text-[10px] capitalize">{orgType.replace(/_/g, " ")} · Kenya</p>
                  </div>
                </div>
              </div>
              <div className="p-3 grid grid-cols-3 divide-x divide-border">
                {[
                  { label: "Network", val: "Partner" },
                  { label: "Status", val: "Active" },
                  { label: "API Keys", val: String(apiKeys.length) },
                ].map(({ label, val }) => (
                  <div key={label} className="text-center px-2">
                    <p className="text-foreground font-bold text-xs">{val}</p>
                    <p className="text-muted-foreground text-[9px]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Services grid */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Available Services</p>
              <div className="space-y-2">
                {services.map(svc => (
                  <motion.div key={svc.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-green-100 rounded-2xl p-4 flex items-center gap-3 shadow-md shadow-green-500/10">
                    <div className="w-10 h-10 rounded-xl bg-[#16a34a]/10 flex items-center justify-center text-xl flex-shrink-0">
                      {svc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-semibold">{svc.title}</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{svc.desc}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${svc.badge === "Active" ? "bg-[#16a34a]/10 text-[#16a34a]" : svc.badge === "Beta" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                      {svc.badge}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="bg-[#16a34a]/5 border border-[#16a34a]/20 rounded-2xl p-4">
              <p className="text-[#16a34a] font-semibold text-sm mb-2">Get Onboarded</p>
              <p className="text-[#16a34a]/70 text-xs mb-3">Our partnership team will reach you within 24 hours to complete your onboarding and assign API credentials.</p>
              <div className="flex items-center gap-2 text-[#16a34a] text-xs">
                <Phone size={12} /> <span>+254 700 000 000</span>
                <span className="text-[#16a34a]/40">·</span>
                <span>partners@investafarm.co.ke</span>
              </div>
            </div>
          </>
        )}

        {/* ── API KEYS TAB ── */}
        {activeTab === "api" && (
          <>
            {/* Generate new key */}
            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Key size={15} className="text-[#16a34a]" />
                <p className="text-sm font-semibold">API Key Management</p>
              </div>
              <p className="text-muted-foreground text-xs mb-3">Generate API keys to authenticate your system integrations. Each key is shown once — copy it immediately.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="Key name (e.g. Production)"
                  className="flex-1 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#16a34a]"
                />
                <button onClick={generateKey} disabled={!newKeyName.trim()}
                  className="bg-[#16a34a] text-white px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 active:scale-95">
                  <Plus size={12} /> Generate
                </button>
              </div>
              {revealedKey && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-green-700 text-[10px] font-semibold mb-1.5">⚠ Copy your key now — it won't be shown again in full</p>
                  <div className="flex items-center gap-2">
                    <code className="text-green-800 text-[10px] font-mono flex-1 truncate">{revealedKey}</code>
                    <button onClick={() => copyKey(revealedKey)}
                      className="flex-shrink-0 w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                      {copiedKey === revealedKey ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-green-600" />}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Existing keys */}
            <div className="bg-white border border-border rounded-2xl p-4">
              <p className="text-sm font-semibold mb-3">Your API Keys ({apiKeys.length})</p>
              {apiKeys.length === 0 ? (
                <div className="text-center py-6">
                  <Key size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-xs">No keys generated yet. Create one above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map(k => (
                    <div key={k.key} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                      <div className="w-8 h-8 rounded-lg bg-[#16a34a]/10 flex items-center justify-center flex-shrink-0">
                        <Key size={13} className="text-[#16a34a]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-xs font-semibold">{k.name}</p>
                        <p className="text-muted-foreground text-[9px] font-mono">{k.key.slice(0, 20)}••••</p>
                      </div>
                      <button onClick={() => copyKey(k.key)}
                        className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center">
                        {copiedKey === k.key ? <Check size={11} className="text-green-600" /> : <Copy size={11} className="text-muted-foreground" />}
                      </button>
                      <button onClick={() => revokeKey(k.key)}
                        className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                        <Trash2 size={11} className="text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Code snippet */}
            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Plug size={15} className="text-[#16a34a]" />
                <p className="text-sm font-semibold">REST API Example</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-3 relative">
                <pre className="text-[#16a34a] text-[9px] font-mono leading-relaxed overflow-x-auto">{API_SNIPPET}</pre>
                <button onClick={() => copy(API_SNIPPET, "rest")}
                  className="absolute top-2 right-2 w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                  {copiedSnippet === "rest" ? <Check size={10} className="text-[#16a34a]" /> : <Copy size={10} className="text-white/60" />}
                </button>
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileSpreadsheet size={15} className="text-[#16a34a]" />
                <p className="text-sm font-semibold">Excel / Google Sheets Plugin</p>
                <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Beta</span>
              </div>
              <div className="bg-gray-900 rounded-xl p-3 relative">
                <pre className="text-yellow-400 text-[10px] font-mono">{EXCEL_SNIPPET}</pre>
                <button onClick={() => copy(EXCEL_SNIPPET, "excel")}
                  className="absolute top-2 right-2 w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                  {copiedSnippet === "excel" ? <Check size={10} className="text-[#16a34a]" /> : <Copy size={10} className="text-white/60" />}
                </button>
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Code2 size={15} className="text-purple-600" />
                <p className="text-sm font-semibold">Available Endpoints</p>
              </div>
              <div className="space-y-2">
                {[
                  { method: "GET", path: "/v1/farmers", desc: "List all farmers in your network" },
                  { method: "GET", path: "/v1/farms", desc: "Farm details, crop, location, size" },
                  { method: "GET", path: "/v1/loans", desc: "Loan applications & status" },
                  { method: "GET", path: "/v1/vouchers", desc: "Input vouchers issued" },
                  { method: "POST", path: "/v1/webhooks", desc: "Receive event notifications" },
                ].map(ep => (
                  <div key={ep.path} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ep.method === "GET" ? "bg-blue-100 text-blue-700" : "bg-[#16a34a]/10 text-[#16a34a]"}`}>{ep.method}</span>
                    <code className="text-foreground text-[10px] font-mono flex-1">{ep.path}</code>
                    <span className="text-muted-foreground text-[9px]">{ep.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── FARMERS TAB (Farmers Connect only) ── */}
        {activeTab === "farmers" && (
          <>
            {/* Invitation link */}
            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus size={15} className="text-[#16a34a]" />
                <p className="text-sm font-semibold">Farmer Invitation Link</p>
              </div>
              <p className="text-muted-foreground text-xs mb-3">Share this link with farmers in your network. Their registrations will be automatically linked to your cooperative account.</p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5 border border-border">
                <Link size={12} className="text-muted-foreground flex-shrink-0" />
                <p className="text-muted-foreground text-[10px] font-mono flex-1 truncate">{inviteLink}</p>
                <button onClick={copyInviteLink}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-[#16a34a] text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold">
                  {inviteCopied ? <Check size={10} /> : <Copy size={10} />}
                  {inviteCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* CSV Import */}
            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={15} className="text-blue-600" />
                <p className="text-sm font-semibold">Bulk CSV Import</p>
              </div>
              <p className="text-blue-600 text-xs mb-3">Upload a CSV of your farmer members. Required columns: <code className="bg-blue-50 px-1 rounded">name, phone, county</code>. Optional: <code className="bg-blue-50 px-1 rounded">email, cropType</code>.</p>

              {csvSuccess ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                  <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-700 text-xs">{csvSuccess}</p>
                    <button onClick={() => setCsvSuccess(null)} className="text-green-600 text-[10px] underline mt-1">Import more</button>
                  </div>
                </div>
              ) : csvError ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-600 text-xs">{csvError}</p>
                    <button onClick={() => { setCsvError(null); setCsvData(null); if (csvRef.current) csvRef.current.value = ""; }} className="text-red-500 text-[10px] underline mt-1">Try again</button>
                  </div>
                </div>
              ) : csvData ? (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-blue-700 text-xs font-semibold">{csvData.rows.length} farmers found</p>
                    <p className="text-blue-600 text-[10px] mt-0.5">Columns: {csvData.headers.join(", ")}</p>
                    <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                      {csvData.rows.slice(0, 3).map((row, i) => (
                        <p key={i} className="text-blue-600 text-[10px] font-mono">{Object.values(row).slice(0, 3).join(" · ")}</p>
                      ))}
                      {csvData.rows.length > 3 && <p className="text-blue-400 text-[10px]">…and {csvData.rows.length - 3} more</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setCsvData(null); if (csvRef.current) csvRef.current.value = ""; }}
                      className="flex-1 border border-border text-foreground text-xs font-semibold py-2.5 rounded-xl">
                      Cancel
                    </button>
                    <button onClick={importCSV} disabled={csvImporting}
                      className="flex-1 bg-[#16a34a] text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5">
                      {csvImporting ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                      {csvImporting ? "Importing…" : `Import ${csvData.rows.length} Farmers`}
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-blue-200 rounded-xl p-6 cursor-pointer hover:bg-blue-50 transition-colors">
                  <Upload size={18} className="text-blue-400" />
                  <span className="text-blue-600 text-sm font-medium">Click to upload CSV</span>
                  <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
                </label>
              )}
            </div>

            {/* Linked farmers list — from real API */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Your Network ({farmersLoading ? "…" : networkFarmers.length})
                </p>
                <span className="text-[9px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  {networkFarmers.filter(f => f.funded).length} funded
                </span>
              </div>
              {farmersLoading ? (
                <div className="space-y-2">{Array(4).fill(0).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
              ) : networkFarmers.length === 0 ? (
                <div className="text-center py-8 bg-white border border-border rounded-2xl">
                  <Users size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm font-medium">No farmers in your network yet</p>
                  <p className="text-muted-foreground text-xs mt-1">Share your invitation link or import via CSV above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {networkFarmers.map(f => (
                    <motion.div key={f.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-border rounded-2xl p-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#16a34a]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-[#16a34a]">{f.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-xs font-bold truncate">{f.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MapPin size={9} className="text-muted-foreground" />
                          <span className="text-muted-foreground text-[9px]">{f.county}</span>
                          <span className="text-border/60">·</span>
                          <span className="text-muted-foreground text-[9px]">Joined {f.joined}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full block mb-1 ${f.status === "active" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {f.status === "active" ? "Active" : "Pending"}
                        </span>
                        {f.funded && <span className="text-[8px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Funded</span>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── ORDERS / VOUCHER TAB (Input Provider only) ── */}
        {activeTab === "orders" && (
          <VoucherRedemptionTab token={token ?? ""} />
        )}

        {/* ── LAST-MILE DELIVERY TAB (Input Provider only) ── */}
        {activeTab === "delivery" && (
          <LastMileDeliveryTab />
        )}

        {/* ── CO-INVEST TAB (Farmers Connect only) ── */}
        {activeTab === "coinvest" && (
          <>
            <div className="bg-gradient-to-br from-[#052e16] to-[#166534] rounded-2xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Handshake size={16} className="text-green-300" />
                <p className="text-sm font-bold">Co-investment Programs</p>
              </div>
              <p className="text-white/70 text-xs leading-relaxed">
                As a verified cooperative partner, you can co-fund farm seasons alongside Investa Farm's investor network. Pool your members' savings to invest in larger farm opportunities and earn proportional returns of <strong className="text-green-300">18–28% per season</strong>.
              </p>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4">
              <p className="text-sm font-semibold mb-3">How Co-Investment Works</p>
              <div className="space-y-3">
                {[
                  { icon: "🏦", title: "Pool Member Savings", desc: "Aggregate savings from your SACCO or cooperative members into a single investment pool" },
                  { icon: "🌾", title: "Choose Farm Seasons", desc: "Browse available farm listings and select seasons that match your risk profile and return expectations" },
                  { icon: "📈", title: "Earn as a Group", desc: "Receive proportional dividends distributed to each member based on their contribution" },
                  { icon: "🔒", title: "Secured by Escrow", desc: "All co-investments are held in escrow until the farm season completes, ensuring accountability" },
                ].map(step => (
                  <div key={step.title} className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{step.icon}</span>
                    <div>
                      <p className="text-foreground text-sm font-semibold">{step.title}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Co-investment application */}
            {coinvestSubmitted ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={28} className="text-green-600" />
                </div>
                <p className="text-green-700 font-bold text-sm">Application Submitted!</p>
                <p className="text-green-800 font-mono text-[10px] mt-1 mb-2">{coinvestSubmitted.referenceId}</p>
                <p className="text-green-600 text-xs">Our team will review within 2 business days.</p>
                <div className="mt-3 bg-green-100 rounded-xl p-3">
                  <p className="text-green-700 text-xs font-semibold">Estimated Return</p>
                  <p className="text-green-800 font-bold text-sm mt-0.5">KES {coinvestSubmitted.estimatedReturn}</p>
                </div>
                <button onClick={() => { setCoinvestSubmitted(null); setCoinvestFarm(""); setCoinvestAmount(""); setCoinvestMemberCount(""); setCoinvestNotes(""); }}
                  className="mt-3 text-[#16a34a] text-xs font-semibold underline">
                  Submit Another Application
                </button>
              </div>
            ) : (
              <div className="bg-white border border-border rounded-2xl p-4">
                <p className="text-sm font-semibold mb-3">Apply for Co-Investment</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">Farm / Crop Type *</label>
                    <input type="text" value={coinvestFarm} onChange={e => setCoinvestFarm(e.target.value)}
                      placeholder="e.g. Maize, Nakuru County"
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#16a34a]" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">Investment Amount (KES) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">KES</span>
                      <input type="number" value={coinvestAmount} onChange={e => setCoinvestAmount(e.target.value)}
                        placeholder="100,000" min="10000"
                        className="w-full border border-border rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#16a34a]" />
                    </div>
                    <p className="text-muted-foreground text-[10px] mt-1">Minimum KES 10,000</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">Number of Contributing Members</label>
                    <input type="number" value={coinvestMemberCount} onChange={e => setCoinvestMemberCount(e.target.value)}
                      placeholder="e.g. 45"
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#16a34a]" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">Additional Notes</label>
                    <textarea value={coinvestNotes} onChange={e => setCoinvestNotes(e.target.value)}
                      placeholder="Any additional information about your cooperative or investment preference…"
                      rows={3}
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#16a34a] resize-none" />
                  </div>
                  {coinvestError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                      <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                      <p className="text-red-600 text-xs">{coinvestError}</p>
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      const amt = parseFloat(coinvestAmount);
                      if (!coinvestFarm || !amt || amt < 10000) { setCoinvestError("Please enter a farm description and at least KES 10,000."); return; }
                      setCoinvestSubmitting(true); setCoinvestError(null);
                      try {
                        const r = await fetch("/api/cooperative/coinvest", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ farmDescription: coinvestFarm, amountKes: amt, memberCount: parseInt(coinvestMemberCount) || undefined, notes: coinvestNotes }),
                        });
                        const d = await r.json();
                        if (!r.ok) throw new Error(d.error ?? "Submission failed");
                        setCoinvestSubmitted({ referenceId: d.referenceId, estimatedReturn: d.estimatedReturn });
                      } catch (e) {
                        setCoinvestError((e as Error).message);
                      } finally {
                        setCoinvestSubmitting(false);
                      }
                    }}
                    disabled={!coinvestFarm || !coinvestAmount || coinvestSubmitting}
                    className="w-full bg-[#16a34a] text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                    {coinvestSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Handshake size={14} />}
                    {coinvestSubmitting ? "Submitting…" : "Submit Co-Investment Application"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-200 z-[60]">
        <div className={`grid h-16 ${NAV_TABS.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
          {NAV_TABS.map(({ id, label, emoji }) => (
            <button key={id} onClick={() => goTab(id)}
              className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${activeTab === id ? (isInputProvider ? "text-blue-600" : "text-[#16a34a]") : "text-gray-400"}`}>
              <span className={`text-lg leading-none ${activeTab === id ? "scale-110" : ""} transition-transform`}>{emoji}</span>
              <span className="text-[9px] font-semibold">{label}</span>
              {activeTab === id && (
                <span className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${isInputProvider ? "bg-blue-600" : "bg-[#16a34a]"}`} />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
