# Deployment Guide — Investa Farm

## Two-Database Failover Setup

Investa Farm uses **Neon** as the primary PostgreSQL database and **Supabase**
as an automatic hot-standby. If Neon becomes unreachable the API server
switches to Supabase within one failed query — no restart required.

```
   ┌─────────────┐    normal        ┌──────────────┐
   │  API Server │ ──────────────▶  │   Neon (PG)  │ PRIMARY
   └─────────────┘                  └──────────────┘
          │              failover         ▲
          └──────────────────────▶ ┌──────────────┐
                                   │ Supabase (PG)│ STANDBY
                                   └──────────────┘
```

### Failover behaviour
| Event | Behaviour |
|---|---|
| Neon returns a connection error | All traffic shifts to Supabase automatically |
| Query/logic errors (e.g. unique constraint) | No failover — error returned to caller |
| Neon recovers | Traffic shifts back within 60 seconds |
| Both databases down | 503 returned to callers |

> **Data divergence warning:** writes during a Neon outage go only to Supabase.
> When Neon recovers there may be a gap. For zero-divergence you would need
> logical replication (Postgres → Postgres streaming replication) — see
> "Setting up replication" below if needed later.

---

## Render Setup

### Environment variables to set in Render

Go to your service → **Environment** → add these:

| Key | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://...@neon.tech/...` | Your Neon connection string (already in Replit) |
| `SUPABASE_DATABASE_URL` | `postgresql://postgres:%5BYourPassword%40Here%5D@db.xyz.supabase.co:5432/postgres` | URL-encode special chars in password (see below) |
| `NODE_ENV` | `production` | Enables production pool sizes, SSL, etc. |
| `SESSION_SECRET` | *(copy from Replit secrets)* | |
| `PESAPAL_CONSUMER_KEY` | *(copy from Replit secrets)* | |
| `PESAPAL_CONSUMER_SECRET` | *(copy from Replit secrets)* | |

#### URL-encoding passwords with special characters

If your Supabase password contains `@`, `[`, `]`, `!`, `#`, `%` or spaces,
encode them before putting them in the connection URL:

| Char | Encoded |
|---|---|
| `@` | `%40` |
| `[` | `%5B` |
| `]` | `%5D` |
| `!` | `%21` |
| `#` | `%23` |
| `%` | `%25` |
| space | `%20` |

**Example:** password `[Hello@World!]`  
→ connection string: `postgresql://postgres:%5BHello%40World%21%5D@db.xyz.supabase.co:5432/postgres`

### Render build & start commands

| Setting | Value |
|---|---|
| Build command | `pnpm install && pnpm --filter @workspace/api-server run build` |
| Start command | `node --enable-source-maps artifacts/api-server/dist/index.mjs` |

### Pre-deploy: push schema to Supabase

Run this **once** after your first Render deploy (or any time you add a new
database column):

```bash
# From your local machine (or a Render shell):
DATABASE_URL="<your-neon-url>" \
SUPABASE_DATABASE_URL="<your-supabase-url-with-encoded-password>" \
DB_TARGET=supabase \
pnpm --filter @workspace/db run push
```

Or add it to your Render **pre-deploy command**:

```
pnpm --filter @workspace/db run push && DB_TARGET=supabase pnpm --filter @workspace/db run push
```

This pushes the same Drizzle schema to both Neon and Supabase so their table
structures stay identical.

---

## Health check endpoints

Both are public (no auth) and safe for Render's health check pings:

| Endpoint | Purpose |
|---|---|
| `GET /api/healthz` | Overall health — shows primary + fallback status |
| `GET /api/admin/db-health` | DB-specific detail with column counts |

Example `/api/healthz` response when both databases are healthy:

```json
{
  "ok": true,
  "active": "primary (neon)",
  "primary":  { "label": "neon",     "ok": true, "db": "connected", "usersColumnsFound": 7 },
  "fallback": { "label": "supabase", "ok": true, "db": "connected", "usersColumnsFound": 7 },
  "ts": "2026-07-17T12:00:00.000Z"
}
```

Set Render's health check to `GET /api/healthz` with a 30-second timeout.

---

## Syncing schema after a migration

Whenever you add columns or tables in Replit, run the push to **both**
databases so they stay in sync:

```bash
# Push to Neon (runs automatically via Replit)
pnpm --filter @workspace/db run push

# Push to Supabase (run from Render shell or local machine)
DB_TARGET=supabase pnpm --filter @workspace/db run push
```

---

## One-time data copy (Neon → Supabase)

To seed Supabase with your existing Neon data, run from a machine that can
reach both databases (e.g. your laptop or a Render shell):

```bash
# 1. Dump from Neon (replace with your actual Neon URL)
pg_dump "$DATABASE_URL" \
  --no-owner --no-privileges \
  --exclude-table='drizzle_migrations' \
  -Fc -f neon_backup.dump

# 2. Restore into Supabase
pg_restore \
  --no-owner --no-privileges \
  -d "$SUPABASE_DATABASE_URL" \
  --clean --if-exists \
  neon_backup.dump

echo "Done — Supabase now has a copy of all Neon data."
```

> Run this during a quiet period. The restore takes a few seconds for small
> databases and several minutes for large ones.

---

## Setting up Postgres logical replication (optional — advanced)

If you need zero-divergence (writes replicated in real time), set up
Postgres logical replication from Neon to Supabase:

1. **On Neon** — enable logical replication (available on paid plans):
   `ALTER SYSTEM SET wal_level = logical;`
2. **On Supabase** — create a subscription pointing at Neon's replication slot.
3. This keeps Supabase always up-to-date, even during Neon outages that happen
   before the app-level failover triggers.

This is optional for most use cases — the application-level failover in
`lib/db/src/index.ts` handles the majority of outage scenarios.
