#!/usr/bin/env bash
set -e

if ! command -v pnpm &> /dev/null; then
  echo "==> pnpm not found, installing..."
  npm install -g pnpm
fi

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building shared packages..."
pnpm --filter @workspace/api-zod run build
pnpm --filter @workspace/api-client-react run build

echo "==> Building frontend..."
BASE_PATH=/ pnpm --filter @workspace/investa-farm run build

echo "==> Frontend build complete!"
