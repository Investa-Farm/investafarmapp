---
name: Modal z-index hierarchy
description: z-index stacking order for modals vs bottom nav to prevent bottom nav from appearing over modals.
---

## The Problem
Bottom nav (`bottom-nav.tsx`) uses `z-50`. InvestModal was `z-40`, meaning the bottom nav tabs showed OVER the invest modal's lower section on mobile — users could see "Market / Portfolio / Activity / Profile" tabs behind the buy sheet.

## Fix Applied
InvestModal outer container: changed from `z-40` → `z-[60]`.

## z-index hierarchy (do not break this order)
- `z-50` — BottomNav (fixed)
- `z-[55]` — reserved (don't use)
- `z-[60]` — InvestModal, SellSharesModal, and all buy/sell bottom sheets
- `z-[100]` — NotificationPrompt (urgent floating banner)
- `z-[200]` — AppTour overlay

**Rule:** Any modal/bottom-sheet that must cover the bottom nav must use `z-[60]` or higher.

**How to apply:** When creating new modals/sheets that use `fixed inset-0 ...` or `fixed bottom-0 ...`, use `z-[60]` not `z-40` or `z-50`.
