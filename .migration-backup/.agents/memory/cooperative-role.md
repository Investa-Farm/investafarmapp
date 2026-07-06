---
name: Cooperative role in DB
description: The DB user_role enum must include "cooperative" for partner registration to work
---

The `user_role` Postgres enum in `lib/db/src/schema/users.ts` originally only contained `["farmer", "investor"]`. The cooperative registration route in `artifacts/api-server/src/routes/auth.ts` accepts `role: "cooperative"` in its Zod schema, which caused a runtime DB insert failure and a TypeScript error.

**Fix:** Added `"cooperative"` to the `pgEnum` call and ran `pnpm --filter @workspace/db run push` to apply the migration.

**Why:** The DB enum and the application Zod schema must stay in sync. Any new role added to the auth route must also be added to the pgEnum and pushed.

**How to apply:** Whenever adding a new user role, update `userRoleEnum` in `lib/db/src/schema/users.ts` and push schema changes before restarting the API server.
