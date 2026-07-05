import { Router, type IRouter } from "express";
import { db, loanApplicationsTable, farmsTable, marketListingsTable, kycDocumentsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { z } from "zod";
import { sendFundingApplicationEmail, sendFundingVoucherEmail } from "../lib/email";
import { notifyUser } from "../lib/push";
import { debitWallet } from "../lib/walletOps";

const router: IRouter = Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ── Credit tiers ─────────────────────────────────────────────────────────────
export const CREDIT_TIERS = [
  { tier: "gold",   label: "Gold",   emoji: "🥇", minRepaid: 3, minScore: 80, interestRate: 1.04, color: "#ca8a04" },
  { tier: "silver", label: "Silver", emoji: "🥈", minRepaid: 2, minScore: 70, interestRate: 1.06, color: "#64748b" },
  { tier: "bronze", label: "Bronze", emoji: "🥉", minRepaid: 0, minScore: 0,  interestRate: 1.08, color: "#b45309" },
] as const;

export async function getFarmerCreditTier(farmerId: number) {
  const loans = await db.select().from(loanApplicationsTable).where(eq(loanApplicationsTable.farmerId, farmerId));
  const repaidLoans = loans.filter(l => l.status === "disbursed" && Number(l.amountRepaid) >= Number(l.amount) * Number(l.interestRate) * 0.95);
  const scored = loans.filter(l => l.aiScore != null);
  const avgScore = scored.length > 0 ? scored.reduce((s, l) => s + (l.aiScore ?? 0), 0) / scored.length : 0;
  const repaidCount = repaidLoans.length;

  const tier = CREDIT_TIERS.find(t => repaidCount >= t.minRepaid && avgScore >= t.minScore) ?? CREDIT_TIERS[CREDIT_TIERS.length - 1];
  const nextTier = CREDIT_TIERS.find(t => t.tier !== tier.tier && (t.minRepaid > repaidCount || t.minScore > avgScore) && t.interestRate < tier.interestRate);

  return {
    tier: tier.tier, label: tier.label, emoji: tier.emoji, color: tier.color,
    interestRate: tier.interestRate,
    repaidCount, avgScore: Math.round(avgScore),
    nextTier: nextTier ? {
      label: nextTier.label, emoji: nextTier.emoji, interestRate: nextTier.interestRate,
      loansNeeded: Math.max(0, nextTier.minRepaid - repaidCount),
      scoreNeeded: Math.max(0, nextTier.minScore - avgScore),
    } : null,
  };
}

// ── Cost breakdown schema ────────────────────────────────────────────────────
const CostBreakdownSchema = z.object({
  landPrep:     z.number().min(0).default(0),
  seeds:        z.number().min(0).default(0),
  fertilizer:   z.number().min(0).default(0),
  pesticides:   z.number().min(0).default(0),
  labour:       z.number().min(0).default(0),
  equipment:    z.number().min(0).default(0),
  irrigation:   z.number().min(0).default(0),
  transport:    z.number().min(0).default(0),
  postHarvest:  z.number().min(0).default(0),
  insurance:    z.number().min(0).default(0),
  contingency:  z.number().min(0).default(0),
  total:        z.number().min(0),
});

const ApplyLoanBody = z.object({
  amount: z.number().positive(),
  purpose: z.enum(["seeds", "fertilizer", "equipment", "irrigation", "labour", "other"]),
  purposeDetails: z.string().min(5),
  repaymentPeriodMonths: z.number().int().min(1).max(24),
  cropType: z.string().optional(),
  farmId: z.number().optional(),
  groupId: z.number().optional(),
  farmName: z.string().optional(),
  location: z.string().optional(),
  // New full-proposal fields
  acreage: z.string().optional(),
  harvestDate: z.string().optional(),
  costBreakdown: CostBreakdownSchema.optional(),
  expectedYieldKg: z.string().optional(),
  expectedPricePerKg: z.string().optional(),
  expectedRevenue: z.number().optional(),
  farmerShare: z.number().optional(),
});

function generateVoucherCode(id: number, purpose: string): string {
  const year = new Date().getFullYear();
  const prefix = purpose.slice(0, 3).toUpperCase();
  const padded = id.toString().padStart(4, "0");
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `IF-${year}-${prefix}${padded}-${rand}`;
}

function getVoucherExpiry(daysFromNow = 60): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

function formatLoan(a: typeof loanApplicationsTable.$inferSelect, cropType?: string) {
  const voucherCode = generateVoucherCode(a.id, a.purpose);
  const voucherExpiry = getVoucherExpiry(60);
  return {
    id: a.id,
    amount: Number(a.amount),
    purpose: a.purpose,
    purposeDetails: a.purposeDetails,
    repaymentPeriodMonths: a.repaymentPeriodMonths,
    status: a.status,
    reviewNotes: a.reviewNotes ?? undefined,
    farmId: a.farmId ?? undefined,
    groupId: a.groupId ?? undefined,
    submittedAt: a.submittedAt?.toISOString(),
    createdAt: a.createdAt.toISOString(),
    cropType: cropType ?? extractCropType(a.purposeDetails),
    cropName: a.cropName ?? undefined,
    acreage: a.acreage ?? undefined,
    farmLocation: a.farmLocation ?? undefined,
    harvestDate: a.harvestDate ?? undefined,
    costBreakdown: a.costBreakdown ?? undefined,
    expectedYieldKg: a.expectedYieldKg ?? undefined,
    expectedPricePerKg: a.expectedPricePerKg ?? undefined,
    expectedRevenue: a.expectedRevenue ? Number(a.expectedRevenue) : undefined,
    farmerShare: a.farmerShare ? Number(a.farmerShare) : undefined,
    voucherCode: a.status === "disbursed" ? voucherCode : undefined,
    voucherExpiry: a.status === "disbursed" ? voucherExpiry.toISOString() : undefined,
    aiScore: a.aiScore ?? undefined,
    interestRate: Number(a.interestRate) || 1.08,
    amountRepaid: Number(a.amountRepaid) || 0,
    nextRepaymentDueAt: a.nextRepaymentDueAt?.toISOString(),
    statusHistory: Array.isArray(a.statusHistory) ? a.statusHistory : [],
  };
}

function extractCropType(details: string): string | undefined {
  const match = details.match(/\[crop:([\w\s]+)\]/i);
  return match ? match[1].trim() : undefined;
}

async function aiScoreLoan(opts: {
  cropType: string; amount: number; location: string; purpose: string;
  purposeDetails: string; approvedKycCount: number;
  acreage?: string; expectedRevenue?: number; costBreakdown?: Record<string, number>;
}): Promise<{ score: number; summary: string }> {
  let score = 50;
  score += opts.approvedKycCount * 15;
  const stableCrops = ["maize", "wheat", "potatoes", "beans", "dairy", "sunflower", "cassava", "rice", "sorghum", "kale"];
  const volatileCrops = ["coffee", "avocado", "tobacco", "horticulture", "macadamia"];
  const crop = opts.cropType.toLowerCase();
  if (stableCrops.some(c => crop.includes(c))) score += 10;
  if (volatileCrops.some(c => crop.includes(c))) score -= 5;
  if (opts.amount <= 200_000) score += 10;
  else if (opts.amount > 2_000_000) score -= 10;
  // Bonus for having detailed cost breakdown
  if (opts.costBreakdown && Object.keys(opts.costBreakdown).length > 3) score += 8;
  // Bonus for realistic ROI (revenue > 1.5× amount)
  if (opts.expectedRevenue && opts.expectedRevenue > opts.amount * 1.5) score += 7;
  score = Math.max(0, Math.min(100, score));

  try {
    const roiLine = opts.expectedRevenue
      ? `Expected revenue: KES ${opts.expectedRevenue.toLocaleString()}`
      : "";
    const costLine = opts.costBreakdown
      ? `Cost items: ${Object.entries(opts.costBreakdown).filter(([k]) => k !== "total" && k !== "contingency").map(([k, v]) => `${k}=KES${(v as number).toLocaleString()}`).join(", ")}`
      : "";
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: `Score this farm funding proposal 0-100 for Investa Farm Kenya.
Crop: ${opts.cropType}, Acreage: ${opts.acreage ?? "unknown"}, Amount: KES ${opts.amount.toLocaleString()}, Location: ${opts.location}
${roiLine}
${costLine}
KYC docs approved: ${opts.approvedKycCount}
Return ONLY valid JSON: {"score": number, "summary": "one sentence risk assessment"}` }],
        temperature: 0.1,
        max_tokens: 80,
      }),
    });
    const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { score: number; summary: string };
      return { score: Math.max(0, Math.min(100, Number(parsed.score))), summary: parsed.summary };
    }
  } catch { /* use local score */ }
  return { score, summary: `Score: ${score}/100 — ${opts.approvedKycCount} KYC doc(s) verified, ${opts.cropType} in ${opts.location}` };
}

async function autoCreateFarmAndListing(
  farmerId: number,
  loanId: number,
  amount: number,
  cropType: string,
  farmName: string,
  location: string,
  description?: string,
): Promise<number> {
  const sharePrice = Math.max(100, Math.round(amount / 1000));
  const totalShares = Math.round(amount / sharePrice);

  const CROP_IMAGES: Record<string, string> = {
    maize: "https://images.unsplash.com/photo-1601593346740-925612772716?w=400&q=80",
    coffee: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=80",
    tea: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&q=80",
    avocado: "https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=400&q=80",
    wheat: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80",
    tomatoes: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&q=80",
    potatoes: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80",
    dairy: "https://images.unsplash.com/photo-1518715308788-3005759c9a32?w=400&q=80",
    rice: "https://images.unsplash.com/photo-1536054208835-e0e6df1dc44a?w=400&q=80",
    sunflower: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
    beans: "https://images.unsplash.com/photo-1558618047-f4fb9d04dbd7?w=400&q=80",
    kale: "https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?w=400&q=80",
  };
  const key = cropType.toLowerCase().split(" ")[0] ?? "maize";
  const imageUrl = CROP_IMAGES[key] ?? "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=400&q=80";

  const [farm] = await db.insert(farmsTable).values({
    farmerId,
    name: farmName,
    cropType,
    location,
    loanAmount: String(amount),
    totalShares,
    sharePrice: String(sharePrice),
    sharesAvailable: totalShares,
    currentPrice: String(sharePrice),
    changePercent: "0",
    status: "active",
    imageUrl,
    description: description ?? `Farm funded via loan application #${loanId}. Growing ${cropType} in ${location}.`,
  }).returning();

  await db.insert(marketListingsTable).values({
    farmId: farm.id,
    sellerId: farmerId,
    listingType: "primary",
    sharesAvailable: totalShares,
    pricePerShare: String(sharePrice),
    isActive: 1,
  });

  await db.update(loanApplicationsTable)
    .set({ farmId: farm.id })
    .where(eq(loanApplicationsTable.id, loanId));

  return farm.id;
}

const RepayLoanBody = z.object({
  amount: z.number().positive(),
});

// ── GET /loans/applications ──────────────────────────────────────────────────
router.get("/loans/applications", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const apps = await db.select().from(loanApplicationsTable)
    .where(eq(loanApplicationsTable.farmerId, user.id));
  res.json(apps.map(a => formatLoan(a)));
});

const DEMO_FARMER_EMAILS = new Set([
  "john.farmer@investafarm.com",
  "demo.farmer@investafarm.com",
]);

// ── POST /loans/apply ────────────────────────────────────────────────────────
router.post("/loans/apply", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const kycDocs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, user.id));
  const approvedKyc = kycDocs.filter(d => d.status === "approved");
  const isDemoFarmer = DEMO_FARMER_EMAILS.has(user.email.toLowerCase());
  if (approvedKyc.length === 0 && !isDemoFarmer) {
    res.status(403).json({ error: "KYC_REQUIRED", message: "Please complete KYC verification before applying. Upload your ID and farm documents from your dashboard." });
    return;
  }

  const parsed = ApplyLoanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const {
    amount, purpose, purposeDetails, repaymentPeriodMonths,
    cropType, farmId, groupId, farmName, location,
    acreage, harvestDate, costBreakdown, expectedYieldKg, expectedPricePerKg,
    expectedRevenue, farmerShare,
  } = parsed.data;

  const resolvedCrop = cropType ?? "Maize";
  const resolvedLocation = location ?? "Nairobi, Kenya";
  const detailsWithCrop = `[crop:${resolvedCrop}] ${purposeDetails}`;

  const creditTier = await getFarmerCreditTier(user.id);

  const submittedAt = new Date();
  const statusHistory: { stage: string; at: string; note?: string }[] = [
    { stage: "submitted", at: submittedAt.toISOString() },
  ];

  const aiResult = await aiScoreLoan({
    cropType: resolvedCrop,
    amount,
    location: resolvedLocation,
    purpose,
    purposeDetails,
    approvedKycCount: approvedKyc.length,
    acreage,
    expectedRevenue,
    costBreakdown: costBreakdown as Record<string, number> | undefined,
  }).catch(() => ({ score: 65, summary: "AI score unavailable" }));

  statusHistory.push({ stage: "ai_scored", at: new Date().toISOString(), note: `Score ${aiResult.score}/100` });
  statusHistory.push({ stage: "approved", at: new Date().toISOString(), note: `${creditTier.label} tier — ${((creditTier.interestRate - 1) * 100).toFixed(0)}% interest` });

  const dueAt = new Date(submittedAt);
  dueAt.setMonth(dueAt.getMonth() + repaymentPeriodMonths);

  const [app] = await db.insert(loanApplicationsTable).values({
    farmerId: user.id,
    amount: String(amount),
    purpose,
    purposeDetails: detailsWithCrop,
    repaymentPeriodMonths,
    status: "approved",
    farmId: farmId ?? null,
    groupId: groupId ?? null,
    submittedAt,
    reviewNotes: `AI Score: ${aiResult.score}/100 — ${aiResult.summary}`,
    aiScore: aiResult.score,
    interestRate: creditTier.interestRate.toFixed(3),
    nextRepaymentDueAt: dueAt,
    cropName: resolvedCrop,
    acreage: acreage ?? null,
    farmLocation: resolvedLocation,
    harvestDate: harvestDate ?? null,
    costBreakdown: costBreakdown ?? null,
    expectedYieldKg: expectedYieldKg ?? null,
    expectedPricePerKg: expectedPricePerKg ?? null,
    expectedRevenue: expectedRevenue ? String(expectedRevenue) : null,
    farmerShare: farmerShare ? String(farmerShare) : null,
    statusHistory,
  }).returning();

  const resolvedFarmName = farmName ?? `${user.name.split(" ")[0]}'s ${resolvedCrop} Farm`;
  const proposalDescription = costBreakdown
    ? `${resolvedCrop} farm in ${resolvedLocation}. ${acreage ? `${acreage} acres. ` : ""}${expectedRevenue ? `Projected revenue: KES ${expectedRevenue.toLocaleString()}.` : ""}`
    : undefined;

  const newFarmId = await autoCreateFarmAndListing(
    user.id, app.id, amount, resolvedCrop, resolvedFarmName, resolvedLocation, proposalDescription
  );

  statusHistory.push({ stage: "listed", at: new Date().toISOString(), note: `Farm #${newFarmId} live on marketplace` });
  await db.update(loanApplicationsTable).set({ statusHistory }).where(eq(loanApplicationsTable.id, app.id));

  sendFundingApplicationEmail(user.email, user.name, {
    amount,
    purpose,
    cropType: resolvedCrop,
    location: resolvedLocation,
    farmName: resolvedFarmName,
    repaymentMonths: repaymentPeriodMonths,
    aiScore: aiResult.score,
    aiSummary: aiResult.summary,
  }).catch(() => {});

  notifyUser(
    user.id,
    "loan_approved",
    "✅ Farm Proposal Approved!",
    `${resolvedFarmName} (KES ${amount.toLocaleString()}) is now live on the marketplace. AI Score: ${aiResult.score}/100.`,
    "/farmer/farm-profile"
  ).catch(() => {});

  res.status(201).json({ ...formatLoan({ ...app, statusHistory }, resolvedCrop), newFarmId, aiScore: aiResult.score, creditTier: creditTier.tier });
});

// ── GET /loans/credit-tier ───────────────────────────────────────────────────
router.get("/loans/credit-tier", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const tier = await getFarmerCreditTier(user.id);
  res.json(tier);
});

type RepayLoanResult =
  | { error: string; code: number }
  | { loan: typeof loanApplicationsTable.$inferSelect; isFullRepayment: boolean; totalOwed: number; remaining: number };

async function repayLoanInternal(loanId: number, userId: number, amount: number): Promise<RepayLoanResult> {
  const [loan] = await db.select().from(loanApplicationsTable)
    .where(eq(loanApplicationsTable.id, loanId));
  if (!loan) return { error: "Loan not found", code: 404 };
  if (loan.farmerId !== userId) return { error: "Forbidden", code: 403 };

  const principal = Number(loan.amount);
  const rate = Number(loan.interestRate) || 1.08;
  const totalOwed = principal * rate;
  const alreadyPaid = Number(loan.amountRepaid) || 0;
  const newAmountRepaid = alreadyPaid + amount;
  const isFullRepayment = newAmountRepaid >= totalOwed * 0.95;

  const statusHistory = Array.isArray(loan.statusHistory) ? [...(loan.statusHistory as { stage: string; at: string; note?: string }[])] : [];
  if (isFullRepayment) statusHistory.push({ stage: "disbursed", at: new Date().toISOString(), note: "Loan fully repaid" });

  await db.update(loanApplicationsTable)
    .set({
      status: isFullRepayment ? "disbursed" : loan.status,
      amountRepaid: String(newAmountRepaid),
      nextRepaymentDueAt: isFullRepayment ? null : loan.nextRepaymentDueAt,
      statusHistory,
    })
    .where(eq(loanApplicationsTable.id, loanId));

  return {
    loan, isFullRepayment, totalOwed,
    remaining: isFullRepayment ? 0 : totalOwed - newAmountRepaid,
  } as const;
}

async function sendRepaymentSuccessSideEffects(userEmail: string, userName: string, loan: typeof loanApplicationsTable.$inferSelect) {
  const voucherCode = [
    "IFV",
    String(loan.id).padStart(4, "0"),
    loan.purpose.slice(0, 3).toUpperCase(),
    Math.random().toString(36).slice(2, 6).toUpperCase(),
  ].join("-");
  const farmName = loan.cropName ? `${loan.cropName} Farm` : "Your Farm";
  sendFundingVoucherEmail(
    userEmail, userName,
    Number(loan.amount), farmName,
    voucherCode,
    Math.round(Number(loan.amount) * 0.6),
  ).catch(() => {});
  notifyUser(
    loan.farmerId, "loan_disbursed",
    "🎉 Voucher Ready!",
    `Your funding voucher ${voucherCode} for ${farmName} is now available.`,
    "/farmer/farm-profile"
  ).catch(() => {});
}

// ── POST /loans/repay/:id ────────────────────────────────────────────────────
router.post("/loans/repay/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const loanId = parseInt(req.params.id, 10);
  if (isNaN(loanId)) { res.status(400).json({ error: "Invalid loan ID" }); return; }
  const parsed = RepayLoanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount } = parsed.data;

  const result = await repayLoanInternal(loanId, user.id, amount);
  if ("error" in result) { res.status(result.code).json({ error: result.error }); return; }

  if (result.isFullRepayment) await sendRepaymentSuccessSideEffects(user.email, user.name, result.loan);

  res.json({
    success: true,
    loanId,
    amountPaid: amount,
    remaining: result.remaining,
    status: result.isFullRepayment ? "cleared" : "partial",
    message: result.isFullRepayment ? "Loan fully repaid! Your account is clear." : `Partial payment of KES ${amount.toLocaleString()} received.`,
  });
});

// ── POST /loans/quick-pay/:id — one-tap pay-from-wallet ─────────────────────
router.post("/loans/quick-pay/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const loanId = parseInt(req.params.id, 10);
  if (isNaN(loanId)) { res.status(400).json({ error: "Invalid loan ID" }); return; }
  const parsed = RepayLoanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount } = parsed.data;

  const [loan] = await db.select().from(loanApplicationsTable).where(eq(loanApplicationsTable.id, loanId));
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }
  if (loan.farmerId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  try {
    await debitWallet(user.id, amount, {
      type: "fee",
      description: `Loan repayment — ${loan.cropName ?? "Farm"} loan #${loanId}`,
      reference: `loan-repay-${loanId}-${Date.now()}`,
    });
  } catch (e) {
    res.status(400).json({ error: "INSUFFICIENT_FUNDS", message: e instanceof Error ? e.message : "Insufficient wallet balance" });
    return;
  }

  const result = await repayLoanInternal(loanId, user.id, amount);
  if ("error" in result) { res.status(result.code).json({ error: result.error }); return; }

  if (result.isFullRepayment) await sendRepaymentSuccessSideEffects(user.email, user.name, result.loan);

  res.json({
    success: true,
    loanId,
    amountPaid: amount,
    remaining: result.remaining,
    status: result.isFullRepayment ? "cleared" : "partial",
    message: result.isFullRepayment ? "Loan fully repaid from wallet! Your account is clear." : `KES ${amount.toLocaleString()} paid from wallet.`,
  });
});

export default router;
