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
import { corsOriginAllowed } from "./lib/authTokens";
import { db, blogPostsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();
app.set("trust proxy", 1);

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
const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (corsOriginAllowed(origin)) return callback(null, true);
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

// ── Google Search Console verification ────────────────────────────────────────
app.get("/googleb1c7018e72191e16.html", (_req, res) => {
  res.type("text/html").send("google-site-verification: googleb1c7018e72191e16.html");
});

// ── robots.txt & sitemap.xml — public, no rate-limit, indexed by crawlers ──
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /admin",
      "Disallow: /farmer",
      "Disallow: /investor-auth",
      "Disallow: /farmer-auth",
      "Disallow: /cooperative-auth",
      "Disallow: /wealth-auth",
      "Disallow: /login",
      "Disallow: /register",
      "Disallow: /onboarding",
      "Disallow: /verify-otp",
      "Disallow: /reset-password",
      "Disallow: /portfolio",
      "Disallow: /wallet",
      "Disallow: /activity",
      "Disallow: /profile",
      "Disallow: /bets",
      "Disallow: /agribusiness",
      "Disallow: /cooperative",
      "Disallow: /sales-agent",
      "Disallow: /offtaker",
      "Disallow: /syndicates",
      "Disallow: /wealth",
      "",
      "Sitemap: https://investafarm.com/sitemap.xml",
    ].join("\n")
  );
});

app.get("/sitemap.xml", async (_req, res) => {
  try {
    const posts = await db
      .select({ slug: blogPostsTable.slug, updatedAt: blogPostsTable.updatedAt })
      .from(blogPostsTable)
      .orderBy(desc(blogPostsTable.publishedAt));

    const BASE = "https://investafarm.com";

    const staticUrls = [
      { loc: `${BASE}/`,              priority: "1.0",  changefreq: "weekly" },
      { loc: `${BASE}/market/preview`, priority: "0.9",  changefreq: "daily"  },
      { loc: `${BASE}/blog`,           priority: "0.9",  changefreq: "daily"  },
      { loc: `${BASE}/faq`,            priority: "0.7",  changefreq: "monthly" },
    ];

    const blogUrls = posts.map((p) => ({
      loc: `${BASE}/blog/${p.slug}`,
      lastmod: new Date(p.updatedAt).toISOString().split("T")[0],
      priority: "0.8",
      changefreq: "monthly",
    }));

    const allUrls = [...staticUrls, ...blogUrls];

    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...allUrls.map((u) =>
        [
          "  <url>",
          `    <loc>${u.loc}</loc>`,
          "lastmod" in u && u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>` : "",
          `    <changefreq>${u.changefreq}</changefreq>`,
          `    <priority>${u.priority}</priority>`,
          "  </url>",
        ]
          .filter(Boolean)
          .join("\n")
      ),
      `</urlset>`,
    ].join("\n");

    res.type("application/xml").send(xml);
  } catch (e) {
    res.status(500).send("<!-- sitemap error -->");
  }
});

// Public health check — no auth, no rate-limit, for Render + uptime monitors
app.get("/api/healthz", async (_req, res) => {
  try {
    const { primaryPool, fallbackPool, dbStatus } = await import("@workspace/db");
    const primaryLabel = process.env.SUPABASE_DATABASE_URL ? "supabase" : "neon";
    const fallbackLabel = primaryLabel === "supabase" ? "neon" : "supabase";

    async function checkPool(p: import("pg").Pool, label: string) {
      const client = await p.connect().catch(() => null);
      if (!client) return { label, ok: false, db: "unreachable" };
      try {
        await client.query("SELECT 1");
        const r = await client.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM information_schema.columns
           WHERE table_schema='public' AND table_name='users'
           AND column_name IN ('id','email','password_hash','role','email_verified','county','credit_limit_kes')`
        );
        const colCount = parseInt(r.rows[0]?.count ?? "0", 10);
        return { label, ok: colCount >= 7, db: "connected", usersColumnsFound: colCount };
      } catch (e) {
        return { label, ok: false, db: "error", error: (e as Error).message };
      } finally {
        client.release();
      }
    }

    const [primary, fallback] = await Promise.all([
      checkPool(primaryPool, primaryLabel),
      fallbackPool ? checkPool(fallbackPool, fallbackLabel) : Promise.resolve(null),
    ]);

    const overall = primary.ok || (fallback?.ok ?? false);
    res.status(overall ? 200 : 503).json({
      ok: overall,
      active: dbStatus().active,
      primary,
      fallback,
      ts: new Date().toISOString(),
    });
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
