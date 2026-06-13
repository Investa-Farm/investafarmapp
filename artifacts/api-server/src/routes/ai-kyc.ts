import { Router, type IRouter } from "express";
import { db, kycDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();
const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function groqReview(docType: string, title: string, notes: string): Promise<{ status: "approved" | "rejected"; reason: string }> {
  const apiKey = GROQ_API_KEY;
  if (!apiKey) return { status: "approved", reason: "Auto-approved (AI not configured)" };

  const prompt = `You are an AI KYC officer for Investa Farm, a Kenyan farm investment platform.
A farmer has uploaded a document for verification. Assess if it should be approved or rejected.

Document Type: ${docType}
Document Title: "${title}"
Notes: "${notes || "none"}"

Rules:
- national_id: approve if title looks like a real person's name or ID reference
- selfie / national_id_back: approve unless clearly suspicious
- farm_report: approve if title references farm/crop/season/production
- land_title: approve if title references land/title/lease/property
- group_certificate: approve if title references group/cooperative/chama/registration
- financial_statement: approve if title references bank/mpesa/statement/account
- other: approve by default

Respond ONLY with valid JSON: {"status":"approved","reason":"brief reason"} or {"status":"rejected","reason":"brief reason"}`;

  try {
    const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 120,
      }),
    });
    const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { status: "approved" | "rejected"; reason: string };
      return parsed;
    }
    return { status: "approved", reason: "Auto-approved by AI" };
  } catch {
    return { status: "approved", reason: "Auto-approved (AI fallback)" };
  }
}

router.post("/kyc/ai-review/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const docId = parseInt(req.params.id, 10);
  const [doc] = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.id, docId));
  if (!doc || doc.userId !== user.id) { res.status(404).json({ error: "Document not found" }); return; }

  const result = await groqReview(doc.docType, doc.title, doc.notes ?? "");

  await db.update(kycDocumentsTable)
    .set({ status: result.status, reviewedAt: new Date(), notes: doc.notes ? `${doc.notes} | AI: ${result.reason}` : `AI: ${result.reason}` })
    .where(eq(kycDocumentsTable.id, docId));

  res.json({ id: docId, status: result.status, reason: result.reason });
});

router.post("/kyc/ai-review-all", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const docs = await db.select().from(kycDocumentsTable)
    .where(eq(kycDocumentsTable.userId, user.id));

  const pending = docs.filter(d => d.status === "pending");
  if (pending.length === 0) { res.json({ reviewed: 0, results: [] }); return; }

  const results = await Promise.all(pending.map(async doc => {
    const result = await groqReview(doc.docType, doc.title, doc.notes ?? "");
    await db.update(kycDocumentsTable)
      .set({ status: result.status, reviewedAt: new Date(), notes: doc.notes ? `${doc.notes} | AI: ${result.reason}` : `AI: ${result.reason}` })
      .where(eq(kycDocumentsTable.id, doc.id));
    return { id: doc.id, docType: doc.docType, status: result.status, reason: result.reason };
  }));

  res.json({ reviewed: results.length, results });
});

router.get("/kyc/status", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const docs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, user.id));
  const approved = docs.filter(d => d.status === "approved").length;
  const total = docs.length;
  const isVerified = approved >= 2;

  res.json({ total, approved, isVerified, docs: docs.map(d => ({ id: d.id, docType: d.docType, status: d.status })) });
});

export default router;
