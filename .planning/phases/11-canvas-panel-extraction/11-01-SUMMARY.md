---
phase: 11-canvas-panel-extraction
plan: 01
subsystem: testing
tags: [vitest, react-testing-library, tdd, canvas, sidebar]

# Dependency graph
requires: []
provides:
  - "RED tests for CANVAS-01 through CANVAS-05 covering canvas column extraction behaviors"
  - "App-level mock boilerplate for rendering App component in tests (all hooks and child components mocked)"
affects: [11-02, 11-03, 11-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App-level component test: mock all hooks (useDragResize, useSessionManager, useFileTree, useAudioCoordinator, useSettings, useProjectHealth) and all heavy child components so App renders in jsdom"
    - "Seed localStorage before render to simulate persisted UI state; assert DOM structure after waitFor app-body visible"

key-files:
  created:
    - tests/App.canvasPanel.test.tsx
    - tests/LiveCanvasColumn.test.tsx
  modified: []

key-decisions:
  - "Mock all child components (SessionPane, FolderPicker mocked with connect button, etc.) so App renders without xterm/PTY/WebSocket dependencies in jsdom"
  - "CANVAS-02 (canvas absent when hidden) passes at Wave 0 — acceptable because canvas-column does not exist yet; RED requirement applies to the set overall (CANVAS-01 and CANVAS-03 fail)"
  - "Seed slopmop_last_folder in localStorage to trigger auto-connect path so sidebar renders without clicking connect"

patterns-established:
  - "App test mock pattern: vi.mock each hook and component, stub fetch with url-routing mock, seed localStorage for auto-connect"

requirements-completed:
  - CANVAS-01
  - CANVAS-02
  - CANVAS-03
  - CANVAS-04
  - CANVAS-05

# Metrics
duration: 2min
completed: 2026-05-02
---

# Phase 11 Plan 01: Canvas Panel Extraction RED Tests Summary

**Five TDD RED tests across two files covering canvas column extraction: sidebar tab count (CANVAS-04), canvas width restore (CANVAS-05), canvas visibility toggle (CANVAS-01, CANVAS-02, CANVAS-03)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-02T20:01:16Z
- **Completed:** 2026-05-02T20:03:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created App.canvasPanel.test.tsx with 3 tests — CANVAS-04 (sidebar has 4 not 5 tabs) and CANVAS-05 (canvas-column present with width from localStorage), all 3 fail RED
- Created LiveCanvasColumn.test.tsx with 3 tests — CANVAS-01 (canvas-column present by default), CANVAS-02 (absent when hidden), CANVAS-03 (toggle button hides canvas and persists), 2 fail RED
- Established App-level test mock pattern: all hooks and child components mocked, fetch url-routing stub, localStorage seeding for auto-connect

## Task Commits

1. **Task 1: RED tests for sidebar tab removal and canvas width restore (App.canvasPanel)** - `5fa20f1` (test)
2. **Task 2: RED tests for canvas column visibility and toggle (LiveCanvasColumn)** - `a913f96` (test)

## Files Created/Modified
- `tests/App.canvasPanel.test.tsx` - RED tests for CANVAS-04 (sidebar 4 tabs) and CANVAS-05 (canvas-column from localStorage)
- `tests/LiveCanvasColumn.test.tsx` - RED tests for CANVAS-01 (visible), CANVAS-02 (hidden), CANVAS-03 (toggle)

## Decisions Made
- Mocked FolderPicker with a real connect button so tests can simulate auto-connect via localStorage seed rather than click interaction
- CANVAS-02 passes at Wave 0 (canvas-column absent because not yet implemented) — this is documented as acceptable; overall test set has RED failures from CANVAS-01 and CANVAS-03
- Used `slopmop_last_folder` localStorage key to trigger the auto-connect `useEffect` in App so sidebar renders without manual user interaction

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Five failing RED tests established baseline for Phase 11 implementation
- App-level mock boilerplate in both test files ready to be reused or extended by implementation plans (11-02 through 11-04)
- Pre-existing 159 tests all remain green — no regressions

---
*Phase: 11-canvas-panel-extraction*
*Completed: 2026-05-02*
