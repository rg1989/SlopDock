# Phase 16: Overlays + Cleanup - Research

**Researched:** 2026-05-03
**Domain:** React overlay patterns, xterm.js key interception, CSS positioning, component cleanup
**Confidence:** HIGH

## Summary

Phase 16 attaches the floating action bar (Attach/Voice/TTS), slash command popup, and attachment chip strip to the new `TerminalInput` xterm.js strip that Phase 15 delivered. The old `Composer.tsx` textarea component must be fully deleted. All overlay infrastructure must be built from scratch using plain CSS + React — the project has no existing overlay primitives and prohibits external UI libraries.

The key architectural insight is that the three overlay types require three different positional strategies: the action bar floats inside the terminal input strip container (absolute positioning relative to a `position: relative` wrapper), the attachment chips float in a strip directly above the input strip (also absolute), and the slash command popup must render above everything using either `position: fixed` computed from `getBoundingClientRect()` or a React portal — exactly the pattern already proven in the existing `SlashMenu.tsx` + `Composer.tsx` codebase.

All three overlay components (`AttachBar.tsx`, `SlashMenu.tsx`, `VoiceBar.tsx`) already exist and are production-ready. The work is: (1) wire them to `TerminalInput` via props, (2) add a `position: relative` wrapper around the input strip so absolute overlays anchor correctly, (3) intercept the `/` keystroke in xterm.js using `attachCustomKeyEventHandler`, and (4) delete `Composer.tsx` and its test.

**Primary recommendation:** Wrap `TerminalInput` in a `position: relative` container in `SessionPane`, pass overlay state down as props, intercept `/` with xterm's `attachCustomKeyEventHandler`, and reuse all three existing overlay components unchanged.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACTION-01 | Attach, Voice, and TTS buttons float as an overlay on the terminal input surface | Absolute-positioned overlay inside `position: relative` wrapper around `.terminal-input-strip` |
| ACTION-02 | Action bar is always accessible and does not obscure the terminal input line | Position at top-right of wrapper (not bottom where cursor lives); CSS ensures no overlap with xterm cursor row |
| SLASH-01 | Typing `/` in terminal input opens slash command popup overlay above the input | xterm `attachCustomKeyEventHandler` intercepts `/`; `SlashMenu` already uses `position: fixed` + `getBoundingClientRect()` |
| SLASH-02 | User can navigate popup with arrow keys and select with Enter | Arrow/Enter key events intercepted in same custom handler when slash menu is open; must return `false` to suppress xterm handling |
| ATTACH-01 | Attached files appear as chips in a floating strip above the terminal input | `AttachBar` component already exists; render it as absolute overlay strip above the input surface |
| ATTACH-02 | User can dismiss individual attachment chips before sending | `removeAttachment` already exists in `useSession`; needs to be threaded into `SessionPaneActions` |
| CLEAN-01 | Old Composer textarea component and textarea-specific code is fully removed | Delete `Composer.tsx`, `Composer.test.tsx`; remove `.composer-bottom`, `.composer-area`, `.composer-input` CSS; verify no remaining imports |
</phase_requirements>

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xterm/xterm | installed | `attachCustomKeyEventHandler` for `/` interception | Already used in Terminal.tsx and TerminalInput.tsx |
| React 18 | installed | Component state, portals | Project stack |
| Plain CSS + inline styles | n/a | Overlay positioning | Project rule: no CSS-in-JS, no Tailwind |

### Reused Components (all exist, no changes needed)

| Component | File | Role in Phase 16 |
|-----------|------|-----------------|
| `VoiceBar` | `client/components/VoiceBar.tsx` | Render in floating action bar overlay |
| `AttachBar` | `client/components/AttachBar.tsx` | Render as attachment chips strip overlay |
| `SlashMenu` | `client/components/SlashMenu.tsx` | Render as popup overlay above input |

**No new dependencies.** This phase is pure composition and CSS.

---

## Architecture Patterns

### Recommended Component Structure

```
SessionPane
└── <div style={{ position: 'relative' }}>   ← NEW wrapper for overlays
    ├── <AttachChipStrip />                   ← absolute, top of wrapper, above input
    ├── <ActionBar />                         ← absolute, top-right corner of wrapper
    └── <TerminalInput ref={inputRef} ... />  ← existing 80px strip
        └── (xterm canvas, managed internally)
```

`SlashMenu` renders via React portal to `document.body` using `position: fixed`, anchored to the wrapper's `getBoundingClientRect()` — this is identical to how it worked in `Composer.tsx`.

### Pattern 1: Absolute Overlay Inside Relative Wrapper

**What:** Wrap `.terminal-input-strip` in a `position: relative` container. Float action bar and chip strip as `position: absolute` children.

**When to use:** For UI elements that must stay visually attached to the terminal input strip and scroll with it.

```tsx
// In SessionPane.tsx — replace the bare <TerminalInput ... /> with:
<div className="terminal-input-wrapper" style={{ position: 'relative', flexShrink: 0 }}>
  {session.attachments.length > 0 && (
    <AttachBar
      attachments={session.attachments}
      onRemove={session.removeAttachment}
    />
  )}
  <ActionBar
    session={session}
    voiceSlot={voiceSlot}
    cwd={cwd}
    onAttach={session.addAttachments}
    picking={picking}
    onPickFile={handlePickFile}
  />
  <TerminalInput
    ref={inputRef}
    sendInput={handleSendInput}
    connected={session.connected}
    accentHex={accentHex}
    onSlashOpen={handleSlashOpen}
    onSlashClose={handleSlashClose}
  />
</div>
```

### Pattern 2: Action Bar Positioning — Does Not Cover Cursor

**What:** The action bar must not cover the active terminal cursor row. Place it at the top of the wrapper (`top: 0`, `right: 0`) as a thin horizontal strip, not at the bottom. The xterm canvas always renders cursor at the bottom row.

**Critical detail:** `.terminal-input-strip` has `height: 80px` (4 rows × ~20px). The action bar placed at `top: 0` leaves the bottom 60px (rows 2–4) clear for the cursor. This satisfies ACTION-02.

```css
/* App.css additions */
.terminal-input-wrapper {
  position: relative;
  flex-shrink: 0;
}

.terminal-action-bar {
  position: absolute;
  top: 4px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 10;
  background: rgba(13, 17, 23, 0.8);  /* var(--bg) at 80% opacity */
  border-radius: 4px;
  padding: 2px 4px;
}

.terminal-attach-strip {
  position: absolute;
  bottom: 100%;   /* sits directly above the input wrapper */
  left: 0;
  right: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 8px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  z-index: 10;
}
```

### Pattern 3: xterm.js Slash Command Interception

**What:** xterm.js provides `terminal.attachCustomKeyEventHandler(handler)` which fires before xterm's default key processing. Return `false` to suppress the default xterm behavior; return `true` to allow it through.

**Critical details:**
- The handler receives a native `KeyboardEvent`
- Must intercept `/` on `keydown` to show the menu, and `ArrowUp`/`ArrowDown`/`Enter`/`Escape` when menu is open
- The slash character itself should NOT be forwarded to the PTY when opening the menu — but the implementation must choose: either (a) show the menu and still send `/` to xterm (simpler), or (b) show the menu and suppress `/` (cleaner UX). Option (a) is safer because the user sees `/` in the terminal as they type.
- When the user selects a command, call `terminal.paste(cmd.command + ' ')` to inject the full text after the `/` — or use `sendInput` directly.

```typescript
// Inside TerminalInput.tsx init() — after term.open()
term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
  // Only intercept keydown
  if (e.type !== 'keydown') return true;

  // When slash menu is open, intercept navigation keys
  if (slashMenuOpenRef.current) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      onSlashNavigate?.(e.key === 'ArrowUp' ? -1 : 1);
      return false; // suppress xterm
    }
    if (e.key === 'Enter') {
      onSlashSelect?.();
      return false;
    }
    if (e.key === 'Escape') {
      onSlashClose?.();
      return false;
    }
    // All other keys: close menu, let xterm handle
    onSlashClose?.();
    return true;
  }

  // Open slash menu when / is typed at start of input
  if (e.key === '/') {
    onSlashOpen?.();
    return true; // still send '/' to xterm so user sees it
  }

  return true;
});
```

**State management for slash menu:** `slashMenuOpenRef` must be a `useRef` (not state) to avoid stale closures inside the xterm event handler. The React state counterpart drives the render. Use the pattern: `const slashOpenRef = useRef(false)` updated whenever the React state changes.

```typescript
// In TerminalInput.tsx
const [slashOpen, setSlashOpen] = useState(false);
const slashOpenRef = useRef(false);

const openSlash = useCallback(() => {
  slashOpenRef.current = true;
  setSlashOpen(true);
  onSlashOpen?.();
}, [onSlashOpen]);

const closeSlash = useCallback(() => {
  slashOpenRef.current = false;
  setSlashOpen(false);
  onSlashClose?.();
}, [onSlashClose]);
```

**Alternative:** Lift slash state entirely to `SessionPane` and pass callbacks down. This keeps `TerminalInput` simpler but requires the custom key handler to call parent callbacks — which is the same ref-closure problem. Keep slash state in `TerminalInput` and expose it via `TerminalInputHandle`.

### Pattern 4: Slash Command Selection — Injecting into xterm

When a slash command is selected from the menu, inject the full command text replacing the `/` already typed:

```typescript
// In TerminalInput, expose via handle:
injectText: (text: string) => {
  // Clear the '/' already sent, then inject the command
  terminal?.paste('\b'.repeat(currentInputLength) + text);
  // OR: use sendInput to send the full replacement
};
```

**Simpler approach:** Since xterm input strip is input-only (not a real readline buffer), just send the command text directly via `sendInput`. The `/` is already echoed by xterm — send backspace first to erase it, then the command.

Actually, the cleanest approach for a terminal: when the user selects a command, call `sendInput('\x7f' + cmd.command + '\r')` — `\x7f` is DEL/backspace which erases the `/`. But this depends on the PTY line discipline. A more reliable approach: use `terminal.write()` to render the text locally (just for display) and `sendInput` to actually send it.

**Recommended:** Use `terminal.paste(text)` which both displays and queues the text for `onData`. This replaces the need for manual backspace handling.

### Pattern 5: AttachBar as Floating Strip vs. Static Row

The existing `AttachBar` uses `.attach-bar` CSS class which renders as a normal document-flow row with `border-top`. For Phase 16, it should float above the input strip using `position: absolute; bottom: 100%` on a new `.terminal-attach-strip` wrapper. The existing `.attach-chip` CSS can be reused unchanged — only the container positioning changes.

### Anti-Patterns to Avoid

- **Don't use `position: fixed` for the action bar** — it detaches from the terminal input wrapper when panels resize. Use `absolute` within the `relative` wrapper instead.
- **Don't store slash menu selection state inside xterm's key handler closure** — closures capture initial state values. Use `useRef` for any value the handler needs to read.
- **Don't re-initialize xterm to change key handling** — `attachCustomKeyEventHandler` can be called once after `term.open()` and its closure can close over refs that are mutated later.
- **Don't forget to re-wire `attachCustomKeyEventHandler` after terminal re-creation** — the handler is attached to the terminal instance, so if `TerminalInput` re-mounts it must re-attach.
- **Don't skip deleting `Composer.test.tsx`** — leaving the test file will cause vitest to run tests for a deleted component and fail.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slash command popup UI | Custom popup component | `SlashMenu.tsx` (exists) | Already handles fixed positioning, scroll, keyboard nav |
| Attachment chip UI | Custom chip component | `AttachBar.tsx` (exists) | Already styled to project system |
| Voice/TTS button UI | Custom button components | `VoiceBar.tsx` (exists) | Already handles all states, errors, compact mode |
| File picker | Native dialog logic | `/api/pick-file` + `fetch` (already in Composer.tsx) | Server-side file picker already implemented |
| Attachment state | Custom useState | `useSession.attachments` + `removeAttachment` | Already in session hook, just needs wiring |

**Key insight:** Phase 16 is almost entirely composition work. The hard parts (slash menu, attach chips, voice buttons, file picker API) already exist. The new work is: one wrapper div, one new small `ActionBar` component, CSS for three overlay positions, and the xterm key handler.

---

## Common Pitfalls

### Pitfall 1: Stale Closure in xterm Key Handler

**What goes wrong:** `attachCustomKeyEventHandler` captures variable values at attachment time. If `slashOpen` is `false` when the handler is attached, checking `slashOpen` inside the handler will always see `false`.

**Why it happens:** xterm stores the handler function reference, not a reactive binding. React state updates don't re-run the handler setup.

**How to avoid:** Use `useRef` for any boolean the handler reads. Update the ref whenever the state changes via a `useEffect`. The ref is a stable object whose `.current` property is always current.

**Warning signs:** Arrow keys do nothing when slash menu is open; menu never closes on Escape.

### Pitfall 2: Action Bar Covering the Cursor Row

**What goes wrong:** Placing the action bar at the bottom of the 80px strip (where `bottom: 6px`) covers the xterm cursor — the user can't see what they're typing.

**Why it happens:** xterm renders the cursor at the last visible row, which is visually at the bottom of the terminal canvas.

**How to avoid:** Place the action bar at `top: 4px, right: 8px` (top-right corner). The cursor row is always the bottommost row, which remains uncovered.

**Warning signs:** SUCCESS CRITERIA #2 fails — "cursor remain visible with the bar present."

### Pitfall 3: `removeAttachment` Not in SessionPaneActions

**What goes wrong:** `SessionPane` exposes `addAttachment` in `SessionPaneActions` but not `removeAttachment`. The App-level `activeActionsRef` can't call remove, and `AttachBar` can't be wired.

**Why it happens:** `removeAttachment` exists in `useSession` but was never added to the `SessionPaneActions` interface or the `onRegisterActions` call.

**How to avoid:** In Wave 0, verify whether `removeAttachment` needs to be threaded from `useSession` → `SessionPane` local state → `onRegisterActions`. For Phase 16, `AttachBar` is rendered inside `SessionPane` (not App), so it can directly access `session.removeAttachment` — no need to hoist it to App. This is the clean path.

**Warning signs:** Clicking X on a chip does nothing; TypeScript error on `session.removeAttachment`.

### Pitfall 4: CLEAN-01 — Orphaned CSS and Test

**What goes wrong:** Deleting `Composer.tsx` but leaving `.composer-bottom`, `.composer-area`, `.composer-input` CSS rules and `Composer.test.tsx` — vitest fails, bundle carries dead CSS.

**Why it happens:** Cleanup tasks are underestimated. The CSS classes are in `App.css` around lines 55–98.

**How to avoid:** Explicitly list every artifact to delete in the plan: `client/components/Composer.tsx`, `tests/Composer.test.tsx`, and the CSS block in `App.css`. Also verify no stale imports remain (`grep -r "Composer" client/ tests/`).

**Warning signs:** `vitest run` reports "Cannot find module '../client/components/Composer'".

### Pitfall 5: Slash Detection — When to Open the Menu

**What goes wrong:** Opening the slash menu on every `/` keystroke including `/` mid-word or in the middle of a path argument breaks normal typing.

**Why it happens:** Naive implementation triggers on any `/` key.

**How to avoid:** Only open when the xterm input buffer is empty (i.e., `/` is the first character typed). Detect this by tracking whether `sendInput` has been called since the last Enter. A simple `inputBufferEmptyRef` boolean that is set `true` on Enter and `false` on any other `onData` call works. Alternatively, mirror what `Composer.tsx` does: only open when `/` appears at the start of the current line.

---

## Code Examples

### Minimal xterm key interception

```typescript
// Source: xterm.js official API — attachCustomKeyEventHandler
// Called once after term.open() in TerminalInput init()
const slashMenuOpenRef = { current: false };

term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
  if (e.type !== 'keydown') return true;
  if (slashMenuOpenRef.current) {
    if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
      return false; // suppress — handled by React
    }
    slashMenuOpenRef.current = false; // any other key closes menu
    return true;
  }
  if (e.key === '/' ) {
    // Only open if input appears empty
    if (inputEmptyRef.current) {
      slashMenuOpenRef.current = true;
      setSlashOpen(true);
    }
    return true; // still send '/' to xterm
  }
  return true;
});
```

### Overlay wrapper in SessionPane

```tsx
// Replace bare <TerminalInput ... /> in SessionPane with:
<div className="terminal-input-wrapper">
  {session.attachments.length > 0 && (
    <div className="terminal-attach-strip">
      <AttachBar attachments={session.attachments} onRemove={session.removeAttachment} />
    </div>
  )}
  <div className="terminal-action-bar">
    <ActionBarButtons
      cwd={cwd}
      onAttach={session.addAttachments}
      voiceSlot={voiceSlot}
    />
  </div>
  <TerminalInput
    ref={inputRef}
    sendInput={handleSendInput}
    connected={session.connected}
    accentHex={accentHex}
    onSlashOpen={handleSlashOpen}
    onSlashClose={handleSlashClose}
    onSlashNavigate={handleSlashNavigate}
    onSlashSelect={handleSlashSelect}
  />
  {slashOpen && slashItems.length > 0 && (
    <SlashMenu
      items={slashItems}
      selectedIndex={slashIndex}
      onSelect={handleSlashSelect}
      onClose={handleSlashClose}
      anchorRect={inputWrapperRef.current?.getBoundingClientRect() ?? new DOMRect()}
    />
  )}
</div>
```

### Attachment file picker (pattern from Composer.tsx)

```typescript
const handlePickFile = async () => {
  if (picking) return;
  setPicking(true);
  try {
    const res = await fetch('/api/pick-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    if (res.ok) {
      const { paths } = await res.json() as { paths: string[] };
      if (paths.length > 0) session.addAttachments(paths);
    }
  } finally {
    setPicking(false);
  }
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Composer textarea as input surface | xterm.js terminal strip (`TerminalInput.tsx`) | Phase 15 | All overlays must anchor to xterm container, not a textarea |
| SlashMenu anchored to textarea's `getBoundingClientRect()` | SlashMenu anchored to terminal-input-wrapper's `getBoundingClientRect()` | Phase 16 | One-line anchor change in `SlashMenu.tsx` or call site |
| AttachBar rendered above composer-area in document flow | AttachBar rendered as `position: absolute` strip above input strip | Phase 16 | CSS positioning change; component itself unchanged |
| VoiceBar rendered inside Composer's bottom toolbar | VoiceBar rendered in floating action bar overlay | Phase 16 | VoiceBar component unchanged; position changed |

**Deprecated by Phase 16:**
- `Composer.tsx` — delete entirely
- `.composer-bottom`, `.composer-area`, `.composer-input` CSS — delete from App.css
- `Composer.test.tsx` — delete (tests a deleted component)

---

## Open Questions

1. **Slash command injection after selection**
   - What we know: `terminal.paste(text)` sends text through `onData` to the PTY; but the `/` is already in the PTY buffer
   - What's unclear: Does the PTY's line discipline support backspace (`\x7f`) to erase the `/` before the command text is injected?
   - Recommendation: Test in Wave 1 with a real PTY. If backspace doesn't work cleanly, use a different approach: suppress the `/` in `attachCustomKeyEventHandler` (return `false`) so it never reaches the PTY, then on selection inject only the command text without the leading slash. This is the same approach `Composer.tsx` used (it replaced the slash+query with the command text).

2. **voiceSlot prop threading**
   - What we know: `SessionPane` receives `voiceSlot` as a `ReactNode` prop and currently passes it to `TerminalInput` (but `TerminalInput` doesn't render it — see the current props interface)
   - What's unclear: Does `TerminalInput` currently accept and render `voiceSlot`? (Current code shows it does NOT — `voiceSlot` is passed to `SessionPane` but not forwarded anywhere in the current implementation)
   - Recommendation: The action bar in `SessionPane` should render `voiceSlot` directly. No prop threading to `TerminalInput` needed.

3. **Slash query filtering**
   - What we know: `Composer.tsx` filters `SLASH_COMMANDS` by both command name and description using the typed query after `/`
   - What's unclear: With xterm, we can't easily read what the user typed after `/` without mirroring the input buffer in React state
   - Recommendation: For Phase 16 MVP, open the slash menu showing all commands when `/` is typed at empty input, without filtering. Filtering by query is TINPUT-FUTURE territory. This aligns with terminal-native feel.

---

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library (vitest.config.ts at project root) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/TerminalInput.test.tsx tests/VoiceBar.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACTION-01 | Action bar buttons render in overlay | unit | `npx vitest run tests/SessionPane.test.tsx` | ❌ Wave 0 |
| ACTION-02 | Action bar at top of wrapper — cursor row visible | browser/visual | manual — inspect xterm cursor visibility | manual-only |
| SLASH-01 | xterm `/` key opens slash menu | unit | `npx vitest run tests/TerminalInput.test.tsx` | ✅ extend existing |
| SLASH-02 | Arrow/Enter navigation in slash menu | unit | `npx vitest run tests/TerminalInput.test.tsx` | ✅ extend existing |
| ATTACH-01 | Attachment chips render when attachments exist | unit | `npx vitest run tests/SessionPane.test.tsx` | ❌ Wave 0 |
| ATTACH-02 | Clicking X on chip calls removeAttachment | unit | `npx vitest run tests/SessionPane.test.tsx` | ❌ Wave 0 |
| CLEAN-01 | No Composer imports remain | grep | `grep -r "from.*Composer" client/ tests/ \| grep -v Composer.tsx` returns nothing | n/a (grep) |

**Manual-only justification for ACTION-02:** Visual overlay positioning and xterm cursor visibility cannot be validated in jsdom — xterm's canvas-based rendering is not present in the test environment.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/TerminalInput.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/SessionPane.test.tsx` — covers ACTION-01, ATTACH-01, ATTACH-02 (action bar render, chip render, chip dismiss)
- [ ] Extend `tests/TerminalInput.test.tsx` — add tests for SLASH-01 (key handler fires), SLASH-02 (navigation callbacks)

---

## Composer Cleanup Scope (CLEAN-01)

Files to delete:
- `client/components/Composer.tsx`
- `tests/Composer.test.tsx`

CSS to remove from `client/App.css` (by line range):
- Lines 55–60: `.composer-bottom` block
- Lines 70–79: `.composer-area` block
- Lines 92–98: `.composer-input` + `.composer-input:focus` block

Remaining references to verify are gone after deletion:
- `grep -r "Composer" client/` — should return zero results
- `grep -r "Composer" tests/` — should return zero results
- `grep "composer-bottom\|composer-area\|composer-input" client/App.css` — should return zero results

Note: `composerRef` in `App.tsx` is NOT Composer-related — it's the `TerminalInputHandle` ref and should be kept. The name is confusing but was preserved from Phase 15 to avoid churn; it can be renamed to `inputRef` as a minor cleanup in this phase but is not required.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `/Users/rgv250cc/Documents/Projects/SlopMop/client/components/TerminalInput.tsx` — xterm init pattern, async import
- Codebase: `/Users/rgv250cc/Documents/Projects/SlopMop/client/components/Composer.tsx` — slash menu wiring, file picker, attachment send pattern
- Codebase: `/Users/rgv250cc/Documents/Projects/SlopMop/client/components/SlashMenu.tsx` — fixed positioning, keyboard nav, `anchorRect` pattern
- Codebase: `/Users/rgv250cc/Documents/Projects/SlopMop/client/components/AttachBar.tsx` — chip UI, CSS classes
- Codebase: `/Users/rgv250cc/Documents/Projects/SlopMop/client/components/VoiceBar.tsx` — compact mode, all button states
- Codebase: `/Users/rgv250cc/Documents/Projects/SlopMop/client/hooks/useSession.ts` — `removeAttachment`, `addAttachments`, attachment state
- Codebase: `/Users/rgv250cc/Documents/Projects/SlopMop/client/App.css` — existing CSS classes, `.terminal-input-strip` (80px, border-top)
- xterm.js API: `attachCustomKeyEventHandler(handler)` — returns `false` to suppress, `true` to allow; documented in xterm.js source

### Secondary (MEDIUM confidence)

- xterm.js `terminal.paste(text)` — injects text as if typed, fires `onData`; confirmed by pattern usage in codebase and xterm.js documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components exist in codebase, verified directly
- Architecture: HIGH — overlay patterns are standard CSS + verified from existing Composer implementation
- xterm key interception: HIGH — `attachCustomKeyEventHandler` is xterm's documented API, the stale-closure pitfall is a known React pattern issue
- Pitfalls: HIGH — derived from direct code inspection of existing components

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (stable — no fast-moving dependencies)
