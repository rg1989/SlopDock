---
phase: 04-multi-session-tabs
plan: "02"
subsystem: ui
tags: [react, hooks, websocket, localStorage, vitest, tdd, session-management]

requires:
  - phase: 04-multi-session-tabs
    provides: Wave 0 RED tests for useSessionManager, SessionTabBar, usePty sessionId

provides:
  - useSessionManager hook with spawn/close/setActive/updateName/updateStatus/history
  - Extended protocol.ts with sessionId on start message and session-ready ServerMessage
  - Extended usePty with sessionId, onStatus (1200ms debounce), onExit callbacks
  - Extended useSession forwarding sessionId/onStatus/onExit into usePty
  - ws-handler echoes session-ready on PTY spawn

affects: [04-multi-session-tabs]

tech-stack:
  added: []
  patterns:
    - "sessionsRef + activeIdRef pattern: sync refs mirror state for callbacks that need current values without stale closures"
    - "namedSessionsRef Set guard: idempotent updateName — first call wins, subsequent calls no-op"
    - "usePty onStatus/onExit via refs: same ref-callback pattern as onData to avoid stale closure issues in ws.onmessage"
    - "1200ms debounce timer: working->waiting status transition clears on each PTY data event"

key-files:
  created:
    - client/hooks/useSessionManager.ts
  modified:
    - shared/protocol.ts
    - client/hooks/usePty.ts
    - client/hooks/useSession.ts
    - server/ws-handler.ts
    - tests/usePty.test.ts

key-decisions:
  - "sessionsRef+activeIdRef mirrors state in refs so spawn/close callbacks read current values synchronously without needing sessions/activeId as deps"
  - "spawn returns id synchronously by computing id before setSessions (ref read pattern, not stale closure)"
  - "close reads current sessions via sessionsRef to determine remaining sessions and persist to history in one synchronous pass"
  - "toMatchObject instead of toEqual in start message test — sessionId field added to protocol, toEqual would fail on extra field"
  - "SessionStatus type exported from both usePty.ts and useSessionManager.ts — each defines its own to avoid circular imports"

patterns-established:
  - "Ref-sync pattern for callbacks: keep refs in sync with latest callback via useEffect(() => { ref.current = fn; }) — established in usePty for onData, now extended to onStatus/onExit"
  - "Wave 1 GREEN: implement modules to turn Wave 0 RED tests green — test file untouched, only implementation added"

requirements-completed: [SESS-01, SESS-03, SESS-04, SESS-05, SESS-06]

duration: 12min
completed: 2026-05-01
---

# Phase 4 Plan 02: Core Data Layer Summary

**Protocol extended with sessionId + session-ready; useSessionManager hook with spawn/close/persist/history; usePty status callbacks with 1200ms debounce — all 16 new tests green**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-01T15:49:00Z
- **Completed:** 2026-05-01T16:01:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Extended `shared/protocol.ts`: `ClientMessage` start now carries `sessionId: string`; `ServerMessage` gains `session-ready` variant
- Extended `usePty.ts`: accepts `sessionId`, `onStatus`, `onExit`; fires `onStatus('working')` on PTY data then debounces to `onStatus('waiting')` after 1200ms; fires `onStatus('done'|'error')` and `onExit(code)` on PTY exit
- Extended `useSession.ts`: `UseSessionOptions` extended with `sessionId?`, `onStatus?`, `onExit?`; all three forwarded into `usePty` call
- Updated `ws-handler.ts`: reads `sessionId` from start message; echoes `{ type: 'session-ready', sessionId }` after PTY spawn
- Implemented `useSessionManager.ts`: spawn (UUID, Session N name, connecting status), close (removes + persists to localStorage ring buffer), setActive, updateName (idempotent after first call), updateStatus (all 5 statuses), history (loads from localStorage on mount)
- All 15 useSessionManager tests + 1 sessionId-in-protocol test pass GREEN

## Task Commits

1. **Task 1: Extend protocol + usePty + useSession + ws-handler** - `687fc52` (feat)
2. **Task 2: Implement useSessionManager hook** - `75c3879` (feat)

## Files Created/Modified

- `client/hooks/useSessionManager.ts` - New hook: session array management, spawn/close/setActive/updateName/updateStatus/history
- `shared/protocol.ts` - sessionId added to start ClientMessage; session-ready added to ServerMessage
- `client/hooks/usePty.ts` - sessionId, onStatus, onExit options; working/waiting debounce; done/error on exit
- `client/hooks/useSession.ts` - UseSessionOptions extended; sessionId/onStatus/onExit forwarded to usePty
- `server/ws-handler.ts` - Reads sessionId; sends session-ready after PTY spawn
- `tests/usePty.test.ts` - toEqual -> toMatchObject for start message (sessionId now present)

## Decisions Made

- `sessionsRef` and `activeIdRef` mirror React state in mutable refs so `spawn` and `close` callbacks can read current values synchronously — avoids stale closure issues without adding sessions/activeId to useCallback deps
- `spawn` returns the new id synchronously by computing it before `setSessions` — the id is already known at the point of the `crypto.randomUUID()` call, so no async read-back needed
- `close` uses a single pass reading `sessionsRef.current` to both persist history and compute the new `activeId`, then calls `setSessions` and `setActiveId` separately
- `SessionStatus` type is exported from both `useSessionManager.ts` and `usePty.ts` — avoids circular import between the two hooks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated start message test to use toMatchObject instead of toEqual**
- **Found during:** Task 1 (extend usePty with sessionId)
- **Issue:** Existing test asserted exact equality of start message — adding `sessionId` field would cause test to fail because `toEqual` rejects extra fields
- **Fix:** Changed `toEqual` to `toMatchObject` for the start message assertion so it checks required fields without rejecting the added `sessionId`
- **Files modified:** `tests/usePty.test.ts`
- **Verification:** All 11 original usePty tests pass; new sessionId test passes
- **Committed in:** `687fc52` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix for test assertion)
**Impact on plan:** Necessary — existing test would have broken without this fix. No scope creep.

## Issues Encountered

- Pre-existing test failure: `usePty > opens a WebSocket derived from window.location` expects `ws://localhost/ws` but jsdom has port 3000 configured (`ws://localhost:3000/ws`). This failure predates this plan and is out of scope.
- Pre-existing failures in `tests/FilePreview.test.tsx` and `tests/FileTree.test.tsx` — unrelated, pre-existing.
- `tests/SessionTabBar.test.tsx` still RED — this is Wave 0 test for 04-03 (component implementation), expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 1 GREEN complete for SESS-01, SESS-03, SESS-04, SESS-05, SESS-06
- Ready for 04-03: implement `SessionTabBar` component (GREEN phase for SESS-02)
- `useSessionManager` exports all types and functions SessionTabBar and App will consume
- `usePty` status callbacks are wired and tested — SessionTabBar status chips will work end-to-end once App wires them

---
*Phase: 04-multi-session-tabs*
*Completed: 2026-05-01*
