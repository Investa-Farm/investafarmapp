---
name: Render deploy frontend fixes
description: Non-obvious build issues that block Render (or other external host) deploys but don't block Replit's own dev/preview flow.
---

Replit's dev workflow and its per-artifact build pipeline are more forgiving than a generic external host's build command (e.g. Render running `pnpm run typecheck && pnpm -r run build` at the repo root). Two categories of issues surfaced only under that stricter path:

1. **Pre-existing frontend TypeScript errors** that were out of scope for an in-Replit migration task can still block an external host's build once that host's pipeline actually runs `tsc --noEmit` project-wide. These must be fixed for real (not just narrowly around Replit), even if they were previously deemed non-blocking.

2. **Artifact vite configs that hard-`throw` when `PORT`/`BASE_PATH` env vars are missing.** Replit always injects these via `artifact.toml`, but external hosts running `pnpm -r run build` recursively across the whole workspace won't set them for every package (e.g. a design/canvas-only tool like `mockup-sandbox` that's never meant to be deployed, or the main app being built for standalone root-domain serving instead of Replit's path-based proxy).

**Why:** external CI/build pipelines exercise code paths (whole-repo typecheck, whole-repo build) that Replit's own workflow-based dev/build never fully exercises together.

**How to apply:** when a user reports a Render/Vercel/etc. build failure that doesn't reproduce via the normal Replit workflow, reproduce it locally by running the *exact* root-level build command the host uses (e.g. `pnpm run typecheck` then `pnpm run build` from the repo root) rather than trusting individual package workflows. For vite configs that require env vars only Replit provides, give them safe fallback defaults (`PORT` defaults to any valid port since it's build-irrelevant; `BASE_PATH` defaults to `/` for apps meant to be deployed standalone at a domain root) instead of hard-throwing, so builds succeed both inside and outside Replit.
