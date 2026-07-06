---
name: Financial flows – secondary market + harvest distribution
description: How money actually moves for secondary trades, order book fills, and offtaker harvest payments; the walletOps utility; and the critical bugs that were fixed.
---

## Secondary market buyer → seller payment (was broken, now fixed)

**Rule:** When a buyer purchases shares from a secondary listing, the seller MUST be credited atomically. The 0.5% fee is paid by the buyer on top; seller receives full listing price.

**How to apply:**
- After deducting from buyer wallet, check `if (!isPrimary && listing.sellerId)` and call `creditWallet(listing.sellerId, totalAmount, ...)`.
- Also reduce seller's investment: use `listing.investmentId` (now stored on the listing) or fall back to finding active investment by `sellerId + farmId`.
- Record platform revenue via `platformRevenueTable` with `source: "secondary_fee"`.
- `marketListingsTable` now has `investmentId` column (nullable) — populated by `/market/sell` route for precise tracking.

**Why:** The original code debited the buyer but never credited the seller, silently destroying value.

## Order book matching engine – money transfer (was broken, now fixed)

**Rule:** When `runOrderMatching()` in scheduler.ts fills an order, it MUST:
1. Debit buyer wallet (fill total + 0.5% fee) using `debitWallet()`.
2. Credit seller wallet (fill total only) using `creditWallet()`.
3. Create an investment record for the buyer (`investmentsTable`).
4. Reduce/close the seller's investment record.
5. Record platform fee in `platformRevenueTable`.

**Why:** Previous implementation updated order status and sent notifications but moved zero money.

**Error handling:** If `debitWallet()` throws (e.g. buyer has insufficient balance), `continue` to the next match — don't fail the whole farm's matching run.

## Harvest/offtaker payment distribution

**Rule:** `distributeHarvestRevenue()` in `artifacts/api-server/src/routes/harvest.ts` handles the full flow:
- Farmer gets **55%** → `creditWallet(farm.farmerId, farmerAmount, ...)`
- Investors get **20%** split pro-rata by `quantity` among active investments → each gets `investorPool × (inv.quantity / totalShares)`
- Platform keeps **25%** → recorded in `platformRevenueTable` and `transactionFeesTable`
- All investments for this farm are marked `status: "exited"` after payout
- Farm status set to `"harvested"`
- Dividends recorded in `dividendsTable` for each investor

**API routes:** `POST /api/harvest/payment` (farmer/admin), `GET /api/harvest/payments/:farmId`, `POST /api/harvest/trigger/:farmId` (admin only).

**Frontend:** `HarvestPaymentModal` component in `src/components/harvest-payment-modal.tsx`; wired to "Harvest" button (4th tile) in farmer dashboard quick-actions grid (now 4 columns). Uses `/api/farmer/farms` (not `/api/farms/my`) for farm list.

**Portfolio:** holdings with `status === "exited"` show a green "🌾 Harvested" badge.

## walletOps.ts – atomic financial utilities

`artifacts/api-server/src/lib/walletOps.ts` provides:
- `transferFunds(fromUserId, toUserId, amount, opts)` — debits from + credits to in one `db.transaction()`
- `creditWallet(userId, amount, opts)` — single credit with transaction
- `debitWallet(userId, amount, opts)` — single debit; throws if insufficient balance
- `ensureWallet(userId)` — creates wallet if missing, returns it

All four use drizzle `db.transaction()` for atomicity. Import from `"./lib/walletOps"` in api-server routes.

## New DB tables (all pushed)

- `harvest_payments` — records each offtaker payment event with status + distribution breakdown
- `platform_revenue` — tracks all platform earnings by source ("primary_fee", "secondary_fee", "harvest_share", "withdrawal_fee")
- `audit_logs` — financial audit trail keyed by `requestId`; populated via request-ID middleware

## Scalability additions

- DB pool: `max: 20 (prod) / 5 (dev), min: 2, idleTimeoutMillis: 30_000` in `lib/db/src/index.ts`
- In-memory TTL cache: `artifacts/api-server/src/lib/cache.ts` — `cache.set/get/del/invalidatePrefix()`; TTL constants in `TTL` object
- Request-ID middleware: `randomUUID()` attached to `req.id` in `app.ts` before pino-http; propagated as `x-request-id` header
