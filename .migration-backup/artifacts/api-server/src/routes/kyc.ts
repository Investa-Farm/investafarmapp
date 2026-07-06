import { Router, type IRouter } from "express";
import { db, kycDocumentsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { sendKycSubmittedNotification, sendKycUnderReviewEmail } from "../lib/email";
import { z } from "zod";

const router: IRouter = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.GOOGLE_SMTP_USER ?? "";

const FARMER_REQUIRED_DOCS = ["national_id", "national_id_back", "selfie", "farm_report", "land_title", "group_certificate"];
const INVESTOR_REQUIRED_DOCS = ["national_id", "national_id_back", "selfie", "financial_statement"];

const UploadDocBody = z.object({
  docType: z.enum([
    "farm_report",
    "national_id",
    "national_id_back",
    "selfie",
    "land_title",
    "group_certificate",
    "financial_statement",
    "business_registration",
    "other",
  ]),
  title: z.string().min(1),
  fileUrl: z.string().url().or(z.string().min(1)),
  notes: z.string().optional(),
  groupId: z.number().optional(),
});

router.get("/kyc/documents", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const docs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, user.id));
  res.json(docs.map(d => ({
    id: d.id,
    docType: d.docType,
    title: d.title,
    fileUrl: d.fileUrl,
    notes: d.notes ?? undefined,
    status: d.status,
    groupId: d.groupId ?? undefined,
    createdAt: d.createdAt.toISOString(),
  })));
});

router.get("/kyc/status", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const docs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, user.id));
  const approved = docs.filter(d => d.status === "approved").length;
  const pending = docs.filter(d => d.status === "pending").length;
  const total = docs.length;
  const isVerified = approved >= 2;
  const requiredDocs = user.role === "farmer" ? FARMER_REQUIRED_DOCS : INVESTOR_REQUIRED_DOCS;
  const uploadedTypes = new Set(docs.map(d => d.docType));
  const allUploaded = requiredDocs.every(t => uploadedTypes.has(t as any));
  res.json({ isVerified, approved, pending, total, allUploaded, requiredDocs });
});

router.post("/kyc/upload", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = UploadDocBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { docType, title, fileUrl, notes, groupId } = parsed.data;

  const [doc] = await db.insert(kycDocumentsTable).values({
    userId: user.id,
    groupId: groupId ?? null,
    docType,
    title,
    fileUrl,
    notes: notes ?? null,
    status: "pending",
  }).returning();

  if (ADMIN_EMAIL) {
    sendKycSubmittedNotification(ADMIN_EMAIL, user.name, user.email, docType).catch(() => {});
  }

  const allDocs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, user.id));
  const requiredDocs = user.role === "farmer" ? FARMER_REQUIRED_DOCS : INVESTOR_REQUIRED_DOCS;
  const uploadedTypes = new Set(allDocs.map(d => d.docType));
  const allUploaded = requiredDocs.every(t => uploadedTypes.has(t as any));

  if (allUploaded) {
    await db.insert(notificationsTable).values({
      userId: user.id,
      type: "kyc_under_review",
      title: "KYC Under Review",
      body: "All your documents have been submitted and are now under review. Our team will notify you within 24–48 hours.",
    });
    sendKycUnderReviewEmail(user.email, user.name).catch(() => {});
  }

  res.status(201).json({
    id: doc.id,
    docType: doc.docType,
    title: doc.title,
    fileUrl: doc.fileUrl,
    notes: doc.notes ?? undefined,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  });
});

router.delete("/kyc/documents/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id, 10);
  await db.delete(kycDocumentsTable).where(eq(kycDocumentsTable.id, id));
  res.json({ success: true });
});

router.post("/kyc/admin/approve/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const id = parseInt(req.params.id, 10);
  const [doc] = await db
    .update(kycDocumentsTable)
    .set({ status: "approved", reviewedAt: new Date() })
    .where(eq(kycDocumentsTable.id, id))
    .returning();
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }

  await db.insert(notificationsTable).values({
    userId: doc.userId,
    type: "kyc_approved",
    title: "KYC Document Approved",
    body: "One of your KYC documents has been approved by our team. Keep an eye on your verification progress.",
  });

  res.json({ success: true, doc });
});

router.post("/kyc/admin/reject/:id", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const id = parseInt(req.params.id, 10);
  const [doc] = await db
    .update(kycDocumentsTable)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(eq(kycDocumentsTable.id, id))
    .returning();
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }

  await db.insert(notificationsTable).values({
    userId: doc.userId,
    type: "kyc_rejected",
    title: "KYC Document Needs Attention",
    body: "One of your submitted documents was not accepted. Please re-upload a clearer version.",
  });

  res.json({ success: true, doc });
});

router.post("/kyc/location", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { county, subCounty, ward, landmark, physicalAddress, gpsLat, gpsLng, gpsAccuracy } = req.body as Record<string, unknown>;
  if (!county) { res.status(400).json({ error: "County is required" }); return; }
  await db.update(usersTable)
    .set({
      metadata: JSON.stringify({
        farmLocation: { county, subCounty, ward, landmark, physicalAddress, gpsLat, gpsLng, gpsAccuracy, savedAt: new Date().toISOString() },
      }),
    })
    .where(eq(usersTable.id, user.id));
  res.json({ success: true });
});

router.get("/kyc/admin/pending", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const docs = await db
    .select({
      id: kycDocumentsTable.id,
      userId: kycDocumentsTable.userId,
      docType: kycDocumentsTable.docType,
      title: kycDocumentsTable.title,
      fileUrl: kycDocumentsTable.fileUrl,
      status: kycDocumentsTable.status,
      createdAt: kycDocumentsTable.createdAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(kycDocumentsTable)
    .innerJoin(usersTable, eq(kycDocumentsTable.userId, usersTable.id))
    .orderBy(kycDocumentsTable.createdAt);
  res.json(docs);
});

export default router;
