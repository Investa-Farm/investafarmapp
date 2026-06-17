#!/bin/bash

# Kill any stale processes holding our ports before starting
fuser -k 8080/tcp 2>/dev/null || true
fuser -k 5000/tcp 2>/dev/null || true
sleep 1

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
