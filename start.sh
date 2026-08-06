#!/usr/bin/env bash
# Render's start command. The api-server serves both the JSON API and the
# built investa-farm frontend (see artifacts/api-server/src/app.ts) as a
# single production service, so we only need to run its compiled server.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Auto-push schema to production DB on every deploy so new tables/columns
# are never missing. Uses --force to avoid interactive TTY prompts on Render.
echo "[start] Pushing schema to database..."
cd "$ROOT"
pnpm --filter @workspace/db run push-force 2>&1 && echo "[start] Schema push OK" \
  || echo "[start] Schema push failed — continuing anyway"

# Start the API server
cd "$ROOT/artifacts/api-server"
exec node --enable-source-maps ./dist/index.mjs
