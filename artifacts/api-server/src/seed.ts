import bcrypt from "bcrypt";
import { db, usersTable, farmsTable, marketListingsTable, walletsTable, walletTransactionsTable, investmentsTable, kycDocumentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const DEMO_USERS = [
  { email: "john.farmer@investafarm.com",   password: "password123", name: "John Kamau",         role: "farmer"       as const },
  { email: "david.investor@investafarm.com",password: "password123", name: "David Mwangi",       role: "investor"     as const },
  { email: "demo.farmer@investafarm.com",   password: "password123", name: "Demo Farmer",         role: "farmer"       as const },
  { email: "demo.investor@investafarm.com", password: "password123", name: "Demo Investor",       role: "investor"     as const },
  { email: "demo.coop@investafarm.com",     password: "password123", name: "Demo Coop",           role: "cooperative"  as const },
  { email: "admin@investafarm.com",         password: "admin2024!",  name: "Platform Admin",      role: "admin"        as const },
  { email: "grace.farmer@investafarm.com",  password: "password123", name: "Grace Wanjiku",       role: "farmer"       as const },
  { email: "peter.farmer@investafarm.com",  password: "password123", name: "Peter Otieno",        role: "farmer"       as const },
  { email: "demo.agent@investafarm.com",    password: "password123", name: "Demo Sales Agent",    role: "agribusiness" as const },
  { email: "demo.offtaker@investafarm.com", password: "password123", name: "Demo Offtaker",       role: "agribusiness" as const },
];

const DEMO_FARMS = [
  {
    name: "Kamau Coffee Estate",
    cropType: "Coffee",
    location: "Kiambu, Central Kenya",
    loanAmount: "850000",
    totalShares: 8500,
    sharePrice: "100",
    sharesAvailable: 3200,
    changePercent: "8.24",
    tradeCount: 142,
    currentPrice: "108",
    description: "Premium arabica coffee farm on the slopes of the Aberdare ranges. Award-winning single-origin beans exported to Europe.",
    status: "active" as const,
  },
  {
    name: "Rift Valley Maize Farms",
    cropType: "Maize",
    location: "Nakuru, Rift Valley",
    loanAmount: "1200000",
    totalShares: 12000,
    sharePrice: "100",
    sharesAvailable: 4800,
    changePercent: "3.15",
    tradeCount: 89,
    currentPrice: "103",
    description: "Large-scale hybrid maize production serving Nakuru county markets. 3rd generation family farm with modern irrigation.",
    status: "active" as const,
  },
  {
    name: "Kirinyaga Tea Cooperative",
    cropType: "Tea",
    location: "Kirinyaga, Mt. Kenya Region",
    loanAmount: "2100000",
    totalShares: 21000,
    sharePrice: "100",
    sharesAvailable: 7500,
    changePercent: "12.60",
    tradeCount: 215,
    currentPrice: "113",
    description: "High-altitude KTDA-affiliated tea farm at 2,100m. Purple tea and green tea varieties fetching premium export prices.",
    status: "active" as const,
  },
  {
    name: "Laikipia Avocado Orchards",
    cropType: "Avocado",
    location: "Laikipia, Central Rift",
    loanAmount: "650000",
    totalShares: 6500,
    sharePrice: "100",
    sharesAvailable: 2800,
    changePercent: "6.80",
    tradeCount: 77,
    currentPrice: "107",
    description: "Hass avocado orchard supplying EU export markets via Flamingo Horticulture. GlobalGAP certified.",
    status: "active" as const,
  },
  {
    name: "Meru Macadamia Plantation",
    cropType: "Macadamia",
    location: "Meru, Eastern Kenya",
    loanAmount: "980000",
    totalShares: 9800,
    sharePrice: "100",
    sharesAvailable: 5500,
    changePercent: "15.40",
    tradeCount: 166,
    currentPrice: "115",
    description: "Macadamia nut farm with processing unit. Premium grade nuts exported to Asia and Middle East markets.",
    status: "active" as const,
  },
  {
    name: "Wanjiku Fresh Tomatoes",
    cropType: "Tomatoes",
    location: "Thika, Kiambu County",
    loanAmount: "420000",
    totalShares: 4200,
    sharePrice: "100",
    sharesAvailable: 1900,
    changePercent: "-2.10",
    tradeCount: 53,
    currentPrice: "98",
    description: "Greenhouse tomato farm supplying Nairobi supermarket chains. Drip irrigation system with solar pumping.",
    status: "active" as const,
  },
  {
    name: "Otieno Rice Fields",
    cropType: "Rice",
    location: "Ahero, Kisumu County",
    loanAmount: "750000",
    totalShares: 7500,
    sharePrice: "100",
    sharesAvailable: 3100,
    changePercent: "4.50",
    tradeCount: 94,
    currentPrice: "105",
    description: "Irrigated paddy rice in the Ahero Irrigation Scheme. Supplying Kisumu and Nairobi supermarkets.",
    status: "active" as const,
  },
  {
    name: "Narok Sunflower Collective",
    cropType: "Sorghum",
    location: "Narok, Rift Valley",
    loanAmount: "540000",
    totalShares: 5400,
    sharePrice: "100",
    sharesAvailable: 2200,
    changePercent: "7.30",
    tradeCount: 61,
    currentPrice: "107",
    description: "Drought-resistant sorghum and sunflower intercropping. Selling to local millers and biofuel processors.",
    status: "active" as const,
  },
];

export async function seedDemoUsers(log: (msg: string) => void = console.log) {
  const createdUsers: Record<string, number> = {};

  for (const u of DEMO_USERS) {
    try {
      const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, u.email));
      if (existing) {
        createdUsers[u.email] = existing.id;
        // Only update if email not yet verified — avoid expensive bcrypt re-hash on every restart
        if (!existing.emailVerified) {
          await db.update(usersTable)
            .set({ emailVerified: true })
            .where(eq(usersTable.email, u.email));
          log(`[seed] Auto-verified demo account: ${u.email}`);
        }
      } else {
        const passwordHash = await bcrypt.hash(u.password, 10);
        const [inserted] = await db.insert(usersTable)
          .values({ email: u.email, passwordHash, name: u.name, role: u.role, emailVerified: true })
          .returning({ id: usersTable.id });
        createdUsers[u.email] = inserted!.id;
        log(`[seed] Created: ${u.email} (${u.role})`);
      }
    } catch (err) {
      log(`[seed] Skipped ${u.email}: ${String(err)}`);
    }
  }

  await seedFarmsAndListings(createdUsers, log);
  await seedDemoWallets(createdUsers, log);
  await seedDemoKyc(createdUsers, log);
}

async function seedDemoKyc(userIds: Record<string, number>, log: (msg: string) => void) {
  const farmerEmails = [
    "john.farmer@investafarm.com",
    "demo.farmer@investafarm.com",
    "grace.farmer@investafarm.com",
    "peter.farmer@investafarm.com",
  ];
  for (const email of farmerEmails) {
    const userId = userIds[email];
    if (!userId) continue;
    const existing = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, userId));
    if (existing.length > 0) continue;
    await db.insert(kycDocumentsTable).values([
      {
        userId,
        docType: "national_id" as const,
        title: "National ID",
        fileUrl: "",
        status: "approved" as const,
        notes: "Demo — auto-approved",
        reviewedAt: new Date(),
      },
      {
        userId,
        docType: "farm_report" as const,
        title: "Farm Report",
        fileUrl: "",
        status: "approved" as const,
        notes: "Demo — auto-approved",
        reviewedAt: new Date(),
      },
    ]);
    log(`[seed] KYC approved for ${email}`);
  }
}

const DEMO_WALLET_BALANCES: Record<string, number> = {
  "david.investor@investafarm.com":   150000,
  "demo.investor@investafarm.com":     75000,
  "john.farmer@investafarm.com":       25000,
  "demo.farmer@investafarm.com":       15000,
  "grace.farmer@investafarm.com":      20000,
  "peter.farmer@investafarm.com":      18000,
  "demo.agent@investafarm.com":        50000,
  "demo.offtaker@investafarm.com":     80000,
};

async function seedDemoWallets(userIds: Record<string, number>, log: (msg: string) => void) {
  for (const [email, balance] of Object.entries(DEMO_WALLET_BALANCES)) {
    const userId = userIds[email];
    if (!userId) continue;
    try {
      const [existing] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
      if (existing && parseFloat(existing.balance) > 0) continue;
      if (existing) {
        await db.update(walletsTable)
          .set({ balance: String(balance), updatedAt: new Date() })
          .where(eq(walletsTable.id, existing.id));
      } else {
        const [wallet] = await db.insert(walletsTable)
          .values({ userId, balance: String(balance), currency: "KES" })
          .returning();
        await db.insert(walletTransactionsTable).values({
          walletId: wallet!.id,
          userId,
          type: "deposit",
          amount: String(balance),
          balanceAfter: String(balance),
          description: "Demo account starter balance",
          reference: `DEMO-SEED-${userId}`,
          status: "completed",
        });
      }
      log(`[seed] Wallet funded: ${email} → KES ${balance.toLocaleString()}`);
    } catch (err) {
      log(`[seed] Wallet skip ${email}: ${String(err)}`);
    }
  }
  await seedDemoInvestments(userIds, log);
}

async function seedDemoInvestments(userIds: Record<string, number>, log: (msg: string) => void) {
  const investorId = userIds["david.investor@investafarm.com"] ?? userIds["demo.investor@investafarm.com"];
  if (!investorId) return;

  const existingInvestments = await db.select().from(investmentsTable)
    .where(eq(investmentsTable.investorId, investorId));
  if (existingInvestments.length > 0) return;

  const farms = await db.select().from(farmsTable).limit(5);
  if (farms.length === 0) return;

  const demoInvestments = [
    { shares: 500,  exitType: "full_season" },
    { shares: 800,  exitType: "full_season" },
    { shares: 400,  exitType: "mid_season"  },
    { shares: 600,  exitType: "full_season" },
    { shares: 300,  exitType: "mid_season"  },
  ];

  for (let i = 0; i < Math.min(farms.length, demoInvestments.length); i++) {
    const farm = farms[i]!;
    const cfg = demoInvestments[i]!;
    try {
      await db.insert(investmentsTable).values({
        investorId,
        farmId: farm.id,
        quantity: cfg.shares,
        purchasePrice: farm.sharePrice,
        exitType: cfg.exitType,
        status: "active",
      });
      log(`[seed] Investment: ${farm.name} — ${cfg.shares} shares for investor ${investorId}`);
    } catch (err) {
      log(`[seed] Investment skip ${farm.name}: ${String(err)}`);
    }
  }
}

async function seedFarmsAndListings(userIds: Record<string, number>, log: (msg: string) => void) {
  const existingFarms = await db.select().from(farmsTable).limit(1);
  if (existingFarms.length > 0) {
    // Reset changePercent and currentPrice to seed values on every restart
    // (prevents scheduler from leaving stale extreme values between restarts)
    // Match by both name AND known farmer IDs to avoid touching non-demo farms.
    const demoFarmerIds = Object.values(userIds).filter(Boolean);
    const allFarms = await db.select({ id: farmsTable.id, name: farmsTable.name, farmerId: farmsTable.farmerId }).from(farmsTable);
    for (const farm of DEMO_FARMS) {
      const match = allFarms.find(f => f.name === farm.name && demoFarmerIds.includes(f.farmerId));
      if (!match) continue;
      await db.update(farmsTable)
        .set({ changePercent: farm.changePercent, currentPrice: farm.currentPrice })
        .where(eq(farmsTable.id, match.id))
        .catch(() => {});
    }
    await seedSecondaryListings(userIds, log);
    return;
  }

  log("[seed] Seeding demo farms and listings…");

  const farmerEmails = [
    "john.farmer@investafarm.com",
    "john.farmer@investafarm.com",
    "grace.farmer@investafarm.com",
    "grace.farmer@investafarm.com",
    "peter.farmer@investafarm.com",
    "john.farmer@investafarm.com",
    "peter.farmer@investafarm.com",
    "grace.farmer@investafarm.com",
  ];

  const createdFarmIds: number[] = [];

  for (let i = 0; i < DEMO_FARMS.length; i++) {
    const farm = DEMO_FARMS[i]!;
    const farmerEmail = farmerEmails[i]!;
    const farmerId = userIds[farmerEmail];
    if (!farmerId) continue;

    const [inserted] = await db.insert(farmsTable).values({
      ...farm,
      farmerId,
    }).returning({ id: farmsTable.id });

    createdFarmIds.push(inserted!.id);
    log(`[seed] Farm: ${farm.name}`);

    await db.insert(marketListingsTable).values({
      farmId: inserted!.id,
      sellerId: farmerId,
      listingType: "primary",
      sharesAvailable: farm.sharesAvailable,
      pricePerShare: farm.currentPrice,
      isActive: 1,
    });
    log(`[seed] Primary listing for ${farm.name}`);
  }

  await seedSecondaryListings(userIds, log, createdFarmIds);
}

async function seedSecondaryListings(
  userIds: Record<string, number>,
  log: (msg: string) => void,
  farmIds?: number[]
) {
  const existing = await db
    .select()
    .from(marketListingsTable)
    .where(and(eq(marketListingsTable.listingType, "secondary"), eq(marketListingsTable.isActive, 1)));

  if (existing.length > 0) return;

  const investorId = userIds["david.investor@investafarm.com"] ?? userIds["demo.investor@investafarm.com"];
  if (!investorId) return;

  let farms: { id: number; currentPrice: string; name: string }[] = [];
  if (farmIds && farmIds.length > 0) {
    const allFarms = await db.select().from(farmsTable).limit(8);
    farms = allFarms.filter(f => farmIds.includes(f.id)).slice(0, 5);
  } else {
    farms = await db.select().from(farmsTable).limit(5);
  }

  if (farms.length === 0) return;

  const resaleConfigs = [
    { priceMultiplier: 0.92, shares: 150 },
    { priceMultiplier: 1.05, shares: 80  },
    { priceMultiplier: 0.98, shares: 200 },
    { priceMultiplier: 1.12, shares: 60  },
    { priceMultiplier: 1.03, shares: 120 },
  ];

  for (let i = 0; i < Math.min(farms.length, 5); i++) {
    const farm = farms[i]!;
    const cfg = resaleConfigs[i]!;
    const price = Math.round(Number(farm.currentPrice) * cfg.priceMultiplier);

    await db.insert(marketListingsTable).values({
      farmId: farm.id,
      sellerId: investorId,
      listingType: "secondary",
      sharesAvailable: cfg.shares,
      pricePerShare: String(price),
      isActive: 1,
    });
    log(`[seed] Secondary listing: ${farm.name} — ${cfg.shares} shares @ KES ${price}`);
  }
}
