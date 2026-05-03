---
phase: 12-bottom-panel-shell
plan: "01"
subsystem: ui-layout
tags: [bottom-panel, tdd, localStorage, drag-resize, shell]
dependency_graph:
  requires: [client/hooks/useDragResize.ts]
  provides: [bottom-panel shell with tab bar, toggle, and localStorage persistence]
  affects: [client/App.tsx, client/App.css]
tech_stack:
  added: []
  patterns: [useDragResize('up'), uiRead/uiWrite persistence, conditional JSX panel]
key_files:
  created:
    - tests/App.bottomPanel.test.tsx
  modified:
    - client/App.tsx
    - client/App.css
decisions:
  - useDragResize mock passes through initialWidth so BPANEL-05 height restoration test reflects localStorage value
  - bottom-panel-tab-bar rendered unconditionally inside .main-area (which already has flex-direction:column)
  - bottomPanel height stored as 'width' in useDragResize return shape (hook is direction-agnostic)
metrics:
  duration: 4min
  completed_date: "2026-05-03"
  tasks: 2
  files: 3
---

# Phase 12 Plan 01: Bottom Panel Shell Summary

Bottom panel shell built via TDD: persistent collapsible zone below .main-area with drag-to-resize and localStorage persistence for open state and height.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0 RED test stubs for BPANEL-01..05 | 6aaef96 | tests/App.bottomPanel.test.tsx |
| 2 | App.tsx state, hooks, persistence, JSX and CSS | 1457b3c | client/App.tsx, client/App.css, tests/App.bottomPanel.test.tsx |

## Verification

- `npm test -- App.bottomPanel`: 5/5 tests GREEN (BPANEL-01..05)
- `npm test`: 169/169 tests pass, 28 test files, no regressions
- `npx tsc --noEmit`: No new TS errors introduced (2 pre-existing errors in tests/usePty.test.ts unrelated to this plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useDragResize mock needed to pass through initialWidth for BPANEL-05**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Mock always returned `width: 240` regardless of initial value; BPANEL-05 needed `300px` from restored localStorage height
- **Fix:** Updated mock in App.bottomPanel.test.tsx to `useDragResize: (initialWidth: number) => ({ width: initialWidth, ... })`
- **Files modified:** tests/App.bottomPanel.test.tsx
- **Commit:** 1457b3c

## Self-Check: PASSED
