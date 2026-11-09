#!/usr/bin/env bash
# Render's start command. The root start script applies idempotent migrations,
# seeds blog/demo data according to SEED_DEMO, then launches the API server.
set -e

cd "$(dirname "$0")"
exec pnpm run start
