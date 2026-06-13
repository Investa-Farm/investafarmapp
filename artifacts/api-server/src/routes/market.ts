import { Router, type IRouter } from "express";
import { db, farmsTable, marketListingsTable, usersTable, investmentsTable, transactionsTable, notificationsTable, walletsTable, walletTransactionsTable, loanApplicationsTable } from "@workspace/db";
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

function listingToJson(
  listing: typeof marketListingsTable.$inferSelect,
  farm: typeof farmsTable.$inferSelect,
  sellerName?: string
) {
  return {
    id: listing.id,
    farmId: farm.id,
    farmName: farm.name,
    cropType: farm.cropType,
    location: farm.location,
    listingType: listing.listingType,
    sharesAvailable: listing.sharesAvailable,
    pricePerShare: Number(listing.pricePerShare),
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
  const cropBreakdown = Object.entries(cropCounts).map(([crop, count]) => ({
    crop,
    percent: Math.round((count / total) * 100),
    change: +(Math.random() * 4 - 1).toFixed(2),
  }));

  res.json({
    totalListings: primaryListings.length + secondaryListings.length,
    primaryListings: primaryListings.length,
    secondaryListings: secondaryListings.length,
    totalVolumeKes: farms.reduce((s, f) => s + Number(f.loanAmount), 0),
    averageReturn: 8.4,
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

  // Check wallet balance
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  const walletBalance = Number(wallet?.balance ?? 0);
  if (!wallet || walletBalance < totalAmount) {
    res.status(400).json({
      error: `Insufficient wallet balance. You need ${formatKESAPI(totalAmount)} but have ${formatKESAPI(walletBalance)}. Please top up your wallet first.`,
      code: "INSUFFICIENT_FUNDS",
      needed: totalAmount,
      available: walletBalance,
    });
    return;
  }

  // Deduct from wallet
  const newBalance = walletBalance - totalAmount;
  await db.update(walletsTable)
    .set({ balance: String(newBalance) })
    .where(eq(walletsTable.id, wallet.id));

  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    userId: user.id,
    type: "investment",
    amount: String(totalAmount),
    balanceAfter: String(newBalance),
    description: `Investment: ${quantity} share${quantity > 1 ? "s" : ""} purchased`,
    reference: `inv_${Date.now()}`,
    status: "completed",
  });

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

  // Notify farmer that they received investment
  if (farm) {
    notifyUser(
      farm.farmerId,
      "investment_received",
      "💰 New Investment Received!",
      `${user.name} invested KES ${Number(totalAmount).toLocaleString("en-KE")} in ${farm.name} (${quantity} share${quantity > 1 ? "s" : ""}).`,
      "/farmer"
    ).catch(() => {});
  }

  // Deduct from investor wallet simultaneously
  try {
    const [investorWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
    if (investorWallet) {
      const currentBal = parseFloat(investorWallet.balance);
      const newBal = Math.max(0, currentBal - totalAmount);
      await db.update(walletsTable)
        .set({ balance: String(newBal), updatedAt: new Date() })
        .where(eq(walletsTable.id, investorWallet.id));
      await db.insert(walletTransactionsTable).values({
        walletId: investorWallet.id,
        userId: user.id,
        type: "investment" as const,
        amount: String(totalAmount),
        balanceAfter: String(newBal),
        description: `${quantity} share${quantity > 1 ? "s" : ""} in ${farm?.name ?? "farm"}`,
        reference: `INV-${tx.id}`,
        status: "completed",
      });
    }
  } catch (e) { console.error("[WALLET_DEDUCT]", e); }

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
