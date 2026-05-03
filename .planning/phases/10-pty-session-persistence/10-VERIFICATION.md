---
phase: 10-pty-session-persistence
verified: 2026-05-02T22:25:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Browser reload reconnects to live PTY"
    expected: "After reloading the browser, the session tab reappears with an amber pulsing chip (reconnecting), transitions to waiting/working, and the terminal replays buffered output from before the reload"
    why_human: "Visual animation, real-time WS reconnect behavior, and scrollback replay can't be verified by grep or test runner"
  - test: "Single WebSocket connection on reconnect (no duplicate PTY spawn)"
    expected: "DevTools Network tab shows only ONE WebSocket connection opening after reload, and the start message contains the same UUID that was in localStorage under slopmop_active:%2F{cwd}"
    why_human: "Network-level WS deduplication requires browser DevTools inspection"
  - test: "Already-exited session shows done, not reconnecting, on reload"
    expected: "If Claude CLI had already quit before the reload, the tab shows done status immediately — no amber pulsing chip, no re-launch attempt"
    why_human: "Requires triggering a PTY exit, then reloading the browser — end-to-end flow not exercised by unit tests"
---

# Phase 10: PTY Session Persistence Verification Report

**Phase Goal:** PTY sessions survive browser reload — reconnect to running Claude process, replay buffer, show reconnecting visual state
**Verified:** 2026-05-02T22:25:00Z
**Status:** human_needed (all automated checks pass; 3 items need human verification)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After browser reload, usePty sends the same session UUID (not a fresh crypto.randomUUID()) | VERIFIED | `sessionId` added to usePty effect deps (line 125); `resolvedSessionId = overrideSessionIdRef.current ?? sessionId ?? crypto.randomUUID()` — overrideRef is null on restore path, so prop UUID is used |
| 2 | Sessions restored by restoreForCwd have status 'reconnecting', not 'connecting' | VERIFIED | `useSessionManager.ts` line 113: `saved.map(s => ({ ...s, status: 'reconnecting' as SessionStatus }))` |
| 3 | When server sends session-ready, usePty transitions status from 'reconnecting' to 'waiting' | VERIFIED | `usePty.ts` lines 75-77: `if (msg.type === 'session-ready') { onStatusRef.current?.('waiting'); }` |
| 4 | When server sends exit on reconnect path, usePty transitions status to 'done' or 'error' | VERIFIED | `usePty.ts` lines 92-99: exit handler calls `onStatusRef.current?.(msg.code === 0 ? 'done' : 'error')` unconditionally |
| 5 | The tab bar shows a pulsing amber chip for reconnecting sessions (PTY-04 visual) | VERIFIED | `SessionTabBar.tsx` line 16: `reconnecting: 'status--reconnecting'`; `App.css` line 3864: `.status--reconnecting { background: var(--warning); animation: pulse 1s infinite; }` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/hooks/useSessionManager.ts` | SessionStatus with 'reconnecting'; restoreForCwd sets 'reconnecting' | VERIFIED | Line 3: `'connecting' \| 'reconnecting' \| ...`; line 113: maps to `'reconnecting'` |
| `client/hooks/usePty.ts` | SessionStatus with 'reconnecting'; sessionId in effect deps; session-ready handler | VERIFIED | Line 6: type includes 'reconnecting'; line 75: session-ready handler present; line 125: `[cwd, terminal, reconnectKey, sessionId]` |
| `client/components/SessionTabBar.tsx` | STATUS_CLASS includes `reconnecting: 'status--reconnecting'` | VERIFIED | Lines 14-21: Record has reconnecting entry |
| `client/App.css` | `.status--reconnecting` with pulse animation | VERIFIED | Line 3864: rule present; line 3868: `@keyframes pulse` defined |
| `server/session-registry.ts` | `getBuffer()` returns buffered output; TTL cleanup via `detach()` + setTimeout | VERIFIED | Lines 82-85: getBuffer returns buffer.join(''); lines 55-59: detach starts SESSION_TTL_MS timer |
| `server/ws-handler.ts` | Reconnect path: attach, session-ready, buffer replay, exit-if-already-exited | VERIFIED | Lines 32-43: full reconnect path implemented |
| `tests/usePty.test.ts` | RED→GREEN tests for PTY-01 (sessionId prop change) and PTY-05 reconnect | VERIFIED | describe 'PTY session reconnect' at line 252; 4 test cases; all pass |
| `tests/useSessionManager.test.ts` | RED→GREEN test for PTY-04 (restoreForCwd sets 'reconnecting') | VERIFIED | describe 'restoreForCwd' at line 304; 3 test cases; all pass |
| `tests/SessionTabBar.test.tsx` | RED→GREEN test for PTY-04 (status--reconnecting class rendered) | VERIFIED | describe 'reconnecting status' at line 176; passes |
| `tests/session-registry.test.ts` | GREEN tests for PTY-02 (buffer replay) and PTY-03 (TTL cleanup) | VERIFIED | 3 tests all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/hooks/usePty.ts` | `client/hooks/useSessionManager.ts` | SessionStatus type — both export same union | VERIFIED | Both files independently declare identical SessionStatus including 'reconnecting' |
| `client/hooks/usePty.ts` | `server/ws-handler.ts` | session-ready message type | VERIFIED | usePty handles `msg.type === 'session-ready'`; ws-handler sends it on reconnect (line 35) and fresh connect (line 50) |
| `client/components/SessionTabBar.tsx` | `client/hooks/useSessionManager.ts` | SessionStatus type import | VERIFIED | Line 2: `import type { SessionEntry, SessionStatus } from '../hooks/useSessionManager'`; STATUS_CLASS is `Record<SessionStatus, string>` |
| `client/App.css` | `client/components/SessionTabBar.tsx` | .status--reconnecting class applied to .status-chip span | VERIFIED | TabBar applies `STATUS_CLASS[session.status]` to `status-chip` span; CSS rule exists |
| `client/App.tsx` | `client/hooks/useSessionManager.ts` | restoreForCwd called on cwd selection | VERIFIED | App.tsx lines 245, 266: `sessionManager.restoreForCwd(normalized)` called on cwd resolution |
| `server/ws-handler.ts` | `server/session-registry.ts` | registry.get / attach / getBuffer / detach | VERIFIED | All four methods used in ws-handler.ts reconnect path (lines 30, 34, 37, 81) |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PTY-01 | 10-01, 10-02 | Browser reload reconnects to running PTY using persisted session UUID | SATISFIED | sessionId in usePty effect deps; start message sends prop UUID; usePty test passes |
| PTY-02 | 10-01, 10-02 | Terminal replays last N lines of scrollback on reconnect | SATISFIED | ws-handler lines 37-38: getBuffer → send data; session-registry.test.ts GREEN |
| PTY-03 | 10-01, 10-02 | Sessions idle 30+ minutes are auto-cleaned up | SATISFIED | SESSION_TTL_MS = 30 * 60 * 1000; detach() starts cleanup timer; session-registry.test.ts GREEN |
| PTY-04 | 10-01, 10-02, 10-03 | Tab bar shows 'reconnecting' vs 'live' vs 'expired' after reload | SATISFIED | STATUS_CLASS has reconnecting entry; App.css has pulsing amber rule; SessionTabBar test passes |
| PTY-05 | 10-01, 10-02 | Already-exited session shows 'done' on reconnect — no re-launch | SATISFIED | ws-handler sends exit if `existing.status === 'exited'`; usePty exit handler transitions to done/error |

All 5 PTY requirements mapped. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned: `useSessionManager.ts`, `usePty.ts`, `SessionTabBar.tsx`, `ws-handler.ts`, `session-registry.ts`, `App.css`.

No TODO/FIXME/placeholder comments, no empty return stubs, no console.log-only handlers found in phase-modified files.

### Human Verification Required

#### 1. Browser Reload Reconnect Flow

**Test:** Start the app (`npm run dev`), open a working directory, let a Claude session establish, send a message, then reload the browser tab (Cmd+R).
**Expected:** The session tab reappears with a pulsing amber chip labeled 'reconnecting', then transitions to green/orange as the session replays buffer and becomes active. The terminal shows previous output.
**Why human:** Visual animation state, real-time WebSocket reconnect sequence, and scrollback replay require browser observation.

#### 2. Single WebSocket Connection (No Duplicate PTY)

**Test:** Open DevTools Network tab before reloading. After reload, inspect WebSocket frames and confirm only one WS connection opens. Verify the sessionId in the start message matches the UUID in localStorage key `slopmop_active:%2F{cwd}`.
**Why human:** Network-level deduplication requires browser DevTools. Unit tests mock WebSocket and cannot verify the actual connection count.

#### 3. Already-Exited Session Shows Done on Reload

**Test:** Start a session, wait for or trigger Claude CLI exit (done status). Then reload the browser. Confirm the tab shows 'done' state immediately — no amber pulsing chip, no re-launch.
**Why human:** End-to-end flow requiring PTY exit followed by browser reload. The unit test for this path passes (exit handler calls onStatus done unconditionally) but the integrated path needs confirmation.

---

## Summary

Phase 10 delivers complete PTY session persistence across all 5 requirements. The implementation is fully wired:

- **Server side (pre-existing, verified correct):** `ws-handler.ts` handles reconnect by attaching the new WebSocket to the existing session, replaying the buffer, and sending exit if the PTY already quit. `session-registry.ts` maintains a 30-minute TTL cleanup timer on detach.

- **Client side (implemented in this phase):** `useSessionManager.restoreForCwd` now sets restored sessions to status `'reconnecting'` (not `'connecting'`). `usePty` now includes `sessionId` in effect deps (triggering re-connect with persisted UUID on prop change), and handles `session-ready` to transition status to `'waiting'`. `SessionTabBar` maps the new status to `status--reconnecting`. `App.css` defines the pulsing amber rule.

- **Test suite:** 158/158 tests pass. The 4 Wave 0 RED tests (PTY-01 sessionId prop change, PTY-05 session-ready transition, PTY-04 restoreForCwd status, PTY-04 visual class) are all GREEN. PTY-02 and PTY-03 server tests were GREEN from the start (server was already correct).

The one gap is human-observable behavior: the browser-level reconnect flow, visual animation, and scrollback replay cannot be confirmed by unit tests alone. The 10-03-SUMMARY.md notes that Task 2 (human verify) was approved, but this verification cannot independently confirm that claim — a fresh human check is recommended.

---

_Verified: 2026-05-02T22:25:00Z_
_Verifier: Claude (gsd-verifier)_
