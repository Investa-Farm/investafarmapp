import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.NODE_ENV === "production" ? 25 : 8,
  min: process.env.NODE_ENV === "production" ? 4 : 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  allowExitOnIdle: false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool client error", err.message);
});

export const db = drizzle(pool, { schema });

export type PoolClient = pg.PoolClient;

export * from "./schema";
