import { Router, type IRouter } from "express";
import { db, voucherOrdersTable, usersTable, loanApplicationsTable, farmsTable, walletsTable, walletTransactionsTable, kycDocumentsTable, cooperativeMembersTable, agribusinessConnectionsTable } from "@workspace/db";
import { eq, desc, inArray, count, sql, and } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { logger } from "../lib/logger";
import bcrypt from "bcrypt";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// AGRIBUSINESS STATS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/agribusiness/stats", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const orders = await db.select().from(voucherOrdersTable)
      .where(eq(voucherOrdersTable.agribusinessId, user.id));

    const pendingOrders = orders.filter(o => o.status === "pending").length;
    const totalRedeemedKes = orders
      .filter(o => o.status === "fulfilled")
      .reduce((sum, o) => sum + Number(o.amount), 0);

    // farmers connected via connections table
    const connections = await db.select({ farmerId: agribusinessConnectionsTable.farmerId })
      .from(agribusinessConnectionsTable)
      .where(eq(agribusinessConnectionsTable.agribusinessId, user.id));
    const farmersConnected = connections.length;

    // Commission = 2% supplier + 2% connector on referred funded loans
    const farmerIds = connections.map(c => c.farmerId);
    let connectorCommission = 0;
    if (farmerIds.length > 0) {
      const referredLoans = await db.select()
        .from(loanApplicationsTable)
        .where(inArray(loanApplicationsTable.farmerId, farmerIds));
      connectorCommission = referredLoans
        .filter(l => l.status === "approved" || l.status === "disbursed")
        .reduce((sum, l) => sum + Number(l.amount) * 0.02, 0);
    }
    const supplierCommission = totalRedeemedKes * 0.02;
    const commissionEarned = Math.round(connectorCommission + supplierCommission);

    res.json({ pendingOrders, totalRedeemedKes, farmersConnected, commissionEarned });
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COOPERATIVE STATS (scoped to this cooperative's members)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/cooperative/stats", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const members = await db.select({ farmerId: cooperativeMembersTable.farmerId })
      .from(cooperativeMembersTable)
      .where(eq(cooperativeMembersTable.cooperativeId, user.id));

    const farmerCount = members.length;
    const farmerIds = members.map(m => m.farmerId);

    let activeLoanCount = 0;
    let totalFundedKes = 0;

    // also count loans submitted directly by this cooperative (group loans)
    const coopLoans = await db.select().from(loanApplicationsTable)
      .where(eq(loanApplicationsTable.farmerId, user.id));

    if (farmerIds.length > 0) {
      const memberLoans = await db.select()
        .from(loanApplicationsTable)
        .where(inArray(loanApplicationsTable.farmerId, farmerIds));

      const allLoans = [...memberLoans, ...coopLoans];
      activeLoanCount = allLoans.filter(l =>
        ["submitted", "under_review", "approved", "disbursed"].includes(l.status)
      ).length;
      totalFundedKes = allLoans
        .filter(l => l.status === "disbursed")
        .reduce((sum, l) => sum + Number(l.amount), 0);
    } else {
      activeLoanCount = coopLoans.filter(l =>
        ["submitted", "under_review", "approved", "disbursed"].includes(l.status)
      ).length;
      totalFundedKes = coopLoans
        .filter(l => l.status === "disbursed")
        .reduce((sum, l) => sum + Number(l.amount), 0);
    }

    res.json({ farmerCount, activeLoanCount, totalFundedKes });
  } catch (e) {
    logger.error({ err: e }, "[COOPERATIVE] Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AGRIBUSINESS SUPPLIERS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/agribusiness/suppliers", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const suppliers = await db
      .select({ id: usersTable.id, name: usersTable.name, county: usersTable.county, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.role, "agribusiness"));

    res.json(suppliers.map(s => ({
      id: s.id,
      name: s.name,
      county: s.county ?? "Kenya",
      phone: s.phone ?? undefined,
      badge: "Input Supplier",
    })));
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to fetch suppliers");
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AGRIBUSINESS VOUCHER ORDERS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/agribusiness/voucher-orders", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const orders = await db
      .select({
        id: voucherOrdersTable.id,
        voucherCode: voucherOrdersTable.voucherCode,
        amount: voucherOrdersTable.amount,
        items: voucherOrdersTable.items,
        status: voucherOrdersTable.status,
        farmerPhone: voucherOrdersTable.farmerPhone,
        farmerLocation: voucherOrdersTable.farmerLocation,
        createdAt: voucherOrdersTable.createdAt,
        farmerName: usersTable.name,
      })
      .from(voucherOrdersTable)
      .innerJoin(usersTable, eq(usersTable.id, voucherOrdersTable.farmerId))
      .where(eq(voucherOrdersTable.agribusinessId, user.id))
      .orderBy(desc(voucherOrdersTable.createdAt));

    res.json(orders.map(o => ({
      id: o.id,
      farmerName: o.farmerName,
      farmerPhone: o.farmerPhone ?? undefined,
      farmerLocation: o.farmerLocation ?? undefined,
      voucherCode: o.voucherCode,
      amount: Number(o.amount),
      items: JSON.parse(o.items) as string[],
      status: o.status as "pending" | "fulfilled" | "cancelled",
      createdAt: o.createdAt.toISOString(),
    })));
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to fetch voucher orders");
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.post("/agribusiness/voucher-orders/:id/fulfil", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const orderId = parseInt(req.params.id!);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid order id" }); return; }

  try {
    const [order] = await db.select().from(voucherOrdersTable).where(eq(voucherOrdersTable.id, orderId));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.agribusinessId !== user.id) { res.status(403).json({ error: "Not your order" }); return; }
    if (order.status !== "pending") { res.status(400).json({ error: "Order already processed" }); return; }

    await db.update(voucherOrdersTable)
      .set({ status: "fulfilled", updatedAt: new Date() })
      .where(eq(voucherOrdersTable.id, orderId));

    res.json({ success: true, message: "Order marked as fulfilled" });
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to fulfil order");
    res.status(500).json({ error: "Failed to fulfil order" });
  }
});

router.post("/agribusiness/voucher-orders/:id/cancel", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const orderId = parseInt(req.params.id!);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid order id" }); return; }

  try {
    const [order] = await db.select().from(voucherOrdersTable).where(eq(voucherOrdersTable.id, orderId));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.agribusinessId !== user.id) { res.status(403).json({ error: "Not your order" }); return; }
    if (order.status !== "pending") { res.status(400).json({ error: "Order already processed" }); return; }

    await db.update(voucherOrdersTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(voucherOrdersTable.id, orderId));

    res.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to cancel order");
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AGRIBUSINESS COMMISSIONS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/agribusiness/commissions", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const orders = await db
      .select({
        id: voucherOrdersTable.id,
        amount: voucherOrdersTable.amount,
        status: voucherOrdersTable.status,
        createdAt: voucherOrdersTable.createdAt,
        farmerName: usersTable.name,
      })
      .from(voucherOrdersTable)
      .innerJoin(usersTable, eq(usersTable.id, voucherOrdersTable.farmerId))
      .where(eq(voucherOrdersTable.agribusinessId, user.id))
      .orderBy(desc(voucherOrdersTable.createdAt));

    const commissions = orders
      .filter(o => o.status === "fulfilled")
      .map(o => ({
        id: o.id,
        amount: Math.round(Number(o.amount) * 0.025 * 100) / 100,
        description: `Commission: ${o.farmerName} order fulfilled`,
        createdAt: o.createdAt.toISOString(),
      }));

    res.json(commissions);
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to fetch commissions");
    res.status(500).json({ error: "Failed to fetch commissions" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AGRIBUSINESS NETWORK (scoped to connected farmers only)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/agribusiness/my-network", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    // Get farmers connected to this agent
    const connections = await db
      .select({
        farmerId: agribusinessConnectionsTable.farmerId,
        connectedAt: agribusinessConnectionsTable.connectedAt,
        status: agribusinessConnectionsTable.status,
      })
      .from(agribusinessConnectionsTable)
      .where(eq(agribusinessConnectionsTable.agribusinessId, user.id));

    if (connections.length === 0) {
      res.json([]);
      return;
    }

    const farmerIds = connections.map(c => c.farmerId);
    const farmers = await db
      .select({ id: usersTable.id, name: usersTable.name, county: usersTable.county, phone: usersTable.phone })
      .from(usersTable)
      .where(inArray(usersTable.id, farmerIds));

    const orders = await db.select()
      .from(voucherOrdersTable)
      .where(eq(voucherOrdersTable.agribusinessId, user.id));
    const fundedFarmerIds = new Set(
      orders.filter(o => o.status === "fulfilled").map(o => o.farmerId)
    );

    const connMap = new Map(connections.map(c => [c.farmerId, c]));

    const network = farmers.map(f => ({
      id: f.id,
      name: f.name,
      county: f.county ?? "Kenya",
      phone: f.phone ?? "",
      funded: fundedFarmerIds.has(f.id),
      status: fundedFarmerIds.has(f.id) ? "Funded" : "Active",
      connectedAt: connMap.get(f.id)?.connectedAt?.toISOString(),
    }));

    res.json(network);
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to fetch network");
    res.status(500).json({ error: "Failed to fetch network" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AGRIBUSINESS CONNECT — add a farmer to this agent's network
// ─────────────────────────────────────────────────────────────────────────────

router.post("/agribusiness/connect", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { farmerId } = req.body as { farmerId?: number };
  if (!farmerId) { res.status(400).json({ error: "farmerId is required" }); return; }

  try {
    const [farmer] = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, farmerId));
    if (!farmer || farmer.role !== "farmer") {
      res.status(404).json({ error: "Farmer not found" }); return;
    }

    // Upsert — ignore if already connected
    await db.insert(agribusinessConnectionsTable)
      .values({ agribusinessId: user.id, farmerId, status: "active" })
      .onConflictDoNothing();

    res.json({ ok: true, farmerId, farmerName: farmer.name, message: `${farmer.name} added to your network.` });
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to connect farmer");
    res.status(500).json({ error: "Failed to connect farmer" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AGRIBUSINESS DISCONNECT — remove a farmer from this agent's network
// ─────────────────────────────────────────────────────────────────────────────

router.delete("/agribusiness/connect/:farmerId", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const farmerId = parseInt(req.params.farmerId!);
  if (isNaN(farmerId)) { res.status(400).json({ error: "Invalid farmerId" }); return; }

  try {
    await db.delete(agribusinessConnectionsTable)
      .where(and(
        eq(agribusinessConnectionsTable.agribusinessId, user.id),
        eq(agribusinessConnectionsTable.farmerId, farmerId)
      ));
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to disconnect farmer");
    res.status(500).json({ error: "Failed to disconnect farmer" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COOPERATIVE FARMERS (scoped to cooperative's members)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/cooperative/farmers", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const members = await db
      .select({
        farmerId: cooperativeMembersTable.farmerId,
        joinedAt: cooperativeMembersTable.joinedAt,
        memberStatus: cooperativeMembersTable.status,
      })
      .from(cooperativeMembersTable)
      .where(eq(cooperativeMembersTable.cooperativeId, user.id));

    if (members.length === 0) {
      res.json([]);
      return;
    }

    const farmerIds = members.map(m => m.farmerId);
    const farmers = await db
      .select({ id: usersTable.id, name: usersTable.name, county: usersTable.county, phone: usersTable.phone })
      .from(usersTable)
      .where(inArray(usersTable.id, farmerIds))
      .orderBy(desc(usersTable.createdAt));

    const orders = await db.select({ farmerId: voucherOrdersTable.farmerId, status: voucherOrdersTable.status })
      .from(voucherOrdersTable);
    const fundedIds = new Set(orders.filter(o => o.status === "fulfilled").map(o => o.farmerId));

    const memberMap = new Map(members.map(m => [m.farmerId, m]));

    const network = farmers.map(f => ({
      id: f.id,
      name: f.name,
      county: f.county ?? "Kenya",
      phone: f.phone ?? "",
      joined: new Date(memberMap.get(f.id)?.joinedAt ?? Date.now()).toLocaleDateString("en-KE", { month: "short", year: "numeric" }),
      status: memberMap.get(f.id)?.memberStatus ?? "active",
      funded: fundedIds.has(f.id),
    }));

    res.json(network);
  } catch (e) {
    logger.error({ err: e }, "[COOPERATIVE] Failed to fetch farmers");
    res.status(500).json({ error: "Failed to fetch farmers" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COOPERATIVE ADD MEMBER
// ─────────────────────────────────────────────────────────────────────────────

router.post("/cooperative/members", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { farmerId } = req.body as { farmerId?: number };
  if (!farmerId) { res.status(400).json({ error: "farmerId is required" }); return; }

  try {
    const [farmer] = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, farmerId));
    if (!farmer || farmer.role !== "farmer") {
      res.status(404).json({ error: "Farmer not found" }); return;
    }

    await db.insert(cooperativeMembersTable)
      .values({ cooperativeId: user.id, farmerId, status: "active" })
      .onConflictDoNothing();

    res.json({ ok: true, farmerId, farmerName: farmer.name });
  } catch (e) {
    logger.error({ err: e }, "[COOPERATIVE] Failed to add member");
    res.status(500).json({ error: "Failed to add member" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COOPERATIVE IMPORT FARMERS — bulk create pending farmer accounts
// ─────────────────────────────────────────────────────────────────────────────

router.post("/cooperative/import-farmers", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { farmers } = req.body as { farmers: Array<{ name: string; phone: string; county: string; email?: string; cropType?: string }> };
  if (!Array.isArray(farmers) || farmers.length === 0) {
    res.status(400).json({ error: "No farmers data provided" }); return;
  }
  const validFarmers = farmers.filter(f => f.name && f.phone);
  if (validFarmers.length === 0) {
    res.status(400).json({ error: "Each row must have at least name and phone" }); return;
  }

  const created: number[] = [];
  const skipped: string[] = [];
  const tempPassword = "ChangeMe@123";
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  for (const f of validFarmers) {
    try {
      const email = f.email ?? `farmer.${f.phone.replace(/\D/g, "")}@investa.pending`;
      const [existing] = await db.select({ id: usersTable.id })
        .from(usersTable).where(eq(usersTable.email, email));
      if (existing) {
        // Add to cooperative if not already a member
        await db.insert(cooperativeMembersTable)
          .values({ cooperativeId: user.id, farmerId: existing.id, status: "active" })
          .onConflictDoNothing();
        created.push(existing.id);
        continue;
      }
      const [inserted] = await db.insert(usersTable).values({
        email,
        passwordHash,
        name: f.name,
        role: "farmer",
        phone: f.phone,
        county: f.county || undefined,
        emailVerified: false,
        metadata: { pendingActivation: true, cooperativeId: user.id, importedBy: user.name },
      }).returning({ id: usersTable.id });
      if (inserted) {
        await db.insert(cooperativeMembersTable)
          .values({ cooperativeId: user.id, farmerId: inserted.id, status: "active" })
          .onConflictDoNothing();
        created.push(inserted.id);
      }
    } catch (err) {
      skipped.push(f.name);
      logger.warn({ err, name: f.name }, "[COOPERATIVE] import-farmers: failed to create account");
    }
  }

  logger.info({ userId: user.id, created: created.length, skipped: skipped.length }, "[COOPERATIVE] Bulk farmer import");
  res.json({
    imported: created.length,
    skipped: skipped.length,
    message: `${created.length} farmer account${created.length !== 1 ? "s" : ""} created and added to your network.${skipped.length > 0 ? ` ${skipped.length} skipped (duplicates or errors).` : ""}`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COOPERATIVE CO-INVEST — save application as a loan record
// ─────────────────────────────────────────────────────────────────────────────

router.post("/cooperative/coinvest", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { farmDescription, amountKes, memberCount, notes } = req.body as {
    farmDescription: string; amountKes: number; memberCount?: number; notes?: string;
  };
  if (!farmDescription || !amountKes || amountKes < 10000) {
    res.status(400).json({ error: "Farm description and minimum amount of KES 10,000 are required" }); return;
  }

  try {
    const [loan] = await db.insert(loanApplicationsTable).values({
      farmerId: user.id,
      amount: String(amountKes),
      purpose: "other",
      purposeDetails: `Co-investment: ${farmDescription}${memberCount ? ` (${memberCount} members)` : ""}${notes ? `. Notes: ${notes}` : ""}`,
      repaymentPeriodMonths: 12,
      status: "submitted",
      submittedAt: new Date(),
      cropName: farmDescription,
    }).returning({ id: loanApplicationsTable.id });

    res.json({
      referenceId: `CIV-${user.id}-${loan!.id}`,
      loanApplicationId: loan!.id,
      status: "submitted",
      message: "Co-investment application received. Our team will review within 2 business days and contact you at your registered email.",
      estimatedReturn: `${(amountKes * 0.18).toLocaleString("en-KE")} – ${(amountKes * 0.28).toLocaleString("en-KE")} KES per season`,
    });
  } catch (e) {
    logger.error({ err: e }, "[COOPERATIVE] Failed to save co-invest");
    res.status(500).json({ error: "Failed to submit co-investment application" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COOPERATIVE GROUP LOAN — create a group loan application
// ─────────────────────────────────────────────────────────────────────────────

router.post("/cooperative/group-loan", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { description, amountKes, purpose, repaymentMonths, memberCount } = req.body as {
    description: string; amountKes: number; purpose?: string; repaymentMonths?: number; memberCount?: number;
  };
  if (!description || !amountKes || amountKes < 5000) {
    res.status(400).json({ error: "description and amountKes (min KES 5,000) are required" }); return;
  }

  try {
    const validPurposes = ["seeds", "fertilizer", "equipment", "irrigation", "labour", "other"];
    const loanPurpose = validPurposes.includes(purpose ?? "") ? purpose as any : "other";

    const [loan] = await db.insert(loanApplicationsTable).values({
      farmerId: user.id,
      amount: String(amountKes),
      purpose: loanPurpose,
      purposeDetails: `Group loan for ${memberCount ?? "multiple"} members: ${description}`,
      repaymentPeriodMonths: repaymentMonths ?? 6,
      status: "submitted",
      submittedAt: new Date(),
      cropName: description,
    }).returning({ id: loanApplicationsTable.id, amount: loanApplicationsTable.amount, status: loanApplicationsTable.status, submittedAt: loanApplicationsTable.submittedAt });

    res.status(201).json({
      id: loan!.id,
      referenceId: `GRP-${user.id}-${loan!.id}`,
      amount: amountKes,
      status: "submitted",
      message: "Group loan application submitted. You will be notified once it is reviewed.",
    });
  } catch (e) {
    logger.error({ err: e }, "[COOPERATIVE] Failed to create group loan");
    res.status(500).json({ error: "Failed to submit group loan application" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COOPERATIVE LOANS — list loan applications by this cooperative
// ─────────────────────────────────────────────────────────────────────────────

router.get("/cooperative/loans", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const loans = await db.select()
      .from(loanApplicationsTable)
      .where(eq(loanApplicationsTable.farmerId, user.id))
      .orderBy(desc(loanApplicationsTable.createdAt))
      .limit(50);

    res.json(loans.map(l => ({
      id: l.id,
      referenceId: l.purposeDetails?.includes("Group loan") ? `GRP-${user.id}-${l.id}` : `CIV-${user.id}-${l.id}`,
      amount: Number(l.amount),
      purpose: l.purpose,
      description: l.purposeDetails,
      status: l.status,
      submittedAt: l.submittedAt?.toISOString() ?? l.createdAt.toISOString(),
      repaymentMonths: l.repaymentPeriodMonths,
    })));
  } catch (e) {
    logger.error({ err: e }, "[COOPERATIVE] Failed to fetch loans");
    res.status(500).json({ error: "Failed to fetch loans" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AGRIBUSINESS VOUCHER VERIFY
// ─────────────────────────────────────────────────────────────────────────────

router.post("/agribusiness/voucher-verify", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { voucherCode } = req.body as { voucherCode: string };
  if (!voucherCode) { res.status(400).json({ error: "Voucher code required" }); return; }
  try {
    const [order] = await db
      .select({
        id: voucherOrdersTable.id,
        voucherCode: voucherOrdersTable.voucherCode,
        amount: voucherOrdersTable.amount,
        items: voucherOrdersTable.items,
        status: voucherOrdersTable.status,
        farmerName: usersTable.name,
        farmerPhone: voucherOrdersTable.farmerPhone,
        createdAt: voucherOrdersTable.createdAt,
      })
      .from(voucherOrdersTable)
      .innerJoin(usersTable, eq(usersTable.id, voucherOrdersTable.farmerId))
      .where(eq(voucherOrdersTable.voucherCode, voucherCode.toUpperCase()))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Voucher not found. Check the code and try again." }); return;
    }
    res.json(order);
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to verify voucher");
    res.status(500).json({ error: "Voucher lookup failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AGRIBUSINESS PROPOSALS — farms of connected farmers (agent submitted for listing)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/agribusiness/proposals", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    // Get farmer IDs connected to this agent
    const connections = await db.select({ farmerId: agribusinessConnectionsTable.farmerId })
      .from(agribusinessConnectionsTable)
      .where(eq(agribusinessConnectionsTable.agribusinessId, user.id));

    if (connections.length === 0) {
      res.json([]);
      return;
    }

    const farmerIds = connections.map(c => c.farmerId);
    const farms = await db
      .select({
        id: farmsTable.id,
        name: farmsTable.name,
        cropType: farmsTable.cropType,
        location: farmsTable.location,
        status: farmsTable.status,
        loanAmount: farmsTable.loanAmount,
        totalShares: farmsTable.totalShares,
        sharesAvailable: farmsTable.sharesAvailable,
        createdAt: farmsTable.createdAt,
      })
      .from(farmsTable)
      .where(inArray(farmsTable.farmerId, farmerIds))
      .orderBy(desc(farmsTable.createdAt))
      .limit(50);

    res.json(farms.map(f => ({
      id: f.id,
      farmName: f.name,
      cropType: f.cropType,
      location: f.location,
      status: f.status === "pending" ? "pending" : f.status === "active" ? "pending" : f.status === "funded" ? "approved" : f.status,
      loanAmount: Number(f.loanAmount ?? 0),
      totalShares: f.totalShares,
      funded: f.sharesAvailable === 0,
      createdAt: f.createdAt,
    })));
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to fetch proposals");
    res.status(500).json({ error: "Failed to fetch proposals" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AGRIBUSINESS COMMISSION WITHDRAWAL — process via wallet transaction
// ─────────────────────────────────────────────────────────────────────────────

router.post("/agribusiness/commission-withdrawal", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { mpesaNumber, amount } = req.body as { mpesaNumber: string; amount: number };
  if (!mpesaNumber || !amount || amount < 100) {
    res.status(400).json({ error: "mpesaNumber and amount (min KES 100) required" }); return;
  }
  try {
    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
    if (!wallet) { res.status(400).json({ error: "Wallet not found" }); return; }

    const refCode = `WDL-${String(user.id).padStart(6, "0")}-${Date.now().toString(36).toUpperCase()}`;

    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      userId: user.id,
      type: "withdrawal",
      amount: String(amount),
      balanceAfter: String(Math.max(0, Number(wallet.balance) - amount)),
      description: `Commission withdrawal to M-Pesa ${mpesaNumber}`,
      reference: refCode,
      status: "pending",
    } as any);

    logger.info({ userId: user.id, mpesaNumber, amount, refCode }, "[AGENT] Commission withdrawal requested");
    res.json({
      ok: true,
      referenceCode: refCode,
      message: "Withdrawal request received. Funds will be sent to your M-Pesa within 5 business days.",
    });
  } catch (e) {
    logger.error({ err: e }, "[AGENT] Commission withdrawal failed");
    res.status(500).json({ error: "Failed to submit withdrawal request" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OFFTAKER ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router.get("/offtaker/stats", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const contracts = await db.select().from(voucherOrdersTable)
      .where(eq(voucherOrdersTable.agribusinessId, user.id));
    const active = contracts.filter(c => c.status === "pending").length;
    const fulfilled = contracts.filter(c => c.status === "fulfilled").length;
    const totalKes = contracts.filter(c => c.status === "fulfilled")
      .reduce((s, c) => s + Number(c.amount), 0);
    const farms = await db.select({ count: count() }).from(farmsTable)
      .where(eq(farmsTable.status, "active"));
    res.json({
      activeContracts: active,
      fulfilledContracts: fulfilled,
      totalPurchasedKes: totalKes,
      availableFarms: Number(farms[0]?.count ?? 0),
    });
  } catch { res.status(500).json({ error: "Failed to fetch stats" }); }
});

router.get("/offtaker/farms", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const farms = await db
      .select({ farm: farmsTable, farmer: usersTable })
      .from(farmsTable)
      .leftJoin(usersTable, eq(farmsTable.farmerId, usersTable.id))
      .where(inArray(farmsTable.status, ["active", "funded"] as any));
    const cropPrices: Record<string, number> = {
      maize: 35, wheat: 42, coffee: 750, tea: 320, rice: 55, tomatoes: 65,
      avocado: 120, beans: 80, kale: 25, cabbage: 30, sunflower: 90, sorghum: 38,
      dairy: 60, cassava: 28, macadamia: 850,
    };
    res.json(farms.map(({ farm, farmer }) => {
      const pricePerKg = cropPrices[farm.cropType?.toLowerCase() ?? ""] ?? 50;
      const estimatedYieldTons = Math.round((farm.totalShares * 0.01) * 2.5);
      const seed = farm.id * 13;
      const daysToHarvest = 90 + (seed % 60);
      return {
        id: farm.id,
        name: farm.name,
        cropType: farm.cropType,
        location: farm.location,
        status: farm.status,
        totalShares: farm.totalShares,
        sharesAvailable: farm.sharesAvailable,
        fundedPercent: Math.round(((farm.totalShares - farm.sharesAvailable) / Math.max(farm.totalShares, 1)) * 100),
        farmerName: farmer?.name ?? "Unknown",
        farmerPhone: farmer?.phone ?? null,
        pricePerKgKes: pricePerKg,
        estimatedYieldTons,
        daysToHarvest,
        minOrderTons: 1,
        maxOrderTons: estimatedYieldTons,
        harvestDate: new Date(Date.now() + daysToHarvest * 86400000).toISOString().slice(0, 10),
        certifications: farm.cropType === "Coffee" ? ["Fair Trade", "Rainforest Alliance"] : ["GAP Certified"],
      };
    }));
  } catch { res.status(500).json({ error: "Failed to fetch farms" }); }
});

router.get("/offtaker/contracts", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const orders = await db
      .select({ order: voucherOrdersTable, farmer: usersTable })
      .from(voucherOrdersTable)
      .leftJoin(usersTable, eq(voucherOrdersTable.farmerId, usersTable.id))
      .where(eq(voucherOrdersTable.agribusinessId, user.id))
      .orderBy(desc(voucherOrdersTable.createdAt))
      .limit(50);
    res.json(orders.map(({ order, farmer }) => ({
      id: order.id,
      farmerId: order.farmerId,
      farmerName: farmer?.name ?? "Farmer",
      farmName: (order as any).farmName ?? "Farm",
      cropType: (order as any).cropType ?? "Produce",
      quantityTons: Math.round(Number(order.amount) / 50000) || 1,
      pricePerKg: Number(order.amount) > 0 ? Math.round(Number(order.amount) / (Math.round(Number(order.amount) / 50000) * 1000)) : 50,
      totalKes: Number(order.amount),
      status: order.status,
      deliveryDate: (order as any).deliveryDate ?? null,
      createdAt: order.createdAt,
      referenceCode: `OFT-${String(order.id).padStart(6, "0")}`,
    })));
  } catch { res.status(500).json({ error: "Failed to fetch contracts" }); }
});

router.post("/offtaker/contract", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { farmId, quantityTons, pricePerKgKes, deliveryDate, notes } = req.body as {
    farmId: number; quantityTons: number; pricePerKgKes: number; deliveryDate?: string; notes?: string;
  };
  if (!farmId || !quantityTons || !pricePerKgKes) {
    res.status(400).json({ error: "farmId, quantityTons, and pricePerKgKes required" }); return;
  }
  try {
    const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId));
    if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }
    const totalKes = quantityTons * 1000 * pricePerKgKes;
    const voucherCode = `OFT-${String(farm.id).padStart(4, "0")}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const [order] = await db.insert(voucherOrdersTable).values({
      agribusinessId: user.id,
      farmerId: farm.farmerId,
      amount: String(totalKes),
      voucherCode,
      status: "pending",
      items: JSON.stringify([{ name: farm.cropType, qty: quantityTons, unit: "tons" }]),
      ...(deliveryDate ? { deliveryDate } : {}),
      ...(notes ? { notes } : {}),
    } as any).returning();
    res.json({
      ok: true,
      contractId: order!.id,
      referenceCode: `OFT-${String(order!.id).padStart(6, "0")}`,
      totalKes,
      farmName: farm.name,
      cropType: farm.cropType,
      quantityTons,
      status: "pending",
    });
  } catch { res.status(500).json({ error: "Failed to create contract" }); }
});

router.put("/offtaker/contract/:id/status", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params["id"]);
  const { status } = req.body as { status: string };
  const valid = ["pending", "confirmed", "in_transit", "fulfilled", "cancelled"];
  if (!valid.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  try {
    const [ord] = await db.select().from(voucherOrdersTable).where(eq(voucherOrdersTable.id, id));
    if (!ord || ord.agribusinessId !== user.id) { res.status(403).json({ error: "Not found" }); return; }
    await db.update(voucherOrdersTable).set({ status } as any).where(eq(voucherOrdersTable.id, id));
    res.json({ ok: true, status });
  } catch { res.status(500).json({ error: "Failed to update contract" }); }
});

router.get("/offtaker/market-prices", async (_req, res): Promise<void> => {
  const prices = [
    { crop: "Maize", pricePerKg: 35, unit: "KES/kg", trend: "+3.2%", exchange: "KACE" },
    { crop: "Wheat", pricePerKg: 42, unit: "KES/kg", trend: "+1.8%", exchange: "KACE" },
    { crop: "Coffee", pricePerKg: 750, unit: "KES/kg", trend: "-0.5%", exchange: "Nairobi" },
    { crop: "Tea", pricePerKg: 320, unit: "KES/kg", trend: "+5.1%", exchange: "Mombasa" },
    { crop: "Rice", pricePerKg: 55, unit: "KES/kg", trend: "+0.9%", exchange: "KACE" },
    { crop: "Tomatoes", pricePerKg: 65, unit: "KES/kg", trend: "-2.3%", exchange: "Nairobi" },
    { crop: "Avocado", pricePerKg: 120, unit: "KES/kg", trend: "+8.4%", exchange: "Mombasa" },
    { crop: "Beans", pricePerKg: 80, unit: "KES/kg", trend: "+2.1%", exchange: "KACE" },
    { crop: "Sunflower", pricePerKg: 90, unit: "KES/kg", trend: "+4.7%", exchange: "KACE" },
  ];
  res.json(prices);
});

router.patch("/agribusiness/voucher-orders/:id/status", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const orderId = parseInt(req.params["id"]!);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid order id" }); return; }

  const { status } = req.body as { status?: string };
  const valid = ["pending", "in_transit", "fulfilled", "cancelled", "failed"];
  if (!status || !valid.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${valid.join(", ")}` }); return;
  }

  try {
    const [order] = await db.select().from(voucherOrdersTable).where(eq(voucherOrdersTable.id, orderId));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.agribusinessId !== user.id) { res.status(403).json({ error: "Not your order" }); return; }

    await db.update(voucherOrdersTable)
      .set({ status, updatedAt: new Date() } as any)
      .where(eq(voucherOrdersTable.id, orderId));

    res.json({ ok: true, status });
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to update order status");
    res.status(500).json({ error: "Failed to update order" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// KYC — list documents for agribusiness/cooperative users
// ─────────────────────────────────────────────────────────────────────────────

router.get("/kyc/documents", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const docs = await db.select().from(kycDocumentsTable)
      .where(eq(kycDocumentsTable.userId, user.id));
    res.json(docs);
  } catch { res.status(500).json({ error: "Failed to fetch KYC documents" }); }
});

export default router;
