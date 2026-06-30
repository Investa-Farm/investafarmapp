import app from "./app";
import { logger } from "./lib/logger";
import { seedDemoUsers } from "./seed";
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

async function seedWithRetry(retries = 3, delayMs = 3000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await seedDemoUsers((msg) => logger.info(msg));
      return;
    } catch (e) {
      if (i < retries - 1) {
        logger.warn({ attempt: i + 1, err: (e as Error).message }, "[seed] Seed failed, retrying...");
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw e;
      }
    }
  }
}

const server = app.listen(port, async () => {
  logger.info({ port }, "Server listening");
  initVapid();
  testSmtpConnection().catch(() => {});

  try {
    await waitForDb();
    await ensureSchema();
    await seedWithRetry();
  } catch (e) {
    logger.warn({ err: e }, "Seed failed after retries (non-fatal) — demo accounts may be unavailable");
  }

  startScheduler();
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
