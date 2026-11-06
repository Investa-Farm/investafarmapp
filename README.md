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
| `PRIVY_APP_ID` / `PRIVY_APP_SECRET` | Aurora wallet verification | Server-side verification of the user's linked Privy Solana wallet. The frontend also needs `VITE_PRIVY_APP_ID`. |
| `VITE_WALLETCONNECT_PROJECT_ID` | MetaMask mobile | WalletConnect project ID used by the frontend to return a connected MetaMask account to the PWA. |
| `AURORA_INTENTS_API_KEY` | Aurora deposits | Approved Aurora Intents API key; store as a server secret, never in frontend variables. |
| `AURORA_SOLANA_USDC_ASSET_ID` | optional | Select a specific Solana USDC asset if Aurora returns more than one match for the API key. |
| `PUBLIC_APP_URL` | optional | Canonical HTTPS public origin used in Solana Action links. Production defaults to `https://app.investafarm.com`; set this when using another domain. |
| `SOLANA_DEVNET_RPC_URL` | optional | Custom Solana Devnet RPC. Defaults to Solana's public Devnet endpoint. |
| `SOLANA_DEVNET_USDC_MINT` / `SOLANA_DEVNET_TREASURY_ADDRESS` | Devnet demo only | Public Devnet mint and destination wallet used to build unsigned test-USDC transactions. Configure both to enable the demo. |
| `SOLANA_FARM_SHARE_MINT` | optional, Devnet only | Public Devnet token mint used only to display a balance; the demo does not issue shares. |

## Deployment

The app is deployed to Render as a single web service:

- **Build command:** `pnpm install --frozen-lockfile; pnpm run build` — runs a full workspace typecheck, then builds every package (frontend, API server, and the design-only mockup sandbox).
- **Start command:** `./start.sh` — synchronizes the database schema, then starts the compiled API server (`artifacts/api-server/dist/index.mjs`), which also serves the built frontend (`artifacts/investa-farm/dist/public`) as static files in production.

Because Render builds the entire workspace (not just the artifacts that matter for production), all packages must build cleanly even outside Replit's own per-artifact dev flow — verify with the exact commands above before pushing, not just the Replit workflow logs.

## Solana Devnet demo

The Solana Devnet funding lab is part of the existing Investa Farm Render web service; it is not a separately deployed Solana program. The API reads public Devnet balances and can construct an **unsigned SPL-token transfer** for a Privy-linked Solana wallet. The wallet owner must review and sign it. The demo does not mint farm shares, record an investment, or credit KES or Polygon USDC. Devnet tokens have no real-world value.

To enable the transfer demo on Render:

1. Add `SOLANA_DEVNET_USDC_MINT` with a six-decimal test-token mint on Devnet.
2. Add `SOLANA_DEVNET_TREASURY_ADDRESS` with the demo destination wallet on Devnet.
3. Optionally set `SOLANA_DEVNET_RPC_URL` to a reliable Devnet RPC and `SOLANA_FARM_SHARE_MINT` if you want the UI to display that token's public balance.
4. Confirm `VITE_PRIVY_APP_ID` is configured for the frontend and `PRIVY_APP_ID` plus `PRIVY_APP_SECRET` are configured for the API. Investa sign-in is still required; Privy is used to verify wallet ownership.
5. Redeploy the Render service and use a wallet funded with Devnet SOL and the configured test USDC mint.

There is no program deployment step for this demo. The current API only builds a transaction for the configured Devnet mint and treasury; it does not sign or submit the transaction on the user's behalf. Keep all Devnet mint/treasury settings separate from production stablecoin, KES, and farm-share accounting.

## Aurora Intents deposits and Solana Social Blinks

Aurora Intents is a separate **Solana mainnet** deposit path. It can create a persistent deposit address for supported source chains and assets, with the destination set to the user's server-verified Privy Solana wallet. The UI lists Aurora's supported source-chain identifiers (including EVM, Bitcoin-family, Stellar, Sui, and other networks); actual deposits still depend on Aurora's supported asset list and API-key approval. The generated address is not a swap quote, does not lock an exchange rate, and does not confirm receipt. Do not treat a deposit as an investment or credit KES until an audited settlement/reconciliation flow is implemented.

To configure the Aurora address flow, add `AURORA_INTENTS_API_KEY` as a Render secret. `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `SESSION_SECRET`, and `VITE_PRIVY_APP_ID` must also be present. If Aurora returns multiple Solana USDC assets, set `AURORA_SOLANA_USDC_ASSET_ID` to the intended asset ID. The app only requests a persistent address; it does not invoke the Aurora Swap API, submit a transaction, or issue farm shares.

The Devnet demo also exposes a Solana Action at `/api/actions/invest` and its discovery manifest at `/actions.json`, with the cross-origin headers required by wallets and social Blink clients. To share a registered Blink on X, publish the app on its canonical HTTPS domain and register that domain with Dialect at [dial.to/register](https://dial.to/register). Social Blink links build unsigned **Devnet** demo transactions only; users must review and sign in a compatible wallet. Do not use a Blink to imply that a real investment has been funded.

## Architecture notes

- **Multi-artifact repo:** frontend, API server, and a design-only mockup sandbox are separate workflows in Replit, but only the frontend + API server ship to production, combined into one Render service.
- **Dynamic pricing engine:** `scheduler.ts` simulates market prices every 5 minutes using a DCF model adjusted by crop risk score and order-book demand/supply imbalance.
- **Auth & security:** JWT-based auth with role-specific guards, multi-tiered rate limiting (global/auth/financial/AI-specific), progressive lockout backoff, and a 7-day grace period for email verification.
- **Scheduler jobs:** randomized windows for sensitive jobs (dividend payouts, rainfall alerts) to avoid predictable timing; high-frequency jobs (price simulation, order matching) run on fixed short intervals.
- **DB migrations:** schema changes must be manually pushed to production after deploy — run `pnpm --filter @workspace/db run push` against the production `DATABASE_URL`. The production database is Neon (serverless PostgreSQL).

## Team docs

| File | Purpose |
|------|---------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Dev setup, branch naming, coding conventions, PR process |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System diagram, key packages, how to add routes/tables |
| [ROADMAP.md](./ROADMAP.md) | What's built, what's in progress, what's planned |
| [BUGS.md](./BUGS.md) | Active bugs, recently fixed issues, how to investigate production errors |
