---
name: Admin fraud flags + segment broadcast
description: Fraud flags endpoint auth, broadcast segment filter, dark mode fix
---

## Fraud Flags endpoint
- GET /api/admin/fraud-flags — master/sub admin only (NOT allowViewer)
- Detects: large txns >500K KES, rapid withdrawals >3 in 24h, unverified users with high balance
- Returns up to 50 flags; safe to show user emails to master admin

## Broadcast segment
- POST /api/admin/broadcast — accepts `segment` field: "all"|"farmer"|"investor"|"cooperative"|"agribusiness"|"fund_manager"
- Inserts notifications in batches of 500 to avoid query size limits
- Frontend: 6-tile grid segment picker in Settings tab broadcast section

## Dark mode flash fix
- Blocking `<script>` in index.html **before** font/manifest links sets `document.documentElement.classList.add("dark")` synchronously
- Reads `localStorage("investa_theme")` first, falls back to `prefers-color-scheme: dark`

**Why:** Non-blocking scripts (in App.tsx) run after CSS parses, causing a flash of white for dark-mode users on first paint.

## Supplier geolocation sort
- `COUNTY_COORDS` map + `distKm()` haversine in operations.tsx VoucherOrderModal
- `useEffect` requests `navigator.geolocation` when step === "supplier"; denied silently
- Sorted list shows "X km away" distance badge per supplier card
