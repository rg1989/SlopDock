---
phase: 5
slug: project-onboarding-wizard-and-setup-health-check
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + React Testing Library |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | onboarding-gate | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | onboarding-modal | component | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | health-endpoint | manual | manual curl test | ✅ | ⬜ pending |
| 5-02-02 | 02 | 1 | useProjectHealth | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 5-02-03 | 02 | 2 | health-ui | component | `npm test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/OnboardingModal.test.tsx` — stubs for onboarding gate + modal render
- [ ] `tests/useProjectHealth.test.ts` — stubs for health hook state transitions
- [ ] `tests/HealthStatusBar.test.tsx` — stubs for health indicator rendering

*Existing infrastructure (vitest + RTL) covers all phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Onboarding modal shown on first load | onboarding-gate | Requires clearing localStorage | Clear localStorage, reload, verify modal appears |
| Onboarding modal not shown on 2nd load | onboarding-gate | Requires localStorage state | After dismissal, reload — modal must not appear |
| Health checks reflect real filesystem state | health-endpoint | Requires real project folder | Point at a folder with/without CLAUDE.md/git and verify dots update |
| PTY spawn unblocked when checks fail | health-no-block | Requires running a session | With a "bad" project, start a session — it must spawn |

*All UI behaviors require browser verification; automated tests cover logic layer only.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
