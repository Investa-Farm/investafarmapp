import { Router, type IRouter } from "express";
import { db, transactionsTable, farmsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

router.get("/transactions", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
      id: transactionsTable.id,
      type: transactionsTable.type,
      quantity: transactionsTable.quantity,
      pricePerShare: transactionsTable.pricePerShare,
      totalAmount: transactionsTable.totalAmount,
      exitType: transactionsTable.exitType,
      status: transactionsTable.status,
      createdAt: transactionsTable.createdAt,
      farmName: farmsTable.name,
      cropType: farmsTable.cropType,
      farmId: farmsTable.id,
    })
    .from(transactionsTable)
    .leftJoin(farmsTable, eq(transactionsTable.farmId, farmsTable.id))
    .where(eq(transactionsTable.userId, user.id))
    .orderBy(desc(transactionsTable.createdAt));

  res.json(rows.map(r => ({
    id: r.id,
    type: r.type,
    quantity: r.quantity,
    pricePerShare: Number(r.pricePerShare),
    totalAmount: Number(r.totalAmount),
    exitType: r.exitType ?? null,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    farmName: r.farmName ?? "Farm Investment",
    cropType: r.cropType ?? "Mixed",
    farmId: r.farmId ?? null,
  })));
});

export default router;
