import app from "./app";
import { logger } from "./lib/logger";
import { seedDemoUsers } from "./seed";
// import { runBulkSeed } from "./bulkSeed";
import { startScheduler } from "./scheduler";
import { initVapid } from "./lib/push";
import { testSmtpConnection } from "./lib/email";
import { ensureSchema } from "./lib/migrate";
import { pool } from "@workspace/db";

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

const server = app.listen(port, async () => {
  logger.info({ port }, "Server listening");
  initVapid();
  testSmtpConnection().catch(() => {});

  try {
    await waitForDb();
    await ensureSchema();
    // Seed demo accounts on every startup (idempotent — skips existing records)
    await seedDemoUsers((msg) => logger.info(msg));
  } catch (e) {
    logger.warn({ err: e }, "DB setup failed (non-fatal)");
  }

  startScheduler();
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
