---
phase: 15
slug: terminal-input-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x + React Testing Library 16.x |
| **Config file** | `vite.config.ts` (vitest section) |
| **Quick run command** | `npx vitest run tests/TerminalInput.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/TerminalInput.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 0 | TINPUT-01, TINPUT-02, TINPUT-03, TINPUT-04 | unit stub | `npx vitest run tests/TerminalInput.test.tsx` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | TINPUT-01 | unit | `npx vitest run tests/TerminalInput.test.tsx` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | TINPUT-02 | unit | `npx vitest run tests/TerminalInput.test.tsx` | ❌ W0 | ⬜ pending |
| 15-01-04 | 01 | 1 | TINPUT-03 | unit | `npx vitest run tests/TerminalInput.test.tsx` | ❌ W0 | ⬜ pending |
| 15-01-05 | 01 | 1 | TINPUT-04 | unit | `npx vitest run tests/TerminalInput.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/TerminalInput.test.tsx` — stubs covering TINPUT-01, TINPUT-02, TINPUT-03, TINPUT-04
- [ ] xterm mock (`@xterm/xterm` and `@xterm/addon-fit`) — in `tests/setup.ts` or inline in test file (jsdom requires mocking since it has no layout engine)

*Note: xterm.js requires a DOM with layout (clientWidth/clientHeight). In jsdom these are always 0, so `terminal.open()` and `fitAddon.fit()` must be mocked. Follow the pattern in `usePty.test.ts`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Input strip renders at fixed 3–4 row height in real browser | TINPUT-04 | jsdom has no layout engine; pixel height can't be verified | Open the app, open a Claude session, verify the input strip is visually ~3–4 lines tall and stays fixed on window resize |
| Arrow-key navigation through Claude permission menu works end-to-end | TINPUT-02 | Requires live PTY session with Claude running | Start a Claude session that shows a Yes/No prompt; press ↑/↓ to navigate, Enter to confirm |
| Ctrl+C interrupts Claude mid-output | TINPUT-03 | Requires live Claude process generating output | Start a long-running Claude task; press Ctrl+C and confirm output stops |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
