---
phase: 02-file-system
plan: "02"
subsystem: api
tags: [express, node, filesystem, git, isbinaryfile, path-traversal, rest]

# Dependency graph
requires:
  - phase: 01-pty-core
    provides: server/index.ts Express app scaffold with existing route patterns
provides:
  - "GET /api/files — recursive file tree JSON excluding dotfiles, node_modules, .git, dist"
  - "GET /api/git-status — git-changed file absolute paths, safe for non-git repos"
  - "GET /api/file — text content or base64 binary with image classification, 403 for path traversal"
  - "server/file-api.ts with FileNode, buildFileTree, getGitChangedPaths exports"
affects:
  - 02-01-PLAN (FileTree component needs /api/files and /api/git-status)
  - 02-03-PLAN (preview/attachment needs /api/file)

# Tech tracking
tech-stack:
  added: [isbinaryfile@5.0.7]
  patterns:
    - "Express async route with try/catch and typed req.query destructure"
    - "Path traversal guard: path.resolve both sides, startsWith(resolvedCwd + sep)"
    - "Porcelain v1 git parser handles renames and quoted paths"

key-files:
  created:
    - server/file-api.ts
  modified:
    - server/index.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Sort directories before files (each group alphabetically) in buildFileTree output — IDE-style ordering"
  - "Max depth 8 guard in buildFileTree prevents infinite loops on deeply nested repos"
  - "isbinaryfile used for binary detection; image extensions checked against explicit allowlist for isImage flag"
  - "Path traversal guard uses resolvedCwd + path.sep suffix to block exact cwd match as traversal"

patterns-established:
  - "path.sep suffix in traversal check: absPath.startsWith(resolvedCwd + path.sep) blocks root-level attacks"
  - "getGitChangedPaths always returns [] on error — callers never need try/catch"
  - "Use named destructure of req.query to avoid shadowing path module: { cwd, path: relPath }"

requirements-completed: [FILE-01, FILE-02, FILE-03, FILE-05]

# Metrics
duration: 2min
completed: 2026-04-30
---

# Phase 2 Plan 02: File System API Summary

**Three Express REST endpoints (file tree, git status, file content) with path traversal security and binary detection**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-30T16:12:51Z
- **Completed:** 2026-04-30T16:14:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `server/file-api.ts` with `buildFileTree` (recursive, depth-guarded, sorted) and `getGitChangedPaths` (git porcelain parser)
- Added `/api/files`, `/api/git-status`, `/api/file` routes to `server/index.ts`
- Path traversal blocked at 403; `node_modules`, `.git`, `dist` excluded from tree

## Task Commits

1. **Task 1: Create server/file-api.ts** - `9e8eec0` (feat)
2. **Task 2: Add routes to server/index.ts** - `386d4ab` (feat)

## Files Created/Modified

- `server/file-api.ts` - FileNode interface, buildFileTree, getGitChangedPaths
- `server/index.ts` - Three new GET routes, imports for readFile, isBinaryFile, file-api helpers
- `package.json` / `package-lock.json` - Added isbinaryfile@5.0.7

## Decisions Made

- Used `path.sep` in traversal check (`resolvedCwd + path.sep`) rather than bare `resolvedCwd + '/'` to be platform-safe
- `buildFileTree` accepts optional `depth` param (default 0) and short-circuits at 8 — prevents hangs on pathological repos
- Sorted directories before files within each group alphabetically — matches IDE file tree conventions
- `getGitChangedPaths` swallows all errors and returns `[]` — simplifies callers (no try/catch needed for git-status route)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in test files (tests/pty-manager.test.ts, tests/usePty.test.ts) were present before this plan and are out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three file system API endpoints operational and verified via live curl tests
- `/api/files` unblocks FileTree component (02-01)
- `/api/git-status` unblocks git-changed file highlighting (02-01)
- `/api/file` unblocks FilePreview and @path attachment features (02-01, 02-03)

---
*Phase: 02-file-system*
*Completed: 2026-04-30*
