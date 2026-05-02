---
phase: 12
slug: bottom-panel-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.0 + @testing-library/react ^16 |
| **Config file** | vitest.config.ts (project root) |
| **Quick run command** | `npm test -- --reporter=verbose bottom-panel` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=verbose bottom-panel`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 0 | BPANEL-01..05 | unit | `npm test -- App.bottomPanel` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | BPANEL-01 | unit | `npm test -- App.bottomPanel` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | BPANEL-02,03 | unit | `npm test -- App.bottomPanel` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | BPANEL-04 | unit | `npm test -- App.bottomPanel` | ❌ W0 | ⬜ pending |
| 12-01-05 | 01 | 1 | BPANEL-05 | unit | `npm test -- App.bottomPanel` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/App.bottomPanel.test.tsx` — stubs for BPANEL-01 through BPANEL-05

*Existing infrastructure covers vitest + RTL — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag resize feel / UX | BPANEL-03 | RTL cannot simulate mousemove drag | Open app, drag the horizontal handle, verify panel grows/shrinks smoothly |
| localStorage survives reload | BPANEL-04,05 | RTL localStorage is ephemeral | Open app, resize + toggle, hard-reload, verify state restored |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
