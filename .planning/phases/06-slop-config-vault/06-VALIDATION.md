---
phase: 6
slug: slop-config-vault
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 6 — Validation Strategy

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
| 6-01-01 | 01 | 1 | BUG-01 | unit | `npm test -- --run useSessionManager` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | BUG-02 | unit | `npm test -- --run gsd` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 2 | SLOP-01 | manual+unit | `npm test -- --run slopStatus` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 2 | SLOP-02 | unit | `npm test -- --run useProjectHealth` | ✅ | ⬜ pending |
| 6-03-01 | 03 | 2 | SETTINGS-01 | unit | `npm test -- --run useSettings` | ❌ W0 | ⬜ pending |
| 6-03-02 | 03 | 2 | RECENT-01 | unit | `npm test -- --run FolderPicker` | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 | 3 | ONBOARD-01 | component | `npm test -- --run OnboardingModal` | ✅ | ⬜ pending |
| 6-04-02 | 04 | 3 | ONBOARD-02 | component | `npm test -- --run App` | ❌ W0 | ⬜ pending |
| 6-05-01 | 05 | 4 | VAULT-01 | manual | manual curl test | ✅ | ⬜ pending |
| 6-05-02 | 05 | 4 | VAULT-02 | component | `npm test -- --run VaultTab` | ❌ W0 | ⬜ pending |
| 6-05-03 | 05 | 4 | VAULT-03 | checkpoint | human verify | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/useSessionManager.test.ts` — dedup guard for initial spawn
- [ ] `tests/gsd.test.ts` — roadmap parser detail-section-first behavior
- [ ] `tests/slopStatus.test.ts` — slop-status endpoint contract
- [ ] `tests/useSettings.test.ts` — server-backed settings load/save + migration
- [ ] `tests/FolderPicker.test.tsx` — recent paths via server endpoint
- [ ] `tests/App.slopOnboarding.test.tsx` — cwd-change triggers slop-status check
- [ ] `tests/VaultTab.test.tsx` — vault status display and backup/restore buttons

*Existing infrastructure (vitest + RTL) covers all phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vault "Backup All" writes files to disk | VAULT-01 | Requires real filesystem | Click Backup All, check ~/.slop/backups/ in terminal |
| Vault "Restore" overwrites source files | VAULT-01 | Requires real filesystem | Modify a source, click Restore, verify original restored |
| Auto-backup on startup fires for stale backups | VAULT-02 | Requires mtime manipulation | Touch a source file, restart server, check backup mtime |
| OnboardingModal appears for new folder, not for .slop folder | ONBOARD-01 | Requires real fs + browser | Connect fresh folder → modal; connect .slop folder → no modal |
| Settings persist across browser cache clear | SETTINGS-01 | Requires browser action | Save settings, clear cache, reload — settings intact |
| Only one tab on fresh load | BUG-01 | Requires browser | Fresh reload, count tabs in header |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
