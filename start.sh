#!/usr/bin/env bash
# Render's start command. The api-server serves both the JSON API and the
# built investa-farm frontend (see artifacts/api-server/src/app.ts) as a
# single production service, so we only need to run its compiled server.
set -e
cd "$(dirname "$0")/artifacts/api-server"
exec node --enable-source-maps ./dist/index.mjs
