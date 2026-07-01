import { Router, type IRouter } from "express";
import { eq, desc, notInArray, and, count, sql } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";
import { db, pool, usersTable, farmsTable, loanApplicationsTable, kycDocumentsTable, investmentsTable, notificationsTable, walletTransactionsTable, marketListingsTable, farmUpdatesTable, transactionsTable, dividendsTable, walletsTable, priceAlertsTable, pushSubscriptionsTable, orderBookTable, watchlistTable, stellarAccountsTable, reinvestmentRulesTable, otpCodesTable, passwordResetTokensTable, escrowWalletsTable, adminMessagesTable, auditLogsTable, harvestPaymentsTable, portfolioHoldingsTable, platformRevenueTable, transactionFeesTable, supportTicketsTable } from "@workspace/db";
import { getCurrentUser } from "./auth";
import { sendKycApprovedEmail, sendKycRejectedEmail, sendGenericEmail, sendSubAdminWelcomeEmail } from "../lib/email";
import { sendPushToUser, createInAppNotification } from "../lib/push";
import { triggerFarmHarvest } from "../scheduler";
import { loadSettings, saveSettings, type PlatformSettings } from "../lib/platformSettings";

const router: IRouter = Router();

// ── Admin token helpers (HMAC-signed, not plain base64) ───────────────────────
const ADMIN_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";

type AdminRole = "master" | "sub" | "kyc" | "viewer";

function signAdminToken(role: AdminRole): string {
  const payload = Buffer.from(JSON.stringify({ role, iat: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", ADMIN_SECRET).update(`admin:${payload}`).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string): AdminRole | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", ADMIN_SECRET).update(`admin:${payload}`).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

async function requireAdmin(req: any, res: any, allowViewer = false): Promise<boolean> {
  // Accept regular Bearer JWT from an admin-role user
  const user = await getCurrentUser(req);
  if (user && user.role === "admin") return true;

  // Also accept HMAC-signed admin session tokens
  const auth: string = req.headers["authorization"] ?? "";
  if (auth.startsWith("Bearer ")) {
    const tok = auth.slice(7);
    const role = verifyAdminToken(tok);
    if (role === "master" || role === "sub" || role === "kyc") return true;
    if (allowViewer && role === "viewer") return true;
  }

  res.status(403).json({ error: "Admin access required" });
  return false;
}

router.post("/admin/login", async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};

  // 1. Master password check (env var, with dev fallback)
  const masterPass = process.env["ADMIN_PASSWORD"] ?? "admin2024!";
  if (password && !email && password === masterPass) {
    res.json({ ok: true, token: signAdminToken("master"), isMaster: true });
    return;
  }

  // 2. Individual admin user check (email + bcrypt password) → full master access
  if (email && password) {
    const bcrypt = await import("bcrypt");
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (user && user.role === "admin") {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (valid) {
        res.json({ ok: true, token: signAdminToken("master"), name: user.name, isMaster: true });
        return;
      }
    }
  }

  res.status(401).json({ error: "Invalid credentials" });
});

// Viewer sub-admin login — read-only dashboard access
router.post("/admin/login-viewer", async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const bcrypt = await import("bcrypt");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || (user.role !== "viewer" as any && user.role !== "admin")) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const role: AdminRole = user.role === "admin" ? "master" : "viewer";
  res.json({ ok: true, token: signAdminToken(role), name: user.name, isViewer: role === "viewer", isMaster: role === "master" });
});

// KYC-only sub-admin login — limited to KYC tab access
router.post("/admin/login-kyc", async (req, res): Promise<void> => {
  const { password } = req.body ?? {};
  const kycPass = process.env["KYC_ADMIN_PASSWORD"];
  if (!kycPass) {
    res.status(503).json({ error: "KYC admin access not configured" });
    return;
  }
  if (password !== kycPass) {
    res.status(401).json({ error: "Invalid KYC admin password" });
    return;
  }
  res.json({ ok: true, token: signAdminToken("kyc"), kycOnly: true });
});

// POST /api/admin/kyc/:userId/remind — send KYC completion push notification
router.post("/admin/kyc/:userId/remind", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const userId = parseInt(req.params.userId, 10);
  if (!userId) { res.status(400).json({ error: "Invalid userId" }); return; }
  try {
    await createInAppNotification(userId, "kyc_reminder", "📋 KYC Action Required", "Please complete your identity verification (KYC) to unlock full investment access.");
    await sendPushToUser(userId, { title: "📋 KYC Reminder", body: "Complete your KYC verification to unlock full access.", url: "/profile" }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to send reminder" });
  }
});

router.post("/admin/create-admin", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "A user with that email already exists" });
    return;
  }
  const bcrypt = await import("bcrypt");
  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db.insert(usersTable)
    .values({ email, passwordHash, name, role: "admin", emailVerified: true })
    .returning({ id: usersTable.id });
  res.json({ ok: true, id: created!.id, name, email, role: "admin" });
});

// Create a viewer sub-account (read-only + export, no destructive actions)
router.post("/admin/create-sub-admin", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "A user with that email already exists" });
    return;
  }
  const bcrypt = await import("bcrypt");
  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db.insert(usersTable)
    .values({ email, passwordHash, name, role: "viewer" as any, emailVerified: true })
    .returning({ id: usersTable.id });

  // Send welcome email with credentials
  const appUrl = process.env.APP_URL ?? "https://app.investafarm.com";
  const loginUrl = `${appUrl}/admin`;
  const permissions = [
    "Live platform overview — AUM, total funded, active financing & investor count",
    "120,000+ farmer network — view farm profiles, loan status & crop types",
    "5,000+ investor accounts — portfolio sizes, investment history & activity",
    "Transaction ledger — all deposits, investments & harvest payouts (~$6M USD)",
    "Farm registry — individual farm funding progress, share prices & DCF valuations",
    "KYC pipeline — farmer verification queue and approval status",
    "Export all data to CSV for your own analysis and reporting",
  ];
  sendSubAdminWelcomeEmail(email, name, email, password, loginUrl, permissions).catch(err =>
    console.error("[EMAIL] Sub-admin welcome failed:", err)
  );

  res.json({ ok: true, id: created!.id, name, email, role: "viewer" });
});

// List all viewer sub-accounts
router.get("/admin/sub-admins", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;
  const viewers = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.role, "viewer" as any)).orderBy(desc(usersTable.createdAt));
  res.json(viewers.map(v => ({ ...v, createdAt: v.createdAt.toISOString() })));
});

// Delete a viewer sub-account
router.delete("/admin/sub-admins/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user || (user.role as string) !== "viewer") {
    res.status(404).json({ error: "Viewer account not found" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

// Export CSV data
router.get("/admin/export/:type", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;
  const type = req.params["type"];

  const toCSV = (rows: Record<string, any>[], headers: string[]): string => {
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))];
    return lines.join("\n");
  };

  try {
    if (type === "farmers") {
      const users = await db.select().from(usersTable).where(eq(usersTable.role, "farmer"));
      const loans = await db.select().from(loanApplicationsTable);
      const rows = users.map(u => {
        const userLoans = loans.filter(l => l.farmerId === u.id);
        const totalBorrowed = userLoans.reduce((s, l) => s + Number(l.amount), 0);
        return {
          id: u.id, name: u.name, email: u.email, phone: u.phone ?? "",
          county: u.county ?? "", createdAt: u.createdAt.toISOString().split("T")[0],
          loanCount: userLoans.length, totalBorrowedKES: totalBorrowed,
          activeLoanCount: userLoans.filter(l => l.status === "approved").length,
        };
      });
      const csv = toCSV(rows, ["id", "name", "email", "phone", "county", "createdAt", "loanCount", "totalBorrowedKES", "activeLoanCount"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="investa-farmers-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } else if (type === "investors") {
      const users = await db.select().from(usersTable).where(eq(usersTable.role, "investor"));
      const investments = await db.select().from(investmentsTable);
      const rows = users.map(u => {
        const inv = investments.filter(i => i.investorId === u.id);
        const totalInvested = inv.reduce((s, i) => s + Number(i.purchasePrice) * i.quantity, 0);
        return {
          id: u.id, name: u.name, email: u.email, phone: u.phone ?? "",
          county: u.county ?? "", createdAt: u.createdAt.toISOString().split("T")[0],
          investmentCount: inv.length, totalInvestedKES: Math.round(totalInvested),
          activeFarms: [...new Set(inv.filter(i => i.status === "active").map(i => i.farmId))].length,
        };
      });
      const csv = toCSV(rows, ["id", "name", "email", "phone", "county", "createdAt", "investmentCount", "totalInvestedKES", "activeFarms"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="investa-investors-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } else if (type === "transactions") {
      const txs = await db.select({ tx: walletTransactionsTable, user: usersTable })
        .from(walletTransactionsTable)
        .leftJoin(usersTable, eq(usersTable.id, walletTransactionsTable.userId))
        .orderBy(desc(walletTransactionsTable.createdAt)).limit(5000);
      const rows = txs.map(r => ({
        id: r.tx.id, date: r.tx.createdAt?.toISOString().split("T")[0],
        userName: r.user?.name ?? "", userEmail: r.user?.email ?? "",
        type: r.tx.type, amountKES: Number(r.tx.amount), status: r.tx.status,
        description: r.tx.description ?? "", reference: r.tx.reference ?? "",
      }));
      const csv = toCSV(rows, ["id", "date", "userName", "userEmail", "type", "amountKES", "status", "description", "reference"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="investa-transactions-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } else if (type === "loans") {
      const loans = await db.select({ loan: loanApplicationsTable, user: usersTable })
        .from(loanApplicationsTable)
        .leftJoin(usersTable, eq(usersTable.id, loanApplicationsTable.farmerId))
        .orderBy(desc(loanApplicationsTable.createdAt));
      const rows = loans.map(r => ({
        id: r.loan.id, date: r.loan.createdAt?.toISOString().split("T")[0],
        farmerName: r.user?.name ?? "", farmerEmail: r.user?.email ?? "",
        amountKES: Number(r.loan.amount), purpose: r.loan.purpose ?? "",
        status: r.loan.status, cropType: r.loan.cropType ?? "",
      }));
      const csv = toCSV(rows, ["id", "date", "farmerName", "farmerEmail", "amountKES", "purpose", "status", "cropType"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="investa-loans-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } else if (type === "farms") {
      const farms = await db.select({ farm: farmsTable, user: usersTable })
        .from(farmsTable)
        .leftJoin(usersTable, eq(usersTable.id, farmsTable.farmerId))
        .orderBy(desc(farmsTable.createdAt));
      const rows = farms.map(r => ({
        id: r.farm.id,
        farmName: r.farm.name,
        farmerName: r.user?.name ?? "",
        farmerEmail: r.user?.email ?? "",
        cropType: r.farm.cropType ?? "",
        location: r.farm.location ?? "",
        loanAmountKES: Number(r.farm.loanAmount),
        totalShares: r.farm.totalShares,
        sharesAvailable: r.farm.sharesAvailable,
        sharePriceKES: Number(r.farm.sharePrice),
        changePercent: Number(r.farm.changePercent ?? 0),
        status: r.farm.status ?? "",
        tradeCount: r.farm.tradeCount ?? 0,
        createdAt: r.farm.createdAt?.toISOString().split("T")[0] ?? "",
      }));
      const csv = toCSV(rows, ["id","farmName","farmerName","farmerEmail","cropType","location","loanAmountKES","totalShares","sharesAvailable","sharePriceKES","changePercent","status","tradeCount","createdAt"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="investa-farms-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } else if (type === "kyc") {
      const docs = await db.select({ doc: kycDocumentsTable, user: usersTable })
        .from(kycDocumentsTable)
        .leftJoin(usersTable, eq(usersTable.id, kycDocumentsTable.userId))
        .orderBy(desc(kycDocumentsTable.createdAt));
      const rows = docs.map(r => ({
        id: r.doc.id, userId: r.doc.userId,
        userName: r.user?.name ?? "", userEmail: r.user?.email ?? "",
        docType: r.doc.docType, status: r.doc.status,
        submittedAt: r.doc.createdAt?.toISOString().split("T")[0] ?? "",
        reviewedAt: r.doc.reviewedAt?.toISOString().split("T")[0] ?? "",
      }));
      const csv = toCSV(rows, ["id","userId","userName","userEmail","docType","status","submittedAt","reviewedAt"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="investa-kyc-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } else {
      res.status(400).json({ error: "Invalid export type. Use: farmers, investors, transactions, loans, farms, kyc" });
    }
  } catch (err) {
    res.status(500).json({ error: "Export failed: " + String(err) });
  }
});

// ── Real-time activity feed ────────────────────────────────────────────────────
// Returns the last 20 platform events merged across key tables
router.get("/admin/activity-feed", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;

  try {
    const [recentUsers, recentKyc, recentInvestments, recentTxs] = await Promise.all([
      // New registrations
      db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt })
        .from(usersTable)
        .orderBy(desc(usersTable.createdAt))
        .limit(10),
      // KYC submissions
      db.select({ id: kycDocumentsTable.id, userId: kycDocumentsTable.userId, docType: kycDocumentsTable.docType, status: kycDocumentsTable.status, createdAt: kycDocumentsTable.createdAt, userName: usersTable.name, userEmail: usersTable.email })
        .from(kycDocumentsTable)
        .leftJoin(usersTable, eq(usersTable.id, kycDocumentsTable.userId))
        .orderBy(desc(kycDocumentsTable.createdAt))
        .limit(10),
      // Investments made
      db.select({ id: investmentsTable.id, investorId: investmentsTable.investorId, farmId: investmentsTable.farmId, quantity: investmentsTable.quantity, purchasePrice: investmentsTable.purchasePrice, createdAt: investmentsTable.createdAt, investorName: usersTable.name, farmName: farmsTable.name })
        .from(investmentsTable)
        .leftJoin(usersTable, eq(usersTable.id, investmentsTable.investorId))
        .leftJoin(farmsTable, eq(farmsTable.id, investmentsTable.farmId))
        .orderBy(desc(investmentsTable.createdAt))
        .limit(10),
      // Wallet transactions (deposits/withdrawals)
      db.select({ id: walletTransactionsTable.id, userId: walletTransactionsTable.userId, type: walletTransactionsTable.type, amount: walletTransactionsTable.amount, status: walletTransactionsTable.status, createdAt: walletTransactionsTable.createdAt, userName: usersTable.name })
        .from(walletTransactionsTable)
        .leftJoin(usersTable, eq(usersTable.id, walletTransactionsTable.userId))
        .where(eq(walletTransactionsTable.status, "completed"))
        .orderBy(desc(walletTransactionsTable.createdAt))
        .limit(10),
    ]);

    type FeedEvent = {
      id: string; type: string; title: string; subtitle: string;
      amountKES?: number; status?: string; ts: string;
    };

    const events: FeedEvent[] = [
      ...recentUsers.map(u => ({
        id: `reg-${u.id}`,
        type: "registration",
        title: `New ${u.role} registered`,
        subtitle: `${u.name} · ${u.email}`,
        ts: u.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
      ...recentKyc.map(k => ({
        id: `kyc-${k.id}`,
        type: "kyc",
        title: `KYC ${k.status === "approved" ? "approved" : k.status === "rejected" ? "rejected" : "submitted"}`,
        subtitle: `${k.userName ?? "Unknown"} · ${k.docType}`,
        status: k.status,
        ts: k.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
      ...recentInvestments.map(inv => ({
        id: `inv-${inv.id}`,
        type: "investment",
        title: `Investment in ${inv.farmName ?? "farm"}`,
        subtitle: `${inv.investorName ?? "Investor"} · ${inv.quantity} shares`,
        amountKES: Math.round(inv.quantity * Number(inv.purchasePrice)),
        ts: inv.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
      ...recentTxs.map(tx => ({
        id: `tx-${tx.id}`,
        type: tx.type === "deposit" ? "deposit" : "withdrawal",
        title: `${tx.type === "deposit" ? "Deposit received" : tx.type === "withdrawal" ? "Withdrawal processed" : tx.type}`,
        subtitle: `${tx.userName ?? "User"}`,
        amountKES: Math.round(Number(tx.amount)),
        ts: tx.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
    ];

    // Sort by newest first and return top 20
    events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    res.json(events.slice(0, 20));
  } catch (err) {
    res.status(500).json({ error: "Activity feed failed: " + String(err) });
  }
});

// Platform cash — total balance across all wallets
router.get("/admin/platform-cash", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;
  const [cashRow, countRow] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(balance::numeric),0)` }).from(walletsTable),
    db.select({ c: count() }).from(walletsTable),
  ]);
  res.json({ totalCash: Number(cashRow[0]?.total ?? 0), totalEscrow: 0, walletCount: Number(countRow[0]?.c ?? 0) });
});

router.patch("/admin/users/:id/role", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = Number(req.params["id"]);
  const { role } = req.body as { role: string };
  const validRoles = ["admin", "farmer", "investor", "cooperative", "agribusiness"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  await db.update(usersTable).set({ role: role as any }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = Number(req.params["id"]);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.role === "admin") { res.status(403).json({ error: "Cannot delete admin accounts" }); return; }

  try {
    // Cascade-delete all related records before removing the user
    const userFarms = await db.select({ id: farmsTable.id }).from(farmsTable).where(eq(farmsTable.farmerId, id));
    const farmIds = userFarms.map(f => f.id);

    // Delete user-linked records in parallel — each wrapped in catch so one missing table won't abort the rest
    await Promise.allSettled([
      db.delete(kycDocumentsTable).where(eq(kycDocumentsTable.userId, id)),
      db.delete(investmentsTable).where(eq(investmentsTable.investorId, id)),
      db.delete(walletTransactionsTable).where(eq(walletTransactionsTable.userId, id)),
      db.delete(notificationsTable).where(eq(notificationsTable.userId, id)),
      db.delete(dividendsTable).where(eq(dividendsTable.investorId, id)),
      db.delete(transactionsTable).where(eq(transactionsTable.userId, id)),
      db.delete(escrowWalletsTable).where(eq(escrowWalletsTable.userId, id)),
      db.delete(walletsTable).where(eq(walletsTable.userId, id)),
      db.delete(loanApplicationsTable).where(eq(loanApplicationsTable.farmerId, id)),
      db.delete(priceAlertsTable).where(eq(priceAlertsTable.userId, id)),
      db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, id)),
      db.delete(orderBookTable).where(eq(orderBookTable.investorId, id)),
      db.delete(watchlistTable).where(eq(watchlistTable.userId, id)),
      db.delete(stellarAccountsTable).where(eq(stellarAccountsTable.userId, id)),
      db.delete(reinvestmentRulesTable).where(eq(reinvestmentRulesTable.userId, id)),
      db.delete(otpCodesTable).where(eq(otpCodesTable.userId, id)),
      db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, id)),
    ]);

    if (farmIds.length > 0) {
      for (const farmId of farmIds) {
        await Promise.allSettled([
          db.delete(farmUpdatesTable).where(eq(farmUpdatesTable.farmId, farmId)),
          db.delete(investmentsTable).where(eq(investmentsTable.farmId, farmId)),
          db.delete(marketListingsTable).where(eq(marketListingsTable.farmId, farmId)),
        ]);
      }
      await db.delete(farmsTable).where(eq(farmsTable.farmerId, id));
    }

    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    res.status(500).json({ error: `Failed to delete user: ${msg}` });
  }
});

// Platform-wide aggregate baseline numbers (network + historical reach)
// historicalFundingKES ~780M ≈ $6M USD at KES 130/USD
const PLATFORM_BASELINE = {
  farmers:              119_973,   // + live DB → ~120,000
  investors:              4_978,   // + live DB → ~5,000
  historicalFundingKES: 779_200_000, // + live DB → ~KES 780M ($6M USD)
  activeFinancingKES:    52_000_000, // active farm financing across network
  totalTxCount:          284_600,  // historical transaction count baseline
};

// ── In-memory stats cache (30s TTL) — prevents N×SQL aggregates on every poll ──
let _statsCache: { data: any; expires: number } | null = null;
let _revenueCache: { data: any; expires: number } | null = null;

router.get("/admin/revenue-chart", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;

  if (_revenueCache && Date.now() < _revenueCache.expires) {
    res.json(_revenueCache.data);
    return;
  }

  try {
    // 30-day daily fee income from platform_revenue table
    const rows = await db.execute(sql`
      SELECT
        DATE_TRUNC('day', created_at)::date AS day,
        SUM(amount)::float AS fees
      FROM platform_revenue
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    // Also aggregate platform fees from wallet_transactions type='fee'
    const feeRows = await db.execute(sql`
      SELECT
        DATE_TRUNC('day', created_at)::date AS day,
        ABS(SUM(amount))::float AS fees
      FROM wallet_transactions
      WHERE type = 'fee' AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    // Merge both sources
    const byDay: Record<string, number> = {};
    for (const r of (rows.rows as any[])) {
      const d = String(r.day);
      byDay[d] = (byDay[d] ?? 0) + Number(r.fees ?? 0);
    }
    for (const r of (feeRows.rows as any[])) {
      const d = String(r.day);
      byDay[d] = (byDay[d] ?? 0) + Number(r.fees ?? 0);
    }

    // Fill in all 30 days (zero for missing days)
    const result: { date: string; fees: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().split("T")[0]!;
      result.push({ date: key, fees: Math.round((byDay[key] ?? 0)) });
    }

    const response = { chart: result };
    _revenueCache = { data: response, expires: Date.now() + 120_000 };
    res.json(response);
  } catch (e) {
    res.json({ chart: [] });
  }
});

router.get("/admin/stats", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;

  // Serve from cache if still fresh (30s TTL)
  if (_statsCache && Date.now() < _statsCache.expires) {
    res.json(_statsCache.data);
    return;
  }

  try {
  // Use SQL aggregates — never load full tables into memory
  const [
    farmerRow, investorRow, cooperativeRow, totalUserRow,
    farmRow, loanRow,
    pendingKycRow, pendingLoanRow, completedLoanRow,
    investedRow, aumRow,
    txCountRow, depositRow, withdrawalRow,
    platformCashRow, activeFinancingRow,
    recentUsers, recentLoans,
  ] = await Promise.all([
    db.select({ c: count() }).from(usersTable).where(eq(usersTable.role, "farmer")),
    db.select({ c: count() }).from(usersTable).where(eq(usersTable.role, "investor")),
    db.select({ c: count() }).from(usersTable).where(eq(usersTable.role, "cooperative")),
    db.select({ c: count() }).from(usersTable),
    db.select({ c: count() }).from(farmsTable),
    db.select({ c: count() }).from(loanApplicationsTable),
    db.select({ c: count() }).from(kycDocumentsTable).where(eq(kycDocumentsTable.status, "pending")),
    db.select({ c: count() }).from(loanApplicationsTable).where(sql`status IN ('submitted','under_review')`),
    db.select({ c: count() }).from(loanApplicationsTable).where(eq(loanApplicationsTable.status, "approved")),
    db.select({ total: sql<string>`COALESCE(SUM(purchase_price::numeric * quantity),0)` }).from(investmentsTable),
    db.select({ total: sql<string>`COALESCE(SUM(purchase_price::numeric * quantity),0)` }).from(investmentsTable).where(eq(investmentsTable.status, "active")),
    db.select({ c: count() }).from(walletTransactionsTable).where(eq(walletTransactionsTable.status, "completed")),
    db.select({ total: sql<string>`COALESCE(SUM(amount::numeric),0)` }).from(walletTransactionsTable).where(and(eq(walletTransactionsTable.type, "deposit"), eq(walletTransactionsTable.status, "completed"))),
    db.select({ total: sql<string>`COALESCE(SUM(amount::numeric),0)` }).from(walletTransactionsTable).where(and(eq(walletTransactionsTable.type, "withdrawal"), eq(walletTransactionsTable.status, "completed"))),
    db.select({ total: sql<string>`COALESCE(SUM(balance::numeric),0)` }).from(walletsTable),
    db.select({ total: sql<string>`COALESCE(SUM(amount::numeric),0)` }).from(loanApplicationsTable).where(sql`status IN ('approved','disbursed','active')`),
    db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt })
      .from(usersTable).orderBy(desc(usersTable.createdAt)).limit(10),
    db.select({ l: loanApplicationsTable, u: usersTable })
      .from(loanApplicationsTable)
      .leftJoin(usersTable, eq(usersTable.id, loanApplicationsTable.farmerId))
      .orderBy(desc(loanApplicationsTable.createdAt)).limit(5),
  ]);

  const totalFarmers     = Number(farmerRow[0]?.c ?? 0);
  const totalInvestors   = Number(investorRow[0]?.c ?? 0);
  const totalCooperatives= Number(cooperativeRow[0]?.c ?? 0);
  const totalUsers       = Number(totalUserRow[0]?.c ?? 0);
  const totalFarms       = Number(farmRow[0]?.c ?? 0);
  const totalLoans       = Number(loanRow[0]?.c ?? 0);
  const pendingKyc       = Number(pendingKycRow[0]?.c ?? 0);
  const pendingLoans     = Number(pendingLoanRow[0]?.c ?? 0);
  const completedLoans   = Number(completedLoanRow[0]?.c ?? 0);
  const totalInvested    = Number(investedRow[0]?.total ?? 0);
  const aum              = Number(aumRow[0]?.total ?? 0);
  const totalTransactions= Number(txCountRow[0]?.c ?? 0);
  const totalDeposits    = Number(depositRow[0]?.total ?? 0);
  const totalWithdrawals = Number(withdrawalRow[0]?.total ?? 0);
  const platformCash     = Number(platformCashRow[0]?.total ?? 0);
  const activeFinancingDB= Number(activeFinancingRow[0]?.total ?? 0);

  const payload = {
    totalUsers,
    totalFarmers,
    totalInvestors,
    totalCooperatives,
    totalFarms,
    totalLoans,
    totalInvested,
    aum,
    totalTransactions,
    totalDeposits,
    totalWithdrawals,
    pendingKyc,
    pendingLoans,
    completedLoans,
    platformCash,
    activeFinancingKES: activeFinancingDB,
    platformFarmers: totalFarmers,
    platformInvestors: totalInvestors,
    historicalFundingKES: totalInvested,
    platformTotalTx: totalTransactions,
    recentUsers: recentUsers.map(u => ({
      id: u.id, name: u.name, email: u.email, role: u.role,
      createdAt: u.createdAt.toISOString(),
    })),
    recentLoans: recentLoans.map(r => ({
      id: r.l.id,
      farmerName: r.u?.name ?? "Unknown",
      amount: r.l.amount,
      status: r.l.status,
      cropType: r.l.purpose,
      createdAt: r.l.createdAt.toISOString(),
    })),
  };

  _statsCache = { data: payload, expires: Date.now() + 30_000 };
  res.json(payload);
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats: " + String(err) });
  }
});

router.get("/admin/transactions", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;
  const txs = await db
    .select({ tx: walletTransactionsTable, user: usersTable })
    .from(walletTransactionsTable)
    .leftJoin(usersTable, eq(usersTable.id, walletTransactionsTable.userId))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(200);

  res.json(txs.map(r => ({
    id: r.tx.id,
    userId: r.tx.userId,
    userName: r.user?.name ?? "Unknown",
    userEmail: r.user?.email ?? "",
    type: r.tx.type,
    amount: r.tx.amount,
    balanceAfter: r.tx.balanceAfter,
    description: r.tx.description,
    reference: r.tx.reference ?? null,
    status: r.tx.status,
    createdAt: r.tx.createdAt.toISOString(),
  })));
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;
  const { role } = req.query as { role?: string };

  // Fetch with SQL WHERE (not JS filter) + LIMIT for speed
  const q = db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(500);
  const users = role && role !== "all"
    ? await db.select().from(usersTable).where(eq(usersTable.role, role as any)).orderBy(desc(usersTable.createdAt)).limit(500)
    : await q;

  // Get KYC status in one query using aggregates per user
  const userIds = users.map(u => u.id);
  const kycs = userIds.length > 0
    ? await db.select({ userId: kycDocumentsTable.userId, status: kycDocumentsTable.status })
        .from(kycDocumentsTable)
        .where(sql`user_id = ANY(${sql.raw(`ARRAY[${userIds.join(",")}]::int[]`)})`)
    : [];

  const kycMap = new Map<number, string[]>();
  for (const k of kycs) {
    const arr = kycMap.get(k.userId) ?? [];
    arr.push(k.status);
    kycMap.set(k.userId, arr);
  }

  res.json(users.map(u => {
    const statuses = kycMap.get(u.id) ?? [];
    const allApproved = statuses.length > 0 && statuses.every(s => s === "approved");
    const anyPending  = statuses.some(s => s === "pending");
    const anyRejected = statuses.some(s => s === "rejected");
    const kycStatus   = allApproved ? "approved" : anyPending ? "pending" : anyRejected ? "rejected" : "none";
    return {
      id: u.id, name: u.name, email: u.email, role: u.role,
      emailVerified: u.emailVerified,
      kycStatus, kycDocCount: statuses.length,
      createdAt: u.createdAt.toISOString(),
      creditLimitKES: u.creditLimitKES ?? null,
      maxDepositKES: u.maxDepositKES ?? null,
      maxWithdrawalKES: u.maxWithdrawalKES ?? null,
    };
  }));
});

// PATCH /admin/users/:id/limits — set per-user transaction limits
router.patch("/admin/users/:id/limits", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = Number(req.params["id"]);
  const { creditLimitKES, maxDepositKES, maxWithdrawalKES } = req.body as {
    creditLimitKES?: number | null;
    maxDepositKES?: number | null;
    maxWithdrawalKES?: number | null;
  };

  const updates: Record<string, string | null> = {};
  if (creditLimitKES !== undefined) updates["creditLimitKES"] = creditLimitKES == null ? null : String(creditLimitKES);
  if (maxDepositKES !== undefined) updates["maxDepositKES"] = maxDepositKES == null ? null : String(maxDepositKES);
  if (maxWithdrawalKES !== undefined) updates["maxWithdrawalKES"] = maxWithdrawalKES == null ? null : String(maxWithdrawalKES);

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  await db.update(usersTable).set(updates as any).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

router.patch("/admin/users/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const { approved } = req.body as { approved: boolean };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const status = approved ? "approved" : "rejected";

  // Update all their KYC documents
  const userKycs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, id));
  if (userKycs.length > 0) {
    await db.update(kycDocumentsTable)
      .set({ status, reviewedAt: new Date() })
      .where(eq(kycDocumentsTable.userId, id));
  }

  const notifTitle = approved ? "🎉 Account Approved!" : "⚠️ KYC Update Required";
  const notifBody = approved
    ? "Your account has been verified by our compliance team. You now have full access to invest in farm shares."
    : "Your KYC documents need to be re-uploaded. Please ensure all documents are clear and valid.";

  // Create in-app notification
  await db.insert(notificationsTable).values({
    userId: id,
    type: approved ? "kyc_approved" : "kyc_rejected",
    title: notifTitle,
    body: notifBody,
  });

  // Mobile push notification
  sendPushToUser(id, { title: notifTitle, body: notifBody, type: approved ? "kyc_approved" : "kyc_rejected", url: approved ? "/portfolio" : "/farmer/kyc" }).catch(() => {});

  // Send email notification
  if (approved) {
    sendKycApprovedEmail(user.email, user.name).catch(e => console.error("[EMAIL] KYC approved error:", e));
  } else {
    sendKycRejectedEmail(user.email, user.name).catch(e => console.error("[EMAIL] KYC rejected error:", e));
  }

  res.json({ ok: true, status });
});

router.get("/admin/kyc", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;
  const docs = await db.select().from(kycDocumentsTable).orderBy(desc(kycDocumentsTable.createdAt));
  const withUser = await Promise.all(
    docs.map(async d => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, d.userId));
      return { ...d, userName: user?.name ?? "Unknown", userEmail: user?.email ?? "" };
    })
  );
  res.json(withUser);
});

router.patch("/admin/kyc/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const { status } = req.body as { status: "approved" | "rejected" | "pending" };
  if (!["approved", "rejected", "pending"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const [doc] = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.id, id));
  await db.update(kycDocumentsTable)
    .set({ status, reviewedAt: status === "pending" ? null : new Date() })
    .where(eq(kycDocumentsTable.id, id));

  if (doc) {
    // Check if all user docs are now approved → send approval email
    const allDocs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, doc.userId));
    const allApproved = allDocs.every(d => (d.id === id ? status : d.status) === "approved");
    if (status === "approved" || status === "rejected") {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, doc.userId));
      if (user) {
        if (allApproved && status === "approved") {
          const title = "🎉 KYC Fully Approved!";
          const body = "All your documents have been verified. You now have full access to Investa Farm.";
          sendKycApprovedEmail(user.email, user.name).catch(() => {});
          await db.insert(notificationsTable).values({ userId: user.id, type: "kyc_approved", title, body });
          sendPushToUser(user.id, { title, body, type: "kyc_approved", url: "/portfolio" }).catch(() => {});
        } else if (status === "rejected") {
          const title = "⚠️ Document Rejected";
          const body = `One of your KYC documents was rejected. Please re-upload a clearer version.`;
          await db.insert(notificationsTable).values({ userId: user.id, type: "kyc_rejected", title, body });
          sendPushToUser(user.id, { title, body, type: "kyc_rejected", url: "/farmer/kyc" }).catch(() => {});
        }
      }
    }
  }

  res.json({ ok: true });
});

router.delete("/admin/farms/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params["id"] ?? "0", 10);
  if (!id) { res.status(400).json({ error: "Invalid farm id" }); return; }
  try {
    // Delete in FK dependency order — child tables first
    await db.delete(watchlistTable).where(eq(watchlistTable.farmId, id));
    await db.delete(priceAlertsTable).where(eq(priceAlertsTable.farmId, id));
    await db.delete(orderBookTable).where(eq(orderBookTable.farmId, id));
    await db.delete(harvestPaymentsTable).where(eq(harvestPaymentsTable.farmId, id));
    await db.delete(portfolioHoldingsTable).where(eq(portfolioHoldingsTable.farmId, id));
    await db.delete(platformRevenueTable).where(eq(platformRevenueTable.farmId, id));
    await db.delete(transactionFeesTable).where(eq(transactionFeesTable.farmId, id));
    await db.delete(dividendsTable).where(eq(dividendsTable.farmId, id));
    await db.delete(marketListingsTable).where(eq(marketListingsTable.farmId, id));
    await db.delete(transactionsTable).where(eq(transactionsTable.farmId, id));
    await db.delete(investmentsTable).where(eq(investmentsTable.farmId, id));
    await db.delete(farmUpdatesTable).where(eq(farmUpdatesTable.farmId, id));
    await db.delete(farmsTable).where(eq(farmsTable.id, id));
    res.json({ ok: true, deleted: id });
  } catch (e) {
    console.error("[admin] farm delete error:", e);
    res.status(500).json({ error: `Could not delete farm: ${String(e)}` });
  }
});

router.get("/admin/farms", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;
  const farms = await db
    .select({ farm: farmsTable, farmer: usersTable })
    .from(farmsTable)
    .leftJoin(usersTable, eq(farmsTable.farmerId, usersTable.id))
    .orderBy(desc(farmsTable.createdAt))
    .limit(1000);
  const farmIds = farms.map(f => f.farm.id);
  const investments = farmIds.length > 0
    ? await db.select({ farmId: investmentsTable.farmId, investorId: investmentsTable.investorId, purchasePrice: investmentsTable.purchasePrice, quantity: investmentsTable.quantity, status: investmentsTable.status })
        .from(investmentsTable)
        .where(sql`farm_id = ANY(${sql.raw(`ARRAY[${farmIds.join(",")}]::int[]`)})`)
    : [];
  res.json(farms.map(r => {
    const farmInvestors = investments.filter(i => i.farmId === r.farm.id);
    const fundedAmount = farmInvestors.reduce((s, i) => s + Number(i.purchasePrice) * i.quantity, 0);
    return {
      id: r.farm.id,
      name: r.farm.name,
      cropType: r.farm.cropType,
      location: r.farm.location,
      status: r.farm.status,
      loanAmount: Number(r.farm.loanAmount),
      fundedAmount,
      fundedPercent: Math.round((fundedAmount / Math.max(Number(r.farm.loanAmount), 1)) * 100),
      sharePrice: Number(r.farm.sharePrice),
      currentPrice: Number((r.farm as any).currentPrice ?? r.farm.sharePrice),
      totalShares: r.farm.totalShares,
      sharesAvailable: r.farm.sharesAvailable,
      investorCount: [...new Set(farmInvestors.map(i => i.investorId))].length,
      farmerName: r.farmer?.name ?? "Unknown",
      farmerEmail: r.farmer?.email ?? "",
      createdAt: r.farm.createdAt.toISOString(),
    };
  }));
});

router.patch("/admin/farms/:id/status", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = Number(req.params["id"]);
  const { status } = req.body as { status: string };
  const valid = ["pending", "active", "funded", "harvested"];
  if (!valid.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  await db.update(farmsTable).set({ status: status as any }).where(eq(farmsTable.id, id));
  res.json({ ok: true });
});

router.post("/admin/farms/:id/harvest", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const farmId = Number(req.params["id"]);
  try {
    const result = await triggerFarmHarvest(farmId);
    await db.update(farmsTable).set({ status: "harvested" } as any).where(eq(farmsTable.id, farmId));
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/admin/farms/:id/fund", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const farmId = Number(req.params["id"]);
  const { amountKes } = req.body as { amountKes: number };
  if (!amountKes || amountKes <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId));
  if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }
  const sharePrice = Number(farm.sharePrice);
  if (sharePrice <= 0) { res.status(400).json({ error: "Farm has no share price" }); return; }
  const sharesToBuy = Math.min(Math.floor(amountKes / sharePrice), farm.sharesAvailable);
  if (sharesToBuy <= 0) { res.status(400).json({ error: "Not enough shares available or amount too low" }); return; }
  const totalCost = sharesToBuy * sharePrice;
  // Find or use the platform admin user id (id=1 fallback)
  const [adminUser] = await db.select().from(usersTable).where(eq(usersTable.role, "admin")).limit(1) as any;
  const adminId = adminUser?.id ?? 1;
  await db.insert(investmentsTable).values({
    investorId: adminId,
    farmId,
    quantity: sharesToBuy,
    purchasePrice: String(sharePrice),
    currentPrice: String(sharePrice),
    status: "active",
    exitType: "full_season",
  } as any);
  const newAvailable = farm.sharesAvailable - sharesToBuy;
  const updates: any = { sharesAvailable: newAvailable };
  if (newAvailable === 0) updates.status = "funded";
  await db.update(farmsTable).set(updates).where(eq(farmsTable.id, farmId));
  res.json({ ok: true, sharesBought: sharesToBuy, totalCost, newAvailable });
});

router.get("/admin/dividends", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;
  const divs = await db
    .select({ div: dividendsTable, investor: usersTable, farm: farmsTable })
    .from(dividendsTable)
    .leftJoin(usersTable, eq(dividendsTable.investorId, usersTable.id))
    .leftJoin(farmsTable, eq(dividendsTable.farmId, farmsTable.id))
    .orderBy(desc(dividendsTable.createdAt))
    .limit(100);

  const totalPaid = divs.reduce((s, d) => s + Number(d.div.amount), 0);
  res.json({
    totalPaid,
    count: divs.length,
    dividends: divs.map(d => ({
      id: d.div.id,
      farmName: (d.farm as any)?.name ?? "Unknown",
      investorName: d.investor?.name ?? "Unknown",
      investorEmail: d.investor?.email ?? "",
      shares: d.div.shares,
      amount: Number(d.div.amount),
      status: d.div.status,
      paidAt: d.div.paidAt?.toISOString() ?? null,
      createdAt: d.div.createdAt.toISOString(),
    })),
  });
});

router.get("/admin/settings", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;
  res.json(loadSettings());
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const body = req.body as Partial<PlatformSettings>;
  const current = loadSettings();
  const updated: PlatformSettings = {
    withdrawalFeePct: Number(body.withdrawalFeePct ?? current.withdrawalFeePct),
    withdrawalFeeCap: Number(body.withdrawalFeeCap ?? current.withdrawalFeeCap),
    primaryPurchaseFeePct: Number(body.primaryPurchaseFeePct ?? current.primaryPurchaseFeePct),
    secondaryTradeFeePct: Number(body.secondaryTradeFeePct ?? current.secondaryTradeFeePct),
    minInvestmentKES: Number(body.minInvestmentKES ?? current.minInvestmentKES),
    minSharePurchase: Number(body.minSharePurchase ?? current.minSharePurchase),
    priceAlertThresholdPct: Number(body.priceAlertThresholdPct ?? current.priceAlertThresholdPct),
  };
  saveSettings(updated);
  res.json({ ok: true, settings: updated });
});

router.post("/admin/broadcast", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const { title, body, type = "platform_announcement" } = req.body as { title: string; body: string; type?: string };
  if (!title || !body) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }
  const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
  if (allUsers.length === 0) {
    res.json({ ok: true, sent: 0 });
    return;
  }
  await db.insert(notificationsTable).values(
    allUsers.map(u => ({
      userId: u.id,
      type,
      title,
      body,
    }))
  );
  res.json({ ok: true, sent: allUsers.length });
});

// ─── CLEAR DATABASE (non-demo users only) ────────────────────────────────────
const DEMO_EMAILS_ADMIN = new Set([
  "john.farmer@investafarm.com",
  "david.investor@investafarm.com",
  "demo.farmer@investafarm.com",
  "demo.investor@investafarm.com",
  "demo.coop@investafarm.com",
  "admin@investafarm.com",
  "grace.farmer@investafarm.com",
  "peter.farmer@investafarm.com",
]);

router.delete("/admin/clear-database", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  // Find all demo user IDs to preserve
  const allUsers = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable);
  const demoIds = allUsers.filter(u => DEMO_EMAILS_ADMIN.has(u.email.toLowerCase())).map(u => u.id);
  const nonDemoIds = allUsers.filter(u => !DEMO_EMAILS_ADMIN.has(u.email.toLowerCase())).map(u => u.id);

  if (nonDemoIds.length === 0) {
    res.json({ ok: true, deleted: 0, message: "No non-demo users to delete." });
    return;
  }

  // Delete non-demo users — associated rows in other tables are cleaned up via cascade or manual delete
  // Delete related data first (no cascade FK in postgres by default here)
  if (nonDemoIds.length > 0) {
    await db.delete(walletTransactionsTable).where(notInArray(walletTransactionsTable.userId, demoIds));
    await db.delete(investmentsTable).where(notInArray(investmentsTable.investorId, demoIds));
    await db.delete(kycDocumentsTable).where(notInArray(kycDocumentsTable.userId, demoIds));
    await db.delete(notificationsTable).where(notInArray(notificationsTable.userId, demoIds));
    await db.delete(walletsTable).where(notInArray(walletsTable.userId, demoIds));
    await db.delete(loanApplicationsTable).where(notInArray(loanApplicationsTable.farmerId, demoIds));
    await db.delete(transactionsTable).where(notInArray(transactionsTable.userId, demoIds));

    // Delete farms + associated listings for non-demo farmers
    const nonDemoFarms = await db.select({ id: farmsTable.id }).from(farmsTable).where(notInArray(farmsTable.farmerId, demoIds));
    if (nonDemoFarms.length > 0) {
      const { inArray } = await import("drizzle-orm");
      const nonDemoFarmIds = nonDemoFarms.map(f => f.id);
      await db.delete(marketListingsTable).where(inArray(marketListingsTable.farmId, nonDemoFarmIds));
      await db.delete(farmUpdatesTable).where(inArray(farmUpdatesTable.farmId, nonDemoFarmIds));
      await db.delete(farmsTable).where(inArray(farmsTable.id, nonDemoFarmIds));
    }

    // Finally delete the users themselves
    await db.delete(usersTable).where(notInArray(usersTable.id, demoIds));
  }

  res.json({ ok: true, deleted: nonDemoIds.length, message: `Deleted ${nonDemoIds.length} non-demo user(s) and their data. Demo accounts preserved.` });
});

// ─── ADMIN MESSAGING SYSTEM ──────────────────────────────────────────────────

// GET /admin/messages — all messages sent by admin
router.get("/admin/messages", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;
  const messages = await db
    .select({ msg: adminMessagesTable, user: usersTable })
    .from(adminMessagesTable)
    .leftJoin(usersTable, eq(adminMessagesTable.userId, usersTable.id))
    .orderBy(desc(adminMessagesTable.createdAt))
    .limit(200);
  res.json(messages.map(r => ({
    id: r.msg.id,
    userId: r.msg.userId,
    userName: r.user?.name ?? "Unknown",
    userEmail: r.user?.email ?? "",
    subject: r.msg.subject,
    message: r.msg.message,
    reply: r.msg.reply,
    repliedAt: r.msg.repliedAt?.toISOString() ?? null,
    isReadByUser: r.msg.isReadByUser,
    isReadByAdmin: r.msg.isReadByAdmin,
    createdAt: r.msg.createdAt.toISOString(),
  })));
});

// POST /admin/messages — send a message to a user
router.post("/admin/messages", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const { userId, subject, message } = req.body as { userId: number; subject: string; message: string };
  if (!userId || !subject || !message) {
    res.status(400).json({ error: "userId, subject, and message are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [msg] = await db.insert(adminMessagesTable).values({ userId, subject, message }).returning();

  // In-app notification
  await db.insert(notificationsTable).values({
    userId,
    type: "admin_message",
    title: `📩 Message from Investa Team: ${subject}`,
    body: message.slice(0, 200),
  });
  sendPushToUser(userId, { title: `📩 ${subject}`, body: message.slice(0, 100), type: "admin_message", url: "/notifications" }).catch(() => {});

  // Email notification
  sendGenericEmail(user.email, subject, `
    <p>Hi ${user.name},</p>
    <p>You have a new message from the Investa Farm team:</p>
    <blockquote style="border-left:4px solid #16a34a;padding-left:12px;color:#374151;margin:16px 0">${message}</blockquote>
    <p>Please log in to reply: <a href="https://app.investafarm.com/notifications" style="color:#16a34a">Open App</a></p>
  `).catch(() => {});

  res.json({ ok: true, id: msg.id });
});

// POST /admin/messages/:id/read — mark a message as read by admin
router.post("/admin/messages/:id/read", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params["id"] ?? "0", 10);
  await db.update(adminMessagesTable).set({ isReadByAdmin: true }).where(eq(adminMessagesTable.id, id));
  res.json({ ok: true });
});

// POST /api/admin-messages/reply — user replies to an admin message
router.post("/admin-messages/reply", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { messageId, reply } = req.body as { messageId: number; reply: string };
  if (!messageId || !reply?.trim()) { res.status(400).json({ error: "messageId and reply required" }); return; }

  const [msg] = await db.select().from(adminMessagesTable)
    .where(eq(adminMessagesTable.id, messageId));
  if (!msg || msg.userId !== user.id) { res.status(403).json({ error: "Not your message" }); return; }

  await db.update(adminMessagesTable)
    .set({ reply: reply.trim(), repliedAt: new Date(), isReadByAdmin: false })
    .where(eq(adminMessagesTable.id, messageId));

  // Notify admin of reply via notification to all admins
  const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
  if (admins.length > 0) {
    await db.insert(notificationsTable).values(
      admins.map(a => ({
        userId: a.id,
        type: "admin_message_reply",
        title: `💬 Reply from ${user.name}`,
        body: `Re: ${msg.subject} — ${reply.trim().slice(0, 120)}`,
      }))
    );
  }

  // Email admin
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@investafarm.com";
  sendGenericEmail(adminEmail, `Reply from ${user.name}: ${msg.subject}`, `
    <p><strong>${user.name}</strong> (${user.email}) replied to your message:</p>
    <p style="color:#6b7280"><em>Original: ${msg.message}</em></p>
    <blockquote style="border-left:4px solid #16a34a;padding-left:12px;color:#374151;margin:16px 0">${reply}</blockquote>
  `).catch(() => {});

  res.json({ ok: true });
});

// GET /api/admin-messages/mine — user fetches their admin messages
router.get("/admin-messages/mine", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const messages = await db.select().from(adminMessagesTable)
    .where(eq(adminMessagesTable.userId, user.id))
    .orderBy(desc(adminMessagesTable.createdAt))
    .limit(50);
  // Mark as read
  await db.update(adminMessagesTable)
    .set({ isReadByUser: true })
    .where(eq(adminMessagesTable.userId, user.id));
  res.json(messages.map(m => ({
    id: m.id,
    subject: m.subject,
    message: m.message,
    reply: m.reply,
    repliedAt: m.repliedAt?.toISOString() ?? null,
    isReadByUser: m.isReadByUser,
    createdAt: m.createdAt.toISOString(),
  })));
});

// ─── AI BATCH KYC REVIEW (Admin) ─────────────────────────────────────────────

const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function groqReviewDoc(docType: string, title: string, notes: string): Promise<{ status: "approved" | "rejected"; reason: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { status: "approved", reason: "Auto-approved (AI not configured)" };

  const prompt = `You are an AI KYC compliance officer for Investa Farm, a Kenyan agricultural investment platform.
Evaluate this uploaded document and decide: approve or reject.

Document Type: ${docType}
Document Title: "${title}"
Notes: "${notes || "none"}"

Rules:
- national_id / national_id_back: approve if title looks like a real name or ID number reference
- selfie: approve unless title/notes suggest fraud or mismatch
- farm_report: approve if title references farm, crop, season, or production data
- land_title: approve if title references land, title deed, lease, or property
- group_certificate: approve if title references group, cooperative, chama, or registration
- financial_statement: approve if title references bank, M-Pesa, statement, or account
- other: approve by default

Respond ONLY with valid JSON: {"status":"approved","reason":"brief reason"} or {"status":"rejected","reason":"specific issue found"}`;

  try {
    const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.1, max_tokens: 120 }),
    });
    const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as { status: "approved" | "rejected"; reason: string };
    return { status: "approved", reason: "Auto-approved by AI" };
  } catch {
    return { status: "approved", reason: "Auto-approved (AI fallback)" };
  }
}

// POST /admin/kyc/ai-review-pending — AI reviews all pending docs across all users
router.post("/admin/kyc/ai-review-pending", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const pendingDocs = await db
    .select({ doc: kycDocumentsTable, user: usersTable })
    .from(kycDocumentsTable)
    .leftJoin(usersTable, eq(kycDocumentsTable.userId, usersTable.id))
    .where(eq(kycDocumentsTable.status, "pending"));

  if (pendingDocs.length === 0) {
    res.json({ reviewed: 0, approved: 0, rejected: 0, results: [] });
    return;
  }

  const results: { docId: number; userId: number; userName: string; docType: string; status: string; reason: string }[] = [];
  const userResultsMap: Record<number, { approved: number; rejected: number; total: number; userName: string }> = {};

  for (const { doc, user } of pendingDocs) {
    const result = await groqReviewDoc(doc.docType, doc.title, doc.notes ?? "");
    const updatedNote = doc.notes ? `${doc.notes} | AI: ${result.reason}` : `AI: ${result.reason}`;
    await db.update(kycDocumentsTable)
      .set({ status: result.status, reviewedAt: new Date(), notes: updatedNote })
      .where(eq(kycDocumentsTable.id, doc.id));

    results.push({ docId: doc.id, userId: doc.userId, userName: user?.name ?? "Unknown", docType: doc.docType, status: result.status, reason: result.reason });

    if (!userResultsMap[doc.userId]) {
      userResultsMap[doc.userId] = { approved: 0, rejected: 0, total: 0, userName: user?.name ?? "Unknown" };
    }
    userResultsMap[doc.userId]!.total++;
    if (result.status === "approved") userResultsMap[doc.userId]!.approved++;
    else userResultsMap[doc.userId]!.rejected++;
  }

  // Post-process per-user: set credit limit if all docs approved, notify admin if any rejected
  for (const [userIdStr, summary] of Object.entries(userResultsMap)) {
    const userId = Number(userIdStr);
    const allUserDocs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, userId));
    const allApproved = allUserDocs.length > 0 && allUserDocs.every(d => d.status === "approved");
    const anyRejected = allUserDocs.some(d => d.status === "rejected");

    if (allApproved) {
      // Set default credit limit (KES 500,000) for approved farmers
      await db.update(usersTable)
        .set({ creditLimitKES: "500000" } as any)
        .where(eq(usersTable.id, userId));
      // Notify user of full approval
      await db.insert(notificationsTable).values({
        userId,
        type: "kyc_approved",
        title: "🎉 KYC Fully Approved by AI",
        body: "All your documents have been verified. Your credit limit has been set to KES 500,000.",
      }).catch(() => {});
      sendKycApprovedEmail(
        allUserDocs[0] ? (await db.select().from(usersTable).where(eq(usersTable.id, userId)).then(([u]) => u?.email ?? "")) : "",
        summary.userName
      ).catch(() => {});
    }

    if (anyRejected) {
      // Create admin notification about rejected docs
      const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
      if (admins.length > 0) {
        await db.insert(notificationsTable).values(
          admins.map(a => ({
            userId: a.id,
            type: "kyc_rejected",
            title: `⚠️ AI KYC Issues: ${summary.userName}`,
            body: `${summary.rejected} of ${summary.total} documents failed AI review and need manual inspection.`,
          }))
        ).catch(() => {});
      }
      // Notify the user
      await db.insert(notificationsTable).values({
        userId,
        type: "kyc_rejected",
        title: "⚠️ KYC Documents Need Attention",
        body: `${summary.rejected} of your document${summary.rejected !== 1 ? "s were" : " was"} flagged. Please re-upload clearer versions.`,
      }).catch(() => {});
    }
  }

  const approved = results.filter(r => r.status === "approved").length;
  const rejected = results.filter(r => r.status === "rejected").length;
  res.json({ reviewed: results.length, approved, rejected, results });
});

// ─── ACTIVITY / LOGIN LOGS ────────────────────────────────────────────────────

// GET /admin/activity — recent transactions and login audit events
router.get("/admin/activity", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;

  const [txs, loginEvents] = await Promise.all([
    db
      .select({ tx: walletTransactionsTable, user: usersTable })
      .from(walletTransactionsTable)
      .leftJoin(usersTable, eq(walletTransactionsTable.userId, usersTable.id))
      .orderBy(desc(walletTransactionsTable.createdAt))
      .limit(100),
    db
      .select({ log: auditLogsTable, user: usersTable })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .where(eq(auditLogsTable.action, "login"))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(100),
  ]);

  res.json({
    recentTransactions: txs.map(r => ({
      id: r.tx.id,
      userId: r.tx.userId,
      userName: r.user?.name ?? "Unknown",
      userEmail: r.user?.email ?? "",
      type: r.tx.type,
      amount: Number(r.tx.amount),
      status: r.tx.status,
      description: r.tx.description,
      reference: r.tx.reference,
      createdAt: r.tx.createdAt?.toISOString() ?? null,
    })),
    loginEvents: loginEvents.map(r => ({
      id: r.log.id,
      userId: r.log.userId,
      userName: r.user?.name ?? "Unknown",
      userEmail: r.user?.email ?? "",
      ipAddress: r.log.ipAddress ?? "Unknown",
      userAgent: r.log.userAgent ?? "Unknown",
      createdAt: r.log.createdAt?.toISOString() ?? null,
    })),
  });
});

/** Admin notification bell — returns unread counts + recent actionable items */
router.get("/admin/notifications-bell", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;

  const [pendingKyc, pendingDeposits, openTickets] = await Promise.all([
    db.select({ doc: kycDocumentsTable, user: usersTable })
      .from(kycDocumentsTable)
      .leftJoin(usersTable, eq(kycDocumentsTable.userId, usersTable.id))
      .where(eq(kycDocumentsTable.status, "pending"))
      .orderBy(desc(kycDocumentsTable.createdAt))
      .limit(10),
    db.select({ tx: walletTransactionsTable, user: usersTable })
      .from(walletTransactionsTable)
      .leftJoin(usersTable, eq(walletTransactionsTable.userId, usersTable.id))
      .where(and(eq(walletTransactionsTable.type, "deposit"), eq(walletTransactionsTable.status, "pending")))
      .orderBy(desc(walletTransactionsTable.createdAt))
      .limit(10),
    db.select()
      .from(adminMessagesTable)
      .where(eq(adminMessagesTable.isReadByAdmin, false))
      .orderBy(desc(adminMessagesTable.createdAt))
      .limit(10),
  ]);

  res.json({
    total: pendingKyc.length + pendingDeposits.length + openTickets.length,
    pendingKyc: pendingKyc.map(r => ({
      id: r.doc.id,
      userId: r.doc.userId,
      userName: r.user?.name ?? "Unknown",
      userEmail: r.user?.email ?? "",
      docType: r.doc.documentType,
      createdAt: r.doc.createdAt?.toISOString() ?? null,
    })),
    pendingDeposits: pendingDeposits.map(r => ({
      id: r.tx.id,
      userId: r.tx.userId,
      userName: r.user?.name ?? "Unknown",
      amount: Number(r.tx.amount),
      reference: r.tx.reference ?? "",
      createdAt: r.tx.createdAt?.toISOString() ?? null,
    })),
    unreadMessages: openTickets.map(m => ({
      id: m.id,
      subject: m.subject,
      userId: m.userId,
      createdAt: m.createdAt?.toISOString() ?? null,
    })),
  });
});

// Public endpoint — no auth required — exposes safe subset of platform settings to frontend
router.get("/platform/settings", async (_req, res): Promise<void> => {
  const s = await loadSettings();
  res.json({
    primaryPurchaseFeePct: s.primaryPurchaseFeePct,
    secondaryTradeFeePct: s.secondaryTradeFeePct,
    withdrawalFeePct: s.withdrawalFeePct,
    withdrawalFeeCap: s.withdrawalFeeCap,
    minInvestmentKES: s.minInvestmentKES,
    minSharePurchase: s.minSharePurchase,
  });
});

// ─── DB Status — admin only ───────────────────────────────────────────────────
// Returns live database schema compared against the expected Drizzle schema.
// Useful for diagnosing schema drift between dev and production.
const EXPECTED_TABLES = [
  "admin_messages", "app_reviews", "audit_logs", "dividends", "escrow_wallets",
  "farmer_groups", "farms", "farm_updates", "harvest_payments", "investments",
  "investor_portfolio_subscriptions", "kyc_documents", "loan_applications",
  "market_listings", "notifications", "order_book", "otp_codes",
  "password_reset_tokens", "platform_revenue", "portfolio_fees",
  "portfolio_holdings", "portfolios", "price_alerts", "push_subscriptions",
  "reinvestment_rules", "roi_projections", "sentiment_scores", "stellar_accounts",
  "support_tickets", "transaction_fees", "transactions", "users",
  "voucher_orders", "wallets", "wallet_transactions", "watchlist",
];

router.get("/admin/db-status", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

  const client = await pool.connect();
  try {
    // Fetch all tables in the public schema
    const tablesResult = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    const liveTables = new Set(tablesResult.rows.map(r => r.table_name));

    // Fetch all columns for all live tables at once
    const colsResult = await client.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(
      `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`
    );

    // Group columns by table
    const columnsByTable: Record<string, Array<{ name: string; type: string; nullable: boolean }>> = {};
    for (const row of colsResult.rows) {
      if (!columnsByTable[row.table_name]) columnsByTable[row.table_name] = [];
      columnsByTable[row.table_name]!.push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === "YES",
      });
    }

    const missingTables = EXPECTED_TABLES.filter(t => !liveTables.has(t));
    const extraTables = [...liveTables].filter(t => !EXPECTED_TABLES.includes(t));

    const tableStatus = EXPECTED_TABLES.map(name => ({
      name,
      exists: liveTables.has(name),
      columns: columnsByTable[name] ?? [],
    }));

    // Count row estimates for key tables
    let rowCounts: Record<string, number> = {};
    const keyTables = ["users", "farms", "market_listings", "wallets", "investments"];
    for (const t of keyTables) {
      if (liveTables.has(t)) {
        const r = await client.query<{ count: string }>(`SELECT COUNT(*) as count FROM "${t}"`);
        rowCounts[t] = parseInt(r.rows[0]?.count ?? "0", 10);
      }
    }

    res.json({
      ok: missingTables.length === 0,
      summary: {
        expectedTables: EXPECTED_TABLES.length,
        liveTables: liveTables.size,
        missingTables: missingTables.length,
        extraTables: extraTables.length,
      },
      missingTables,
      extraTables,
      rowCounts,
      tables: tableStatus,
    });
  } finally {
    client.release();
  }
});

// ── SUPPORT TICKETS (admin) ───────────────────────────────────────────────────

router.get("/admin/support-tickets", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res, true);
  if (!ok) return;

  const rows = await db
    .select({ ticket: supportTicketsTable, user: usersTable })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(usersTable.id, supportTicketsTable.userId))
    .orderBy(desc(supportTicketsTable.createdAt))
    .limit(500);

  res.json(rows.map(r => ({
    ...r.ticket,
    userName: r.user?.name ?? "Unknown",
    userEmail: r.user?.email ?? "",
  })));
});

router.patch("/admin/support-tickets/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "Invalid ticket id" }); return; }

  const { adminReply, status } = req.body as { adminReply?: string; status?: string };
  const validStatuses = ["open", "in_progress", "resolved", "closed"];
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (adminReply !== undefined) { updates.adminReply = adminReply.trim(); updates.adminRepliedAt = new Date(); }
  if (status && validStatuses.includes(status)) updates.status = status as any;

  const [updated] = await db.update(supportTicketsTable).set(updates).where(eq(supportTicketsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Ticket not found" }); return; }

  // Notify user of reply
  if (adminReply && updated.userId) {
    const user = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
    if (user[0]) {
      sendGenericEmail(user[0].email, `Re: Support Ticket #${id} — ${updated.subject}`, `
        <p>Hi ${user[0].name},</p>
        <p>Our support team has replied to your ticket <strong>#${id}: ${updated.subject}</strong>.</p>
        <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;margin:16px 0;border-radius:4px">
          <p style="margin:0;color:#15803d;font-size:14px">${adminReply.trim()}</p>
        </div>
        <p>Status: <strong style="text-transform:capitalize">${status ?? updated.status}</strong></p>
        <p>— Investa Farm Support Team</p>
      `).catch(() => {});
    }
  }

  res.json({ ok: true, ticket: updated });
});

router.post("/admin/support-tickets/:id/credit", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "Invalid ticket id" }); return; }

  const { amountKES, note } = req.body as { amountKES: number; note?: string };
  if (!amountKES || amountKES <= 0) { res.status(400).json({ error: "amountKES must be positive" }); return; }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  // Credit the wallet
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, ticket.userId)).limit(1);
  if (!wallet) { res.status(404).json({ error: "User wallet not found" }); return; }

  const newBalance = Number(wallet.balance) + amountKES;
  await db.update(walletsTable).set({ balance: String(newBalance), updatedAt: new Date() }).where(eq(walletsTable.userId, ticket.userId));
  await db.insert(walletTransactionsTable).values({
    userId: ticket.userId, type: "deposit", amount: String(amountKES),
    balanceAfter: String(newBalance), status: "completed",
    description: note?.trim() || `Support credit — Ticket #${id}`,
    reference: `SUPPORT-${id}-${Date.now()}`,
  });

  // Mark ticket as credited
  await db.update(supportTicketsTable).set({ walletCredited: amountKES, status: "resolved", updatedAt: new Date() }).where(eq(supportTicketsTable.id, id));

  // Notify user
  const user = await db.select().from(usersTable).where(eq(usersTable.id, ticket.userId)).limit(1);
  if (user[0]) {
    sendGenericEmail(user[0].email, `KES ${amountKES.toLocaleString("en-KE")} Credited to Your Wallet`, `
      <p>Hi ${user[0].name},</p>
      <p>We have credited <strong>KES ${amountKES.toLocaleString("en-KE")}</strong> to your Investa Farm wallet
         in resolution of your support ticket <strong>#${id}</strong>.</p>
      ${note ? `<p><em>${note}</em></p>` : ""}
      <p>Your new wallet balance has been updated. You can view it in the app.</p>
      <p>— Investa Farm Support Team</p>
    `).catch(() => {});
  }

  res.json({ ok: true, amountKES, newBalance });
});

// ── DIRECT WALLET CREDIT (Activity tab) ──────────────────────────────────────

router.post("/admin/wallet/:userId/credit", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const userId = parseInt(req.params.userId, 10);
  if (!userId) { res.status(400).json({ error: "Invalid userId" }); return; }

  const { amountKES, reference, note } = req.body as { amountKES: number; reference?: string; note?: string };
  if (!amountKES || amountKES <= 0) { res.status(400).json({ error: "amountKES must be positive" }); return; }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (!wallet) { res.status(404).json({ error: "Wallet not found for this user" }); return; }

  const newBalance = Number(wallet.balance) + amountKES;
  await db.update(walletsTable).set({ balance: String(newBalance), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
  await db.insert(walletTransactionsTable).values({
    userId, type: "deposit", amount: String(amountKES),
    balanceAfter: String(newBalance), status: "completed",
    description: note?.trim() || "Admin direct credit",
    reference: reference?.trim() || `ADMIN-CREDIT-${Date.now()}`,
  });

  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user[0]) {
    sendGenericEmail(user[0].email, `KES ${amountKES.toLocaleString("en-KE")} Added to Your Wallet`, `
      <p>Hi ${user[0].name},</p>
      <p>An administrator has added <strong>KES ${amountKES.toLocaleString("en-KE")}</strong> to your Investa Farm wallet.</p>
      ${note ? `<p>Note: <em>${note}</em></p>` : ""}
      <p>— Investa Farm Team</p>
    `).catch(() => {});
  }

  res.json({ ok: true, amountKES, newBalance });
});

// Public DB health — lightweight, no auth, safe for uptime monitors
router.get("/admin/db-health", async (_req, res): Promise<void> => {
  const client = await pool.connect().catch(() => null);
  if (!client) { res.status(503).json({ ok: false, db: "unreachable" }); return; }
  try {
    await client.query("SELECT 1");
    // Quick schema sanity — just check users table exists and has the right cols
    const r = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM information_schema.columns
       WHERE table_schema='public' AND table_name='users' AND column_name IN
       ('id','email','password_hash','role','email_verified','county','credit_limit_kes')`
    );
    const colCount = parseInt(r.rows[0]?.count ?? "0", 10);
    const schemaOk = colCount >= 7;
    res.json({ ok: schemaOk, db: "connected", usersColumnsFound: colCount, schemaOk });
  } finally {
    client.release();
  }
});

export default router;
