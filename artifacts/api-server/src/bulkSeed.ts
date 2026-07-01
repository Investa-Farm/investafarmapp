/**
 * Large-scale synthetic data generator.
 * Runs as a background job after server starts — never blocks startup.
 *
 * Targets: ~250 K farmers · ~15 K investors · ~120 K farms · KYC approved for all farmers
 *
 * Key performance tricks:
 *  - Pre-compute ONE bcrypt hash (all synthetic users share it → only ~100 ms)
 *  - Batch INSERT 500 rows at a time via drizzle
 *  - Fully idempotent: counts existing synthetic rows before running
 */

import bcrypt from "bcrypt";
import { db, usersTable, farmsTable, kycDocumentsTable, walletsTable, walletTransactionsTable } from "@workspace/db";
import { eq, like, count, sql } from "drizzle-orm";

// ── Name dictionaries ─────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Abel","Abraham","Agnes","Alice","Amina","Ann","Anthony","Auma","Beatrice","Bernard",
  "Betty","Boniface","Brenda","Brian","Caroline","Catherine","Charles","Christine","Cynthia",
  "Daniel","David","Deborah","Diana","Dorothy","Duncan","Edith","Edwin","Elizabeth","Elijah",
  "Esther","Eunice","Everlyn","Faith","Fatuma","Felix","Florence","Francis","George","Gloria",
  "Grace","Hannah","Hassan","Henry","Hilda","Hussein","Immaculate","Irene","Isaac","James",
  "Jane","Janet","Jennifer","John","Joseph","Joyce","Judith","Julius","Khadija","Laila",
  "Lawrence","Leonard","Lilian","Linda","Lucy","Lydia","Margaret","Martha","Mary","Maurice",
  "Mercy","Michael","Miriam","Moses","Nancy","Nicholas","Njeri","Nyambura","Pamela","Patrick",
  "Paul","Peninah","Peter","Phyllis","Priscilla","Rachel","Rebecca","Richard","Robert","Rose",
  "Ruth","Samuel","Sarah","Sheila","Simon","Susan","Thomas","Vincent","Vivian","Wambui",
  "Wanjiku","Winnie","Yvonne","Zipporah",
];

const LAST_NAMES = [
  "Achieng","Adhiambo","Akinyi","Andolo","Barasa","Bett","Chege","Chebet","Chesire","Gitahi",
  "Gitau","Gitu","Kamau","Kanguya","Karanja","Kariuki","Keter","Kibiru","Kimani","Kipchoge",
  "Kipkemoi","Kiptoo","Kiprotich","Kirui","Kitheka","Koech","Korir","Langat","Macharia","Maina",
  "Makau","Mbogo","Mbugua","Miano","Momanyi","Mshila","Mungai","Muriithi","Muriuki","Mutua",
  "Mwangi","Mwenda","Mwiti","Ndegwa","Ndirangu","Ndung'u","Ngugi","Njagi","Njiru","Njoroge",
  "Njuguna","Nzioka","Ochieng","Odero","Odhiambo","Ogola","Ogutu","Ojijo","Okello","Okoth",
  "Ombati","Ombura","Omolo","Onyango","Opiyo","Owino","Rono","Rotich","Sang","Simiyu",
  "Sitati","Too","Wafula","Wairagu","Wairimu","Wambua","Wanjala","Wanjiku","Were","Wesonga",
  "Yego","Njeru","Kinyua","Mwenda","Gitonga","Mutiso","Kyalo","Nganga","Muthee","Njue",
  "Omondi","Obiero","Ogweno","Osoro","Nyakundi","Bosire","Moturi","Ondieki","Nyabuto","Abuya",
];

const COUNTIES = [
  "Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Malindi","Nyeri","Meru","Kakamega",
  "Machakos","Kericho","Naivasha","Kitale","Kisii","Migori","Homa Bay","Bungoma","Vihiga","Siaya",
  "Kajiado","Kiambu","Muranga","Kirinyaga","Nyandarua","Laikipia","Samburu","Trans Nzoia","Uasin Gishu",
  "Elgeyo Marakwet","Nandi","Baringo","Turkana","West Pokot","Isiolo","Marsabit","Mandera","Garissa","Wajir","Tana River",
];

const CROP_TYPES = [
  "Coffee","Maize","Tea","Avocado","Macadamia","Tomatoes","Rice","Wheat","Kale","Dairy",
  "Cassava","Sorghum","Beans","Sunflower","Mango","Banana","Sweet Potato","Potato","Onion","Cabbage",
];

const FARM_SUFFIXES = [
  "Farm","Estate","Orchards","Plantation","Fields","Gardens","Cooperative","Collective","Smallholding","Holdings",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getName(idx: number): string {
  const fi = idx % FIRST_NAMES.length;
  const li = Math.floor(idx / FIRST_NAMES.length) % LAST_NAMES.length;
  const cycle = Math.floor(idx / (FIRST_NAMES.length * LAST_NAMES.length));
  const suffix = cycle > 0 ? ` ${cycle + 1}` : "";
  return `${FIRST_NAMES[fi]} ${LAST_NAMES[li]}${suffix}`;
}

const EMAIL_DOMAINS = ["gmail.com", "gmail.com", "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"];

function getFarmerEmail(idx: number): string {
  const fi = idx % FIRST_NAMES.length;
  const li = Math.floor(idx / FIRST_NAMES.length) % LAST_NAMES.length;
  const cycle = Math.floor(idx / (FIRST_NAMES.length * LAST_NAMES.length));
  const first = FIRST_NAMES[fi]!.toLowerCase().replace(/[^a-z]/g, "");
  const last  = LAST_NAMES[li]!.toLowerCase().replace(/[^a-z]/g, "");
  const domain = EMAIL_DOMAINS[idx % EMAIL_DOMAINS.length]!;
  const num = cycle > 0 ? cycle : (idx % 900 === 0 ? "" : idx % 99 || "");
  return `${first}.${last}${num}@${domain}`;
}

function getInvestorEmail(idx: number): string {
  const fi = idx % FIRST_NAMES.length;
  const li = Math.floor(idx / FIRST_NAMES.length) % LAST_NAMES.length;
  const cycle = Math.floor(idx / (FIRST_NAMES.length * LAST_NAMES.length));
  const first = FIRST_NAMES[fi]!.toLowerCase().replace(/[^a-z]/g, "");
  const last  = LAST_NAMES[li]!.toLowerCase().replace(/[^a-z]/g, "");
  const domain = EMAIL_DOMAINS[(idx + 3) % EMAIL_DOMAINS.length]!;
  const num = cycle > 0 ? cycle + 1000 : (idx % 87 || idx + 500);
  return `${first}.${last}${num}@${domain}`;
}

function getFarmName(farmerName: string, farmIdx: number): string {
  const parts = farmerName.split(" ");
  const lastName = parts[1] ?? parts[0] ?? "Farm";
  const crop = CROP_TYPES[farmIdx % CROP_TYPES.length]!;
  const suffix = FARM_SUFFIXES[farmIdx % FARM_SUFFIXES.length]!;
  return `${lastName} ${crop} ${suffix}`;
}

function getCounty(idx: number): string {
  return COUNTIES[idx % COUNTIES.length]!;
}

async function batchInsert<T extends Record<string, any>>(
  table: any,
  rows: T[],
  batchSize = 500
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    await db.insert(table).values(rows.slice(i, i + batchSize)).onConflictDoNothing();
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────

const FARMER_TARGET   = 249_973; // + existing ~27 → ~250 K
const INVESTOR_TARGET =  14_978; // + existing ~22 → ~15 K
const FARMS_TARGET    = 120_000;

let isRunning = false;

export async function runBulkSeed(log: (msg: string) => void = console.log): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    // Check how many farmers exist (including both old and new email formats)
    const [farmerCount] = await db
      .select({ c: count() })
      .from(usersTable)
      .where(eq(usersTable.role, "farmer"));

    const existingFarmers = Number(farmerCount?.c ?? 0);

    if (existingFarmers >= FARMER_TARGET * 0.95) {
      log(`[bulk] Synthetic data already present (${existingFarmers.toLocaleString()} farmers) — skipping`);
      isRunning = false;
      return;
    }

    log("[bulk] Starting large-scale synthetic seed (background job)…");
    log("[bulk] Pre-computing shared password hash…");

    const sharedHash = await bcrypt.hash("password123", 10);
    const now = new Date();

    // ── 1. Synthetic Farmers ────────────────────────────────────────────────
    log(`[bulk] Inserting ~${FARMER_TARGET.toLocaleString()} synthetic farmers…`);
    const farmersToInsert = FARMER_TARGET - Number(existingFarmers);

    const insertedFarmerIds: number[] = [];

    for (let batch = 0; batch < Math.ceil(farmersToInsert / 500); batch++) {
      const start = batch * 500;
      const end   = Math.min(start + 500, farmersToInsert);
      const rows = [];
      for (let i = start; i < end; i++) {
        const name  = getName(i);
        const email = getFarmerEmail(i);
        const county = getCounty(i);
        const createdAt = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);
        rows.push({ email, passwordHash: sharedHash, name, role: "farmer" as const, emailVerified: true, county, createdAt });
      }
      const inserted = await db.insert(usersTable).values(rows).onConflictDoNothing().returning({ id: usersTable.id });
      insertedFarmerIds.push(...inserted.map(r => r.id));

      if (batch % 40 === 0) {
        log(`[bulk] Farmers: ${Math.min((batch + 1) * 500, farmersToInsert).toLocaleString()} / ${farmersToInsert.toLocaleString()}`);
      }
    }

    log(`[bulk] Farmers done — ${insertedFarmerIds.length.toLocaleString()} inserted`);

    // ── 2. KYC for synthetic farmers ────────────────────────────────────────
    log("[bulk] Inserting KYC records for synthetic farmers…");
    const kycBatch: any[] = [];
    for (const userId of insertedFarmerIds) {
      kycBatch.push(
        { userId, docType: "national_id" as const, title: "National ID", fileUrl: "", status: "approved" as const, notes: "Auto-approved", reviewedAt: now },
        { userId, docType: "farm_report" as const,  title: "Farm Report", fileUrl: "", status: "approved" as const, notes: "Auto-approved", reviewedAt: now }
      );
      if (kycBatch.length >= 1000) {
        await db.insert(kycDocumentsTable).values(kycBatch).onConflictDoNothing();
        kycBatch.length = 0;
      }
    }
    if (kycBatch.length > 0) {
      await db.insert(kycDocumentsTable).values(kycBatch).onConflictDoNothing();
    }
    log("[bulk] KYC records done");

    // ── 3. Synthetic Investors ─────────────────────────────────────────────
    log(`[bulk] Inserting ~${INVESTOR_TARGET.toLocaleString()} synthetic investors…`);
    const [invCount] = await db
      .select({ c: count() })
      .from(usersTable)
      .where(eq(usersTable.role, "investor"));

    const existingInvestors = invCount?.c ?? 0;
    const investorsToInsert = Math.max(0, INVESTOR_TARGET - Number(existingInvestors));

    const insertedInvestorIds: number[] = [];

    for (let batch = 0; batch < Math.ceil(investorsToInsert / 500); batch++) {
      const start = batch * 500;
      const end   = Math.min(start + 500, investorsToInsert);
      const rows = [];
      for (let i = start; i < end; i++) {
        const name  = getName(i + FARMER_TARGET); // offset so names differ from farmers
        const email = getInvestorEmail(i);
        const county = getCounty(i + 7);
        const createdAt = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);
        rows.push({ email, passwordHash: sharedHash, name, role: "investor" as const, emailVerified: true, county, createdAt });
      }
      const inserted = await db.insert(usersTable).values(rows).onConflictDoNothing().returning({ id: usersTable.id });
      insertedInvestorIds.push(...inserted.map(r => r.id));
    }
    log(`[bulk] Investors done — ${insertedInvestorIds.length.toLocaleString()} inserted`);

    // ── 4. Wallets for synthetic investors ──────────────────────────────────
    log("[bulk] Creating wallets for synthetic investors…");
    const walletRows: any[] = [];
    const walletTxRows: any[] = [];

    for (const userId of insertedInvestorIds) {
      const balance = 50000 + Math.floor(Math.random() * 450000);
      walletRows.push({ userId, balance: String(balance), currency: "KES" });
      if (walletRows.length >= 500) {
        const inserted = await db.insert(walletsTable).values(walletRows).onConflictDoNothing().returning();
        for (const w of inserted) {
          walletTxRows.push({
            walletId: w.id, userId: w.userId, type: "deposit",
            amount: w.balance, balanceAfter: w.balance,
            description: "Account opening deposit", reference: `BULK-OPEN-${w.userId}`, status: "completed",
          });
        }
        walletRows.length = 0;
        if (walletTxRows.length >= 500) {
          await db.insert(walletTransactionsTable).values(walletTxRows).onConflictDoNothing();
          walletTxRows.length = 0;
        }
      }
    }
    if (walletRows.length > 0) {
      const inserted = await db.insert(walletsTable).values(walletRows).onConflictDoNothing().returning();
      for (const w of inserted) {
        walletTxRows.push({
          walletId: w.id, userId: w.userId, type: "deposit",
          amount: w.balance, balanceAfter: w.balance,
          description: "Account opening deposit", reference: `BULK-OPEN-${w.userId}`, status: "completed",
        });
      }
    }
    if (walletTxRows.length > 0) {
      await db.insert(walletTransactionsTable).values(walletTxRows).onConflictDoNothing();
    }

    // ── 4b. Extra synthetic transactions for investors (return, fee, investment) ──
    log("[bulk] Adding extra transactions for synthetic investors…");
    const TX_TYPES = ["deposit", "return", "fee", "withdrawal", "investment"] as const;
    const TX_DESCS: Record<string, string[]> = {
      deposit:    ["M-Pesa deposit via Safaricom", "Bank transfer — Equity Bank", "Airtel Money deposit", "Card deposit — Visa"],
      return:     ["Mid-season dividend payout", "Full-season harvest return", "Secondary market sale proceeds"],
      fee:        ["Platform fee — primary purchase", "Secondary trade commission", "Withdrawal processing fee"],
      withdrawal: ["Withdrawal to M-Pesa", "Bank withdrawal — Equity Bank", "M-Pesa cash-out"],
      investment: ["Share purchase — primary market", "Share purchase — secondary market", "Portfolio reinvestment"],
    };
    const TX_AMOUNTS: Record<string, number[]> = {
      deposit:    [15000, 30000, 50000, 100000, 200000],
      return:     [4500, 8700, 14200, 22000],
      fee:        [225, 450, 750, 1200],
      withdrawal: [5000, 12000, 25000],
      investment: [10000, 25000, 50000, 100000],
    };
    const extraTxBatch: any[] = [];
    const investorWallets = await db.select({ id: walletsTable.id, userId: walletsTable.userId, balance: walletsTable.balance })
      .from(walletsTable)
      .where(sql`user_id = ANY(ARRAY[${sql.raw(insertedInvestorIds.slice(0, 5000).join(",") || "0")}]::int[])`);
    for (const w of investorWallets) {
      const txCount = 3 + (w.userId % 5);
      for (let t = 0; t < txCount; t++) {
        const txType = TX_TYPES[(w.userId + t) % TX_TYPES.length]!;
        const descs = TX_DESCS[txType]!;
        const amts  = TX_AMOUNTS[txType]!;
        const description = descs[(w.userId + t) % descs.length]!;
        const amount      = amts[(w.userId + t) % amts.length]!;
        const daysAgo = (txCount - t) * 10 + (w.userId % 7);
        const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        extraTxBatch.push({
          walletId: w.id, userId: w.userId, type: txType, amount: String(amount),
          balanceAfter: w.balance, description, reference: `BULK-TX-${w.userId}-${t}`,
          status: "completed", createdAt,
        });
        if (extraTxBatch.length >= 1000) {
          await db.insert(walletTransactionsTable).values(extraTxBatch).onConflictDoNothing();
          extraTxBatch.length = 0;
        }
      }
    }
    if (extraTxBatch.length > 0) {
      await db.insert(walletTransactionsTable).values(extraTxBatch).onConflictDoNothing();
    }
    log("[bulk] Extra transactions done");
    log("[bulk] Wallets done");

    // ── 5. Synthetic Farms ─────────────────────────────────────────────────
    log(`[bulk] Inserting ~${FARMS_TARGET.toLocaleString()} synthetic farms…`);

    const [farmCount] = await db.select({ c: count() }).from(farmsTable)
      .where(like(farmsTable.description, "Synthetic%"));

    const existingFarms = farmCount?.c ?? 0;
    const farmsToInsert = Math.max(0, FARMS_TARGET - Number(existingFarms));

    // Use the newly inserted farmer IDs. If not enough, pad with earlier farmer IDs
    const farmerIdsForFarms = insertedFarmerIds.length >= farmsToInsert
      ? insertedFarmerIds.slice(0, farmsToInsert)
      : [...insertedFarmerIds, ...Array.from({ length: farmsToInsert - insertedFarmerIds.length }, (_, i) => insertedFarmerIds[i % Math.max(1, insertedFarmerIds.length)] ?? 1)];

    const farmRows: any[] = [];
    for (let i = 0; i < farmsToInsert; i++) {
      const farmerId = farmerIdsForFarms[i]!;
      const farmerName = getName(i);
      const cropType   = CROP_TYPES[i % CROP_TYPES.length]!;
      const county     = getCounty(i);
      const loanAmt    = 200_000 + Math.floor(Math.random() * 1_800_000);
      const totalShares = Math.floor(loanAmt / 100);
      const changeRaw  = (Math.random() * 30 - 5).toFixed(2);
      const currentPriceNum = Math.round(100 * (1 + Number(changeRaw) / 100));
      farmRows.push({
        farmerId,
        name: getFarmName(farmerName, i),
        cropType,
        location: `${county}, Kenya`,
        loanAmount: String(loanAmt),
        totalShares,
        sharePrice: "100",
        sharesAvailable: Math.floor(totalShares * (0.3 + Math.random() * 0.5)),
        changePercent: changeRaw,
        currentPrice: String(currentPriceNum),
        tradeCount: Math.floor(Math.random() * 300),
        status: "active" as const,
        description: `Synthetic ${cropType.toLowerCase()} farm in ${county}. Auto-generated for platform demonstration.`,
      });

      if (farmRows.length >= 500) {
        await db.insert(farmsTable).values(farmRows).onConflictDoNothing();
        farmRows.length = 0;
        if (i % 10_000 === 0 && i > 0) log(`[bulk] Farms: ${i.toLocaleString()} / ${farmsToInsert.toLocaleString()}`);
      }
    }
    if (farmRows.length > 0) {
      await db.insert(farmsTable).values(farmRows).onConflictDoNothing();
    }

    log("[bulk] ✅ Large-scale synthetic seed complete!");
    log(`[bulk]   Farmers inserted : ${insertedFarmerIds.length.toLocaleString()}`);
    log(`[bulk]   Investors inserted: ${insertedInvestorIds.length.toLocaleString()}`);
    log(`[bulk]   Farms inserted   : ${(farmsToInsert - farmRows.length).toLocaleString()}`);

  } catch (err) {
    console.error("[bulk] Synthetic seed error:", (err as Error).message);
  } finally {
    isRunning = false;
  }
}
