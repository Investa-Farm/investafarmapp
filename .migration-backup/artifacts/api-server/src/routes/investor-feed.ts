import { Router, type IRouter } from "express";
import { db, farmUpdatesTable, farmsTable, investmentsTable, loanApplicationsTable } from "@workspace/db";
import { eq, inArray, desc, and } from "drizzle-orm";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

router.get("/investor/feed", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const investments = await db
    .select({ farmId: investmentsTable.farmId })
    .from(investmentsTable)
    .where(and(eq(investmentsTable.investorId, user.id), eq(investmentsTable.status, "active")));

  const farmIds = [...new Set(investments.map(i => i.farmId))];
  if (farmIds.length === 0) { res.json([]); return; }

  const updates = await db
    .select({ update: farmUpdatesTable, farm: farmsTable })
    .from(farmUpdatesTable)
    .leftJoin(farmsTable, eq(farmUpdatesTable.farmId, farmsTable.id))
    .where(inArray(farmUpdatesTable.farmId, farmIds))
    .orderBy(desc(farmUpdatesTable.createdAt))
    .limit(40);

  res.json(
    updates
      .filter(u => u.farm)
      .map(u => ({
        id: u.update.id,
        farmId: u.farm!.id,
        farmName: u.farm!.name,
        cropType: u.farm!.cropType,
        location: u.farm!.location,
        imageUrl: u.farm!.imageUrl,
        title: u.update.title,
        description: u.update.description,
        updateImageUrl: u.update.imageUrl,
        createdAt: u.update.createdAt.toISOString(),
      }))
  );
});

router.get("/farmer/vouchers", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "farmer") {
    res.status(403).json({ error: "Farmers only" }); return;
  }

  const loans = await db
    .select()
    .from(loanApplicationsTable)
    .where(eq(loanApplicationsTable.farmerId, user.id))
    .orderBy(desc(loanApplicationsTable.createdAt));

  res.json(
    loans.map(l => ({
      id: l.id,
      amount: Number(l.amount),
      purpose: l.purpose,
      purposeDetails: l.purposeDetails,
      status: l.status,
      voucherCode: l.status === "approved" || l.status === "disbursed"
        ? `IFV-${String(l.id).padStart(6, "0")}-${String(l.farmerId).padStart(4, "0")}`
        : null,
      createdAt: l.createdAt?.toISOString() ?? null,
    }))
  );
});

export default router;
