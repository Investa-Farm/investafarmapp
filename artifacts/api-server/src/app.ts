import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

// pino-http uses `export =` syntax — cast to avoid TS2349 on Vercel
app.use(
  (pinoHttp as unknown as (opts: object) => ReturnType<typeof pinoHttp>)({
    logger,
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
// Build the allowed-origins list.
// • ALLOWED_ORIGINS env var: comma-separated list (set on Render/Railway).
// • Production fallback: mirror any origin back (frontend+backend share the
//   same domain, so real cross-origin abuse still requires a valid JWT).
// • Dev fallback: localhost ports used by Vite / the dev workflow.
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : null;

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // No Origin header → same-origin curl/Postman/server-side call → allow.
    if (!origin) return callback(null, true);

    // Explicit list set via env var → honour it exactly.
    if (allowedOriginsEnv) {
      return allowedOriginsEnv.includes(origin)
        ? callback(null, true)
        : callback(new Error(`CORS blocked: ${origin}`));
    }

    // Production with no explicit list → echo origin back.
    // Auth is JWT-based so this doesn't weaken security.
    if (process.env.NODE_ENV === "production") {
      return callback(null, true);
    }

    // Development → allow localhost on common Vite / API ports.
    const devOrigins = [
      "http://localhost:5000",
      "http://localhost:3000",
      "http://localhost:19899",
      "http://localhost:4173",
    ];
    return devOrigins.includes(origin)
      ? callback(null, true)
      : callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", corsMiddleware, router);

// Serve uploaded files (KYC docs, farm photos) from the uploads directory
const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "..", "..", "investa-farm", "dist", "public");
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
  res.status(status).json({ error: err.message ?? "Internal server error" });
});

export default app;
