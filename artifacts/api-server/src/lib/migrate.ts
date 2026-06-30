/**
 * Runtime schema migration — runs at every server startup via raw SQL.
 *
 * Why: drizzle-kit push --force silently skips ALTER TABLE on existing tables
 * in non-interactive (Render CI) environments. This file ensures every column
 * the ORM expects actually exists in the DB, regardless of drizzle-kit.
 *
 * All statements are idempotent (IF NOT EXISTS / DO NOTHING / UPDATE … WHERE NULL).
 */

import { pool } from "@workspace/db";
import { logger } from "./logger";

type PoolClient = Awaited<ReturnType<(typeof pool)["connect"]>>;

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

export async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info("[migrate] Applying runtime schema migrations…");

    // ── user_role enum — add values added after initial deployment ─────────────
    for (const v of ["cooperative", "agribusiness", "admin"]) {
      await enumVal(client, "user_role", v);
    }

    // ── users — newer columns ──────────────────────────────────────────────────
    await col(client, "users", "account_number",     "TEXT UNIQUE");
    await col(client, "users", "totp_secret",        "TEXT");
    await col(client, "users", "totp_enabled",       "BOOLEAN NOT NULL DEFAULT FALSE");
    await col(client, "users", "phone",              "TEXT");
    await col(client, "users", "county",             "TEXT");
    await col(client, "users", "credit_limit_kes",   "NUMERIC(15,2)");
    await col(client, "users", "max_deposit_kes",    "NUMERIC(15,2)");
    await col(client, "users", "max_withdrawal_kes", "NUMERIC(15,2)");

    // ── farms — newer columns ──────────────────────────────────────────────────
    await col(client, "farms", "change_percent", "NUMERIC(8,4) NOT NULL DEFAULT 0");
    await col(client, "farms", "trade_count",    "INTEGER NOT NULL DEFAULT 0");
    await col(client, "farms", "current_price",  "NUMERIC(15,2)");
    await col(client, "farms", "latitude",       "NUMERIC(10,6)");
    await col(client, "farms", "longitude",      "NUMERIC(10,6)");
    await col(client, "farms", "risk_score",     "NUMERIC(5,2) DEFAULT 5");

    // Backfill current_price from share_price for rows created before the column existed
    await sql(
      client,
      `UPDATE farms SET current_price = share_price WHERE current_price IS NULL`,
      "farms.current_price backfill"
    );

    // ── investments — newer columns ────────────────────────────────────────────
    await col(client, "investments", "exit_requested_at", "TIMESTAMP");
    await col(client, "investments", "exit_type",         "TEXT");
    await col(client, "investments", "exit_status",       "TEXT DEFAULT 'pending'");

    // ── wallet_transactions — newer columns ────────────────────────────────────
    await col(client, "wallet_transactions", "status",    "TEXT NOT NULL DEFAULT 'completed'");
    await col(client, "wallet_transactions", "reference", "TEXT");

    // ── farm_updates — newer columns ───────────────────────────────────────────
    await col(client, "farm_updates", "image_url", "TEXT");

    // ── loan_applications — newer columns ──────────────────────────────────────
    await col(client, "loan_applications", "ai_score",   "NUMERIC(5,2)");
    await col(client, "loan_applications", "ai_summary", "TEXT");

    logger.info("[migrate] Runtime schema migrations complete ✓");
  } catch (e) {
    // Non-fatal: log and continue — server must still start
    logger.error({ err: e }, "[migrate] Migration error (non-fatal)");
  } finally {
    client.release();
  }
}
