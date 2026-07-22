/**
 * Investa Farm — Central Security Layer
 *
 * Covers:
 *  1. Security headers (CSP, X-Frame-Options, HSTS, etc.)
 *  2. Global tiered rate limiting (per-IP and per-user)
 *  3. Account lockout with progressive back-off
 *  4. Input sanitization (XSS / null-byte stripping)
 *  5. Transaction velocity limits (daily caps, hourly caps)
 *  6. Clone / bot / scraper detection
 *  7. Suspicious activity logging
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

// ─────────────────────────────────────────────────────────────────────────────
// 1. SECURITY HEADERS
// ─────────────────────────────────────────────────────────────────────────────

/** Common hardening headers applied to every response. */
function baseSecurityHeaders(res: Response): void {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=*, microphone=*, geolocation=*, payment=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
}

/**
 * Tight CSP for /api routes — they only return JSON, so nothing external is
 * needed and `default-src 'none'` is correct.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  baseSecurityHeaders(res);
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none';",
  );
  next();
}

/**
 * Permissive CSP for the React SPA HTML page and its static assets.
 * Allows self-hosted scripts/styles, Google Fonts, and data/blob URLs for images.
 */
export function frontendSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  baseSecurityHeaders(res);
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https: wss:",
      "frame-src https://pay.pesapal.com https://cybqa.pesapal.com https://*.openstreetmap.org",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]!.trim();
  return req.socket?.remoteAddress ?? "unknown";
}

interface Window { count: number; windowStart: number }

function checkWindow(
  map: Map<string, Window>,
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    entry = { count: 1, windowStart: now };
    map.set(key, entry);
    return { allowed: true, remaining: max - 1, resetMs: windowMs };
  }
  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetMs: windowMs - (now - entry.windowStart) };
  }
  entry.count++;
  return { allowed: true, remaining: max - entry.count, resetMs: windowMs - (now - entry.windowStart) };
}

function pruneMap(map: Map<string, Window>, olderThanMs: number): void {
  const cutoff = Date.now() - olderThanMs;
  for (const [k, v] of map) { if (v.windowStart < cutoff) map.delete(k); }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TIERED RATE LIMITERS
// ─────────────────────────────────────────────────────────────────────────────

// Stores — keyed by "ip" or "user:<id>"
const globalIpWindows   = new Map<string, Window>();   // 200 req / 1 min  per IP
const authIpWindows     = new Map<string, Window>();   // 10  req / 15 min per IP  (login/register/otp)
const financialWindows  = new Map<string, Window>();   // 20  req / 1 min  per user
const aiWindows         = new Map<string, Window>();   // 15  req / 1 min  per user

setInterval(() => {
  pruneMap(globalIpWindows,  2 * 60 * 1000);
  pruneMap(authIpWindows,   30 * 60 * 1000);
  pruneMap(financialWindows,  5 * 60 * 1000);
  pruneMap(aiWindows,         5 * 60 * 1000);
}, 5 * 60 * 1000);

/** Global IP rate limit — applied to every /api request */
export function globalRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const { allowed, remaining, resetMs } = checkWindow(globalIpWindows, ip, 200, 60_000);
  res.setHeader("X-RateLimit-Limit", "200");
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  if (!allowed) {
    logger.warn({ ip, url: req.url }, "[security] Global rate limit hit");
    res.status(429).json({
      error: "Too many requests. Please slow down.",
      retryAfterMs: resetMs,
    });
    return;
  }
  next();
}

/** Strict limit for authentication endpoints */
export function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const { allowed, resetMs } = checkWindow(authIpWindows, ip, 10, 15 * 60_000);
  if (!allowed) {
    logger.warn({ ip, url: req.url }, "[security] Auth rate limit hit");
    res.status(429).json({
      error: "Too many authentication attempts. Please wait 15 minutes before trying again.",
      retryAfterMs: resetMs,
    });
    return;
  }
  next();
}

/** Strict limit for financial endpoints — keyed by user id extracted from auth header */
export function financialRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const authHeader = req.headers.authorization ?? "";
  const key = authHeader ? `auth:${authHeader.slice(-16)}` : `ip:${ip}`;
  const { allowed, resetMs } = checkWindow(financialWindows, key, 20, 60_000);
  if (!allowed) {
    logger.warn({ key, url: req.url }, "[security] Financial rate limit hit");
    res.status(429).json({
      error: "Too many financial requests. Please wait a moment before retrying.",
      retryAfterMs: resetMs,
    });
    return;
  }
  next();
}

/** Limit for AI/chat endpoints */
export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const authHeader = req.headers.authorization ?? "";
  const key = authHeader ? `auth:${authHeader.slice(-16)}` : `ip:${ip}`;
  const { allowed, resetMs } = checkWindow(aiWindows, key, 15, 60_000);
  if (!allowed) {
    res.status(429).json({
      error: "AI request limit reached. Please wait a moment.",
      retryAfterMs: resetMs,
    });
    return;
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ACCOUNT LOCKOUT (progressive back-off on failed auth)
// ─────────────────────────────────────────────────────────────────────────────

interface LockoutEntry {
  failures: number;
  lockedUntil: number | null;
  lastFailure: number;
}

const lockoutStore = new Map<string, LockoutEntry>();

setInterval(() => {
  const cutoff = Date.now() - 25 * 60 * 60 * 1000;
  for (const [k, v] of lockoutStore) {
    if (v.lastFailure < cutoff) lockoutStore.delete(k);
  }
}, 30 * 60 * 1000);

/**
 * Call BEFORE attempting auth. Returns error string if locked, null if allowed.
 * Key should be email (canonical) or IP.
 */
export function checkLockout(key: string): { locked: boolean; message: string; remainingMs: number } {
  const entry = lockoutStore.get(key);
  if (!entry) return { locked: false, message: "", remainingMs: 0 };
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    const remainingMs = entry.lockedUntil - Date.now();
    const mins = Math.ceil(remainingMs / 60_000);
    return {
      locked: true,
      message: `Account temporarily locked due to too many failed attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
      remainingMs,
    };
  }
  return { locked: false, message: "", remainingMs: 0 };
}

/** Call after a FAILED auth attempt. Applies progressive lockout. */
export function recordFailedAuth(key: string): void {
  const now = Date.now();
  const entry = lockoutStore.get(key) ?? { failures: 0, lockedUntil: null, lastFailure: now };

  // Reset failure count if last failure was > 1 hour ago (user probably just forgot password)
  if (now - entry.lastFailure > 60 * 60 * 1000) {
    entry.failures = 0;
    entry.lockedUntil = null;
  }

  entry.failures++;
  entry.lastFailure = now;

  // Progressive lockout thresholds
  if (entry.failures >= 10) {
    entry.lockedUntil = now + 24 * 60 * 60 * 1000; // 24 hours
  } else if (entry.failures >= 6) {
    entry.lockedUntil = now + 60 * 60 * 1000;       // 1 hour
  } else if (entry.failures >= 4) {
    entry.lockedUntil = now + 15 * 60 * 1000;       // 15 minutes
  } else if (entry.failures >= 3) {
    entry.lockedUntil = now + 5 * 60 * 1000;        // 5 minutes
  }

  lockoutStore.set(key, entry);
  logger.warn({ key, failures: entry.failures, lockedUntil: entry.lockedUntil }, "[security] Failed auth recorded");
}

/** Call after a SUCCESSFUL auth attempt. Clears lockout. */
export function recordSuccessfulAuth(key: string): void {
  lockoutStore.delete(key);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INPUT SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────

const HTML_TAG_RE = /<[^>]*>/g;
const NULL_BYTE_RE = /\0/g;
const SCRIPT_PROTO_RE = /javascript\s*:/gi;
const DANGEROUS_ATTRS_RE = /on\w+\s*=/gi;

function sanitizeString(val: string): string {
  return val
    .replace(NULL_BYTE_RE, "")
    .replace(HTML_TAG_RE, "")
    .replace(SCRIPT_PROTO_RE, "")
    .replace(DANGEROUS_ATTRS_RE, "")
    .trim();
}

function sanitizeValue(val: unknown): unknown {
  if (typeof val === "string") return sanitizeString(val);
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val !== null && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[sanitizeString(k)] = sanitizeValue(v);
    }
    return out;
  }
  return val;
}

/**
 * Middleware that sanitizes req.body, req.query, and req.params in-place.
 * Numbers, booleans, and null are untouched — only strings are cleaned.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === "object") {
    const cleaned = sanitizeValue(req.query) as Record<string, unknown>;
    for (const key of Object.keys(cleaned)) {
      (req.query as Record<string, unknown>)[key] = cleaned[key];
    }
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. TRANSACTION VELOCITY LIMITS
// ─────────────────────────────────────────────────────────────────────────────

// Per-user daily accumulators — reset at midnight UTC
interface VelocityEntry {
  investedToday: number;
  investCountToday: number;
  depositedToday: number;
  depositCountToday: number;
  withdrawnToday: number;
  withdrawCountToday: number;
  withdrawnThisHour: number;
  dayKey: string;
  hourKey: string;
}

const velocityStore = new Map<number, VelocityEntry>();

function getDayKey(): string { return new Date().toISOString().slice(0, 10); }
function getHourKey(): string { return new Date().toISOString().slice(0, 13); }

function getVelocity(userId: number): VelocityEntry {
  const dayKey = getDayKey();
  const hourKey = getHourKey();
  let entry = velocityStore.get(userId);
  if (!entry || entry.dayKey !== dayKey) {
    entry = {
      investedToday: 0, investCountToday: 0,
      depositedToday: 0, depositCountToday: 0,
      withdrawnToday: 0, withdrawCountToday: 0,
      withdrawnThisHour: 0,
      dayKey, hourKey,
    };
    velocityStore.set(userId, entry);
  }
  if (entry.hourKey !== hourKey) {
    entry.withdrawnThisHour = 0;
    entry.hourKey = hourKey;
  }
  return entry;
}

// Limits
export const LIMITS = {
  // Single-transaction maximums
  MAX_SINGLE_INVESTMENT_KES:   500_000,
  MAX_SINGLE_DEPOSIT_KES:      200_000,
  MAX_SINGLE_WITHDRAWAL_KES:   100_000,
  MIN_SINGLE_INVESTMENT_KES:   100,
  MIN_SINGLE_DEPOSIT_KES:      10,
  MIN_SINGLE_WITHDRAWAL_KES:   50,

  // Daily ceilings
  MAX_DAILY_INVESTED_KES:    1_000_000,
  MAX_DAILY_INVEST_COUNT:       20,
  MAX_DAILY_DEPOSITED_KES:     500_000,
  MAX_DAILY_DEPOSIT_COUNT:      10,
  MAX_DAILY_WITHDRAWN_KES:     300_000,
  MAX_DAILY_WITHDRAW_COUNT:      5,

  // Hourly sub-cap on withdrawals
  MAX_HOURLY_WITHDRAWN_KES:     50_000,
} as const;

export type VelocityCheckResult = { ok: true } | { ok: false; error: string };

export function checkInvestmentVelocity(userId: number, amountKes: number): VelocityCheckResult {
  if (amountKes < LIMITS.MIN_SINGLE_INVESTMENT_KES) {
    return { ok: false, error: `Minimum investment is KES ${LIMITS.MIN_SINGLE_INVESTMENT_KES.toLocaleString("en-KE")}.` };
  }
  if (amountKes > LIMITS.MAX_SINGLE_INVESTMENT_KES) {
    return { ok: false, error: `Single investment cannot exceed KES ${LIMITS.MAX_SINGLE_INVESTMENT_KES.toLocaleString("en-KE")}.` };
  }
  const v = getVelocity(userId);
  if (v.investCountToday >= LIMITS.MAX_DAILY_INVEST_COUNT) {
    return { ok: false, error: `Daily investment limit reached (${LIMITS.MAX_DAILY_INVEST_COUNT} transactions per day). Try again tomorrow.` };
  }
  if (v.investedToday + amountKes > LIMITS.MAX_DAILY_INVESTED_KES) {
    const remaining = LIMITS.MAX_DAILY_INVESTED_KES - v.investedToday;
    return { ok: false, error: `Daily investment ceiling reached. You can invest up to KES ${remaining.toLocaleString("en-KE")} more today.` };
  }
  return { ok: true };
}

export function recordInvestment(userId: number, amountKes: number): void {
  const v = getVelocity(userId);
  v.investedToday += amountKes;
  v.investCountToday++;
}

export function checkDepositVelocity(userId: number, amountKes: number): VelocityCheckResult {
  if (amountKes < LIMITS.MIN_SINGLE_DEPOSIT_KES) {
    return { ok: false, error: `Minimum deposit is KES ${LIMITS.MIN_SINGLE_DEPOSIT_KES}.` };
  }
  if (amountKes > LIMITS.MAX_SINGLE_DEPOSIT_KES) {
    return { ok: false, error: `Single deposit cannot exceed KES ${LIMITS.MAX_SINGLE_DEPOSIT_KES.toLocaleString("en-KE")}.` };
  }
  const v = getVelocity(userId);
  if (v.depositCountToday >= LIMITS.MAX_DAILY_DEPOSIT_COUNT) {
    return { ok: false, error: `Daily deposit limit reached (${LIMITS.MAX_DAILY_DEPOSIT_COUNT} deposits per day). Try again tomorrow.` };
  }
  if (v.depositedToday + amountKes > LIMITS.MAX_DAILY_DEPOSITED_KES) {
    const remaining = LIMITS.MAX_DAILY_DEPOSITED_KES - v.depositedToday;
    return { ok: false, error: `Daily deposit ceiling reached. You can deposit up to KES ${remaining.toLocaleString("en-KE")} more today.` };
  }
  return { ok: true };
}

export function recordDeposit(userId: number, amountKes: number): void {
  const v = getVelocity(userId);
  v.depositedToday += amountKes;
  v.depositCountToday++;
}

export function checkWithdrawalVelocity(userId: number, amountKes: number): VelocityCheckResult {
  if (amountKes < LIMITS.MIN_SINGLE_WITHDRAWAL_KES) {
    return { ok: false, error: `Minimum withdrawal is KES ${LIMITS.MIN_SINGLE_WITHDRAWAL_KES}.` };
  }
  if (amountKes > LIMITS.MAX_SINGLE_WITHDRAWAL_KES) {
    return { ok: false, error: `Single withdrawal cannot exceed KES ${LIMITS.MAX_SINGLE_WITHDRAWAL_KES.toLocaleString("en-KE")}.` };
  }
  const v = getVelocity(userId);
  if (v.withdrawCountToday >= LIMITS.MAX_DAILY_WITHDRAW_COUNT) {
    return { ok: false, error: `Daily withdrawal limit reached (${LIMITS.MAX_DAILY_WITHDRAW_COUNT} withdrawals per day). Try again tomorrow.` };
  }
  if (v.withdrawnToday + amountKes > LIMITS.MAX_DAILY_WITHDRAWN_KES) {
    const remaining = LIMITS.MAX_DAILY_WITHDRAWN_KES - v.withdrawnToday;
    return { ok: false, error: `Daily withdrawal ceiling reached. You can withdraw up to KES ${remaining.toLocaleString("en-KE")} more today.` };
  }
  if (v.withdrawnThisHour + amountKes > LIMITS.MAX_HOURLY_WITHDRAWN_KES) {
    const remaining = LIMITS.MAX_HOURLY_WITHDRAWN_KES - v.withdrawnThisHour;
    return { ok: false, error: `Hourly withdrawal limit reached. You can withdraw up to KES ${remaining.toLocaleString("en-KE")} more this hour.` };
  }
  return { ok: true };
}

export function recordWithdrawal(userId: number, amountKes: number): void {
  const v = getVelocity(userId);
  v.withdrawnToday += amountKes;
  v.withdrawCountToday++;
  v.withdrawnThisHour += amountKes;
}

// Expose current limits for the /api/security/limits endpoint
export function getUserVelocitySummary(userId: number) {
  const v = getVelocity(userId);
  return {
    investments: {
      countToday: v.investCountToday,
      amountToday: v.investedToday,
      countLimit: LIMITS.MAX_DAILY_INVEST_COUNT,
      amountLimit: LIMITS.MAX_DAILY_INVESTED_KES,
    },
    deposits: {
      countToday: v.depositCountToday,
      amountToday: v.depositedToday,
      countLimit: LIMITS.MAX_DAILY_DEPOSIT_COUNT,
      amountLimit: LIMITS.MAX_DAILY_DEPOSITED_KES,
    },
    withdrawals: {
      countToday: v.withdrawCountToday,
      amountToday: v.withdrawnToday,
      countLimit: LIMITS.MAX_DAILY_WITHDRAW_COUNT,
      amountLimit: LIMITS.MAX_DAILY_WITHDRAWN_KES,
      amountThisHour: v.withdrawnThisHour,
      hourlyLimit: LIMITS.MAX_HOURLY_WITHDRAWN_KES,
    },
    transactionLimits: {
      maxSingleInvestment: LIMITS.MAX_SINGLE_INVESTMENT_KES,
      maxSingleDeposit: LIMITS.MAX_SINGLE_DEPOSIT_KES,
      maxSingleWithdrawal: LIMITS.MAX_SINGLE_WITHDRAWAL_KES,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. CLONE / BOT / SCRAPER DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_BOT_AGENTS = [
  "curl/", "wget/", "python-requests/", "python-httpx", "libwww-perl",
  "scrapy", "zgrab", "masscan", "nmap", "nikto", "sqlmap",
  "httpclient", "go-http-client", "java/", "okhttp", "axios",
  "got/", "node-fetch", "undici",
];

const KNOWN_HEADLESS_SIGNALS = [
  "headlesschrome", "phantomjs", "selenium", "webdriver",
  "puppeteer", "playwright",
];

// Track requests per IP in a 10-second sliding window — detects burst scrapers
const burstStore = new Map<string, { count: number; since: number }>();
setInterval(() => {
  const cutoff = Date.now() - 30_000;
  for (const [k, v] of burstStore) { if (v.since < cutoff) burstStore.delete(k); }
}, 30_000);

/**
 * Detects cloning bots, headless browsers, and aggressive scrapers.
 * Applied only to non-authenticated routes that might be scraped.
 */
export function botDetection(req: Request, res: Response, next: NextFunction): void {
  const ua = (req.headers["user-agent"] ?? "").toLowerCase();
  const ip = getClientIp(req);

  // Block known bad bots on mutation routes
  if (req.method !== "GET") {
    for (const sig of KNOWN_BOT_AGENTS) {
      if (ua.includes(sig)) {
        logger.warn({ ip, ua, url: req.url }, "[security] Bot user-agent blocked on mutation");
        res.status(403).json({ error: "Automated requests are not permitted." });
        return;
      }
    }
  }

  // Block headless browser signals on auth / financial routes
  for (const sig of KNOWN_HEADLESS_SIGNALS) {
    if (ua.includes(sig)) {
      logger.warn({ ip, ua, url: req.url }, "[security] Headless browser blocked");
      res.status(403).json({ error: "Automated requests are not permitted." });
      return;
    }
  }

  // Burst detection: > 60 requests from same IP in 10 seconds → likely scraper
  const now = Date.now();
  let burst = burstStore.get(ip);
  if (!burst || now - burst.since > 10_000) {
    burst = { count: 1, since: now };
  } else {
    burst.count++;
    if (burst.count > 60) {
      logger.warn({ ip, count: burst.count }, "[security] Burst scraper detected");
      res.status(429).json({ error: "Request burst detected. Please slow down." });
      return;
    }
  }
  burstStore.set(ip, burst);

  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. PAYLOAD SIZE GUARD (supplement to express.json limit)
// ─────────────────────────────────────────────────────────────────────────────

export function payloadSizeGuard(req: Request, res: Response, next: NextFunction): void {
  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  const MAX_BYTES = 512 * 1024; // 512 KB
  if (contentLength > MAX_BYTES) {
    res.status(413).json({ error: "Request payload too large. Maximum size is 512 KB." });
    return;
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. NONCE / REPLAY ATTACK PREVENTION
// ─────────────────────────────────────────────────────────────────────────────

const NONCE_TTL_MS = 5 * 60 * 1000; // 5-minute window
const usedNonces = new Map<string, number>(); // nonce → first-seen timestamp

setInterval(() => {
  const cutoff = Date.now() - NONCE_TTL_MS;
  for (const [n, ts] of usedNonces) {
    if (ts < cutoff) usedNonces.delete(n);
  }
}, NONCE_TTL_MS);

/**
 * Middleware that enforces a one-time-use nonce on financial mutation endpoints.
 * Clients must send a unique UUIDv4 with each request:
 *   X-Request-Nonce: <uuid>
 *   X-Request-Timestamp: <unix-ms>   (optional — checked if present)
 *
 * Blocks replay attacks where an intercepted request is re-submitted.
 */
export function requireNonce(req: Request, res: Response, next: NextFunction): void {
  const nonce = req.headers["x-request-nonce"] as string | undefined;
  const tsHeader = req.headers["x-request-timestamp"] as string | undefined;

  if (!nonce || nonce.length < 16) {
    res.status(400).json({ error: "Missing or invalid request nonce (X-Request-Nonce header required)." });
    return;
  }

  if (tsHeader) {
    const ts = parseInt(tsHeader, 10);
    if (!Number.isNaN(ts) && Math.abs(Date.now() - ts) > NONCE_TTL_MS) {
      res.status(400).json({ error: "Request timestamp is outside the acceptable 5-minute window." });
      return;
    }
  }

  if (usedNonces.has(nonce)) {
    logger.warn({ nonce, ip: getClientIp(req), url: req.url }, "[security] Replay attack blocked — duplicate nonce");
    res.status(409).json({ error: "Duplicate request detected. This transaction has already been processed." });
    return;
  }

  usedNonces.set(nonce, Date.now());
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. SUSPICIOUS AUTH ACTIVITY TRACKER
// ─────────────────────────────────────────────────────────────────────────────

const suspiciousIps = new Map<string, { count401: number; firstSeen: number }>();

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [ip, v] of suspiciousIps) {
    if (v.firstSeen < cutoff) suspiciousIps.delete(ip);
  }
}, 10 * 60 * 1000);

/**
 * Track 401 responses for IP-level credential stuffing detection.
 * Call this after any auth failure (401) in route handlers.
 */
export function trackUnauthorized(ip: string, url: string): void {
  const now = Date.now();
  let entry = suspiciousIps.get(ip);
  if (!entry || now - entry.firstSeen > 30 * 60 * 1000) {
    entry = { count401: 1, firstSeen: now };
  } else {
    entry.count401++;
  }
  suspiciousIps.set(ip, entry);
  if (entry.count401 >= 20) {
    logger.warn({ ip, count: entry.count401, url }, "[security] Possible credential-stuffing — high 401 rate from IP");
  }
}

/**
 * Middleware that auto-tracks 401 responses for credential-stuffing detection.
 * Apply globally after route registration.
 */
export function unauthorizedTracker(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode === 401) {
      trackUnauthorized(getClientIp(req), req.url);
    }
    return originalJson(body);
  };
  next();
}
