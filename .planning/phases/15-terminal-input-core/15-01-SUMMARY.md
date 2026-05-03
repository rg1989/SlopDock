---
phase: 15-terminal-input-core
plan: 01
subsystem: testing
tags: [vitest, xterm, react-testing-library, tdd, terminal-input]

requires: []
provides:
  - "Failing test scaffold for TerminalInput component (RED state for TDD Wave 1)"
  - "xterm mock pattern (@xterm/xterm + @xterm/addon-fit) for jsdom environment"
  - "Five unit tests covering TINPUT-01 through TINPUT-04"
affects: [15-02-PLAN, 15-terminal-input-core]

tech-stack:
  added: []
  patterns:
    - "Capture onData callback via vi.fn() to simulate terminal input events in jsdom"
    - "Mock xterm Terminal + FitAddon before component import to avoid layout errors"

key-files:
  created:
    - tests/TerminalInput.test.tsx
  modified: []

key-decisions:
  - "Inline mock strategy (no global setup.ts changes) mirrors usePty.test.ts pattern"
  - "capturedOnData variable pattern captures the onData callback reference for test-time firing"

patterns-established:
  - "xterm mock: vi.mock + vi.mocked().mockImplementation() in beforeEach for fresh mocks per test"
  - "onData capture: let capturedOnData stores the callback so tests can fire it directly"

requirements-completed:
  - TINPUT-01
  - TINPUT-02
  - TINPUT-03
  - TINPUT-04

duration: 2min
completed: 2026-05-03
---

# Phase 15 Plan 01: Terminal Input Test Scaffold Summary

**Five failing Vitest tests for TerminalInput covering TINPUT-01 through TINPUT-04 — xterm mocked inline for jsdom, RED state confirmed from missing component import**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-03T17:46:52Z
- **Completed:** 2026-05-03T17:48:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `tests/TerminalInput.test.tsx` with five RED unit tests
- Mocked `@xterm/xterm` Terminal and `@xterm/addon-fit` FitAddon inline for jsdom compatibility
- Established `capturedOnData` capture pattern to simulate terminal input events
- Confirmed RED state: test file parses cleanly, fails only on missing `client/components/TerminalInput.tsx`

## Task Commits

1. **Task 1: Write failing xterm mock + TerminalInput test scaffold** - `1de9077` (test)

**Plan metadata:** (docs commit pending)

## Files Created/Modified
- `tests/TerminalInput.test.tsx` - Five failing unit tests covering TINPUT-01 through TINPUT-04

## Decisions Made
- Inline mock approach (no changes to `tests/setup.ts`) — mirrors the established pattern in `usePty.test.ts` for consistency
- `capturedOnData` variable declared at module scope, reset in `beforeEach` — lets each test fire simulated terminal data events directly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 complete: `tests/TerminalInput.test.tsx` exists with five RED tests
- Plan 15-02 can now implement `client/components/TerminalInput.tsx` to make these tests GREEN
- xterm mock pattern established — Wave 1 tests can follow the same pattern

---
*Phase: 15-terminal-input-core*
*Completed: 2026-05-03*
