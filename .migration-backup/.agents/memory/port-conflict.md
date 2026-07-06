---
name: Port conflict fix
description: API Server on port 8080 can fail with EADDRINUSE after multiple restarts
---

## Problem
Restarting the "API Server" workflow multiple times in quick succession can leave a stale process holding port 8080, causing subsequent starts to fail with `EADDRINUSE`.

## Fix
Run `fuser -k 8080/tcp` in bash before restarting the workflow. This cleanly kills whatever process holds the port.

**Why:** The esbuild build step is fast enough that a new instance can start before the OS fully releases the port from the previous process.

**How to apply:** Any time `restart_workflow` for "API Server" fails or the workflow logs show `EADDRINUSE`, run the fuser command first.
