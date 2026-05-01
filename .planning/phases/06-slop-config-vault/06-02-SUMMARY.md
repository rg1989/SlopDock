---
phase: 06-slop-config-vault
plan: "02"
subsystem: server
tags: [config, vault, backup, endpoints, filesystem]
dependency_graph:
  requires: [06-01]
  provides: [slop-status-api, slop-init-api, global-settings-api, recent-paths-api, vault-backup]
  affects: [06-03, 06-04, 06-05]
tech_stack:
  added: []
  patterns: [atomic-write-rename, fire-and-forget-startup-hook, mtimeMs-comparison]
key_files:
  created: []
  modified: [server/index.ts]
decisions:
  - atomicWrite uses .tmp + rename pattern — ensures no partial writes visible to readers
  - isSourceNewer uses mtimeMs comparison with graceful fallback — if dest absent, treats src as newer
  - autoBackupVault is fire-and-forget in server.listen — non-blocking startup, per-target errors swallowed
  - VAULT_TARGETS excludes SSH private keys — only config/metadata files backed up
metrics:
  duration: "3 min"
  completed: "2026-05-01"
  tasks_completed: 2
  files_modified: 1
---

# Phase 06 Plan 02: Slop Config Vault — Server Endpoints Summary

Server-side endpoints and startup hooks for all Phase 6 config tiers: project-local .slop/ (slop-status, slop-init), global ~/.slop/ (global-settings, recent-paths), and vault auto-backup on server startup using atomic write + mtime comparison.

## What Was Built

### Constants and Helpers (server/index.ts)

- `SLOP_DIR`, `SETTINGS_FILE`, `RECENTS_FILE`, `BACKUP_ROOT` path constants derived from `os.homedir()`
- `VAULT_TARGETS` array — 7 targets: claude settings, settings.local, CLAUDE.md, keybindings, gsd config, gitconfig, ssh config
- `atomicWrite(filePath, content)` — writes to `.tmp` then renames atomically
- `isSourceNewer(src, dest)` — mtimeMs comparison, returns `true` if dest absent
- `autoBackupVault()` — iterates VAULT_TARGETS, copies newer files, skips unchanged

### Endpoints Added

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/slop-status?cwd=` | Returns `{exists, config}` — checks `.slop/` dir presence |
| POST | `/api/slop-init` | Creates `.slop/config.json` with locked shape |
| GET | `/api/global-settings` | Reads `~/.slop/settings.json`, returns `{settings:null}` if absent |
| PUT | `/api/global-settings` | Atomic write to `~/.slop/settings.json` |
| GET | `/api/recent-paths` | Reads `~/.slop/recents.json`, returns `{paths:[]}` if absent |
| PUT | `/api/recent-paths` | Writes `~/.slop/recents.json` with version field |

### Startup Hook

`autoBackupVault().catch(() => {})` wired in `server.listen` callback alongside existing `initPiper` and `checkWhisper` calls.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Server constants + helpers + slop-status/slop-init | 1e3b589 | server/index.ts |
| 2 | global-settings + recent-paths endpoints | 1e3b589 | server/index.ts |

## Verification

- `npx tsc --noEmit` — zero errors in `server/index.ts`
- Pre-existing test failures unchanged (20 failing before and after changes — all Wave 0 stubs for later plans)
- All 6 endpoints confirmed present via `grep` inspection
- `autoBackupVault` confirmed wired at line 1031

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- server/index.ts modified: FOUND
- Commit 1e3b589: FOUND
- All 6 endpoints in file: FOUND (lines 953, 971, 987, 996, 1004, 1014)
- autoBackupVault in server.listen: FOUND (line 1031)
