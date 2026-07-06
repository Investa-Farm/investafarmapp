import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, BellRing, CheckCheck, Trash2, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { getToken, getStoredUser } from "@/lib/auth";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useLocation } from "wouter";

type Notif = {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

const TYPE_META: Record<string, { emoji: string; color: string; bg: string }> = {
  investment:        { emoji: "📈", color: "text-indigo-600", bg: "bg-indigo-50" },
  investment_made:   { emoji: "📈", color: "text-indigo-600", bg: "bg-indigo-50" },
  deposit:           { emoji: "💰", color: "text-green-600",  bg: "bg-green-50"  },
  wallet_funded:     { emoji: "💰", color: "text-green-600",  bg: "bg-green-50"  },
  wallet_credit:     { emoji: "💰", color: "text-green-600",  bg: "bg-green-50"  },
  withdrawal:        { emoji: "🏧", color: "text-red-500",    bg: "bg-red-50"    },
  harvest_payout:    { emoji: "🌾", color: "text-amber-600",  bg: "bg-amber-50"  },
  harvest:           { emoji: "🌾", color: "text-amber-600",  bg: "bg-amber-50"  },
  dividend_paid:     { emoji: "💸", color: "text-amber-700",  bg: "bg-amber-50"  },
  dividend:          { emoji: "💸", color: "text-amber-700",  bg: "bg-amber-50"  },
  price_alert:       { emoji: "📊", color: "text-sky-600",    bg: "bg-sky-50"    },
  kyc_approved:      { emoji: "✅", color: "text-green-600",  bg: "bg-green-50"  },
  kyc_rejected:      { emoji: "⚠️", color: "text-red-500",   bg: "bg-red-50"    },
  loan_approved:     { emoji: "🏦", color: "text-indigo-600", bg: "bg-indigo-50" },
  new_listing:       { emoji: "🌱", color: "text-green-600",  bg: "bg-green-50"  },
  farm_fully_funded: { emoji: "🎉", color: "text-green-600",  bg: "bg-green-50"  },
  order_filled:      { emoji: "✅", color: "text-green-600",  bg: "bg-green-50"  },
  farm_update:       { emoji: "🌿", color: "text-emerald-600", bg: "bg-emerald-50" },
  general:           { emoji: "🔔", color: "text-gray-500",   bg: "bg-gray-100"  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-KE", { month: "short", day: "numeric" });
}

function PushEnableBanner({ onSubscribed }: { onSubscribed: () => void }) {
  const { status, subscribe } = usePushNotifications();
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("investa_notif_banner_dismissed") === "1"
  );

  if (status === "subscribed" || status === "granted" || status === "denied" || status === "unsupported" || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    setLoading(true);
    const ok = await subscribe();
    if (ok) {
      localStorage.setItem("investa_notif_pref", "granted");
      onSubscribed();
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-4 rounded-2xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #16a34a 100%)" }}
    >
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <BellRing size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">Enable push notifications</p>
            <p className="text-white/70 text-xs mt-0.5">Get instant alerts for payouts, price moves & farm activity</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleEnable}
            disabled={loading}
            className="flex-1 py-2.5 bg-white rounded-xl text-green-700 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-70"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
            {loading ? "Enabling…" : "Enable Alerts"}
          </button>
          <button
            onClick={() => { setDismissed(true); localStorage.setItem("investa_notif_banner_dismissed", "1"); }}
            className="px-4 py-2.5 bg-white/15 rounded-xl text-white text-xs font-medium active:scale-95 transition-transform"
          >
            Later
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const SEEN_KEY = "investa_seen_notif_ids";

export default function FarmerNotifications() {
  const token = getToken();
  const user = getStoredUser();
  const [, setLocation] = useLocation();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifs = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const r = await fetch("/api/notifications?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data: Notif[] = await r.json();
        setNotifs(data);
        // Mark all as seen
        const seenRaw = localStorage.getItem(SEEN_KEY);
        const seen: Set<number> = seenRaw ? new Set(JSON.parse(seenRaw)) : new Set();
        data.forEach(n => seen.add(n.id));
        localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)));
      }
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchNotifs(); }, [token]);

  const markAllRead = async () => {
    if (!token) return;
    try {
      await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* silent */ }
  };

  const displayed = filter === "unread" ? notifs.filter(n => !n.read) : notifs;
  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-border sticky top-0 z-20">
        <div className="px-4 pt-12 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-gray-900">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">{unreadCount} unread</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchNotifs(true)}
                disabled={refreshing}
                className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition-transform disabled:opacity-50"
              >
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="h-9 px-3 rounded-xl border border-border flex items-center gap-1.5 text-xs font-medium text-muted-foreground active:scale-95 transition-transform"
                >
                  <CheckCheck size={13} /> All read
                </button>
              )}
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 mt-3">
            {(["all", "unread"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filter === f
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {f === "all" ? `All (${notifs.length})` : `Unread (${unreadCount})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Push enable banner */}
      <PushEnableBanner onSubscribed={() => {}} />

      {/* Notification list */}
      <div className="px-4 mt-4 space-y-2.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading notifications…</p>
          </div>
        ) : displayed.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <BellOff size={28} className="text-gray-400" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-700">No notifications yet</p>
              <p className="text-sm text-gray-400 mt-1">
                {filter === "unread" ? "You're all caught up!" : "Activity alerts will appear here"}
              </p>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence>
            {displayed.map((n, i) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.general;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`bg-white rounded-2xl border p-4 flex gap-3 items-start transition-all ${
                    n.read ? "border-border opacity-80" : "border-primary/20 shadow-sm"
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${meta.bg}`}>
                    {meta.emoji}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${n.read ? "font-medium text-gray-600" : "font-bold text-gray-900"}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                      {n.body}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <BottomNav role="farmer" />
    </div>
  );
}
