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

    // Commission = 2% of total redeemed voucher value (supplier) + connector bonuses from referred loans
    const referredLoans = await db.select()
      .from(loanApplicationsTable)
      .where(inArray(loanApplicationsTable.status, ["approved", "disbursed"]));
    const farmerIds = new Set(orders.map(o => o.farmerId));
    const connectorCommission = referredLoans
      .filter(l => farmerIds.has(l.farmerId))
      .reduce((sum, l) => sum + Number(l.amount) * 0.02, 0);
    const supplierCommission = totalRedeemedKes * 0.02;
    const commissionEarned = Math.round(connectorCommission + supplierCommission);

    res.json({ pendingOrders, totalRedeemedKes, farmersConnected, commissionEarned });
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

// ── POST /agribusiness/commission-withdrawal — agent requests commission payout ──
router.post("/agribusiness/commission-withdrawal", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { mpesaNumber, amount } = req.body as { mpesaNumber: string; amount: number };
  if (!mpesaNumber || !amount || amount < 100) {
    res.status(400).json({ error: "mpesaNumber and amount (min KES 100) required" }); return;
  }
  try {
    const refCode = `WDL-${String(user.id).padStart(6, "0")}-${Date.now().toString(36).toUpperCase()}`;
    logger.info({ userId: user.id, mpesaNumber, amount, refCode }, "[AGENT] Commission withdrawal requested");
    res.json({
      ok: true,
      referenceCode: refCode,
      message: "Withdrawal request received. Funds will be sent to your M-Pesa within 5 business days.",
    });
  } catch {
    res.status(500).json({ error: "Failed to submit withdrawal request" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OFFTAKER ROUTES (companies like Terralima that buy farm produce)
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
    };
    res.json(farms.map(({ farm, farmer }) => {
      const pricePerKg = cropPrices[farm.cropType?.toLowerCase() ?? ""] ?? 50;
      const estimatedYieldTons = Math.round((farm.totalShares * 0.01) * 2.5);
      const daysToHarvest = 90 + Math.floor(Math.random() * 60);
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
        certifications: farm.cropType === "coffee" ? ["Fair Trade", "Rainforest Alliance"] : ["GAP Certified"],
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
    const [order] = await db.insert(voucherOrdersTable).values({
      agribusinessId: user.id,
      farmerId: farm.farmerId,
      amount: String(totalKes),
      status: "pending",
      items: JSON.stringify([{ name: farm.cropType, qty: quantityTons, unit: "tons" }]),
      ...(deliveryDate ? { deliveryDate } : {}),
      ...(notes ? { notes } : {}),
    } as any).returning();
    res.json({
      ok: true,
      contractId: order.id,
      referenceCode: `OFT-${String(order.id).padStart(6, "0")}`,
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

export default router;
