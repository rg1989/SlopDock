---
phase: 14-canvas-mcp-and-connections
plan: "03"
subsystem: mcp-ui
tags: [mcp, backend, modal, folderpicker, tdd]
dependency_graph:
  requires: [14-01]
  provides: [McpConnectionsModal, fp-mcp-btn, GET /api/mcp-servers, POST /api/mcp-register-canvas]
  affects: [App.tsx (plan 14-04 wires onMcpOpen)]
tech_stack:
  added: []
  patterns: [read-merge-write atomic write, self-ping for status, TDD RED/GREEN]
key_files:
  created:
    - client/components/McpConnectionsModal.tsx
    - tests/McpConnectionsModal.test.tsx
  modified:
    - server/index.ts
    - client/components/FolderPicker.tsx
    - client/App.css
decisions:
  - "GET /api/mcp-servers self-pings /api/canvas/tabs to distinguish active vs registered for slopmop-canvas"
  - "POST /api/mcp-register-canvas uses tmp+rename atomic write to avoid corrupt settings.json"
  - "FolderPicker fp-mcp-btn placed after canvas toggle button, before rules/settings buttons"
metrics:
  duration: 4min
  completed: 2026-05-03
---

# Phase 14 Plan 03: MCP Connections UI Summary

**One-liner:** MCP server visibility modal with fp-mcp-btn in FolderPicker and two backend endpoints reading/writing ~/.claude/settings.json atomically.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Backend GET /api/mcp-servers + POST /api/mcp-register-canvas | a3218ff | server/index.ts |
| 2 TDD RED | Failing tests for McpConnectionsModal and fp-mcp-btn | 3e88eee | tests/McpConnectionsModal.test.tsx |
| 2 TDD GREEN | McpConnectionsModal component + FolderPicker fp-mcp-btn + CSS | 8d1fa72, 680aff9 | client/components/McpConnectionsModal.tsx, client/components/FolderPicker.tsx, client/App.css |

## Verification

- `npx vitest run tests/McpConnectionsModal.test.tsx` — 8/8 PASS
- `npx vitest run tests/FolderPicker.test.tsx` — 2/2 PASS (no regressions)
- `npx tsc --noEmit` — no new errors from plan 14-03 changes

## Deviations from Plan

None - plan executed exactly as written.

## Wave 0 RED Tests (pre-existing, not regressions)

`App.canvasPanel.test.tsx` has 3 failing Wave 0 RED tests that require App.tsx to pass `onMcpOpen` to FolderPicker — that is plan 14-04 scope. `MultiTabCanvasPanel.test.tsx` and `canvas-mcp-tools.test.ts` are Wave 0 RED tests from plans 14-02 and 14-05 respectively.

## Self-Check: PASSED

Files exist:
- client/components/McpConnectionsModal.tsx: FOUND
- tests/McpConnectionsModal.test.tsx: FOUND

Commits exist:
- a3218ff: FOUND
- 3e88eee: FOUND
- 8d1fa72: FOUND
- 680aff9: FOUND
