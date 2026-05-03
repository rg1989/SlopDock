---
phase: 16-overlays-cleanup
plan: "02"
subsystem: terminal-input
tags: [slash-commands, xterm, key-handler, tdd]
dependency_graph:
  requires: []
  provides: [slash-interception, slash-menu-render]
  affects: [SessionPane, TerminalInput]
tech_stack:
  added: []
  patterns: [attachCustomKeyEventHandler, useRef-stale-closure, fixed-position-portal]
key_files:
  created: []
  modified:
    - tests/TerminalInput.test.tsx
    - client/components/TerminalInput.tsx
    - client/components/SessionPane.tsx
decisions:
  - "Use useRef booleans (slashOpenRef, inputEmptyRef) inside attachCustomKeyEventHandler to avoid stale closures — React state would be captured at init time"
  - "injectText uses DEL (\\x7f) then paste to erase the leading '/' before inserting command text"
  - "SlashMenu anchorRect sourced from inputWrapperRef.current.getBoundingClientRect() for correct fixed positioning"
  - "inputEmptyRef resets to true on Enter (\\r) so '/' only triggers slash menu at start of fresh line"
metrics:
  duration: "3 minutes"
  completed_date: "2026-05-03"
  tasks_completed: 2
  files_modified: 3
---

# Phase 16 Plan 02: Slash Command Interception Summary

**One-liner:** xterm `attachCustomKeyEventHandler` intercepts `/` at line start to open a fixed-position SlashMenu, with ArrowUp/Down/Enter/Escape handled by React state in SessionPane via stable `useRef` callbacks.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend TerminalInput tests (RED) | 44990c9 | tests/TerminalInput.test.tsx |
| 2 | Extend TerminalInput + wire SlashMenu in SessionPane (GREEN) | e2e3e72 | client/components/TerminalInput.tsx, client/components/SessionPane.tsx |

## What Was Built

### TerminalInput.tsx changes
- New optional props: `onSlashOpen`, `onSlashClose`, `onSlashNavigate`, `onSlashSelect`
- `injectText` added to `TerminalInputHandle` — uses DEL byte to erase leading `/` before pasting command
- `slashOpenRef` and `inputEmptyRef` declared as `useRef` at component level — stable across async init
- `term.attachCustomKeyEventHandler` called once after `term.open()` — intercepts `/` when input is empty, navigation keys when menu is open
- `onData` handler updated to track `inputEmptyRef` (true after `\r`, false otherwise)

### SessionPane.tsx changes
- Import `SlashMenu`, `SLASH_COMMANDS`, `SlashCommand` from `./SlashMenu`
- `inputWrapperRef` attached to `.terminal-input-wrapper` div for `getBoundingClientRect()` anchor
- Slash state: `slashOpen`, `slashIndex`, `slashItems` (all SLASH_COMMANDS, no filtering in MVP)
- Handlers: `handleSlashOpen`, `handleSlashClose`, `handleSlashNavigate`, `handleSlashSelect`
- `handleSlashSelect` calls `inputRef.current?.injectText?.()` to insert command into terminal
- `SlashMenu` portal renders inside wrapper when `slashOpen && slashItems.length > 0`

## Test Results

- 9 TerminalInput tests pass (5 original + 4 new slash tests)
- Full suite: 206 tests across 34 files — all green

## Deviations from Plan

### Context Deviation: Plan 01 already applied

**Found during:** Task 2
**Issue:** Plan 02 notes said "If Plan 01 has not been merged yet, add inputWrapperRef here." On inspection, SessionPane.tsx already had the `.terminal-input-wrapper` div and `ActionBar` import from Plan 01, which had been applied outside of the GSD SUMMARY tracking.
**Fix:** Did not re-add the wrapper div. Attached `inputWrapperRef` to the existing wrapper div and added slash state + SlashMenu inside it.
**Impact:** Clean integration — no conflicts.

## Self-Check

Files exist:
- `client/components/TerminalInput.tsx` — attachCustomKeyEventHandler present
- `client/components/SessionPane.tsx` — SlashMenu import and render present
- `tests/TerminalInput.test.tsx` — 4 new slash tests present

Commits exist:
- 44990c9 — RED test scaffold
- e2e3e72 — GREEN implementation

## Self-Check: PASSED
