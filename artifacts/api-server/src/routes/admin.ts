import { Router, type IRouter } from "express";
import { eq, desc, notInArray } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";
import { db, usersTable, farmsTable, loanApplicationsTable, kycDocumentsTable, investmentsTable, notificationsTable, walletTransactionsTable, marketListingsTable, farmUpdatesTable, transactionsTable, dividendsTable, walletsTable, priceAlertsTable, pushSubscriptionsTable, orderBookTable, watchlistTable, stellarAccountsTable, reinvestmentRulesTable, otpCodesTable, passwordResetTokensTable, escrowWalletsTable, adminMessagesTable, auditLogsTable, harvestPaymentsTable, portfolioHoldingsTable, platformRevenueTable, transactionFeesTable } from "@workspace/db";
import { getCurrentUser } from "./auth";
import { sendKycApprovedEmail, sendKycRejectedEmail, sendGenericEmail } from "../lib/email";
import { sendPushToUser, createInAppNotification } from "../lib/push";
import { triggerFarmHarvest } from "../scheduler";
import { loadSettings, saveSettings, type PlatformSettings } from "../lib/platformSettings";

const router: IRouter = Router();

// ── Admin token helpers (HMAC-signed, not plain base64) ───────────────────────
const ADMIN_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";

type AdminRole = "master" | "sub" | "kyc";

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

async function requireAdmin(req: any, res: any): Promise<boolean> {
  // Accept regular Bearer JWT from an admin-role user
  const user = await getCurrentUser(req);
  if (user && user.role === "admin") return true;

  // Also accept HMAC-signed admin session tokens
  const auth: string = req.headers["authorization"] ?? "";
  if (auth.startsWith("Bearer ")) {
    const tok = auth.slice(7);
    const role = verifyAdminToken(tok);
    if (role === "master" || role === "sub" || role === "kyc") return true;
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

router.get("/admin/stats", async (req, res): Promise<void> => {
  const [users, farms, loans, kycs, investments, walletTxs] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(farmsTable),
    db.select().from(loanApplicationsTable).orderBy(desc(loanApplicationsTable.createdAt)),
    db.select().from(kycDocumentsTable),
    db.select().from(investmentsTable),
    db.select().from(walletTransactionsTable),
  ]);

  const totalFarmers = users.filter(u => u.role === "farmer").length;
  const totalInvestors = users.filter(u => u.role === "investor").length;
  const totalCooperatives = users.filter(u => u.role === "cooperative").length;
  const pendingKyc = kycs.filter(k => k.status === "pending").length;
  const pendingLoans = loans.filter(l => l.status === "submitted" || l.status === "under_review").length;
  const completedLoans = loans.filter(l => l.status === "approved").length;
  const totalInvested = investments.reduce((s, i) => s + Number(i.purchasePrice) * i.quantity, 0);
  const aum = investments.filter(i => i.status === "active").reduce((s, i) => s + Number(i.purchasePrice) * i.quantity, 0);
  const totalTransactions = walletTxs.length;
  const totalDeposits = walletTxs.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
  const totalWithdrawals = walletTxs.filter(t => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0);

  const recentLoansSlice = loans.slice(0, 5);
  const recentLoansWithFarmer = await Promise.all(
    recentLoansSlice.map(async l => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, l.farmerId));
      return {
        id: l.id,
        farmerName: user?.name ?? "Unknown",
        amount: l.amount,
        status: l.status,
        cropType: l.purpose,
        createdAt: l.createdAt.toISOString(),
      };
    })
  );

  res.json({
    totalUsers: users.length,
    totalFarmers,
    totalInvestors,
    totalCooperatives,
    totalFarms: farms.length,
    totalLoans: loans.length,
    totalInvested,
    aum,
    totalTransactions,
    totalDeposits,
    totalWithdrawals,
    pendingKyc,
    pendingLoans,
    completedLoans,
    recentUsers: [...users].reverse().slice(0, 10).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    })),
    recentLoans: recentLoansWithFarmer,
  });
});

router.get("/admin/transactions", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
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
  const { role } = req.query as { role?: string };
  let users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  if (role && role !== "all") {
    users = users.filter(u => u.role === role);
  }

  // Get KYC info for each user
  const kycs = await db.select().from(kycDocumentsTable);
  const mapped = users.map(u => {
    const userKyc = kycs.filter(k => k.userId === u.id);
    const allApproved = userKyc.length > 0 && userKyc.every(k => k.status === "approved");
    const anyPending = userKyc.some(k => k.status === "pending");
    const anyRejected = userKyc.some(k => k.status === "rejected");
    const kycStatus = allApproved ? "approved" : anyPending ? "pending" : anyRejected ? "rejected" : "none";
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      emailVerified: u.emailVerified,
      kycStatus,
      kycDocCount: userKyc.length,
      createdAt: u.createdAt.toISOString(),
    };
  });

  res.json(mapped.map(u => {
    const full = users.find(uu => uu.id === u.id);
    return {
      ...u,
      creditLimitKES: full?.creditLimitKES ?? null,
      maxDepositKES: full?.maxDepositKES ?? null,
      maxWithdrawalKES: full?.maxWithdrawalKES ?? null,
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
  const ok = await requireAdmin(req, res);
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
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const farms = await db
    .select({ farm: farmsTable, farmer: usersTable })
    .from(farmsTable)
    .leftJoin(usersTable, eq(farmsTable.farmerId, usersTable.id));
  const investments = await db.select().from(investmentsTable);
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
  const ok = await requireAdmin(req, res);
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
  const ok = await requireAdmin(req, res);
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
  const ok = await requireAdmin(req, res);
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
  const ok = await requireAdmin(req, res);
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

export default router;
