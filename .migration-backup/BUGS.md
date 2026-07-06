# Known Bugs & Issues

Last audited: July 6, 2026. This file tracks confirmed bugs found by running `pnpm run typecheck` and
manually reviewing the codebase. It is not exhaustive — treat it as a living checklist.

## 🔴 High priority (real runtime risk)

1. **Wallet transaction inserts missing `walletId`** — `artifacts/api-server/src/routes/admin.ts` (lines ~1803, ~1845),
   `src/routes/kyc.ts` (~167), and `src/routes/support.ts` (~227, ~289) insert rows into `wallet_transactions`
   without the required `walletId` field. Compiles today only because these call sites predate a schema change;
   TypeScript now flags them as errors (`pnpm run typecheck` fails on this). If these code paths run in production,
   the insert will fail at the DB level (NOT NULL constraint) or silently corrupt records depending on the driver.
   **Fix:** thread the user's `walletId` through to each of these insert calls.

2. **`wallet.ts` references non-existent `investments` columns** — `src/routes/wallet.ts` (~755-756) reads
   `.shares` and `.totalAmount` off the `investments` table, but the current schema doesn't have those column
   names. This is a stale reference from a schema rename that was never updated at this call site.
   **Fix:** update to the current column names in `lib/db/src/schema/investments.ts`.

3. **`migrate.ts` typing is broken** — `src/lib/migrate.ts` has ~25 TypeScript errors because a function that
   should return a `PoolClient` is typed as returning `void`. Migrations still run today (this is a type-checking
   issue, not necessarily a runtime one), but it means real regressions in this file won't be caught by
   `pnpm run typecheck` until the types are fixed.

## 🟠 Medium priority

4. **`support.ts` ticket ID handling** — two spots (~204, ~272) accept `string | string[]` from query params but
   pass it directly where a plain `string` is expected (Express allows array query params like `?id=1&id=2`).
   Needs an explicit array-guard/normalization before use.

5. **`admin.ts` loan record missing `cropType`** — line ~317 accesses `.cropType` on a loan application record
   whose type doesn't include that field. Likely needs a join to the associated farm, or the field should be
   read from the linked farm record instead.

6. **`scheduler.ts` cron options** — passes a `scheduled` option to `node-cron` that isn't part of its `TaskOptions`
   type. The cron job likely still runs (may just be ignored at runtime), but this should be cleaned up or replaced
   with the supported option name.

## 🟡 Feature-degrading (not bugs, but behave differently than a user might expect)

7. **AI chat/insights degrade without `GROQ_API_KEY`** — `ai-chat.ts` / `ai.ts` fall back to canned,
   pattern-matched replies instead of real LLM answers when the key is missing. This was reported by the user as
   "server for sending queries not working" — it's not down, it's running in fallback mode. **Action:** set
   `GROQ_API_KEY` (already requested from the user, pending).

8. **Paystack-dependent flows fail without `PAYSTACK_SECRET_KEY`/`PAYSTACK_PUBLIC_KEY`** — M-Pesa STK push deposits
   and KYC steps that rely on Paystack will error with "Paystack is not configured."

9. **Circle/USDC deposits disabled without `CIRCLE_API_KEY`** — stablecoin deposit/settlement paths no-op or error.

10. **Stellar issuance/funding halted without `STELLAR_ISSUER_SECRET_KEY`** — custodial wallet auto-funding and
    on-chain share issuance won't run; `stellar.ts` returns `false` and the feature silently no-ops.

11. **SMS OTP/welcome messages silently skipped without `BREVO_API_KEY`** — no error is surfaced to the user;
    the signup/OTP flow proceeds as if the SMS were sent.

12. **Email silently "succeeds" without any provider configured** — if neither `RESEND_API_KEY` nor
    `GOOGLE_SMTP_USER`/`GOOGLE_SMTP_PASS` are set, `email.ts` returns success without actually sending anything.
    This can mask real delivery problems in staging/production if nobody notices the missing key.

13. **Rainfall/NDVI falls back to a fixed "favourable" mock reading without Sentinel Hub credentials** —
    `SENTINEL_HUB_CLIENT_ID`/`SENTINEL_HUB_CLIENT_SECRET` missing means every farm shows the same synthetic
    NDVI/rainfall status instead of real satellite data.

## Admin dashboard — "stats not loading" report

Investigated per user report. Backend `/api/admin/stats` returns correct data when called with a valid admin
token — no backend bug found. The likely real-world cause is an expired/invalid `admin_token` in the browser's
`sessionStorage` (these tokens are HMAC-signed and don't expire, so this would only happen if it was cleared,
corrupted, or the user was never actually logged in). The dashboard previously failed **silently** in this case —
fixed by adding a visible "Couldn't load dashboard stats… Retry / Log in again" state instead of a blank screen.

## Housekeeping

- Run `pnpm run typecheck` before merging any PR (see `CONTRIBUTING.md`) — none of the above should regress further.
- This file should be updated whenever a listed bug is fixed (move it to a "Fixed" section or delete the line) or
  a new one is discovered.
