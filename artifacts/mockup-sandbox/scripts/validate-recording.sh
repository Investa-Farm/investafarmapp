#!/usr/bin/env bash
set -euo pipefail

SRC="artifacts/mockup-sandbox/src"
ERRORS=0

# Check that useVideoPlayer is imported and used in each VideoTemplate file
for vt in $(find "$SRC/components/video" -name "VideoTemplate.tsx" 2>/dev/null); do
  if ! grep -q "useVideoPlayer" "$vt"; then
    echo "ERROR: $vt does not call useVideoPlayer"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check hooks.ts is not modified in a breaking way
HOOKS="$SRC/lib/video/hooks.ts"
if [ ! -f "$HOOKS" ]; then
  echo "ERROR: $HOOKS is missing"
  ERRORS=$((ERRORS + 1))
else
  if ! grep -q "startRecording" "$HOOKS"; then
    echo "ERROR: $HOOKS missing startRecording call"
    ERRORS=$((ERRORS + 1))
  fi
  if ! grep -q "stopRecording" "$HOOKS"; then
    echo "ERROR: $HOOKS missing stopRecording call"
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ "$ERRORS" -eq 0 ]; then
  echo "OK: recording lifecycle looks correct"
else
  echo "FAILED: $ERRORS issue(s) found"
  exit 1
fi
