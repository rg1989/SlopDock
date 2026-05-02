# Phase 10: PTY Session Persistence - Research

**Researched:** 2026-05-02
**Domain:** Node.js WebSocket server, node-pty, in-memory session registry, xterm.js client reconnect
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PTY-01 | Active PTY sessions survive browser reload — server keeps PTY alive, browser reconnects automatically | Server registry already keeps PTY alive on WS close; client must send same session ID on reconnect |
| PTY-02 | Terminal replays last N lines of scrollback on reconnect — no blank screen | Registry already buffers up to 5000 chunks; reconnect path in ws-handler already replays buffer |
| PTY-03 | Sessions with no browser connection for 30+ minutes are cleaned up automatically | TTL timer (SESSION_TTL_MS = 30 min) already implemented in SessionRegistry.detach() |
| PTY-04 | Tab bar shows "reconnecting" vs "live" vs "expired" states after reload | useSessionManager.restoreForCwd() sets status: 'connecting'; need 'reconnecting' visual state in SessionTabBar |
| PTY-05 | Session that already exited shown as "done" on reconnect — not re-launched | ws-handler already sends exit message on reconnect if status === 'exited'; client must handle this cleanly |
</phase_requirements>

---

## Summary

The majority of the server-side infrastructure for PTY session persistence is already built and working. `server/session-registry.ts` maintains a `SessionRegistry` singleton with a `Map<string, ManagedSession>` that survives WebSocket disconnects, buffers up to 5000 output chunks per session, and runs a 30-minute TTL cleanup timer on detach. `server/ws-handler.ts` already handles reconnect: if a `start` message arrives for a session ID that exists in the registry, it attaches, replays the buffer, and sends an `exit` message if the PTY already exited.

The gap is entirely on the client side. `useSessionManager` persists session entries in `localStorage` under `slopmop_active:{cwd}` and `restoreForCwd()` rehydrates them with status `'connecting'`, but the IDs are not durably handed back to `usePty`. The usePty hook re-generates a new `crypto.randomUUID()` whenever PTY exits (via `overrideSessionIdRef`), which is correct for the exit flow but must be bypassed on page reload when a session was still live. The current `SessionStatus` type does not include a `'reconnecting'` state, which PTY-04 requires for the tab bar visual.

The plan is straightforward: ensure session IDs survive reload via localStorage, thread the persisted ID into usePty, add a `'reconnecting'` status variant, and wire up the status transitions correctly.

**Primary recommendation:** Keep all server-side code as-is. Three client-side changes unlock all five requirements: (1) persist + restore session IDs through localStorage, (2) add `'reconnecting'` to `SessionStatus`, (3) transition status from `'reconnecting'` to `'waiting'`/`'done'` once the first ws-handler response arrives.

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-pty | existing | PTY spawn/write/kill | Already used in pty-manager.ts |
| ws (WebSocketServer) | existing | Server-side WS | Already in ws-handler.ts |
| WebSocket (browser) | native | Client WS | Already in usePty.ts |
| React hooks + localStorage | native | Client state + ID persistence | Project pattern |
| Vitest + @testing-library/react | existing | Tests | Project standard (vitest run) |

### No new dependencies needed

The entire feature is implemented by wiring existing pieces differently.

---

## Architecture Patterns

### Current Data Flow (pre-Phase 10)

```
Client                              Server
------                              ------
useSessionManager.spawn()           —
  → generates UUID (client-only)
  → stored in localStorage
  → passed as sessionId to usePty

usePty (start message) ─────────►  ws-handler
  { type:'start', sessionId, ... }   → registry.create() + spawn PTY
                                     → ptyProcess.onData → registry.appendBuffer + registry.send
WS close (tab refresh) ◄────────── ws.onclose → registry.detach(id)
                                     → starts 30-min TTL timer

[page reload]
useSessionManager.restoreForCwd()
  → reads localStorage
  → sets sessions with status:'connecting'
  → BUT: usePty calls overrideSessionIdRef ?? sessionId ?? crypto.randomUUID()
  → if sessionId prop arrives late or is new UUID → sends wrong ID → server spawns new PTY
```

### Target Data Flow (post-Phase 10)

```
[page reload]
useSessionManager.restoreForCwd()
  → reads localStorage (sessions have their stable UUIDs)
  → sets sessions with status:'reconnecting'

usePty receives sessionId from useSessionManager
  → sends { type:'start', sessionId: <PERSISTED_UUID> }
  → ws-handler sees existing registry entry
  → attaches sendFn, replays buffer, sends exit if already exited

usePty.onmessage:
  'session-ready' + buffered 'data' → status transitions to 'waiting'
  'exit' (already exited) → status transitions to 'done'
```

### Recommended Project Structure — No Changes

No new files needed. Changes are confined to:
- `client/hooks/useSessionManager.ts` — status type + restoreForCwd persistence
- `client/hooks/usePty.ts` — status type + handle 'session-ready' for reconnecting state
- `client/components/SessionTabBar.tsx` — visual for 'reconnecting' status
- `shared/protocol.ts` — optionally add 'session-ready' status signal (already present)

### Pattern 1: Session ID Stability Through Reload

**What:** The session UUID must be stored in `localStorage` and restored as-is on reload.
**When to use:** Every time `useSessionManager.restoreForCwd()` runs.

The current `loadActiveSessions` already saves `{ sessions, activeId }` to `slopmop_active:{cwd}`. Sessions include their `id` field (UUID). So the ID is already persisted. The gap is that `usePty` does not reliably receive this ID before its WebSocket connect effect runs.

The effect deps for usePty are `[cwd, terminal, reconnectKey]`. If `sessionId` prop changes after the WS already opened (because React renders the session list before the prop flows down through `SessionPane`), the effect does not re-run and the wrong UUID is sent. Fix: add `sessionId` to usePty's effect deps, or ensure `restoreForCwd` is called before `usePty` mounts (currently it is called in a `useEffect`, which is after mount).

**Correct approach:** Call `restoreForCwd` synchronously from `useState` initializer in App.tsx (or ensure `sessionId` is a dep of the usePty connect effect).

### Pattern 2: 'reconnecting' Status

**What:** A new status variant between 'connecting' (no known server session) and 'waiting' (confirmed live).
**When:** `restoreForCwd` sets all restored sessions to 'reconnecting'. The tab bar shows a different indicator. Once the server sends `session-ready`, status transitions to 'waiting'.

The `SessionStatus` type is defined in two places (a known project decision: `SessionStatus` exported from both `usePty.ts` and `useSessionManager.ts` to avoid circular imports). Both must be updated.

### Pattern 3: ws-handler Reconnect Flow (Already Correct)

From `ws-handler.ts` lines 28-44: when `msg.type === 'start'` and `existing` is found in registry, it calls `registry.attach(msg.sessionId, send)`, sends `session-ready`, replays buffer, and sends `exit` if exited. This is exactly right. No changes needed on the server.

### Anti-Patterns to Avoid

- **Re-spawning on reload:** The current `overrideSessionIdRef` mechanism in usePty is designed for post-exit fresh spawn. Do NOT let it fire on a reconnect path. The reconnect path must pass the persisted UUID and skip the override.
- **Re-writing session IDs on restoreForCwd:** Do not generate new UUIDs in `restoreForCwd`. Use the saved IDs exactly.
- **Adding 'reconnecting' to only one copy of SessionStatus:** Both `usePty.ts` and `useSessionManager.ts` export the type — both must be updated.
- **Blocking usePty mount waiting for server confirmation:** The xterm.js terminal should render immediately; the reconnecting state is just a visual. Do not defer terminal mount.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Output scrollback buffer | Custom ring buffer | `registry.buffer` (already exists, capped at 5000 chunks) | Already handles trimming, already replayed in ws-handler |
| Session TTL cleanup | Custom interval/timer | `SessionRegistry.detach()` TTL timer (already exists) | Already wired to ws close |
| PTY process keepalive | External process manager (tmux, pm2) | In-memory registry (already survives WS close) | Server process is not restarted; in-memory is sufficient per REQUIREMENTS.md out-of-scope |
| WebSocket reconnect loop | Custom retry with backoff | Existing `reconnectKey` increment in usePty + `restoreForCwd` | Pattern already works for post-exit respawn |

---

## Common Pitfalls

### Pitfall 1: sessionId Prop Arrives After usePty Mount

**What goes wrong:** `usePty` mounts with `sessionId = undefined`, uses `crypto.randomUUID()`, sends a `start` message creating a new PTY. Then `sessionId` prop updates from `restoreForCwd` but the effect doesn't re-run (deps don't include `sessionId`).
**Why it happens:** `usePty` deliberately excluded cols/rows from deps. But `sessionId` is different — it's identity-critical.
**How to avoid:** Add `sessionId` to the usePty effect dependency array. The effect already handles the case where `cwd` or `terminal` is null — adding `sessionId` just means a new WS connection opens with the correct ID when the prop arrives.
**Warning signs:** Server logs show two sessions created when only one tab is expected after reload.

### Pitfall 2: overrideSessionIdRef Fires on Reconnect Path

**What goes wrong:** The post-exit respawn logic (`overrideSessionIdRef.current = crypto.randomUUID()`) runs when the PTY exits. If a reconnect happens to an already-exited session, ws-handler sends an `exit` message. usePty's `msg.type === 'exit'` handler will then set `overrideSessionIdRef` to a new UUID and schedule a reconnect with a fresh ID — correct behavior (user gets a new session). No bug here.
**Why it matters:** Confirm this is intentional for PTY-05: exited sessions should not be re-launched. The flow is: reconnect → server sends `exit` → client status goes to 'done' → user sees "done" tab. No auto-relaunch.
**How to avoid:** Leave the exit handler as-is. After `msg.type === 'exit'` arrives on a reconnect, the 800ms timer fires and creates a NEW UUID — which is correct (the old session is dead, a fresh PTY should spawn when user next interacts). The session tab stays showing 'done' until the user explicitly spawns a new session.

### Pitfall 3: Two Copies of SessionStatus Must Stay in Sync

**What goes wrong:** `usePty.ts` exports `SessionStatus`, `useSessionManager.ts` also exports `SessionStatus`. If only one is updated with `'reconnecting'`, TypeScript errors appear in components that import from the other.
**How to avoid:** Update both type definitions in the same commit/plan.

### Pitfall 4: restoreForCwd Called After First usePty Mount

**What goes wrong:** App.tsx calls `restoreForCwd` inside a `useEffect` (runs after render). By the time it fires, `usePty` may already have opened a WS with a fresh UUID.
**How to avoid:** Either move restoreForCwd to a synchronous init path (useState initializer), or add `sessionId` to usePty effect deps so when the restored ID arrives, usePty reconnects with it. The latter is simpler and doesn't restructure App.

### Pitfall 5: Buffer Replay Causes xterm.js Double-Write

**What goes wrong:** On reconnect, ws-handler sends the full accumulated buffer as one `data` message. If the xterm.js terminal was not cleared before replay, the user sees the history written again on top of whatever was in the terminal div from the previous mount.
**Why it happens:** xterm.js `Terminal` instances are created fresh on component mount but the DOM div is re-used (via `display:none` pattern from Phase 4). The Terminal instance should be fresh on reconnect (component re-mounted or terminal reset).
**How to avoid:** Verify that `SessionPane` mounts a fresh `Terminal` instance after page reload. The `display:none` approach keeps terminals alive across tab switches — but after a full page reload, all Terminal instances are new, so replay writes to a blank terminal. This is safe.

### Pitfall 6: 'reconnecting' Status Must Not Block the Composer

**What goes wrong:** If `'reconnecting'` is treated like `'connecting'` (locked composer), user can't type while reconnect is in flight. Reconnect should be transparent.
**How to avoid:** The composer lock in App.tsx checks `!cwd || !terminal`. The session status check (if any) should NOT block on `'reconnecting'`. Only `'connecting'` (never-seen-before session) should lock.

---

## Code Examples

### Registry Already Handles Reconnect (server/ws-handler.ts lines 28-44)

```typescript
// Source: server/ws-handler.ts
if (msg.type === 'start') {
  currentSessionId = msg.sessionId;
  const existing = registry.get(msg.sessionId);

  if (existing) {
    registry.attach(msg.sessionId, send);
    send({ type: 'session-ready', sessionId: msg.sessionId });
    const buffered = registry.getBuffer(msg.sessionId);
    if (buffered) send({ type: 'data', data: buffered });
    if (existing.status === 'exited') {
      send({ type: 'exit', code: existing.exitCode ?? 0 });
    }
    return;
  }
  // ... new session spawn
}
```

### How 'reconnecting' Transitions in usePty

```typescript
// Pseudo-code for the target behavior in usePty onmessage handler
ws.onmessage = (event) => {
  const msg: ServerMessage = JSON.parse(event.data);
  if (msg.type === 'session-ready') {
    // Both new sessions and reconnects receive this
    // For reconnects, transition from 'reconnecting' → 'waiting'
    onStatusRef.current?.('waiting');
  }
  if (msg.type === 'data') {
    terminal.write(msg.data);
    onDataRef.current?.(msg.data);
    onStatusRef.current?.('working');
    // debounce back to 'waiting'
  }
  if (msg.type === 'exit') {
    onStatusRef.current?.(msg.code === 0 ? 'done' : 'error');
    // overrideSessionIdRef + reconnectKey increment for fresh spawn
  }
};
```

### SessionStatus Type Update (both files)

```typescript
// shared update — both usePty.ts and useSessionManager.ts
export type SessionStatus = 'connecting' | 'reconnecting' | 'waiting' | 'working' | 'done' | 'error';
```

### SessionTabBar Visual for 'reconnecting'

```typescript
// client/components/SessionTabBar.tsx
const STATUS_CLASS: Record<SessionStatus, string> = {
  connecting:    'status--connecting',
  reconnecting:  'status--reconnecting',  // add this
  waiting:       'status--waiting',
  working:       'status--working',
  done:          'status--done',
  error:         'status--error',
};
```

```css
/* App.css — pulsing amber for reconnecting, similar to connecting */
.status--reconnecting { background: var(--warning); animation: pulse 1s infinite; }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Kill PTY on WS close (Phase 1 decision) | Keep PTY alive via registry detach + TTL | Phase 4 prep (noted in STATE.md) | Sessions survive tab switches already |
| Fresh UUID per mount | Stable UUID from useSessionManager | Phase 4 | UUIDs stable within a page load |
| No scrollback | Buffer up to 5000 chunks in registry | Phase 4/registry work | Replay available on reconnect |

**Already solved by existing code:**
- PTY keepalive: `registry.detach()` keeps PTY alive for 30 min
- Buffer: `registry.appendBuffer()` + `registry.getBuffer()`
- Reconnect message handling: ws-handler `start` branch with `existing` check
- Session ID storage: `loadActiveSessions` / `saveActiveSessions` in useSessionManager

---

## Open Questions

1. **Should 'reconnecting' status allow the composer?**
   - What we know: connecting locks the composer; reconnecting is different (session exists, we're just re-attaching)
   - What's unclear: is there a race where the user types before the WS is open?
   - Recommendation: allow typing during reconnect (WS send is no-op if not OPEN; usePty guards with `ws.readyState === WebSocket.OPEN`)

2. **Buffer replay: send as one big chunk or split?**
   - What we know: ws-handler sends `registry.getBuffer(id)` as a single string in one `data` message
   - What's unclear: very large buffers (5000 × multi-line chunks) could be a slow write to xterm.js
   - Recommendation: current approach is fine; xterm.js handles large writes. Do not split unless profiling shows jank.

3. **restoreForCwd call timing in App.tsx**
   - What we know: currently called in a `useEffect` (after mount)
   - What's unclear: exact render order vs usePty mount
   - Recommendation: add `sessionId` to usePty effect deps as the safe fix — avoids restructuring App init.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + @testing-library/react |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PTY-01 | usePty sends persisted UUID on reconnect | unit | `npm test -- --grep "reconnect"` | Wave 0 |
| PTY-02 | ws-handler replays buffer on reconnect | unit | `npm test -- --grep "buffer replay"` | Wave 0 |
| PTY-03 | Registry TTL cleanup after 30 min | unit | `npm test -- --grep "TTL"` | Wave 0 |
| PTY-04 | SessionTabBar shows 'reconnecting' state | unit | `npm test -- --grep "reconnecting"` | Wave 0 |
| PTY-05 | Exited session shows 'done' on reconnect | unit | `npm test -- --grep "exited"` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/session-registry.test.ts` — covers PTY-02 (buffer replay), PTY-03 (TTL cleanup), PTY-05 (exited replay)
- [ ] `tests/ws-handler.test.ts` — covers PTY-01 (reconnect path sends correct ID), PTY-05 (exit on reconnect)
- [ ] `tests/usePty.test.ts` — extend existing file: add reconnect with persisted ID, 'reconnecting' → 'waiting' transition
- [ ] `tests/useSessionManager.test.ts` — extend existing file: 'reconnecting' status on restoreForCwd
- [ ] `tests/SessionTabBar.test.tsx` — extend existing file: 'reconnecting' status class rendered

---

## Sources

### Primary (HIGH confidence)

- Direct codebase read: `server/session-registry.ts` — full registry implementation verified
- Direct codebase read: `server/ws-handler.ts` — reconnect path lines 28-44 verified
- Direct codebase read: `client/hooks/usePty.ts` — full hook verified
- Direct codebase read: `client/hooks/useSessionManager.ts` — full hook verified, localStorage keys confirmed
- Direct codebase read: `shared/protocol.ts` — message types confirmed
- Direct codebase read: `.planning/REQUIREMENTS.md` — all 5 requirements confirmed

### Secondary (MEDIUM confidence)

- Direct codebase read: `client/App.tsx` lines 1-220 — restoreForCwd call site, session manager wiring
- Direct codebase read: `client/components/SessionTabBar.tsx` — STATUS_CLASS mapping confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — all server-side code read directly; gaps identified by tracing execution paths
- Pitfalls: HIGH — derived from actual code paths, not speculation

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (stable codebase, no fast-moving deps)
