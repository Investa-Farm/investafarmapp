---
name: Database schema migrations
description: Deployment safety rules for keeping the production PostgreSQL schema aligned with the Drizzle source of truth.
---

The production start path must synchronize the primary database schema before starting the API, and must stop instead of serving traffic when that synchronization fails. Runtime migrations should cover additive deltas needed by auth and other boot-time queries.

**Why:** A deployment can appear healthy while every account receives a 500 if the database is one schema revision behind. Swallowing a schema-push failure turns a recoverable deployment error into a user-facing outage.

**How to apply:** When adding or renaming database fields/tables, update the Drizzle schema and the deployment schema-sync path together. Treat intentional destructive changes as an explicit `--force` decision, not as a reason to continue with a partially migrated database.