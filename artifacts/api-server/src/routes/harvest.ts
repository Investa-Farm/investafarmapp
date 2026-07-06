/**
 * Harvest Payment Routes
 *
 * Handles the end-to-end offtaker → farm revenue → distribution flow:
 *   - Offtaker (buyer of produce) records a harvest payment
 *   - Platform distributes revenue: Farmer 55% | Investors 20% | Platform 25%
 *   - Admin can manually trigger a harvest payout for any farm
 *
 * POST /api/harvest/payment       — record offtaker payment + distribute funds
 * GET  /api/harvest/payments/:id  — list harvest payments for a farm
 * POST /api/harvest/trigger/:id   — admin: manually trigger harvest for a farm
 */

import { Router, type IRouter } from "express";
import { db, farmsTable, investmentsTable, walletsTable, dividendsTable, harvestPaymentsTable, platformRevenueTable, transactionFeesTable, usersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { creditWallet, ensureWallet } from "../lib/walletOps";
import { notifyUser, notifyMany } from "../lib/push";
import { financialRateLimit } from "../lib/security";

const router: IRouter = Router();

const FARMER_PCT   = 0.55;
const INVESTOR_PCT = 0.20;
const PLATFORM_PCT = 0.25;

/** Distribute harvest revenue to all stakeholders for a given farm. */
export async function distributeHarvestRevenue(opts: {
  farmId: number;
  totalRevenue: number;
  offtakerId?: number;
  offtakerName?: string;
  triggeredBy?: number;
  notes?: string;
  farmerPct?: number;
  investorPct?: number;
  platformPct?: number;
}): Promise<{ harvestPaymentId: number; investorsPaid: number; farmerPaid: number; platformTaken: number }> {
  const {
    farmId, totalRevenue, offtakerId, offtakerName, triggeredBy, notes,
    farmerPct  = FARMER_PCT,
    investorPct = INVESTOR_PCT,
    platformPct = PLATFORM_PCT,
  } = opts;

  if (totalRevenue <= 0) throw new Error("Revenue must be positive");
  if (Math.abs(farmerPct + investorPct + platformPct - 1.0) > 0.001) {
    throw new Error("Percentages must sum to 100%");
  }

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId));
  if (!farm) throw new Error(`Farm ${farmId} not found`);

  const farmerAmount   = Math.round(totalRevenue * farmerPct   * 100) / 100;
  const investorPool   = Math.round(totalRevenue * investorPct * 100) / 100;
  const platformAmount = Math.round(totalRevenue * platformPct * 100) / 100;

  // Record the harvest payment
  const [harvestPayment] = await db.insert(harvestPaymentsTable).values({
    farmId,
    offtakerId: offtakerId ?? null,
    offtakerName: offtakerName ?? null,
    totalRevenue: String(totalRevenue),
    farmerShare: String(farmerAmount),
    investorPoolShare: String(investorPool),
    platformShare: String(platformAmount),
    farmerPct: String(farmerPct * 100),
    investorPct: String(investorPct * 100),
    platformPct: String(platformPct * 100),
    status: "processing",
    notes: notes ?? null,
    triggeredBy: triggeredBy ?? null,
  }).returning();

  const now = new Date();

  // ── 1. Pay farmer ────────────────────────────────────────────────────────────
  const farmerWallet = await ensureWallet(farm.farmerId);
  const farmerRef = `HRV-F-${harvestPayment.id}-${Date.now()}`;
  await creditWallet(farm.farmerId, farmerAmount, {
    type: "return",
    description: `Harvest proceeds: ${farm.name} (${(farmerPct * 100).toFixed(0)}% farmer share) from ${offtakerName ?? "offtaker"}`,
    reference: farmerRef,
  });
  notifyUser(
    farm.farmerId,
    "dividend_paid",
    "🌾 Harvest Payment Received!",
    `KES ${farmerAmount.toLocaleString("en-KE")} credited to your wallet from the sale of ${farm.name} produce.`,
    "/farmer"
  ).catch(() => {});

  // ── 2. Distribute investor pool pro-rata by shares ────────────────────────
  const activeInvestments = await db.select()
    .from(investmentsTable)
    .where(and(eq(investmentsTable.farmId, farmId), eq(investmentsTable.status, "active")));

  const totalInvestedShares = activeInvestments.reduce((s, i) => s + i.quantity, 0);
  let investorsPaid = 0;
  const notifiedInvestorIds: number[] = [];

  for (const inv of activeInvestments) {
    if (totalInvestedShares <= 0) continue;
    const investorShare = Math.round(investorPool * (inv.quantity / totalInvestedShares) * 100) / 100;
    if (investorShare < 1) continue;

    // Guard: skip if already paid this investment for this harvest
    const alreadyPaid = await db.select().from(dividendsTable)
      .where(and(eq(dividendsTable.investmentId, inv.id), eq(dividendsTable.farmId, farmId), eq(dividendsTable.status, "paid")));
    if (alreadyPaid.length > 0) continue;

    await ensureWallet(inv.investorId);
    const investorRef = `HRV-I-${harvestPayment.id}-${inv.id}-${Date.now()}`;
    await creditWallet(inv.investorId, investorShare, {
      type: "return",
      description: `Harvest dividend: ${farm.name} (${inv.quantity} shares, ${(investorPct * 100).toFixed(0)}% pool, pro-rata)`,
      reference: investorRef,
    });

    // Record dividend
    await db.insert(dividendsTable).values({
      farmId,
      investorId: inv.investorId,
      investmentId: inv.id,
      shares: inv.quantity,
      harvestRevenue: String(totalRevenue),
      alphaShare: String(investorPct),
      amount: String(investorShare),
      status: "paid",
      paidAt: now,
    }).catch(() => {});

    // Mark investment as exited
    await db.update(investmentsTable)
      .set({ status: "exited" })
      .where(eq(investmentsTable.id, inv.id));

    investorsPaid++;
    notifiedInvestorIds.push(inv.investorId);
  }

  const uniqueInvestorIds = [...new Set(notifiedInvestorIds)];
  if (uniqueInvestorIds.length > 0) {
    notifyMany(
      uniqueInvestorIds,
      "dividend_paid",
      "💰 Harvest Payout Received!",
      `${farm.name} has been harvested. Your pro-rata share has been credited to your wallet.`,
      "/portfolio"
    ).catch(() => {});
  }

  // ── 3. Record platform revenue ────────────────────────────────────────────
  await db.insert(platformRevenueTable).values({
    source: "harvest_share",
    amount: String(platformAmount),
    farmId,
    description: `Platform share (${(platformPct * 100).toFixed(0)}%) from harvest: ${farm.name}`,
    reference: `HRV-P-${harvestPayment.id}`,
  }).catch(() => {});

  // Also log it as a transaction fee for the admin revenue report
  await db.insert(transactionFeesTable).values({
    investorId: farm.farmerId,
    farmId,
    feeType: "harvest_platform_share" as any,
    amount: String(platformAmount),
    currency: "KES",
  }).catch(() => {});

  // ── 4. Mark farm as harvested, deactivate its primary listing ────────────
  await db.update(farmsTable)
    .set({ status: "harvested" as any })
    .where(eq(farmsTable.id, farmId)).catch(() => {});

  // Mark harvest payment complete
  await db.update(harvestPaymentsTable)
    .set({ status: "completed", completedAt: now })
    .where(eq(harvestPaymentsTable.id, harvestPayment.id));

  return {
    harvestPaymentId: harvestPayment.id,
    investorsPaid,
    farmerPaid: farmerAmount,
    platformTaken: platformAmount,
  };
}

// ─── POST /api/harvest/payment ────────────────────────────────────────────────
// Offtaker or admin records produce payment + triggers distribution
router.post("/harvest/payment", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { farmId, totalRevenue, offtakerName, notes, farmerPct, investorPct, platformPct } = req.body;
  if (!farmId || !totalRevenue || isNaN(Number(totalRevenue)) || Number(totalRevenue) <= 0) {
    res.status(400).json({ error: "farmId and totalRevenue (positive number) are required" });
    return;
  }

  // Only farmers, admin, or agribusiness roles can record harvest payments
  if (!["farmer", "admin", "agribusiness", "cooperative"].includes((user as any).role)) {
    res.status(403).json({ error: "Only farmers or admins can record harvest payments" });
    return;
  }

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, Number(farmId)));
  if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

  // Farmers can only submit for their own farms
  if ((user as any).role === "farmer" && farm.farmerId !== user.id) {
    res.status(403).json({ error: "You can only record payments for your own farms" });
    return;
  }

  // Parse optional percentage overrides (must sum to 1.0)
  let fPct = farmerPct   ? Number(farmerPct)   / 100 : FARMER_PCT;
  let iPct = investorPct ? Number(investorPct) / 100 : INVESTOR_PCT;
  let pPct = platformPct ? Number(platformPct) / 100 : PLATFORM_PCT;

  if (Math.abs(fPct + iPct + pPct - 1.0) > 0.001) {
    res.status(400).json({ error: "farmerPct + investorPct + platformPct must equal 100" });
    return;
  }

  try {
    const result = await distributeHarvestRevenue({
      farmId: Number(farmId),
      totalRevenue: Number(totalRevenue),
      offtakerId: user.id,
      offtakerName: offtakerName ?? user.name,
      triggeredBy: user.id,
      notes,
      farmerPct: fPct,
      investorPct: iPct,
      platformPct: pPct,
    });

    res.status(201).json({
      message: "Harvest revenue distributed successfully",
      ...result,
      breakdown: {
        totalRevenue: Number(totalRevenue),
        farmerAmount: result.farmerPaid,
        investorPool: Math.round(Number(totalRevenue) * iPct * 100) / 100,
        platformAmount: result.platformTaken,
        farmerPct: fPct * 100,
        investorPct: iPct * 100,
        platformPct: pPct * 100,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Distribution failed";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/harvest/payments/:farmId ───────────────────────────────────────
router.get("/harvest/payments/:farmId", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const farmId = Number(req.params.farmId);
  if (isNaN(farmId)) { res.status(400).json({ error: "Invalid farmId" }); return; }

  const payments = await db.select()
    .from(harvestPaymentsTable)
    .where(eq(harvestPaymentsTable.farmId, farmId))
    .orderBy(harvestPaymentsTable.createdAt);

  res.json(payments.map(p => ({
    id: p.id,
    totalRevenue: Number(p.totalRevenue),
    farmerShare: Number(p.farmerShare),
    investorPoolShare: Number(p.investorPoolShare),
    platformShare: Number(p.platformShare),
    farmerPct: Number(p.farmerPct),
    investorPct: Number(p.investorPct),
    platformPct: Number(p.platformPct),
    offtakerName: p.offtakerName,
    status: p.status,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
    completedAt: p.completedAt?.toISOString() ?? null,
  })));
});

// ─── POST /api/harvest/trigger/:farmId ───────────────────────────────────────
// Admin-only: manually trigger harvest payout (no external offtaker payment)
router.post("/harvest/trigger/:farmId", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user || (user as any).role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const farmId = Number(req.params.farmId);
  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId));
  if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

  const estimatedRevenue = Number(farm.loanAmount) * 1.40;

  try {
    const result = await distributeHarvestRevenue({
      farmId,
      totalRevenue: req.body.totalRevenue ? Number(req.body.totalRevenue) : estimatedRevenue,
      offtakerName: "Admin-triggered harvest",
      triggeredBy: user.id,
      notes: req.body.notes ?? "Manual harvest trigger by admin",
    });
    res.json({ message: "Harvest triggered and distributed", ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Trigger failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
