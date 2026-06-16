#!/usr/bin/env bash
set -e

if ! command -v pnpm &> /dev/null; then
  echo "==> pnpm not found, installing..."
  npm install -g pnpm
fi

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

if [ "${SKIP_DB_PUSH}" = "true" ]; then
  echo "==> Skipping database schema push (SKIP_DB_PUSH=true)"
elif [ -z "${DATABASE_URL}" ]; then
  echo "==> WARNING: DATABASE_URL is not set — skipping database schema push."
else
  echo "==> Pushing database schema..."
  pnpm --filter @workspace/db run push
fi

echo "==> Building frontend..."
BASE_PATH=/ pnpm --filter @workspace/investa-farm run build

echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

echo "==> Build complete!"
