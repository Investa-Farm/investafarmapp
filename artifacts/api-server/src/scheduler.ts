import cron from "node-cron";
import { db, usersTable, farmsTable, investmentsTable, marketListingsTable } from "@workspace/db";
import { eq, inArray, lt, and } from "drizzle-orm";
import { sendOpportunityDigest, sendPriceAlertEmail, sendVerificationReminderEmail } from "./lib/email";
import { notifyMany } from "./lib/push";

export function startScheduler(): void {
  // Monday 8:00 AM EAT — Weekly opportunity digest
  cron.schedule("0 8 * * 1", () => runOpportunityDigest("Monday morning"), {
    timezone: "Africa/Nairobi",
  });

  // Friday 6:00 PM EAT — Weekly opportunity digest
  cron.schedule("0 18 * * 5", () => runOpportunityDigest("Friday evening"), {
    timezone: "Africa/Nairobi",
  });

  // Every 5 minutes — simulate price movements (demo env)
  cron.schedule("*/5 * * * *", () => runPriceSimulation(), {
    timezone: "Africa/Nairobi",
  });

  // Every 5 minutes — check for >5% price changes and alert investors
  cron.schedule("*/5 * * * *", () => runPriceAlertCheck(), {
    timezone: "Africa/Nairobi",
  });

  // Daily 10:00 AM EAT — remind unverified users (after 7-day grace period)
  cron.schedule("0 10 * * *", () => runVerificationReminders(), {
    timezone: "Africa/Nairobi",
  });

  console.log("[scheduler] Weekly digest: Mon 8am & Fri 6pm EAT");
  console.log("[scheduler] Price simulation & alerts: every 5 minutes");
  console.log("[scheduler] Verification reminders: daily 10am EAT");
}

async function runOpportunityDigest(label: string): Promise<void> {
  try {
    console.log(`[scheduler] Running ${label} opportunity digest...`);
    const users = await db.select().from(usersTable);
    const farms = await db.select().from(farmsTable).limit(6);

    let queued = 0;
    for (const user of users) {
      if (!user.email || !user.emailVerified) continue;
      sendOpportunityDigest(user.email, user.name, farms as any[]).catch((e) =>
        console.warn(`[scheduler] Digest failed for ${user.email}:`, (e as Error)?.message)
      );
      queued++;
    }
    console.log(`[scheduler] ${label} digest queued for ${queued} users`);
  } catch (e) {
    console.error("[scheduler] Digest run error:", e);
  }
}

async function runVerificationReminders(): Promise<void> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const allUnverified = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.emailVerified, false),
          lt(usersTable.createdAt, sevenDaysAgo)
        )
      );

    let sent = 0;
    for (const user of allUnverified) {
      if (!user.email || !user.name) continue;
      const daysSince = (Date.now() - user.createdAt.getTime()) / 86_400_000;
      sendVerificationReminderEmail(user.email, user.name, daysSince).catch((e) =>
        console.warn(`[scheduler] Verification reminder failed for ${user.email}:`, (e as Error)?.message)
      );
      sent++;
    }
    if (sent > 0) console.log(`[scheduler] Verification reminders queued for ${sent} unverified users`);
  } catch (e) {
    console.error("[scheduler] Verification reminder run error:", e);
  }
}

// In-memory price history: farmId → { price, lastAlertedAt }
const priceHistory = new Map<number, { price: number; lastAlertedAt: number }>();

// Risk scores (1–10) by crop type — higher = riskier
const CROP_RISK_SCORE: Record<string, number> = {
  tobacco: 9, coffee: 8, avocado: 7, horticulture: 7, tomatoes: 6,
  tea: 5, potatoes: 5, onions: 5, rice: 4, wheat: 4, sunflower: 4,
  maize: 3, beans: 3, cassava: 3,
};

// Typical growing season length (days) by crop type
const CROP_SEASON_DAYS: Record<string, number> = {
  coffee: 180, avocado: 150, rice: 120, wheat: 90, maize: 90,
  tea: 90, sunflower: 90, potatoes: 90, tomatoes: 60, beans: 60,
  onions: 75, cassava: 270, tobacco: 120,
};

async function runPriceSimulation(): Promise<void> {
  // Pricing formula constants
  const ALPHA = 0.20;           // investor share of harvest revenue
  const P_MAX = 0.40;           // max probability of default
  const LGD = 0.80;             // loss given default
  const RISK_FREE = 0.10;       // annual risk-free rate (10%)
  const LIQUIDITY_DISCOUNT = 0.02;
  const REVENUE_MULTIPLE = 1.40; // forecast revenue = capital × 1.40

  try {
    const farms = await db.select().from(farmsTable);
    const listings = await db.select().from(marketListingsTable);

    // Build per-farm supply/demand from active listings
    const farmListingMap = new Map<number, { primaryShares: number; secondaryShares: number }>();
    for (const l of listings) {
      if (!l.isActive) continue;
      const entry = farmListingMap.get(l.farmId) ?? { primaryShares: 0, secondaryShares: 0 };
      if (l.listingType === "primary") entry.primaryShares += l.sharesAvailable;
      else entry.secondaryShares += l.sharesAvailable;
      farmListingMap.set(l.farmId, entry);
    }

    for (const farm of farms) {
      const totalShares = farm.totalShares;
      if (totalShares <= 0) continue;

      // Forecast revenue derived from capital
      const capital = Number(farm.loanAmount);
      const forecastRevenue = capital * REVENUE_MULTIPLE;

      // Risk score from crop type (fallback = 5 = moderate)
      const cropKey = (farm.cropType ?? "").toLowerCase().trim();
      const riskScore = CROP_RISK_SCORE[cropKey] ?? 5;

      // Remaining days to harvest from creation + typical season length
      const seasonDays = CROP_SEASON_DAYS[cropKey] ?? 90;
      const ageMs = Date.now() - new Date(farm.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const daysToHarvest = Math.max(7, seasonDays - ageDays);

      // Order-book demand multiplier from sold shares + listing activity
      const soldShares = Math.max(0, farm.totalShares - farm.sharesAvailable);
      const demandRatio = soldShares / totalShares; // 0–1
      const farmListing = farmListingMap.get(farm.id) ?? { primaryShares: 0, secondaryShares: 0 };
      const supplyPressure = farmListing.secondaryShares / (totalShares + 1);
      const rawImbalance = demandRatio - supplyPressure * 0.5; // net demand
      const imbalanceFactor = 1 + Math.max(-0.10, Math.min(0.10, rawImbalance * 0.20));

      // Fair-value formula
      const expectedDividend = (forecastRevenue * ALPHA) / totalShares;
      const timeValue = 1 + RISK_FREE * (daysToHarvest / 365);
      const riskAdj = P_MAX * LGD * (riskScore / 10);
      const fairValue =
        (expectedDividend / timeValue) *
        (1 - riskAdj - LIQUIDITY_DISCOUNT) *
        imbalanceFactor;

      // Add tiny ±0.3% market noise to simulate real tick-by-tick variation
      const noise = 1 + (Math.random() - 0.5) * 0.006;
      const newPrice = Math.max(fairValue * noise, 1);

      const prevPrice = Number(farm.currentPrice) || Number(farm.sharePrice) || newPrice;
      const changePercent = ((newPrice - prevPrice) / Math.max(prevPrice, 0.01)) * 100;

      await db
        .update(farmsTable)
        .set({
          currentPrice: newPrice.toFixed(2),
          changePercent: changePercent.toFixed(4),
        } as any)
        .where(eq(farmsTable.id, farm.id))
        .catch(() => {});
    }
    console.log(`[scheduler] Dynamic pricing updated ${farms.length} farms`);
  } catch (e) {
    console.warn("[scheduler] Price simulation error:", (e as Error)?.message);
  }
}

async function runPriceAlertCheck(): Promise<void> {
  try {
    const farms = await db.select().from(farmsTable);
    const now = Date.now();

    for (const farm of farms) {
      const currentPrice = parseFloat(
        (farm as any).currentPrice?.toString() ?? (farm as any).sharePrice?.toString() ?? "100"
      );
      const prev = priceHistory.get(farm.id);

      if (!prev) {
        priceHistory.set(farm.id, { price: currentPrice, lastAlertedAt: 0 });
        continue;
      }

      // Calculate change from last known price
      const changePct = ((currentPrice - prev.price) / prev.price) * 100;
      const absChange = Math.abs(changePct);

      // Alert if >5% change and haven't alerted in last 30 minutes
      if (absChange >= 5 && now - prev.lastAlertedAt > 30 * 60 * 1000) {
        const investments = await db
          .select({ investorId: investmentsTable.investorId })
          .from(investmentsTable)
          .where(
            and(
              eq(investmentsTable.farmId, farm.id),
              eq(investmentsTable.status, "active")
            )
          );

        const investorIds = [...new Set(investments.map((i) => i.investorId))];

        if (investorIds.length > 0) {
          const direction = changePct > 0 ? "📈" : "📉";
          const farmName = (farm as any).name ?? "Farm";
          const cropType = (farm as any).cropType ?? "Crop";

          // Push + in-app notifications
          await notifyMany(
            investorIds,
            "price_alert",
            `${direction} Price Alert: ${farmName}`,
            `${farmName} (${cropType}) moved ${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}% to KES ${Math.round(currentPrice).toLocaleString()}`,
            `/market/${farm.id}`
          ).catch(() => {});

          // Email alerts to affected investors
          const investors = await db
            .select()
            .from(usersTable)
            .where(inArray(usersTable.id, investorIds));

          for (const investor of investors) {
            if (!investor.email || !investor.emailVerified) continue;
            sendPriceAlertEmail(
              investor.email,
              investor.name,
              farmName,
              cropType,
              prev.price,
              currentPrice,
              changePct
            ).catch(() => {});
          }

          console.log(
            `[scheduler] Price alert sent: ${farmName} ${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}% → ${investorIds.length} investors`
          );
        }

        priceHistory.set(farm.id, { price: currentPrice, lastAlertedAt: now });
      } else {
        // Update tracked price (but don't reset alert timer unless alerted)
        priceHistory.set(farm.id, { price: currentPrice, lastAlertedAt: prev.lastAlertedAt });
      }
    }
  } catch (e) {
    console.warn("[scheduler] Price alert check error:", (e as Error)?.message);
  }
}
