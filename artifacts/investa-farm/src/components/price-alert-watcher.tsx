import { useEffect, useRef } from "react";
import { getToken, getStoredUser } from "@/lib/auth";
import { showRichNotification, RichNotifType } from "@/components/rich-push-notification";

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

function richTypeFromNotif(type: string): RichNotifType {
  const map: Record<string, RichNotifType> = {
    investment: "investment",
    investment_made: "investment",
    deposit: "deposit",
    wallet_funded: "deposit",
    wallet_credit: "deposit",
    return: "harvest_payout",
    harvest_payout: "harvest_payout",
    harvest: "harvest_payout",
    dividend_paid: "dividend_paid",
    dividend: "dividend_paid",
    withdrawal: "withdrawal",
    farm_fully_funded: "farm_funded",
    price_alert: "price_alert",
    kyc_approved: "kyc_approved",
    kyc_rejected: "kyc_rejected",
    loan_approved: "loan_approved",
    new_listing: "new_listing",
    order_filled: "order_filled",
    farm_update: "farm_update",
  };
  return map[type] ?? "general";
}

function extractAmount(body: string): number {
  const m = body.match(/KES\s*([\d,]+(\.\d+)?)/i) ?? body.match(/([\d,]+(\.\d+)?)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/,/g, ""));
}

function urlFromNotif(type: string): string {
  if (type === "investment" || type === "investment_made") return "/portfolio";
  if (type === "deposit" || type === "wallet_funded" || type === "wallet_credit") return "/wallet";
  if (type === "harvest_payout" || type === "harvest" || type === "return") return "/portfolio";
  if (type === "dividend_paid" || type === "dividend") return "/portfolio";
  if (type === "withdrawal") return "/activity";
  if (type === "price_alert") return "/market";
  if (type === "kyc_approved" || type === "kyc_rejected") return "/profile";
  if (type === "loan_approved") return "/farmer/loans";
  if (type === "new_listing") return "/market/primary";
  if (type === "farm_update") return "/portfolio";
  if (type === "order_filled") return "/market/secondary";
  return "/";
}

export function PriceAlertWatcher() {
  const token = getToken();
  const user = getStoredUser();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirstPollRef = useRef(true);

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

        if (fresh.length === 0) return;

        // On first poll: silently mark all existing notifications as seen
        // so we don't flood the screen with accumulated old alerts.
        if (isFirstPollRef.current) {
          isFirstPollRef.current = false;
          markSeen(fresh.map(n => n.id));
          return;
        }

        isFirstPollRef.current = false;
        markSeen(fresh.map(n => n.id));

        // Only show up to 2 notifications per poll to avoid flooding
        const toShow = fresh.slice(0, 2);

        for (const n of toShow) {
          const richType = richTypeFromNotif(n.type);
          const amount = extractAmount(n.body);

          showRichNotification({
            type: richType,
            title: n.title,
            body: n.body.length > 80 ? n.body.slice(0, 80) + "…" : n.body,
            amount: amount > 0 ? amount : undefined,
            url: urlFromNotif(n.type),
            durationMs: 8000,
          });

          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const typeEmojis: Record<string, string> = {
                investment_made: "💰", price_alert: "📊", harvest_payout: "🌾",
                dividend_paid: "💸", dividend: "💸",
                wallet_credit: "💰", farm_fully_funded: "🎉", kyc_approved: "✅",
                kyc_rejected: "⚠️", loan_approved: "🏦", new_listing: "🌱",
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
        }
      } catch { /* silent */ }
    };

    // Delay first poll — after page settles
    setTimeout(poll, 5000);
    intervalRef.current = setInterval(poll, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, (user as any)?.id]);

  return null;
}
