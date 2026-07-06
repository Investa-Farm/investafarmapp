import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { useLocation } from "wouter";
import { ArrowLeft, Package, CheckCircle2, Clock, XCircle, Loader2, MapPin, Phone, User, FileCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type VoucherOrder = {
  id: number;
  farmerName: string;
  farmerPhone?: string;
  farmerLocation?: string;
  voucherCode: string;
  amount: number;
  items: string[];
  status: "pending" | "fulfilled" | "cancelled";
  createdAt: string;
};

function statusBadge(status: string) {
  if (status === "fulfilled") return <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={9} /> Fulfilled</span>;
  if (status === "cancelled") return <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1"><XCircle size={9} /> Cancelled</span>;
  return <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={9} /> Pending</span>;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AgribusinessOrders() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const qc = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<VoucherOrder | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "fulfilled">("all");

  const { data: orders = [], isLoading } = useQuery<VoucherOrder[]>({
    queryKey: ["voucher-orders"],
    queryFn: async () => {
      const r = await fetch("/api/agribusiness/voucher-orders", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const fulfil = useMutation({
    mutationFn: async (orderId: number) => {
      const r = await fetch(`/api/agribusiness/voucher-orders/${orderId}/fulfil`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed to fulfil order");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voucher-orders"] });
      setSelectedOrder(null);
    },
  });

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const pendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <div className="app-shell pb-6 page-enter">
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setLocation("/agribusiness")}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <h1 className="text-white font-bold text-xl">Voucher Orders</h1>
            <p className="text-white/70 text-xs">
              {pendingCount > 0 ? `${pendingCount} pending order${pendingCount > 1 ? "s" : ""} to fulfil` : "All orders up to date"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "fulfilled"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${filter === f ? "bg-white text-foreground" : "bg-white/20 text-white"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {isLoading && <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-primary" /></div>}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16">
            <Package size={40} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No {filter !== "all" ? filter : ""} orders yet</p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              When farmers in your area redeem vouchers at your business, they'll appear here.
            </p>
          </div>
        )}

        {filtered.map(order => (
          <button key={order.id} onClick={() => setSelectedOrder(order)}
            className="w-full flex items-start gap-3 bg-card rounded-2xl border border-border p-4 text-left active:scale-98 transition-transform">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              order.status === "fulfilled" ? "bg-green-100" : order.status === "cancelled" ? "bg-red-100" : "bg-amber-100"
            }`}>
              <Package size={18} className={
                order.status === "fulfilled" ? "text-green-600" : order.status === "cancelled" ? "text-red-500" : "text-amber-600"
              } />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm">{order.farmerName}</p>
                {statusBadge(order.status)}
              </div>
              <p className="text-muted-foreground text-xs mt-0.5">Voucher: <span className="font-mono font-bold">{order.voucherCode}</span></p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-green-600 font-bold text-xs">KES {order.amount.toLocaleString()}</span>
                <span className="text-muted-foreground text-[10px]">{timeAgo(order.createdAt)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Order detail popup */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl"
            >
              <div className="hero-header rounded-t-3xl px-5 pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-bold text-lg">Voucher Order</h3>
                    <p className="text-white/70 text-xs font-mono">{selectedOrder.voucherCode}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <XCircle size={15} className="text-white" />
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><User size={14} className="text-muted-foreground" /></div>
                    <div><p className="text-xs text-muted-foreground">Farmer</p><p className="font-semibold text-sm">{selectedOrder.farmerName}</p></div>
                  </div>
                  {selectedOrder.farmerPhone && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><Phone size={14} className="text-muted-foreground" /></div>
                      <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-semibold text-sm">{selectedOrder.farmerPhone}</p></div>
                    </div>
                  )}
                  {selectedOrder.farmerLocation && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><MapPin size={14} className="text-muted-foreground" /></div>
                      <div><p className="text-xs text-muted-foreground">Location</p><p className="font-semibold text-sm">{selectedOrder.farmerLocation}</p></div>
                    </div>
                  )}
                </div>

                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <p className="text-green-700 text-xs font-medium mb-2">Voucher Value</p>
                  <p className="text-green-800 font-bold text-2xl">KES {selectedOrder.amount.toLocaleString()}</p>
                  {selectedOrder.items?.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {selectedOrder.items.map((item, i) => (
                        <p key={i} className="text-green-700 text-xs">• {item}</p>
                      ))}
                    </div>
                  )}
                </div>

                {selectedOrder.status === "pending" && (
                  <div className="space-y-2">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-amber-700 text-xs leading-relaxed">
                        Ask the farmer to show you this voucher code: <strong className="font-mono">{selectedOrder.voucherCode}</strong>. Verify it matches before dispensing inputs.
                      </p>
                    </div>
                    <button
                      onClick={() => fulfil.mutate(selectedOrder.id)}
                      disabled={fulfil.isPending}
                      className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {fulfil.isPending ? <Loader2 size={16} className="animate-spin" /> : <FileCheck size={16} />}
                      {fulfil.isPending ? "Marking as Fulfilled…" : "Mark as Fulfilled"}
                    </button>
                  </div>
                )}

                {selectedOrder.status === "fulfilled" && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-green-600" />
                    <p className="text-green-700 text-sm font-semibold">Order fulfilled — payment will be processed</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
