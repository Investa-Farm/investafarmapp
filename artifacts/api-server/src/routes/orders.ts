import { Router, type IRouter } from "express";
import { db, orderBookTable, farmsTable, usersTable, investmentsTable, notificationsTable, marketListingsTable } from "@workspace/db";
import { eq, and, desc, asc, gte, lte, ne, sql } from "drizzle-orm";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

// Place a limit order (buy or sell)
router.post("/orders", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { farmId, side, limitPrice, quantity } = req.body;
  if (!farmId || !side || !limitPrice || !quantity) {
    res.status(400).json({ error: "farmId, side, limitPrice, quantity required" }); return;
  }
  if (!["buy", "sell"].includes(side)) {
    res.status(400).json({ error: "side must be buy or sell" }); return;
  }
  if (Number(quantity) <= 0 || Number(limitPrice) <= 0) {
    res.status(400).json({ error: "quantity and limitPrice must be positive" }); return;
  }

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, Number(farmId)));
  if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

  // ── For sell orders: verify the investor owns enough unlocked shares ─────────
  if (side === "sell") {
    const qty = Number(quantity);
    // Total shares owned in this farm
    const holdings = await db
      .select({ quantity: investmentsTable.quantity })
      .from(investmentsTable)
      .where(and(
        eq(investmentsTable.investorId, user.id),
        eq(investmentsTable.farmId, Number(farmId)),
        eq(investmentsTable.status, "active"),
      ));
    const ownedQty = holdings.reduce((s, h) => s + h.quantity, 0);

    // Shares already listed on the secondary market (P2P)
    const activeListings = await db
      .select({ sharesAvailable: marketListingsTable.sharesAvailable })
      .from(marketListingsTable)
      .where(and(
        eq(marketListingsTable.sellerId, user.id),
        eq(marketListingsTable.farmId, Number(farmId)),
        eq(marketListingsTable.isActive, 1),
      ));
    const listedQty = activeListings.reduce((s, l) => s + l.sharesAvailable, 0);

    // Shares already in open/partial sell orders in the order book
    const openSellOrders = await db
      .select({ quantity: orderBookTable.quantity, filledQuantity: orderBookTable.filledQuantity })
      .from(orderBookTable)
      .where(and(
        eq(orderBookTable.investorId, user.id),
        eq(orderBookTable.farmId, Number(farmId)),
        eq(orderBookTable.side, "sell"),
        eq(orderBookTable.status, "open"),
      ));
    const reservedQty = openSellOrders.reduce(
      (s, o) => s + (Number(o.quantity) - Number(o.filledQuantity)), 0
    );

    const availableToSell = ownedQty - listedQty - reservedQty;
    if (availableToSell < qty) {
      res.status(400).json({
        error: `You can only sell ${availableToSell.toFixed(2)} share${availableToSell !== 1 ? "s" : ""} of this farm. You own ${ownedQty}, have ${listedQty} listed on P2P, and ${reservedQty.toFixed(2)} in open sell orders.`,
      });
      return;
    }
  }

  const [order] = await db.insert(orderBookTable).values({
    farmId: Number(farmId),
    investorId: user.id,
    side,
    limitPrice: Number(limitPrice).toFixed(2),
    quantity: Number(quantity).toFixed(4),
    filledQuantity: "0",
    status: "open",
  }).returning();

  res.json({ ok: true, order });
});

// Get order book depth for a farm
router.get("/orders/book/:farmId", async (req, res): Promise<void> => {
  const farmId = Number(req.params.farmId);
  const orders = await db.select().from(orderBookTable)
    .where(and(eq(orderBookTable.farmId, farmId), eq(orderBookTable.status, "open")));

  const buys = orders
    .filter(o => o.side === "buy")
    .sort((a, b) => Number(b.limitPrice) - Number(a.limitPrice))
    .map(o => ({ price: Number(o.limitPrice), quantity: Number(o.quantity) - Number(o.filledQuantity), orderId: o.id }));

  const sells = orders
    .filter(o => o.side === "sell")
    .sort((a, b) => Number(a.limitPrice) - Number(b.limitPrice))
    .map(o => ({ price: Number(o.limitPrice), quantity: Number(o.quantity) - Number(o.filledQuantity), orderId: o.id }));

  // Aggregate by price level
  const aggregateLevels = (levels: { price: number; quantity: number }[]) => {
    const map = new Map<number, number>();
    for (const l of levels) {
      map.set(l.price, (map.get(l.price) ?? 0) + l.quantity);
    }
    return [...map.entries()].map(([price, quantity]) => ({ price, quantity }));
  };

  res.json({ buys: aggregateLevels(buys), sells: aggregateLevels(sells) });
});

// Get my orders
router.get("/orders/mine", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const orders = await db.select({ order: orderBookTable, farm: farmsTable })
    .from(orderBookTable)
    .leftJoin(farmsTable, eq(orderBookTable.farmId, farmsTable.id))
    .where(eq(orderBookTable.investorId, user.id))
    .orderBy(desc(orderBookTable.createdAt))
    .limit(50);

  res.json(orders.map(r => ({
    ...r.order,
    farmName: r.farm?.name,
    cropType: r.farm?.cropType,
    limitPrice: Number(r.order.limitPrice),
    quantity: Number(r.order.quantity),
    filledQuantity: Number(r.order.filledQuantity),
    remaining: Number(r.order.quantity) - Number(r.order.filledQuantity),
  })));
});

// Cancel an order
router.delete("/orders/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const orderId = Number(req.params.id);
  const [order] = await db.select().from(orderBookTable).where(
    and(eq(orderBookTable.id, orderId), eq(orderBookTable.investorId, user.id))
  );
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.status !== "open" && order.status !== "partially_filled") {
    res.status(400).json({ error: "Order cannot be cancelled" }); return;
  }

  await db.update(orderBookTable).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orderBookTable.id, orderId));
  res.json({ ok: true });
});

export default router;
