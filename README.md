# Investa Farm 🌾

Africa's leading farm investment platform — a mobile-first PWA where farmers raise capital by listing farm shares (like a stock exchange) and investors buy, trade, and earn harvest returns.

## What It Does

- **Farmers** list their farm, set a funding target, upload KYC docs, and attract investors
- **Investors** browse live farm listings, buy fractional shares, track portfolio returns, and request exits
- **Cooperatives / Agribusinesses** manage farmer groups, input orders, and co-financing
- **AI Assistant** helps users understand investments and farm economics via Groq LLM
- **Paystack** integration handles wallet top-ups and payouts (M-Pesa / card)
- **Email notifications** for OTP verification, KYC approvals, and weekly opportunity digests

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS v4, Wouter, TanStack Query, Framer Motion, Recharts |
| Backend | Node.js 24, Express 5, Pino logging, node-cron |
| Database | PostgreSQL, Drizzle ORM |
| Validation | Zod, OpenAPI spec → Orval codegen |
| Auth | Custom bcrypt + Base64 token (email + OTP verification) |
| Push notifications | Web Push (VAPID) |
| AI | Groq (llama3-8b-8192) |
| Payments | Paystack |
| Email | Gmail SMTP via Nodemailer |

## Project Structure

```
investa-farm/                  ← monorepo root (pnpm workspaces)
├── artifacts/
│   ├── api-server/            ← Express backend (port 8080)
│   └── investa-farm/          ← React PWA frontend (port 5000)
├── lib/
│   ├── db/                    ← Drizzle schema + migrations
│   ├── api-spec/              ← OpenAPI source of truth
│   ├── api-client-react/      ← Generated TanStack Query hooks
│   └── api-zod/               ← Generated Zod validators
└── scripts/
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL database

### 1. Clone & install

```bash
git clone <repo-url>
cd investa-farm
pnpm install
```

### 2. Set environment variables

Copy `.env` to your environment (or set in your host's secrets manager):

```bash
cp .env .env.local   # then fill in real values
```

Key variables (see `.env` for the full list):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Long random string for session signing |
| `GROQ_API_KEY` | Groq API key for the AI assistant |
| `PAYSTACK_SECRET_KEY` | Paystack secret key for payments |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `GOOGLE_SMTP_USER` | Gmail address for sending emails |
| `GOOGLE_SMTP_PASS` | Gmail App Password (not your login password) |
| `ADMIN_EMAIL` | Admin account email |
| `ADMIN_PASSWORD` | Admin account password |

### 3. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

### 4. Run in development

```bash
# Start both servers (API on :8080, frontend on :5000)
pnpm --filter @workspace/api-server run dev &
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/investa-farm run dev
```

Or use the Replit Run button (configured in `.replit`).

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Farmer | `john.farmer@investafarm.com` | `password123` |
| Investor | `david.investor@investafarm.com` | `password123` |
| Farmer (demo) | `demo.farmer@investafarm.com` | `password123` |
| Investor (demo) | `demo.investor@investafarm.com` | `password123` |
| Cooperative | `demo.coop@investafarm.com` | `password123` |
| Admin | `admin@investafarm.com` | `password123` |

## Useful Commands

```bash
pnpm run typecheck                          # Full typecheck across all packages
pnpm run build                              # Typecheck + build all packages
pnpm --filter @workspace/api-spec run codegen  # Regenerate API hooks from OpenAPI spec
pnpm --filter @workspace/db run push       # Push DB schema changes (dev only)
pnpm --filter @workspace/api-server run build  # Build API server bundle
```

## What Could Be Added Next

| Feature | Description |
|---------|-------------|
| **SMS OTP** | Replace/augment email OTP with M-Pesa SMS via Africa's Talking or Twilio |
| **In-app chat** | Farmer ↔ investor messaging for deal negotiation |
| **Harvest payout automation** | Cron job that auto-calculates and distributes returns at season end |
| **Secondary market orders** | Limit/market orders with an order book for share trading |
| **Farm analytics dashboard** | Weather data, soil moisture, and satellite imagery overlays |
| **Mobile app (Expo)** | Native iOS/Android build using the same API |
| **Push digest** | Daily/weekly push notifications for new farm listings |
| **Co-operative onboarding flow** | Group registration with bulk KYC and loan pooling |
| **Stripe / PayPal** | Additional payment rails for diaspora investors |
| **Multi-language support** | Swahili + English toggle |

## Deploying to Production

### Option A — Replit Deployments (Recommended)

Click **Deploy** in the Replit header. Replit will:
- Build the frontend and API server
- Provision a production PostgreSQL database
- Apply the schema diff automatically
- Serve under your `.replit.app` domain

Set production secrets in the Replit Secrets tab before deploying.

### Option B — Railway (Full-stack)

1. Push to GitHub
2. Railway → New Project → Deploy from GitHub
3. Add env vars from `.env` in the Railway dashboard
4. Add PostgreSQL plugin (auto-sets `DATABASE_URL`)
5. Railway uses `railway.toml` automatically

### Option C — Vercel (Frontend) + Railway (Backend)

- Backend: Railway as above
- Frontend: Vercel imports `vercel.json`; set `PORT=3000`, `BASE_PATH=/`, `NODE_ENV=production`
- Update `vercel.json` rewrites to proxy `/api/*` → your Railway URL

## Architecture Notes

- **Contract-first API**: OpenAPI `openapi.yaml` is the single source of truth. Run codegen after any schema change.
- **Auth**: bcrypt password hashing + Base64 pseudo-JWT stored in `localStorage`. Email OTP for verification.
- **Role routing**: `AuthGuard` redirects farmers → `/farmer/*`, investors → `/market/*`, cooperatives → `/cooperative/*`
- **All currency in KES** (Kenya Shillings)
- **Seed data** runs automatically on server start (idempotent — skips existing records)

## Gmail App Password Setup

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Security → 2-Step Verification → App Passwords
3. Create an app password for "Mail"
4. Use that 16-character code as `GOOGLE_SMTP_PASS`
