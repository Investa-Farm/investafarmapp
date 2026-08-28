import { defineConfig } from "drizzle-kit";
import path from "path";

// Support pushing to either Neon (default) or Supabase via DB_TARGET env var.
// Usage:
//   pnpm --filter @workspace/db run push                    → Neon (DATABASE_URL)
//   DB_TARGET=supabase pnpm --filter @workspace/db run push → Supabase (SUPABASE_DATABASE_URL)
const url =
  process.env.DB_TARGET === "supabase"
    ? process.env.SUPABASE_DATABASE_URL
    : process.env.DATABASE_URL;

if (!url) {
  const target = process.env.DB_TARGET ?? "neon";
  const envKey = target === "supabase" ? "SUPABASE_DATABASE_URL" : "DATABASE_URL";
  throw new Error(`${envKey} must be set (DB_TARGET="${target}")`);
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: { url },
});