import app from "./app";
import { logger } from "./lib/logger";
import { seedDemoUsers } from "./seed";
import { startScheduler } from "./scheduler";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, async () => {
  logger.info({ port }, "Server listening");

  try {
    await seedDemoUsers((msg) => logger.info(msg));
  } catch (e) {
    logger.warn({ err: e }, "Seed failed (non-fatal)");
  }

  startScheduler();
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
