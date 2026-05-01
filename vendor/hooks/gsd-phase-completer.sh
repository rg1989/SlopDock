#!/bin/bash
# Auto-complete a GSD phase when Claude finishes a super tool run.
# Triggered by the Stop hook — fires after every Claude response.
# No-op when no pending phase is tracked.

PENDING="$HOME/.config/claudetalk/pending-phase.json"
GSD_TOOLS="$HOME/.claude/get-shit-done/bin/gsd-tools.cjs"

[ -f "$PENDING" ] || exit 0
[ -f "$GSD_TOOLS" ] || exit 0

CWD=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$PENDING','utf8')).cwd)")
PHASE=$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('$PENDING','utf8')).phaseNumber))")

if [ -z "$CWD" ] || [ -z "$PHASE" ]; then
  rm -f "$PENDING"
  exit 0
fi

node "$GSD_TOOLS" phase complete "$PHASE" --cwd "$CWD" 2>/dev/null
rm -f "$PENDING"
