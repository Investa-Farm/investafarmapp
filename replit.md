# Investa Farm

A farm investment PWA where farmers raise capital by listing farm shares (like a stock exchange), and investors buy and trade them on a primary and secondary market. Currency: KES (Kenya).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/investa-farm run dev` — run the frontend (port 19899)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind v4 + Wouter router + TanStack Query + Framer Motion + Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/investa-farm/` — React PWA frontend
  - `src/pages/onboarding.tsx` — 3-slide splash/onboarding
  - `src/pages/login.tsx`, `register.tsx` — auth pages
  - `src/pages/market/` — investor market views (home, primary, secondary, farm detail)
  - `src/pages/portfolio.tsx`, `activity.tsx`, `profile.tsx` — investor views
  - `src/pages/farmer/` — farmer dashboard, operations, market, updates
  - `src/lib/auth.ts` — localStorage token helpers, KES formatter
  - `src/components/bottom-nav.tsx` — role-aware bottom nav
  - `src/components/sparkline.tsx` — Recharts sparkline component
- `artifacts/api-server/src/routes/` — Express API (auth, farms, market, portfolio, farmer)
- `lib/db/src/schema.ts` — Drizzle schema (users, farms, market_listings, investments, transactions, farm_updates)
- `lib/api-spec/src/openapi.yaml` — OpenAPI source of truth
- `lib/api-client-react/src/generated/api.ts` — Generated React Query hooks
- `lib/api-zod/src/generated/api.ts` — Generated Zod schemas

## Architecture decisions

- Contract-first: OpenAPI spec → generated Zod validators (server) + React Query hooks (client)
- Auth: bcrypt password hashing, Base64 pseudo-JWT stored in localStorage; `setAuthTokenGetter` wires the token into all API calls
- Role-based routing: `AuthGuard` redirects farmers to `/farmer/*`, investors to `/market/*`
- All monetary values in KES (Kenya Shillings)
- Orval zod config uses `mode: "single"` (outputs a single `generated/api.ts`, no schemas folder) — do NOT re-run codegen without checking this config

## Product

- **Onboarding**: 3-slide animated splash with real farm data previews
- **Farmers**: List farms for investment, track funding progress, post field updates, view earnings
- **Investors**: Browse live market with sparklines + price ticker, buy shares (primary/secondary), manage portfolio, request exit (Wide Season 30-60d or Full Season ~6mo), view transaction history
- **Demo accounts**: `john.farmer@investafarm.com` / `password123` (farmer), `david.investor@investafarm.com` / `password123` (investor)

## Deploying to Production

### Option A — Railway (Recommended, full stack in one place)

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Railway auto-detects `railway.toml` — set these environment variables in the Railway dashboard:
   ```
   DATABASE_URL=<your PostgreSQL URL>
   SESSION_SECRET=<long random string>
   GOOGLE_SMTP_USER=mosesochiengopiyo@gmail.com
   GOOGLE_SMTP_PASS=<gmail app password>
   ADMIN_EMAIL=mosesochiengopiyo@gmail.com
   ADMIN_PASSWORD=<secure password>
   PAYSTACK_SECRET_KEY=sk_live_...
   PAYSTACK_PUBLIC_KEY=pk_live_...
   GROQ_API_KEY=...
   PORT=8080
   NODE_ENV=production
   ```
4. Add a PostgreSQL plugin in Railway (auto-sets DATABASE_URL)
5. Your API will be live at `https://your-app.railway.app`

### Option B — Vercel (Frontend) + Railway (Backend)

**Backend on Railway** (same as Option A steps 2-5 above)

**Frontend on Vercel:**
1. Go to [vercel.com](https://vercel.com) → New Project → Import GitHub repo
2. Vercel auto-detects `vercel.json`. Set these build environment variables:
   ```
   PORT=3000
   BASE_PATH=/
   NODE_ENV=production
   ```
3. In `vercel.json`, update the rewrites to proxy `/api/*` to your Railway backend:
   ```json
   { "source": "/api/(.*)", "destination": "https://YOUR-RAILWAY-URL.railway.app/api/$1" }
   ```
   Then add: `{ "source": "/(.*)", "destination": "/index.html" }`
4. Deploy → frontend live at `https://your-app.vercel.app`

### Notes
- See `.env.example` for all required environment variables
- Run `pnpm --filter @workspace/db run push` on first deploy to create DB tables
- Demo seed runs automatically on server start
- Gmail App Password: myaccount.google.com → Security → 2-Step Verification → App Passwords

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

- Admin email / SMTP user / notification recipient: `mosesochiengopiyo@gmail.com`

## Gotchas

- Do NOT re-run `pnpm --filter @workspace/api-spec run codegen` without verifying the orval zod config stays as `mode: "single"` targeting `generated/api.ts`
- `lib/api-zod/src/index.ts` must only export from `./generated/api` (no types re-export)
- bcrypt is in `onlyBuiltDependencies` in pnpm-workspace.yaml
- API route for top movers is `/api/market/movers` (not `/top-movers`)
- All API routes must handle the full base path — the proxy doesn't rewrite paths

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
