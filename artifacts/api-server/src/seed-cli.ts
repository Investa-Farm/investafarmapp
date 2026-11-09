import { pool, primaryPool, shadowPool } from "@workspace/db";
import { isDemoSeedEnabled, seedDemoUsers } from "./seed";
import { seedBlogPosts } from "./routes/blog";
import { logger } from "./lib/logger";

async function main(): Promise<void> {
  try {
    const client = await pool.connect();
    client.release();

    if (isDemoSeedEnabled()) {
      await seedDemoUsers((message) => logger.info(message));
    } else {
      logger.info("[seed] Demo accounts and farm data were disabled.");
    }
    await seedBlogPosts((message) => logger.info(message));
    logger.info("[seed] Database seed step completed.");
  } finally {
    await Promise.allSettled([
      primaryPool.end(),
      ...(shadowPool ? [shadowPool.end()] : []),
    ]);
  }
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "[seed] Database seed command failed.");
  process.exitCode = 1;
});
