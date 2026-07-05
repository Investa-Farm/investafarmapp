---
name: Center-screen success popups + live tx tracker
description: Pattern used to replace top toasts with center-screen success popups and add a live PolygonScan confirmation tracker for USDC deposits.
---

## Center success popup
- `artifacts/investa-farm/src/components/center-success-modal.tsx` exports `showCenterSuccess({title, subtitle})` (pub/sub, no context needed) + `<CenterSuccessHost/>` portal mounted once in `App.tsx`.
- **Why:** user wanted ALL transaction success confirmations (deposits, investments, withdrawals, harvest payouts, orders, share listings) to appear as a center-screen modal instead of a top-right toast, for higher visibility on a financial app.
- **How to apply:** any new transaction success flow should `import("@/components/center-success-modal").then(({ showCenterSuccess }) => showCenterSuccess({ title, subtitle }))` instead of using `success-toast.tsx` (`showSuccessToast`/`showMilestoneToast`) or `transaction-notification.tsx` (`showCompletedTransactionFlow`). Those two files are legacy and kept only for backward compat — do not add new call sites to them.

## Live on-chain confirmation tracker
- `artifacts/api-server/src/lib/polygonscan.ts` → `getPolygonTxStatus(txHash)` polls PolygonScan proxy API (falls back to polygon-rpc.com if no API key), computes confirmations vs `REQUIRED_CONFIRMATIONS = 6`.
- Exposed at `GET /api/wallet/circle/tx-status?txHash=` (auth required).
- Frontend `tx-confirmation-tracker.tsx` (`<TxConfirmationTracker open txHash onConfirmed onClose/>`) polls that route every 5s and shows a center popup (z-[250]) with a progress bar; calls `onConfirmed()` once "confirmed".
- **Why:** manual "I've Sent USDC" / wallet-connect flows previously called `confirmCircle()` immediately with no visibility into whether the tx had actually mined — now they route through the tracker first (`setTrackingTxHash(txHash)`), and `confirmCircle()` fires only in the tracker's `onConfirmed` callback.
- Works keyless (no `POLYGONSCAN_API_KEY` needed, just rate-limited on the public tier).

## Auto-close on success
- Investment modal (`invest-modal.tsx`) and Wallet modal (`wallet-modal.tsx`'s deposit `PaymentSheet onSuccess`) now auto-close a couple seconds after showing the success popup, instead of requiring a manual dismiss click.
