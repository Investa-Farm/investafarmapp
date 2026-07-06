import { Router, type IRouter } from "express";
import { db, farmerGroupsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { z } from "zod";

const router: IRouter = Router();

const RegisterGroupBody = z.object({
  name: z.string().min(2),
  registrationNumber: z.string().min(3),
  location: z.string().min(2),
  county: z.string().min(2),
  memberCount: z.number().int().min(1),
  description: z.string().optional(),
});

router.get("/groups/my", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [group] = await db.select().from(farmerGroupsTable)
    .where(eq(farmerGroupsTable.leaderId, user.id));
  if (!group) { res.json(null); return; }
  res.json({
    id: group.id,
    name: group.name,
    registrationNumber: group.registrationNumber,
    location: group.location,
    county: group.county,
    memberCount: group.memberCount,
    status: group.status,
    description: group.description ?? undefined,
    createdAt: group.createdAt.toISOString(),
  });
});

router.post("/groups/register", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = RegisterGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const existing = await db.select().from(farmerGroupsTable)
    .where(eq(farmerGroupsTable.leaderId, user.id));
  if (existing.length > 0) {
    res.status(400).json({ error: "You already have a registered group" }); return;
  }
  const [group] = await db.insert(farmerGroupsTable).values({
    name: parsed.data.name,
    registrationNumber: parsed.data.registrationNumber,
    location: parsed.data.location,
    county: parsed.data.county,
    memberCount: parsed.data.memberCount,
    leaderId: user.id,
    description: parsed.data.description ?? null,
    status: "pending",
  }).returning();
  res.status(201).json({
    id: group.id,
    name: group.name,
    registrationNumber: group.registrationNumber,
    location: group.location,
    county: group.county,
    memberCount: group.memberCount,
    status: group.status,
    description: group.description ?? undefined,
    createdAt: group.createdAt.toISOString(),
  });
});

export default router;
