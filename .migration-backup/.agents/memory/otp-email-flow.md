---
name: OTP + email verification flow
description: How OTP email verification, Paystack wallet, and KYC admin review are wired together
---

## OTP Email Verification
- Registration (`POST /api/auth/register`) creates user, inserts OTP into `otp_codes` table, sends Gmail SMTP email, returns `requiresOtp: true`
- Frontend (`register.tsx`) redirects to `/verify-otp?email=...` after success (not to role dashboard)
- `/verify-otp` page is NOT behind AuthGuard — it uses the token from localStorage directly
- `POST /api/auth/verify-otp` marks OTP used, sets `emailVerified=true` on user, sends welcome email
- `POST /api/auth/send-otp` resends a fresh OTP for the logged-in user
- `storeUser` must be called with `emailVerified: true` after verification to keep client state fresh

## Paystack Wallet
- `POST /api/wallet/paystack/initialize` → returns `{ authorizationUrl, reference }` — open in new window
- `POST /api/wallet/paystack/verify` → checks Paystack, credits wallet if paid; idempotent (skips if reference already processed)
- Amounts are in KES (not kobo) at the API level; multiply ×100 before sending to Paystack

## KYC Admin Flow
- KYC docs uploaded via `POST /api/kyc/upload` — notifies ADMIN_EMAIL
- Admin approves/rejects via `POST /api/kyc/admin/approve/:id` or `reject/:id` (requires role=admin)
- `GET /api/kyc/status` returns `{ isVerified, approved, total }` — isVerified = approved >= 2
- AI review buttons removed from both farmer and investor KYC modals; replaced with "24–48hr admin review" message

## Required Secrets
- GOOGLE_SMTP_USER, GOOGLE_SMTP_PASS (Gmail app password)
- ADMIN_EMAIL
- PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY

**Why:** Gmail SMTP gracefully no-ops when secrets are missing (logs to console instead of throwing) so the app works without email configured.
