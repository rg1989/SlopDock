---
phase: quick-2
plan: 01
subsystem: composer-ui
tags: [autocomplete, slash-commands, keyboard-navigation, react]
dependency_graph:
  requires: []
  provides: [slash-command-autocomplete]
  affects: [client/components/Composer.tsx]
tech_stack:
  added: []
  patterns: [presentational-component, derived-state, mousedown-blur-prevention, requestAnimationFrame-cursor-restore]
key_files:
  created:
    - client/components/SlashMenu.tsx
  modified:
    - client/components/Composer.tsx
decisions:
  - "Use onMouseDown (not onClick) on SlashMenu items — fires before textarea blur so menu does not close before click registers"
  - "slashAnchor tracks the line-start index of the '/' so insertCommand can splice text precisely without needing to scan again"
  - "requestAnimationFrame used after setValue to restore cursor after React re-render commits the new value"
  - "Derived menuItems (not state) recalculated on every render — avoids stale filter when query and commands change simultaneously"
metrics:
  duration: 3 min
  completed: 2026-05-01
  tasks_completed: 2
  files_changed: 2
---

# Quick-2: Slash-Command Autocomplete Dropdown Summary

**One-liner:** Filtered autocomplete dropdown above the Composer textarea triggered by "/" at BOL, with full keyboard (arrow/enter/escape) and mouse selection via onMouseDown blur-prevention.

## What Was Built

### SlashMenu.tsx (new)
Pure presentational component rendering a dark-themed dropdown (`position: absolute`, `bottom: calc(100% + 4px)`) listing filtered slash commands. Accepts `items`, `selectedIndex`, `onSelect`, `onClose`. Uses `onMouseDown` + `e.preventDefault()` on each row so the textarea does not blur before the click registers. Returns `null` when `items.length === 0`.

**Command registry** — 19 commands exported as `SLASH_COMMANDS`:
- 8 GSD workflow commands (`/gsd:discuss-phase` through `/gsd:ship`)
- 11 Claude Code built-in commands (`/clear`, `/compact`, `/help`, `/init`, `/login`, `/logout`, `/model`, `/pr_comments`, `/review`, `/terminal-setup`, `/vim`)

### Composer.tsx (augmented)
Three pieces of new state: `slashQuery` (null = closed, string = current filter), `slashAnchor` (line-start index where `/` sits), `menuIndex` (highlighted row). All existing props, forwardRef signature, send logic, and attach logic are unchanged.

- **`handleChange`** replaces the inline `setValue` call. Checks if current line starts with `/` and has no space yet — if so, opens menu; otherwise closes it.
- **`handleKeyDown`** intercepts ArrowDown/ArrowUp/Enter when menu is open (before existing Enter-to-send logic), plus Escape to close.
- **`insertCommand`** splices the selected command + trailing space from `slashAnchor` to cursor, then uses `requestAnimationFrame` to restore cursor after the React re-render.
- **`SlashMenu`** rendered inside the existing `position: relative` wrapper, above the textarea, conditionally when `slashQuery !== null && menuItems.length > 0`.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: client/components/SlashMenu.tsx
- FOUND: client/components/Composer.tsx
- FOUND commit: 422380b (SlashMenu component)
- FOUND commit: 58f5c3e (Composer integration)
