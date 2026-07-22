# Investa Farm — Known Bugs & Issues

This file tracks active bugs, recently fixed issues, and workarounds. Update it as bugs are found and fixed.

---

## 🔴 Active / Open

_No open bugs._

---

## ✅ Fixed

| ID | Area | Description | Fixed In | Notes |
|----|------|-------------|----------|-------|
| BUG-004 | Loans | Admin approval did not auto-trigger loan disbursement | July 2026 | `PATCH /admin/farms/:id/status` now auto-credits farmer wallet + marks loan disbursed when farm goes active |
| BUG-005 | M-Pesa | STK Push used sandbox URL even in production | July 2026 | `daraja.ts` now uses `https://api.safaricom.co.ke` when `NODE_ENV=production`; sandbox in dev |
| BUG-006 | Notifications | Web push silently failed when VAPID keys not set | July 2026 | VAPID keys added to Render env vars |
| BUG-007 | Secondary market | Order book matching ran every 2 minutes, not 30s as documented | July 2026 | Reduced to every 1 minute |
| BUG-001 | Farmer dashboard | `A.some is not a function` crash when `/api/loans/applications` returned 500 | Commit `e49797c` | Root cause: production DB missing schema columns + missing `r.ok` check on client |
| BUG-002 | Production DB | Enhanced loan columns (`crop_name`, `acreage`, `cost_breakdown`, etc.) missing from production Neon DB | Commit `e49797c` | Fixed by running `pnpm --filter @workspace/db run push` against production |
| BUG-003 | Error boundary | "Return to Home" button redirected farmers back to the same broken page (always went to `/`) | Commit (latest) | Now reads role from localStorage and redirects to the correct role dashboard |
| SEC-001 | Security | `artifacts/api-server/.vapid-keys.json` (VAPID private key) was tracked in git | Commit `487bae9` | File deleted, gitignored, server now requires env vars in production |
| BUG-000 | Build | Render deploy failed with `./start.sh: No such file or directory` | Commit `82b76c7` | Created `start.sh` at repo root |
| BUG-008 | Build | Render typecheck failed: 3 unsafe `as Record<>` casts in `lib/db/src/index.ts`, missing `@types/pg` in api-server devDeps, missing `active` field on `dbStatus()`, pino logger overload in `migrate.ts` | July 2026 | Fixed all 7 TS errors; full `pnpm typecheck` now passes |
| BUG-009 | Frontend | 5 `fetch()` calls missing `r.ok` check before `.json()` (reinvestment-settings, portfolio-ai-insight, portfolio-manager-popup, payment-sheet, rate-app-modal) | July 2026 | Added `if (!r.ok) throw` guard before each `.json()` call |

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
