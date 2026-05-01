#!/usr/bin/env bash
# Refresh vendor/ from the latest gsd-pi release on npm.
# Run this when you want to upgrade the bundled GSD version.
# Shows a diff after syncing so you can review before committing.

set -euo pipefail

GRN='\033[0;32m'; YEL='\033[1;33m'; CYN='\033[0;36m'; DIM='\033[0;90m'; RST='\033[0m'
ok()   { echo -e "${GRN}✓${RST} $1"; }
info() { echo -e "${CYN}→${RST} $1"; }
warn() { echo -e "${YEL}!${RST} $1"; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$REPO_ROOT/vendor"
CLAUDE_DIR="$HOME/.claude"

OLD_VER=$(cat "$VENDOR/gsd/VERSION" 2>/dev/null || echo "none")

echo ""
echo "Updating vendor/ from latest gsd-pi..."
echo ""
info "Current vendored version: $OLD_VER"

# Install/upgrade globally to get the latest files into ~/.claude
info "Running: npm install -g gsd-pi"
npm install -g gsd-pi --loglevel=warn

NEW_VER=$(cat "$CLAUDE_DIR/get-shit-done/VERSION" 2>/dev/null || echo "unknown")
info "Latest version: $NEW_VER"

if [ "$OLD_VER" = "$NEW_VER" ]; then
  ok "Already up to date — vendor/ unchanged"
  exit 0
fi

# Sync new files into vendor/
info "Syncing vendor/gsd/ ..."
cp -R "$CLAUDE_DIR/get-shit-done/." "$VENDOR/gsd/"

info "Syncing vendor/hooks/ ..."
for f in gsd-check-update.js gsd-context-monitor.js gsd-phase-completer.sh gsd-statusline.js pre-bash.sh pre-write.sh; do
  [ -f "$CLAUDE_DIR/hooks/$f" ] && cp "$CLAUDE_DIR/hooks/$f" "$VENDOR/hooks/$f"
done

info "Syncing vendor/commands/gsd/ ..."
for f in "$CLAUDE_DIR/commands/gsd/"*.md; do
  [ -f "$f" ] && cp "$f" "$VENDOR/commands/gsd/"
done

# Also sync top-level skills that came from GSD
for f in full-feature.md; do
  [ -f "$CLAUDE_DIR/commands/$f" ] && cp "$CLAUDE_DIR/commands/$f" "$VENDOR/commands/$f"
done

echo ""
ok "vendor/ updated: $OLD_VER → $NEW_VER"
echo ""
warn "Review the diff before committing:"
echo ""
git -C "$REPO_ROOT" diff --stat vendor/ 2>/dev/null || echo "  (run: git diff vendor/)"
echo ""
echo "Commit with:"
echo "  git add vendor/ && git commit -m \"vendor: bump gsd $OLD_VER → $NEW_VER\""
echo ""
