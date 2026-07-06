import webPush from "web-push";
import { db, pushSubscriptionsTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

let _publicKey = "";
let _privateKey = "";
let _initialized = false;

const VAPID_CACHE_FILE = path.resolve(process.cwd(), ".vapid-keys.json");

function loadPersistedKeys(): { publicKey: string; privateKey: string } | null {
  try {
    if (fs.existsSync(VAPID_CACHE_FILE)) {
      const raw = fs.readFileSync(VAPID_CACHE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.publicKey && parsed.privateKey) return parsed;
    }
  } catch {}
  return null;
}

function persistKeys(publicKey: string, privateKey: string): void {
  try {
    fs.writeFileSync(VAPID_CACHE_FILE, JSON.stringify({ publicKey, privateKey }), "utf8");
  } catch (e) {
    console.warn("[web-push] Could not persist VAPID keys:", e);
  }
}

export function initVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;

  if (pub && priv) {
    _publicKey = pub;
    _privateKey = priv;
  } else if (process.env.NODE_ENV === "production") {
    // Never fall back to generating/persisting keys on disk in production -
    // that's how a private key previously ended up committed to git.
    throw new Error(
      "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in production. " +
        "Generate a pair with `web-push generate-vapid-keys` and set them as secrets."
    );
  } else {
    const cached = loadPersistedKeys();
    if (cached) {
      _publicKey = cached.publicKey;
      _privateKey = cached.privateKey;
      console.log("[web-push] VAPID keys loaded from local cache (dev only)");
    } else {
      const keys = webPush.generateVAPIDKeys();
      _publicKey = keys.publicKey;
      _privateKey = keys.privateKey;
      persistKeys(_publicKey, _privateKey);
      console.log("[web-push] VAPID keys generated and cached locally (dev only, gitignored):");
      console.log(`  VAPID_PUBLIC_KEY=${_publicKey}`);
      console.log(`  VAPID_PRIVATE_KEY=${_privateKey}`);
    }
  }

  webPush.setVapidDetails(
    `mailto:${process.env.ADMIN_EMAIL ?? "admin@investafarm.com"}`,
    _publicKey,
    _privateKey
  );
  _initialized = true;
}

export function getVapidPublicKey(): string {
  return _publicKey;
}

export type PushPayload = {
  title: string;
  body: string;
  type?: string;
  url?: string;
  tag?: string;
};

export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  if (!_initialized) return;
  const subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
  await Promise.allSettled(subs.map(sub => sendToSubscription(sub.id, sub, payload)));
}

export async function sendPushToMany(userIds: number[], payload: PushPayload): Promise<void> {
  if (!_initialized || userIds.length === 0) return;
  await Promise.allSettled(userIds.map(id => sendPushToUser(id, payload)));
}

async function sendToSubscription(subId: number, sub: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload) {
  try {
    await webPush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ icon: "/logo.png", badge: "/favicon.png", ...payload })
    );
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, subId)).catch(() => {});
    }
  }
}

export async function createInAppNotification(userId: number, type: string, title: string, body: string) {
  await db.insert(notificationsTable).values({ userId, type, title, body }).catch(() => {});
}

export async function notifyUser(
  userId: number,
  type: string,
  title: string,
  body: string,
  url = "/"
) {
  await Promise.allSettled([
    createInAppNotification(userId, type, title, body),
    sendPushToUser(userId, { title, body, type, url }),
  ]);
}

export async function notifyMany(
  userIds: number[],
  type: string,
  title: string,
  body: string,
  url = "/"
) {
  if (userIds.length === 0) return;
  await Promise.allSettled(userIds.map(id => notifyUser(id, type, title, body, url)));
}
