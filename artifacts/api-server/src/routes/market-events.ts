import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { marketEventsTable } from "@workspace/db";
import { gt, or, isNull, desc } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/market-events — public, returns currently active AI-detected market events
router.get("/market-events", async (_req, res) => {
  try {
    const now = new Date();
    const events = await db
      .select()
      .from(marketEventsTable)
      .where(or(isNull(marketEventsTable.expiresAt), gt(marketEventsTable.expiresAt, now)))
      .orderBy(desc(marketEventsTable.detectedAt))
      .limit(20);

    res.json(events);
  } catch (e) {
    res.status(500).json({ error: "Failed to load market events" });
  }
});

export default router;
