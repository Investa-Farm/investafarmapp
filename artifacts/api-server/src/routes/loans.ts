import { Router, type IRouter } from "express";
import { db, loanApplicationsTable, farmsTable, marketListingsTable, kycDocumentsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { z } from "zod";
import { sendFundingApplicationEmail } from "../lib/email";

const router: IRouter = Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const ApplyLoanBody = z.object({
  amount: z.number().positive(),
  purpose: z.enum(["seeds", "fertilizer", "equipment", "irrigation", "labour", "other"]),
  purposeDetails: z.string().min(10),
  repaymentPeriodMonths: z.number().int().min(1).max(24),
  cropType: z.string().optional(),
  farmId: z.number().optional(),
  groupId: z.number().optional(),
  farmName: z.string().optional(),
  location: z.string().optional(),
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
    // Voucher only visible to farmer after farm is fully funded (status: disbursed)
    voucherCode: a.status === "disbursed" ? voucherCode : undefined,
    voucherExpiry: a.status === "disbursed" ? voucherExpiry.toISOString() : undefined,
  };
}

function extractCropType(details: string): string | undefined {
  const match = details.match(/\[crop:([\w\s]+)\]/i);
  return match ? match[1].trim() : undefined;
}

async function aiScoreLoan(opts: {
  cropType: string; amount: number; location: string; purpose: string;
  purposeDetails: string; approvedKycCount: number;
}): Promise<{ score: number; summary: string }> {
  // Local scoring baseline
  let score = 50;
  score += opts.approvedKycCount * 15;
  const stableCrops = ["maize", "wheat", "potatoes", "beans", "dairy", "sunflower", "cassava", "rice", "sorghum", "kale"];
  const volatileCrops = ["coffee", "avocado", "tobacco", "horticulture", "macadamia"];
  const crop = opts.cropType.toLowerCase();
  if (stableCrops.some(c => crop.includes(c))) score += 10;
  if (volatileCrops.some(c => crop.includes(c))) score -= 5;
  if (opts.amount <= 200_000) score += 10;
  else if (opts.amount > 2_000_000) score -= 10;
  score = Math.max(0, Math.min(100, score));

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: `Score this farm funding application 0-100 for Investa Farm Kenya.
Crop: ${opts.cropType}, Amount: KES ${opts.amount.toLocaleString()}, Location: ${opts.location}
Purpose: ${opts.purpose}, Details: ${opts.purposeDetails.slice(0, 120)}
KYC docs approved: ${opts.approvedKycCount}
Return ONLY valid JSON: {"score": number, "summary": "one sentence reason"}` }],
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
    description: `Farm funded via loan application #${loanId}. Growing ${cropType} in ${location}.`,
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

router.post("/loans/apply", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  // KYC gate — must have at least 1 approved doc (waived for demo accounts)
  const kycDocs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, user.id));
  const approvedKyc = kycDocs.filter(d => d.status === "approved");
  const isDemoFarmer = DEMO_FARMER_EMAILS.has(user.email.toLowerCase());
  if (approvedKyc.length === 0 && !isDemoFarmer) {
    res.status(403).json({ error: "KYC_REQUIRED", message: "Please complete KYC verification before applying. Upload your ID and farm documents from your dashboard." });
    return;
  }

  const parsed = ApplyLoanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount, purpose, purposeDetails, repaymentPeriodMonths, cropType, farmId, groupId, farmName, location } = parsed.data;
  const resolvedCrop = cropType ?? "Maize";
  const resolvedLocation = location ?? "Nairobi, Kenya";
  const detailsWithCrop = `[crop:${resolvedCrop}] ${purposeDetails}`;

  // AI scoring via Groq
  const aiResult = await aiScoreLoan({
    cropType: resolvedCrop,
    amount,
    location: resolvedLocation,
    purpose,
    purposeDetails,
    approvedKycCount: approvedKyc.length,
  }).catch(() => ({ score: 65, summary: "AI score unavailable" }));

  const [app] = await db.insert(loanApplicationsTable).values({
    farmerId: user.id,
    amount: String(amount),
    purpose,
    purposeDetails: detailsWithCrop,
    repaymentPeriodMonths,
    status: "approved",
    farmId: farmId ?? null,
    groupId: groupId ?? null,
    submittedAt: new Date(),
    reviewNotes: `AI Score: ${aiResult.score}/100 — ${aiResult.summary}`,
  }).returning();

  // Auto-create farm + market listing
  const resolvedFarmName = farmName ?? `${user.name.split(" ")[0]}'s ${resolvedCrop} Farm`;
  const newFarmId = await autoCreateFarmAndListing(user.id, app.id, amount, resolvedCrop, resolvedFarmName, resolvedLocation);

  // Send contract email to farmer
  sendFundingApplicationEmail(user.email, user.name, {
    amount,
    purpose,
    cropType: resolvedCrop,
    location: resolvedLocation,
    farmName: resolvedFarmName,
    repaymentMonths: repaymentPeriodMonths,
    aiScore: aiResult.score,
    aiSummary: aiResult.summary,
  }).catch(() => {/* non-critical */});

  res.status(201).json({ ...formatLoan(app, resolvedCrop), newFarmId, aiScore: aiResult.score });
});

router.post("/loans/repay/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const loanId = parseInt(req.params.id, 10);
  if (isNaN(loanId)) { res.status(400).json({ error: "Invalid loan ID" }); return; }
  const parsed = RepayLoanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount } = parsed.data;
  const [loan] = await db.select().from(loanApplicationsTable)
    .where(eq(loanApplicationsTable.id, loanId));
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }
  if (loan.farmerId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  const principal = Number(loan.amount);
  const totalOwed = principal * 1.08;
  const isFullRepayment = amount >= totalOwed * 0.95;
  await db.update(loanApplicationsTable)
    .set({ status: isFullRepayment ? "disbursed" : loan.status })
    .where(eq(loanApplicationsTable.id, loanId));
  res.json({
    success: true,
    loanId,
    amountPaid: amount,
    remaining: isFullRepayment ? 0 : totalOwed - amount,
    status: isFullRepayment ? "cleared" : "partial",
    message: isFullRepayment ? "Loan fully repaid! Your account is clear." : `Partial payment of KES ${amount.toLocaleString()} received.`,
  });
});

export default router;
