---
name: drizzle-config-injection
description: Malicious code was found injected into lib/db/drizzle.config.ts — fixed and restored.
---

# Drizzle Config Malicious Injection

**Rule:** Before running builds or generators, check tracked build, config, and test files for appended `eval`/`atob` payloads and unnecessary `createRequire` preambles. Confirm each script ends at its expected closing statement.

**Why:** Obfuscated code was found appended to the Drizzle config in July 2026 and the API build script in August 2026. On 2026-10-09, the same executable payload pattern was appended to five tracked config, test, and script files. One API build attempt executed the payload before it was discovered, so build-time credentials may have been exposed.

**How to apply:** After any pull or package/config change, search tracked source for `eval`, `atob`, and unexpected obfuscated suffixes before running build or generator scripts. Restore the intended source, verify no payload remains, then rotate credentials if any suspicious code was executed.

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
