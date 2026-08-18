/**
 * HMAC admin session tokens. Shared so support/reviews cannot invent a weaker check.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { ADMIN_TTL_MS, getTokenSecret } from "./authTokens";

export type AdminRole = "master" | "sub" | "kyc" | "viewer";

export function signAdminToken(role: AdminRole, ttlMs = ADMIN_TTL_MS): string {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ role, iat: now, exp: now + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", getTokenSecret()).update(`admin:${payload}`).digest("base64url");
  return `${payload}.${sig}`;
}

export function adminRoleFromRequest(req: { headers: { authorization?: string } }): AdminRole | null {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return verifyAdminToken(auth.slice(7));
}

export function verifyAdminToken(token: string): AdminRole | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", getTokenSecret()).update(`admin:${payload}`).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      role?: AdminRole;
      exp?: number;
    };
    if (typeof decoded.exp !== "number" || Date.now() > decoded.exp) return null;
    if (decoded.role !== "master" && decoded.role !== "sub" && decoded.role !== "kyc" && decoded.role !== "viewer") {
      return null;
    }
    return decoded.role;
  } catch {
    return null;
  }
}
