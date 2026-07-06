# Investa Farm

Investa Farm is an agribusiness financing and investment platform connecting farmers who need capital with investors seeking returns from agriculture — with a primary market for funding crop projects and a secondary market for trading farm shares.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/investa-farm run dev` — run the frontend (also started via the configured "web" workflow)
- `pnpm run typecheck` — full typecheck across all packages (this is what Render's build pipeline also runs — always run it before pushing)
- `pnpm run build` — typecheck + build all packages (mirrors Render's exact build command)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Production env (API server): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — required for web push notifications; server throws on boot in production if missing (no file-based fallback in prod)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, `wouter` for routing, Tailwind v4, Shadcn UI components
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle) for the API server, Vite for the frontend
- Fintech integrations: Stellar (blockchain assets), Paystack/Stripe/Circle, M-Pesa (Daraja)

## Where things live

- `artifacts/investa-farm` — frontend React SPA
  - `src/pages/` — role-based routing (`admin/`, `farmer/`, `investor`, `market/`, `wealth/`, etc.)
  - `src/components/ui/` — shared Shadcn-based component library
  - `src/index.css` — theme (Tailwind v4 CSS variables, dark mode overrides)
- `artifacts/api-server` — Express backend
  - `src/routes/` — modularized endpoints (auth, kyc, stellar, ai, notifications, etc.)
  - `src/lib/` — core logic: `security.ts` (rate limiting/lockout), `roi.ts`, `circle.ts`, `stellar.ts`, `rainfall.ts`, `push.ts` (web push/VAPID)
  - `src/scheduler.ts` — central hub for background jobs and price simulation
- `artifacts/mockup-sandbox` — Canvas/design-only preview tool (never deployed to production)
- `lib/db` — Drizzle ORM schema, one file per table under `lib/db/src/schema/`
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/api-client-react` — auto-generated React Query hooks (via Orval codegen)
- `lib/api-zod` — shared Zod validation schemas generated from the API spec

## Architecture decisions

- **Multi-artifact repo**: frontend, API server, and a design-only mockup sandbox are separate artifacts/workflows; only the frontend and API server are meant for production deployment.
- **Dynamic pricing engine**: `scheduler.ts` simulates market prices every 5 minutes using a DCF model adjusted by crop risk score and order-book demand/supply imbalance.
- **JWT auth with role-specific guards**, multi-tiered rate limiting (global/auth/financial/AI-specific), progressive lockout backoff, and a 7-day grace period for email verification.
- **Randomized scheduler windows** for sensitive jobs (dividend payouts, rainfall alerts) to avoid predictable timing; high-frequency jobs (price simulation, order matching) run on fixed short intervals.
- **VAPID keys**: in production, `initVapid()` requires `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` as secrets and throws if missing — it will not auto-generate or persist keys to disk in production (a local dev-only fallback file is gitignored).
- **Deployed to Render**, not just Replit — Render runs the strict root-level `pnpm run typecheck && pnpm run build` across every workspace package, so all packages (including dev-only ones) must build cleanly even outside Replit's own dev flow.

## Product

- Farmers propose crop projects, apply for loans/vouchers, manage farm operations, and report growth stages (planting, growing, harvest).
- Investors fund farms directly (primary market) or trade existing farm shares (secondary market), with an AI portfolio manager and dividend reinvestment options.
- Admins manage KYC, farms, payouts, support tickets, and platform-wide settings from a dedicated dashboard.
- Real-time market pricing reacts to crop risk and demand/supply dynamics.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always verify Render-style builds locally with the exact root command (`pnpm run typecheck` then `pnpm run build`), not just the per-artifact Replit workflow — some issues (env-var requirements, TS inference edge cases) only surface at that level.
- Vite configs for `investa-farm` and `mockup-sandbox` fall back to sane defaults for `PORT`/`BASE_PATH` when unset (needed for building outside Replit); Replit itself always supplies these via `artifact.toml`.
- Never commit generated secrets/key material (e.g. `.vapid-keys.json`) — it's gitignored; use Replit secrets in production instead.
- Plain `git push` from the main agent may print a spurious "destructive git operations" error about the local `refs/remotes/origin/main.lock` even when the push to GitHub succeeds — verify with `git ls-remote origin main` instead of trusting the push command's own exit text.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
