import bcrypt from "bcrypt";
import { db, usersTable, farmsTable, marketListingsTable, walletsTable, walletTransactionsTable, investmentsTable, kycDocumentsTable, cooperativeMembersTable, agribusinessConnectionsTable, voucherOrdersTable, loanApplicationsTable, notificationsTable } from "@workspace/db";
import { eq, and, count, inArray } from "drizzle-orm";

// ── Realistic Kenyan demo accounts ──────────────────────────────────────────

const DEMO_USERS = [
  // Core accounts — gmail style (no @investafarm.com except admin)
  { email: "john.kamau.farm@gmail.com",         password: "password123", name: "John Kamau",             role: "farmer"       as const },
  { email: "david.mwangi.inv@gmail.com",        password: "password123", name: "David Mwangi",           role: "investor"     as const },
  { email: "admin@investafarm.com",             password: "admin2024!",  name: "Platform Admin",         role: "admin"        as const },
  { email: "grace.wanjiku.ke@gmail.com",        password: "password123", name: "Grace Wanjiku",          role: "farmer"       as const },
  { email: "peter.otieno.farm@gmail.com",       password: "password123", name: "Peter Otieno",           role: "farmer"       as const },
  { email: "mwea.coop.ke@gmail.com",            password: "password123", name: "Mwea Farmers Coop",      role: "cooperative"  as const },
  { email: "samuel.njoroge.ke@gmail.com",       password: "password123", name: "Samuel Njoroge",         role: "agribusiness" as const },
  { email: "rift.valley.buyers@gmail.com",      password: "password123", name: "Rift Valley Buyers Ltd", role: "agribusiness" as const },
  // Extra farmers — real Kenyan names / realistic emails
  { email: "mary.akinyi254@gmail.com",          password: "password123", name: "Mary Akinyi",            role: "farmer"       as const },
  { email: "jmwangi.farm@gmail.com",            password: "password123", name: "James Mwangi",           role: "farmer"       as const },
  { email: "fatuma.hassan.ke@gmail.com",        password: "password123", name: "Fatuma Hassan",          role: "farmer"       as const },
  { email: "lucy.chebet01@yahoo.com",           password: "password123", name: "Lucy Chebet",            role: "farmer"       as const },
  { email: "danielomondi.ke@gmail.com",         password: "password123", name: "Daniel Omondi",          role: "farmer"       as const },
  { email: "sarah.wanjiru.ke@gmail.com",        password: "password123", name: "Sarah Wanjiru",          role: "farmer"       as const },
  { email: "mkipkemoi.tea@gmail.com",           password: "password123", name: "Moses Kipkemoi",         role: "farmer"       as const },
  // Extra investors — real Kenyan names / realistic emails
  { email: "alice.njeri.inv@gmail.com",         password: "password123", name: "Alice Njeri",            role: "investor"     as const },
  { email: "robert.kipchoge@gmail.com",         password: "password123", name: "Robert Kipchoge",        role: "investor"     as const },
  { email: "amina.m.invest@gmail.com",          password: "password123", name: "Amina Mohamed",          role: "investor"     as const },
  { email: "briano.odhiambo@gmail.com",         password: "password123", name: "Brian Odhiambo",         role: "investor"     as const },
  { email: "cwairimu.invest@outlook.com",       password: "password123", name: "Catherine Wairimu",      role: "investor"     as const },
  { email: "denniskamau.ke@gmail.com",          password: "password123", name: "Dennis Kamau",           role: "investor"     as const },
  { email: "esther.mutua.ke@gmail.com",         password: "password123", name: "Esther Mutua",           role: "investor"     as const },
  { email: "f.kariuki.invest@gmail.com",        password: "password123", name: "Francis Kariuki",        role: "investor"     as const },
  { email: "gloriaach254@gmail.com",            password: "password123", name: "Gloria Achieng",         role: "investor"     as const },
  { email: "hassanomar.ke@yahoo.com",           password: "password123", name: "Hassan Omar",            role: "investor"     as const },
  { email: "irene.wambui254@gmail.com",         password: "password123", name: "Irene Wambui",           role: "investor"     as const },
  // Pre-seeded viewer sub-accounts (read-only admin access)
  { email: "finance.investa.team@gmail.com",    password: "viewer2024!", name: "Finance Team",           role: "viewer"       as const },
  { email: "james.kariuki.ke@gmail.com",        password: "viewer2024!", name: "James Kariuki",          role: "viewer"       as const },
  // "Try demo account" buttons on the auth screens log in with these exact
  // @investafarm.com addresses — they must exist (and be funded) or the
  // demo buttons fail / show empty wallets.
  { email: "john.farmer@investafarm.com",       password: "password123", name: "John Farmer (Demo)",     role: "farmer"       as const },
  { email: "demo.farmer@investafarm.com",       password: "password123", name: "Demo Farmer",            role: "farmer"       as const },
  { email: "grace.farmer@investafarm.com",      password: "password123", name: "Grace Farmer (Demo)",    role: "farmer"       as const },
  { email: "peter.farmer@investafarm.com",      password: "password123", name: "Peter Farmer (Demo)",    role: "farmer"       as const },
  { email: "david.investor@investafarm.com",    password: "password123", name: "David Investor (Demo)",  role: "investor"     as const },
  { email: "demo.investor@investafarm.com",     password: "password123", name: "Demo Investor",          role: "investor"     as const },
  { email: "demo.coop@investafarm.com",         password: "password123", name: "Demo Cooperative",       role: "cooperative"  as const },
  { email: "demo.agent@investafarm.com",        password: "password123", name: "Demo Sales Agent",       role: "agribusiness" as const },
  { email: "demo.offtaker@investafarm.com",     password: "password123", name: "Demo Offtaker",          role: "agribusiness" as const },
];

// All farms — each has a farmerEmail mapping
const DEMO_FARMS = [
  {
    name: "Kamau Coffee Estate",        cropType: "Coffee",    farmerEmail: "john.kamau.farm@gmail.com",
    location: "Kiambu, Central Kenya",  loanAmount: "850000",  totalShares: 8500, sharePrice: "100",
    sharesAvailable: 3200, changePercent: "8.24",  tradeCount: 142, currentPrice: "108", status: "active" as const,
    description: "Premium arabica coffee farm on the slopes of the Aberdare ranges. Award-winning single-origin beans exported to Europe.",
  },
  {
    name: "Rift Valley Maize Farms",    cropType: "Maize",     farmerEmail: "john.kamau.farm@gmail.com",
    location: "Nakuru, Rift Valley",    loanAmount: "1200000", totalShares: 12000, sharePrice: "100",
    sharesAvailable: 4800, changePercent: "3.15",  tradeCount: 89,  currentPrice: "103", status: "active" as const,
    description: "Large-scale hybrid maize production serving Nakuru county markets. 3rd generation family farm with modern irrigation.",
  },
  {
    name: "Kirinyaga Tea Cooperative",  cropType: "Tea",       farmerEmail: "grace.wanjiku.ke@gmail.com",
    location: "Kirinyaga, Mt. Kenya Region", loanAmount: "2100000", totalShares: 21000, sharePrice: "100",
    sharesAvailable: 7500, changePercent: "12.60", tradeCount: 215, currentPrice: "113", status: "active" as const,
    description: "High-altitude KTDA-affiliated tea farm at 2,100m. Purple tea and green tea varieties fetching premium export prices.",
  },
  {
    name: "Laikipia Avocado Orchards",  cropType: "Avocado",   farmerEmail: "grace.wanjiku.ke@gmail.com",
    location: "Laikipia, Central Rift", loanAmount: "650000",  totalShares: 6500, sharePrice: "100",
    sharesAvailable: 2800, changePercent: "6.80",  tradeCount: 77,  currentPrice: "107", status: "active" as const,
    description: "Hass avocado orchard supplying EU export markets via Flamingo Horticulture. GlobalGAP certified.",
  },
  {
    name: "Meru Macadamia Plantation",  cropType: "Macadamia", farmerEmail: "peter.otieno.farm@gmail.com",
    location: "Meru, Eastern Kenya",    loanAmount: "980000",  totalShares: 9800, sharePrice: "100",
    sharesAvailable: 5500, changePercent: "15.40", tradeCount: 166, currentPrice: "115", status: "active" as const,
    description: "Macadamia nut farm with processing unit. Premium grade nuts exported to Asia and Middle East markets.",
  },
  {
    name: "Wanjiku Fresh Tomatoes",     cropType: "Tomatoes",  farmerEmail: "john.kamau.farm@gmail.com",
    location: "Thika, Kiambu County",   loanAmount: "420000",  totalShares: 4200, sharePrice: "100",
    sharesAvailable: 1900, changePercent: "-2.10", tradeCount: 53,  currentPrice: "98",  status: "active" as const,
    description: "Greenhouse tomato farm supplying Nairobi supermarket chains. Drip irrigation system with solar pumping.",
  },
  {
    name: "Otieno Rice Fields",         cropType: "Rice",      farmerEmail: "peter.otieno.farm@gmail.com",
    location: "Ahero, Kisumu County",   loanAmount: "750000",  totalShares: 7500, sharePrice: "100",
    sharesAvailable: 3100, changePercent: "4.50",  tradeCount: 94,  currentPrice: "105", status: "active" as const,
    description: "Irrigated paddy rice in the Ahero Irrigation Scheme. Supplying Kisumu and Nairobi supermarkets.",
  },
  {
    name: "Narok Sunflower Collective", cropType: "Sorghum",   farmerEmail: "grace.wanjiku.ke@gmail.com",
    location: "Narok, Rift Valley",     loanAmount: "540000",  totalShares: 5400, sharePrice: "100",
    sharesAvailable: 2200, changePercent: "7.30",  tradeCount: 61,  currentPrice: "107", status: "active" as const,
    description: "Drought-resistant sorghum and sunflower intercropping. Selling to local millers and biofuel processors.",
  },
  // New farms for new farmers
  {
    name: "Akinyi Dairy & Kale Farm",   cropType: "Kale",      farmerEmail: "mary.akinyi254@gmail.com",
    location: "Kisumu, Nyanza",          loanAmount: "380000",  totalShares: 3800, sharePrice: "100",
    sharesAvailable: 1500, changePercent: "5.20",  tradeCount: 44,  currentPrice: "105", status: "active" as const,
    description: "Mixed kale and small-scale dairy supplying Kisumu fresh markets. Solar-powered borehole irrigation.",
  },
  {
    name: "Mwangi Wheat Estate",        cropType: "Wheat",     farmerEmail: "jmwangi.farm@gmail.com",
    location: "Nakuru, Central Rift",   loanAmount: "920000",  totalShares: 9200, sharePrice: "100",
    sharesAvailable: 4100, changePercent: "2.80",  tradeCount: 67,  currentPrice: "103", status: "active" as const,
    description: "Certified wheat farm supplying Unga Ltd flour mills. KALRO improved-variety seeds. Fully mechanised harvesting.",
  },
  {
    name: "Hassan Coastal Cassava",     cropType: "Cassava",   farmerEmail: "fatuma.hassan.ke@gmail.com",
    location: "Kilifi, Coast Kenya",    loanAmount: "290000",  totalShares: 2900, sharePrice: "100",
    sharesAvailable: 1200, changePercent: "9.10",  tradeCount: 38,  currentPrice: "109", status: "active" as const,
    description: "Drought-resilient cassava farm supplying starch processors and local food manufacturers on the Kenya coast.",
  },
  {
    name: "Chebet Highlands Coffee",    cropType: "Coffee",    farmerEmail: "lucy.chebet01@yahoo.com",
    location: "Uasin Gishu, Rift Valley", loanAmount: "470000", totalShares: 4700, sharePrice: "100",
    sharesAvailable: 2100, changePercent: "11.30", tradeCount: 58,  currentPrice: "111", status: "active" as const,
    description: "High-altitude arabica coffee intercropping in the Uasin Gishu highlands. Premium export contracts secured.",
  },
  {
    name: "Omondi Homa Bay Fish Farm",  cropType: "Dairy",     farmerEmail: "danielomondi.ke@gmail.com",
    location: "Homa Bay, Nyanza",       loanAmount: "620000",  totalShares: 6200, sharePrice: "100",
    sharesAvailable: 2800, changePercent: "6.40",  tradeCount: 72,  currentPrice: "106", status: "active" as const,
    description: "Cage fish farming in Lake Victoria. Tilapia and Nile perch. Supplying premium hotels and export processors.",
  },
  {
    name: "Wanjiru Banana Plantation",  cropType: "Maize",     farmerEmail: "sarah.wanjiru.ke@gmail.com",
    location: "Meru, Mt. Kenya Region", loanAmount: "340000",  totalShares: 3400, sharePrice: "100",
    sharesAvailable: 1400, changePercent: "8.70",  tradeCount: 51,  currentPrice: "109", status: "active" as const,
    description: "Cavendish banana plantation integrated with maize intercropping. Export-grade bunches to Middle East supermarkets.",
  },
  {
    name: "Kipkemoi Tea & Flowers",     cropType: "Tea",       farmerEmail: "mkipkemoi.tea@gmail.com",
    location: "Kericho, Rift Valley",   loanAmount: "780000",  totalShares: 7800, sharePrice: "100",
    sharesAvailable: 3500, changePercent: "13.20", tradeCount: 95,  currentPrice: "113", status: "active" as const,
    description: "CTC black tea with intercropped cut flowers for export to Netherlands and Japan. KTDA factory certified.",
  },
];

// Wallet balances for all users
const WALLET_BALANCES: Record<string, number> = {
  "david.mwangi.inv@gmail.com":         150000,
  "john.kamau.farm@gmail.com":           25000,
  "grace.wanjiku.ke@gmail.com":          20000,
  "peter.otieno.farm@gmail.com":         18000,
  "samuel.njoroge.ke@gmail.com":         50000,
  "rift.valley.buyers@gmail.com":        80000,
  "alice.njeri.inv@gmail.com":          220000,
  "robert.kipchoge@gmail.com":          185000,
  "amina.m.invest@gmail.com":           310000,
  "briano.odhiambo@gmail.com":           95000,
  "cwairimu.invest@outlook.com":        275000,
  "denniskamau.ke@gmail.com":           140000,
  "esther.mutua.ke@gmail.com":           78000,
  "f.kariuki.invest@gmail.com":         430000,
  "gloriaach254@gmail.com":             160000,
  "hassanomar.ke@yahoo.com":            520000,
  "irene.wambui254@gmail.com":          105000,
  "mary.akinyi254@gmail.com":            32000,
  "jmwangi.farm@gmail.com":             45000,
  "fatuma.hassan.ke@gmail.com":          28000,
  "lucy.chebet01@yahoo.com":             38000,
  "danielomondi.ke@gmail.com":           22000,
  "sarah.wanjiru.ke@gmail.com":          31000,
  "mkipkemoi.tea@gmail.com":             41000,
  // Demo accounts used by "Try demo account" buttons on the auth screens
  "john.farmer@investafarm.com":          35000,
  "demo.farmer@investafarm.com":          30000,
  "grace.farmer@investafarm.com":         27000,
  "peter.farmer@investafarm.com":         24000,
  "david.investor@investafarm.com":      250000,
  "demo.investor@investafarm.com":       200000,
  "demo.coop@investafarm.com":           120000,
  "demo.agent@investafarm.com":           60000,
  "demo.offtaker@investafarm.com":        90000,
};

// Per-investor investment allocations
const INVESTOR_INVESTMENTS: Array<{
  email: string;
  investments: Array<{ farmIdx: number; shares: number; exitType: string }>;
}> = [
  {
    email: "david.mwangi.inv@gmail.com",
    investments: [
      { farmIdx: 0, shares: 500, exitType: "full_season" },
      { farmIdx: 1, shares: 800, exitType: "full_season" },
      { farmIdx: 2, shares: 400, exitType: "mid_season"  },
      { farmIdx: 3, shares: 600, exitType: "full_season" },
      { farmIdx: 4, shares: 300, exitType: "mid_season"  },
    ],
  },
  {
    email: "alice.njeri.inv@gmail.com",
    investments: [
      { farmIdx: 0, shares: 400, exitType: "full_season" },
      { farmIdx: 2, shares: 700, exitType: "full_season" },
      { farmIdx: 5, shares: 200, exitType: "mid_season"  },
    ],
  },
  {
    email: "robert.kipchoge@gmail.com",
    investments: [
      { farmIdx: 1, shares: 600, exitType: "full_season" },
      { farmIdx: 3, shares: 350, exitType: "mid_season"  },
      { farmIdx: 6, shares: 500, exitType: "full_season" },
    ],
  },
  {
    email: "amina.m.invest@gmail.com",
    investments: [
      { farmIdx: 2, shares: 1000, exitType: "full_season" },
      { farmIdx: 4, shares:  400, exitType: "full_season" },
      { farmIdx: 7, shares:  300, exitType: "mid_season"  },
    ],
  },
  {
    email: "briano.odhiambo@gmail.com",
    investments: [
      { farmIdx: 0, shares: 250, exitType: "mid_season"  },
      { farmIdx: 5, shares: 300, exitType: "full_season" },
    ],
  },
  {
    email: "cwairimu.invest@outlook.com",
    investments: [
      { farmIdx: 1, shares: 800, exitType: "full_season" },
      { farmIdx: 3, shares: 500, exitType: "full_season" },
      { farmIdx: 6, shares: 200, exitType: "mid_season"  },
    ],
  },
  {
    email: "denniskamau.ke@gmail.com",
    investments: [
      { farmIdx: 2, shares: 600, exitType: "full_season" },
      { farmIdx: 4, shares: 200, exitType: "mid_season"  },
    ],
  },
  {
    email: "esther.mutua.ke@gmail.com",
    investments: [
      { farmIdx: 0, shares: 150, exitType: "mid_season"  },
      { farmIdx: 7, shares: 200, exitType: "full_season" },
    ],
  },
  {
    email: "f.kariuki.invest@gmail.com",
    investments: [
      { farmIdx: 1, shares: 1200, exitType: "full_season" },
      { farmIdx: 2, shares:  500, exitType: "full_season" },
      { farmIdx: 3, shares:  400, exitType: "mid_season"  },
      { farmIdx: 5, shares:  300, exitType: "full_season" },
    ],
  },
  {
    email: "gloriaach254@gmail.com",
    investments: [
      { farmIdx: 3, shares: 500, exitType: "full_season" },
      { farmIdx: 6, shares: 300, exitType: "mid_season"  },
    ],
  },
  {
    email: "hassanomar.ke@yahoo.com",
    investments: [
      { farmIdx: 0, shares:  800, exitType: "full_season" },
      { farmIdx: 2, shares:  600, exitType: "full_season" },
      { farmIdx: 4, shares:  500, exitType: "full_season" },
      { farmIdx: 7, shares:  400, exitType: "mid_season"  },
    ],
  },
  {
    email: "irene.wambui254@gmail.com",
    investments: [
      { farmIdx: 1, shares: 400, exitType: "mid_season"  },
      { farmIdx: 5, shares: 200, exitType: "full_season" },
    ],
  },
];

// ── Main entry ─────────────────────────────────────────────────────────────

export async function seedDemoUsers(log: (msg: string) => void = console.log) {
  const createdUsers: Record<string, number> = {};

  for (const u of DEMO_USERS) {
    try {
      const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, u.email));
      if (existing) {
        createdUsers[u.email] = existing.id;
        if (!existing.emailVerified) {
          await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.email, u.email));
          log(`[seed] Auto-verified: ${u.email}`);
        }
        // Update display name if it was a generic "Demo *" placeholder
        if (existing.name.startsWith("Demo ")) {
          await db.update(usersTable).set({ name: u.name }).where(eq(usersTable.email, u.email));
          log(`[seed] Renamed: ${existing.name} → ${u.name}`);
        }
      } else {
        const passwordHash = await bcrypt.hash(u.password, 10);
        const [inserted] = await db.insert(usersTable)
          .values({ email: u.email, passwordHash, name: u.name, role: u.role as any, emailVerified: true })
          .returning({ id: usersTable.id });
        createdUsers[u.email] = inserted!.id;
        log(`[seed] Created: ${u.name} (${u.role})`);
      }
    } catch (err) {
      log(`[seed] Skipped ${u.email}: ${String(err)}`);
    }
  }

  await seedFarmsAndListings(createdUsers, log);
  await seedAllWallets(createdUsers, log);
  await seedAllKyc(createdUsers, log);
  await seedPartnerData(createdUsers, log);
}

// ── Partner seed data ────────────────────────────────────────────────────────

async function seedPartnerData(userIds: Record<string, number>, log: (msg: string) => void) {
  const coopId   = userIds["demo.coop@investafarm.com"];
  const agentId  = userIds["demo.agent@investafarm.com"];
  const mweaId   = userIds["mwea.coop.ke@gmail.com"];
  const samuelId = userIds["samuel.njoroge.ke@gmail.com"];

  // Farmer IDs to link as members / connections
  const farmerEmails = [
    "john.kamau.farm@gmail.com",
    "grace.wanjiku.ke@gmail.com",
    "peter.otieno.farm@gmail.com",
    "mary.akinyi254@gmail.com",
    "jmwangi.farm@gmail.com",
    "fatuma.hassan.ke@gmail.com",
    "lucy.chebet01@yahoo.com",
    "danielomondi.ke@gmail.com",
  ];
  const farmerIds = farmerEmails.map(e => userIds[e]).filter(Boolean) as number[];

  // ── Cooperative members ────────────────────────────────────────────────────
  for (const coopUserId of [coopId, mweaId]) {
    if (!coopUserId) continue;
    const existing = await db.select({ farmerId: cooperativeMembersTable.farmerId })
      .from(cooperativeMembersTable)
      .where(eq(cooperativeMembersTable.cooperativeId, coopUserId));
    if (existing.length > 0) continue;

    const membersToAdd = coopUserId === coopId ? farmerIds.slice(0, 6) : farmerIds.slice(2, 8);
    for (const farmerId of membersToAdd) {
      try {
        await db.insert(cooperativeMembersTable)
          .values({ cooperativeId: coopUserId, farmerId, status: "active" })
          .onConflictDoNothing();
      } catch { /* skip */ }
    }
    log(`[seed] Cooperative members seeded for userId ${coopUserId} (${membersToAdd.length} farmers)`);
  }

  // ── Agribusiness connections ──────────────────────────────────────────────
  for (const agriUserId of [agentId, samuelId]) {
    if (!agriUserId) continue;
    const existing = await db.select({ farmerId: agribusinessConnectionsTable.farmerId })
      .from(agribusinessConnectionsTable)
      .where(eq(agribusinessConnectionsTable.agribusinessId, agriUserId));
    if (existing.length > 0) continue;

    const connectedFarmers = agriUserId === agentId ? farmerIds.slice(0, 5) : farmerIds.slice(3, 7);
    for (const farmerId of connectedFarmers) {
      try {
        await db.insert(agribusinessConnectionsTable)
          .values({ agribusinessId: agriUserId, farmerId, status: "active" })
          .onConflictDoNothing();
      } catch { /* skip */ }
    }
    log(`[seed] Agribusiness connections seeded for userId ${agriUserId} (${connectedFarmers.length} farmers)`);
  }

  // ── Voucher orders for demo agent ─────────────────────────────────────────
  if (agentId && farmerIds.length >= 3) {
    const existingOrders = await db.select({ id: voucherOrdersTable.id })
      .from(voucherOrdersTable)
      .where(eq(voucherOrdersTable.agribusinessId, agentId));
    if (existingOrders.length === 0) {
      const voucherData = [
        { farmerId: farmerIds[0]!, code: "VCH-KAM-2024A", amount: "15000", items: JSON.stringify(["50kg DAP Fertiliser", "5kg Hybrid Maize Seeds"]), status: "fulfilled", phone: "+254712345678", loc: "Kiambu County" },
        { farmerId: farmerIds[1]!, code: "VCH-WAN-2024B", amount: "8500",  items: JSON.stringify(["25kg CAN Fertiliser", "Pesticide Pack"]),           status: "fulfilled", phone: "+254722456789", loc: "Kirinyaga County" },
        { farmerId: farmerIds[2]!, code: "VCH-OTI-2024C", amount: "22000", items: JSON.stringify(["Irrigation Pipe Set", "2 x 50kg Urea"]),             status: "pending",   phone: "+254733567890", loc: "Kisumu County" },
        { farmerId: farmerIds[3]!, code: "VCH-AKI-2024D", amount: "6000",  items: JSON.stringify(["Vegetable Seedlings", "10kg NPK Fertiliser"]),       status: "pending",   phone: "+254744678901", loc: "Kisumu County" },
      ];
      for (const v of voucherData) {
        try {
          await db.insert(voucherOrdersTable).values({
            agribusinessId: agentId,
            farmerId: v.farmerId,
            voucherCode: v.code,
            amount: v.amount,
            items: v.items,
            status: v.status,
            farmerPhone: v.phone,
            farmerLocation: v.loc,
          });
        } catch { /* skip */ }
      }
      log(`[seed] Voucher orders seeded for demo agent (4 orders: 2 fulfilled, 2 pending)`);
    }
  }

  // ── KYC docs for cooperative & agribusiness demo accounts ─────────────────
  const partnerKycEmails = [
    "demo.coop@investafarm.com",
    "demo.agent@investafarm.com",
    "demo.offtaker@investafarm.com",
    "mwea.coop.ke@gmail.com",
    "samuel.njoroge.ke@gmail.com",
    "rift.valley.buyers@gmail.com",
  ];
  for (const email of partnerKycEmails) {
    const userId = userIds[email];
    if (!userId) continue;
    const existing = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, userId));
    if (existing.length > 0) continue;
    try {
      await db.insert(kycDocumentsTable).values([
        { userId, docType: "national_id" as const, title: "National ID / Certificate of Registration", fileUrl: "", status: "approved" as const, notes: "Demo — auto-approved", reviewedAt: new Date() },
        { userId, docType: "farm_report" as const,  title: "Business Registration Document",          fileUrl: "", status: "approved" as const, notes: "Demo — auto-approved", reviewedAt: new Date() },
      ]);
      log(`[seed] KYC approved for partner: ${email}`);
    } catch { /* skip */ }
  }

  // ── Seed a group loan for demo cooperative ────────────────────────────────
  if (coopId) {
    const existingLoans = await db.select({ id: loanApplicationsTable.id })
      .from(loanApplicationsTable)
      .where(eq(loanApplicationsTable.farmerId, coopId));
    if (existingLoans.length === 0) {
      try {
        await db.insert(loanApplicationsTable).values({
          farmerId: coopId,
          amount: "350000",
          purpose: "fertilizer",
          purposeDetails: "Group loan for 6 members: Bulk fertilizer purchase for long rain season (DAP & CAN)",
          repaymentPeriodMonths: 6,
          status: "submitted",
          submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          cropName: "Maize & Beans (group)",
        });
        log(`[seed] Group loan seeded for demo cooperative`);
      } catch { /* skip */ }
    }
  }

  // ── Notifications for partner demo accounts ───────────────────────────────
  const partnerNotifs: Array<{ email: string; type: string; title: string; body: string }> = [
    { email: "demo.coop@investafarm.com", type: "loan_update",   title: "Loan Under Review",    body: "Your group loan application (GRP-350,000 KES) is now under review by our team." },
    { email: "demo.coop@investafarm.com", type: "member_joined", title: "New Member",           body: "John Kamau has joined your cooperative network." },
    { email: "demo.agent@investafarm.com", type: "voucher_order", title: "Order Fulfilled",     body: "Voucher VCH-KAM-2024A has been fulfilled. Commission of KES 375 earned." },
    { email: "demo.agent@investafarm.com", type: "voucher_order", title: "New Voucher Order",   body: "Peter Otieno has submitted a voucher order (VCH-OTI-2024C) — KES 22,000." },
    { email: "demo.offtaker@investafarm.com", type: "market",    title: "Price Alert: Avocado", body: "Avocado prices up 8.4% this week — Mombasa exchange. 3 farms ready for harvest." },
  ];
  for (const n of partnerNotifs) {
    const userId = userIds[n.email];
    if (!userId) continue;
    try {
      const existing = await db.select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(eq(notificationsTable.userId, userId));
      if (existing.length > 0) continue;
      await db.insert(notificationsTable).values({
        userId,
        type: n.type,
        title: n.title,
        body: n.body,
        read: false,
      } as any);
    } catch { /* skip */ }
  }
  log(`[seed] Partner notifications seeded`);
}

// ── KYC ─────────────────────────────────────────────────────────────────────

async function seedAllKyc(userIds: Record<string, number>, log: (msg: string) => void) {
  const farmerEmails = DEMO_USERS.filter(u => u.role === "farmer").map(u => u.email);
  for (const email of farmerEmails) {
    const userId = userIds[email];
    if (!userId) continue;
    const existing = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, userId));
    if (existing.length > 0) continue;
    try {
      await db.insert(kycDocumentsTable).values([
        { userId, docType: "national_id" as const, title: "National ID", fileUrl: "", status: "approved" as const, notes: "Demo — auto-approved", reviewedAt: new Date() },
        { userId, docType: "farm_report" as const,  title: "Farm Report", fileUrl: "", status: "approved" as const, notes: "Demo — auto-approved", reviewedAt: new Date() },
      ]);
      log(`[seed] KYC approved for ${email}`);
    } catch { /* skip */ }
  }
}

// ── Wallets ──────────────────────────────────────────────────────────────────

async function seedAllWallets(userIds: Record<string, number>, log: (msg: string) => void) {
  for (const [email, balance] of Object.entries(WALLET_BALANCES)) {
    const userId = userIds[email];
    if (!userId) continue;
    try {
      const [existing] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
      if (existing) {
        // Always ensure demo wallets have at least the seeded minimum balance
        if (parseFloat(existing.balance) < balance) {
          await db.update(walletsTable).set({ balance: String(balance), updatedAt: new Date() }).where(eq(walletsTable.id, existing.id));
          log(`[seed] Wallet topped up: ${email} → KES ${balance.toLocaleString()}`);
        }
        continue;
      }
      const [wallet] = await db.insert(walletsTable)
        .values({ userId, balance: String(balance), currency: "KES" })
        .returning();
      await db.insert(walletTransactionsTable).values({
        walletId: wallet!.id,
        userId,
        type: "deposit",
        amount: String(balance),
        balanceAfter: String(balance),
        description: "Account opening deposit",
        reference: `SEED-OPEN-${userId}`,
        status: "completed",
      });
      log(`[seed] Wallet funded: ${email} → KES ${balance.toLocaleString()}`);
    } catch (err) {
      log(`[seed] Wallet skip ${email}: ${String(err)}`);
    }
  }

  await seedRichTransactions(userIds, log);
  await seedAllInvestments(userIds, log);
}

// ── Rich transaction history for investors ────────────────────────────────────

async function seedRichTransactions(userIds: Record<string, number>, log: (msg: string) => void) {
  const investorEmails = DEMO_USERS.filter(u => u.role === "investor").map(u => u.email);

  const TX_DESCRIPTIONS: Record<string, string[]> = {
    deposit:    ["M-Pesa deposit via Safaricom", "Bank transfer — Equity Bank", "Airtel Money deposit", "Bank transfer — KCB", "Card deposit — Visa", "M-Pesa PayBill deposit"],
    withdrawal: ["Withdrawal to M-Pesa", "Bank withdrawal — Equity Bank", "M-Pesa cash-out", "Bank withdrawal — Co-op Bank"],
    return:     ["Mid-season dividend payout", "Full-season harvest return", "Secondary market sale proceeds", "Harvest dividend payment"],
    fee:        ["Platform fee — primary purchase", "Secondary trade commission", "Withdrawal processing fee"],
  };

  const TX_AMOUNTS: Record<string, number[]> = {
    deposit:    [10000, 25000, 50000, 75000, 100000, 150000],
    withdrawal: [5000, 10000, 20000, 30000],
    return:     [3500, 7200, 12400, 18600, 25000],
    fee:        [150, 375, 750, 1125],
  };

  const TX_SEQUENCE: Array<"deposit" | "return" | "fee" | "withdrawal"> = [
    "deposit", "deposit", "return", "fee", "withdrawal", "deposit", "return", "deposit", "fee",
  ];

  for (const email of investorEmails) {
    const userId = userIds[email];
    if (!userId) continue;

    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
    if (!wallet) continue;

    const [txCountRow] = await db.select({ c: count() }).from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.userId, userId));
    if ((txCountRow?.c ?? 0) >= 5) continue;

    const numTx = 6 + (userId % 4);
    let running = parseFloat(wallet.balance);

    for (let i = 0; i < Math.min(numTx, TX_SEQUENCE.length); i++) {
      const txType = TX_SEQUENCE[i]!;
      const ref = `TX-SEED-${userId}-${i}`;

      const [dup] = await db.select({ c: count() }).from(walletTransactionsTable)
        .where(eq(walletTransactionsTable.reference, ref));
      if ((dup?.c ?? 0) > 0) continue;

      const descs = TX_DESCRIPTIONS[txType]!;
      const amts  = TX_AMOUNTS[txType]!;
      const description = descs[(userId + i) % descs.length]!;
      const amount      = amts[(userId + i) % amts.length]!;

      const isCredit = txType === "deposit" || txType === "return";
      if (!isCredit && running < amount) continue;
      running = isCredit ? running + amount : running - amount;

      const daysAgo = (numTx - i) * 14 + (userId % 5);
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      try {
        await db.insert(walletTransactionsTable).values({
          walletId: wallet.id,
          userId,
          type: txType,
          amount: String(amount),
          balanceAfter: String(Math.round(running)),
          description,
          reference: ref,
          status: "completed",
          createdAt,
        } as any);
      } catch { /* skip */ }
    }
    log(`[seed] Transactions seeded for ${email}`);
  }
}

// ── Investments ─────────────────────────────────────────────────────────────

async function seedAllInvestments(userIds: Record<string, number>, log: (msg: string) => void) {
  const farms = await db.select().from(farmsTable).limit(20);
  if (farms.length === 0) return;

  for (const { email, investments } of INVESTOR_INVESTMENTS) {
    const investorId = userIds[email];
    if (!investorId) continue;

    const existing = await db.select().from(investmentsTable).where(eq(investmentsTable.investorId, investorId));
    if (existing.length > 0) continue;

    for (const inv of investments) {
      const farm = farms[inv.farmIdx];
      if (!farm) continue;
      try {
        await db.insert(investmentsTable).values({
          investorId,
          farmId: farm.id,
          quantity: inv.shares,
          purchasePrice: farm.sharePrice,
          exitType: inv.exitType,
          status: "active",
        });
      } catch { /* skip */ }
    }
    log(`[seed] Investments seeded for ${email} (${investments.length} positions)`);
  }
}

// ── Farms & listings ────────────────────────────────────────────────────────

async function seedFarmsAndListings(userIds: Record<string, number>, log: (msg: string) => void) {
  let existingFarms: { id: number; name: string; farmerId: number }[];
  try {
    existingFarms = await db.select({ id: farmsTable.id, name: farmsTable.name, farmerId: farmsTable.farmerId }).from(farmsTable);
  } catch (e) {
    log(`[seed] Skipping farms — table not ready: ${String(e)}`);
    return;
  }

  const existingNames = new Set(existingFarms.map(f => f.name));

  for (const farm of DEMO_FARMS) {
    const farmerId = userIds[farm.farmerEmail];
    if (!farmerId) continue;

    // Reset prices on existing farms to prevent scheduler drift
    const match = existingFarms.find(f => f.name === farm.name);
    if (match) {
      await db.update(farmsTable)
        .set({ changePercent: farm.changePercent, currentPrice: farm.currentPrice })
        .where(eq(farmsTable.id, match.id))
        .catch(() => {});
      continue;
    }

    if (existingNames.has(farm.name)) continue;

    try {
      const { farmerEmail: _ignored, ...farmData } = farm;
      const [inserted] = await db.insert(farmsTable).values({ ...farmData, farmerId }).returning({ id: farmsTable.id });
      existingNames.add(farm.name);
      log(`[seed] Farm: ${farm.name}`);

      await db.insert(marketListingsTable).values({
        farmId: inserted!.id,
        sellerId: farmerId,
        listingType: "primary",
        sharesAvailable: farm.sharesAvailable,
        pricePerShare: farm.currentPrice,
        isActive: 1,
      }).catch(() => {});
    } catch (err) {
      log(`[seed] Farm skip ${farm.name}: ${String(err)}`);
    }
  }

  await seedSecondaryListings(userIds, log);
}

async function seedSecondaryListings(userIds: Record<string, number>, log: (msg: string) => void) {
  const existing = await db.select().from(marketListingsTable)
    .where(and(eq(marketListingsTable.listingType, "secondary"), eq(marketListingsTable.isActive, 1)));
  if (existing.length > 0) return;

  const investorId = userIds["david.mwangi.inv@gmail.com"];
  if (!investorId) return;

  const farms = await db.select().from(farmsTable).limit(8);
  if (farms.length === 0) return;

  const resaleConfigs = [
    { priceMultiplier: 0.92, shares: 150 },
    { priceMultiplier: 1.05, shares: 80  },
    { priceMultiplier: 0.98, shares: 200 },
    { priceMultiplier: 1.12, shares: 60  },
    { priceMultiplier: 1.03, shares: 120 },
    { priceMultiplier: 1.08, shares: 90  },
  ];

  for (let i = 0; i < Math.min(farms.length, resaleConfigs.length); i++) {
    const farm = farms[i]!;
    const cfg  = resaleConfigs[i]!;
    const price = Math.round(Number(farm.currentPrice) * cfg.priceMultiplier);
    try {
      await db.insert(marketListingsTable).values({
        farmId: farm.id,
        sellerId: investorId,
        listingType: "secondary",
        sharesAvailable: cfg.shares,
        pricePerShare: String(price),
        isActive: 1,
      });
      log(`[seed] Secondary listing: ${farm.name} — ${cfg.shares} shares @ KES ${price}`);
    } catch { /* skip */ }
  }
}
