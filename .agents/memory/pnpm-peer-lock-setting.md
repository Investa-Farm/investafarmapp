---
name: PNPM peer lock setting
description: Workspace-specific PNPM 9 behavior around peer auto-installation and frozen lockfiles.
---

For PNPM 9 commands in this workspace, pass `--config.auto-install-peers=false` when installing packages. The lockfile records peer auto-installation as disabled; omitting the CLI flag from a frozen install can produce a lockfile configuration mismatch, while a non-frozen install can rewrite unrelated dependency resolutions and select incompatible optional Solana peers.

**Why:** Privy’s Solana packages and the app’s locked Solana Kit peer versions must stay aligned for the Vite build to resolve correctly.

**How to apply:** Use scoped/offline installs where possible, include the explicit flag, inspect the lockfile diff before committing, and rerun the web build after adding SDK dependencies.
