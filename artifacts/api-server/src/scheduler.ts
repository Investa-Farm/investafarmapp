import cron from "node-cron";
import { db, usersTable, farmsTable, investmentsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { sendOpportunityDigest, sendPriceAlertEmail } from "./lib/email";
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

  console.log("[scheduler] Weekly digest: Mon 8am & Fri 6pm EAT");
  console.log("[scheduler] Price simulation & alerts: every 5 minutes");
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

// In-memory price history: farmId → { price, lastAlertedAt }
const priceHistory = new Map<number, { price: number; lastAlertedAt: number }>();

async function runPriceSimulation(): Promise<void> {
  try {
    const farms = await db.select().from(farmsTable);
    for (const farm of farms) {
      const currentPrice = parseFloat((farm as any).currentPrice?.toString() ?? (farm as any).sharePrice?.toString() ?? "100");
      // Random walk: ±0 to 3% per tick (biased slightly positive to simulate growth)
      const rand = Math.random();
      let changePct: number;
      if (rand < 0.05) {
        // 5% chance of a big move (4–8%)
        changePct = (Math.random() > 0.45 ? 1 : -1) * (4 + Math.random() * 4);
      } else {
        // Normal small move ±0–2%
        changePct = (Math.random() - 0.46) * 4;
      }
      const newPrice = Math.max(currentPrice * (1 + changePct / 100), 1);
      await db
        .update(farmsTable)
        .set({ changePercent: changePct.toFixed(2) } as any)
        .where(eq(farmsTable.id, farm.id))
        .catch(() => {});
    }
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
