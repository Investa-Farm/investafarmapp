import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, BellOff, Check, CheckCheck, Trash2, TrendingUp, TrendingDown, Sprout, DollarSign, AlertTriangle, Info, Zap, Newspaper, Gift, ShieldCheck, MessageSquare, Reply, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";

interface Notif {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  meta?: Record<string, unknown>;
}

function notifIcon(type: string) {
  const cls = "w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0";
  switch (type) {
    case "price_alert":        return <div className={`${cls} bg-amber-100 text-amber-600`}><TrendingUp size={16} /></div>;
    case "price_drop":         return <div className={`${cls} bg-red-100 text-red-500`}><TrendingDown size={16} /></div>;
    case "farm_update":        return <div className={`${cls} bg-green-100 text-[#16a34a]`}><Sprout size={16} /></div>;
    case "dividend":           return <div className={`${cls} bg-emerald-100 text-emerald-600`}><DollarSign size={16} /></div>;
    case "investment":         return <div className={`${cls} bg-blue-100 text-blue-600`}><Zap size={16} /></div>;
    case "kyc":                return <div className={`${cls} bg-purple-100 text-purple-600`}><ShieldCheck size={16} /></div>;
    case "news":               return <div className={`${cls} bg-sky-100 text-sky-600`}><Newspaper size={16} /></div>;
    case "reward":             return <div className={`${cls} bg-pink-100 text-pink-600`}><Gift size={16} /></div>;
    case "warning":            return <div className={`${cls} bg-red-100 text-red-500`}><AlertTriangle size={16} /></div>;
    case "admin_message":      return <div className={`${cls} bg-sky-100 text-sky-600`}><MessageSquare size={16} /></div>;
    case "admin_message_reply":return <div className={`${cls} bg-sky-100 text-sky-600`}><Reply size={16} /></div>;
    default:                   return <div className={`${cls} bg-gray-100 text-gray-500`}><Info size={16} /></div>;
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

const DEMO_NOTIFS: Notif[] = [
  { id: 9001, type: "dividend",    title: "Harvest Payout Received",        body: "KES 3,200 credited — Nakuru Maize Farm mid-season payout. Funds available in your wallet.",                    read: false, createdAt: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: 9002, type: "price_alert", title: "Maize Price Alert Triggered",    body: "Maize futures rose 4.2% — your alert threshold of 3% has been exceeded. Consider reviewing your position.", read: false, createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 9003, type: "farm_update", title: "Kibwezi Tomato Farm Update",     body: "Growth Stage: Flowering. Crop health score 89/100. Expected harvest on schedule — 14 Nov 2026.",             read: true,  createdAt: new Date(Date.now() - 6 * 3600000).toISOString() },
  { id: 9004, type: "investment",  title: "Shares Purchase Confirmed",      body: "50 shares in Meru Coffee Farm purchased at KES 450/share. Total invested: KES 22,500.",                       read: true,  createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: 9005, type: "kyc",         title: "KYC Documents Approved",         body: "Your identity verification is complete. You now have full access to all investment tiers.",                    read: true,  createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 9006, type: "news",        title: "Market Insight: Avocado Boom",   body: "Kenya avocado exports grew 22% YoY driven by EU demand. Farms with avocado exposure are up 18% ROI.",        read: true,  createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 9007, type: "reward",      title: "Referral Bonus Earned",          body: "You earned KES 500 for referring Jane Wambui. Keep sharing your link to earn more.",                          read: true,  createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 9008, type: "warning",     title: "Portfolio Risk Alert",           body: "2 of your holdings are in high-risk crop segments during the dry season. Consider reviewing exit options.",   read: true,  createdAt: new Date(Date.now() - 7 * 86400000).toISOString() },
];

const FILTER_TABS = [
  { id: "all",         label: "All" },
  { id: "unread",      label: "Unread" },
  { id: "dividend",    label: "Payouts" },
  { id: "price_alert", label: "Alerts" },
  { id: "farm_update", label: "Farm" },
  { id: "admin_message", label: "Messages" },
];

function AdminMessageReply({ notif, token }: { notif: Notif; token: string | null }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [msgId, setMsgId] = useState<number | null>(null);

  const qc = useQueryClient();

  const fetchMsgId = async () => {
    if (msgId) return msgId;
    try {
      const r = await fetch("/api/admin-messages/mine", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      const msgs = await r.json();
      const match = msgs.find((m: any) =>
        (notif.meta?.messageId && m.id === notif.meta.messageId) ||
        (m.subject && notif.title.includes(m.subject))
      );
      if (match) { setMsgId(match.id); return match.id; }
      // Fall back to latest message
      if (msgs.length > 0) { setMsgId(msgs[0].id); return msgs[0].id; }
    } catch {}
    return null;
  };

  const handleSend = async () => {
    if (!reply.trim() || !token) return;
    setSending(true);
    try {
      const id = await fetchMsgId();
      if (!id) { setSending(false); return; }
      const r = await fetch("/api/admin-messages/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageId: id, reply: reply.trim() }),
      });
      if (r.ok) {
        setSent(true);
        setReply("");
        setOpen(false);
        qc.invalidateQueries({ queryKey: ["notifications"] });
      }
    } finally {
      setSending(false);
    }
  };

  if (sent) return (
    <div className="mt-2 flex items-center gap-1.5 text-green-600 text-[10px] font-semibold">
      <Check size={11} /> Reply sent
    </div>
  );

  return (
    <div className="mt-2">
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full active:scale-95 transition-transform">
          <Reply size={10} /> Reply
        </button>
      ) : (
        <div className="mt-1 space-y-2" onClick={e => e.stopPropagation()}>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Type your reply…"
            rows={3}
            autoFocus
            className="w-full border border-sky-200 rounded-xl px-3 py-2 text-xs bg-sky-50 focus:outline-none focus:border-sky-400 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={handleSend} disabled={sending || !reply.trim()}
              className="flex-1 bg-sky-600 text-white text-xs font-bold py-2 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95">
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {sending ? "Sending…" : "Send Reply"}
            </button>
            <button onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-xl text-xs text-muted-foreground bg-muted">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [localRead, setLocalRead] = useState<Set<number>>(new Set());
  const [localDeleted, setLocalDeleted] = useState<Set<number>>(new Set());

  const { data: apiNotifs = [] } = useQuery<Notif[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const markReadMut = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const apiIds = new Set(apiNotifs.map(n => n.id));
  const isDemoUser = typeof window !== "undefined" &&
    !!localStorage.getItem("investa_token")?.includes("john.farmer") === false &&
    (() => { try { const u = JSON.parse(localStorage.getItem("investa_user") ?? "{}"); return u.email?.endsWith("investafarm.com") && (u.email?.startsWith("david") || u.email?.startsWith("john")); } catch { return false; } })();
  const merged: Notif[] = [
    ...apiNotifs,
    ...(isDemoUser ? DEMO_NOTIFS.filter(d => !apiIds.has(d.id)) : []),
  ].filter(n => !localDeleted.has(n.id));

  const displayed = merged
    .map(n => ({ ...n, read: n.read || localRead.has(n.id) }))
    .filter(n => {
      if (filter === "unread") return !n.read;
      if (filter === "all") return true;
      return n.type === filter || n.type.startsWith(filter);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = merged.filter(n => !n.read && !localRead.has(n.id)).length;

  const markAllRead = () => {
    const unreadIds = merged.filter(n => !n.read && !localRead.has(n.id)).map(n => n.id);
    setLocalRead(prev => new Set([...prev, ...unreadIds]));
    unreadIds.forEach(id => { if (id < 9000) markReadMut.mutate(id); });
  };

  const markOneRead = (n: Notif) => {
    if (!n.read && !localRead.has(n.id)) {
      setLocalRead(prev => new Set([...prev, n.id]));
      if (n.id < 9000) markReadMut.mutate(n.id);
    }
  };

  const deleteOne = (id: number) => setLocalDeleted(prev => new Set([...prev, id]));

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-gray-50 pb-24">
      {/* Header */}
      <div className="hero-header px-5 pt-12 pb-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/market")}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div>
              <p className="text-white/70 text-xs">Investa Farm</p>
              <h1 className="text-white font-bold text-lg">Notifications</h1>
            </div>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5">
              <CheckCheck size={13} className="text-white" />
              <span className="text-white text-[11px] font-semibold">Mark all read</span>
            </button>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="bg-white/10 rounded-2xl px-3 py-2 flex items-center gap-2">
            <Bell size={15} className="text-white" />
            <span className="text-white font-bold text-sm">{unreadCount}</span>
            <span className="text-white/70 text-xs">unread</span>
          </div>
          <div className="bg-white/10 rounded-2xl px-3 py-2 flex items-center gap-2">
            <Info size={15} className="text-white" />
            <span className="text-white font-bold text-sm">{displayed.length}</span>
            <span className="text-white/70 text-xs">total</span>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-3">
        {FILTER_TABS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === f.id
                ? "bg-[#16a34a] text-white border-transparent"
                : "bg-white text-gray-500 border-gray-200"
            }`}>
            {f.label}
            {f.id === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="px-4 space-y-2">
        <AnimatePresence>
          {displayed.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-16">
              <BellOff size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold text-sm">No notifications</p>
              <p className="text-gray-400 text-xs mt-1">
                {filter === "unread" ? "You're all caught up!" : "Nothing here yet."}
              </p>
            </motion.div>
          ) : (
            displayed.map((n) => {
              const isRead = n.read || localRead.has(n.id);
              const isAdminMsg = n.type === "admin_message" || n.type === "admin_message_reply";
              return (
                <motion.div key={n.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }}
                  layout
                  onClick={() => markOneRead(n)}
                  className={`flex gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${
                    !isRead
                      ? isAdminMsg
                        ? "bg-white border-sky-200 shadow-sm shadow-sky-50"
                        : "bg-white border-[#16a34a]/20 shadow-sm shadow-green-100"
                      : "bg-white/70 border-gray-100"
                  }`}>
                  {notifIcon(n.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!isRead ? "font-bold text-foreground" : "font-medium text-gray-700"}`}>
                        {n.title}
                      </p>
                      {!isRead && (
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${isAdminMsg ? "bg-sky-500" : "bg-[#16a34a]"}`} />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-3">{n.body}</p>

                    {/* Admin message reply UI */}
                    {n.type === "admin_message" && (
                      <AdminMessageReply notif={n} token={token} />
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-gray-400 font-medium">{timeAgo(n.createdAt)}</span>
                      <div className="flex items-center gap-1.5">
                        {!isRead && (
                          <button onClick={e => { e.stopPropagation(); markOneRead(n); }}
                            className="flex items-center gap-1 text-[9px] font-bold text-[#16a34a] bg-green-50 px-2 py-0.5 rounded-full">
                            <Check size={9} />
                            Read
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); deleteOne(n.id); }}
                          className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <BottomNav role="investor" />
    </div>
  );
}
