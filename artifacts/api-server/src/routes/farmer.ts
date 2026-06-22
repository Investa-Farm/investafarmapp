import { Router, type IRouter } from "express";
import { db, farmsTable, investmentsTable, farmUpdatesTable, marketListingsTable, usersTable, notificationsTable, loanApplicationsTable, voucherOrdersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { CreateFarmUpdateBody } from "@workspace/api-zod";
import { getCurrentUser } from "./auth";
import { notifyUser } from "../lib/push";
import { sendFarmUpdateEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function farmToJson(farm: typeof farmsTable.$inferSelect, farmerName: string) {
  return {
    id: farm.id,
    farmerId: farm.farmerId,
    farmerName,
    name: farm.name,
    cropType: farm.cropType,
    location: farm.location,
    loanAmount: Number(farm.loanAmount),
    totalShares: farm.totalShares,
    sharePrice: Number(farm.sharePrice),
    sharesAvailable: farm.sharesAvailable,
    fundingPercent: Math.round(((farm.totalShares - farm.sharesAvailable) / farm.totalShares) * 100),
    status: farm.status,
    imageUrl: farm.imageUrl ?? undefined,
    changePercent: Number(farm.changePercent),
    tradeCount: farm.tradeCount,
    currentPrice: Number(farm.currentPrice),
    description: farm.description ?? undefined,
    createdAt: farm.createdAt.toISOString(),
  };
}

router.get("/farmer/dashboard", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const farms = await db.select().from(farmsTable).where(eq(farmsTable.farmerId, user.id));
  const allInvestors = await db.select().from(investmentsTable);
  const myFarmIds = farms.map(f => f.id);
  const myInvestors = allInvestors.filter(i => myFarmIds.includes(i.farmId));

  const farmValue = farms.reduce((sum, f) => sum + Number(f.currentPrice) * f.totalShares, 0);
  const fundsRaised = farms.reduce((sum, f) => sum + (Number(f.loanAmount) * (f.totalShares - f.sharesAvailable) / f.totalShares), 0);
  const fundingTarget = farms.reduce((sum, f) => sum + Number(f.loanAmount), 0);
  const fundingPercent = fundingTarget > 0 ? Math.round((fundsRaised / fundingTarget) * 100) : 0;

  const hasFarms = farms.length > 0;

  const avgChangePercent = hasFarms
    ? farms.reduce((sum, f) => sum + Number(f.changePercent), 0) / farms.length
    : 0;
  const weeklyRate = avgChangePercent / 100;
  const priceHistory = hasFarms
    ? Array.from({ length: 7 }, (_, i) => ({
        label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
        value: Math.round(farmValue * (1 - weeklyRate + (weeklyRate * i) / 6)),
      }))
    : [];

  // Derive growth stage and percent from the first active farm's funding progress
  const firstFarm = farms[0];
  let growthStage: string | null = null;
  let growthPercent: number | null = null;
  let harvestDays: number | null = null;
  let weekChangePercent: number | null = null;

  if (firstFarm) {
    const funded = (firstFarm.totalShares - firstFarm.sharesAvailable) / firstFarm.totalShares;
    growthPercent = Math.round(funded * 100);
    weekChangePercent = Number(firstFarm.changePercent) || null;

    // Map funding progress to crop stage
    if (funded < 0.2)       growthStage = "planting";
    else if (funded < 0.4)  growthStage = "vegetative";
    else if (funded < 0.65) growthStage = "flowering";
    else if (funded < 0.85) growthStage = "fruiting";
    else                    growthStage = "harvest";

    // Rough harvest estimate: 90–180 days from listing, reduced by funding progress
    const ageMs = Date.now() - firstFarm.createdAt.getTime();
    const ageDays = Math.floor(ageMs / 86_400_000);
    const totalSeasonDays = 150;
    harvestDays = Math.max(0, totalSeasonDays - ageDays);
  }

  res.json({
    farmValue,
    weekChangePercent,
    fundsRaised,
    fundingTarget,
    fundingPercent,
    profit: fundsRaised * 0.1,
    fundsReceived: fundsRaised,
    growthStage,
    growthPercent,
    harvestDays,
    activeFarms: farms.length,
    totalInvestors: new Set(myInvestors.map(i => i.investorId)).size,
    priceHistory,
  });
});

router.get("/farmer/farms", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const farms = await db.select().from(farmsTable).where(eq(farmsTable.farmerId, user.id));
  res.json(farms.map(f => farmToJson(f, user.name)));
});

router.get("/farmer/updates", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const farms = await db.select().from(farmsTable).where(eq(farmsTable.farmerId, user.id));
  const farmIds = farms.map(f => f.id);
  if (farmIds.length === 0) {
    res.json([]);
    return;
  }
  const updates = await db.select().from(farmUpdatesTable);
  const myUpdates = updates.filter(u => farmIds.includes(u.farmId));
  res.json(myUpdates.map(u => {
    const farm = farms.find(f => f.id === u.farmId);
    const hoursAgo = Math.floor((Date.now() - u.createdAt.getTime()) / 3600000);
    return {
      id: u.id,
      farmId: u.farmId,
      farmName: farm?.name ?? "Farm",
      title: u.title,
      description: u.description,
      imageUrl: u.imageUrl ?? undefined,
      hoursAgo,
      createdAt: u.createdAt.toISOString(),
    };
  }));
});

router.post("/farmer/updates", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateFarmUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [farm] = await db.select().from(farmsTable)
    .where(and(eq(farmsTable.id, parsed.data.farmId), eq(farmsTable.farmerId, user.id)));
  if (!farm) {
    res.status(403).json({ error: "Farm not found or not authorized" });
    return;
  }
  const [update] = await db.insert(farmUpdatesTable).values({
    farmId: parsed.data.farmId,
    title: parsed.data.title,
    description: parsed.data.description,
    imageUrl: parsed.data.imageUrl ?? null,
  }).returning();

  // Notify all investors who hold shares in this farm
  try {
    const investors = await db.select({ investorId: investmentsTable.investorId })
      .from(investmentsTable).where(eq(investmentsTable.farmId, parsed.data.farmId));
    const uniqueIds = [...new Set(investors.map(i => i.investorId))];
    for (const investorId of uniqueIds) {
      notifyUser(
        investorId,
        "farm_update",
        `🌱 ${farm.name}`,
        parsed.data.title,
        `/market/${farm.id}`
      ).catch(() => {});
    }
    // Email notifications
    if (uniqueIds.length > 0) {
      const investorUsers = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
        .from(usersTable)
        .where(inArray(usersTable.id, uniqueIds));
      for (const investor of investorUsers) {
        sendFarmUpdateEmail(
          investor.email,
          investor.name,
          farm.name,
          parsed.data.title,
          parsed.data.description,
          farm.id
        ).catch(() => {});
      }
    }
  } catch (e) {
    logger.error({ err: e }, "[FARM_UPDATE] Failed to send notifications");
  }

  res.status(201).json({
    id: update.id,
    farmId: update.farmId,
    farmName: farm.name,
    title: update.title,
    description: update.description,
    imageUrl: update.imageUrl ?? undefined,
    hoursAgo: 0,
    createdAt: update.createdAt.toISOString(),
  });
});

const BUYER_CATALOG: Record<string, Array<{ name: string; price: number; priceUnit: string; quantity: number; location: string; region: string; duration: string; rating: number; contracts: number; onTime: number; color: string; bestPrice?: boolean }>> = {
  tomatoes:  [
    { name: "Green Harvest Ltd.", price: 450, priceUnit: "Ton", quantity: 50, location: "Nairobi", region: "Central", duration: "60 Days", rating: 4.9, contracts: 1248, onTime: 99, color: "#0B6B3A", bestPrice: true },
    { name: "FreshLink Traders",  price: 435, priceUnit: "Ton", quantity: 80, location: "Kisumu",  region: "Nyanza",   duration: "45 Days", rating: 4.7, contracts: 876,  onTime: 97, color: "#1a6b4a" },
    { name: "Agri Export Co.",    price: 470, priceUnit: "Ton", quantity: 120,location: "Mombasa", region: "Coast",     duration: "90 Days", rating: 4.8, contracts: 2100, onTime: 98, color: "#22A45D" },
  ],
  maize: [
    { name: "Nakuru Grain Traders",  price: 380, priceUnit: "Ton", quantity: 200, location: "Nakuru",  region: "Rift Valley", duration: "30 Days", rating: 4.6, contracts: 540, onTime: 95, color: "#c97f2b", bestPrice: true },
    { name: "Unga Holdings Ltd.",    price: 365, priceUnit: "Ton", quantity: 500, location: "Nairobi", region: "Central",     duration: "60 Days", rating: 4.8, contracts: 3200,onTime: 98, color: "#a0522d" },
    { name: "Eldoret Grain Millers", price: 370, priceUnit: "Ton", quantity: 300, location: "Eldoret", region: "North Rift",  duration: "45 Days", rating: 4.5, contracts: 890, onTime: 93, color: "#b8860b" },
  ],
  avocado: [
    { name: "Highlands Export Ltd.", price: 520, priceUnit: "Ton", quantity: 60,  location: "Eldoret",  region: "North Rift", duration: "60 Days", rating: 4.9, contracts: 312,  onTime: 98, color: "#1d6b3a", bestPrice: true },
    { name: "Kakuzi Fresh",          price: 490, priceUnit: "Ton", quantity: 100, location: "Murang'a", region: "Central",    duration: "45 Days", rating: 4.7, contracts: 780,  onTime: 96, color: "#2e7d32" },
  ],
  coffee: [
    { name: "Kenya Coffee Traders",  price: 850, priceUnit: "Kg",  quantity: 10,  location: "Nairobi", region: "Central",   duration: "30 Days", rating: 4.9, contracts: 2100, onTime: 99, color: "#4e342e", bestPrice: true },
    { name: "Dorman's Coffee",       price: 820, priceUnit: "Kg",  quantity: 20,  location: "Nairobi", region: "Central",   duration: "60 Days", rating: 4.8, contracts: 1560, onTime: 97, color: "#6d4c41" },
  ],
  tea: [
    { name: "KTDA (Kenya Tea)",      price: 32,  priceUnit: "Kg",  quantity: 5000, location: "Nairobi",  region: "Central",  duration: "90 Days", rating: 4.9, contracts: 5400, onTime: 99, color: "#2d6a4f", bestPrice: true },
    { name: "Williamson Tea Kenya",  price: 30,  priceUnit: "Kg",  quantity: 3000, location: "Kericho",  region: "Rift Valley",duration: "30 Days",rating: 4.7, contracts: 980,  onTime: 96, color: "#1b5e20" },
  ],
  wheat: [
    { name: "Grain Bulk Handlers",   price: 45,  priceUnit: "Kg",  quantity: 1000, location: "Nakuru",  region: "Rift Valley", duration: "30 Days", rating: 4.6, contracts: 340, onTime: 94, color: "#f9a825", bestPrice: true },
    { name: "Kenya Unga Ltd.",        price: 43,  priceUnit: "Kg",  quantity: 2000, location: "Nairobi", region: "Central",     duration: "60 Days", rating: 4.8, contracts: 870, onTime: 97, color: "#e65100" },
  ],
  potatoes: [
    { name: "Meru Fresh Connect",    price: 290, priceUnit: "Ton", quantity: 40,  location: "Meru",    region: "Mt Kenya",    duration: "21 Days", rating: 4.5, contracts: 183, onTime: 94, color: "#795548", bestPrice: true },
    { name: "Nairobi Wholesale Mkt", price: 270, priceUnit: "Ton", quantity: 100, location: "Nairobi", region: "Central",     duration: "14 Days", rating: 4.3, contracts: 560, onTime: 91, color: "#8d6e63" },
  ],
};

router.get("/farmer/market/buyers", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const farms = await db.select().from(farmsTable).where(eq(farmsTable.farmerId, user.id));
  const cropTypes = [...new Set(farms.map(f => f.cropType.toLowerCase().split(" ")[0]!))];

  const buyers: Array<{ id: number; cropType: string } & typeof BUYER_CATALOG[string][number]> = [];
  let idCounter = 1;

  for (const crop of cropTypes) {
    const catalog = BUYER_CATALOG[crop];
    if (catalog) {
      for (const buyer of catalog) {
        buyers.push({ id: idCounter++, cropType: crop, ...buyer });
      }
    }
  }

  if (buyers.length === 0) {
    const fallbackCrops = ["maize", "tomatoes"];
    for (const crop of fallbackCrops) {
      const catalog = BUYER_CATALOG[crop] ?? [];
      for (const buyer of catalog.slice(0, 1)) {
        buyers.push({ id: idCounter++, cropType: crop, ...buyer });
      }
    }
  }

  res.json({ buyers, hasFarms: farms.length > 0 });
});

router.post("/farmer/market/connect", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { buyerName, cropType, quantity, targetFarmerId } = req.body as {
    buyerName?: string; cropType?: string; quantity?: number; targetFarmerId?: number;
  };
  if (!buyerName) { res.status(400).json({ error: "buyerName required" }); return; }

  // Notify the requesting farmer (confirmation)
  await db.insert(notificationsTable).values({
    userId: user.id,
    type: "buyer_connect",
    title: "Buyer Connection Request Sent",
    body: `Your connection request to ${buyerName} for ${cropType ?? "your crop"} (${quantity ?? "?"} tons) has been submitted. They will contact you within 24 hours.`,
    isRead: false,
  }).catch(() => {});

  // If connecting FROM agribusiness TO a specific farmer, push-notify the farmer
  if (targetFarmerId && targetFarmerId !== user.id) {
    await db.insert(notificationsTable).values({
      userId: targetFarmerId,
      type: "input_connection",
      title: `📦 Input Supply Offer — ${buyerName}`,
      body: `${buyerName} wants to supply inputs for your ${cropType ?? "farm"}. Tap to review and accept or decline.`,
      isRead: false,
    }).catch(() => {});

    notifyUser(
      targetFarmerId,
      "input_connection",
      `📦 Input Supply Offer`,
      `${buyerName} wants to supply inputs for your ${cropType ?? "farm"}. Open the app to review.`,
    ).catch(() => {});
  }

  res.json({ success: true, message: `Connection request sent to ${buyerName}. They will reach out within 24 hours.` });
});

router.post("/farmer/market/crop-proposal", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "farmer") { res.status(403).json({ error: "Farmers only" }); return; }

  const { cropType, acreage, expectedYield, plantingDate, location, description } = req.body as {
    cropType?: string; acreage?: number; expectedYield?: number;
    plantingDate?: string; location?: string; description?: string;
  };

  if (!cropType || !acreage || !location) {
    res.status(400).json({ error: "cropType, acreage, and location are required" });
    return;
  }

  const loanAmount = (acreage ?? 1) * 15000;
  const totalShares = Math.ceil(loanAmount / 100);

  const [farm] = await db.insert(farmsTable).values({
    farmerId: user.id,
    name: `${user.name}'s ${cropType} Farm`,
    cropType,
    location,
    loanAmount: String(loanAmount),
    totalShares,
    sharePrice: "100",
    sharesAvailable: totalShares,
    currentPrice: "100",
    status: "pending",
    description: description ?? `Proposed ${cropType} crop on ${acreage} acres. Expected yield: ${expectedYield ?? "TBD"} tons. Planting: ${plantingDate ?? "Next season"}.`,
    changePercent: "0",
    tradeCount: 0,
  }).returning();

  res.status(201).json({
    id: farm!.id,
    message: `Crop proposal for ${cropType} submitted successfully. It will be reviewed and listed for investor funding.`,
    farm: farm,
  });
});

router.post("/farmer/voucher-redeem", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "farmer") { res.status(403).json({ error: "Farmers only" }); return; }

  const { agribusinessId, voucherCode, loanId, items } = req.body as {
    agribusinessId: number; voucherCode: string; loanId: number; items: string[];
  };
  if (!agribusinessId || !voucherCode || !loanId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "agribusinessId, voucherCode, loanId, and items are required" });
    return;
  }

  const [loan] = await db.select().from(loanApplicationsTable)
    .where(and(eq(loanApplicationsTable.id, loanId), eq(loanApplicationsTable.farmerId, user.id)));
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }
  if (loan.status !== "disbursed") {
    res.status(400).json({ error: "Voucher is only available after the farm is fully funded and disbursed" }); return;
  }

  const [agribiz] = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(and(eq(usersTable.id, agribusinessId), eq(usersTable.role, "agribusiness")));
  if (!agribiz) { res.status(400).json({ error: "Supplier not found" }); return; }

  try {
    const [order] = await db.insert(voucherOrdersTable).values({
      agribusinessId,
      farmerId: user.id,
      voucherCode,
      amount: loan.amount,
      items: JSON.stringify(items),
      status: "pending",
      farmerPhone: user.phone ?? undefined,
      farmerLocation: user.county ?? undefined,
    }).returning();

    notifyUser(agribiz.id, "voucher_order", "New Input Order", `Order from ${user.name} — voucher ${voucherCode}`)
      .catch(e => logger.error({ err: e }, "[VOUCHER_REDEEM] notify failed"));

    res.status(201).json({ id: order!.id, voucherCode, status: "pending", supplierName: agribiz.name });
  } catch (e) {
    logger.error({ err: e }, "[VOUCHER_REDEEM] Failed to create order");
    res.status(500).json({ error: "Failed to place order" });
  }
});

const CROP_SEASON_DAYS: Record<string, number> = {
  maize: 120, tomatoes: 90, coffee: 180, tea: 365, wheat: 120,
  avocado: 180, potatoes: 90, rice: 150, kale: 60, sunflower: 120, cabbage: 75,
};

const CROP_MARKET_PRICE_KES: Record<string, number> = {
  maize: 3800, tomatoes: 4200, coffee: 7800, tea: 3200, wheat: 4500,
  avocado: 5600, potatoes: 2900, rice: 5200, kale: 2100, sunflower: 3600, cabbage: 2400,
};

router.get("/farmer/growth/:farmId", async (req, res): Promise<void> => {
  const farmId = parseInt(req.params.farmId!);
  if (isNaN(farmId)) { res.status(400).json({ error: "Invalid farm id" }); return; }

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId));
  if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

  const cropKey = farm.cropType.toLowerCase().split(" ")[0]!;
  const daysTotal = CROP_SEASON_DAYS[cropKey] ?? 120;
  const ageMs = Date.now() - farm.createdAt.getTime();
  const daysElapsed = Math.min(daysTotal, Math.max(1, Math.floor(ageMs / 86_400_000)));
  const progressRatio = daysElapsed / daysTotal;

  let stage: string;
  if (progressRatio < 0.15)      stage = "planting";
  else if (progressRatio < 0.35) stage = "vegetative";
  else if (progressRatio < 0.6)  stage = "flowering";
  else if (progressRatio < 0.85) stage = "fruiting";
  else                            stage = "harvest";

  const percent = Math.round(progressRatio * 100);
  const marketChangePercent = Number(farm.changePercent);
  const marketPriceKes = CROP_MARKET_PRICE_KES[cropKey] ?? 4000;

  let marketInsight: string;
  if (marketChangePercent > 3)       marketInsight = `${farm.cropType} prices are surging — ideal harvest window approaching.`;
  else if (marketChangePercent > 0)  marketInsight = `${farm.cropType} prices are stable with a positive trend.`;
  else if (marketChangePercent > -3) marketInsight = `${farm.cropType} prices are slightly down — monitor closely.`;
  else                               marketInsight = `${farm.cropType} market is under pressure. Consider forward contracts.`;

  res.json({ stage, percent, daysElapsed, daysTotal, marketChangePercent, marketPriceKes, marketInsight });
});

export default router;
