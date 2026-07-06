# Investa Farm 🌾

Africa's leading farm investment platform — a mobile-first PWA where farmers raise capital by listing farm shares and investors buy, trade, and earn harvest returns. Built for Kenya, priced in KES. Hosted on Replit.

---

## What It Does

| Role | What they do |
|------|-------------|
| **Farmers** | Register, list their farm for investment, upload KYC docs, post field updates, and track earnings |
| **Investors** | Browse live farm listings with AI insights, buy fractional shares, manage a portfolio, and request exits at harvest |
| **Cooperatives / Agribusinesses** | Manage farmer groups, source agri-inputs, view network analytics |
| **Admins** | Approve KYC, manage payouts, trigger dividends, view platform analytics |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS v4, Wouter, TanStack Query, Framer Motion, Recharts |
| Backend | Node.js 24, Express 5, Pino logging, node-cron |
| Database | PostgreSQL + Drizzle ORM (Replit managed) |
| Validation | Zod, OpenAPI spec → Orval codegen |
| Auth | bcrypt + Base64 pseudo-JWT, email OTP verification |
| Push | Web Push (VAPID) |
| AI | Groq (llama-3.3-70b-versatile) — farm insights, sentiment, yield prediction |
| Payments | Stripe (card + M-Pesa), Paystack (M-Pesa STK push), Circle (USDC) |
| Email | Resend / Gmail SMTP |
| Blockchain | Stellar SDK (custodial wallets, tokenised farm shares) |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
investa-farm/                  ← monorepo root (pnpm workspaces)
├── artifacts/
│   ├── api-server/            ← Express backend (port 8080)
│   │   └── src/
│   │       ├── routes/        ← auth, farms, market, wallet, portfolio, farmer, admin …
│   │       └── lib/           ← stripe.ts, paystack.ts, circle.ts, email.ts, stellar.ts, push.ts, security.ts
│   └── investa-farm/          ← React PWA frontend (port 5000 via proxy)
│       └── src/
│           ├── pages/         ← market/, farmer/, agribusiness/, admin/, portfolio.tsx, wallet.tsx …
│           └── components/    ← invest-modal, wallet-modal, kyc-modal, ai-assistant, sparkline …
├── lib/
│   ├── db/                    ← Drizzle schema (users, farms, investments, wallet, transactions …)
│   ├── api-spec/              ← OpenAPI source of truth (openapi.yaml)
│   ├── api-client-react/      ← Generated TanStack Query hooks
│   └── api-zod/               ← Generated Zod validators
└── scripts/
```

---

## Running on Replit

Press **Run** — Replit starts both servers via `start.sh`:

- API server → `http://localhost:8080`
- React frontend → `http://localhost:5000` (proxies `/api` and `/uploads` to `:8080`)

The frontend is visible in the preview pane on port **80** (mapped from 5000).

---

## Environment Variables & Secrets

Set these in the **Replit Secrets** panel (padlock icon). Never paste them in code.

### Required

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Replit DB integration) |
| `SESSION_SECRET` | Long random string for session signing |
| `ADMIN_EMAIL` | Email for the initial admin account |
| `ADMIN_PASSWORD` | Password for the initial admin account |

### Payments

| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_…` or `sk_live_…` — enables card deposits |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` — validates Stripe webhook events (optional but recommended) |
| `PAYSTACK_SECRET_KEY` | Paystack secret key — enables M-Pesa STK push |
| `CIRCLE_API_KEY` | Circle developer key — enables USDC deposits |

### AI & Comms

| Secret | Description |
|--------|-------------|
| `GROQ_API_KEY` | Groq key for AI farm insights, news summarisation |
| `GOOGLE_SMTP_USER` | Gmail address for sending emails |
| `GOOGLE_SMTP_PASS` | Gmail App Password (16-char code, not your login password) |
| `RESEND_API_KEY` | Alternative to Gmail SMTP — Resend transactional email |
| `BREVO_API_KEY` | (Optional) Brevo SMS OTP on signup |
| `VAPID_PRIVATE_KEY` | Web Push private key |

### Blockchain

| Secret | Description |
|--------|-------------|
| `STELLAR_ISSUER_SECRET_KEY` | Stellar issuer secret for custodial wallets (starts with `S…`) |

### Non-sensitive config (already set in `.replit`)

| Variable | Value |
|----------|-------|
| `PORT` | `8080` |
| `NODE_ENV` | `development` |
| `BASE_PATH` | `/` |
| `VAPID_PUBLIC_KEY` | Pre-set VAPID public key |
| `STELLAR_ISSUER_PUBLIC_KEY` | Pre-set Stellar issuer public key |
| `STRIPE_PUBLIC_KEY` | Your Stripe publishable key (`pk_test_…` / `pk_live_…`) |
| `ALLOWED_ORIGINS` | Replit dev + prod domains |

---

## How Stripe Deposits Work

1. Frontend calls `POST /api/wallet/stripe/create-intent` → gets a `clientSecret`
2. User completes the card payment in the Stripe Elements UI
3. Frontend calls `POST /api/wallet/stripe/confirm` with the `intentId`
4. Server verifies the PaymentIntent status with Stripe → credits the user's wallet
5. *(Backup)* Stripe fires `payment_intent.succeeded` to `POST /api/wallet/stripe/webhook` → server credits wallet automatically (idempotent — safe if both run)

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Farmer | `john.farmer@investafarm.com` | `password123` |
| Investor | `david.investor@investafarm.com` | `password123` |
| Admin | value of `ADMIN_EMAIL` secret | value of `ADMIN_PASSWORD` secret |

> Demo accounts display curated sample data. Real registered users see only live database data.

---

## Key Commands

```bash
pnpm run typecheck                             # Full typecheck across all packages
pnpm run build                                 # Typecheck + build all packages
pnpm --filter @workspace/api-spec run codegen  # Regenerate API hooks from OpenAPI spec
pnpm --filter @workspace/db run push           # Push DB schema changes (dev only)
pnpm --filter @workspace/api-server run build  # Build API server bundle only
bash start.sh                                  # Start both servers locally
```

---

## Security

| Feature | Detail |
|---------|--------|
| **Rate limiting** | Global 200 req/min · Auth 10/15 min · Financial 20/min · AI 15/min |
| **Account lockout** | Progressive: 3 fails → 5 min, 6 fails → 1 hr, 10 fails → 24 hr |
| **Velocity caps** | Per-user daily limits on deposits, withdrawals, and investments |
| **Security headers** | X-Frame-Options, CSP, HSTS, X-Content-Type-Options on every response |
| **Input sanitisation** | XSS stripping, null-byte removal, JS-protocol injection prevention |
| **Webhook verification** | Stripe signature verified via `stripe-signature` header; Paystack via HMAC-SHA512 |
| **Payload guard** | Requests over 512 KB rejected before parsing |

---

## Architecture Notes

- **Contract-first API** — `lib/api-spec/src/openapi.yaml` is the single source of truth. Run codegen after any schema change. Do NOT re-run without verifying `mode: "single"` in the Orval config.
- **Auth** — bcrypt password hashing + Base64 pseudo-JWT in `localStorage`. Email OTP required before first login.
- **Role routing** — `AuthGuard` redirects: `farmer → /farmer/*`, `investor → /market/*`, `cooperative → /cooperative/*`.
- **Currency** — All values stored in KES. Users can switch display currency via `CurrencyProvider`.
- **Wallet idempotency** — Every credit operation checks the `reference` field first — duplicate webhook/confirm calls are safely ignored.

---

## Deploying to Production

Click **Deploy** in Replit. Replit builds the frontend, bundles the API server, and serves everything under your `.replit.app` domain. Make sure all secrets are set before deploying.

Build command (runs automatically):
```bash
pnpm install && PORT=5000 BASE_PATH=/ pnpm --filter @workspace/investa-farm run build && pnpm --filter @workspace/api-server run build
```

Start command (production):
```bash
NODE_ENV=production node --enable-source-maps artifacts/api-server/dist/index.mjs
```

> The Express server serves the built React SPA from `artifacts/investa-farm/dist/public` in production, so no separate Vite server is needed.
