import { pool, primaryPool, shadowPool } from "@workspace/db";
import { ensureSchema } from "./lib/migrate";
import { logger } from "./lib/logger";

async function waitForDatabase(retries = 10, delayMs = 2_000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      return;
    } catch (error) {
      logger.warn(
        { attempt, retries, err: error instanceof Error ? error.message : String(error) },
        "[db] Waiting for database before migration...",
      );
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Database not reachable before migration.");
}

async function main(): Promise<void> {
  try {
    await waitForDatabase();
    await ensureSchema();
    logger.info("[db] Migrations completed.");
  } finally {
    await Promise.allSettled([
      primaryPool.end(),
      ...(shadowPool ? [shadowPool.end()] : []),
    ]);
  }
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "[db] Migration command failed.");
  process.exitCode = 1;
});
