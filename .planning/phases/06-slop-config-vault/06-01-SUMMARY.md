---
phase: 06-slop-config-vault
plan: 01
subsystem: testing
tags: [wave-0, bug-fix, tdd, stubs]
dependency_graph:
  requires: []
  provides: [dedup-guard, parseRoadmapMd-rewrite, wave-0-stubs]
  affects: [useSessionManager, gsd, useSettings, FolderPicker, VaultTab]
tech_stack:
  added: []
  patterns: [wave-0-red-stubs, initialSessionIdRef-dedup]
key_files:
  created:
    - tests/gsd.test.ts
    - tests/slopStatus.test.ts
    - tests/useSettings.test.ts
    - tests/FolderPicker.test.tsx
    - tests/App.slopOnboarding.test.tsx
    - tests/VaultTab.test.tsx
  modified:
    - tests/useSessionManager.test.ts
    - client/hooks/useSessionManager.ts
    - server/gsd.ts
decisions:
  - "initialSessionIdRef tracks initial session id synchronously so dedup works within a single act() batch without stale sessionsRef"
  - "parseRoadmapMd rewritten with two-pass algorithm: Pass 1 builds completedMap from overview, Pass 2 builds phases from detail sections directly"
metrics:
  duration: "4 min"
  completed_date: "2026-05-01"
  tasks_completed: 2
  files_modified: 9
---

# Phase 6 Plan 1: Wave 0 Stubs + Bug Fixes Summary

Two bug fixes shipped first (dedup guard in spawn, parseRoadmapMd rewrite), then 5 Wave 0 RED stub test files established as automated verify gates for downstream Phase 6 plans.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Bug fixes — double-spawn dedup + parseRoadmapMd rewrite | 9da57c1 | useSessionManager.ts, gsd.ts, tests/useSessionManager.test.ts, tests/gsd.test.ts |
| 2 | Wave 0 stubs for new client modules + slopStatus endpoint | 6359a7b | 5 new test stub files |

## What Was Built

**Bug Fix 1 — Double-spawn dedup guard:**
`initialSessionIdRef` added to `useSessionManager` to track the id of the initial session synchronously. When `spawn(cwd, {initial:true})` is called a second time, it returns the cached `initialSessionIdRef.current` before hitting `sessionsRef.current` (which is stale within a single act() batch). This ensures only one tab is created on fresh load even if spawn() is called twice.

**Bug Fix 2 — parseRoadmapMd two-pass rewrite:**
Replaced single-pass algorithm that required a `## Phases` overview entry with a two-pass approach:
- Pass 1: scan `## Phases` overview → build `completedMap: Map<number, boolean>`  
- Pass 2: scan `### Phase N:` detail sections → build phases array directly, look up completedMap for completed status
Phases without a `## Phases` overview entry are now returned correctly. Output sorted by number ascending.

**Wave 0 Stub Tests (5 files — all intentionally RED):**
- `tests/slopStatus.test.ts` — 5 stubs for GET /api/slop-status and POST /api/slop-init
- `tests/useSettings.test.ts` — 4 stubs for server-backed settings behavior
- `tests/FolderPicker.test.tsx` — 2 stubs for recent paths via server endpoint
- `tests/App.slopOnboarding.test.tsx` — 3 stubs for slop-status check on cwd change
- `tests/VaultTab.test.tsx` — 3 stubs for vault status display and backup/restore

## Deviations from Plan

**1. [Rule 1 - Bug] initialSessionIdRef instead of eager sessionsRef update**
- **Found during:** Task 1 — fixing the dedup guard
- **Issue:** Eagerly updating `sessionsRef.current` when creating a new session caused the non-initial dedup path (`name === 'New'`) to fire when two non-initial spawns happened in the same act(), breaking the existing close test
- **Fix:** Used a dedicated `initialSessionIdRef` that tracks only the initial session id synchronously, leaving `sessionsRef.current` updated only via useEffect
- **Files modified:** client/hooks/useSessionManager.ts

## Pre-existing Failures (Out of Scope)

3 tests in `tests/useSessionManager.test.ts` were failing before this plan:
- "initializes new session with name 'Session 1'"
- "increments session name for subsequent sessions"
- "includes id, name, status, cwd, createdAt in session entry"

These expect `'Session 1'` but the implementation uses `'New'` for non-initial spawns. These represent test/implementation drift from a prior plan and are not caused by changes in this plan.

## Self-Check: PASSED

- tests/gsd.test.ts: FOUND
- tests/slopStatus.test.ts: FOUND
- tests/useSettings.test.ts: FOUND
- tests/FolderPicker.test.tsx: FOUND
- tests/App.slopOnboarding.test.tsx: FOUND
- tests/VaultTab.test.tsx: FOUND
- Commit 9da57c1: FOUND
- Commit 6359a7b: FOUND
