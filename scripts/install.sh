#!/usr/bin/env bash
# SlopDock — single installer
#
# Usage (one-liner from GitHub):
#   curl -fsSL https://raw.githubusercontent.com/rg1989/SlopDock/main/scripts/install.sh | bash
#
# Or after cloning:
#   bash scripts/install.sh
#
# What it does:
#   1. Check Node.js 20+ and git
#   2. Check Claude Code CLI (print install link if missing)
#   3. Install GSD from vendor/ into ~/.claude (no network needed)
#   4. Wire GSD hooks into ~/.claude/settings.json
#   5. npm install for the app
#   6. Optionally set up second-brain vault
#
# Everything is idempotent — safe to re-run. Nothing is deleted or downgraded.

set -euo pipefail

RED='\033[0;31m'
YEL='\033[1;33m'
GRN='\033[0;32m'
CYN='\033[0;36m'
BLD='\033[1m'
DIM='\033[0;90m'
RST='\033[0m'

ok()   { echo -e "${GRN}✓${RST} $1"; }
warn() { echo -e "${YEL}!${RST} $1"; }
fail() { echo -e "${RED}✗${RST} $1"; }
info() { echo -e "${CYN}→${RST} $1"; }
dim()  { echo -e "${DIM}  $1${RST}"; }
hr()   { echo "─────────────────────────────────────────"; }

ask_yn() {
  local q="$1" default="${2:-y}"
  local prompt; [ "$default" = "y" ] && prompt="[Y/n]" || prompt="[y/N]"
  while true; do
    printf "${BLD}${CYN}?${RST}${BLD} %s %s${RST} " "$q" "$prompt" >&2
    read -r ans </dev/tty
    ans="${ans:-$default}"
    case "${ans,,}" in y|yes) return 0;; n|no) return 1;; *) warn "Answer y or n";; esac
  done
}

ask_dir() {
  local q="$1" default="$2"
  printf "${BLD}${CYN}?${RST}${BLD} %s${RST}\n${DIM}  (default: %s)${RST}\n" "$q" "$default" >&2
  read -r ans </dev/tty
  echo "${ans:-$default}"
}

# ── locate the repo root ─────────────────────────────────────────────────────
# When run via curl|bash, REPO_ROOT is set to a temp clone.
# When run from within a clone, it's the repo root itself.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
if [ -f "$SCRIPT_DIR/../vendor/gsd/VERSION" ]; then
  REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  VENDOR="$REPO_ROOT/vendor"
  USING_LOCAL_VENDOR=1
else
  USING_LOCAL_VENDOR=0
  REPO_ROOT=""
  VENDOR=""
fi

SLOPDOCK_REPO="https://github.com/rg1989/SlopDock.git"
SECOND_BRAIN_REPO="https://github.com/rg1989/second-brain.git"
CLAUDE_DIR="$HOME/.claude"

echo ""
echo -e "${BLD}SlopDock — installer${RST}"
hr
echo ""

# ── 1. prerequisites ─────────────────────────────────────────────────────────
info "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  fail "Node.js not found — install Node.js 20+ from https://nodejs.org"; exit 1
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt 20 ]; then
  fail "Node.js $(node --version) is too old — need v20+"; exit 1
fi
ok "Node.js $(node --version)"

if ! command -v git &>/dev/null; then
  fail "git not found — install from https://git-scm.com"; exit 1
fi
ok "git $(git --version | awk '{print $3}')"

# ── 2. Claude Code CLI ───────────────────────────────────────────────────────
if command -v claude &>/dev/null; then
  ok "Claude Code — $(claude --version 2>/dev/null | head -1)"
  CLAUDE_OK=1
else
  warn "Claude Code CLI not found — required to run sessions"
  dim "Install from: https://claude.ai/code"
  dim "         or: curl -fsSL https://claude.ai/install.sh | sh"
  echo ""
  CLAUDE_OK=0
fi

echo ""
hr
echo ""

# ── 3. clone SlopDock if running from curl ───────────────────────────────────
if [ "$USING_LOCAL_VENDOR" = "0" ]; then
  info "SlopDock"
  echo ""
  SLOPDOCK_DIR=$(ask_dir "Where should SlopDock live?" "$HOME/slopdock")
  SLOPDOCK_DIR="${SLOPDOCK_DIR/#\~/$HOME}"

  if [ -d "$SLOPDOCK_DIR/.git" ]; then
    ok "Already cloned at $SLOPDOCK_DIR — pulling latest"
    git -C "$SLOPDOCK_DIR" pull --ff-only --quiet || warn "Could not pull, continuing"
  elif [ -d "$SLOPDOCK_DIR" ] && [ "$(ls -A "$SLOPDOCK_DIR")" ]; then
    fail "Directory $SLOPDOCK_DIR exists and is not empty"; exit 1
  else
    info "Cloning SlopDock..."
    git clone --quiet "$SLOPDOCK_REPO" "$SLOPDOCK_DIR"
    ok "Cloned to $SLOPDOCK_DIR"
  fi

  REPO_ROOT="$SLOPDOCK_DIR"
  VENDOR="$REPO_ROOT/vendor"
  echo ""
fi

# ── 4. install GSD from vendor/ ──────────────────────────────────────────────
info "GSD (Get Shit Done)"
echo ""

GSD_DEST="$CLAUDE_DIR/get-shit-done"
VENDOR_VER=$(cat "$VENDOR/gsd/VERSION")

install_gsd=0
if [ -f "$GSD_DEST/VERSION" ]; then
  INSTALLED_VER=$(cat "$GSD_DEST/VERSION")
  if [ "$INSTALLED_VER" = "$VENDOR_VER" ]; then
    ok "GSD $INSTALLED_VER already installed"
  else
    warn "GSD $INSTALLED_VER installed, vendor has $VENDOR_VER — updating"
    install_gsd=1
  fi
else
  info "GSD not found — installing from vendor/"
  install_gsd=1
fi

if [ "$install_gsd" = "1" ]; then
  mkdir -p "$GSD_DEST"
  cp -R "$VENDOR/gsd/." "$GSD_DEST/"
  ok "GSD $VENDOR_VER installed (from vendor/)"
fi

# ── 5. install hooks ─────────────────────────────────────────────────────────
echo ""
info "Claude hooks"
echo ""

HOOKS_DEST="$CLAUDE_DIR/hooks"
mkdir -p "$HOOKS_DEST"

installed_hooks=0
skipped_hooks=0
for src in "$VENDOR/hooks/"*; do
  fname="$(basename "$src")"
  dest="$HOOKS_DEST/$fname"
  if [ -f "$dest" ]; then
    skipped_hooks=$((skipped_hooks + 1))
  else
    cp "$src" "$dest"
    chmod +x "$dest" 2>/dev/null || true
    installed_hooks=$((installed_hooks + 1))
  fi
done

if [ "$installed_hooks" -gt 0 ]; then
  ok "Hooks — $installed_hooks installed, $skipped_hooks already present"
else
  ok "Hooks — all $skipped_hooks already present"
fi

# ── 6. install slash commands ─────────────────────────────────────────────────
echo ""
info "Slash commands"
echo ""

COMMANDS_DEST="$CLAUDE_DIR/commands"
mkdir -p "$COMMANDS_DEST"

# GSD commands
GSD_CMD_DEST="$COMMANDS_DEST/gsd"
mkdir -p "$GSD_CMD_DEST"
installed_cmds=0; skipped_cmds=0
for src in "$VENDOR/commands/gsd/"*.md; do
  fname="$(basename "$src")"
  dest="$GSD_CMD_DEST/$fname"
  if [ -f "$dest" ]; then skipped_cmds=$((skipped_cmds + 1))
  else cp "$src" "$dest"; installed_cmds=$((installed_cmds + 1)); fi
done

# Top-level skills (full-feature etc.)
for src in "$VENDOR/commands/"*.md; do
  [ -f "$src" ] || continue
  fname="$(basename "$src")"
  dest="$COMMANDS_DEST/$fname"
  if [ -f "$dest" ]; then skipped_cmds=$((skipped_cmds + 1))
  else cp "$src" "$dest"; installed_cmds=$((installed_cmds + 1)); fi
done

if [ "$installed_cmds" -gt 0 ]; then
  ok "Commands — $installed_cmds installed, $skipped_cmds already present"
else
  ok "Commands — all $skipped_cmds already present"
fi

# ── 7. wire hooks into ~/.claude/settings.json ───────────────────────────────
echo ""
info "settings.json"
echo ""

SETTINGS="$CLAUDE_DIR/settings.json"
mkdir -p "$CLAUDE_DIR"

# These are the four GSD hooks with their correct event type
declare -A HOOK_ENTRIES=(
  ["PreToolUse:Bash"]='{"matcher":"Bash","hooks":[{"type":"command","command":".claude/hooks/pre-bash.sh"}]}'
  ["PreToolUse:Write"]='{"matcher":"Write","hooks":[{"type":"command","command":".claude/hooks/pre-write.sh"}]}'
  ["SessionStart:gsd-check"]='{"hooks":[{"type":"command","command":"node \"'"$CLAUDE_DIR"'/hooks/gsd-check-update.js\""}]}'
  ["PostToolUse:gsd-monitor"]='{"hooks":[{"type":"command","command":"node \"'"$CLAUDE_DIR"'/hooks/gsd-context-monitor.js\""}]}'
  ["Stop:gsd-phase"]='{"hooks":[{"type":"command","command":"'"$CLAUDE_DIR"'/hooks/gsd-phase-completer.sh","async":true}]}'
)

if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
fi

python3 - "$SETTINGS" <<PYEOF
import json, sys

path = sys.argv[1]
with open(path) as f:
    d = json.load(f)

hooks = d.setdefault("hooks", {})

def has_hook(event_list, marker):
    for entry in event_list:
        for h in entry.get("hooks", []):
            if marker in h.get("command", ""):
                return True
    return False

added = []

# PreToolUse — Bash
pre = hooks.setdefault("PreToolUse", [])
if not has_hook(pre, "pre-bash.sh"):
    pre.append({"matcher": "Bash", "hooks": [{"type": "command", "command": ".claude/hooks/pre-bash.sh"}]})
    added.append("PreToolUse:Bash")

# PreToolUse — Write
if not has_hook(pre, "pre-write.sh"):
    pre.append({"matcher": "Write", "hooks": [{"type": "command", "command": ".claude/hooks/pre-write.sh"}]})
    added.append("PreToolUse:Write")

# SessionStart
ss = hooks.setdefault("SessionStart", [])
if not has_hook(ss, "gsd-check-update.js"):
    ss.append({"hooks": [{"type": "command", "command": "node \"$CLAUDE_DIR/hooks/gsd-check-update.js\""}]})
    added.append("SessionStart")

# PostToolUse
pt = hooks.setdefault("PostToolUse", [])
if not has_hook(pt, "gsd-context-monitor.js"):
    pt.append({"hooks": [{"type": "command", "command": "node \"$CLAUDE_DIR/hooks/gsd-context-monitor.js\""}]})
    added.append("PostToolUse")

# Stop
stop = hooks.setdefault("Stop", [])
if not has_hook(stop, "gsd-phase-completer.sh"):
    stop.append({"hooks": [{"type": "command", "command": "$CLAUDE_DIR/hooks/gsd-phase-completer.sh", "async": True}]})
    added.append("Stop:gsd-phase")

with open(path, "w") as f:
    json.dump(d, f, indent=4)

if added:
    print("added: " + ", ".join(added))
else:
    print("all hooks already present")
PYEOF

ok "settings.json — $(python3 - "$SETTINGS" <<'PYEOF'
import json,sys
with open(sys.argv[1]) as f: d=json.load(f)
count=sum(len(e.get("hooks",[])) for ev in d.get("hooks",{}).values() for e in ev)
print(f"{count} hooks configured")
PYEOF
)"

# ── 8. npm install for the app ────────────────────────────────────────────────
echo ""
info "App dependencies"
echo ""

NM="$REPO_ROOT/node_modules"
LOCK="$REPO_ROOT/package-lock.json"

if [ -d "$NM" ] && [ ! "$LOCK" -nt "$NM" ] 2>/dev/null; then
  ok "npm dependencies up to date"
else
  (cd "$REPO_ROOT" && npm install --loglevel=error)
  ok "npm dependencies installed"
fi

# ── 9. second-brain (optional) ───────────────────────────────────────────────
echo ""
hr
echo ""
info "second-brain (optional — personal knowledge vault)"
echo ""
dim "Private repo, skip if not using it."
echo ""

if ask_yn "Set up second-brain?" "y"; then
  echo ""
  printf "${BLD}${CYN}?${RST}${BLD} second-brain git URL${RST}\n${DIM}  (default: %s)${RST}\n" "$SECOND_BRAIN_REPO"
  read -r SB_REPO_INPUT
  SB_REPO="${SB_REPO_INPUT:-$SECOND_BRAIN_REPO}"

  SB_DIR=$(ask_dir "Where should second-brain live?" "$HOME/second-brain")
  SB_DIR="${SB_DIR/#\~/$HOME}"

  if [ -d "$SB_DIR/.git" ]; then
    ok "Already cloned at $SB_DIR — pulling latest"
    git -C "$SB_DIR" pull --ff-only --quiet || warn "Could not pull, continuing"
  elif [ -d "$SB_DIR" ] && [ "$(ls -A "$SB_DIR")" ]; then
    fail "Directory $SB_DIR exists and is not empty"; exit 1
  else
    info "Cloning second-brain..."
    git clone --quiet "$SB_REPO" "$SB_DIR" || {
      fail "Could not clone $SB_REPO — check your SSH key / repo access"; exit 1
    }
    ok "Cloned to $SB_DIR"
  fi

  info "Running second-brain setup..."
  (cd "$SB_DIR" && npm install --loglevel=error && bash scripts/setup.sh)
fi

# ── done ─────────────────────────────────────────────────────────────────────
echo ""
hr
echo ""
echo -e "${BLD}${GRN}All done.${RST}"
echo ""

[ "$CLAUDE_OK" = "0" ] && {
  warn "Install Claude Code CLI before launching SlopDock:"
  dim "  https://claude.ai/code"
  echo ""
}

echo -e "Start SlopDock:"
echo -e "  ${BLD}cd $REPO_ROOT${RST}"
echo -e "  ${BLD}npm run dev${RST}"
echo -e "Then open ${CYN}http://localhost:5173${RST}"
echo ""
echo -e "${DIM}Restart Claude Code to activate hooks.${RST}"
echo ""
