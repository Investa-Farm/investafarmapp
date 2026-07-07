import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

// NOTE: Safaricom has publicly stated these IPs can change without notice.
// Treat this list as a defense-in-depth layer, not the sole guarantee of
// authenticity — the MPESA_CALLBACK_SECRET check below is what actually
// proves the request knows a value only your server and Safaricom's
// registered callback config share. Re-verify this list against current
// Daraja documentation periodically.
const SAFARICOM_IPS = [
  "196.201.214.200", "196.201.214.206", "196.201.213.114", "196.201.214.207",
  "196.201.214.208", "196.201.213.44", "196.201.212.127", "196.201.212.138",
  "196.201.212.129", "196.201.212.136", "196.201.212.74", "196.201.212.69",
];

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function validateMpesaCallback(req: Request, res: Response, next: NextFunction) {
  // ---------------------------------------------------------------------
  // FIX (critical): the original code did
  //   (req.headers["x-forwarded-for"] as string)?.split(",") || req.socket.remoteAddress
  // `.split(",")` returns an ARRAY, but SAFARICOM_IPS.includes() compares
  // against strings. clientIp could never equal any entry in SAFARICOM_IPS,
  // so this check always failed in production — either silently rejecting
  // every legitimate Safaricom callback, or (if this check were ever loosened)
  // silently doing nothing. We now take the first IP in the
  // x-forwarded-for chain (the original client, assuming a trusted proxy
  // appends rather than lets the client set this header), trim it, and
  // fall back to the socket address.
  // ---------------------------------------------------------------------
  const forwardedFor = req.headers["x-forwarded-for"] as string | undefined;
  const clientIp = (forwardedFor ? forwardedFor.split(",")[0] : req.socket.remoteAddress || "").trim();

  if (process.env.MPESA_ENVIRONMENT === "production" && !SAFARICOM_IPS.includes(clientIp)) {
    return res.status(403).json({ error: "Forbidden: Unauthorized IP source" });
  }

  const secretKey = req.query.key;
  const expectedSecret = process.env.MPESA_CALLBACK_SECRET || "";

  if (typeof secretKey !== "string" || !expectedSecret || !safeCompare(secretKey, expectedSecret)) {
    return res.status(401).json({ error: "Unauthorized: Invalid secret key" });
  }

  next();
}
