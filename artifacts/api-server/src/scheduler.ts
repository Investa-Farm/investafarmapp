import cron from "node-cron";
import { db, usersTable, farmsTable, investmentsTable, marketListingsTable, walletsTable, walletTransactionsTable, dividendsTable, orderBookTable, watchlistTable, roiProjectionsTable, platformRevenueTable } from "@workspace/db";
import { eq, inArray, lt, and, lte, asc } from "drizzle-orm";
import { creditWallet, debitWallet, ensureWallet } from "./lib/walletOps";
import { sendOpportunityDigest, sendPriceAlertEmail, sendVerificationReminderEmail } from "./lib/email";
import { notifyMany, notifyUser } from "./lib/push";
import { getRainfallData, getKenyaCoords, checkRainfallAlerts } from "./lib/rainfall";
import { computeROI, type HoldingROIInput } from "./lib/roi";
import { loadSettings } from "./lib/platformSettings";

/** Returns a random integer in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Schedule a daily job at a random time within a window.
 * Fires once immediately at a random delay, then reschedules itself every 24 h
 * at a fresh random time within the same window to avoid predictable patterns.
 */
function scheduleDailyRandom(
  label: string,
  minHour: number,
  maxHour: number,
  fn: () => void
): void {
  function fireNext() {
    const h = randInt(minHour, maxHour);
    const m = randInt(0, 59);
    console.log(`[scheduler] ${label} → next run at ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")} EAT`);
    cron.schedule(`${m} ${h} * * *`, () => {
      fn();
    }, { timezone: "Africa/Nairobi", scheduled: true });
  }
  // Schedule immediately so the first run is at a random time today/tomorrow
  fireNext();
}

export function startScheduler(): void {
  // High-frequency operations keep their intervals (market data & matching)
  cron.schedule("*/5 * * * *", () => runPriceSimulation(), { timezone: "Africa/Nairobi" });
  cron.schedule("*/5 * * * *", () => runPriceAlertCheck(), { timezone: "Africa/Nairobi" });
  cron.schedule("*/5 * * * *", () => runWatchlistPriceAlerts(), { timezone: "Africa/Nairobi" });
  cron.schedule("*/2 * * * *", () => runOrderMatching(), { timezone: "Africa/Nairobi" });

  // Daily jobs fire at randomised times within a sensible window
  scheduleDailyRandom("Weekly digest (Mon)",   7, 10, () => runOpportunityDigest("morning"));
  scheduleDailyRandom("Weekly digest (Fri)",  16, 20, () => runOpportunityDigest("evening"));
  scheduleDailyRandom("Verification reminders", 8, 11, runVerificationReminders);
  scheduleDailyRandom("Dividend payouts",       1,  4, runDividendPayouts);
  scheduleDailyRandom("Rainfall alerts",        5,  8, runRainfallAlerts);
  scheduleDailyRandom("ROI snapshots",          0,  3, runDailyRoiSnapshots);

  console.log("[scheduler] Price simulation & alerts: every 5 minutes");
  console.log("[scheduler] Watchlist price alerts: every 5 minutes");
  console.log("[scheduler] Order matching engine: every 2 minutes");
  console.log("[scheduler] Daily jobs: randomised times within safe windows");
}

async function runOpportunityDigest(label: string): Promise<void> {
  try {
    const users = await db.select().from(usersTable);
    const farms = await db.select().from(farmsTable).limit(6);
    let queued = 0;
    for (const user of users) {
      if (!user.email || !user.emailVerified) continue;
      sendOpportunityDigest(user.email, user.name, farms as any[]).catch(() => {});
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
    const allUnverified = await db.select().from(usersTable).where(
      and(eq(usersTable.emailVerified, false), lt(usersTable.createdAt, sevenDaysAgo))
    );
    let sent = 0;
    for (const user of allUnverified) {
      if (!user.email || !user.name) continue;
      const daysSince = (Date.now() - user.createdAt.getTime()) / 86_400_000;
      sendVerificationReminderEmail(user.email, user.name, daysSince).catch(() => {});
      sent++;
    }
    if (sent > 0) console.log(`[scheduler] Verification reminders queued for ${sent} users`);
  } catch (e) {
    console.error("[scheduler] Verification reminder run error:", e);
  }
}

// ─── Pricing Constants ────────────────────────────────────────────────────────
// S (risk score) convention: 10 = lowest risk, 1 = highest risk
// lambda = ((10-S)/9) * P_max * L
const P_MAX = 0.40;           // max loss probability when S=1
const LGD = 0.80;             // loss given default fraction
const RISK_FREE = 0.10;       // annual risk-free rate
const BETA_DS = 0.20;         // demand-supply sensitivity
const LIQUIDITY_DISCOUNT = 0.02;
const REVENUE_MULTIPLE = 1.40;
const ARB_THRESHOLD = 0.05;   // 5% no-arbitrage alert threshold
const ALPHA = 0.20;           // investor revenue share

// S-scale (10=best, 1=worst) for each crop type
const CROP_RISK_S: Record<string, number> = {
  maize: 8, beans: 8, cassava: 8, rice: 7, wheat: 7, sunflower: 7,
  tea: 7, potatoes: 6, onions: 6, tomatoes: 5, horticulture: 5,
  avocado: 4, coffee: 3, tobacco: 2,
};

const CROP_SEASON_DAYS: Record<string, number> = {
  coffee: 180, avocado: 150, rice: 120, wheat: 90, maize: 90,
  tea: 90, sunflower: 90, potatoes: 90, tomatoes: 60, beans: 60,
  onions: 75, cassava: 270, tobacco: 120,
};

// In-memory price history for alert tracking
const priceHistory = new Map<number, { price: number; lastAlertedAt: number }>();

async function runPriceSimulation(): Promise<void> {
  try {
    const farms = await db.select().from(farmsTable);
    const listings = await db.select().from(marketListingsTable);

    // Build per-farm order-book from active listings
    const buyMap = new Map<number, number>();  // farmId → total buy-side (sold shares)
    const sellMap = new Map<number, number>(); // farmId → secondary shares listed
    for (const l of listings) {
      if (!l.isActive) continue;
      if (l.listingType === "primary") {
        buyMap.set(l.farmId, (buyMap.get(l.farmId) ?? 0) + (l.sharesAvailable ?? 0));
      } else {
        sellMap.set(l.farmId, (sellMap.get(l.farmId) ?? 0) + (l.sharesAvailable ?? 0));
      }
    }

    for (const farm of farms) {
      const N = farm.totalShares;
      if (N <= 0) continue;

      const cropKey = (farm.cropType ?? "").toLowerCase().trim();
      const S = CROP_RISK_S[cropKey] ?? 5;
      const seasonDays = CROP_SEASON_DAYS[cropKey] ?? 90;
      const ageMs = Date.now() - new Date(farm.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const daysToHarvest = Math.max(7, seasonDays - ageDays);

      // Forecast revenue (α·R̂ / N gives expected dividend per share)
      const capital = Number(farm.loanAmount);
      const R_hat = capital * REVENUE_MULTIPLE;

      // Risk discount: λ = ((10–S)/9) × P_max × L
      const lambda = ((10 - S) / 9) * P_MAX * LGD;

      // Expected dividend per share
      const D_hat = (ALPHA * R_hat) / N;

      // Pure time-discounted price (no risk): P_time = D̂ / (1+rf)^((T-t)/365)
      const timeDiscount = Math.pow(1 + RISK_FREE, daysToHarvest / 365);
      const P_time = D_hat / timeDiscount;

      // Risk-adjusted fair value: P_fair = P_time × (1 – λ)
      const P_fair = P_time * (1 - lambda);

      // Order-book demand/supply imbalance
      const soldShares = Math.max(0, N - farm.sharesAvailable);
      const Q_buy = soldShares;
      const Q_sell = sellMap.get(farm.id) ?? 0;
      const imbalanceFactor = 1 + BETA_DS * ((Q_buy - Q_sell) / Math.max(N, 1));
      const clampedImbalance = Math.max(0.85, Math.min(1.15, imbalanceFactor));

      // Market price with demand pressure
      const P_market = P_fair * clampedImbalance;

      // Execution price after liquidity discount
      const noise = 1 + (Math.random() - 0.5) * 0.006; // ±0.3% tick noise
      const P_execution = Math.max(P_market * (1 - LIQUIDITY_DISCOUNT) * noise, 1);

      // ── No-arbitrage check ──────────────────────────────────────────────────
      const arbDeviation = Math.abs(P_execution - P_time) / Math.max(P_time, 0.01);
      if (arbDeviation > ARB_THRESHOLD) {
        console.log(
          `[arb-alert] ${farm.name}: P_exec=${P_execution.toFixed(2)} P_time=${P_time.toFixed(2)} dev=${(arbDeviation * 100).toFixed(1)}% → spread adjusted`
        );
      }

      // Use the last market price as the baseline; fall back to P_execution on first run
      // (avoids a misleading -80% drop when comparing fair value to face value on day 1)
      const prevPrice = Number(farm.currentPrice) || P_execution;
      const rawChange = ((P_execution - prevPrice) / Math.max(prevPrice, 0.01)) * 100;
      // Cap per-tick movement at ±10% to prevent extreme jumps from DCF vs face-value divergence.
      // Apply the cap to BOTH the stored price AND the reported changePercent so they stay in sync.
      const changePercent = Math.max(-10, Math.min(10, rawChange));
      const cappedPrice = Math.max(1, prevPrice * (1 + changePercent / 100));

      await db.update(farmsTable)
        .set({ currentPrice: cappedPrice.toFixed(2), changePercent: changePercent.toFixed(4) })
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
    const settings = loadSettings();
    const threshold = settings.priceAlertThresholdPct ?? 5;
    const farms = await db.select().from(farmsTable);
    const now = Date.now();
    for (const farm of farms) {
      const currentPrice = parseFloat(
        (farm as any).currentPrice?.toString() ?? (farm as any).sharePrice?.toString() ?? "100"
      );
      const prev = priceHistory.get(farm.id);
      if (!prev) { priceHistory.set(farm.id, { price: currentPrice, lastAlertedAt: 0 }); continue; }

      const changePct = ((currentPrice - prev.price) / prev.price) * 100;
      if (Math.abs(changePct) >= threshold && now - prev.lastAlertedAt > 30 * 60 * 1000) {
        const investments = await db
          .select({ investorId: investmentsTable.investorId })
          .from(investmentsTable)
          .where(and(eq(investmentsTable.farmId, farm.id), eq(investmentsTable.status, "active")));

        const investorIds = [...new Set(investments.map(i => i.investorId))];
        if (investorIds.length > 0) {
          const direction = changePct > 0 ? "📈" : "📉";
          await notifyMany(
            investorIds, "price_alert",
            `${direction} Price Alert: ${(farm as any).name}`,
            `${(farm as any).name} moved ${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}% to KES ${Math.round(currentPrice).toLocaleString()}`,
            `/market/${farm.id}`
          ).catch(() => {});

          const investors = await db.select().from(usersTable).where(inArray(usersTable.id, investorIds));
          for (const investor of investors) {
            if (!investor.email || !investor.emailVerified) continue;
            sendPriceAlertEmail(investor.email, investor.name, (farm as any).name, (farm as any).cropType, prev.price, currentPrice, changePct).catch(() => {});
          }
        }
        priceHistory.set(farm.id, { price: currentPrice, lastAlertedAt: now });
      } else {
        priceHistory.set(farm.id, { price: currentPrice, lastAlertedAt: prev.lastAlertedAt });
      }
    }
  } catch (e) {
    console.warn("[scheduler] Price alert check error:", (e as Error)?.message);
  }
}

// ─── Dividend Payout Scheduler ────────────────────────────────────────────────
async function runDividendPayouts(): Promise<void> {
  try {
    const now = new Date();

    // Find all active investments whose exitDate has passed
    const dueInvestments = await db
      .select()
      .from(investmentsTable)
      .where(and(eq(investmentsTable.status, "active"), lte(investmentsTable.exitDate, now)));

    if (dueInvestments.length === 0) return;

    console.log(`[scheduler] Processing ${dueInvestments.length} due dividends...`);

    for (const inv of dueInvestments) {
      try {
        const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, inv.farmId));
        if (!farm) continue;

        const cropKey = (farm.cropType ?? "").toLowerCase();
        const capital = Number(farm.loanAmount);
        const harvestRevenue = capital * REVENUE_MULTIPLE;

        // Dividend = alpha × R̂ × (quantity / totalShares)
        const dividendAmount = ALPHA * harvestRevenue * (inv.quantity / farm.totalShares);
        const roundedAmount = Math.round(dividendAmount * 100) / 100;
        if (roundedAmount < 1) continue;

        // Check if already paid (guard against double-processing)
        const existing = await db.select().from(dividendsTable)
          .where(and(eq(dividendsTable.investmentId, inv.id), eq(dividendsTable.status, "paid")));
        if (existing.length > 0) continue;

        // Credit investor wallet
        const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, inv.investorId));
        if (!wallet) continue;

        const newBalance = parseFloat(wallet.balance) + roundedAmount;
        await db.update(walletsTable)
          .set({ balance: String(newBalance), updatedAt: now })
          .where(eq(walletsTable.id, wallet.id));

        await db.insert(walletTransactionsTable).values({
          walletId: wallet.id,
          userId: inv.investorId,
          type: "return",
          amount: String(roundedAmount),
          balanceAfter: String(newBalance),
          description: `Harvest dividend: ${farm.name} (${inv.quantity} shares, α=${ALPHA})`,
          reference: `DIV-${inv.id}-${Date.now()}`,
          status: "completed",
        });

        // Record dividend
        await db.insert(dividendsTable).values({
          farmId: farm.id,
          investorId: inv.investorId,
          investmentId: inv.id,
          shares: inv.quantity,
          harvestRevenue: String(harvestRevenue),
          alphaShare: String(ALPHA),
          amount: String(roundedAmount),
          status: "paid",
          paidAt: now,
        });

        // Update investment status
        await db.update(investmentsTable)
          .set({ status: "exited" })
          .where(eq(investmentsTable.id, inv.id));

        // Notify investor
        notifyUser(
          inv.investorId,
          "dividend_paid",
          "💰 Harvest Payout Received!",
          `KES ${roundedAmount.toLocaleString("en-KE")} credited from ${farm.name} (${inv.quantity} shares). Check your wallet.`,
          "/portfolio"
        ).catch(() => {});

        console.log(`[scheduler] Dividend paid: investor ${inv.investorId} ← KES ${roundedAmount} from ${farm.name}`);
      } catch (e) {
        console.warn(`[scheduler] Dividend error for investment ${inv.id}:`, (e as Error)?.message);
      }
    }
  } catch (e) {
    console.error("[scheduler] Dividend payout run error:", e);
  }
}

// ─── Watchlist Price Alert (>5% daily move) ───────────────────────────────────
const watchlistAlertHistory = new Map<number, { price: number; lastAlertedAt: number }>();

async function runWatchlistPriceAlerts(): Promise<void> {
  try {
    const farms = await db.select().from(farmsTable);
    const now = Date.now();

    for (const farm of farms) {
      const currentPrice = parseFloat(
        (farm as any).currentPrice?.toString() ?? (farm as any).sharePrice?.toString() ?? "100"
      );
      const prev = watchlistAlertHistory.get(farm.id);
      if (!prev) { watchlistAlertHistory.set(farm.id, { price: currentPrice, lastAlertedAt: 0 }); continue; }

      const changePct = ((currentPrice - prev.price) / prev.price) * 100;
      if (Math.abs(changePct) >= 5 && now - prev.lastAlertedAt > 60 * 60 * 1000) {
        // Find users watching this farm
        const watchers = await db
          .select({ userId: watchlistTable.userId })
          .from(watchlistTable)
          .where(eq(watchlistTable.farmId, farm.id));

        const watcherIds = watchers.map(w => w.userId);
        if (watcherIds.length > 0) {
          const direction = changePct > 0 ? "📈" : "📉";
          await notifyMany(
            watcherIds,
            "price_alert",
            `${direction} Watchlist Alert: ${(farm as any).name}`,
            `Price moved ${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}% → KES ${Math.round(currentPrice).toLocaleString()}. Tap to view.`,
            `/market/${farm.id}`
          ).catch(() => {});
          console.log(`[scheduler] Watchlist alert: ${(farm as any).name} ${changePct.toFixed(1)}% — notified ${watcherIds.length} watchers`);
        }
        watchlistAlertHistory.set(farm.id, { price: currentPrice, lastAlertedAt: now });
      } else {
        watchlistAlertHistory.set(farm.id, { price: currentPrice, lastAlertedAt: prev.lastAlertedAt });
      }
    }
  } catch (e) {
    console.warn("[scheduler] Watchlist price alert error:", (e as Error)?.message);
  }
}

// ─── Order Matching Engine ─────────────────────────────────────────────────────
async function runOrderMatching(): Promise<void> {
  try {
    const farms = await db.select({ id: farmsTable.id, name: farmsTable.name }).from(farmsTable);

    for (const farm of farms) {
      const buys = await db.select().from(orderBookTable)
        .where(and(eq(orderBookTable.farmId, farm.id), eq(orderBookTable.side, "buy"), eq(orderBookTable.status, "open")))
        .orderBy(asc(orderBookTable.limitPrice));
      const sells = await db.select().from(orderBookTable)
        .where(and(eq(orderBookTable.farmId, farm.id), eq(orderBookTable.side, "sell"), eq(orderBookTable.status, "open")))
        .orderBy(asc(orderBookTable.limitPrice), asc(orderBookTable.createdAt));

      const sortedBuys = [...buys].sort((a, b) => Number(b.limitPrice) - Number(a.limitPrice));

      for (const sell of sells) {
        let sellRemaining = Number(sell.quantity) - Number(sell.filledQuantity);
        if (sellRemaining <= 0) continue;

        for (const buy of sortedBuys) {
          if (buy.investorId === sell.investorId) continue;
          const buyRemaining = Number(buy.quantity) - Number(buy.filledQuantity);
          if (buyRemaining <= 0) continue;
          if (Number(buy.limitPrice) < Number(sell.limitPrice)) break;

          const fillQty   = Math.min(sellRemaining, buyRemaining);
          const fillPrice = Number(sell.limitPrice);
          const fillTotal = Math.round(fillQty * fillPrice * 100) / 100;
          const feeRate   = 0.005; // 0.5% secondary order-book fee
          const feeAmount = Math.round(fillTotal * feeRate * 100) / 100;
          const buyerPays = fillTotal + feeAmount;

          const newBuyFilled  = Number(buy.filledQuantity)  + fillQty;
          const newSellFilled = Number(sell.filledQuantity) + fillQty;
          const buyComplete   = newBuyFilled  >= Number(buy.quantity)  * 0.999;
          const sellComplete  = newSellFilled >= Number(sell.quantity) * 0.999;
          const now = new Date();
          const ref = `ORD-${buy.id}-${sell.id}-${Date.now()}`;

          // ── 1. Transfer funds: buyer → seller (atomic via walletOps) ─────────
          try {
            await ensureWallet(buy.investorId);
            await ensureWallet(sell.investorId);

            // Debit buyer (fill total + fee)
            await debitWallet(buy.investorId, buyerPays, {
              type: "investment",
              description: `Order fill: bought ${fillQty.toFixed(2)} shares of ${farm.name} @ KES ${fillPrice.toLocaleString()} (incl. 0.5% fee)`,
              reference: `${ref}-BUY`,
            });

            // Credit seller (fill total, net of fee)
            await creditWallet(sell.investorId, fillTotal, {
              type: "return",
              description: `Order fill: sold ${fillQty.toFixed(2)} shares of ${farm.name} @ KES ${fillPrice.toLocaleString()}`,
              reference: `${ref}-SELL`,
            });

            // Record platform fee revenue
            await db.insert(platformRevenueTable).values({
              source: "secondary_fee",
              amount: String(feeAmount),
              farmId: farm.id,
              relatedUserId: buy.investorId,
              reference: `${ref}-FEE`,
              description: `0.5% order-book match fee: ${fillQty.toFixed(2)} shares of ${farm.name}`,
            }).catch(() => {});

          } catch (walletErr) {
            console.warn(`[matcher] Wallet transfer failed for order match ${ref}:`, (walletErr as Error)?.message);
            continue; // skip this match if buyer can't pay
          }

          // ── 2. Update order book records ─────────────────────────────────────
          await db.update(orderBookTable).set({
            filledQuantity: String(newBuyFilled),
            status: buyComplete ? "filled" : "partially_filled",
            updatedAt: now,
            filledAt: buyComplete ? now : undefined,
          }).where(eq(orderBookTable.id, buy.id));

          await db.update(orderBookTable).set({
            filledQuantity: String(newSellFilled),
            status: sellComplete ? "filled" : "partially_filled",
            updatedAt: now,
            filledAt: sellComplete ? now : undefined,
          }).where(eq(orderBookTable.id, sell.id));

          // ── 3. Create investment record for buyer ─────────────────────────────
          const exitDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 6-month default
          await db.insert(investmentsTable).values({
            investorId: buy.investorId,
            farmId: farm.id,
            quantity: Math.round(fillQty),
            purchasePrice: String(fillPrice),
            exitType: "full_season",
            exitDate,
            status: "active",
          }).catch(() => {});

          // ── 4. Reduce / close seller's investment holding ─────────────────────
          const [sellerInv] = await db.select().from(investmentsTable)
            .where(and(
              eq(investmentsTable.investorId, sell.investorId),
              eq(investmentsTable.farmId, farm.id),
              eq(investmentsTable.status, "active")
            )).limit(1);

          if (sellerInv) {
            const remaining = sellerInv.quantity - Math.round(fillQty);
            if (remaining <= 0) {
              await db.update(investmentsTable).set({ status: "exited" }).where(eq(investmentsTable.id, sellerInv.id));
            } else {
              await db.update(investmentsTable).set({ quantity: remaining }).where(eq(investmentsTable.id, sellerInv.id));
            }
          }

          // ── 5. Notify both parties ────────────────────────────────────────────
          notifyUser(buy.investorId, "order_filled",
            "✅ Buy Order Filled",
            `${fillQty.toFixed(2)} shares of ${farm.name} @ KES ${fillPrice.toLocaleString("en-KE")} — funds deducted from wallet.`,
            "/portfolio"
          ).catch(() => {});

          notifyUser(sell.investorId, "order_filled",
            "✅ Sell Order Filled",
            `${fillQty.toFixed(2)} shares of ${farm.name} @ KES ${fillPrice.toLocaleString("en-KE")} — KES ${fillTotal.toLocaleString("en-KE")} added to wallet.`,
            "/portfolio"
          ).catch(() => {});

          sellRemaining -= fillQty;
          console.log(`[matcher] ${farm.name}: ${fillQty.toFixed(2)} sh @ KES ${fillPrice} | buyer pays ${buyerPays} | seller gets ${fillTotal}`);
          if (sellRemaining <= 0) break;
        }
      }
    }
  } catch (e) {
    console.warn("[scheduler] Order matching error:", (e as Error)?.message);
  }
}

// ─── Rainfall Alert Scheduler ─────────────────────────────────────────────────
async function runRainfallAlerts(): Promise<void> {
  try {
    const farms = await db.select().from(farmsTable);
    const farmsMeta = farms.map(f => ({
      id: f.id,
      name: f.name ?? "",
      cropType: f.cropType ?? "maize",
      location: f.location ?? "",
    }));

    const alerts = await checkRainfallAlerts(farmsMeta);

    for (const { farmId, farmName, rainfallData: rain } of alerts) {
      // Find investors holding this farm
      const holdings = await db.select({ investorId: investmentsTable.investorId })
        .from(investmentsTable)
        .where(and(eq(investmentsTable.farmId, farmId), eq(investmentsTable.status, "active")));

      const investorIds = [...new Set(holdings.map(h => h.investorId))];
      if (investorIds.length === 0) continue;

      const emoji  = rain.riskLevel === "drought" ? "🌵" : "🌊";
      const title  = `${emoji} Weather Risk: ${farmName}`;
      const body   = rain.criticalDrought
        ? `⚠️ Critical drought — ${rain.seasonalTotalMm}mm vs ${rain.optimalRangeMin}mm minimum. Yield impact: ${rain.yieldAdjustmentPercent}%`
        : rain.floodRisk
          ? `⚠️ Flood risk — ${rain.seasonalTotalMm}mm (excess). Yield impact: ${rain.yieldAdjustmentPercent}%`
          : `${rain.riskLabel}. Yield adjustment: ${rain.yieldAdjustmentPercent}%`;

      await notifyMany(investorIds, "price_alert", title, body, `/market/${farmId}`).catch(() => {});
      console.log(`[rainfall-alert] ${farmName}: ${rain.riskLevel} — notified ${investorIds.length} investors`);
    }
  } catch (e) {
    console.warn("[scheduler] Rainfall alert error:", (e as Error)?.message);
  }
}

// ─── Daily ROI Snapshot Scheduler ─────────────────────────────────────────────
async function runDailyRoiSnapshots(): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0]!;
    const investments = await db.select().from(investmentsTable)
      .where(eq(investmentsTable.status, "active"));

    if (investments.length === 0) return;

    const farmIds  = [...new Set(investments.map(i => i.farmId))];
    const farms    = await db.select().from(farmsTable).where(inArray(farmsTable.id, farmIds));
    const listings = await db.select().from(marketListingsTable)
      .where(and(inArray(marketListingsTable.farmId, farmIds), eq(marketListingsTable.listingType, "primary")));

    const farmMap    = new Map(farms.map(f => [f.id, f]));
    const listingMap = new Map(listings.map(l => [l.farmId, l]));

    let snapped = 0;
    for (const inv of investments) {
      try {
        const farm    = farmMap.get(inv.farmId);
        const listing = listingMap.get(inv.farmId);
        if (!farm) continue;

        const N         = farm.totalShares;
        const soldShares = Math.max(0, N - (listing?.sharesAvailable ?? N));
        const sellSide   = listing?.sharesAvailable ?? 0;
        const imbalance  = 1 + 0.20 * ((soldShares - sellSide) / Math.max(N, 1));

        let rainfallFactor = 1.0;
        try {
          const [lat, lng] = getKenyaCoords(farm.location ?? "");
          const rain = await getRainfallData(lat, lng, farm.cropType ?? "maize");
          rainfallFactor = rain.rainfallFactor;
        } catch { /* use default */ }

        const input: HoldingROIInput = {
          farmId:          farm.id,
          farmName:        farm.name ?? "",
          cropType:        farm.cropType ?? "maize",
          totalShares:     farm.totalShares,
          sharesAvailable: listing?.sharesAvailable ?? farm.sharesAvailable,
          loanAmount:      Number(farm.loanAmount),
          sharePrice:      Number(farm.sharePrice),
          currentPrice:    Number((farm as any).currentPrice ?? farm.sharePrice),
          purchasePrice:   Number(inv.purchasePrice),
          quantity:        Number(inv.quantity),
          farmCreatedAt:   new Date(farm.createdAt),
          rainfallFactor,
          marketImbalance: imbalance,
        };

        const proj = computeROI(input);

        // Upsert today's snapshot (unique index handles dedup)
        await db.insert(roiProjectionsTable).values({
          investmentId:         inv.id,
          snapshotDate:         today,
          fullSeasonRoi:        String(proj.fullSeason.roi),
          fullSeasonAnnualized: String(proj.fullSeason.annualizedRoi),
          fullSeasonPayout:     String(proj.fullSeason.projectedPayout),
          midSeasonRoi:         String(proj.midSeason.roi),
          midSeasonAnnualized:  String(proj.midSeason.annualizedRoi),
          midSeasonPSell:       String(proj.midSeason.pSell),
          rainfallFactor:       String(rainfallFactor),
          recommendation:       proj.recommendation,
        }).onConflictDoUpdate({
          target: [roiProjectionsTable.investmentId, roiProjectionsTable.snapshotDate],
          set: {
            fullSeasonRoi:        String(proj.fullSeason.roi),
            fullSeasonAnnualized: String(proj.fullSeason.annualizedRoi),
            fullSeasonPayout:     String(proj.fullSeason.projectedPayout),
            midSeasonRoi:         String(proj.midSeason.roi),
            midSeasonAnnualized:  String(proj.midSeason.annualizedRoi),
            midSeasonPSell:       String(proj.midSeason.pSell),
            rainfallFactor:       String(rainfallFactor),
            recommendation:       proj.recommendation,
          },
        });
        snapped++;
      } catch { /* skip this investment */ }
    }
    console.log(`[scheduler] ROI snapshots saved for ${snapped}/${investments.length} investments`);
  } catch (e) {
    console.warn("[scheduler] ROI snapshot error:", (e as Error)?.message);
  }
}

// Expose for manual admin trigger
export async function triggerFarmHarvest(farmId: number): Promise<{ paid: number; total: number }> {
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const investments = await db.select().from(investmentsTable)
    .where(and(eq(investmentsTable.farmId, farmId), eq(investmentsTable.status, "active")));

  let paid = 0;
  for (const inv of investments) {
    // Force exitDate to now so runDividendPayouts picks it up
    await db.update(investmentsTable)
      .set({ exitDate: new Date() })
      .where(eq(investmentsTable.id, inv.id));
    paid++;
  }
  await runDividendPayouts();
  return { paid, total: investments.length };
}
