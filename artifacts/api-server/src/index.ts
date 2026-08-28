import app from "./app";
import { logger } from "./lib/logger";
import { seedDemoUsers } from "./seed";
import { assertProductionSecrets, isProduction } from "./lib/authTokens";
import { seedBlogPosts } from "./routes/blog";
// import { runBulkSeed } from "./bulkSeed";
import { startScheduler } from "./scheduler";
import { initVapid } from "./lib/push";
import { testSmtpConnection } from "./lib/email";
import { ensureSchema } from "./lib/migrate";
import { pool } from "@workspace/db";

assertProductionSecrets();

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function waitForDb(retries = 10, delayMs = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      return;
    } catch (e) {
      logger.warn({ attempt: i + 1, retries, err: (e as Error).message }, "[db] Waiting for database...");
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Database not reachable after multiple attempts");
}

async function prepareDatabase(): Promise<void> {
  try {
    await waitForDb();
    await ensureSchema();
    // Demo accounts are never seeded in production. Opt in locally with SEED_DEMO=true.
    if (!isProduction() && process.env.SEED_DEMO === "true") {
      await seedDemoUsers((msg) => logger.info(msg));
    }
    await seedBlogPosts((msg) => logger.info(msg));
  } catch (e) {
    logger.error({ err: e }, "Database setup failed before server start");
    throw e;
  }
}

async function startServer(): Promise<void> {
  // Complete database readiness and additive migrations before accepting
  // requests. This replaces the fragile drizzle-kit push in start.sh.
  await prepareDatabase();

  initVapid();
  testSmtpConnection().catch(() => {});

  const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
    startScheduler();
  });

  server.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}

startServer().catch((err) => {
  logger.error({ err }, "API server startup failed");
  process.exit(1);
});
