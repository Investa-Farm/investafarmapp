import { Router, type IRouter } from "express";
import { db, priceAlertsTable, farmsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

router.get("/price-alerts", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const alerts = await db
    .select({ alert: priceAlertsTable, farm: farmsTable })
    .from(priceAlertsTable)
    .leftJoin(farmsTable, eq(priceAlertsTable.farmId, farmsTable.id))
    .where(and(eq(priceAlertsTable.userId, user.id), eq(priceAlertsTable.isActive, true)));

  res.json(alerts.map(a => ({
    ...a.alert,
    targetPrice: String(a.alert.targetPrice),
    farmName: a.farm?.name,
    cropType: a.farm?.cropType,
  })));
});

router.post("/price-alerts", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { farmId, targetPrice, direction } = req.body;
  if (!farmId || !targetPrice || !direction) {
    res.status(400).json({ error: "farmId, targetPrice, and direction are required" });
    return;
  }
  if (!["above", "below"].includes(direction)) {
    res.status(400).json({ error: "direction must be 'above' or 'below'" });
    return;
  }

  const [alert] = await db.insert(priceAlertsTable).values({
    userId: user.id,
    farmId: Number(farmId),
    targetPrice: String(targetPrice),
    direction,
  }).returning();

  res.json(alert);
});

router.delete("/price-alerts/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db
    .update(priceAlertsTable)
    .set({ isActive: false })
    .where(and(
      eq(priceAlertsTable.id, Number(req.params.id)),
      eq(priceAlertsTable.userId, user.id),
    ));

  res.json({ ok: true });
});

export default router;
