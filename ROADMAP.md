# Investa Farm — Roadmap

This document outlines what's built, what's in progress, and what's planned. Keep it updated as features ship.

---

## ✅ Shipped

### Platform Core
- [x] Farmer registration, login, and role-based routing
- [x] Investor registration, login, and role-based routing
- [x] Admin dashboard with KYC review, farm management, payout controls
- [x] Email OTP verification with 7-day grace period
- [x] JWT authentication with progressive lockout and rate limiting
- [x] Multi-tiered rate limiting (global / auth / financial / AI-specific)
- [x] TOTP (2FA) support for farmers

### Farmer Side
- [x] Farmer dashboard with loans, farms, wallet, and group overview
- [x] Full loan application flow with cost breakdown and crop proposal
- [x] AI-powered loan scoring (Groq)
- [x] Credit tier system (Bronze / Silver / Gold) based on repayment history
- [x] KYC document upload and approval workflow
- [x] Agribusiness voucher system (disbursed loans unlock supplier vouchers)
- [x] Farm growth stage reporting (planting → growing → harvest)
- [x] Farmer operations hub (supply orders, task tracker, farm diary)
- [x] Cooperative group formation and management
- [x] Farmer market (connect with buyers and offtakers)
- [x] Farmer wallet (top-up, withdraw, loan repayment)
- [x] Rainfall alerts and crop health monitoring
- [x] In-app news feed and AI news bot
- [x] Web push notifications (PWA, VAPID)
- [x] Loan quick-pay from wallet balance

### Investor Side
- [x] Primary market (fund farms directly)
- [x] Secondary market (buy/sell existing farm shares)
- [x] Live market ticker with DCF-based dynamic pricing engine
- [x] Farm detail pages with investment, risk score, and growth stage data
- [x] Order book matching (buy/sell orders)
- [x] Portfolio summary with ROI tracking
- [x] AI portfolio manager
- [x] Community portfolios (view peer allocations)
- [x] Investor wallet with Paystack top-up
- [x] Dividend reinvestment options
- [x] Farm watchlist
- [x] Syndicate investing (group investment pools)

### Infrastructure
- [x] pnpm monorepo with TypeScript project references
- [x] Orval codegen (OpenAPI → React Query hooks + Zod schemas)
- [x] Drizzle ORM with Neon PostgreSQL
- [x] Express 5 API with structured pino logging
- [x] Background scheduler (price simulation, dividend payouts, rainfall alerts)
- [x] Deployed on Render with `start.sh` entry point
- [x] PWA manifest, service worker, install prompt

---

## 🚧 In Progress

- [ ] **M-Pesa Daraja integration** — STK Push for mobile top-up (route scaffolded in `routes/mpesa.ts`, not yet wired to real Daraja API)
- [ ] **Circle USDC payments** — stablecoin investment flow (`lib/circle.ts` exists, not in production)
- [ ] **Stellar blockchain asset issuance** — farm shares as Stellar assets (`lib/stellar.ts` exists, experimental)
- [ ] **Full loan repayment schedule** — amortisation schedule UI; server logic exists but frontend incomplete
- [ ] **Admin loan disbursement flow** — admin can approve but manual disbursement step is missing
- [ ] **Offtaker dashboard** — page scaffolded, data layer incomplete
- [ ] **Sales agent dashboard** — page scaffolded, data layer incomplete

---

## 📋 Planned

### Near-term (next 1–2 sprints)
- [ ] Automated DB schema migration on deploy (run drizzle push in `start.sh` before server boots)
- [ ] CI/CD GitHub Actions — run `pnpm run typecheck && pnpm run build` on every PR
- [ ] Push schema sync: add migration guard so new columns always reach production automatically
- [ ] Farmer loan repayment schedule UI (calendar view of due dates)
- [ ] Email notifications for key events (loan approved, share sold, dividend paid)
- [ ] Admin bulk KYC review (approve multiple docs in one action)

### Medium-term
- [ ] Real M-Pesa STK Push integration (Safaricom Daraja API)
- [ ] Real-time order matching notifications (push + in-app)
- [ ] Farm satellite imagery integration (crop health via NDVI)
- [ ] Loan insurance product (partner with an insurer, offer opt-in coverage)
- [ ] Cooperative governance voting (members vote on group loans)
- [ ] Secondary market price history charts (30d / 90d / 1y)
- [ ] Tax statement download (capital gains, dividends — PDF export)

### Long-term
- [ ] Stellar-backed farm share tokenisation (regulatory-compliant)
- [ ] Cross-border investor onboarding (KYC for non-Kenya investors)
- [ ] USSD interface for farmers with feature phones (M-Pesa-style menu)
- [ ] Agri-credit bureau reporting (repayment history to credit bureaus)
- [ ] Offline PWA support (service worker caching for dashboard data)

---

## ⚠️ Known Gaps & Tech Debt

See [BUGS.md](./BUGS.md) for active bugs.

| Area | Gap | Priority |
|------|-----|----------|
| DB migrations | Schema changes require manual `drizzle push` against production | High |
| Loan disbursement | Admin approval doesn't auto-trigger fund transfer | High |
| M-Pesa | STK Push is mocked / not wired to Daraja | High |
| Error monitoring | No Sentry or equivalent — errors only visible in Render logs | Medium |
| Test coverage | No automated tests (unit or e2e) | Medium |
| Stellar/Circle | Payment integrations exist in code but are not production-ready | Low |
| USSD | No feature-phone fallback for rural farmers | Low |
