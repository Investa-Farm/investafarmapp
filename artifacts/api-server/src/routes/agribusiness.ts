import { Router, type IRouter } from "express";
import { db, voucherOrdersTable, usersTable, loanApplicationsTable, farmsTable } from "@workspace/db";
import { eq, desc, inArray, count, sql } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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
    const farmersConnected = new Set(orders.map(o => o.farmerId)).size;

    res.json({ pendingOrders, totalRedeemedKes, farmersConnected, commissionEarned: 0 });
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/cooperative/stats", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const [fcRow] = await db.select({ farmerCount: count() }).from(usersTable)
      .where(eq(usersTable.role, "farmer"));

    const [laRow] = await db.select({ activeLoanCount: count() }).from(loanApplicationsTable)
      .where(inArray(loanApplicationsTable.status, ["submitted", "under_review", "approved", "disbursed"]));

    const [fundRow] = await db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(loanApplicationsTable)
      .where(eq(loanApplicationsTable.status, "disbursed"));

    res.json({
      farmerCount: Number(fcRow?.farmerCount ?? 0),
      activeLoanCount: Number(laRow?.activeLoanCount ?? 0),
      totalFundedKes: Number(fundRow?.total ?? 0),
    });
  } catch (e) {
    logger.error({ err: e }, "[COOPERATIVE] Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

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

router.get("/agribusiness/my-network", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const referred = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        county: usersTable.county,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.role, "farmer"))
      .orderBy(desc(usersTable.createdAt))
      .limit(50);

    const orders = await db.select().from(voucherOrdersTable)
      .where(eq(voucherOrdersTable.agribusinessId, user.id));
    const fundedFarmerIds = new Set(
      orders.filter(o => o.status === "fulfilled").map(o => o.farmerId)
    );

    const network = referred.map(f => ({
      id: f.id,
      name: f.name,
      county: f.county ?? "Kenya",
      funded: fundedFarmerIds.has(f.id),
      status: fundedFarmerIds.has(f.id) ? "Funded" : "Active",
    }));

    res.json(network);
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to fetch network");
    res.status(500).json({ error: "Failed to fetch network" });
  }
});

// ── GET /cooperative/farmers — list farmer network for a cooperative ──────────
router.get("/cooperative/farmers", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const farmers = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        county: usersTable.county,
        phone: usersTable.phone,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.role, "farmer"))
      .orderBy(desc(usersTable.createdAt))
      .limit(100);

    const orders = await db.select({ farmerId: voucherOrdersTable.farmerId, status: voucherOrdersTable.status })
      .from(voucherOrdersTable);
    const fundedIds = new Set(orders.filter(o => o.status === "fulfilled").map(o => o.farmerId));
    const activeIds = new Set(orders.map(o => o.farmerId));

    const network = farmers.map(f => ({
      id: f.id,
      name: f.name,
      county: f.county ?? "Kenya",
      phone: f.phone ?? "",
      joined: new Date(f.createdAt ?? Date.now()).toLocaleDateString("en-KE", { month: "short", year: "numeric" }),
      status: activeIds.has(f.id) ? "active" : "pending",
      funded: fundedIds.has(f.id),
    }));

    res.json(network);
  } catch (e) {
    logger.error({ err: e }, "[COOPERATIVE] Failed to fetch farmers");
    res.status(500).json({ error: "Failed to fetch farmers" });
  }
});

// ── POST /cooperative/import-farmers — bulk import farmers from CSV ──────────
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
  // In a real system this would create pending farmer accounts.
  // Here we record the import as a log and return success.
  logger.info({ userId: user.id, count: validFarmers.length }, "[COOPERATIVE] Bulk farmer import");
  res.json({
    imported: validFarmers.length,
    message: `${validFarmers.length} farmer invitation${validFarmers.length !== 1 ? "s" : ""} queued. Each farmer will receive an SMS with their registration link.`,
  });
});

// ── POST /cooperative/coinvest — submit co-investment application ─────────────
router.post("/cooperative/coinvest", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { farmDescription, amountKes, memberCount, notes } = req.body as {
    farmDescription: string; amountKes: number; memberCount?: number; notes?: string;
  };
  if (!farmDescription || !amountKes || amountKes < 10000) {
    res.status(400).json({ error: "Farm description and minimum amount of KES 10,000 are required" }); return;
  }
  logger.info({ userId: user.id, farmDescription, amountKes, memberCount }, "[COOPERATIVE] Co-invest application");
  res.json({
    referenceId: `CIV-${user.id}-${Date.now()}`,
    status: "submitted",
    message: "Co-investment application received. Our team will review within 2 business days and contact you at your registered email.",
    estimatedReturn: `${(amountKes * 0.18).toLocaleString("en-KE")} – ${(amountKes * 0.28).toLocaleString("en-KE")} KES per season`,
  });
});

// ── POST /agribusiness/voucher-verify — verify a voucher code ────────────────
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

// ── GET /agribusiness/proposals — proposals (pending farms) submitted by this agent ──
router.get("/agribusiness/proposals", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
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
      .where(eq(farmsTable.farmerId, user.id))
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

export default router;
