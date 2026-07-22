---
name: Dual-database failover
description: Neon (primary) + Supabase (fallback) failover setup; lib/db/src/index.ts routes queries with automatic switchover.
---

## Architecture (Supabase-first)
- primaryPool = Supabase (SUPABASE_DATABASE_URL) — if set, else Neon
- fallbackPool = Neon (DATABASE_URL) — only when Supabase is primary
- `db` export is a Proxy — always routes to whichever pool is currently active
- On connection-level error OR Neon quota-exceeded error, traffic shifts to fallback
- Re-checks primary every 60s; shifts back when Supabase recovers
- `pool` alias re-exported for backward compat with existing call sites
- `isConnectionError` now also catches: "compute time quota", "exceeded the compute", "upgrade your plan", "too many connections"

## Replit network restriction
Replit blocks outbound TCP port 5432 to external hosts (only its own Neon instance works).
Therefore `pnpm --filter @workspace/db run push:supabase` CANNOT run from Replit.
Must be run from: Render shell, Render pre-deploy command, or developer's local machine.

## Render setup
Set DATABASE_URL + SUPABASE_DATABASE_URL as env vars. URL-encode special chars in Supabase password (@→%40, [→%5B, ]→%5D, !→%21).
Pre-deploy: `pnpm --filter @workspace/db run push && DB_TARGET=supabase pnpm --filter @workspace/db run push`

## Health endpoints
GET /api/healthz and GET /api/admin/db-health both show primary + fallback status independently.

**Why:** User requested hot-standby for resilience; failover-at-query-error is simpler than dual-write and handles most outage scenarios.
**How to apply:** Any new DB schema change must be pushed to both DBs — Neon via normal push, Supabase via DB_TARGET=supabase push from outside Replit.

## Dual-write implementation details (updated)
- makeDualPool() and makeDualClient() use .apply(target, args) to forward ALL original args so pg's overloaded query signatures work correctly. Rebuilding args manually broke parameterised queries ("no parameter $1" error).
- Drizzle instance (_db) is created ONCE over the dual-write proxy pool — never recreated per-call.
- db export is a Proxy that switches between _db (dual-write) and shadowDb (failover) based on usingFallback flag.
- Duplicate log suppression: warnDualWrite() throttles to once per 5 min so Replit's blocked-port warnings don't spam logs.
