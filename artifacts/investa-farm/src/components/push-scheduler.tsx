/**
 * Push notification scheduler.
 * Fires native phone notifications via the service worker's showNotification()
 * when the user has granted permission. Falls back silently if not granted.
 * Never shows in-app banners — those are handled separately for real-time events.
 */
import { useEffect } from "react";
import { getToken, getStoredUser } from "@/lib/auth";

interface NotifTemplate {
  type: string;
  title: string;
  body?: string;
  amount?: number;
  url?: string;
}

const FARM_NAMES = [
  "Wanjiku Tea Estate", "Kiambu Avocado Orchards", "Meru Macadamia Farm",
  "Narok Sunflower Collective", "Laikipia Coffee Highlands", "Nakuru Dairy Co-op",
  "Kericho Wheat Fields", "Murang'a French Beans", "Nandi Hills Tea Cooperative",
  "Taita Hills Mango Orchards", "Kisii Passion Collective", "Isiolo Camel Milk Farm",
  "Trans Nzoia Maize Collective", "Nyeri Apple Farm", "Kakamega Sugarcane Estate",
];

const CROP_TYPES = [
  "tea", "avocado", "macadamia", "coffee", "maize", "wheat",
  "french beans", "mangoes", "passion fruit", "sunflower",
];

function randomFarm() { return FARM_NAMES[Math.floor(Math.random() * FARM_NAMES.length)]; }
function randomCrop() { return CROP_TYPES[Math.floor(Math.random() * CROP_TYPES.length)]; }
function randomAmount(min: number, max: number) { return Math.round((Math.random() * (max - min) + min) / 100) * 100; }
function randomReturn() { return (8 + Math.random() * 22).toFixed(1); }
function randomInvestors() { return Math.floor(12 + Math.random() * 180); }
function randomPercent(min = 1, max = 8) { return (Math.random() * (max - min) + min).toFixed(1); }

function buildTemplate(): NotifTemplate {
  const farm = randomFarm();
  const crop = randomCrop();
  const pool: NotifTemplate[] = [
    {
      type: "harvest_payout",
      title: `${farm} paid harvest returns`,
      body: `Your investment in ${crop} yielded a ${randomReturn()}% return this season. Funds credited to wallet.`,
      amount: randomAmount(2200, 18000),
      url: "/portfolio",
    },
    {
      type: "new_listing",
      title: `New opportunity: ${farm}`,
      body: `${crop.charAt(0).toUpperCase() + crop.slice(1)} listing just opened with projected ${randomReturn()}% return. ${randomInvestors()} investors already in.`,
      url: "/market/primary",
    },
    {
      type: "farm_funded",
      title: `🎉 ${farm} fully funded!`,
      body: `${randomInvestors()} investors raised the full target. Farming operations begin next week.`,
      url: "/market/primary",
    },
    {
      type: "price_alert",
      title: `${crop.charAt(0).toUpperCase() + crop.slice(1)} shares up ${randomPercent(3, 9)}%`,
      body: `${farm} secondary market shares are rising. Consider your position.`,
      url: "/market/secondary",
    },
    {
      type: "dividend_paid",
      title: `Mid-season bonus paid`,
      body: `${farm} distributed an early dividend. Check your wallet.`,
      amount: randomAmount(800, 6500),
      url: "/portfolio",
    },
    {
      type: "farm_update",
      title: `Field update from ${farm}`,
      body: `Crop health report: ${crop} canopy at 92% cover. Projected yield on track.`,
      url: "/portfolio",
    },
    {
      type: "order_filled",
      title: `Your sell order was filled`,
      body: `Secondary market order completed at KES ${randomAmount(240, 380)}/share.`,
      amount: randomAmount(1200, 12000),
      url: "/market/secondary",
    },
    {
      type: "investment",
      title: `Portfolio milestone reached`,
      body: `Your total farmland holdings just crossed KES ${randomAmount(50000, 500000).toLocaleString("en-KE")}. 🎯`,
      url: "/portfolio",
    },
    {
      type: "price_alert",
      title: `Avocado demand surge in EU market`,
      body: `Export prices up ${randomPercent(4, 12)}% — Kenyan avocado farms benefit directly.`,
      url: "/market/secondary",
    },
    {
      type: "farm_update",
      title: `Rain forecast: ${farm}`,
      body: `MET Kenya forecasts 45mm rainfall this week — optimal for ${crop} growth.`,
    },
    {
      type: "general",
      title: `${randomInvestors()} new investors this week`,
      body: `Investa Farm community keeps growing. Refer friends and earn KES 500 per referral.`,
      url: "/profile",
    },
    {
      type: "harvest_payout",
      title: `Quarterly harvest cycle complete`,
      body: `${farm} closed its Q${Math.ceil(new Date().getMonth() / 3)} cycle. Average investor ROI: ${randomReturn()}%.`,
      amount: randomAmount(4000, 22000),
      url: "/portfolio",
    },
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

async function firePhoneNotification(tpl: NotifTemplate) {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const body = tpl.amount
      ? `KES ${tpl.amount.toLocaleString("en-KE")} · ${tpl.body ?? ""}`
      : (tpl.body ?? "");

    await registration.showNotification(`Investa Farm`, {
      body: `${tpl.title}${body ? `\n${body}` : ""}`,
      icon: "/logo.png",
      badge: "/favicon.png",
      tag: `investa-${tpl.type}-${Date.now()}`,
      data: { url: tpl.url ?? "/" },
      vibrate: [150, 50, 150],
      silent: false,
    } as NotificationOptions);
  } catch {
    // Permission revoked mid-session or SW not ready — ignore
  }
}

const MIN_INTERVAL_MS = 45_000;
const MAX_INTERVAL_MS = 110_000;
function randomDelay() { return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS); }

export function PushScheduler() {
  useEffect(() => {
    const token = getToken();
    const user = getStoredUser() as any;
    if (!token || !user) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const fire = () => {
      const tpl = buildTemplate();
      firePhoneNotification(tpl);
      timeoutId = setTimeout(fire, randomDelay());
    };

    const initialDelay = 18_000 + Math.random() * 12_000;
    timeoutId = setTimeout(fire, initialDelay);

    return () => clearTimeout(timeoutId);
  }, []);

  return null;
}
