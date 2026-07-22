---
name: Investa Farm delete/export/modal patterns
description: Conventions for user-facing delete and CSV export features, and the sticky-footer fix for scrollable action sheets.
---

- Financial history rows (trades in `transactionsTable`, wallet movements in `walletTransactionsTable`) use **soft delete** via a nullable `deletedAt` column, never hard delete — preserves audit trail and any balance/portfolio math that might read history later. All GET queries must filter `isNull(deletedAt)`.
  **Why:** hard-deleting a trade or wallet transaction could silently corrupt balance reconciliation or portfolio calculations that assume a complete history.
- Notifications (including admin messages, which surface to the user as `admin_message`-type notification rows) use **hard delete** — they're not financial/audit records.
- CSV export for any already-fetched list is done **client-side** (see `src/lib/csv.ts` `downloadCsv` helper) — no backend export endpoint needed since the data is already in the page.
- Any bottom-sheet/modal with a scrollable body and per-tab or per-state submit buttons must NOT place the submit button inside the `overflow-y-auto` region — under a mobile keyboard the button can require scrolling to reach. Structure as `flex flex-col` with `overflow-y-auto flex-1 min-h-0` content and a separate sticky footer (`flex-shrink-0`, outside the scroll area) holding the action button. Found and fixed in `wallet-modal.tsx`'s withdraw sub-modal; check other multi-step sheets (payment-sheet, kyc-modal, etc.) for the same pattern if users report cut-off buttons.
