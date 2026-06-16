import { Router, type IRouter } from "express";
import { db, watchlistTable, farmsTable, marketListingsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

// Get my watchlist (with farm details)
router.get("/watchlist", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const items = await db.select({ watchlist: watchlistTable, farm: farmsTable })
    .from(watchlistTable)
    .leftJoin(farmsTable, eq(watchlistTable.farmId, farmsTable.id))
    .where(eq(watchlistTable.userId, user.id));

  res.json(items.map(r => ({
    id: r.watchlist.id,
    farmId: r.watchlist.farmId,
    createdAt: r.watchlist.createdAt,
    farm: r.farm ? {
      id: r.farm.id,
      name: r.farm.name,
      cropType: r.farm.cropType,
      location: r.farm.location,
      currentPrice: Number((r.farm as any).currentPrice ?? r.farm.sharePrice),
      changePercent: Number((r.farm as any).changePercent ?? 0),
    } : null,
  })));
});

// Add to watchlist
router.post("/watchlist", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { farmId } = req.body;
  if (!farmId) { res.status(400).json({ error: "farmId required" }); return; }

  await db.insert(watchlistTable).values({ userId: user.id, farmId: Number(farmId) })
    .onConflictDoNothing();

  res.json({ ok: true });
});

// Remove from watchlist
router.delete("/watchlist/:farmId", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db.delete(watchlistTable).where(
    and(eq(watchlistTable.userId, user.id), eq(watchlistTable.farmId, Number(req.params.farmId)))
  );
  res.json({ ok: true });
});

// Sync watchlist from localStorage (bulk upsert)
router.post("/watchlist/sync", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { farmIds } = req.body as { farmIds: number[] };
  if (!Array.isArray(farmIds)) { res.status(400).json({ error: "farmIds must be array" }); return; }

  // Clear existing and re-insert
  await db.delete(watchlistTable).where(eq(watchlistTable.userId, user.id));
  if (farmIds.length > 0) {
    await db.insert(watchlistTable).values(
      farmIds.map(farmId => ({ userId: user.id, farmId: Number(farmId) }))
    ).onConflictDoNothing();
  }
  res.json({ ok: true, count: farmIds.length });
});

export default router;
