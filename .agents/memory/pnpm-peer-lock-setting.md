---
name: PNPM peer lock setting
description: Workspace-specific PNPM 9 behavior around peer auto-installation and frozen lockfiles.
---

For PNPM 9 commands in this workspace, pass `--config.auto-install-peers=false` when installing packages. The lockfile records peer auto-installation as disabled; omitting the CLI flag from a frozen install can produce a lockfile configuration mismatch, while a non-frozen install can rewrite unrelated dependency resolutions and select incompatible optional Solana peers.

**Why:** Privy’s Solana packages and the app’s locked Solana Kit peer versions must stay aligned for the Vite build to resolve correctly. A Git reset can also leave `node_modules` from the previous checkout, making declared packages appear missing.

**How to apply:** After a source reset or sync, run `pnpm install --frozen-lockfile --config.auto-install-peers=false` before diagnosing missing-module errors. Inspect the lockfile diff before committing and rerun the web build after adding SDK dependencies.

When adding Solana program-client packages, explicitly align `@solana/kit` and their peer dependencies. The memo client’s generated imports require the newer `@solana/kit` export surface; a frozen lockfile can otherwise preserve an incompatible older peer version and fail the Vite build.
