import { Router, type IRouter } from "express";
import { db, transactionsTable, farmsTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
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
    .where(and(eq(transactionsTable.userId, user.id), isNull(transactionsTable.deletedAt)))
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

// DELETE /transactions/:id — removes a trade record from the user's own
// activity view. This does NOT reverse the trade or touch wallet/portfolio
// balances — it's a soft delete (deletedAt) so admin/audit records and
// portfolio math (which reads holdings, not this history list) stay intact.
router.delete("/transactions/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params["id"] ?? "", 10);
  if (!id) { res.status(400).json({ error: "Invalid transaction id" }); return; }

  const [row] = await db
    .select({ id: transactionsTable.id })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, user.id), isNull(transactionsTable.deletedAt)));
  if (!row) { res.status(404).json({ error: "Transaction not found" }); return; }

  await db.update(transactionsTable).set({ deletedAt: new Date() }).where(eq(transactionsTable.id, id));
  res.json({ success: true });
});

export default router;
