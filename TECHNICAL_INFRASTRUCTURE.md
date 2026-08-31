# Investa Farm — Technical Infrastructure

**Document status:** Current implementation reference
**Last reviewed:** 2026-08-31
**Audience:** Engineering, operations, security, and technical partners

## 1. System purpose

Investa Farm is a Kenya-focused agribusiness financing platform. It connects
farmers seeking capital with investors seeking agriculture-linked returns.
The product supports primary farm funding, secondary-market share trading,
farmer loans and vouchers, wallets, KYC, notifications, and role-specific
operations for farmers, investors, cooperatives, agribusinesses, and admins.

## 2. High-level topology

```text
                           HTTPS
                              |
                              v
 +------------------------------------------------------------+
 | React/Vite PWA                                             |
 | artifacts/investa-farm                                     |
 | React Query + wouter + Tailwind + shadcn/Radix             |
 +------------------------------+-----------------------------+
                                |
                                | REST /api, JWT bearer
                                v
 +------------------------------------------------------------+
 | Express 5 API                                               |
 | artifacts/api-server                                        |
 | auth, KYC, farms, loans, market, wallet, admin, AI, etc.   |
 +------------------+---------------------+-------------------+
                    |                     |
                    | Drizzle + pg        | Scheduled jobs
                    v                     v
       +-------------------------+   +-------------------------+
       | Supabase PostgreSQL      |   | In-process scheduler    |
       | primary when configured  |   | pricing, matching,     |
       +------------+------------+   | dividends, reminders   |
                    |                +-------------------------+
                    | failover / dual-write
                    v
       +-------------------------+
       | Neon PostgreSQL         |
       | fallback / standby     |
       +-------------------------+

 External services: PesaPal, Paystack, Daraja/M-Pesa, TalkSasa,
 SMTP/email, Groq, Stellar, Circle, news/market data providers.
```

In Render production, the API server also serves the compiled frontend as
static files. The frontend and API therefore run as one web service using
`start.sh`.

## 3. Repository and build structure

This is a pnpm workspace monorepo:

| Path | Responsibility |
|---|---|
| `artifacts/investa-farm` | Production React/Vite web application |
| `artifacts/api-server` | Production Express API and static-file server |
| `artifacts/mockup-sandbox` | Design/canvas preview tool; not a production service |
| `lib/db` | Drizzle schema, PostgreSQL clients, schema bootstrap SQL |
| `lib/api-spec` | OpenAPI contract and code-generation configuration |
| `lib/api-client-react` | Generated React Query API client |
| `lib/api-zod` | Generated/shared Zod validation |
| `scripts` | Workspace utility scripts |
| `start.sh` | Render production start command |

### Toolchain

- Node.js 24
- pnpm workspaces
- TypeScript 5.9
- React 19
- Vite 7
- Express 5
- Drizzle ORM 0.45
- PostgreSQL via `pg`
- esbuild for the API bundle
- Tailwind CSS 4, shadcn/Radix UI, Lucide icons

### Verification commands

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
```

The root build intentionally typechecks and builds every workspace package,
including the design-only package, because the Render build runs at the
repository root.

## 4. Runtime services

### Frontend

The SPA uses:

- `wouter` for client-side routing
- TanStack React Query for server state and cache invalidation
- standard React hooks for local state
- Tailwind/shadcn/Radix for UI
- Recharts for financial charts
- Leaflet/react-leaflet for farm maps
- Framer Motion for transitions

Role-aware pages live under `artifacts/investa-farm/src/pages/`. API calls use
relative `/api` URLs so the same frontend works behind the Render service and
in the Replit preview.

### API

The API is an Express 5 application assembled in
`artifacts/api-server/src/app.ts`. It provides public health and content
routes, authenticated product routes, and admin-only operations. The server
starts from `src/index.ts`, waits for database readiness, ensures the schema,
seeds permitted baseline content, initializes push configuration, then opens
the HTTP listener.

Important middleware includes:

- CORS and origin controls
- compression
- JSON/form payload limits of 512 KB
- input sanitization and bot detection
- security headers
- request logging with Pino
- global, authentication, financial, and AI rate limits
- nonce/replay protection and unauthorized-request tracking

## 5. API surface

The API is organized into route modules, including:

- `/api/auth` — registration, login, verification, password reset, OAuth
- `/api/farms` and `/api/farmer` — farm projects and farmer operations
- `/api/market` and `/api/orders` — primary/secondary market activity
- `/api/portfolio` and `/api/portfolio-roi` — holdings, ROI, and projections
- `/api/wallet` and `/api/transactions` — balances and financial activity
- `/api/loans` — applications, review, repayment data
- `/api/kyc` — identity and document workflows
- `/api/admin` — administration, approvals, support, and payouts
- `/api/agribusiness` and cooperative routes — partner workflows
- `/api/notifications` — in-app notification state
- `/api/ai` — assistant and decision-support features
- `/api/blog` and `/api/news` — editorial and market content
- `/api/healthz` — unauthenticated service health check

`lib/api-spec/openapi.yaml` is the intended API contract source of truth.
When a contract changes, regenerate the API client and Zod artifacts.

## 6. Data layer

### PostgreSQL and Drizzle

`lib/db` owns the Drizzle schema. Tables cover:

- identity: `users`, OTP codes, password-reset tokens, KYC documents
- farms: farms, farm updates, groups, cooperative members, farmer tasks
- finance: wallets, wallet transactions, transactions, fees, escrow
- investing: investments, market listings, order book, watchlist
- portfolios: portfolios, holdings, subscriptions, fees, reinvestment rules
- outcomes: dividends, ROI projections, harvest payments, platform revenue
- operations: notifications, push subscriptions, audit logs, support tickets
- partners/content: agribusiness connections, products, vouchers, blog posts
- market intelligence: sentiment scores, market events, crop bets, syndicates
- blockchain: Stellar accounts

Foreign keys and unique constraints are defined in the schema and initial SQL
snapshot. Monetary values are stored as PostgreSQL numeric values rather than
binary floating-point values.

### Startup schema safety

At startup the API:

1. waits for a reachable database connection;
2. runs idempotent `CREATE TYPE`/`CREATE TABLE IF NOT EXISTS` bootstrap SQL;
3. applies additive column, enum, and index deltas;
4. performs permitted baseline seeding;
5. only then begins accepting traffic.

The complete bootstrap runs against the primary and fallback pools before
seed queries. This prevents a failover from reaching a missing table such as
`blog_posts`. Schema changes should still be reviewed and synchronized using
the database workflow before production rollout.

## 7. Database routing and failover

When `SUPABASE_DATABASE_URL` is configured, Supabase is the active database and
`DATABASE_URL` is the fallback Neon database. If Supabase is not configured,
`DATABASE_URL` is the single database. The smart pool:

- retries connection failures on the other pool;
- switches back to the primary after a successful health recheck;
- mirrors successful writes to the standby asynchronously when both pools are
  configured;
- does not fail over logical/query errors such as unique-constraint errors.

This is application-level failover, not PostgreSQL replication. Writes made
while a database is unavailable can require reconciliation after recovery.

## 8. Authentication and security

- Passwords are hashed with bcrypt.
- Sessions use signed JWTs.
- Role guards protect farmer, investor, cooperative, agribusiness, and admin
  operations.
- Farmer TOTP/2FA support is provided with `otplib`.
- Email verification and password reset flows use expiring server-side codes.
- Financial and AI endpoints use stricter rate limits.
- Production startup validates required secrets and never generates VAPID
  private keys in production.
- Secrets are supplied through the hosting environment, never committed to
  the repository.

## 9. Financial integrations

| Integration | Role | Production note |
|---|---|---|
| PesaPal | Checkout/payment processing and payment status | Consumer credentials and callback configuration required |
| Paystack | Card/bank and payment verification flows | Secret/public keys required |
| Daraja/M-Pesa | STK Push and C2B flows | Safaricom production credentials and callback URLs required |
| TalkSasa | Transactional SMS | Bearer token and sender configuration required |
| Circle | USDC/programmatic wallet functionality | API configuration and operational review required |
| Stellar SDK | Custodial account and asset operations | Issuer keys and custody controls required |

Financial writes should be treated as ledger operations: validate ownership
and limits, create the transaction record, update the wallet atomically where
possible, emit notifications after the write, and retain an audit trail.

## 10. AI and market intelligence

Groq-backed features include the AI assistant, KYC assistance, risk scoring,
and Kenya-focused commodity/market analysis. Pricing v2 anchors AI risk output
to a deterministic score and falls back to deterministic scoring when the
AI key or service is unavailable. AI output must remain advisory and should
not bypass KYC, authorization, financial limits, or human review flags.

## 11. Notifications and background work

- In-app notifications are persisted in PostgreSQL.
- Web push uses `web-push` and VAPID keys.
- Email uses SMTP/provider configuration and HTML templates.
- Transactional SMS uses TalkSasa and the registered user phone number.
- `scheduler.ts` runs periodic pricing simulation, order matching, dividend
  processing, alerts, reminders, and market monitoring.

The scheduler is an in-process worker. A Render service must remain running
for scheduled jobs to execute reliably. For multi-instance autoscaling,
move these jobs to a dedicated worker or external scheduler and add job
deduplication/locking.

## 12. Deployment on Render

### Service configuration

- Build: `pnpm install --frozen-lockfile && pnpm run build`
- Start: `./start.sh`
- API listener: `PORT` (8080 in the artifact configuration)
- Health check: `GET /api/healthz`
- Static frontend: built output served by the API in production

Render must have the production environment variables configured before
publishing. The deployment should be public only when the product's
authentication and operational controls are ready for public traffic.

### Required/commonly used environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Primary/single PostgreSQL connection |
| `SUPABASE_DATABASE_URL` | Optional Supabase primary or standby connection |
| `NODE_ENV` | `production` in Render |
| `SEED_DEMO` | Optional; set to `true` only when public demo accounts are wanted |
| `PORT` | HTTP listener port |
| `SESSION_SECRET` | Session/signing secret |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web push |
| `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET` | PesaPal |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Paystack |
| `TALKSASA_API_TOKEN` | SMS |
| `GROQ_API_KEY` | AI features |
| `CIRCLE_API_KEY` | Circle USDC features |
| `STELLAR_ISSUER_PUBLIC_KEY`, `STELLAR_ISSUER_SECRET_KEY` | Stellar issuer |
| `GOOGLE_SMTP_USER`, `GOOGLE_SMTP_PASS` | SMTP email |
| `APP_URL` | Callback/link generation where required |
| OAuth/news provider keys | Optional Google, LinkedIn, and market/news features |

Do not place secret values in Markdown, source code, Git history, logs, or
client-side bundles.

## 13. Observability and operations

Pino emits structured logs. Operators should monitor:

- startup failures and schema bootstrap failures;
- `/api/healthz` status and active database;
- payment callback success/failure rates;
- wallet ledger and reconciliation exceptions;
- scheduler job duration and duplicate execution;
- authentication/rate-limit anomalies;
- SMS, email, push, and AI provider error rates.

Production debugging should begin with Render logs, then the health endpoint,
then database schema/table availability, then provider configuration. Database
schema changes must be tested against a representative database before
publishing.

## 14. Current operational limits

- The in-process scheduler is not safe for horizontally duplicated workers
  without distributed locking.
- Application-level database failover does not guarantee zero data divergence.
- External payment, SMS, email, AI, and blockchain providers can be degraded
  independently of the API.
- Upload/storage, secrets rotation, provider webhook replay handling, and
  disaster-recovery restore drills require explicit operational runbooks.
- Automated end-to-end tests, dependency scanning, and CI enforcement should
  be added before treating the platform as fully production-hardened.

## 15. Change checklist

Before merging infrastructure or financial changes:

1. Update the Drizzle schema and generated API contracts when applicable.
2. Add/update idempotent migration or bootstrap behavior.
3. Run `pnpm run typecheck`.
4. Run `pnpm run build`.
5. Start the API with production-like environment settings.
6. Verify `GET /api/healthz` returns HTTP 200.
7. Review logs for migration, provider, and scheduler errors.
8. Confirm no secrets or personal data entered the diff.