#!/usr/bin/env bash
# SlopDock dependency setup — safe to run multiple times.
# Checks for each requirement; installs only what is missing.
# Never resets, deletes, or downgrades existing installations.

set -euo pipefail

RED='\033[0;31m'
YEL='\033[1;33m'
GRN='\033[0;32m'
DIM='\033[0;90m'
RST='\033[0m'

ok()   { echo -e "${GRN}✓${RST} $1"; }
warn() { echo -e "${YEL}!${RST} $1"; }
fail() { echo -e "${RED}✗${RST} $1"; }
dim()  { echo -e "${DIM}  $1${RST}"; }

echo ""
echo "SlopDock — dependency check"
echo "─────────────────────────────────────────"

# ── 1. Node.js ──────────────────────────────────────────────────────────────
NODE_MIN=20
if command -v node &>/dev/null; then
  NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  if [ "$NODE_VER" -ge "$NODE_MIN" ]; then
    ok "Node.js $(node --version)"
  else
    fail "Node.js $(node --version) — need v${NODE_MIN}+"
    warn "Install a newer Node via nvm: nvm install ${NODE_MIN}"
    exit 1
  fi
else
  fail "Node.js not found"
  warn "Install Node.js ${NODE_MIN}+ from https://nodejs.org or via nvm"
  exit 1
fi

# ── 2. Claude Code CLI ──────────────────────────────────────────────────────
if command -v claude &>/dev/null; then
  CLAUDE_VER=$(claude --version 2>/dev/null | head -1 || echo "unknown")
  ok "Claude Code — $CLAUDE_VER"
else
  fail "Claude Code CLI not found"
  dim "Install it from: https://claude.ai/code"
  dim "Or via: curl -fsSL https://claude.ai/install.sh | sh"
  MISSING_CLAUDE=1
fi

# ── 3. GSD (gsd-pi) ─────────────────────────────────────────────────────────
GSD_GLOBAL_DIR="$HOME/.claude/get-shit-done"
GSD_LOCAL_DIR=".claude/get-shit-done"

check_gsd_valid() {
  local dir="$1"
  [ -f "$dir/VERSION" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$dir/VERSION" 2>/dev/null
}

if check_gsd_valid "$GSD_LOCAL_DIR"; then
  GSD_VER=$(cat "$GSD_LOCAL_DIR/VERSION")
  ok "GSD $GSD_VER (local)"
elif check_gsd_valid "$GSD_GLOBAL_DIR"; then
  GSD_VER=$(cat "$GSD_GLOBAL_DIR/VERSION")
  ok "GSD $GSD_VER (global)"
else
  warn "GSD not found — installing gsd-pi..."
  if command -v npm &>/dev/null; then
    # Install globally into the user's Claude config directory
    npm install -g gsd-pi --loglevel=error
    if check_gsd_valid "$GSD_GLOBAL_DIR"; then
      GSD_VER=$(cat "$GSD_GLOBAL_DIR/VERSION")
      ok "GSD $GSD_VER installed"
    else
      fail "GSD install completed but VERSION file not found — run: npm install -g gsd-pi"
    fi
  else
    fail "npm not available — cannot install GSD"
    dim "After installing Node.js, run: npm install -g gsd-pi"
  fi
fi

# ── 4. Optional: Whisper STT ────────────────────────────────────────────────
if command -v whisper &>/dev/null; then
  ok "Whisper STT ($(whisper --version 2>/dev/null || echo 'installed'))"
else
  dim "Whisper STT not found (optional — voice input disabled)"
  dim "Install: pip install openai-whisper"
fi

# ── 5. Optional: Piper TTS ──────────────────────────────────────────────────
if command -v piper &>/dev/null; then
  ok "Piper TTS (installed)"
else
  dim "Piper TTS not found (optional — voice output disabled)"
  dim "Install: https://github.com/rhasspy/piper"
fi

echo "─────────────────────────────────────────"

if [ "${MISSING_CLAUDE:-0}" = "1" ]; then
  echo ""
  warn "Claude Code CLI is required. Install it then re-run: npm run setup"
  exit 1
fi

echo ""
ok "All required dependencies satisfied. Run: npm run dev"
echo ""
