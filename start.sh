#!/bin/bash

# Kill any stale processes holding our ports before starting
fuser -k 8080/tcp 2>/dev/null || true
fuser -k 5000/tcp 2>/dev/null || true
sleep 1

# Ensure pnpm@9 is available (compatible with Node.js 20)
if ! pnpm --version 2>/dev/null | grep -q "^9"; then
  echo "[setup] Installing pnpm@9..."
  npm install -g pnpm@9 --silent
fi

# Install dependencies if node_modules is missing or outdated
echo "[setup] Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Push database schema (force to skip interactive data-loss prompts)
echo "[setup] Pushing database schema..."
pnpm --filter @workspace/db run push-force 2>&1 || true

# Start API server on port 8080
pnpm --filter @workspace/api-server run dev &
API_PID=$!

# Give the API server time to build and start
sleep 5

# Start frontend on port 5000 (Vite reads PORT env var — see vite.config.ts)
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/investa-farm run dev &
FRONTEND_PID=$!

# Keep this script alive as long as both processes run
wait $API_PID $FRONTEND_PID
