import { Router, type IRouter } from "express";
import { db, notificationsTable, pushSubscriptionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { getVapidPublicKey } from "../lib/push";
import { z } from "zod";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const notifs = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(notifs.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  })));
});

router.post("/notifications/read/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params["id"] ?? "0", 10);
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, id));
  res.json({ success: true });
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, user.id));
  res.json({ success: true });
});

// ── Web Push ──────────────────────────────────────────────────────────────

router.get("/notifications/vapid-key", (_req, res): void => {
  const key = getVapidPublicKey();
  if (!key) { res.status(503).json({ error: "Push not configured" }); return; }
  res.json({ publicKey: key });
});

const SubscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

router.post("/notifications/subscribe", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = SubscribeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid subscription" }); return; }

  const { endpoint, keys } = parsed.data;
  const ua = req.headers["user-agent"]?.slice(0, 200) ?? null;

  // Upsert subscription (endpoint is unique)
  const existing = await db.select({ id: pushSubscriptionsTable.id })
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));

  if (existing.length > 0) {
    await db.update(pushSubscriptionsTable)
      .set({ userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: ua })
      .where(eq(pushSubscriptionsTable.endpoint, endpoint));
  } else {
    await db.insert(pushSubscriptionsTable).values({
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: ua,
    });
  }

  res.json({ success: true });
});

router.delete("/notifications/subscribe", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, user.id));
  res.json({ success: true });
});

export default router;
