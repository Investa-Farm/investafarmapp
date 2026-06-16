import { Router, type IRouter } from "express";
import { db, voucherOrdersTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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
    const [order] = await db
      .select()
      .from(voucherOrdersTable)
      .where(eq(voucherOrdersTable.id, orderId));

    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.agribusinessId !== user.id) { res.status(403).json({ error: "Not your order" }); return; }
    if (order.status !== "pending") { res.status(400).json({ error: "Order already processed" }); return; }

    await db
      .update(voucherOrdersTable)
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

    await db
      .update(voucherOrdersTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(voucherOrdersTable.id, orderId));

    res.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "[AGRIBUSINESS] Failed to cancel order");
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

export default router;
