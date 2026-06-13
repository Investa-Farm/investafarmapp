import cron from "node-cron";
import { db, usersTable, farmsTable } from "@workspace/db";
import { sendOpportunityDigest } from "./lib/email";

export function startScheduler(): void {
  // Monday 8:00 AM EAT (Africa/Nairobi = UTC+3) — cron uses server local time
  // Use Africa/Nairobi timezone option in node-cron v3+
  cron.schedule("0 8 * * 1", () => runOpportunityDigest("Monday morning"), {
    timezone: "Africa/Nairobi",
  });

  // Friday 6:00 PM EAT
  cron.schedule("0 18 * * 5", () => runOpportunityDigest("Friday evening"), {
    timezone: "Africa/Nairobi",
  });

  console.log("[scheduler] Weekly opportunity digest: Mon 8am & Fri 6pm EAT");
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
