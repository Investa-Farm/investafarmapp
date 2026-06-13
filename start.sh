#!/bin/bash
set -e

# Build and start the API server on port 8080
export PORT=8080
pnpm --filter @workspace/api-server run dev &
API_PID=$!

# Give the API server a few seconds to start
sleep 3

# Start the frontend on port 5000
export PORT=5000
export BASE_PATH=/
pnpm --filter @workspace/investa-farm run dev &
FRONTEND_PID=$!

# Wait for either process to exit
wait -n $API_PID $FRONTEND_PID
