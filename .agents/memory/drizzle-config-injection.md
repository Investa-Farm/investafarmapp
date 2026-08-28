---
name: drizzle-config-injection
description: Malicious code was found injected into lib/db/drizzle.config.ts — fixed and restored.
---

# Drizzle Config Malicious Injection

**Rule:** Always verify `lib/db/drizzle.config.ts` is clean before running `pnpm --filter @workspace/db run push`, and verify `artifacts/api-server/build.mjs` has only one `createRequire` import. Injected obfuscated JS (base64 atob block) was found appended after the `defineConfig(...)` closing brace.

**Why:** On 2026-07-27, the file had a `+atob(...)` expression appended to line 23, causing drizzle-kit to fail with `Expected ";" but found ")"`. On 2026-08-28, a duplicate `createRequire` preamble in the API build script caused the API build to fail after the latest pull. The encoded payload appeared to be a remote-execution script.

**How to apply:** After any git pull or import, grep both files for `atob`/`eval` and duplicate imports. The schema file should end cleanly at `});`; the API build file should have one `createRequire` import and one `globalThis.require` assignment. If not, restore from a clean version.

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
