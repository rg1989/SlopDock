---
phase: 15-terminal-input-core
plan: 02
subsystem: ui
tags: [xterm.js, terminal, react, forwardRef, useImperativeHandle]

requires:
  - phase: 15-01
    provides: failing test scaffold for TerminalInput (RED state)

provides:
  - TerminalInput.tsx — xterm.js input strip wired to sendInput via terminal.onData()
  - TerminalInputHandle ref interface exposing focus() via useImperativeHandle
  - Terminal.tsx disableStdin prop to prevent display terminal from stealing keystrokes

affects:
  - 15-03 (SessionPane integration — replaces Composer with TerminalInput)
  - VoiceBar (composerRef focus wiring must call terminal.focus() in Phase 16)

tech-stack:
  added: []
  patterns:
    - "useState for xterm terminal instance enables onData re-wiring when terminal becomes ready after async init"
    - "forwardRef + useImperativeHandle to expose focus() on xterm component"
    - "disableStdin prop pattern for display-only terminals to prevent keystroke capture"

key-files:
  created:
    - client/components/TerminalInput.tsx
  modified:
    - client/components/Terminal.tsx
    - tests/TerminalInput.test.tsx

key-decisions:
  - "Store terminal instance in useState (not useRef) so onData wiring effect triggers after async init"
  - "Use waitFor in tests to handle async dynamic import resolution — synchronous assertions fail for async effects"
  - "disableStdin defaults to false in Terminal.tsx — SessionPane passes true for Claude sessions in Plan 03"

patterns-established:
  - "Pattern: async xterm init with useState to trigger dependent effects"
  - "Pattern: forwardRef + useImperativeHandle for xterm focus exposure"

requirements-completed: [TINPUT-01, TINPUT-02, TINPUT-03, TINPUT-04]

duration: 5min
completed: 2026-05-03
---

# Phase 15 Plan 02: Terminal Input Core Summary

**xterm.js input strip (TerminalInput.tsx) wired to PTY via terminal.onData(sendInput) with rows:4 locked, plus disableStdin prop on display Terminal to prevent focus theft**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-03T17:46:59Z
- **Completed:** 2026-05-03T17:51:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `TerminalInput.tsx` — xterm.js instance with rows:4, scrollback:0, cursorBlink:true, wired to `sendInput` via `terminal.onData()`
- Exposed `focus()` via `useImperativeHandle` for composerRef-style callers
- Added `disableStdin?: boolean` to `Terminal.tsx` to prevent display terminal from stealing keystrokes
- All 5 TerminalInput tests GREEN (TINPUT-01 through TINPUT-04)

## Task Commits

1. **Task 1: Create TerminalInput.tsx** - `2471d7f` (feat)
2. **Task 2: Add disableStdin prop to Terminal.tsx** - `7299d61` (feat)

## Files Created/Modified

- `client/components/TerminalInput.tsx` — New xterm.js input strip component with forwardRef, useImperativeHandle, and onData wiring
- `client/components/Terminal.tsx` — Added disableStdin prop to TerminalProps interface and XTerm constructor
- `tests/TerminalInput.test.tsx` — Fixed mock (added loadAddon) and added waitFor for async init pattern

## Decisions Made

- **useState for terminal instance** — Using `useState` instead of `useRef` allows the `onData` wiring `useEffect` to re-run when the terminal becomes available after the async dynamic import resolves. `useRef` mutations don't trigger effect dependencies.
- **waitFor in tests** — The async `init()` function with dynamic imports requires microtask resolution before assertions. Tests updated from synchronous assertions to `await waitFor()`.
- **disableStdin defaults false** — Terminal.tsx stays backward-compatible; SessionPane passes `true` only for Claude sessions in Plan 03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing loadAddon in xterm mock**
- **Found during:** Task 1 (TerminalInput implementation)
- **Issue:** The test scaffold's `mockTerminal` lacked `loadAddon: vi.fn()`. The component calls `terminal.loadAddon(fitAddon)` which would throw `TypeError: terminal.loadAddon is not a function`
- **Fix:** Added `loadAddon: vi.fn()` to mockTerminal and `mockTerminal.loadAddon.mockClear()` in beforeEach
- **Files modified:** tests/TerminalInput.test.tsx
- **Verification:** Tests pass with loadAddon present
- **Committed in:** 2471d7f (Task 1 commit)

**2. [Rule 1 - Bug] Synchronous test assertions fail for async xterm init**
- **Found during:** Task 1 (running tests after implementation)
- **Issue:** Tests used synchronous `expect()` after `render()` but the async `init()` effect (dynamic import + setState) resolves after the synchronous act() flush. `onData` was called 0 times synchronously.
- **Fix:** Updated tests to use `await waitFor(() => expect(capturedOnData).not.toBeNull())` before triggering callbacks
- **Files modified:** tests/TerminalInput.test.tsx
- **Verification:** All 5 tests GREEN
- **Committed in:** 2471d7f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs in test scaffold from Plan 15-01)
**Impact on plan:** Both fixes necessary for tests to pass. No scope creep — fixes were in the test file only, implementation matches plan spec exactly.

## Issues Encountered

- Pre-existing `canvas-tab-store.test.ts` error (ENOENT race condition in temp file) appears in full suite run but passes standalone — unrelated to this plan, logged as out-of-scope.

## Next Phase Readiness

- `TerminalInput` component ready for SessionPane integration (Plan 03)
- `disableStdin` prop ready on `Terminal.tsx` — SessionPane passes `true` for Claude sessions
- `TerminalInputHandle.focus()` available for VoiceBar composerRef wiring update

---
*Phase: 15-terminal-input-core*
*Completed: 2026-05-03*
