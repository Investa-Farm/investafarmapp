# Investa Farm — Architecture Overview

A concise guide to how the system fits together — useful for onboarding new engineers.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Client (PWA)                          │
│   React + Vite SPA  ·  Tailwind v4  ·  Shadcn UI        │
│   Role-based routing: farmer / investor / admin          │
│   React Query (auto-generated hooks via Orval)           │
└────────────────────────┬────────────────────────────────┘
                         │  HTTPS / JWT Bearer token
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  API Server (Express 5)                   │
│   /api/auth         · /api/loans         · /api/farms    │
│   /api/kyc          · /api/market        · /api/wallet   │
│   /api/notifications · /api/portfolio   · /api/groups    │
│   /api/stellar      · /api/ai           · /api/admin     │
│                                                          │
│   Middleware: JWT auth · rate limiting · pino logging    │
│   Background: scheduler.ts (price engine, dividends)     │
└────────────────────────┬────────────────────────────────┘
                         │  Drizzle ORM + pg driver
                         ▼
┌─────────────────────────────────────────────────────────┐
│             PostgreSQL (Neon serverless)                  │
│   Tables: users · farms · loan_applications              │
│           market_listings · orders · kyc_documents       │
│           notifications · push_subscriptions             │
│           dividends · syndicates · ...                   │
└─────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

1. User logs in → `POST /api/auth/login` → server returns a signed JWT
2. JWT stored in `localStorage` (`investa_token`)
3. All authenticated requests send `Authorization: Bearer <token>`
4. Server middleware calls `getCurrentUser(req)` which verifies the JWT
5. Role is embedded in the JWT payload; role-specific routes enforce access

---

## Key Packages

| Package | Purpose |
|---------|---------|
| `@workspace/db` | Drizzle ORM schema + Neon client |
| `@workspace/api-spec` | OpenAPI YAML spec (source of truth for API contracts) |
| `@workspace/api-client-react` | Auto-generated React Query hooks (run codegen to update) |
| `@workspace/api-zod` | Auto-generated Zod schemas (run codegen to update) |

---

## Background Scheduler (`artifacts/api-server/src/scheduler.ts`)

Runs on server boot and manages all periodic jobs:

| Job | Interval | Description |
|-----|----------|-------------|
| Price simulation | 5 min | DCF model adjusted for crop risk + order imbalance |
| Order matching | 30 sec | Matches open buy/sell orders |
| Dividend payouts | Daily (randomised window) | Calculates and distributes dividends |
| Rainfall alerts | 6 h (randomised) | Fetches rainfall data, notifies affected farmers |
| Repayment reminders | Daily | Reminds farmers of upcoming loan due dates |

Randomised windows for sensitive jobs prevent predictable timing attacks.

---

## Dynamic Pricing Engine

- Each farm has a `riskScore` (0–100) derived from crop type, location, loan history, and repayment record
- Every 5 minutes, `scheduler.ts` runs the DCF model:
  ```
  intrinsicValue = projectedRevenue / (1 + discountRate)^years
  demandMultiplier = 1 + (buyOrders - sellOrders) / totalOrders * 0.1
  newPrice = intrinsicValue * demandMultiplier * (1 ± riskAdjustment)
  ```
- Price is capped at ±15% per cycle to prevent runaway volatility

---

## Adding a New API Route

1. Create or edit a file in `artifacts/api-server/src/routes/`
2. Add the route to `artifacts/api-server/src/app.ts` (`app.use("/api/your-route", yourRouter)`)
3. Add the endpoint to `lib/api-spec/openapi.yaml`
4. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
5. Use the generated hook in the frontend via `import { useYourHook } from "@workspace/api-client-react"`

---

## Adding a New DB Table

1. Create `lib/db/src/schema/your_table.ts` following the pattern of existing tables
2. Export it from `lib/db/src/schema/index.ts`
3. Run `pnpm --filter @workspace/db run push` (dev database)
4. After deploying, run the same command against production `DATABASE_URL`

---

## Deployment (Render)

- **Build command:** `pnpm run typecheck && pnpm run build` (runs at root)
- **Start command:** `./start.sh` (boots the compiled API server)
- The API server also serves the frontend's built static files in production
- Environment variables are set in the Render dashboard (not in `.env` files)
- Production DB is Neon — schema changes must be manually pushed after deploy
