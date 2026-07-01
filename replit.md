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
- **Agribusinesses / Sales Agents / Offtakers**: Separate KYC flow with business registration, ID, selfie, and financial statements
- **Demo accounts**: `john.kamau.farm@gmail.com` / `password123` (farmer), `david.mwangi.inv@gmail.com` / `password123` (investor)

## Investment Math

### Primary Market — Share Purchase
```
Share price (P₀) = Farm loan amount / Total shares listed
Platform fee     = 1.5% of (P₀ × quantity)
Total cost       = (P₀ × quantity) + platform_fee
```

### Mid-Season Exit (Secondary Market Sale)
```
P_sell          = P₀ × (1 + 0.10) × demand_factor     # ~10% gain in 30–60 days
Trade fee       = 0.5% of proceeds
Net proceeds    = (Q × P_sell) × (1 − 0.005)
ROI             = (Net proceeds − Cost) / Cost × 100   # ≈ +9.5% in ~45 days
Annualised ROI  = ((1.10)^(365/45) − 1) × 100          # ≈ 120% p.a.
```

### Full-Season Exit (Harvest Dividend)
```
Farm revenue    = LoanAmount × 1.40                    # 40% revenue multiplier
InvestorShare   = Revenue × α       (α = 0.65, investor allocation factor)
Payout/share    = InvestorShare / TotalShares
Investor return = Q × Payout/share
ROI             = (Return − Cost) / Cost × 100         # ≈ +28% in ~6 months
Annualised ROI  = ((1.28)^(365/180) − 1) × 100         # ≈ 62% p.a.
```

### DCF Fair Value (current share price on market)
```
IntrinsicValue  = (FarmRevenue × α) / (1 + r)^t
r               = 0.105 (10.5% discount rate, Kenya risk-free + premium)
t               = days_to_harvest / 365
```
> The portfolio display floors effective price at 98% of purchase price so DCF discounting never
> shows a misleading immediate loss on newly-purchased shares.

### What-If Scenario Modelling
```
revenueMultiplier = 1 + (rainfallDelta × cropSensitivity) + priceDelta
adjustedROI       = BASE_ROI × revenueMultiplier          # BASE_ROI = 28%
adjustedPayout    = cost × (1 + adjustedROI)
```
Example crops sensitivity: rice=0.80 (high rainfall dependency), dairy=0.20 (low), maize=0.60.

## UX Details

- **Email links**: All transactional email links point to `https://app.investafarm.com`
- **News cards**: Tap any news headline or card to open the full article in a new tab directly (no expand step)
- **Insufficient funds**: "Go to Wallet" button in the invest modal closes the sheet and navigates to `/wallet`
- **Farm cards (primary)**: Expanded card shows location + shares remaining badge, funding progress bar (% funded + remaining/total shares), min-investment pill, currency-aware price/ROI figures that follow the user's currency setting (KES/USD/etc.)
- **KYC banner (investor profile)**: Three states — *Upload KYC* (orange) when no docs uploaded; *Documents Under Review* (blue) when all docs submitted but not yet approved; banner disappears entirely once verified. KYC menu item badge also reflects all three states
- **KYC upload popup**: Shows an animated "Document Submitted / Under Review" success screen for ~1.4s before auto-closing
- **Phone country code**: All phone fields (farmer register, cooperative register, wallet withdrawal) have a flag + dial-code dropdown defaulting to 🇰🇪 +254, covering KE/TZ/UG/RW/ET/ZA/NG/GB/US/AE
- **Portfolio holdings**: 4-column stats (Shares / Invested / Value / P&L); mid-season + full-season payout both show per-share sell price; all amounts respect the active currency setting
- **Admin dashboard**: Secondary tabs (Transactions, Farms, Payouts, Settings) live in a "More ···" footer sheet instead of a Row 2 nav — keeps the primary nav uncluttered
- **Admin sub-admin KYC login**: POST `/api/admin/login-kyc` with `KYC_ADMIN_PASSWORD` env var returns a kyc-admin-session token; dashboard auto-detects it and restricts UI to the KYC tab only
- **Brevo SMS on signup**: If user registers with a `phone` field, a welcome SMS and OTP SMS are sent via Brevo (requires `BREVO_API_KEY`)

## Deploying to Production

### Render (Single web service — frontend + backend on one service)

The `render.yaml` is pre-configured. Render will:
- Build the React frontend → `artifacts/investa-farm/dist/public`
- Build the API server → `artifacts/api-server/dist/index.mjs`
- Push the DB schema automatically during build (if `DATABASE_URL` is set)
- Serve both from the same Express process on port 8080

**Steps:**
1. Push your code to GitHub
2. Go to [render.com](https://render.com) → New → **Blueprint** → connect your GitHub repo (Render reads `render.yaml` automatically)
3. In the Render dashboard → your service → **Environment**, add the secrets marked `sync: false`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Postgres connection string (e.g. from Render PostgreSQL add-on or Neon) |
| `SESSION_SECRET` | Any long random string (e.g. `openssl rand -hex 32`) |
| `ADMIN_EMAIL` | `mosesochiengopiyo@gmail.com` |
| `ADMIN_PASSWORD` | Secure admin password |
| `GOOGLE_SMTP_USER` | `mosesochiengopiyo@gmail.com` |
| `GOOGLE_SMTP_PASS` | Gmail App Password (see below) |
| `RESEND_API_KEY` | Resend API key (alternative to Gmail SMTP) |
| `PAYSTACK_SECRET_KEY` | `sk_live_...` from Paystack dashboard → [paystack.com](https://dashboard.paystack.com/#/settings/developer) — M-Pesa STK push only |
| `PAYSTACK_PUBLIC_KEY` | `pk_live_...` from Paystack dashboard → Settings → API Keys & Webhooks |
| `STRIPE_SECRET_KEY` | `sk_live_...` from [Stripe dashboard](https://dashboard.stripe.com/apikeys) → API keys → Secret key |
| `STRIPE_PUBLIC_KEY` | `pk_live_...` from [Stripe dashboard](https://dashboard.stripe.com/apikeys) → API keys → Publishable key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from Stripe dashboard → Developers → Webhooks → your endpoint → Signing secret |
| `CIRCLE_API_KEY` | `TEST_API_KEY:keyId:keySecret` from [console.circle.com](https://console.circle.com) → API Keys |
| `GROQ_API_KEY` | Groq API key from [console.groq.com](https://console.groq.com/keys) — AI farm insights + news |
| `VAPID_PRIVATE_KEY` | `W4d_A-f1wGaBtbH8nzrPGfCxTCqYkHo5AJxsJG0ssLU` |
| `STELLAR_ISSUER_SECRET_KEY` | Stellar issuer secret key for custodial wallets |
| `ALLOWED_ORIGINS` | Your Render app URL e.g. `https://investa-farm.onrender.com` |
| `BREVO_API_KEY` | (Optional) Brevo key for SMS OTP on signup → [brevo.com](https://app.brevo.com/settings/keys/api) |
| `KYC_ADMIN_PASSWORD` | (Optional) Password for sub-admin KYC-only login |
| `USDC_DEPOSIT_ADDRESS` | (Optional) Your Circle Polygon USDC receiving address — override the default |
| `SENTINEL_HUB_CLIENT_ID` | (Optional) Sentinel Hub OAuth client ID for real satellite NDVI tiles → [apps.sentinel-hub.com](https://apps.sentinel-hub.com/dashboard/) |
| `SENTINEL_HUB_CLIENT_SECRET` | (Optional) Sentinel Hub OAuth client secret (same dashboard) |

### Where to get each API key

| Service | Sign-up URL | What it does |
|---|---|---|
| **Paystack** | [paystack.com/signup](https://paystack.com/signup) | M-Pesa STK push in Kenya (KES) |
| **Stripe** | [dashboard.stripe.com](https://dashboard.stripe.com) | Card payments (Visa/Mastercard/Apple Pay) globally |
| **Circle** | [console.circle.com](https://console.circle.com) | USDC stablecoin deposits from crypto wallets |
| **Groq** | [console.groq.com](https://console.groq.com) | AI-powered farm insights, news summarisation |
| **Resend** | [resend.com](https://resend.com) | Transactional emails (welcome, OTP, dividends) |
| **Brevo** | [brevo.com](https://brevo.com) | SMS OTP on signup (optional) |
| **Sentinel Hub** | [apps.sentinel-hub.com](https://apps.sentinel-hub.com/dashboard/) | Free 30-day trial satellite NDVI imagery |
| **Stellar** | [stellar.org/developers](https://developers.stellar.org/) | Custodial wallets — use Testnet for development |

4. Already hardcoded in `render.yaml` (no action needed):
   - `NODE_ENV=production`, `PORT=8080`, `BASE_PATH=/`
   - `VAPID_PUBLIC_KEY`, `STELLAR_ISSUER_PUBLIC_KEY`, `GNEWS_API_KEY`, `MEDIASTACK_API_KEY`

5. Deploy → the whole app (UI + API) is live at `https://investa-farm.onrender.com`

**Notes:**
- Do NOT set `VITE_API_URL` — frontend and backend share the same origin
- DB schema push runs automatically during the build step (requires `DATABASE_URL`)
- Demo seed data (users, farms, listings) is created automatically on first server start
- Gmail App Password: myaccount.google.com → Security → 2-Step Verification → App Passwords
- If you use **Resend** for email, set `RESEND_API_KEY` and leave Gmail vars empty — the server auto-detects which to use
- Free-tier Render services sleep after inactivity; upgrade to "Starter" to keep it always-on

**Content Security Policy (CSP):**
The server applies two separate CSPs:
- `/api/*` routes → `default-src 'none'` (strict, JSON only)
- Frontend HTML + assets → permissive policy that allows self-hosted scripts, Google Fonts, and HTTPS images

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

- Admin email / SMTP user / notification recipient: `mosesochiengopiyo@gmail.com`

## Security Architecture

The platform has a multi-layer security posture:

### API Server (`artifacts/api-server/src/lib/security.ts`)
| Layer | What it does |
|---|---|
| **Security headers** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS (production), `Permissions-Policy` |
| **CSP** | `/api/*` → `default-src 'none'`; Frontend HTML → permissive self+Google Fonts |
| **Global rate limit** | 200 req/min per IP on all `/api/*` routes |
| **Auth rate limit** | 10 attempts / 15 min per IP on login/register/OTP endpoints |
| **Financial rate limit** | 20 req/min per user on buy/sell/deposit/withdraw |
| **AI rate limit** | 15 req/min per user on AI chat/explain endpoints |
| **Account lockout** | Progressive back-off: 3 failures → 5 min, 6 → 1 hr, 10 → 24 hr |
| **Transaction velocity** | Daily/hourly caps on investments, deposits, withdrawals (see `LIMITS`) |
| **Input sanitization** | HTML tags, null bytes, JS proto, dangerous attrs stripped from all req.body/query |
| **Bot detection** | Known bot UAs blocked on mutations; headless browser signals blocked; burst > 60 req/10s blocked |
| **Payload guard** | 512 KB max on all requests |
| **Nonce replay prevention** | `requireNonce` middleware blocks duplicate `X-Request-Nonce` headers within 5-min window |
| **Unauthorized tracker** | Monitors 401 rate per IP; logs credential-stuffing warnings at ≥ 20 hits |
| **Clone/bot detection** | Logs & blocks scrapers, zgrab, masscan, sqlmap, etc. |

### Frontend (`artifacts/investa-farm/src/`)
| Feature | Location |
|---|---|
| **Domain/clone guard** | `src/components/security-guard.tsx` — banner + console warning if hostname ≠ allowed list |
| **Console self-XSS warning** | Shown to every user at startup via `SecurityGuard` |
| **Error boundary** | `src/components/error-boundary.tsx` — catches React render errors, shows friendly recovery screen |
| **Token-based auth** | No cookies — JWT in localStorage, passed as `Authorization: Bearer` |

### Allowed origins for SecurityGuard
```
localhost, 127.0.0.1, app.investafarm.com, investa-farm.onrender.com
*.replit.dev, *.replit.app, *.repl.co, *.repl.run
```

## UX Features

| Feature | Details |
|---|---|
| **Pull-to-refresh** | Primary Market page — pull down from top to refresh listings |
| **Haptic feedback** | `src/lib/haptic.ts` — `haptic("light"|"medium"|"heavy"|"success"|"error")` wraps `navigator.vibrate()`; used in InvestModal confirm + error |
| **Pull-to-refresh indicator** | `src/components/pull-to-refresh-indicator.tsx` — animated arrow + status text |
| **Error boundary** | Catches and recovers from React render crashes without full page reload |

## Gotchas

- Do NOT re-run `pnpm --filter @workspace/api-spec run codegen` without verifying the orval zod config stays as `mode: "single"` targeting `generated/api.ts`
- `lib/api-zod/src/index.ts` must only export from `./generated/api` (no types re-export)
- bcrypt is in `onlyBuiltDependencies` in pnpm-workspace.yaml
- API route for top movers is `/api/market/movers` (not `/top-movers`)
- All API routes must handle the full base path — the proxy doesn't rewrite paths
- **CSS layer order**: `.app-shell` and all custom classes in `index.css` are wrapped in `@layer components` so Tailwind utility classes (e.g. `overflow-y-auto`) correctly override them. Do NOT move them outside `@layer components` or scroll will break on farm-detail.
- **Farm-detail scroll**: The outer div uses `overflow-y-auto h-screen` which only works because `.app-shell`'s `overflow: hidden` is now in `@layer components` (utilities override components in Tailwind v4).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
