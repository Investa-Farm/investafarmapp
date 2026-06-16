import { useEffect, useRef } from "react";
import { getToken, getStoredUser } from "@/lib/auth";
import { toast } from "sonner";

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  createdAt: string;
};

const SEEN_KEY = "investa_seen_notif_ids";

function getSeenIds(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch { return new Set(); }
}

function markSeen(ids: number[]) {
  try {
    const existing = getSeenIds();
    ids.forEach(id => existing.add(id));
    const arr = Array.from(existing);
    if (arr.length > 200) arr.splice(0, arr.length - 200);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch { /* silent */ }
}

export function PriceAlertWatcher() {
  const token = getToken();
  const user = getStoredUser();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token || !user) return;

    const poll = async () => {
      try {
        const r = await fetch("/api/notifications?limit=20", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data: Notification[] = await r.json();
        const seen = getSeenIds();
        const fresh = data.filter(n => !seen.has(n.id) && n.type === "price_alert");
        if (fresh.length > 0) {
          markSeen(fresh.map(n => n.id));
          fresh.forEach(n => {
            toast(n.title, {
              description: n.body,
              duration: 6000,
              icon: "📈",
              classNames: {
                toast: "!bg-white !border-green-200 !shadow-xl !rounded-2xl",
                title: "!font-bold !text-foreground !text-sm",
                description: "!text-muted-foreground !text-xs",
              },
            });
          });
        }
        const allNew = data.filter(n => !seen.has(n.id));
        if (allNew.length > 0) markSeen(allNew.map(n => n.id));
      } catch { /* silent */ }
    };

    setTimeout(poll, 3000);
    intervalRef.current = setInterval(poll, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, user?.id]);

  return null;
}
