---
name: PesaPal payment integration
description: PesaPal v3 replaced Daraja (Safaricom M-Pesa) and Stripe (card) as the unified payment processor.
---

## What changed
- Deleted artifacts/api-server/src/lib/daraja.ts and stripe.ts
- Created artifacts/api-server/src/lib/pesapal.ts — auth token cache, IPN registration, submitOrder, getTransactionStatus
- New wallet routes: POST /wallet/pesapal/order, GET /wallet/pesapal/status/:orderTrackingId, POST /wallet/pesapal/ipn
- payment-sheet.tsx: Mobile Money + Card tabs both use PesaPal iframe; USDC unchanged

## API endpoints
- Sandbox: https://cybqa.pesapal.com/pesapalv3 (NODE_ENV != production)
- Production: https://pay.pesapal.com/v3

## Key decisions
- Token cached 4 min; IPN URL registered once per server lifetime (in-memory)
- pendingPesapalOrders map links orderTrackingId → {userId, amount, reference}; expires 30 min
- Demo mode (no keys): DEMO-PP-* id, server credits on first status poll
- CSP frame-src allows pay.pesapal.com + cybqa.pesapal.com for iframe checkout

**Why:** PesaPal unifies M-Pesa (KE/TZ/MZ), MTN (UG/RW/GH/ZM), Airtel, and Visa/Mastercard. Daraja was Kenya-only; Stripe didn't cover MTN/Airtel.

**How to apply:** All new payment methods/regions go through PesaPal submitOrder — no new direct provider integrations.
