# Investa Farm — Known Bugs & Issues

This file tracks active bugs, recently fixed issues, and workarounds. Update it as bugs are found and fixed.

---

## 🔴 Active / Open

| ID | Area | Description | Impact | Workaround |
|----|------|-------------|--------|------------|
| BUG-004 | Loans | Admin approval does not auto-trigger loan disbursement — funds must be moved manually | High | Admin manually marks as disbursed after transferring funds |
| BUG-005 | M-Pesa | STK Push top-up is not connected to Safaricom Daraja — Paystack is the only live payment method | High | Use Paystack card top-up instead |
| BUG-006 | Notifications | Web push silently fails when VAPID keys are not set in the Render env vars | Medium | Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in Render dashboard |
| BUG-007 | Secondary market | Order book matching runs on a 30-second interval — matched orders may take up to 30s to reflect | Low | Refresh the page after placing an order |

---

## ✅ Fixed

| ID | Area | Description | Fixed In | Notes |
|----|------|-------------|----------|-------|
| BUG-001 | Farmer dashboard | `A.some is not a function` crash when `/api/loans/applications` returned 500 | Commit `e49797c` | Root cause: production DB missing schema columns + missing `r.ok` check on client |
| BUG-002 | Production DB | Enhanced loan columns (`crop_name`, `acreage`, `cost_breakdown`, etc.) missing from production Neon DB | Commit `e49797c` | Fixed by running `pnpm --filter @workspace/db run push` against production |
| BUG-003 | Error boundary | "Return to Home" button redirected farmers back to the same broken page (always went to `/`) | Commit (latest) | Now reads role from localStorage and redirects to the correct role dashboard |
| SEC-001 | Security | `artifacts/api-server/.vapid-keys.json` (VAPID private key) was tracked in git | Commit `487bae9` | File deleted, gitignored, server now requires env vars in production |
| BUG-000 | Build | Render deploy failed with `./start.sh: No such file or directory` | Commit `82b76c7` | Created `start.sh` at repo root |

---

## Reporting a Bug

If you find a bug:

1. Check this file first — it may already be known
2. Collect: steps to reproduce, expected vs actual behaviour, any server logs (from Render dashboard)
3. Add a row to the **Active** table above with the next available `BUG-NNN` ID
4. Open a PR or message the team

For security vulnerabilities, contact the team lead privately — do not open a public issue.

---

## Investigating a Production Bug

1. Check Render logs: Render Dashboard → Web Service → **Logs** tab
2. Look for `"level":50` lines (pino error level) — these always include the full error + stack
3. Check if the error is a `_DrizzleQueryError` — if so, a schema migration may be needed:
   ```bash
   pnpm --filter @workspace/db run push
   ```
4. Check if the error is a client-side crash vs server-side 500 — browser console vs Render logs
