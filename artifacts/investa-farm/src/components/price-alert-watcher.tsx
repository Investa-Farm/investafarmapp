import { useEffect, useRef } from "react";
import { getToken, getStoredUser } from "@/lib/auth";
import { showTransactionToast, TxType } from "@/components/transaction-notification";
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

function txTypeFromNotif(type: string): TxType | null {
  if (type === "investment") return "investment";
  if (type === "deposit" || type === "wallet_funded") return "deposit";
  if (type === "return" || type === "harvest_payout" || type === "harvest") return "return";
  if (type === "withdrawal") return "withdrawal";
  return null;
}

function extractAmount(body: string): number {
  const m = body.match(/KES\s*([\d,]+(\.\d+)?)/i) ?? body.match(/([\d,]+(\.\d+)?)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/,/g, ""));
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
        const fresh = data.filter(n => !seen.has(n.id));

        if (fresh.length > 0) {
          markSeen(fresh.map(n => n.id));

          for (const n of fresh) {
            const txType = txTypeFromNotif(n.type);

            // Fire a real device push notification if the app is in the foreground
            // (background push comes from the service worker; this covers the foreground gap)
            if ("Notification" in window && Notification.permission === "granted") {
              try {
                const typeEmojis: Record<string, string> = {
                  investment_made: "💰", price_alert: "📈", harvest_payout: "💵",
                  wallet_credit: "💰", farm_fully_funded: "🎉", kyc_approved: "✅",
                  kyc_rejected: "⚠️", loan_approved: "🏦", new_listing: "🌾",
                  order_filled: "✅", withdrawal: "🏧",
                };
                const emoji = typeEmojis[n.type] ?? "🔔";
                new Notification(`${emoji} ${n.title}`, {
                  body: n.body,
                  icon: "/logo.png",
                  badge: "/favicon.png",
                  tag: `investa-${n.id}`,
                });
              } catch { /* non-critical */ }
            }

            if (txType) {
              // Rich Binance-style transaction notification
              const amount = extractAmount(n.body);
              showTransactionToast({
                type: txType,
                amount: amount > 0 ? amount : n.title,
                status: "credited",
                subtitle: n.body.length > 60 ? n.body.slice(0, 60) + "…" : n.body,
                durationMs: 7000,
              });
            } else if (n.type === "price_alert") {
              // Standard price alert toast
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
            } else {
              // Generic app notification
              toast(n.title, {
                description: n.body,
                duration: 5000,
                icon: "🔔",
                classNames: {
                  toast: "!bg-white !border-border !shadow-xl !rounded-2xl",
                  title: "!font-bold !text-foreground !text-sm",
                  description: "!text-muted-foreground !text-xs",
                },
              });
            }
          }
        }
      } catch { /* silent */ }
    };

    setTimeout(poll, 3000);
    intervalRef.current = setInterval(poll, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, (user as any)?.id]);

  return null;
}
