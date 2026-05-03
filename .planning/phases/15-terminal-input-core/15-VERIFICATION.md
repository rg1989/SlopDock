---
phase: 15-terminal-input-core
verified: 2026-05-03T21:20:00Z
status: human_needed
score: 8/9 must-haves verified
human_verification:
  - test: "Open a Claude session, type a message, press Enter"
    expected: "Characters appear in the xterm.js input strip (not a textarea); Enter sends PTY \\r and Claude responds"
    why_human: "PTY data flow and Claude response require a live browser + running server; jsdom cannot verify"
  - test: "Press arrow-up / arrow-down when Claude displays a permission menu"
    expected: "Menu selection moves natively without any JS event handler"
    why_human: "xterm.js ANSI passthrough and Claude CLI rendering requires live PTY session"
  - test: "Press Ctrl+C during Claude output"
    expected: "Output stops / Claude process interrupted"
    why_human: "Signal delivery through PTY cannot be verified in jsdom"
  - test: "Resize the browser window"
    expected: "Input strip height stays fixed at 80px; does not grow or shrink"
    why_human: "CSS layout behaviour requires a real browser; jsdom has no layout engine"
  - test: "Click anywhere in the display terminal area above the input strip"
    expected: "Focus redirects to the xterm.js input strip automatically"
    why_human: "Focus redirect requires a real browser focus model"
---

# Phase 15: Terminal Input Core — Verification Report

**Phase Goal:** Implement the xterm.js-based TerminalInput strip that replaces the textarea Composer as the primary input mechanism for Claude sessions.
**Verified:** 2026-05-03T21:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Test file exists and runs under Vitest | VERIFIED | `tests/TerminalInput.test.tsx` — 5/5 tests pass |
| 2 | All four requirements have failing-then-passing tests | VERIFIED | Wave 0 RED confirmed in 15-01-SUMMARY; Wave 1 GREEN confirmed by `npx vitest run tests/TerminalInput.test.tsx` → 5 passed |
| 3 | xterm.js modules are mocked for jsdom | VERIFIED | `vi.mock('@xterm/xterm')` + `vi.mock('@xterm/addon-fit')` at top of test file; `mockTerminal.loadAddon` present |
| 4 | TerminalInput mounts xterm.js and wires terminal.onData(sendInput) | VERIFIED | `TerminalInput.tsx` line 95: `terminal.onData(sendInput)` in `useEffect([terminal, sendInput])` |
| 5 | rows locked to 4 and scrollback 0 | VERIFIED | `TerminalInput.tsx` lines 42–43: `rows: 4, scrollback: 0` in XTerm constructor |
| 6 | Terminal.tsx accepts disableStdin prop | VERIFIED | `Terminal.tsx` line 14 interface + line 41 constructor option; SessionPane passes `disableStdin={true}` |
| 7 | SessionPane renders TerminalInput (not Composer textarea) | VERIFIED | `SessionPane.tsx` lines 7–8 import, lines 144–149 JSX render; no Composer or drag-resize block present |
| 8 | .terminal-input-strip CSS class exists with fixed height | VERIFIED | `App.css` line 62: `.terminal-input-strip { height: 80px; background: var(--bg); ... }` |
| 9 | composerRef wired to TerminalInputHandle.focus() | VERIFIED (automated) | `App.tsx` line 20 imports `TerminalInputHandle`; line 158 `useRef<TerminalInputHandle>`; SessionPane `ref={inputRef}`; focus called at lines 612 and 622 |

**Score:** 9/9 truths verified (5 require human confirmation for live-browser behaviour)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/TerminalInput.test.tsx` | Failing test scaffold (Wave 0), GREEN after Wave 1 | VERIFIED | 94 lines; 5 tests; xterm + fit-addon mocked; `capturedOnData` pattern; all GREEN |
| `client/components/TerminalInput.tsx` | xterm.js input strip; exports `TerminalInput`, `TerminalInputHandle` | VERIFIED | 107 lines; exports both; `rows:4`, `scrollback:0`, `onData(sendInput)`, `forwardRef+useImperativeHandle` |
| `client/components/Terminal.tsx` | Display terminal with `disableStdin` prop | VERIFIED | `disableStdin?: boolean` in interface + passed to XTerm constructor |
| `client/components/SessionPane.tsx` | Renders TerminalInput replacing Composer; `disableStdin={true}` on display terminal | VERIFIED | TerminalInput imported and rendered; display terminal has `disableStdin={true}`; `localInputRef` fallback; click redirect |
| `client/App.css` | `.terminal-input-strip` CSS | VERIFIED | Lines 62–70: `height: 80px`, CSS variables only (no raw hex) |
| `client/App.tsx` | composerRef typed as `TerminalInputHandle` | VERIFIED | Line 20 import; line 158 `useRef<TerminalInputHandle>` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/TerminalInput.test.tsx` | `client/components/TerminalInput.tsx` | import statement | WIRED | Line 14: `import { TerminalInput } from '../client/components/TerminalInput'` |
| `client/components/TerminalInput.tsx` | `sendInput` (prop) | `terminal.onData(sendInput)` in useEffect | WIRED | Line 95; effect depends on `[terminal, sendInput]` |
| `client/components/Terminal.tsx` | xterm.js constructor | `disableStdin` option | WIRED | Line 41: `disableStdin: disableStdin ?? false` |
| `client/components/SessionPane.tsx` | `client/components/TerminalInput.tsx` | import + JSX render | WIRED | Lines 7–8 import; lines 144–149 `<TerminalInput ref={inputRef} sendInput={handleSendInput} ...>` |
| `client/components/SessionPane.tsx` | `handleSendInput` | `sendInput={handleSendInput}` prop | WIRED | Line 146 |
| `composerRef` (App.tsx) | `TerminalInput.focus()` | `TerminalInputHandle` forwarded ref | WIRED | `App.tsx` line 637 passes `composerRef` to active SessionPane; SessionPane passes to `inputRef`; `focus()` called at lines 612 + 622 |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| TINPUT-01 | 15-01, 15-02, 15-03 | User can type/send via real xterm.js terminal (not textarea) | VERIFIED (automated + human needed) | `TerminalInput` rendered in SessionPane; `onData→sendInput` wired; test confirms byte passthrough |
| TINPUT-02 | 15-01, 15-02, 15-03 | Arrow keys navigate Claude permission menus natively | VERIFIED (automated + human needed) | Test 3 confirms `\x1b[A` / `\x1b[B` reach `sendInput`; live PTY behaviour needs human confirm |
| TINPUT-03 | 15-01, 15-02, 15-03 | Ctrl+C, Ctrl+D, Tab forwarded | VERIFIED (automated + human needed) | Test 4 confirms `\x03`, `\x04`, `\x09` reach `sendInput` |
| TINPUT-04 | 15-01, 15-02, 15-03 | Fixed small-height strip at bottom of session pane | VERIFIED (CSS automated + visual human needed) | `.terminal-input-strip { height: 80px }` in App.css; rendered at bottom of SessionPane flex column |

No orphaned requirements. All four TINPUT IDs are accounted for across all three plan files.

---

### Anti-Patterns Found

No blockers or warnings found.

| File | Pattern Checked | Result |
|------|----------------|--------|
| `client/components/TerminalInput.tsx` | TODO/FIXME, return null, empty handler | None found |
| `client/components/Terminal.tsx` | TODO/FIXME, stub returns | None found |
| `client/components/SessionPane.tsx` | TODO/FIXME, stub returns | None found |
| `client/App.css` | Raw hex values in terminal-input-strip block | None — all CSS variables |
| `tests/TerminalInput.test.tsx` | Skipped tests, empty assertions | None found |

The `::placeholder` and `placeholder=` matches in App.css/App.tsx are CSS pseudo-selectors and React props for unrelated search/text inputs — not implementation stubs.

---

### Test Suite Status

- `npx vitest run tests/TerminalInput.test.tsx` — **5/5 passed**
- `npx vitest run` (full suite) — **210/210 passed, 34 test files**

---

### Human Verification Required

#### 1. Input strip renders and accepts keystrokes

**Test:** Run `npm run dev`, open a Claude session, click the input strip at the bottom, type a few characters
**Expected:** Characters appear in the xterm.js strip with a blinking cursor; no textarea is visible anywhere in the session pane
**Why human:** DOM rendering and cursor visibility require a real browser

#### 2. Enter sends message to Claude

**Test:** Type a short message in the strip, press Enter
**Expected:** Message is sent to the PTY; Claude receives and responds
**Why human:** PTY byte flow and Claude response require a live server + PTY process

#### 3. Arrow key navigation in permission menus

**Test:** Trigger a Claude action that shows a Yes/No permission menu; press arrow-up/arrow-down
**Expected:** Menu selection moves natively without any JavaScript event interception
**Why human:** xterm.js ANSI passthrough and Claude CLI rendering require a live PTY session

#### 4. Ctrl+C interrupts Claude output

**Test:** Start a long Claude response; press Ctrl+C
**Expected:** Output stops; Claude process interrupted
**Why human:** Signal delivery through PTY cannot be simulated in jsdom

#### 5. Fixed strip height on window resize

**Test:** Resize the browser window to various widths and heights
**Expected:** Input strip stays at exactly 80px tall; does not grow or shrink with window
**Why human:** CSS layout and resize behaviour require a real browser layout engine

#### 6. Display terminal click redirects focus to strip

**Test:** Click anywhere in the output terminal area above the input strip
**Expected:** Focus moves to the xterm.js input strip (cursor activates there)
**Why human:** Browser focus model cannot be tested in jsdom

---

### Summary

All automated checks pass. The implementation is complete and well-structured:

- `TerminalInput.tsx` is a real implementation (not a stub): 107 lines, xterm.js init with async dynamic import, `rows:4`/`scrollback:0` constructor options, `onData(sendInput)` wiring, `forwardRef+useImperativeHandle` for focus exposure.
- `Terminal.tsx` has a real `disableStdin` prop wired to the XTerm constructor.
- `SessionPane.tsx` has fully removed the drag-resize Composer block; TerminalInput is the sole input path with `disableStdin={true}` on the display terminal, a `localInputRef` fallback, auto-focus on activation, and click redirect.
- CSS class uses design-system variables only.
- `App.tsx` composerRef is typed as `TerminalInputHandle` — no type mismatch.
- 210/210 tests green across 34 test files.

Five human checks remain (items 1–6 above) because they involve live PTY behavior, browser rendering, and focus model — none of which can be verified programmatically.

---

_Verified: 2026-05-03T21:20:00Z_
_Verifier: Claude (gsd-verifier)_
