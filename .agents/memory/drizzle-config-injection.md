---
name: drizzle-config-injection
description: Malicious code was found injected into lib/db/drizzle.config.ts — fixed and restored.
---

# Drizzle Config Malicious Injection

**Rule:** Always verify `lib/db/drizzle.config.ts` is clean before running `pnpm --filter @workspace/db run push`. Injected obfuscated JS (base64 atob block) was found appended after the `defineConfig(...)` closing brace.

**Why:** On 2026-07-27, the file had a `+atob(...)` expression appended to line 23, causing drizzle-kit to fail with `Expected ";" but found ")"`. The encoded payload appeared to be a remote-execution script.

**How to apply:** After any git pull or import, grep the file for `atob` or any content after the `});` closing line. File should end cleanly at `});` — if there's anything after that, restore from a clean version.

**Clean file content** (24 lines):
```ts
import { defineConfig } from "drizzle-kit";
import path from "path";
const url = process.env.DB_TARGET === "supabase"
  ? process.env.SUPABASE_DATABASE_URL
  : process.env.DATABASE_URL;
if (!url) { throw new Error(`...`); }
export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: { url },
});
```
