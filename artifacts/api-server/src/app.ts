import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import router from "./routes";
import { logger } from "./lib/logger";
import { securityHeaders, frontendSecurityHeaders, globalRateLimit, sanitizeInput, botDetection, payloadSizeGuard, unauthorizedTracker } from "./lib/security";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

// pino-http uses `export =` syntax — cast to avoid TS2349 on Vercel
app.use(
  (pinoHttp as unknown as (opts: object) => ReturnType<typeof pinoHttp>)({
    logger,
    // Redact any sensitive fields that might appear in log output
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.token",
        "req.body.otp",
        "req.body.secret",
      ],
      censor: "[REDACTED]",
    },
    serializers: {
      req(req: { id: string | number; method?: string; url?: string }) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res: { statusCode: number }) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
// CORS configuration.
// Auth is JWT-based, so allowing all origins in production does not weaken
// security — the token is the credential, not the origin.
// In development we restrict to known local ports to catch accidental
// cross-origin calls during development.
const corsMiddleware = cors({
  origin: (origin, callback) => {
    // No Origin header → same-origin curl/Postman/server-side call → allow.
    if (!origin) return callback(null, true);

    // Production → always allow. JWT is the auth mechanism.
    if (process.env.NODE_ENV === "production") {
      return callback(null, true);
    }

    // Development → allow localhost on common Vite / API ports plus any
    // Replit dev domain (ALLOWED_ORIGINS can extend this list).
    const allowedOriginsEnv = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : [];

    const devOrigins = [
      "http://localhost:5000",
      "http://localhost:3000",
      "http://localhost:19899",
      "http://localhost:4173",
      ...allowedOriginsEnv,
    ];

    if (devOrigins.includes(origin)) return callback(null, true);

    // Also allow any *.replit.dev origin in development.
    if (origin.endsWith(".replit.dev")) return callback(null, true);

    const err = Object.assign(new Error(`CORS blocked: ${origin}`), { status: 403 });
    return callback(err);
  },
  credentials: true,
});

// Attach a unique request ID to every request for tracing and audit logs
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as Request & { id?: string }).id = (req.headers["x-request-id"] as string) || randomUUID();
  next();
});

// Gzip compression — must be first so all responses benefit
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));
app.use(payloadSizeGuard);
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true, limit: "512kb" }));
app.use(botDetection);
app.use(sanitizeInput);

// Public health check — no auth, no rate-limit, for Render + uptime monitors
app.get("/api/healthz", async (_req, res) => {
  try {
    const { pool } = await import("@workspace/db");
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      // Check users table has required newer columns
      const r = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM information_schema.columns
         WHERE table_schema='public' AND table_name='users'
         AND column_name IN ('id','email','password_hash','role','email_verified','county','credit_limit_kes')`
      );
      const colCount = parseInt(r.rows[0]?.count ?? "0", 10);
      const schemaOk = colCount >= 7;
      res.json({ ok: schemaOk, db: "connected", schemaOk, usersColumnsFound: colCount, ts: new Date().toISOString() });
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(503).json({ ok: false, db: "error", error: (e as Error).message });
  }
});

// Tight API CSP (default-src 'none') — correct for JSON-only routes
app.use("/api", corsMiddleware, globalRateLimit, securityHeaders, unauthorizedTracker, router);

// Serve uploaded files (KYC docs, farm photos) from the uploads directory
const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "..", "..", "investa-farm", "dist", "public");
  // Permissive CSP for the React SPA — allows scripts, styles, Google Fonts, images
  app.use(frontendSecurityHeaders);
  app.use(express.static(staticDir));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// Global JSON error handler — must be last. Without this, Express 5 returns
// a blank 500 HTML page for any unhandled async throw in route handlers.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled route error");
  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { status?: number; statusCode?: number }).statusCode
    ?? 500;
  // In production, never leak raw DB errors or stack traces to clients
  const message = process.env.NODE_ENV === "production" && status === 500
    ? "Internal server error"
    : (err.message ?? "Internal server error");
  res.status(status).json({ error: message });
});

export default app;
