/**
 * Auth token, OTP, OAuth-state, and password-policy helpers.
 * Kept free of Express/DB so it can be unit-tested in isolation.
 */
import {
  createHmac,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from "crypto";

export type TokenPurpose = "full" | "verify" | "totp";

export interface AuthPayload {
  userId: number;
  iat: number;
  exp: number;
  ver: number;
  purpose: TokenPurpose;
}

export const PUBLIC_ROLES = ["farmer", "investor", "cooperative", "agribusiness"] as const;
export type PublicRole = (typeof PUBLIC_ROLES)[number];

export const MIN_PASSWORD_LENGTH = 8;
export const BCRYPT_ROUNDS = 12;
export const ACCESS_TTL_MS = 12 * 60 * 60 * 1000;
export const VERIFY_TTL_MS = 60 * 60 * 1000;
export const TOTP_TTL_MS = 10 * 60 * 1000;
export const ADMIN_TTL_MS = 8 * 60 * 60 * 1000;
export const OAUTH_TICKET_TTL_MS = 5 * 60 * 1000;
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-do-not-use-in-prod!!";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function assertProductionSecrets(): void {
  if (!isProduction()) return;
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
  }
  if (!process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD must be set in production (no default)");
  }
}

export function getTokenSecret(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (isProduction()) {
    if (secret.length < 32) {
      throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
    }
    return secret;
  }
  return secret || DEV_FALLBACK_SECRET;
}

export function allowlistPublicRole(raw: unknown): PublicRole {
  const role = String(raw ?? "investor").toLowerCase();
  if ((PUBLIC_ROLES as readonly string[]).includes(role)) return role as PublicRole;
  return "investor";
}

/** Existing account role if it does not match the OAuth portal being used; otherwise null. */
export function oauthPortalMismatch(requestedRole: unknown, existingRole: string): string | null {
  if (!existingRole || existingRole === allowlistPublicRole(requestedRole)) return null;
  return existingRole;
}

export function oauthLoginPath(role: string): string {
  if (role === "farmer" || role === "cooperative") return "/farmer-auth";
  return "/investor-auth";
}

export function signAuthToken(
  userId: number,
  opts: { purpose?: TokenPurpose; ttlMs?: number; tokenVersion?: number } = {},
): string {
  const purpose = opts.purpose ?? "full";
  const ttl =
    opts.ttlMs ??
    (purpose === "verify" ? VERIFY_TTL_MS : purpose === "totp" ? TOTP_TTL_MS : ACCESS_TTL_MS);
  const now = Date.now();
  const payloadObj: AuthPayload = {
    userId,
    iat: now,
    exp: now + ttl,
    ver: opts.tokenVersion ?? 0,
    purpose,
  };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const sig = createHmac("sha256", getTokenSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAuthToken(token: string): AuthPayload | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", getTokenSecret()).update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AuthPayload>;
    if (typeof decoded.userId !== "number") return null;
    if (typeof decoded.exp !== "number" || Date.now() > decoded.exp) return null;
    const purpose = decoded.purpose;
    if (purpose !== "full" && purpose !== "verify" && purpose !== "totp") return null;
    return {
      userId: decoded.userId,
      iat: typeof decoded.iat === "number" ? decoded.iat : 0,
      exp: decoded.exp,
      ver: typeof decoded.ver === "number" ? decoded.ver : 0,
      purpose,
    };
  } catch {
    return null;
  }
}

/** Compatibility wrapper — returns userId only if the token is a valid full-or-any purpose token. */
export function verifyToken(token: string, purposes: TokenPurpose[] = ["full", "verify", "totp"]): number | null {
  const payload = verifyAuthToken(token);
  if (!payload) return null;
  if (!purposes.includes(payload.purpose)) return null;
  return payload.userId;
}

export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export function hashOpaqueToken(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function newResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashOpaqueToken(raw) };
}

export function appPublicUrl(): string {
  const raw =
    process.env.APP_URL ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:8080");
  return raw.replace(/\/+$/, "");
}

export function passwordResetUrl(rawToken: string): string {
  return `${appPublicUrl()}/reset-password?token=${rawToken}`;
}

export function isPasswordStrongEnough(password: string): boolean {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

export function createOauthState(role: unknown): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: allowlistPublicRole(role),
      n: randomBytes(16).toString("hex"),
      iat: Date.now(),
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", getTokenSecret()).update(`oauth-state:${payload}`).digest("base64url");
  return `${payload}.${sig}`;
}

export function parseOauthState(state: string | undefined): { role: PublicRole } | null {
  if (!state) return null;
  try {
    const dot = state.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    const expected = createHmac("sha256", getTokenSecret()).update(`oauth-state:${payload}`).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string; iat?: number };
    if (typeof decoded.iat !== "number" || Date.now() - decoded.iat > OAUTH_STATE_TTL_MS) return null;
    return { role: allowlistPublicRole(decoded.role) };
  } catch {
    return null;
  }
}

export function signOauthTicket(userId: number, isNew: boolean): string {
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({ userId, isNew, iat: now, exp: now + OAUTH_TICKET_TTL_MS, jti: randomBytes(12).toString("hex") }),
  ).toString("base64url");
  const sig = createHmac("sha256", getTokenSecret()).update(`oauth-ticket:${payload}`).digest("base64url");
  return `${payload}.${sig}`;
}

const usedOauthTickets = new Map<string, number>();

export function consumeOauthTicket(ticket: string): { userId: number; isNew: boolean } | null {
  try {
    const dot = ticket.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = ticket.slice(0, dot);
    const sig = ticket.slice(dot + 1);
    const expected = createHmac("sha256", getTokenSecret()).update(`oauth-ticket:${payload}`).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    if (usedOauthTickets.has(payload)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: number;
      isNew?: boolean;
      exp?: number;
    };
    if (typeof decoded.userId !== "number" || typeof decoded.exp !== "number") return null;
    if (Date.now() > decoded.exp) return null;
    usedOauthTickets.set(payload, Date.now());
    if (usedOauthTickets.size > 5000) {
      const cutoff = Date.now() - OAUTH_TICKET_TTL_MS * 2;
      for (const [k, ts] of usedOauthTickets) {
        if (ts < cutoff) usedOauthTickets.delete(k);
      }
    }
    return { userId: decoded.userId, isNew: Boolean(decoded.isNew) };
  } catch {
    return null;
  }
}

export function encryptAtRest(plain: string): string {
  const key = createHash("sha256").update(getTokenSecret()).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptAtRest(stored: string): string {
  if (!stored.startsWith("enc:")) return stored;
  const parts = stored.slice(4).split(":");
  if (parts.length !== 3) return stored;
  const [ivHex, tagHex, dataHex] = parts;
  const key = createHash("sha256").update(getTokenSecret()).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex!, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex!, "hex"));
  return decipher.update(Buffer.from(dataHex!, "hex")) + decipher.final("utf8");
}

export function corsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const extra = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  const app = appPublicUrl();
  const allowed = new Set([
    app,
    "https://investafarm.com",
    "https://www.investafarm.com",
    "https://app.investafarm.com",
    "http://localhost:5000",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://localhost:19899",
    "http://localhost:4173",
    ...extra,
  ]);
  if (allowed.has(origin)) return true;
  if (!isProduction() && origin.endsWith(".replit.dev")) return true;
  return false;
}

/** Test-only: reset in-memory ticket denylist. */
export function _resetOauthTicketStoreForTests(): void {
  usedOauthTickets.clear();
}
