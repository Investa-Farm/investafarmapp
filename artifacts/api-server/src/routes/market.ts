import { Router, type IRouter } from "express";
import { db, farmsTable, marketListingsTable, usersTable, investmentsTable, transactionsTable, notificationsTable, walletsTable, walletTransactionsTable, loanApplicationsTable, transactionFeesTable, escrowWalletsTable } from "@workspace/db";
import { eq, and, desc, asc, count } from "drizzle-orm";
import {
  BuySharesBody,
  ListSharesForSaleBody,
} from "@workspace/api-zod";
import { getCurrentUser } from "./auth";
import { sendFundingVoucherEmail, sendFirstInvestmentEmail } from "../lib/email";
import { notifyUser } from "../lib/push";

const router: IRouter = Router();

function formatKESAPI(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

const FARM_IMAGES = [
  "/investa-farm/crops/maize.jpg",
  "/investa-farm/crops/avocado.jpg",
  "/investa-farm/crops/coffee.jpg",
  "/investa-farm/crops/wheat.jpg",
  "/investa-farm/crops/potatoes.jpg",
  "/investa-farm/crops/dairy.jpg",
  "/investa-farm/crops/sunflower.jpg",
  "/investa-farm/crops/cassava.jpg",
  "/investa-farm/crops/potato-field.jpg",
];

// ── DCF Pricing Engine ──────────────────────────────────────────────────────
// Full no-arbitrage DCF model for fair secondary-market share pricing.
// Reference: Investa Farm pricing spec (Two-Exit-Strategies document).
const DCF_TOTAL_SHARES = 10_000;
const DCF_ALPHA = 0.55;       // investor share allocation (55% revenue to investors)
const DCF_RF = 0.105;         // Kenya risk-free rate (CBK base rate)
const DCF_P_MAX = 0.15;       // maximum default probability
const DCF_LGD = 0.40;         // loss given default
const DCF_SEASON_DAYS = 180;  // full-season duration in days

/**
 * Compute DCF fair value per share for a secondary-market listing.
 *
 * Formula:
 *   P_fair = (α × R̂ / N) × [1/(1+rf)^((T–t)/365)] × (1 – λ)
 * where:
 *   α   = investor revenue allocation (0.55)
 *   R̂  = expected total farm revenue ≈ loanAmount raised
 *   N   = total shares issued (10 000)
 *   rf  = Kenya risk-free rate (10.5 %)
 *   T–t = days remaining until harvest
 *   λ   = default risk premium = ((10–S)/9) × P_MAX × LGD
 *   S   = farm credit score 1–10 (default 7)
 */
function computeDCFFairValue(
  loanAmount: number,
  farmCreatedAt: Date,
  creditScore: number = 7,
): number {
  const daysElapsed = Math.max(0, (Date.now() - farmCreatedAt.getTime()) / 86_400_000);
  const daysRemaining = Math.max(1, DCF_SEASON_DAYS - daysElapsed);

  // Expected investor payout per share at full harvest
  const expectedPayoutPerShare = (DCF_ALPHA * loanAmount) / DCF_TOTAL_SHARES;

  // Discount to present value
  const pvFactor = 1 / Math.pow(1 + DCF_RF, daysRemaining / 365);

  // Default risk premium
  const S = Math.max(1, Math.min(10, creditScore));
  const lambda = ((10 - S) / 9) * DCF_P_MAX * DCF_LGD;

  const fairValue = expectedPayoutPerShare * pvFactor * (1 - lambda);
  return Math.max(1, Math.round(fairValue * 100) / 100);
}

/**
 * Compute secondary-market traded price with demand imbalance adjustment.
 * P_sell = P_fair × (1 + β × imbalance) × (1 – δ)
 * β = 0.10, δ = 0.005 (platform fee)
 */
function computeSecondaryPrice(
  fairValue: number,
  buyOrders: number = 0,
  sellOrders: number = 1,
): number {
  const BETA = 0.10;
  const DELTA = 0.005;
  const total = Math.max(1, buyOrders + sellOrders);
  const imbalance = (buyOrders - sellOrders) / total;
  const price = fairValue * (1 + BETA * imbalance) * (1 - DELTA);
  return Math.max(1, Math.round(price * 100) / 100);
}
// ───────────────────────────────────────────────────────────────────────────

function listingToJson(
  listing: typeof marketListingsTable.$inferSelect,
  farm: typeof farmsTable.$inferSelect,
  sellerName?: string
) {
  const loanAmt = Number(farm.loanAmount);
  const dcfFairValue = computeDCFFairValue(loanAmt, farm.createdAt);
  const dcfAskPrice = listing.listingType === "secondary"
    ? computeSecondaryPrice(dcfFairValue)
    : Number(listing.pricePerShare);

  return {
    id: listing.id,
    farmId: farm.id,
    farmName: farm.name,
    cropType: farm.cropType,
    location: farm.location,
    listingType: listing.listingType,
    sharesAvailable: listing.sharesAvailable,
    totalShares: farm.totalShares,
    pricePerShare: Number(listing.pricePerShare),
    dcfFairValue,
    dcfAskPrice,
    dcfPremiumPct: Number(listing.pricePerShare) > 0
      ? Math.round(((Number(listing.pricePerShare) / dcfFairValue) - 1) * 1000) / 10
      : 0,
    changePercent: Number(farm.changePercent),
    tradeCount: farm.tradeCount,
    imageUrl: farm.imageUrl ?? FARM_IMAGES[farm.id % FARM_IMAGES.length],
    exitOptions: ["wide_season", "full_season"],
    sellerName: sellerName ?? "Farmer",
    createdAt: listing.createdAt.toISOString(),
  };
}

router.get("/market/primary", async (_req, res): Promise<void> => {
  const listings = await db
    .select({ listing: marketListingsTable, farm: farmsTable, user: usersTable })
    .from(marketListingsTable)
    .leftJoin(farmsTable, eq(marketListingsTable.farmId, farmsTable.id))
    .leftJoin(usersTable, eq(marketListingsTable.sellerId, usersTable.id))
    .where(and(eq(marketListingsTable.listingType, "primary"), eq(marketListingsTable.isActive, 1)));

  res.json(listings
    .filter(r => r.farm)
    .map(r => listingToJson(r.listing, r.farm!, r.user?.name)));
});

router.get("/market/secondary", async (_req, res): Promise<void> => {
  const listings = await db
    .select({ listing: marketListingsTable, farm: farmsTable, user: usersTable })
    .from(marketListingsTable)
    .leftJoin(farmsTable, eq(marketListingsTable.farmId, farmsTable.id))
    .leftJoin(usersTable, eq(marketListingsTable.sellerId, usersTable.id))
    .where(and(eq(marketListingsTable.listingType, "secondary"), eq(marketListingsTable.isActive, 1)));

  res.json(listings
    .filter(r => r.farm)
    .map(r => listingToJson(r.listing, r.farm!, r.user?.name)));
});

router.get("/market/movers", async (_req, res): Promise<void> => {
  const farms = await db.select().from(farmsTable).orderBy(desc(farmsTable.changePercent)).limit(5);
  res.json(farms.map(f => ({
    farmId: f.id,
    farmName: f.name,
    cropType: f.cropType,
    currentPrice: Number(f.currentPrice),
    changePercent: Number(f.changePercent),
    tradeCount: f.tradeCount,
    imageUrl: f.imageUrl ?? FARM_IMAGES[f.id % FARM_IMAGES.length],
  })));
});

router.get("/market/decliners", async (_req, res): Promise<void> => {
  const farms = await db.select().from(farmsTable).orderBy(asc(farmsTable.changePercent)).limit(5);
  res.json(farms.map(f => ({
    farmId: f.id,
    farmName: f.name,
    cropType: f.cropType,
    currentPrice: Number(f.currentPrice),
    changePercent: Number(f.changePercent),
    tradeCount: f.tradeCount,
    imageUrl: f.imageUrl ?? FARM_IMAGES[f.id % FARM_IMAGES.length],
  })));
});

router.get("/market/summary", async (_req, res): Promise<void> => {
  const primaryListings = await db
    .select()
    .from(marketListingsTable)
    .where(and(eq(marketListingsTable.listingType, "primary"), eq(marketListingsTable.isActive, 1)));

  const secondaryListings = await db
    .select()
    .from(marketListingsTable)
    .where(and(eq(marketListingsTable.listingType, "secondary"), eq(marketListingsTable.isActive, 1)));

  const farms = await db.select().from(farmsTable);
  const cropCounts: Record<string, number> = {};
  farms.forEach(f => { cropCounts[f.cropType] = (cropCounts[f.cropType] || 0) + 1; });
  const total = farms.length || 1;
  const cropChanges: Record<string, { total: number; count: number }> = {};
  farms.forEach(f => {
    const crop = f.cropType;
    if (!cropChanges[crop]) cropChanges[crop] = { total: 0, count: 0 };
    cropChanges[crop]!.total += Number(f.changePercent);
    cropChanges[crop]!.count += 1;
  });

  const cropBreakdown = Object.entries(cropCounts).map(([crop, count]) => ({
    crop,
    percent: Math.round((count / total) * 100),
    change: cropChanges[crop]
      ? parseFloat((cropChanges[crop]!.total / cropChanges[crop]!.count).toFixed(2))
      : 0,
  }));

  const avgChangePercent = farms.length > 0
    ? farms.reduce((sum, f) => sum + Number(f.changePercent), 0) / farms.length
    : 0;
  const averageReturn = parseFloat(Math.max(0, avgChangePercent).toFixed(1));

  res.json({
    totalListings: primaryListings.length + secondaryListings.length,
    primaryListings: primaryListings.length,
    secondaryListings: secondaryListings.length,
    totalVolumeKes: farms.reduce((s, f) => s + Number(f.loanAmount), 0),
    averageReturn,
    topCrop: cropBreakdown.sort((a, b) => b.percent - a.percent)[0]?.crop ?? "Maize",
    cropBreakdown,
  });
});

router.post("/market/buy", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = BuySharesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { listingId, quantity, exitType } = parsed.data;
  const [listing] = await db.select().from(marketListingsTable).where(eq(marketListingsTable.id, listingId));
  if (!listing || listing.sharesAvailable < quantity) {
    res.status(400).json({ error: "Not enough shares available" });
    return;
  }

  const totalAmount = Number(listing.pricePerShare) * quantity;
  const isPrimary = listing.listingType === "primary";
  const feeRate = isPrimary ? 0.015 : 0.005; // 1.5% primary, 0.5% secondary
  const feeAmount = Math.round(totalAmount * feeRate * 100) / 100;
  const totalWithFee = totalAmount + feeAmount;

  // Check wallet balance (amount + fee)
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  const walletBalance = Number(wallet?.balance ?? 0);
  if (!wallet || walletBalance < totalWithFee) {
    res.status(400).json({
      error: `Insufficient wallet balance. You need ${formatKESAPI(totalWithFee)} (incl. ${(feeRate * 100).toFixed(1)}% platform fee of ${formatKESAPI(feeAmount)}) but have ${formatKESAPI(walletBalance)}. Please top up your wallet first.`,
      code: "INSUFFICIENT_FUNDS",
      needed: totalWithFee,
      available: walletBalance,
    });
    return;
  }

  // Deduct from wallet (amount + fee)
  const newBalance = walletBalance - totalWithFee;
  await db.update(walletsTable)
    .set({ balance: String(newBalance) })
    .where(eq(walletsTable.id, wallet.id));

  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    userId: user.id,
    type: "investment",
    amount: String(totalWithFee),
    balanceAfter: String(newBalance),
    description: `Investment: ${quantity} share${quantity > 1 ? "s" : ""} purchased (incl. ${(feeRate * 100).toFixed(1)}% fee: KES ${feeAmount.toFixed(0)})`,
    reference: `inv_${Date.now()}`,
    status: "completed",
  });

  // Log platform fee
  await db.insert(transactionFeesTable).values({
    investorId: user.id,
    farmId: listing.farmId,
    feeType: isPrimary ? "primary_purchase" : "secondary_trade",
    amount: String(feeAmount),
    currency: "KES",
  }).catch(() => {});

  const exitDays = exitType === "wide_season" ? 45 : 180;
  const exitDate = new Date(Date.now() + exitDays * 24 * 60 * 60 * 1000);

  await db.update(marketListingsTable)
    .set({ sharesAvailable: listing.sharesAvailable - quantity, isActive: listing.sharesAvailable - quantity > 0 ? 1 : 0 })
    .where(eq(marketListingsTable.id, listingId));

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, listing.farmId));

  await db.update(farmsTable)
    .set({ tradeCount: (farm?.tradeCount ?? 0) + 1 })
    .where(eq(farmsTable.id, listing.farmId));

  if (listing.listingType === "primary" && farm) {
    await db.update(farmsTable)
      .set({ sharesAvailable: Math.max(0, farm.sharesAvailable - quantity) })
      .where(eq(farmsTable.id, listing.farmId));
  }

  await db.insert(investmentsTable).values({
    investorId: user.id,
    farmId: listing.farmId,
    quantity,
    purchasePrice: String(listing.pricePerShare),
    exitType,
    exitDate,
    status: "active",
  });

  const [tx] = await db.insert(transactionsTable).values({
    userId: user.id,
    farmId: listing.farmId,
    type: "buy",
    quantity,
    pricePerShare: String(listing.pricePerShare),
    totalAmount: String(totalAmount),
    exitType,
    status: "completed",
  }).returning();

  // Create escrow entry for primary market investments
  if (isPrimary) {
    await db.insert(escrowWalletsTable).values({
      userId: user.id,
      farmId: listing.farmId,
      amount: String(totalAmount),
      status: "held",
      description: `${quantity} share${quantity > 1 ? "s" : ""} in ${farm?.name ?? "farm"} — primary market`,
      releaseAt: exitDate,
    }).catch(() => {});
  }

  // Notify investor (in-app + push)
  notifyUser(
    user.id,
    "investment_made",
    "🌾 Investment Confirmed!",
    `You bought ${quantity} share${quantity > 1 ? "s" : ""} in ${farm?.name ?? "a farm"} for KES ${Number(totalAmount).toLocaleString("en-KE")}. Exit: ${exitType === "wide_season" ? "45 days" : "~6 months"}.`,
    "/portfolio"
  ).catch(() => {});

  // Send first-investment congratulations email if this is the investor's first purchase
  try {
    const [{ value: investCount }] = await db.select({ value: count() }).from(investmentsTable).where(eq(investmentsTable.investorId, user.id));
    if (investCount === 1) {
      sendFirstInvestmentEmail(user.email, user.name, farm?.name ?? "a Kenyan farm", totalAmount).catch(console.error);
    }
  } catch (e) { console.error("[FIRST_INVEST_EMAIL]", e); }

  // Notify farmer + credit their wallet immediately
  if (farm) {
    notifyUser(
      farm.farmerId,
      "investment_received",
      "💰 New Investment Received!",
      `${user.name} invested KES ${Number(totalAmount).toLocaleString("en-KE")} in ${farm.name} (${quantity} share${quantity > 1 ? "s" : ""}).`,
      "/farmer"
    ).catch(() => {});

    // Credit farmer wallet immediately when investment is received
    try {
      const [farmerWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, farm.farmerId));
      if (farmerWallet) {
        const farmerCurrentBal = parseFloat(farmerWallet.balance);
        const farmerNewBal = farmerCurrentBal + totalAmount;
        await db.update(walletsTable)
          .set({ balance: String(farmerNewBal), updatedAt: new Date() })
          .where(eq(walletsTable.id, farmerWallet.id));
        await db.insert(walletTransactionsTable).values({
          walletId: farmerWallet.id,
          userId: farm.farmerId,
          type: "deposit" as const,
          amount: String(totalAmount),
          balanceAfter: String(farmerNewBal),
          description: `Investment received: ${quantity} share${quantity > 1 ? "s" : ""} in ${farm.name} from ${user.name}`,
          reference: `RCV-${tx.id}`,
          status: "completed",
        });
      }
    } catch (e) { console.error("[FARMER_WALLET_CREDIT]", e); }
  }

  // If farm is now fully funded → disburse loan + send voucher email to farmer
  if (listing.sharesAvailable - quantity <= 0) {
    try {
      const [loan] = await db.select().from(loanApplicationsTable)
        .where(eq(loanApplicationsTable.farmId, listing.farmId));
      if (loan && loan.status !== "disbursed") {
        await db.update(loanApplicationsTable)
          .set({ status: "disbursed" })
          .where(eq(loanApplicationsTable.id, loan.id));
        const [farmer] = await db.select().from(usersTable).where(eq(usersTable.id, loan.farmerId));
        if (farmer) {
          const vCode = `IF-${new Date().getFullYear()}-${loan.purpose.slice(0,3).toUpperCase()}${String(loan.id).padStart(4,"0")}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
          const lAmt = Number(loan.amount);
          sendFundingVoucherEmail(farmer.email, farmer.name, lAmt, farm?.name ?? "Your Farm", vCode, Math.round(lAmt * 0.3)).catch(console.error);
          notifyUser(
            farmer.id,
            "farm_fully_funded",
            "🎉 Farm Fully Funded!",
            `"${farm?.name ?? "Your farm"}" has been fully funded by investors! Your voucher code has been sent to ${farmer.email}.`,
            "/farmer"
          ).catch(() => {});

          // Notify all investors in this farm
          const farmInvestors = await db.select({ investorId: investmentsTable.investorId })
            .from(investmentsTable).where(eq(investmentsTable.farmId, listing.farmId));
          const investorIds = [...new Set(farmInvestors.map(i => i.investorId))];
          for (const investorId of investorIds) {
            notifyUser(
              investorId,
              "farm_fully_funded",
              "🎉 Farm Fully Funded!",
              `${farm?.name ?? "A farm"} you invested in is now 100% funded! Harvest cycle begins.`,
              "/portfolio"
            ).catch(() => {});
          }
        }
      }
    } catch (e) { console.error("[FARM_FUNDED]", e); }
  }

  res.status(201).json({
    id: tx.id,
    type: tx.type,
    farmId: tx.farmId,
    farmName: farm?.name ?? "Farm",
    cropType: farm?.cropType ?? "Crop",
    quantity: tx.quantity,
    pricePerShare: Number(tx.pricePerShare),
    totalAmount: Number(tx.totalAmount),
    exitType: tx.exitType ?? undefined,
    status: tx.status,
    createdAt: tx.createdAt.toISOString(),
  });
});

router.post("/market/sell", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = ListSharesForSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { holdingId, quantity, pricePerShare } = parsed.data;
  const [investment] = await db.select().from(investmentsTable).where(eq(investmentsTable.id, holdingId));
  if (!investment || investment.quantity < quantity) {
    res.status(400).json({ error: "Invalid holding or insufficient shares" });
    return;
  }

  const [listing] = await db.insert(marketListingsTable).values({
    farmId: investment.farmId,
    sellerId: user.id,
    listingType: "secondary",
    sharesAvailable: quantity,
    pricePerShare: String(pricePerShare),
  }).returning();

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, investment.farmId));

  res.status(201).json({
    id: listing.id,
    farmId: farm?.id ?? investment.farmId,
    farmName: farm?.name ?? "Farm",
    cropType: farm?.cropType ?? "Crop",
    location: farm?.location ?? "Kenya",
    listingType: listing.listingType,
    sharesAvailable: listing.sharesAvailable,
    totalShares: farm.totalShares,
    pricePerShare: Number(listing.pricePerShare),
    changePercent: Number(farm?.changePercent ?? 0),
    tradeCount: farm?.tradeCount ?? 0,
    imageUrl: farm?.imageUrl ?? undefined,
    exitOptions: ["wide_season", "full_season"],
    sellerName: user.name,
    createdAt: listing.createdAt.toISOString(),
  });
});

router.get("/market/my-listings", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const listings = await db
    .select({ listing: marketListingsTable, farm: farmsTable })
    .from(marketListingsTable)
    .leftJoin(farmsTable, eq(marketListingsTable.farmId, farmsTable.id))
    .where(eq(marketListingsTable.sellerId, user.id))
    .orderBy(desc(marketListingsTable.createdAt));

  res.json(listings
    .filter(r => r.farm)
    .map(r => ({
      ...listingToJson(r.listing, r.farm!, user.name),
      isActive: r.listing.isActive === 1,
    })));
});

const COMMODITY_DEFAULTS: Record<string, { price: number; unit: string }> = {
  maize:     { price: 4200,  unit: "/bag" },
  tomatoes:  { price: 9500,  unit: "/bag" },
  avocado:   { price: 18500, unit: "/100kg" },
  tea:       { price: 32000, unit: "/100kg" },
  coffee:    { price: 85000, unit: "/100kg" },
  beans:     { price: 6200,  unit: "/bag" },
  wheat:     { price: 3900,  unit: "/bag" },
  potatoes:  { price: 3800,  unit: "/bag" },
  sunflower: { price: 7200,  unit: "/bag" },
  sorghum:   { price: 2600,  unit: "/bag" },
  cassava:   { price: 2800,  unit: "/bag" },
  dairy:     { price: 55,    unit: "/L" },
};

router.get("/market/ticker", async (_req, res): Promise<void> => {
  const farms = await db.select({
    cropType: farmsTable.cropType,
    changePercent: farmsTable.changePercent,
    currentPrice: farmsTable.currentPrice,
    status: farmsTable.status,
  }).from(farmsTable);

  const byType = new Map<string, { totalChange: number; count: number; totalPrice: number }>();
  for (const f of farms) {
    const key = f.cropType.toLowerCase().split(" ")[0]!;
    const entry = byType.get(key) ?? { totalChange: 0, count: 0, totalPrice: 0 };
    entry.totalChange += Number(f.changePercent) || 0;
    entry.totalPrice += Number(f.currentPrice) || 0;
    entry.count++;
    byType.set(key, entry);
  }

  const prices = Object.entries(COMMODITY_DEFAULTS).map(([key, def]) => {
    const live = byType.get(key);
    const change = live && live.count > 0
      ? parseFloat((live.totalChange / live.count).toFixed(2))
      : parseFloat(((Math.random() - 0.5) * 4).toFixed(2));
    const displayPrice = def.price.toLocaleString("en-KE");
    return { name: key.charAt(0).toUpperCase() + key.slice(1), price: displayPrice, unit: def.unit, change };
  });

  const summary = await db
    .select({ count: count(marketListingsTable.id) })
    .from(marketListingsTable)
    .where(and(eq(marketListingsTable.listingType, "primary"), eq(marketListingsTable.isActive, 1)));

  const activeFarms = farms.filter(f => f.status === "active").length;
  const avgChange = prices.reduce((s, p) => s + p.change, 0) / prices.length;

  const insights = [
    `📊 ${summary[0]?.count ?? 0} active farm listings open now`,
    avgChange > 0
      ? `📈 Market up avg ${avgChange.toFixed(1)}% — strong investor demand`
      : `📉 Market softening — good entry point for long-term investors`,
    `🌾 ${activeFarms} funded farms currently in production`,
    `☀️ Optimal planting season — book your shares before they run out`,
    `💰 Top performers: Avocado & Coffee leading returns this season`,
    `🌍 Kenya agri exports surging — strong Q3 outlook for investors`,
  ];

  res.json({ prices, insights });
});

router.delete("/market/listings/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const listingId = Number(req.params["id"]);
  const [listing] = await db.select().from(marketListingsTable).where(eq(marketListingsTable.id, listingId));

  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (listing.sellerId !== user.id) { res.status(403).json({ error: "Not your listing" }); return; }
  if (listing.isActive === 0) { res.status(400).json({ error: "Listing already inactive" }); return; }

  await db.update(marketListingsTable)
    .set({ isActive: 0 })
    .where(eq(marketListingsTable.id, listingId));

  res.json({ success: true });
});

export default router;
