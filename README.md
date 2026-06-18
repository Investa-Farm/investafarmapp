# Investa Farm 🌾

Africa's leading farm investment platform — a mobile-first PWA where farmers raise capital by listing farm shares and investors buy, trade, and earn harvest returns. Built for Kenya, priced in KES.

[![Deploy on Railway](https://img.shields.io/badge/Deploy-Railway-blueviolet?logo=railway)](https://railway.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## What It Does

| Role | What they do |
|------|-------------|
| **Farmers** | Register a group, list their farm for investment, upload KYC docs, apply for funding, post field updates, and track earnings |
| **Investors** | Browse live farm listings with AI insights, buy fractional shares, manage a portfolio, and request exits at harvest |
| **Cooperatives / Agribusinesses** | Manage farmer groups, source agri-inputs, view network analytics |
| **Admins** | Approve KYC, manage payouts, trigger dividends, view platform analytics |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS v4, Wouter, TanStack Query, Framer Motion, Recharts |
| Backend | Node.js 24, Express 5, Pino logging, node-cron |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod, OpenAPI spec → Orval codegen |
| Auth | bcrypt + Base64 pseudo-JWT, email OTP verification |
| Push | Web Push (VAPID) |
| AI | Groq (llama-3.3-70b-versatile) |
| Payments | Paystack (M-Pesa / card) |
| Email | Resend / Gmail SMTP |

---

## Project Structure

```
investa-farm/                  ← monorepo root (pnpm workspaces)
├── artifacts/
│   ├── api-server/            ← Express backend (port 8080)
│   │   └── src/
│   │       ├── routes/        ← auth, farms, market, wallet, portfolio, farmer, admin …
│   │       └── lib/           ← security.ts, email.ts, stellar.ts, rainfall.ts, roi.ts
│   └── investa-farm/          ← React PWA frontend (port 5000)
│       └── src/
│           ├── pages/         ← market/, farmer/, agribusiness/, admin pages
│           └── components/    ← invest-modal, wallet-modal, kyc-modal, ai-assistant …
├── lib/
│   ├── db/                    ← Drizzle schema + migrations
│   ├── api-spec/              ← OpenAPI source of truth (openapi.yaml)
│   ├── api-client-react/      ← Generated TanStack Query hooks
│   └── api-zod/               ← Generated Zod validators
└── scripts/
```

---

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

### 2. Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Long random string for session signing |
| `GROQ_API_KEY` | Groq API key for AI features |
| `PAYSTACK_SECRET_KEY` | Paystack secret key |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `GOOGLE_SMTP_USER` | Gmail address for sending emails |
| `GOOGLE_SMTP_PASS` | Gmail App Password (not your login password) |
| `ADMIN_EMAIL` | Initial admin account email |
| `ADMIN_PASSWORD` | Initial admin account password |
| `VAPID_PUBLIC_KEY` | Web push VAPID public key |
| `VAPID_PRIVATE_KEY` | Web push VAPID private key |
| `STELLAR_ISSUER_SECRET_KEY` | Stellar custodial wallet issuer secret (XDR format secret starting with `S…`) |
| `STELLAR_NETWORK` | `testnet` (default) or `mainnet` |
| `CIRCLE_API_KEY` | Circle developer API key for stablecoin wallet ops (format: `uuid:secret`) |
| `KYC_ADMIN_PASSWORD` | Password for the KYC-only sub-admin login |
| `ALLOWED_ORIGINS` | CORS allowed origins (e.g. `https://your-app.replit.app`) |

Optional (news / additional AI sources):

| Variable | Description |
|----------|-------------|
| `GNEWS_API_KEY` | GNews API key |
| `CURRENTS_API_KEY` | Currents API key |
| `THENEWSAPI_TOKEN` | TheNewsAPI token |
| `MEDIASTACK_API_KEY` | Mediastack access key |

### 3. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

### 4. Run in development

```bash
bash start.sh   # API on :8080, frontend on :5000
```

Or press **Run** in Replit — it uses `start.sh` automatically.

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Farmer | `john.farmer@investafarm.com` | `password123` |
| Investor | `david.investor@investafarm.com` | `password123` |
| Admin | set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — |

> **Note:** Demo accounts display curated sample data (hardcoded ticker, buyer offers, demand charts). Real registered users see only live database data.

---

## Key Commands

```bash
pnpm run typecheck                             # Full typecheck across all packages
pnpm run build                                 # Typecheck + build all packages
pnpm --filter @workspace/api-spec run codegen  # Regenerate API hooks from OpenAPI spec
pnpm --filter @workspace/db run push           # Push DB schema changes (dev only)
pnpm --filter @workspace/api-server run build  # Build API server bundle only
```

---

## Security

The platform ships with a production-ready security layer:

| Feature | Detail |
|---------|--------|
| **Rate limiting** | Global 200 req/min · Auth 10/15 min · Financial 20/min · AI 15/min |
| **Account lockout** | Progressive: 3 fails → 5 min, 6 fails → 1 hr, 10 fails → 24 hr |
| **Velocity caps** | Per-user daily limits on deposits, withdrawals, and investments |
| **Security headers** | X-Frame-Options, CSP, HSTS, X-Content-Type-Options on every response |
| **Input sanitisation** | XSS stripping, null-byte removal, JS-protocol injection prevention |
| **Bot detection** | Headless-browser and automation UA blocking on write endpoints |
| **Payload guard** | Requests over 512 KB rejected before parsing |
| **Enum prevention** | Constant-time responses for unknown email addresses |

---

## Architecture Notes

- **Contract-first API** — `lib/api-spec/src/openapi.yaml` is the single source of truth. Run codegen after any schema change. Do NOT re-run without verifying `mode: "single"` in the Orval config — output must target `generated/api.ts`.
- **Auth** — bcrypt password hashing + Base64 pseudo-JWT in `localStorage`. Email OTP required before first login.
- **Role routing** — `AuthGuard` redirects: `farmer → /farmer/*`, `investor → /market/*`, `cooperative → /cooperative/*`.
- **Currency** — All monetary values stored and displayed in KES. Users can switch display currency via `CurrencyProvider`.
- **Demo vs. real users** — Hardcoded sample data is gated behind `isDemoAccount()`. Real registered users see only live data.
- **Seed data** — Demo accounts are inserted idempotently on every server start.

---

## Deploying to Production

### Railway (recommended — single service)

`railway.toml` is pre-configured. Steps:

1. Push code to GitHub
2. Railway → New Project → Deploy from GitHub repo
3. Add a **PostgreSQL** plugin (auto-sets `DATABASE_URL`)
4. In **Variables**, add all env vars from the table above
5. Deploy — live at `https://your-app.railway.app`

> Do NOT set `VITE_API_URL` — frontend and backend share the same origin on Railway.

### Replit Deployments

Click **Deploy** in the Replit header. Replit builds, provisions PostgreSQL, and serves under your `.replit.app` domain. Set all secrets in the Replit Secrets panel first.

---

## Gmail App Password Setup

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Security → 2-Step Verification → App Passwords
3. Create an app password for "Mail"
4. Use the 16-character code as `GOOGLE_SMTP_PASS`

---

## Roadmap Ideas

| Feature | Description |
|---------|-------------|
| SMS OTP | Augment email OTP with M-Pesa SMS via Africa's Talking |
| In-app chat | Farmer ↔ investor messaging for deal negotiation |
| Mobile app | Native iOS/Android via Expo using the same API |
| Multi-language | Swahili + English toggle |
| Insurance module | Crop insurance integration with APA Insurance |
| Carbon credits | Track and monetise sequestration per farm |
| Stripe / PayPal | Additional payment rails for diaspora investors |
