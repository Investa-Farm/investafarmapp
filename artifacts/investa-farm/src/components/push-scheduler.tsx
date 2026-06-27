/**
 * Random push notification scheduler.
 * Mounts once in App.tsx. Fires showRichNotification() at random intervals
 * with varied, realistic Kenyan agri-finance content.
 * Only active when a user is authenticated.
 */
import { useEffect } from "react";
import { getToken, getStoredUser } from "@/lib/auth";
import { showRichNotification, RichNotifType } from "@/components/rich-push-notification";

interface NotifTemplate {
  type: RichNotifType;
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

function randomFarm() {
  return FARM_NAMES[Math.floor(Math.random() * FARM_NAMES.length)];
}
function randomCrop() {
  return CROP_TYPES[Math.floor(Math.random() * CROP_TYPES.length)];
}
function randomAmount(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) / 100) * 100;
}
function randomReturn() {
  return (8 + Math.random() * 22).toFixed(1);
}
function randomInvestors() {
  return Math.floor(12 + Math.random() * 180);
}
function randomPercent(min = 1, max = 8) {
  return (Math.random() * (max - min) + min).toFixed(1);
}

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
      body: `Secondary market order for ${randomAmount(500, 5000) / 100} shares at KES ${randomAmount(240, 380)} each completed.`,
      amount: randomAmount(1200, 12000),
      url: "/market/secondary",
    },
    {
      type: "investment",
      title: `Portfolio milestone reached`,
      body: `Your total farmland holdings just crossed KES ${(randomAmount(50000, 500000)).toLocaleString("en-KE")}. 🎯`,
      url: "/portfolio",
    },
    {
      type: "price_alert",
      title: `Avocado demand surge in EU market`,
      body: `Export prices up ${randomPercent(4, 12)}% — Kenyan avocado farms benefit directly. ${farm} highlighted.`,
      url: "/market/secondary",
    },
    {
      type: "farm_update",
      title: `Rain forecast: ${farm}`,
      body: `MET Kenya forecasts 45mm rainfall this week in the region — optimal for ${crop} growth.`,
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
    {
      type: "farm_funded",
      title: `Fast-fill alert: ${farm}`,
      body: `Only ${Math.floor(Math.random() * 20 + 5)}% of shares remain. ${randomInvestors()} investors watching this listing.`,
      url: "/market/primary",
    },
    {
      type: "price_alert",
      title: `Market closes in 2 hours`,
      body: `Secondary market settlement window closes at 18:00 EAT. Review your open orders.`,
      url: "/market/secondary",
    },
    {
      type: "general",
      title: `Weekly portfolio digest`,
      body: `Your farmland portfolio performance: +${randomPercent(1, 5)}% this week. ${randomFarm()} leads.`,
      url: "/portfolio",
    },
  ];

  return pool[Math.floor(Math.random() * pool.length)];
}

const MIN_INTERVAL_MS = 45_000;
const MAX_INTERVAL_MS = 110_000;

function randomDelay() {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
}

export function PushScheduler() {
  useEffect(() => {
    const token = getToken();
    const user = getStoredUser() as any;
    if (!token || !user) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const fire = () => {
      const tpl = buildTemplate();
      showRichNotification({
        type: tpl.type,
        title: tpl.title,
        body: tpl.body,
        amount: tpl.amount,
        url: tpl.url,
        durationMs: 9000,
      });
      timeoutId = setTimeout(fire, randomDelay());
    };

    const initialDelay = 18_000 + Math.random() * 12_000;
    timeoutId = setTimeout(fire, initialDelay);

    return () => clearTimeout(timeoutId);
  }, []);

  return null;
}
