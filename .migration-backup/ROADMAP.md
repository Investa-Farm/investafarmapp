# Roadmap

A snapshot of what's built vs. what's left, based on a full audit of the codebase on July 6, 2026.
See `replit.md` for the full feature/architecture reference and `BUGS.md` for known issues.

## ✅ Already built (end-to-end, working)

- Onboarding (3-slide splash) + role-based app tour (screenshot-based `AppTour` + new spotlight-style
  `SpotlightTour` highlighting real UI elements)
- Investor: primary/secondary markets, order book, buy/sell shares, portfolio, wallet, KYC, referrals,
  price alerts, watchlist, reinvestment automation, DCF fair-value pricing, dividends
- Farmer: register → KYC → loan application/contract → funding → operations/updates → harvest payout → wallet
- Admin: users, KYC review, transactions, farms, payouts, settings, fraud flags, broadcast messages, support tickets
- Agribusiness / Cooperative / Sales Agent / Offtaker: dedicated KYC + dashboards
- Wealth / Fund manager: portfolio dashboard (client allocation currently local-only, see below)
- Syndicates (pooled group investing), Crop Bets (prediction market), Community Portfolios (copy/mirror investing)
- Stellar custodial wallets, weather/NDVI monitoring, AI chat + farm insights (Groq, with fallback), live news +
  sentiment feed, web push notifications, referral program

## 🚧 Partial / needs finishing

1. **Fund manager client allocations** — currently persisted in `localStorage` on the client, not the database.
   Needs a `fund_client_allocations` (or similar) table + API so a fund manager's client list survives
   across devices/browsers and can be audited by admin.
2. **Cooperative/Agribusiness bulk settlement** — procurement flows exist, but the transactional handoff between
   a cooperative's bulk order and individual farmer settlement is light on verification (no reconciliation record
   tying a bulk payment to which farmers/how much each received).
3. **"Use farm holdings as collateral"** — listed in the wallet UI as "coming soon"; no backend support yet.
4. **Agro-dealer partner discounts (Syndicates)** — UI badge exists advertising a discount, but there's no backend
   hook that actually validates/applies it at checkout.
5. **Wallet/KYC/payment features degrade without third-party keys not yet supplied**: `GROQ_API_KEY` (AI),
   `PAYSTACK_SECRET_KEY`/`PAYSTACK_PUBLIC_KEY` (M-Pesa), `CIRCLE_API_KEY` (USDC), `STELLAR_ISSUER_SECRET_KEY`
   (on-chain issuance), `BREVO_API_KEY` (SMS OTP), `SENTINEL_HUB_CLIENT_ID`/`SECRET` (real satellite NDVI),
   `RESEND_API_KEY`/Gmail SMTP (email). See `BUGS.md` for exactly what breaks without each.

## 📋 Recommended next features (not started)

Roughly ordered by expected impact:

1. **Real branch protection on GitHub** — `CONTRIBUTING.md` documents the feature → staging → main workflow, but
   the actual branch-protection rule must be turned on in GitHub's repo settings (this can't be done from inside
   the workspace).
2. **Automated tests** — there is currently no test suite (unit or e2e). Given the amount of money-moving logic
   (buy/sell shares, wallet transactions, dividends), this is the single highest-leverage gap — a regression in
   wallet math or the order-matching engine would currently ship silently.
3. **Fund manager DB-backed client book** (see partial item #1 above).
4. **Admin audit trail for financial adjustments** — `audit_logs` table exists for some flows, but not every
   money-moving admin action (wallet credits, manual dividend triggers) is guaranteed to log to it. Worth a pass
   to make sure every balance-changing admin action is captured.
5. **In-app KYC document expiry / re-verification** — currently KYC is a one-time approve/reject; no mechanism to
   require re-verification after N months (common regulatory requirement for financial platforms).
6. **Multi-currency wallet balances** — currently all balances are stored in KES and converted for display;
   consider whether investors depositing USDC/USD should be able to hold non-KES balances natively.
7. **Push notification preferences** — users can't currently opt in/out per notification type (price alerts vs.
   farm updates vs. marketing broadcasts) — it's all-or-nothing via browser permission.
8. **Real satellite NDVI in production** — currently falls back to a synthetic "favourable" reading without
   Sentinel Hub credentials; worth prioritizing once the product is closer to launch since it's a core
   differentiator (data-backed risk assessment).
9. **Referral payout automation** — referral links/codes exist, but confirm whether sales-agent/cooperative
   commission payouts from referrals are automatic or require manual admin action.
10. **Formal accessibility pass** — spotlight tour, modals, and KYC flows haven't had a dedicated a11y review
    (screen reader labels, focus trapping in bottom sheets, contrast in dark mode).

## How to use this file

- When you pick up a roadmap item, move it into `replit.md`'s "Product" section once it ships, and delete the
  line here.
- When you find a new gap while building, add it here rather than letting it live only in chat history.
