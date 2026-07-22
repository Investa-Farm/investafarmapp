/**
 * Database client with transparent dual-write + bidirectional failover.
 *
 * PRIMARY  → SUPABASE_DATABASE_URL (Supabase — preferred)
 * FALLBACK → DATABASE_URL          (Neon    — backup)
 *
 * Normal mode     : queries → Supabase; writes also mirrored to Neon async
 * Supabase down   : queries → Neon; Supabase re-checked every 60 s
 * Neon down       : queries → Supabase; dual-write errors suppressed
 * Both down       : errors returned to callers
 */
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const PRIMARY_DB_URL  = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
const FALLBACK_DB_URL = process.env.SUPABASE_DATABASE_URL ? process.env.DATABASE_URL : null;

if (!PRIMARY_DB_URL) {
  throw new Error(
    "No database URL found. Set SUPABASE_DATABASE_URL (preferred) or DATABASE_URL.",
  );
}

const WRITE_RE = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i;

// ─── Pool factory ─────────────────────────────────────────────────────────────
function makePool(connectionString: string, label: string): pg.Pool {
  const ssl = connectionString.includes("localhost")
    ? undefined
    : { rejectUnauthorized: false };

  const p = new Pool({
    connectionString,
    ssl,
    max: process.env.NODE_ENV === "production" ? 20 : 6,
    min: 1,
    idleTimeoutMillis:  30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  p.on("error", (err) =>
    console.error(`[db:${label}] Pool client error`, err.message),
  );

  return p;
}

// ─── Pools ────────────────────────────────────────────────────────────────────
export const primaryPool = makePool(
  PRIMARY_DB_URL,
  process.env.SUPABASE_DATABASE_URL ? "supabase" : "neon",
);
export const shadowPool = FALLBACK_DB_URL
  ? makePool(FALLBACK_DB_URL, "neon-fallback")
  : null;

// Backward-compat aliases
export const pool         = primaryPool;
export const fallbackPool = shadowPool;

// ─── Dual-write noise suppression ─────────────────────────────────────────────
let _dualWriteFailCount  = 0;
let _dualWriteLastLog    = 0;
const DUAL_WRITE_LOG_MS  = 5 * 60_000;

function warnDualWrite(label: string, msg: string) {
  _dualWriteFailCount++;
  const now = Date.now();
  if (_dualWriteFailCount === 1 || now - _dualWriteLastLog > DUAL_WRITE_LOG_MS) {
    console.warn(`[db:shadow] ${label} failed: ${msg} (suppressing repeats for 5 min)`);
    _dualWriteLastLog = now;
  }
}

// ─── Connection-error classifier ─────────────────────────────────────────────
function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg  = err.message.toLowerCase();
  const code = (err as NodeJS.ErrnoException).code ?? "";
  return (
    msg.includes("econnrefused")  ||
    msg.includes("etimedout")     ||
    msg.includes("connection terminated") ||
    msg.includes("enotfound")     ||
    code === "ECONNRESET"  ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT"   ||
    // Neon compute-quota exhaustion
    msg.includes("compute time quota")       ||
    msg.includes("exceeded the compute")     ||
    msg.includes("upgrade your plan")        ||
    // Generic capacity signals
    msg.includes("too many connections")     ||
    msg.includes("remaining connection slots are reserved")
  );
}

// ─── Failover state ───────────────────────────────────────────────────────────
// false → using Supabase (primary)   true → using Neon (fallback)
let usingFallback    = false;
let lastFailoverTime: number | null = null;
const PRIMARY_RECHECK_MS = 60_000;

function activePool():  pg.Pool { return usingFallback ? shadowPool! : primaryPool; }
function standbyPool(): pg.Pool { return usingFallback ? primaryPool  : shadowPool!; }

function triggerFailover(reason: string) {
  const from = usingFallback ? "Neon (fallback)"      : "Supabase (primary)";
  const to   = usingFallback ? "Supabase (primary)"   : "Neon (fallback)";
  usingFallback    = !usingFallback;
  lastFailoverTime = Date.now();
  console.warn(`[db] ${from} unreachable (${reason}) → failing over to ${to}`);
}

async function recheckPrimary() {
  // Only relevant when we're running on Neon — try to get back to Supabase
  if (!usingFallback || !shadowPool) return;
  if (lastFailoverTime && Date.now() - lastFailoverTime < PRIMARY_RECHECK_MS) return;
  try {
    const c = await primaryPool.connect();
    await c.query("SELECT 1");
    c.release();
    usingFallback    = false;
    lastFailoverTime = null;
    console.warn("[db] Supabase (primary) recovered — dual-write mode restored");
  } catch {
    lastFailoverTime = Date.now(); // reset 60 s timer
  }
}

// ─── Smart pool proxy ─────────────────────────────────────────────────────────
/**
 * Wraps the pool pair into a single pool handle that:
 *  1. Routes all queries to whichever DB is currently active.
 *  2. Mirrors successful writes to the standby (fire-and-forget).
 *  3. On a connection error, flips to the other DB and retries once.
 *     Works in BOTH directions: Supabase→Neon and Neon→Supabase.
 */
function makeSmartPool(primary: pg.Pool, shadow: pg.Pool): pg.Pool {

  function runQuery(args: unknown[]): Promise<unknown> {
    const current = activePool();
    const text =
      typeof args[0] === "string"
        ? args[0]
        : (args[0] as { text?: string } | null)?.text ?? "";
    const isWrite = WRITE_RE.test(text);

    const result = (current.query as Function).apply(current, args) as Promise<unknown>;

    return result
      .then((res) => {
        // Mirror successful writes to the standby asynchronously
        if (isWrite) {
          const other = standbyPool();
          (other.query as Function)
            .apply(other, args)
            .catch((e: Error) => warnDualWrite("dual-write", e.message));
        }
        return res;
      })
      .catch((err: unknown) => {
        if (isConnectionError(err)) {
          triggerFailover(err instanceof Error ? err.message : String(err));
          // Retry once on the new active DB (no mirroring on a failover retry)
          const newActive = activePool();
          return (newActive.query as Function).apply(newActive, args);
        }
        throw err;
      });
  }

  async function runConnect(): Promise<pg.PoolClient> {
    const current = activePool();
    try {
      const client = await (current.connect as Function).apply(current) as pg.PoolClient;
      return wrapClient(client, standbyPool);
    } catch (err) {
      if (isConnectionError(err)) {
        triggerFailover(err instanceof Error ? err.message : String(err));
        const newActive = activePool();
        const client = await (newActive.connect as Function).apply(newActive) as pg.PoolClient;
        return wrapClient(client, standbyPool);
      }
      throw err;
    }
  }

  return new Proxy(primary, {
    get(_target, prop: string | symbol) {
      if (prop === "query")   return (...args: unknown[]) => runQuery(args);
      if (prop === "connect") return () => runConnect();

      // Passthrough (end, on, totalCount, …) — read from active pool
      const active = activePool();
      const v = (active as unknown as Record<string | symbol, unknown>)[prop];
      return typeof v === "function" ? v.bind(active) : v;
    },
  });
}

/**
 * Wraps a PoolClient (used inside transactions) so writes are mirrored.
 * `getStandby` is a function so it re-evaluates after a failover flip.
 */
function wrapClient(
  client: pg.PoolClient,
  getStandby: () => pg.Pool,
): pg.PoolClient {
  return new Proxy(client, {
    get(target, prop: string | symbol) {
      if (prop === "query") {
        return function (...args: unknown[]) {
          const text =
            typeof args[0] === "string"
              ? args[0]
              : (args[0] as { text?: string } | null)?.text ?? "";

          const result = (target.query as Function).apply(target, args) as Promise<unknown>;

          if (WRITE_RE.test(text)) {
            return result.then((res) => {
              const other = getStandby();
              (other.query as Function)
                .apply(other, args)
                .catch((e: Error) => warnDualWrite("dual-write (tx)", e.message));
              return res;
            });
          }
          return result;
        };
      }
      const v = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

// ─── Drizzle instances ────────────────────────────────────────────────────────
const smartPool: pg.Pool = shadowPool
  ? makeSmartPool(primaryPool, shadowPool)
  : primaryPool;

const _db = drizzle(smartPool, { schema });

export const primaryDb = drizzle(primaryPool, { schema });
export const shadowDb  = shadowPool ? drizzle(shadowPool, { schema }) : null;

// ─── `db` — the default export ───────────────────────────────────────────────
/**
 * The single db handle used everywhere in the app.
 * Automatically routes to whichever DB is healthy, retrying the other on
 * connection failure. No call-site changes needed.
 */
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_t, prop: string | symbol) {
    void recheckPrimary();
    const v = (_db as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? v.bind(_db) : v;
  },
});

// ─── Status helper ─────────────────────────────────────────────────────────────
export function dbStatus() {
  const hasShadow = !!shadowPool;
  const primaryLabel = process.env.SUPABASE_DATABASE_URL ? "supabase" : "neon";
  const mode = hasShadow
    ? usingFallback
      ? "fallback-only (neon)"
      : "dual-write (supabase primary + neon fallback)"
    : `single (${primaryLabel})`;

  return {
    mode,
    active: usingFallback ? "neon" : primaryLabel,
    primary: {
      label: primaryLabel,
      url: PRIMARY_DB_URL?.replace(/:\/\/[^@]+@/, "://<redacted>@"),
    },
    shadow: shadowPool
      ? {
          label: "neon",
          url: FALLBACK_DB_URL?.replace(/:\/\/[^@]+@/, "://<redacted>@"),
        }
      : null,
    failoverAt: lastFailoverTime
      ? new Date(lastFailoverTime).toISOString()
      : null,
  };
}

export type { PoolClient } from "pg";
export * from "./schema";
