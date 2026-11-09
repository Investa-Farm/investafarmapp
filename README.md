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
| `DATABASE_URL` | all environments | Postgres connection string. It is the primary database when `SUPABASE_DATABASE_URL` is unset; when Supabase is set, this is the Neon fallback. |
| `SUPABASE_DATABASE_URL` | optional | Selects Supabase as the primary database. Leave unset when using only `DATABASE_URL`. Setting it does not copy users or other data from the previous database. |
| `SESSION_SECRET` | production | Signs login/session tokens; use the same value across instances. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | production | Web push notifications. The server throws on boot in production if these aren't set — there is no file-based fallback in production. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | optional | Seed/admin account credentials |
| `SEED_DEMO` | isolated demo deployment only | Set to `true` only when you intentionally want demo accounts and sample data seeded at startup. Leave unset on a production service with real users. |
| `PRIVY_APP_ID` / `PRIVY_APP_SECRET` | Stellar wallet linking | Server-side verification of the user's Privy-linked Stellar wallet. These are not used for Solana. |
| `VITE_PRIVY_APP_ID` | Stellar wallet linking | Privy app ID for the Stellar wallet experience in the frontend. |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional, mobile QR connection | WalletConnect project ID for MetaMask mobile QR pairing. Injected wallet browsers/extensions can connect without it. |
| `CIRCLE_API_KEY` | Polygon USDC deposits | Circle Payments API key used to create and verify intent-specific Polygon USDC deposits. |
| `AURORA_INTENTS_API_KEY` | Aurora deposits | Valid Aurora Intents API key; store as a server secret, never in frontend variables. |
| `AURORA_SOLANA_USDC_ASSET_ID` | optional | Select a specific Solana USDC asset if Aurora returns more than one match for the API key. |
| `PUBLIC_APP_URL` | production Blink | Canonical HTTPS origin used in Solana Action links. It must be the hostname that actually serves this Render service. |
| `SOLANA_DEVNET_RPC_URL` | optional | Custom Solana Devnet RPC. Defaults to Solana's public Devnet endpoint. |
| `SOLANA_DEVNET_USDC_MINT` / `SOLANA_DEVNET_TREASURY_ADDRESS` | Devnet demo only | Public Devnet mint and destination wallet used to build unsigned test-USDC transactions. Configure both to enable the demo. |
| `SOLANA_FARM_SHARE_MINT` | optional, Devnet only | Public Devnet token mint used only to display a balance; the demo does not issue shares. |

## Deployment

The app is deployed to Render as a single web service:

- **Build command:** `pnpm install --frozen-lockfile; pnpm run build` — runs a full workspace typecheck, then builds every package (frontend, API server, and the design-only mockup sandbox).
- **Start command:** `./start.sh` — synchronizes the database schema, then starts the compiled API server (`artifacts/api-server/dist/index.mjs`), which also serves the built frontend (`artifacts/investa-farm/dist/public`) as static files in production.

Because Render builds the entire workspace (not just the artifacts that matter for production), all packages must build cleanly even outside Replit's own per-artifact dev flow — verify with the exact commands above before pushing, not just the Replit workflow logs.

## Which blockchain demo should I use?

| Feature | Network | What it does | What it does not do |
|---|---|---|---|
| Solana Devnet funding lab | Solana **Devnet** | Reads public test balances and builds an unsigned test-token transfer for a connected, verified wallet. The wallet owner reviews and signs it. | No real funds, KES credit, farm investment, or share issuance. |
| Social Blink | Solana **Devnet** | Publishes a shareable Solana Action (`/actions.json` → `/api/actions/invest`) that creates an unsigned demo transfer for a compatible wallet to review and sign. | It is not an investment checkout and does not create farm shares or settle an investment. |
| Aurora Intents | Solana **mainnet** destination | Creates a persistent deposit address for supported source-chain assets and checks Aurora's deposit/delivery status for the user's verified Solana wallet. | It is not a quote or a confirmed investment; it does not credit KES, record a farm investment, or issue shares. |

Keep the Devnet and mainnet flows separate. Never send real assets to a Devnet address or treat an Aurora deposit as an Investa investment without a separate audited settlement and reconciliation flow.

## Solana Devnet demo

The Solana Devnet funding lab is part of the existing Investa Farm Render web service; it is not a separately deployed Solana program. The API reads public Devnet balances and can construct an **unsigned SPL-token transfer** for a connected Solana wallet. The wallet owner signs a message to verify ownership, then reviews and signs the Devnet transaction in their wallet. Privy is used for Stellar, not Solana. The demo does not mint farm shares, record an investment, or credit KES or Polygon USDC. Devnet tokens have no real-world value.

To enable the Devnet transfer and Blink demo on Render:

1. Add `SOLANA_DEVNET_USDC_MINT` with a six-decimal test-token mint on Devnet.
2. Add `SOLANA_DEVNET_TREASURY_ADDRESS` with the demo destination wallet on Devnet.
3. Optionally set `SOLANA_DEVNET_RPC_URL` to a reliable Devnet RPC and `SOLANA_FARM_SHARE_MINT` if you want the UI to display that token's public balance.
4. Sign in to Investa Farm and connect Phantom, Solflare, or another injected Solana wallet that supports message signing. Investa verifies ownership with a short-lived signed message; no transaction is sent for verification.
5. Set `PUBLIC_APP_URL` to the live HTTPS origin and redeploy the Render service. Use a wallet funded with Devnet SOL and the configured test USDC mint.

There is no program deployment step for this demo. Check `GET /api/multichain/status` and `GET /api/solana/devnet/status` after deploy; both must report the Devnet transfer as configured. `/actions.json` should then list the demo amount links. The API only builds a transaction for the configured Devnet mint and treasury; it does not sign or submit the transaction on the user's behalf. Keep all Devnet mint/treasury settings separate from production stablecoin, KES, and farm-share accounting.

## Aurora Intents deposits and Solana Social Blinks

Aurora Intents is a separate **Solana mainnet** deposit path. It creates a persistent deposit address for supported source chains and assets, with the destination set to the user's Solana wallet after a signed-message ownership check. The UI offers 31+ Aurora source-network identifiers (including EVM, Bitcoin-family, Stellar, Sui, and other networks); actual deposits still depend on Aurora's supported asset list and API-key approval. The generated address is not a swap quote, does not lock an exchange rate, and does not confirm receipt. Do not treat a deposit as an investment or credit KES until an audited settlement/reconciliation flow is implemented.

To configure the live Aurora address and tracking flow, add `AURORA_INTENTS_API_KEY` as a server secret in Replit and Render, and set `SESSION_SECRET`. Aurora must approve the key for persistent deposit addresses. If Aurora returns multiple Solana USDC assets, set `AURORA_SOLANA_USDC_ASSET_ID` to the intended asset ID. After creating an address, the signed-in user can check Aurora's transaction history for a matching deposit and Solana delivery status. This does not credit KES, record an Investa investment, or issue farm shares. Without an approved key, the UI reports the route unavailable and does not show a fake address.

Solana wallet verification uses a server-signed, five-minute challenge and the wallet's Ed25519 message signature. Privy remains limited to the Stellar account flow. Aurora is the provider for cross-chain deposits to Solana; Circle is a separate Polygon USDC deposit rail and WalletConnect only connects a compatible EVM wallet for that Polygon flow.

The Devnet demo exposes a Solana Action at `/api/actions/invest` and its discovery manifest at `/actions.json`, with the cross-origin headers required by wallets and Blink clients. The Action returns an unsigned transaction; the wallet user must review and sign it. To share a registered Blink on X, publish the app on its canonical HTTPS domain and register that domain with Dialect at [dial.to/register](https://dial.to/register). If `/actions.json` has no amount links, check that both Devnet mint and treasury settings are valid. If it shows a parked page or `/api` returns an unrelated 404, fix the domain's DNS/Render custom-domain target first.

## Architecture notes

- **Multi-artifact repo:** frontend, API server, and a design-only mockup sandbox are separate workflows in Replit, but only the frontend + API server ship to production, combined into one Render service.
- **Dynamic pricing engine:** `scheduler.ts` simulates market prices every 5 minutes using a DCF model adjusted by crop risk score and order-book demand/supply imbalance.
- **Auth & security:** JWT-based auth with role-specific guards, multi-tiered rate limiting (global/auth/financial/AI-specific), progressive lockout backoff, and a 7-day grace period for email verification.
- **Scheduler jobs:** randomized windows for sensitive jobs (dividend payouts, rainfall alerts) to avoid predictable timing; high-frequency jobs (price simulation, order matching) run on fixed short intervals.
- **DB migrations:** schema changes must be manually pushed to production after deploy — run `pnpm --filter @workspace/db run push` against the intended production database. When `SUPABASE_DATABASE_URL` is set, it is primary; `DATABASE_URL` is the Neon fallback.

## Login and deployment troubleshooting

- **Confirm the service is reachable first.** Open `GET /api/healthz` on the same public HTTPS hostname used for login. The response identifies the primary and fallback database separately. A healthy primary with an unhealthy fallback means the app can still serve requests, but automatic database failover/dual-write is not healthy.
- **Check the configured database target.** With `SUPABASE_DATABASE_URL` set, the API uses it as primary and uses `DATABASE_URL` as the optional Neon fallback. Correct the fallback URL in Render or remove it there if this service is intentionally single-database. Do not put a placeholder or stale host in `DATABASE_URL`.
- **A new database does not contain old accounts automatically.** Changing a Render connection string does not migrate user records. A login response of `401 Invalid credentials` can mean the account is not present in the selected database (or the password is wrong); copy the required data using the documented, backed-up migration process. Do not enable `SEED_DEMO=true` on a public production database just to restore access.
- **Legacy foreign-key warnings are a data-integrity issue, not a connection test.** If schema startup reports existing investments, wallets, notifications, or other rows that reference missing parent records, back up and reconcile those records before enforcing the constraints. Do not delete rows to silence the warnings without reviewing their financial history.
- **A parked page or unrelated 404 means the request is not reaching this API.** Verify the hostname in Render's Custom Domains page and point DNS to the exact target Render provides; remove conflicting parking/old-host records. Set `PUBLIC_APP_URL` to that same working HTTPS origin for Social Blink links.

## Team docs

| File | Purpose |
|------|---------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Dev setup, branch naming, coding conventions, PR process |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System diagram, key packages, how to add routes/tables |
| [ROADMAP.md](./ROADMAP.md) | What's built, what's in progress, what's planned |
| [BUGS.md](./BUGS.md) | Active bugs, recently fixed issues, how to investigate production errors |
