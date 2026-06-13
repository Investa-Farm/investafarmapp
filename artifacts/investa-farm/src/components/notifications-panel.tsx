import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, CheckCircle2, AlertCircle, FileCheck, DollarSign, Loader2, ShieldCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";

type Notif = {
  id: number;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

function typeIcon(type: string) {
  if (type.startsWith("kyc")) return <ShieldCheck size={16} className="text-blue-500" />;
  if (type === "investment") return <DollarSign size={16} className="text-green-500" />;
  if (type === "voucher") return <FileCheck size={16} className="text-orange-500" />;
  if (type.startsWith("kyc_rejected")) return <AlertCircle size={16} className="text-red-500" />;
  return <Bell size={16} className="text-primary" />;
}

function typeBg(type: string) {
  if (type === "kyc_approved") return "bg-green-50 border-green-200";
  if (type === "kyc_rejected") return "bg-red-50 border-red-200";
  if (type === "kyc_under_review") return "bg-blue-50 border-blue-200";
  if (type === "voucher") return "bg-orange-50 border-orange-200";
  return "bg-card border-border";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ open, onClose }: Props) {
  const token = getToken();
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notif[]>({
    queryKey: ["notifications"],
    enabled: open && !!token,
    queryFn: async () => {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: open ? 30000 : false,
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notifications/read/${id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/read-all", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: "85vh" }}
          >
            <div className="hero-header rounded-t-3xl px-5 pt-5 pb-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-lg flex items-center gap-2">
                    <Bell size={18} /> Notifications
                    {unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                    )}
                  </h2>
                  <p className="text-white/70 text-xs mt-0.5">Stay updated on your account activity</p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={() => markAllRead.mutate()}
                      className="text-white/80 text-xs border border-white/30 rounded-lg px-2.5 py-1 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Mark all read
                    </button>
                  )}
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <X size={16} className="text-white" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-2.5">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-primary" />
                </div>
              )}
              {!isLoading && notifications.length === 0 && (
                <div className="text-center py-12">
                  <Bell size={36} className="text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm font-medium">No notifications yet</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">We'll notify you about important account activity here.</p>
                </div>
              )}
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.isRead) markRead.mutate(n.id); }}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${typeBg(n.type)} ${!n.isRead ? "shadow-sm" : "opacity-70"}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                    {typeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground text-xs font-semibold">{n.title}</p>
                      {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                    </div>
                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-muted-foreground/50 text-[10px] mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
