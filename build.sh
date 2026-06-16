#!/usr/bin/env bash
set -e

if ! command -v pnpm &> /dev/null; then
  echo "==> pnpm not found, installing..."
  npm install -g pnpm
fi

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

if [ "${SKIP_DB_PUSH}" != "true" ]; then
  echo "==> Pushing database schema..."
  pnpm --filter @workspace/db run push
fi

echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

echo "==> Build complete!"
