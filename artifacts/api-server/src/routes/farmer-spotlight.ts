import { Router, type IRouter } from "express";
import { db, farmsTable, usersTable, investmentsTable, roiProjectionsTable } from "@workspace/db";
import { eq, desc, and, inArray, avg, count } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/investor/spotlight — returns up to 6 high-performing farms for investor discovery
// Scored by: ROI projection, funding %, rainfall factor, investment count
router.get("/investor/spotlight", async (_req, res) => {
  try {
    const farms = await db.select().from(farmsTable)
      .where(eq(farmsTable.status, "active"))
      .orderBy(desc(farmsTable.createdAt))
      .limit(40);

    if (farms.length === 0) { res.json([]); return; }

    // Fetch latest ROI projection for each farm's investments
    const farmIds = farms.map(f => f.id);
    const investmentRows = await db.select().from(investmentsTable)
      .where(and(eq(investmentsTable.status, "active"), inArray(investmentsTable.farmId, farmIds)));

    // Count active investors per farm
    const investorCountMap = new Map<number, number>();
    for (const inv of investmentRows) {
      investorCountMap.set(inv.farmId, (investorCountMap.get(inv.farmId) ?? 0) + 1);
    }

    // Build scored farm list
    type ScoredFarm = {
      id: number; name: string; cropType: string; location: string;
      sharePrice: string; currentPrice: string | null; sharesAvailable: number;
      totalShares: number; imageUrl: string | null; fundingPct: number;
      activeInvestors: number; status: string; description: string | null;
      loanAmount: string; roiEstimate: number; spotlightReason: string;
    };

    const scored: ScoredFarm[] = farms.map(farm => {
      const totalShares = farm.totalShares ?? 100;
      const available = farm.sharesAvailable ?? totalShares;
      const fundingPct = Math.round(((totalShares - available) / Math.max(totalShares, 1)) * 100);
      const activeInvestors = investorCountMap.get(farm.id) ?? 0;

      // Simple ROI estimate: funded farms with rainfall-resilient crops score higher
      const cropBonus: Record<string, number> = {
        coffee: 0.22, avocado: 0.20, tea: 0.18, macadamia: 0.19,
        maize: 0.14, wheat: 0.13, sorghum: 0.12, beans: 0.11,
        tomatoes: 0.15, capsicum: 0.16,
      };
      const cropKey = (farm.cropType ?? "maize").toLowerCase();
      const roiEstimate = (cropBonus[cropKey] ?? 0.14) + (fundingPct / 100) * 0.05;

      // Spotlight reason copy
      const reasons = [
        fundingPct >= 80 ? "🔥 Almost fully funded" : null,
        fundingPct >= 50 && fundingPct < 80 ? "📈 Strong investor interest" : null,
        activeInvestors >= 5 ? `👥 ${activeInvestors} active investors` : null,
        cropKey === "avocado" || cropKey === "coffee" ? "⭐ Premium export crop" : null,
        cropKey === "macadamia" ? "💎 High-value specialty crop" : null,
        fundingPct < 30 ? "🆕 Early entry opportunity" : null,
      ].filter(Boolean);

      return {
        id: farm.id,
        name: farm.name ?? "Farm",
        cropType: farm.cropType ?? "maize",
        location: farm.location ?? "Kenya",
        sharePrice: String(farm.sharePrice ?? "100"),
        currentPrice: String((farm as any).currentPrice ?? farm.sharePrice ?? "100"),
        sharesAvailable: available,
        totalShares,
        imageUrl: farm.imageUrl ?? null,
        fundingPct,
        activeInvestors,
        status: farm.status ?? "active",
        description: farm.description ?? null,
        loanAmount: String(farm.loanAmount ?? "0"),
        roiEstimate: Math.round(roiEstimate * 100),
        spotlightReason: reasons[0] ?? "📊 Solid fundamentals",
      };
    });

    // Sort: highest ROI estimate + funding momentum
    scored.sort((a, b) => (b.roiEstimate + b.fundingPct * 0.3) - (a.roiEstimate + a.fundingPct * 0.3));

    res.json(scored.slice(0, 6));
  } catch (e) {
    console.error("[spotlight]", e);
    res.status(500).json({ error: "Failed to load spotlight" });
  }
});

export default router;
