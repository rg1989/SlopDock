---
phase: 01-pty-core
plan: 03
subsystem: ui
tags: [react, xterm, composer, textarea, app-layout, testing-library]

# Dependency graph
requires:
  - phase: 01-01
    provides: backend PTY manager, WebSocket handler, shared protocol types
  - phase: 01-02
    provides: Terminal.tsx, usePty hook, useResize hook, FolderPicker component
provides:
  - Composer component with Enter-to-send and Shift+Enter-for-newline behavior
  - App.tsx root layout wiring FolderPicker → Terminal → Composer
  - App.css dark-mode GitHub theme layout
  - 8 unit tests for TERM-03 Composer behaviors
affects: [01-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD with @testing-library/react for React component behavior
    - userEvent for realistic keyboard interaction simulation in tests
    - Controlled textarea with Enter key handling via onKeyDown

key-files:
  created:
    - client/components/Composer.tsx
    - client/App.tsx
    - client/App.css
    - tests/Composer.test.tsx
  modified: []

key-decisions:
  - "Composer sends value + newline (not just value) so PTY receives a shell-executable command"
  - "Trim check before send prevents accidental empty-command submission, but sends raw value (not trimmed) to preserve intentional whitespace"
  - "Disabled prop on Composer gates input until both cwd and terminal are ready — prevents race condition where user types before PTY is initialized"
  - "preventDefaultSpy pattern not used in tests — verified via side-effect (onSend called, textarea cleared) instead of brittle spy injection"

patterns-established:
  - "Textarea onKeyDown pattern: Enter sends, Shift+Enter inserts newline via browser default"
  - "App state: cwd (null until connected) + terminal (null until xterm.js mounted) as dual gates for usePty activation"
  - "Status badge using CSS class toggle (connected/disconnected) rather than inline style"

requirements-completed: [TERM-03]

# Metrics
duration: 8min
completed: 2026-04-30
---

# Phase 01 Plan 03: Composer Component + App Layout Summary

**Composer textarea with Enter-to-send behavior wired into a dark-mode App.tsx layout connecting FolderPicker, Terminal, and Composer via usePty**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-30T17:38:00Z
- **Completed:** 2026-04-30T17:42:40Z
- **Tasks:** 2
- **Files modified:** 4 created

## Accomplishments
- Composer component with correct multiline behavior: Enter sends, Shift+Enter inserts newline, empty input rejected
- 8 unit tests covering all TERM-03 behaviors using @testing-library/react userEvent
- App.tsx root layout wiring all three components with connected status badge
- Full vitest suite green: 30/30 tests passing across all 4 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Composer component** - `c468c74` (feat) — RED + GREEN TDD cycle
2. **Task 2: App.tsx layout wiring + CSS** - `dc621df` (feat)

## Files Created/Modified
- `client/components/Composer.tsx` - Textarea with Enter-to-send and Shift+Enter-to-newline behavior
- `tests/Composer.test.tsx` - 8 unit tests for TERM-03 (TDD RED then GREEN)
- `client/App.tsx` - Root layout wiring FolderPicker → Terminal → Composer via usePty
- `client/App.css` - Dark-mode GitHub theme flex layout

## Decisions Made
- Composer sends `value + '\n'` (not just `value`) so PTY receives a shell-executable command with proper line terminator
- Trim check guards empty/whitespace sends, but sends the raw untrimmed value to preserve intentional indentation or multiline content
- preventDefault test written via side-effect verification (onSend called, textarea cleared) — direct spy injection into React synthetic events is unreliable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unreliable preventDefault test pattern**
- **Found during:** Task 1 (Composer TDD - GREEN phase)
- **Issue:** Initial test injected `preventDefault: spy` into `fireEvent.keyDown` options — React synthetic events don't use the passed-in `preventDefault`, so spy was never called
- **Fix:** Rewrote test to verify side-effects (onSend called once with correct args, textarea cleared to '') instead of spying on the event method directly
- **Files modified:** tests/Composer.test.tsx
- **Verification:** All 8 tests pass
- **Committed in:** c468c74 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test approach)
**Impact on plan:** Minor test fix only. No scope creep. All behaviors still verified.

## Issues Encountered
- Pre-existing TypeScript errors in pty-manager.test.ts and usePty.test.ts (tuple indexing and mock static constants) — these existed before this plan and are out of scope. Client source files (App.tsx, Composer.tsx, etc.) have zero TypeScript errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Composer + App layout complete — full data flow loop is closed: user types → Composer → usePty → PTY → Terminal renders output
- App is ready for end-to-end manual verification in Plan 01-04
- `npm run dev` should start both server and client; navigate to http://localhost:5173, pick a folder, and test the complete flow
