# Investa Farm

Investa Farm is an agribusiness financing and investment platform connecting farmers who need capital with investors seeking returns from agriculture — with a primary market for funding crop projects and a secondary market for trading farm shares.

## Product overview

- **Farmers** propose crop projects, apply for loans/vouchers, manage farm operations, and report growth stages (planting, growing, harvest).
- **Investors** fund farms directly (primary market) or trade existing farm shares (secondary market), with an AI portfolio manager and dividend reinvestment options.
- **Admins** manage KYC, farms, payouts, support tickets, and platform-wide settings from a dedicated dashboard.
- Real-time market pricing reacts to crop risk and demand/supply dynamics via a background pricing engine.
- Fintech integrations: Stellar (blockchain assets), Paystack/Stripe/Circle, M-Pesa (Daraja).

## Stack

- pnpm workspaces monorepo, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, `wouter` for routing, Tailwind v4, Shadcn UI components
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from an OpenAPI spec)
- Build: esbuild (API server), Vite (frontend)

## Repo structure

- `artifacts/investa-farm` — frontend React SPA
  - `src/pages/` — role-based routing (`admin/`, `farmer/`, `market/`, `wealth/`, etc.)
  - `src/components/ui/` — shared Shadcn-based component library
  - `src/index.css` — theme (Tailwind v4 CSS variables, dark mode overrides)
- `artifacts/api-server` — Express backend (also serves the built frontend in production — see `src/app.ts`)
  - `src/routes/` — modularized endpoints (auth, kyc, stellar, ai, notifications, etc.)
  - `src/lib/` — core logic: `security.ts`, `roi.ts`, `circle.ts`, `stellar.ts`, `rainfall.ts`, `push.ts`
  - `src/scheduler.ts` — background jobs and price simulation
- `artifacts/mockup-sandbox` — Canvas/design-only preview tool (not deployed to production)
- `lib/db` — Drizzle ORM schema, one file per table under `lib/db/src/schema/`
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/api-client-react` — auto-generated React Query hooks (via Orval codegen)
- `lib/api-zod` — shared Zod validation schemas generated from the API spec
- `start.sh` — production start command (used by Render); runs the built API server, which also serves the built frontend

## Run & operate

```bash
# API server (dev)
pnpm --filter @workspace/api-server run dev

# Frontend (dev)
pnpm --filter @workspace/investa-farm run dev

# Full typecheck across all packages
pnpm run typecheck

# Typecheck + build everything (this is what production hosts run)
pnpm run build

# Regenerate API hooks/Zod schemas from the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes (dev only)
pnpm --filter @workspace/db run push
```

## Environment variables

| Variable | Required in | Purpose |
|---|---|---|
| `DATABASE_URL` | all environments | Postgres connection string |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | production | Web push notifications. The server throws on boot in production if these aren't set — there is no file-based fallback in production. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | optional | Seed/admin account credentials |

## Deployment

The app is deployed to Render as a single web service:

- **Build command:** `pnpm install --frozen-lockfile; pnpm run build` — runs a full workspace typecheck, then builds every package (frontend, API server, and the design-only mockup sandbox).
- **Start command:** `./start.sh` — starts the compiled API server (`artifacts/api-server/dist/index.mjs`), which also serves the built frontend (`artifacts/investa-farm/dist/public`) as static files in production.

Because Render builds the entire workspace (not just the artifacts that matter for production), all packages must build cleanly even outside Replit's own per-artifact dev flow — verify with the exact commands above before pushing, not just the Replit workflow logs.

## Architecture notes

- **Multi-artifact repo:** frontend, API server, and a design-only mockup sandbox are separate workflows in Replit, but only the frontend + API server ship to production, combined into one Render service.
- **Dynamic pricing engine:** `scheduler.ts` simulates market prices every 5 minutes using a DCF model adjusted by crop risk score and order-book demand/supply imbalance.
- **Auth & security:** JWT-based auth with role-specific guards, multi-tiered rate limiting (global/auth/financial/AI-specific), progressive lockout backoff, and a 7-day grace period for email verification.
- **Scheduler jobs:** randomized windows for sensitive jobs (dividend payouts, rainfall alerts) to avoid predictable timing; high-frequency jobs (price simulation, order matching) run on fixed short intervals.
