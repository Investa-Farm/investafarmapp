import { Router, type IRouter } from "express";
import { db, cropBetsTable, betStakesTable, farmsTable, usersTable, walletsTable } from "@workspace/db";
import { eq, desc, sum, sql, and, count } from "drizzle-orm";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

async function seedDemoBets() {
  try {
    const [{ c }] = await db.select({ c: count() }).from(cropBetsTable);
    if (Number(c) > 0) return;
    const farms = await db.select({ id: farmsTable.id, cropType: farmsTable.cropType, name: farmsTable.name })
      .from(farmsTable).limit(5);
    if (farms.length === 0) return;
    const now = new Date();
    const seed = farms.slice(0, 3).map((f, i) => ({
      creatorId: null as any,
      farmId: f.id,
      question: [
        `Will ${f.name} achieve more than 25% ROI this season?`,
        `Will ${f.cropType} prices rise above current market levels by harvest?`,
        `Will ${f.name} fully fund before the deadline?`,
      ][i],
      description: "Community prediction — stake YES or NO and win from the pool.",
      targetMetric: ["roi", "price", "funded_pct"][i],
      targetValue: ["25", "120", "100"][i],
      minStakeKES: "500",
      maxStakeKES: "50000",
      expiresAt: new Date(now.getTime() + (30 + i * 15) * 24 * 3600 * 1000),
    }));
    await db.insert(cropBetsTable).values(seed);
  } catch { /* best-effort */ }
}

router.get("/bets", async (req, res): Promise<void> => {
  await seedDemoBets();
  try {
    const bets = await db
      .select({ bet: cropBetsTable, farm: farmsTable, creator: usersTable })
      .from(cropBetsTable)
      .leftJoin(farmsTable, eq(cropBetsTable.farmId, farmsTable.id))
      .leftJoin(usersTable, eq(cropBetsTable.creatorId, usersTable.id))
      .orderBy(desc(cropBetsTable.createdAt))
      .limit(50);

    res.json(bets.map(r => ({
      id: r.bet.id,
      farmId: r.bet.farmId,
      farmName: r.farm?.name ?? "Unknown Farm",
      cropType: r.farm?.cropType ?? "Unknown",
      question: r.bet.question,
      description: r.bet.description,
      targetMetric: r.bet.targetMetric,
      targetValue: Number(r.bet.targetValue),
      totalPoolKES: Number(r.bet.totalPoolKES),
      yesPoolKES: Number(r.bet.yesPoolKES),
      noPoolKES: Number(r.bet.noPoolKES),
      minStakeKES: Number(r.bet.minStakeKES),
      maxStakeKES: Number(r.bet.maxStakeKES),
      status: r.bet.status,
      outcome: r.bet.outcome,
      expiresAt: r.bet.expiresAt.toISOString(),
      createdAt: r.bet.createdAt.toISOString(),
      creatorName: r.creator?.name ?? "Unknown",
    })));
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch bets" });
  }
});

router.get("/bets/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid bet id" }); return; }
  try {
    const [r] = await db
      .select({ bet: cropBetsTable, farm: farmsTable, creator: usersTable })
      .from(cropBetsTable)
      .leftJoin(farmsTable, eq(cropBetsTable.farmId, farmsTable.id))
      .leftJoin(usersTable, eq(cropBetsTable.creatorId, usersTable.id))
      .where(eq(cropBetsTable.id, id));
    if (!r) { res.status(404).json({ error: "Bet not found" }); return; }

    const stakes = await db
      .select({ stake: betStakesTable, user: usersTable })
      .from(betStakesTable)
      .leftJoin(usersTable, eq(betStakesTable.userId, usersTable.id))
      .where(eq(betStakesTable.betId, id))
      .orderBy(desc(betStakesTable.amountKES));

    res.json({
      id: r.bet.id,
      farmId: r.bet.farmId,
      farmName: r.farm?.name ?? "Unknown",
      cropType: r.farm?.cropType ?? "Unknown",
      question: r.bet.question,
      description: r.bet.description,
      targetMetric: r.bet.targetMetric,
      targetValue: Number(r.bet.targetValue),
      totalPoolKES: Number(r.bet.totalPoolKES),
      yesPoolKES: Number(r.bet.yesPoolKES),
      noPoolKES: Number(r.bet.noPoolKES),
      minStakeKES: Number(r.bet.minStakeKES),
      maxStakeKES: Number(r.bet.maxStakeKES),
      status: r.bet.status,
      outcome: r.bet.outcome,
      expiresAt: r.bet.expiresAt.toISOString(),
      createdAt: r.bet.createdAt.toISOString(),
      creatorName: r.creator?.name ?? "Unknown",
      stakes: stakes.map(s => ({
        id: s.stake.id,
        userId: s.stake.userId,
        userName: s.user?.name ?? "Investor",
        amountKES: Number(s.stake.amountKES),
        position: s.stake.position,
        payout: s.stake.payout ? Number(s.stake.payout) : null,
        createdAt: s.stake.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch bet" });
  }
});

router.post("/bets", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { farmId, question, description, targetMetric, targetValue, expiresAt, minStakeKES, maxStakeKES } = req.body as any;
  if (!farmId || !question || !targetValue || !expiresAt) {
    res.status(400).json({ error: "farmId, question, targetValue, and expiresAt are required" });
    return;
  }

  try {
    const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId));
    if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

    const [bet] = await db.insert(cropBetsTable).values({
      creatorId: user.id,
      farmId,
      question,
      description: description ?? null,
      targetMetric: targetMetric ?? "roi",
      targetValue: String(targetValue),
      minStakeKES: String(minStakeKES ?? 1000),
      maxStakeKES: String(maxStakeKES ?? 100000),
      expiresAt: new Date(expiresAt),
    }).returning();

    res.json({ ok: true, bet });
  } catch (e) {
    res.status(500).json({ error: "Failed to create bet" });
  }
});

router.post("/bets/:id/stake", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const betId = parseInt(req.params.id!);
  if (isNaN(betId)) { res.status(400).json({ error: "Invalid bet id" }); return; }

  const { amountKES, position } = req.body as { amountKES: number; position: "yes" | "no" };
  if (!amountKES || !position || !["yes", "no"].includes(position)) {
    res.status(400).json({ error: "amountKES and position (yes/no) are required" });
    return;
  }

  try {
    const [bet] = await db.select().from(cropBetsTable).where(eq(cropBetsTable.id, betId));
    if (!bet) { res.status(404).json({ error: "Bet not found" }); return; }
    if (bet.status !== "open") { res.status(400).json({ error: "Bet is not open for staking" }); return; }
    if (new Date() > bet.expiresAt) { res.status(400).json({ error: "Bet has expired" }); return; }

    const minStake = Number(bet.minStakeKES);
    const maxStake = Number(bet.maxStakeKES);
    if (amountKES < minStake || amountKES > maxStake) {
      res.status(400).json({ error: `Stake must be between KES ${minStake.toLocaleString()} and KES ${maxStake.toLocaleString()}` });
      return;
    }

    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
    if (!wallet || Number(wallet.balance) < amountKES) {
      res.status(400).json({ error: "Insufficient wallet balance" });
      return;
    }

    await db.update(walletsTable)
      .set({ balance: sql`balance - ${amountKES}` })
      .where(eq(walletsTable.userId, user.id));

    const [stake] = await db.insert(betStakesTable).values({
      betId,
      userId: user.id,
      amountKES: String(amountKES),
      position,
    }).returning();

    const yesAdd = position === "yes" ? amountKES : 0;
    const noAdd  = position === "no"  ? amountKES : 0;
    await db.update(cropBetsTable).set({
      totalPoolKES: sql`total_pool_kes + ${amountKES}`,
      yesPoolKES:   sql`yes_pool_kes + ${yesAdd}`,
      noPoolKES:    sql`no_pool_kes + ${noAdd}`,
    }).where(eq(cropBetsTable.id, betId));

    res.json({ ok: true, stake });
  } catch (e) {
    res.status(500).json({ error: "Failed to place stake" });
  }
});

router.get("/bets/leaderboard/top", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        userId: betStakesTable.userId,
        userName: usersTable.name,
        totalStaked: sum(betStakesTable.amountKES),
        totalPayout: sum(betStakesTable.payout),
      })
      .from(betStakesTable)
      .leftJoin(usersTable, eq(betStakesTable.userId, usersTable.id))
      .groupBy(betStakesTable.userId, usersTable.name)
      .orderBy(desc(sum(betStakesTable.payout)))
      .limit(20);

    res.json(rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      userName: r.userName ?? "Investor",
      totalStakedKES: Number(r.totalStaked ?? 0),
      totalPayoutKES: Number(r.totalPayout ?? 0),
      roi: r.totalStaked && Number(r.totalStaked) > 0
        ? Math.round(((Number(r.totalPayout ?? 0) - Number(r.totalStaked)) / Number(r.totalStaked)) * 100)
        : 0,
    })));
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

router.get("/bets/my/stakes", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const stakes = await db
      .select({ stake: betStakesTable, bet: cropBetsTable, farm: farmsTable })
      .from(betStakesTable)
      .leftJoin(cropBetsTable, eq(betStakesTable.betId, cropBetsTable.id))
      .leftJoin(farmsTable, eq(cropBetsTable.farmId, farmsTable.id))
      .where(eq(betStakesTable.userId, user.id))
      .orderBy(desc(betStakesTable.createdAt));

    res.json(stakes.map(r => ({
      stakeId: r.stake.id,
      betId: r.stake.betId,
      amountKES: Number(r.stake.amountKES),
      position: r.stake.position,
      payout: r.stake.payout ? Number(r.stake.payout) : null,
      betQuestion: r.bet?.question ?? "",
      farmName: r.farm?.name ?? "Unknown",
      betStatus: r.bet?.status ?? "open",
      betOutcome: r.bet?.outcome,
      createdAt: r.stake.createdAt.toISOString(),
    })));
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch stakes" });
  }
});

export default router;
