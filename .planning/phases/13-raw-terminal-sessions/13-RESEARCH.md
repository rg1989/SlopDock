# Phase 13: raw-terminal-sessions — Research

**Researched:** 2026-05-03
**Domain:** React PTY tab management — reusing existing node-pty/WebSocket/xterm.js infrastructure to populate the bottom panel with raw shell sessions
**Confidence:** HIGH — entire stack is already in the codebase; no new libraries needed

---

## Summary

Phase 13 fills the bottom panel shell (built in Phase 12) with real PTY terminal sessions. The design is parallel to the existing top panel's Claude agent sessions but simpler: no TTS, no agent config, no composer — just raw shells (`$SHELL` or `bash`) with add/close tabs and independent PTYs.

The existing infrastructure covers every hard problem already. `usePty` connects via WebSocket and manages a PTY session. `useSessionManager` manages a list of tab entries with UUIDs, add/close, and persistence. The `Terminal` component handles xterm.js lifecycle. The server-side `spawnSession` + `SessionRegistry` are generic — they accept any command. The bottom panel already has a `.bottom-panel-tab-bar-tabs` slot and a `.bottom-panel-body` that are currently empty.

The main engineering decisions are: (1) which command to spawn for a raw shell, (2) whether to create a dedicated `useRawTerminalManager` or reuse `useSessionManager`, (3) how to lay out the xterm terminal inside `.bottom-panel-body` without Composer or AttachBar overhead, and (4) localStorage key namespacing to avoid collision with the top panel.

**Primary recommendation:** Reuse `usePty` directly (not through `useSession` which bundles editor tabs and attachments). Create a thin `RawTerminalPane` component — just xterm terminal, no Composer. Create a new `useRawSessionManager` (a slimmed copy of `useSessionManager`) scoped to bottom panel sessions. Wire add/close tab controls into `.bottom-panel-tab-bar-tabs`.

---

## Standard Stack

### Core (all already installed — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xterm/xterm` | already in project | Terminal emulator in browser | Existing — already powering top panel |
| `@xterm/addon-fit` | already in project | Auto-fit terminal to container | Existing — already used in `Terminal.tsx` |
| `@xterm/addon-webgl` | already in project | GPU-accelerated rendering | Existing — already used in `Terminal.tsx` |
| `node-pty` | already in project | Spawn PTY processes server-side | Existing — already used in `pty-manager.ts` |
| `ws` | already in project | WebSocket server | Existing — same `/ws` endpoint |

**No new packages needed.** The bottom panel terminals use the identical WS/PTY stack as the top panel.

### Shell command for raw sessions

```typescript
// Raw shell — use login shell from env, fall back to bash
const SHELL_COMMAND = process.env.SHELL ?? '/bin/bash';
const SHELL_ARGS: string[] = [];
```

The existing `spawnSession(cwd, cols, rows, command, args)` in `pty-manager.ts` accepts arbitrary command/args — passing `SHELL_COMMAND` with empty args spawns an interactive shell. No server changes needed.

---

## Architecture Patterns

### Recommended Project Structure (changes only)

```
client/
├── components/
│   ├── RawTerminalPane.tsx    -- NEW: xterm terminal only, no composer
│   └── RawTerminalTabBar.tsx  -- NEW: tab strip for bottom panel (add/close)
├── hooks/
│   └── useRawSessionManager.ts -- NEW: slimmed session manager for bottom panel
client/App.tsx                  -- MODIFIED: wire bottom panel sessions
client/App.css                  -- MODIFIED: add bottom panel tab + terminal CSS
tests/
└── App.rawTerminal.test.tsx    -- NEW: Wave 0 RED stubs for RAWTERM requirements
```

### Pattern 1: RawTerminalPane — xterm without Composer

**What:** A component that owns a `Terminal` instance (xterm.js) and wires it to `usePty`. No AttachBar, no Composer, no editor tabs. Display-only when inactive (same `display:none` pattern as `SessionPane`).

**When to use:** Every bottom panel tab renders one of these.

```typescript
// Simplified pattern — mirrors SessionPane minus useSession/attachments/editor
function RawTerminalPane({ sessionId, cwd, isActive }: RawTerminalPaneProps) {
  const [terminal, setTerminal] = useState<XTerminal | null>(null);
  const [visibleKey, setVisibleKey] = useState(0);
  const wasActiveRef = useRef(isActive);

  useEffect(() => {
    if (isActive && !wasActiveRef.current) setVisibleKey(k => k + 1);
    wasActiveRef.current = isActive;
  }, [isActive]);

  const cols = terminal?.cols ?? 80;
  const rows = terminal?.rows ?? 24;

  const { sendInput, sendResize } = usePty({
    cwd,
    terminal,
    cols,
    rows,
    agentConfig: { command: SHELL_COMMAND, args: SHELL_ARGS, label: 'shell' },
    sessionId,
    // No onStatus, onExit, onData needed for basic raw terminal
  });

  return (
    <div style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
      <Terminal
        onReady={setTerminal}
        sendResize={(c, r) => { if (isActive) sendResize(c, r); }}
        visibleKey={visibleKey}
      />
    </div>
  );
}
```

**Key insight:** `usePty` already handles PTY lifecycle, WebSocket connect, data/exit events, and reconnect. The `agentConfig` prop is just used as `{ command, args }` — passing shell command here requires no server change because `spawnSession` is already generic.

### Pattern 2: useRawSessionManager — slimmed session state

**What:** Manages bottom panel tab list (sessions), active tab, add/close. Does NOT need `updateName`, `hasPrompted`, `history`, `restoreForCwd`, or persistence tied to project cwd. Simpler than `useSessionManager`.

```typescript
// Minimum interface for bottom panel
interface RawSession {
  id: string;
  status: SessionStatus;
  cwd: string;
}

function useRawSessionManager(cwd: string | null) {
  const [sessions, setSessions] = useState<RawSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const add = useCallback(() => {
    if (!cwd || sessions.length >= 8) return;
    const id = crypto.randomUUID();
    setSessions(prev => [...prev, { id, cwd, status: 'connecting' }]);
    setActiveId(id);
    return id;
  }, [cwd, sessions.length]);

  const remove = useCallback((id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      // If closing the active tab, activate the adjacent one
      if (activeId === id) setActiveId(next[next.length - 1]?.id ?? null);
      return next;
    });
  }, [activeId]);

  return { sessions, activeId, setActive: setActiveId, add, remove };
}
```

**Decision point (Claude's discretion):** Whether to use a standalone hook or reuse `useSessionManager` by adding a `namespace` prop. Standalone is cleaner — bottom panel sessions have no name extraction, no history, no reconnect semantics.

### Pattern 3: Bottom panel tab bar with add/close controls

**What:** Replaces the currently empty `.bottom-panel-tab-bar-tabs` slot with real tab chips.

```tsx
// In App.tsx bottom-panel-tab-bar area:
<div className="bottom-panel-tab-bar">
  <div className="bottom-panel-tab-bar-tabs">
    {rawSessions.map(s => (
      <button
        key={s.id}
        className={`bpanel-tab${s.id === rawActiveId ? ' bpanel-tab--active' : ''}`}
        onClick={() => rawSetActive(s.id)}
      >
        <span className="bpanel-tab-label">shell</span>
        <button className="bpanel-tab-close" onClick={e => { e.stopPropagation(); rawRemove(s.id); }}>×</button>
      </button>
    ))}
    <button className="bpanel-add-btn" onClick={rawAdd} title="New terminal">+</button>
  </div>
  <button className="bottom-panel-toggle-btn" onClick={toggleBottomPanel}>...</button>
</div>
```

### Pattern 4: Shell sessions lazy-start

**What:** Bottom panel PTY sessions only spawn when the panel is opened AND a tab exists. Do not spawn until `cwd` is set.

**Why:** Avoids spawning shells for a panel the user never opens. `usePty` already handles this — it early-returns when `cwd` is null, so `RawTerminalPane` mounted with `cwd=null` does nothing.

**Implementation:** The `add` function in `useRawSessionManager` checks `if (!cwd) return`. Alternatively, seed one session automatically when the bottom panel is first opened.

### Auto-seed pattern (recommended)

```typescript
// In App.tsx — when panel is first opened and no raw sessions exist, spawn one
useEffect(() => {
  if (bottomPanelOpen && cwd && rawSessions.length === 0) {
    rawAdd();
  }
}, [bottomPanelOpen, cwd]);
```

This gives instant utility without requiring the user to click "+".

### Anti-Patterns to Avoid

- **Reusing `useSession`:** `useSession` bundles editor tabs, attachments, and agent config. That's 3x the code for a raw terminal. Use `usePty` directly.
- **Sharing SessionManager with top panel:** Bottom panel sessions have completely different lifecycle needs. Mixing them into the existing `useSessionManager` creates coupling and naming/history pollution.
- **Passing `agentConfig` from settings for raw shells:** The shell command is `$SHELL`, not the configured Claude CLI agent. Hardcode it separately; do not read from `settings.agent`.
- **Spawning PTY before panel is open:** Wasted processes. Gate on `bottomPanelOpen`.
- **Reusing localStorage keys from top panel:** All `slopmop_sessions_*` and `slopmop_active:*` keys belong to top panel sessions. Use a distinct namespace: `slopmop_raw_sessions` if persistence is wanted (likely out of scope for this phase — see below).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal rendering | Custom DOM terminal | `Terminal.tsx` + xterm.js (already exists) | Handles colors, ANSI, resize, WebGL, scrollback |
| PTY lifecycle | Custom WS protocol | `usePty` (already exists) | Handles connect, reconnect, exit, data streaming |
| PTY process management | New server endpoint | `spawnSession` + `/ws` (already exists) | Generic command/args — works for any shell |
| Drag-to-resize | Custom drag handler | `useDragResize` (already exists) | Already proven in sidebar, editor, canvas, bottom panel |
| Tab scroll overflow | Custom scroll logic | Follow `SessionTabBar` pattern | Already handles overflow + scroll arrows |

---

## Common Pitfalls

### Pitfall 1: xterm.js `fit()` on hidden panels

**What goes wrong:** Calling `fitAddon.fit()` while the terminal container has `display:none` results in 0-column terminals. On reveal, the terminal stays wrong-sized until manually resized.

**Why it happens:** `fit()` reads `clientWidth`/`clientHeight` which are 0 when hidden.

**How to avoid:** The `visibleKey` pattern already exists in `Terminal.tsx` (line 79-93) — parent bumps a key when making the pane visible, `Terminal` calls `requestAnimationFrame(() => fit.fit())`. Use identical pattern in `RawTerminalPane`.

**Warning signs:** Terminal appears blank or renders with 1-column width on tab switch.

### Pitfall 2: Resize sent to all PTYs when only active tab should resize

**What goes wrong:** Multiple `RawTerminalPane` components all call `sendResize` on their PTY. When a resize event fires, all PTYs get resized including background ones.

**How to avoid:** Gate `sendResize` on `isActive` — same pattern used in `SessionPane` line 110: `if (isActive) session.sendResize(c, r)`.

### Pitfall 3: Shell spawned with wrong cwd

**What goes wrong:** If a raw session is spawned before `cwd` is set (or with a stale value), the shell starts in the wrong directory.

**How to avoid:** `usePty` already guards on `cwd` being non-null (line 59: `if (!cwd || !terminal) return`). Pass the current `cwd` at spawn time and store it in the session entry. Since the bottom panel shares the same project folder as the top panel, always use App-level `cwd`.

### Pitfall 4: PTY auto-restart fighting with user intent

**What goes wrong:** When a raw shell exits (user types `exit`), `usePty` auto-spawns a fresh session after 800ms (lines 100-108 in usePty.ts). This is correct behavior for the top panel but may surprise users in the bottom panel who closed the shell intentionally.

**How to avoid:** Accept the behavior as-is for v1 — auto-restart is the same behavior users see in the top panel and matches VS Code integrated terminal behavior. Alternatively, pass `onExit` callback to `updateStatus` so the tab shows 'done' and the user can manually close or click to reopen.

### Pitfall 5: Tab bar always visible but panel not open — clicking "+" doesn't open panel

**What goes wrong:** If the add-tab button is always rendered in the tab bar (even when panel is closed), clicking "+" adds a session but doesn't automatically open the panel. The user sees a new tab chip but no terminal.

**How to avoid:** Either: (a) call `setBottomPanelOpen(true)` inside `rawAdd`, or (b) only show the "+" button when the panel is open. Option (a) is simpler and matches expected behavior (opening a terminal implies you want to see it).

### Pitfall 6: `display:none` pane still receiving keyboard focus

**What goes wrong:** Inactive panes with `display:none` should not capture keyboard events, but if xterm.js binds global listeners, they can interfere.

**How to avoid:** `Terminal.tsx` uses `display:none` on the parent div — xterm.js correctly stops receiving input when its container is hidden. This is proven by the top panel's multi-session implementation. Same pattern will work.

---

## Code Examples

### Verified: spawnSession with custom command (pty-manager.ts)

```typescript
// Source: server/pty-manager.ts lines 14-32
// command defaults to 'claude' but accepts any executable
export function spawnSession(
  cwd: string,
  cols: number,
  rows: number,
  command: string = 'claude',
  args: string[] = [],
): pty.IPty {
  return pty.spawn(command, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: { ...process.env, PATH: LOGIN_PATH, TERM: 'xterm-256color' },
  });
}
// No server changes needed — pass SHELL_COMMAND as agentConfig.command
```

### Verified: usePty agentConfig plumbing (usePty.ts → ws-handler.ts)

```typescript
// Source: client/hooks/usePty.ts line 70
send({ type: 'start', sessionId: resolvedSessionId, cwd, cols, rows,
       agentCommand: agentConfig.command, agentArgs: agentConfig.args });

// Source: server/ws-handler.ts line 48
const ptyProcess = spawnSession(msg.cwd, msg.cols, msg.rows, msg.agentCommand, msg.agentArgs);
// → agentCommand='bash', agentArgs=[] → spawns raw shell. Zero server changes.
```

### Verified: visibleKey re-fit pattern (Terminal.tsx lines 79-93)

```typescript
// Source: client/components/Terminal.tsx
useEffect(() => {
  if (visibleKey === undefined) return;
  // ...
  requestAnimationFrame(() => {
    try {
      fit.fit();
      sendResize(term.cols, term.rows);
      term.refresh(0, term.rows - 1);
    } catch { /* xterm may be mid-dispose */ }
  });
}, [visibleKey, sendResize]);
// RawTerminalPane must bump visibleKey when becoming active — same as SessionPane
```

### Verified: display:none isolation (SessionPane.tsx line 136)

```typescript
// Source: client/components/SessionPane.tsx line 136
<div style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden' }}>
// RawTerminalPane uses identical pattern
```

### Verified: Protocol — start message (shared/protocol.ts)

```typescript
// Source: shared/protocol.ts
| { type: 'start'; sessionId: string; cwd: string; cols: number; rows: number;
    agentCommand: string; agentArgs: string[] }
// For raw shell: agentCommand = process.env.SHELL ?? '/bin/bash', agentArgs = []
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| — | Reuse existing /ws endpoint | No new server surface. All PTY management happens through ws-handler.ts → session-registry.ts |
| — | usePty directly (not useSession) | Avoids editor tabs + attachment overhead per pane |

---

## Phase Requirements (derived from goal)

Since no requirement IDs were pre-assigned, derived from the phase goal:

| ID | Description |
|----|-------------|
| RAWTERM-01 | The bottom panel body contains at least one xterm.js terminal connected to a live PTY shell |
| RAWTERM-02 | The bottom panel tab bar shows a tab chip per shell session with an "add" (+) button and per-tab close (×) |
| RAWTERM-03 | Clicking a tab chip switches the active terminal (inactive terminals use display:none, not unmount) |
| RAWTERM-04 | Clicking × closes the tab and kills the PTY session; if it was the active tab, the adjacent tab becomes active |
| RAWTERM-05 | Opening the bottom panel for the first time auto-seeds one shell session (no manual + click required) |
| RAWTERM-06 | The shell spawns in the current project cwd (same as the top panel's cwd) |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x + React Testing Library |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/App.rawTerminal.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RAWTERM-01 | Bottom panel body contains a `.raw-terminal-pane` element when open | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | Wave 0 |
| RAWTERM-02 | Tab bar renders bpanel-tab chips and bpanel-add-btn | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | Wave 0 |
| RAWTERM-03 | Clicking tab chip calls setActive; inactive panes are hidden not unmounted | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | Wave 0 |
| RAWTERM-04 | Clicking × removes session and activates adjacent | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | Wave 0 |
| RAWTERM-05 | Opening bottom panel seeds one session automatically | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | Wave 0 |
| RAWTERM-06 | Shell spawns with project cwd | unit (usePty mock assertion) | `npx vitest run tests/App.rawTerminal.test.tsx` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/App.rawTerminal.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/App.rawTerminal.test.tsx` — covers RAWTERM-01 through RAWTERM-06

All other infrastructure (useSessionManager tests, usePty tests, session-registry tests) already exists. New test file follows the established `App.bottomPanel.test.tsx` pattern with heavy mocking of `useDragResize`, `useSessionManager`, xterm.js, and WebSocket.

---

## Open Questions

1. **Shell command source**
   - What we know: `process.env.SHELL` gives the user's default shell on macOS/Linux.
   - What's unclear: Should the shell be configurable per-tab (bash vs zsh vs fish) or fixed?
   - Recommendation: Fix to `process.env.SHELL ?? '/bin/bash'` for v1 — keep it simple.

2. **Raw session persistence across reload**
   - What we know: Top panel sessions persist via `useSessionManager` + localStorage + server-side `SessionRegistry`.
   - What's unclear: Should bottom panel shell sessions also survive reload?
   - Recommendation: No persistence for v1 — raw shell sessions are ephemeral. On reload, start fresh. The server-side SessionRegistry TTL (30 min) will clean them up. This avoids complexity and matches typical IDE terminal behavior (VS Code integrated terminal does not persist across window reload).

3. **Tab naming**
   - What we know: Top panel tabs are named from first user input (`extractSessionName`).
   - What's unclear: What should bottom panel tab names be?
   - Recommendation: Static label "shell" or "bash" (from command name) — no dynamic extraction needed. Optionally: number them shell 1, shell 2.

4. **Max sessions**
   - What we know: Top panel caps at 8 sessions (`MAX_SESSIONS = 8` in `useSessionManager`).
   - Recommendation: Apply same cap (4 or 8) to bottom panel. Bottom panel is smaller so 4 may be more appropriate.

---

## Sources

### Primary (HIGH confidence)

- Direct code read: `client/hooks/usePty.ts` — full PTY hook interface and lifecycle
- Direct code read: `client/hooks/useSessionManager.ts` — session tab management patterns
- Direct code read: `client/components/SessionPane.tsx` — display:none isolation, visibleKey pattern
- Direct code read: `client/components/Terminal.tsx` — xterm.js init, fitAddon, visibleKey refit
- Direct code read: `server/pty-manager.ts` — `spawnSession` accepts arbitrary command/args
- Direct code read: `server/ws-handler.ts` — WS protocol, session registry wiring
- Direct code read: `shared/protocol.ts` — ClientMessage/ServerMessage types
- Direct code read: `client/App.tsx` — bottom panel shell structure (lines 598-628), UI state patterns
- Direct code read: `client/App.css` — existing bottom panel CSS classes
- Direct code read: `.planning/phases/12-bottom-panel-shell/12-VERIFICATION.md` — confirmed Phase 12 deliverables

### Secondary (MEDIUM confidence)

- Pattern inference: `useRawSessionManager` shape derived from `useSessionManager` + phase goal scope reduction

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all libraries already installed and proven
- Architecture: HIGH — patterns are direct extractions from existing working code
- Pitfalls: HIGH — all pitfalls derived from actual code paths (display:none, resize, auto-restart)
- Open questions: MEDIUM — recommendations based on project conventions, not external docs

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (stable stack — no external dependencies changing)
