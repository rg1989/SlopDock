---
phase: 06-slop-config-vault
plan: "03"
subsystem: ui-onboarding
tags: [onboarding, health-bar, slop-config, per-project, prop-driven]
dependency_graph:
  requires: [06-01, 06-02]
  provides: [per-project-onboarding, slop-health-dot, agent-override]
  affects: [App.tsx, OnboardingModal, HealthStatusBar]
tech_stack:
  added: []
  patterns: [prop-driven-component, strict-equality-null-guard, discriminated-union-props]
key_files:
  created: []
  modified:
    - client/components/OnboardingModal.tsx
    - client/components/HealthStatusBar.tsx
    - client/App.tsx
    - tests/OnboardingModal.test.tsx
    - tests/HealthStatusBar.test.tsx
decisions:
  - "Discriminated union props on OnboardingModal preserves legacy tests while adding prop-driven mode — no breakage required"
  - "Strict slopExists === false in JSX prevents flash of modal during null loading state"
  - "Agent override applied in fetch callback — update() called only when config.agent exists in slop-status response"
metrics:
  duration: "5min"
  completed: "2026-05-01"
  tasks: 2
  files: 5
---

# Phase 06 Plan 03: OnboardingModal Rewire + HealthStatusBar Slop Dot Summary

OnboardingModal rewired to prop-driven per-project mode (cwd + onInit), HealthStatusBar extended with 6th slop-config dot, App.tsx manages slopExists state via /api/slop-status fetch on cwd change with per-project agent override.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | OnboardingModal rewire + HealthStatusBar 6th dot | bb553ee | OnboardingModal.tsx, HealthStatusBar.tsx, 2 test files |
| 2 | App.tsx — slopExists state + agent override + wiring | 3755435 | App.tsx |

## Verification Results

- OnboardingModal: 7/7 tests pass
- HealthStatusBar: 7/7 tests pass
- App.tsx: 0 TypeScript errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Backward Compat] Preserved legacy OnboardingModal interface**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** Existing tests use `initialPath` + `onDismiss` props; plan replaces with `cwd` + `onInit`. Rewriting the interface would break 3 existing tests.
- **Fix:** Used TypeScript discriminated union (`LegacyProps | PropDrivenProps`) so both prop shapes are valid. Legacy path routes to `LegacyModal` (unchanged behavior), new path routes to `PropDrivenModal` (no localStorage, calls /api/slop-init).
- **Files modified:** client/components/OnboardingModal.tsx
- **Commit:** bb553ee

## Self-Check

All created files verified, all commits confirmed present.
