import { Router, type IRouter } from "express";
import { db, syndicatesTable, syndicateMembersTable, syndicateInvestmentsTable, usersTable, walletsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

router.get("/syndicates", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({ s: syndicatesTable, leader: usersTable })
      .from(syndicatesTable)
      .leftJoin(usersTable, eq(syndicatesTable.leaderId, usersTable.id))
      .orderBy(desc(syndicatesTable.createdAt))
      .limit(50);

    res.json(rows.map(r => ({
      id: r.s.id,
      name: r.s.name,
      description: r.s.description,
      location: r.s.location,
      county: r.s.county,
      cropFocus: r.s.cropFocus,
      memberCount: r.s.memberCount,
      minMembers: r.s.minMembers,
      maxMembers: r.s.maxMembers,
      fundingGoalKES: Number(r.s.fundingGoalKES),
      raisedKES: Number(r.s.raisedKES),
      riskScore: Number(r.s.riskScore ?? 4),
      isOpen: r.s.isOpen,
      status: r.s.status,
      imageUrl: r.s.imageUrl,
      agroDealer: r.s.agroDealer,
      discountPct: Number(r.s.discountPct ?? 0),
      leaderName: r.leader?.name ?? "Unknown",
      createdAt: r.s.createdAt.toISOString(),
      fundingPct: Number(r.s.fundingGoalKES) > 0
        ? Math.round((Number(r.s.raisedKES) / Number(r.s.fundingGoalKES)) * 100)
        : 0,
    })));
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch syndicates" });
  }
});

router.get("/syndicates/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [r] = await db
      .select({ s: syndicatesTable, leader: usersTable })
      .from(syndicatesTable)
      .leftJoin(usersTable, eq(syndicatesTable.leaderId, usersTable.id))
      .where(eq(syndicatesTable.id, id));
    if (!r) { res.status(404).json({ error: "Syndicate not found" }); return; }

    const members = await db
      .select({ m: syndicateMembersTable, u: usersTable })
      .from(syndicateMembersTable)
      .leftJoin(usersTable, eq(syndicateMembersTable.userId, usersTable.id))
      .where(eq(syndicateMembersTable.syndicateId, id));

    const investments = await db
      .select({ i: syndicateInvestmentsTable, u: usersTable })
      .from(syndicateInvestmentsTable)
      .leftJoin(usersTable, eq(syndicateInvestmentsTable.investorId, usersTable.id))
      .where(eq(syndicateInvestmentsTable.syndicateId, id));

    res.json({
      id: r.s.id,
      name: r.s.name,
      description: r.s.description,
      location: r.s.location,
      county: r.s.county,
      cropFocus: r.s.cropFocus,
      memberCount: r.s.memberCount,
      minMembers: r.s.minMembers,
      maxMembers: r.s.maxMembers,
      fundingGoalKES: Number(r.s.fundingGoalKES),
      raisedKES: Number(r.s.raisedKES),
      riskScore: Number(r.s.riskScore ?? 4),
      isOpen: r.s.isOpen,
      status: r.s.status,
      imageUrl: r.s.imageUrl,
      agroDealer: r.s.agroDealer,
      discountPct: Number(r.s.discountPct ?? 0),
      leaderName: r.leader?.name ?? "Unknown",
      createdAt: r.s.createdAt.toISOString(),
      fundingPct: Number(r.s.fundingGoalKES) > 0
        ? Math.round((Number(r.s.raisedKES) / Number(r.s.fundingGoalKES)) * 100) : 0,
      members: members.map(m => ({
        userId: m.m.userId,
        name: m.u?.name ?? "Farmer",
        role: m.m.role,
        contribution: Number(m.m.contribution ?? 0),
        joinedAt: m.m.joinedAt.toISOString(),
      })),
      investments: investments.map(i => ({
        investorId: i.i.investorId,
        investorName: i.u?.name ?? "Investor",
        amountKES: Number(i.i.amountKES),
        status: i.i.status,
        createdAt: i.i.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch syndicate" });
  }
});

router.post("/syndicates", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (user.role !== "farmer" && user.role !== "cooperative") {
    res.status(403).json({ error: "Only farmers can create syndicates" }); return;
  }

  const { name, description, location, county, cropFocus, fundingGoalKES, minMembers, maxMembers, agroDealer, discountPct } = req.body as any;
  if (!name || !location || !county || !cropFocus || !fundingGoalKES) {
    res.status(400).json({ error: "name, location, county, cropFocus, fundingGoalKES are required" }); return;
  }

  try {
    const [syndicate] = await db.insert(syndicatesTable).values({
      leaderId: user.id,
      name,
      description: description ?? null,
      location,
      county,
      cropFocus,
      fundingGoalKES: String(fundingGoalKES),
      minMembers: minMembers ?? 5,
      maxMembers: maxMembers ?? 20,
      agroDealer: agroDealer ?? null,
      discountPct: discountPct ? String(discountPct) : "0",
    }).returning();

    await db.insert(syndicateMembersTable).values({
      syndicateId: syndicate.id,
      userId: user.id,
      role: "leader",
      contribution: "0",
    });

    res.json({ ok: true, syndicate });
  } catch (e) {
    res.status(500).json({ error: "Failed to create syndicate" });
  }
});

router.post("/syndicates/:id/join", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const syndicateId = parseInt(req.params.id!);
  if (isNaN(syndicateId)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [syndicate] = await db.select().from(syndicatesTable).where(eq(syndicatesTable.id, syndicateId));
    if (!syndicate) { res.status(404).json({ error: "Syndicate not found" }); return; }
    if (!syndicate.isOpen) { res.status(400).json({ error: "Syndicate is not open for new members" }); return; }
    if (syndicate.memberCount >= syndicate.maxMembers) {
      res.status(400).json({ error: "Syndicate is full" }); return;
    }

    const existing = await db.select().from(syndicateMembersTable)
      .where(and(eq(syndicateMembersTable.syndicateId, syndicateId), eq(syndicateMembersTable.userId, user.id)));
    if (existing.length > 0) { res.status(409).json({ error: "Already a member" }); return; }

    await db.insert(syndicateMembersTable).values({ syndicateId, userId: user.id, role: "member" });
    await db.update(syndicatesTable)
      .set({ memberCount: sql`member_count + 1` })
      .where(eq(syndicatesTable.id, syndicateId));

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to join syndicate" });
  }
});

router.post("/syndicates/:id/invest", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const syndicateId = parseInt(req.params.id!);
  if (isNaN(syndicateId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { amountKES } = req.body as { amountKES: number };
  if (!amountKES || amountKES < 1000) {
    res.status(400).json({ error: "Minimum investment is KES 1,000" }); return;
  }

  try {
    const [syndicate] = await db.select().from(syndicatesTable).where(eq(syndicatesTable.id, syndicateId));
    if (!syndicate) { res.status(404).json({ error: "Syndicate not found" }); return; }
    if (syndicate.status !== "forming" && syndicate.status !== "active") {
      res.status(400).json({ error: "Syndicate is not accepting investments" }); return;
    }

    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
    if (!wallet || Number(wallet.balance) < amountKES) {
      res.status(400).json({ error: "Insufficient wallet balance" }); return;
    }

    await db.update(walletsTable)
      .set({ balance: sql`balance - ${amountKES}` })
      .where(eq(walletsTable.userId, user.id));

    const [investment] = await db.insert(syndicateInvestmentsTable).values({
      syndicateId,
      investorId: user.id,
      amountKES: String(amountKES),
      sharesEquivalent: Math.floor(amountKES / 100),
    }).returning();

    await db.update(syndicatesTable)
      .set({ raisedKES: sql`raised_kes + ${amountKES}` })
      .where(eq(syndicatesTable.id, syndicateId));

    res.json({ ok: true, investment });
  } catch (e) {
    res.status(500).json({ error: "Failed to invest in syndicate" });
  }
});

router.get("/syndicates/my/memberships", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await db
      .select({ m: syndicateMembersTable, s: syndicatesTable })
      .from(syndicateMembersTable)
      .leftJoin(syndicatesTable, eq(syndicateMembersTable.syndicateId, syndicatesTable.id))
      .where(eq(syndicateMembersTable.userId, user.id));
    res.json(rows.map(r => ({
      syndicateId: r.m.syndicateId,
      name: r.s?.name ?? "Unknown",
      role: r.m.role,
      status: r.s?.status ?? "forming",
      cropFocus: r.s?.cropFocus ?? "",
      joinedAt: r.m.joinedAt.toISOString(),
    })));
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch memberships" });
  }
});

router.get("/syndicates/my/investments", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await db
      .select({ i: syndicateInvestmentsTable, s: syndicatesTable })
      .from(syndicateInvestmentsTable)
      .leftJoin(syndicatesTable, eq(syndicateInvestmentsTable.syndicateId, syndicatesTable.id))
      .where(eq(syndicateInvestmentsTable.investorId, user.id));
    res.json(rows.map(r => ({
      syndicateId: r.i.syndicateId,
      name: r.s?.name ?? "Unknown",
      amountKES: Number(r.i.amountKES),
      sharesEquivalent: r.i.sharesEquivalent,
      status: r.i.status,
      cropFocus: r.s?.cropFocus ?? "",
      riskScore: Number(r.s?.riskScore ?? 4),
      createdAt: r.i.createdAt.toISOString(),
    })));
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch syndicate investments" });
  }
});

export default router;
