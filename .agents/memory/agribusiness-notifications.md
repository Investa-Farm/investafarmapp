---
name: Agribusiness role + notifications
description: How the agribusiness role, sub-types, and notifications system work
---

# Agribusiness Role

The `agribusiness` role was added to the `userRoleEnum` in `lib/db/src/schema/users.ts` (already in the enum). Sub-types are `farmer_connector` or `input_supplier`, stored as `agribizType` on the user object in localStorage (not in the DB schema — the DB only tracks the `agribusiness` role).

Registration page (`artifacts/investa-farm/src/pages/register.tsx`) shows a 3-role picker + conditional agribiz sub-type picker.

Pages:
- `/agribusiness` → `artifacts/investa-farm/src/pages/agribusiness/dashboard.tsx` — shows different content based on `agribizType` from localStorage
- `/agribusiness/orders` → `artifacts/investa-farm/src/pages/agribusiness/orders.tsx` — voucher orders for input suppliers

AuthGuard casts `(user as any)?.role` to avoid TypeScript type overlap between the stored user type and the new agribusiness role.

**Why:** `getStoredUser()` returns a type that only has `"farmer" | "investor" | "cooperative"` for role. Using `as any` is the safe fix without touching the auth lib type.

**How to apply:** Any new role added to the DB enum must also be handled in AuthGuard and GuestGuard in App.tsx.

# Notifications System

Table: `lib/db/src/schema/notifications.ts` → `notificationsTable` (id, userId FK, type, title, body, isRead, createdAt)

API:
- `GET /api/notifications` — get user's notifications (last 50, desc)
- `POST /api/notifications/read/:id` — mark single as read
- `POST /api/notifications/read-all` — mark all as read

Component: `artifacts/investa-farm/src/components/notifications-panel.tsx` — bottom sheet drawer, uses `useQuery` to fetch, `useMutation` to mark read, auto-refetches every 30s while open.

KYC trigger: When all required docs are uploaded in `routes/kyc.ts`, a notification is inserted and `sendKycUnderReviewEmail` is called.

Admin approve/reject in `routes/kyc.ts` also inserts notifications for the user.
