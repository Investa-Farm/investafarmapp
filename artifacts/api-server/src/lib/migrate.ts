/**
 * Runtime schema migration — runs at every server startup.
 *
 * Two jobs:
 *  1. Apply incremental ALTER TABLE / enum updates to the configured primary.
 *  2. Bootstrap the configured fallback — create all tables IF NOT EXISTS and
 *     apply the same column additions, so both databases always match.
 *
 * All statements are idempotent: safe to re-run on every boot.
 */

import { pool, shadowPool } from "@workspace/db";
import type { PoolClient } from "@workspace/db";
import { SUPABASE_INIT_SQL } from "@workspace/db/supabase-init";
import { logger } from "./logger";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function col(client: PoolClient, table: string, column: string, definition: string) {
  try {
    await client.query(
      `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${definition}`
    );
  } catch (e) {
    logger.warn(`[migrate] ${table}.${column} — ${(e as Error).message}`);
  }
}

async function sql(client: PoolClient, query: string, label: string) {
  try {
    await client.query(query);
  } catch (e) {
    logger.warn(`[migrate] ${label} — ${(e as Error).message}`);
  }
}

async function enumVal(client: PoolClient, typeName: string, value: string) {
  await sql(
    client,
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_enum e
         JOIN pg_type t ON e.enumtypid = t.oid
         WHERE t.typname = '${typeName}' AND e.enumlabel = '${value}'
       ) THEN
         ALTER TYPE ${typeName} ADD VALUE '${value}';
       END IF;
     END $$;`,
    `enum ${typeName} += '${value}'`
  );
}

// ─── Schema delta (columns / enums added after initial deployment) ────────────

async function applyDeltas(client: PoolClient): Promise<void> {
  // user_role enum — values added over time
  for (const v of ["cooperative", "agribusiness", "admin", "viewer", "fund_manager"]) {
    await enumVal(client, "user_role", v);
  }

  // users
  await col(client, "users", "account_number",     "TEXT UNIQUE");
  await col(client, "users", "totp_secret",        "TEXT");
  await col(client, "users", "totp_enabled",       "BOOLEAN NOT NULL DEFAULT FALSE");
  await col(client, "users", "phone",              "TEXT");
  await col(client, "users", "county",             "TEXT");
  await col(client, "users", "country",            "TEXT");
  await col(client, "users", "credit_limit_kes",   "NUMERIC(15,2)");
  await col(client, "users", "max_deposit_kes",    "NUMERIC(15,2)");
  await col(client, "users", "max_withdrawal_kes", "NUMERIC(15,2)");
  await col(client, "users", "metadata",           "JSONB");
  await col(client, "users", "wallet_pin",         "TEXT");
  // OAuth/profile fields added after the original users table was deployed.
  // These must be applied before auth queries select the complete user row.
  await col(client, "users", "avatar_url",         "TEXT");
  await col(client, "users", "bio",                "TEXT");
  await col(client, "users", "oauth_provider_id",  "TEXT");
  // Token versioning is required by every authenticated request. The default
  // keeps existing users valid while the column is added during deployment.
  await col(client, "users", "token_version",      "INTEGER NOT NULL DEFAULT 0");

  // farms
  await col(client, "farms", "change_percent", "NUMERIC(8,4) NOT NULL DEFAULT 0");
  await col(client, "farms", "trade_count",    "INTEGER NOT NULL DEFAULT 0");
  await col(client, "farms", "current_price",  "NUMERIC(15,2)");
  await col(client, "farms", "latitude",       "NUMERIC(10,6)");
  await col(client, "farms", "longitude",      "NUMERIC(10,6)");
  await col(client, "farms", "risk_score",     "NUMERIC(5,2) DEFAULT 5");
  await col(client, "farms", "top_factors",          "JSONB");
  await col(client, "farms", "risk_score_source",    "TEXT");
  await col(client, "farms", "revenue_forecast_low", "NUMERIC(15,2)");
  await col(client, "farms", "revenue_forecast_high","NUMERIC(15,2)");
  await col(client, "farms", "uncertainty_ratio",    "NUMERIC(6,4)");
  await col(client, "farms", "cold_start",           "BOOLEAN NOT NULL DEFAULT FALSE");
  await col(client, "farms", "review_flagged",       "BOOLEAN NOT NULL DEFAULT FALSE");
  await col(client, "farms", "review_reasons",       "JSONB");

  // Backfill current_price from share_price
  await sql(
    client,
    `UPDATE farms SET current_price = share_price WHERE current_price IS NULL`,
    "farms.current_price backfill"
  );

  // investments
  await col(client, "investments", "exit_requested_at", "TIMESTAMP");
  await col(client, "investments", "exit_type",         "TEXT");
  await col(client, "investments", "exit_status",       "TEXT DEFAULT 'pending'");

  // wallet_transactions
  await col(client, "wallet_transactions", "status",    "TEXT NOT NULL DEFAULT 'completed'");
  await col(client, "wallet_transactions", "reference", "TEXT");
  await col(client, "wallet_transactions", "deleted_at","TIMESTAMP");

  // transactions
  await col(client, "transactions", "deleted_at", "TIMESTAMP");

  // farm_updates
  await col(client, "farm_updates", "image_url", "TEXT");

  // loan_applications
  await col(client, "loan_applications", "ai_score",             "NUMERIC(5,2)");
  await col(client, "loan_applications", "ai_summary",           "TEXT");
  await col(client, "loan_applications", "interest_rate",        "NUMERIC(5,3) NOT NULL DEFAULT 1.080");
  await col(client, "loan_applications", "amount_repaid",        "NUMERIC(15,2) NOT NULL DEFAULT 0");
  await col(client, "loan_applications", "next_repayment_due_at","TIMESTAMP");
  await col(client, "loan_applications", "last_reminder_at",     "TIMESTAMP");
  await col(client, "loan_applications", "status_history",       "JSONB");

  // Performance indexes
  const idx = async (name: string, ddl: string) =>
    sql(client, `CREATE INDEX IF NOT EXISTS ${name} ${ddl}`, `idx ${name}`);

  await idx("idx_users_role",              "ON users (role)");
  await idx("idx_users_email",             "ON users (email)");
  await idx("idx_users_created_at",        "ON users (created_at DESC)");
  await idx("idx_farms_farmer_id",         "ON farms (farmer_id)");
  await idx("idx_farms_status",            "ON farms (status)");
  await idx("idx_investments_investor_id", "ON investments (investor_id)");
  await idx("idx_investments_farm_id",     "ON investments (farm_id)");
  await idx("idx_wallet_tx_user_id",       "ON wallet_transactions (user_id)");
  await idx("idx_wallet_tx_created_at",    "ON wallet_transactions (created_at DESC)");
  await idx("idx_wallet_tx_type",          "ON wallet_transactions (type)");
  await idx("idx_kyc_docs_user_id",        "ON kyc_documents (user_id)");
  await idx("idx_kyc_docs_status",         "ON kyc_documents (status)");
  await idx("idx_loans_farmer_id",         "ON loan_applications (farmer_id)");
  await idx("idx_loans_status",            "ON loan_applications (status)");
  await idx("idx_market_listings_farm_id", "ON market_listings (farm_id)");
  await idx("idx_notifications_user_id",   "ON notifications (user_id)");
  await idx("idx_platform_rev_created",    "ON platform_revenue (created_at DESC)");
  await idx("idx_order_book_farm_id",      "ON order_book (farm_id)");
}

// ─── Complete schema bootstrap ────────────────────────────────────────────────

async function bootstrapSchema(client: PoolClient, label: string): Promise<void> {
  let failures = 0;

  // Run every CREATE TABLE IF NOT EXISTS + enum DO block + FK constraint.
  // This is required on Render when a database has not received the initial
  // Drizzle push yet; additive column deltas alone cannot create blog_posts or
  // any of the other missing tables.
  for (const stmt of SUPABASE_INIT_SQL) {
    try {
      // The generated DO blocks contain a delimiter from the source SQL and
      // another delimiter from the wrapper. PostgreSQL rejects that `;;`
      // sequence inside PL/pgSQL, so normalize it before execution.
      await client.query(stmt.replace(/;{2,}/g, ";"));
    } catch (e) {
      failures++;
      // Keep going: every statement is idempotent and an older database may
      // legitimately reject a constraint that is already represented another way.
      logger.warn(`[migrate:${label}] stmt failed (non-fatal): ${(e as Error).message.slice(0, 120)}`);
    }
  }

  await applyDeltas(client);

  if (failures === 0) {
    logger.info(`[migrate:${label}] Complete schema bootstrap finished ✓`);
  } else {
    logger.warn(`[migrate:${label}] Schema bootstrap completed with ${failures} non-fatal statement failure(s)`);
  }
}

async function ensurePoolSchema(target: typeof pool, label: string): Promise<void> {
  const client = await target.connect();
  try {
    logger.info(`[migrate:${label}] Ensuring database schema…`);
    await bootstrapSchema(client, label);
  } finally {
    client.release();
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function ensureSchema(): Promise<void> {
  // 1. Primary database. A primary outage is recoverable when the shadow
  // database is available, so preserve the error and try the shadow below.
  let primaryError: unknown = null;
  try {
    await ensurePoolSchema(pool, "primary");
  } catch (e) {
    primaryError = e;
    logger.warn({ err: e }, "[migrate:primary] Primary schema setup unavailable; trying fallback");
  }

  // 2. Fallback database. This is awaited so a failover cannot reach seed
  // queries before its base tables (including blog_posts) have been created.
  let shadowError: unknown = null;
  if (shadowPool) {
    try {
      await ensurePoolSchema(shadowPool, "fallback");
    } catch (e) {
      shadowError = e;
      logger.warn({ err: e }, "[migrate:fallback] Fallback schema setup unavailable");
    }
  }

  if (primaryError && shadowError) {
    throw primaryError;
  }
}
