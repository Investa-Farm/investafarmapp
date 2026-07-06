import { Router, type IRouter } from "express";
import { db, appReviewsTable, usersTable } from "@workspace/db";
import { eq, desc, avg, count, sql } from "drizzle-orm";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

router.post("/reviews", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { rating, review, context } = req.body ?? {};
  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be 1–5" }); return;
  }

  const [saved] = await db.insert(appReviewsTable).values({
    userId: user.id,
    rating: Number(rating),
    review: review?.trim() || null,
    context: context || null,
  }).returning();

  res.json({ ok: true, id: saved.id });
});

router.get("/admin/reviews", async (req, res): Promise<void> => {
  const auth: string = req.headers["authorization"] ?? "";
  let isAdmin = false;
  if (auth.startsWith("Bearer ")) {
    const tok = auth.slice(7);
    try {
      const decoded = Buffer.from(tok, "base64").toString("utf8");
      if (decoded.startsWith("admin-session:") || decoded.startsWith("kyc-admin-session:")) isAdmin = true;
    } catch {}
  }
  if (!isAdmin) {
    const user = await getCurrentUser(req);
    if (!user || user.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
  }

  const reviews = await db
    .select({
      id: appReviewsTable.id,
      userId: appReviewsTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
      rating: appReviewsTable.rating,
      review: appReviewsTable.review,
      context: appReviewsTable.context,
      createdAt: appReviewsTable.createdAt,
    })
    .from(appReviewsTable)
    .leftJoin(usersTable, eq(appReviewsTable.userId, usersTable.id))
    .orderBy(desc(appReviewsTable.createdAt))
    .limit(200);

  const [stats] = await db
    .select({
      avgRating: avg(appReviewsTable.rating),
      total: count(),
    })
    .from(appReviewsTable);

  const dist = await db
    .select({ rating: appReviewsTable.rating, cnt: count() })
    .from(appReviewsTable)
    .groupBy(appReviewsTable.rating)
    .orderBy(appReviewsTable.rating);

  res.json({
    reviews,
    avgRating: Number(stats?.avgRating ?? 0),
    total: Number(stats?.total ?? 0),
    distribution: dist.map(d => ({ rating: d.rating, count: Number(d.cnt) })),
  });
});

export default router;
