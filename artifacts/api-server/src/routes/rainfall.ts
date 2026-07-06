import { Router, type Request, type Response } from "express";
import { db, farmsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getRainfallData, getKenyaCoords } from "../lib/rainfall";

const router = Router();

/**
 * GET /api/farms/:id/rainfall
 * Returns rainfall data + yield impact for a farm.
 * Public endpoint (no auth required — data is non-sensitive).
 */
router.get("/farms/:id/rainfall", async (req: Request, res: Response): Promise<void> => {
  const farmId = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!farmId) { res.status(400).json({ error: "Invalid farm id" }); return; }

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId));
  if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

  const [lat, lng] = getKenyaCoords(farm.location ?? "");
  const data = await getRainfallData(lat, lng, farm.cropType ?? "maize");

  res.json({ farmId, farmName: farm.name, cropType: farm.cropType, ...data });
});

export default router;
