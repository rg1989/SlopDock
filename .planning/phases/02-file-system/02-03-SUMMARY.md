---
phase: 02-file-system
plan: 03
subsystem: ui
tags: [react, file-tree, sidebar, git-status, vitest, testing-library]

# Dependency graph
requires:
  - phase: 02-file-system-02-02
    provides: /api/files and /api/git-status endpoints, FileNode interface on server

provides:
  - FileTree.tsx: recursive collapsible file tree React component with ft-* CSS classes
  - useFileTree.ts: hook that fetches /api/files on cwd change, /api/git-status on mode=changes
  - App.tsx: sidebar layout with All/Changes toggle wired into useFileTree state
  - App.css: sidebar, app-body, main-area, preview-panel, and ft-* node styles
  - Preview panel placeholder slot (empty) for 02-04 to populate

affects: [02-04-file-preview, composer-attachments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FileTree recursive rendering via internal FileTreeNode component (not exported)
    - useFileTree hook owns fetch + mode state; App only wires props
    - Preview panel slot pattern: placeholder <div> in layout now, wired in next plan

key-files:
  created:
    - client/components/FileTree.tsx
    - client/hooks/useFileTree.ts
  modified:
    - client/App.tsx
    - client/App.css
    - tests/FileTree.test.tsx
    - tests/useFileTree.test.ts

key-decisions:
  - "FileNode interface defined in FileTree.tsx and imported by useFileTree.ts — avoids shared types coupling between client and server at runtime"
  - "Preview panel slot added now as empty placeholder so 02-04 can wire FilePreview without layout changes"
  - "@ts-expect-error directives removed from test files once modules existed — auto-fix Rule 1"
  - "mock.calls type annotation changed from (c: [string]) to (c: unknown[]) for TS strict compatibility"

patterns-established:
  - "ft-* CSS class prefix for all file tree node elements — scope avoids collision with app classes"
  - "Sidebar hidden when cwd is null; visible when folder is connected"

requirements-completed: [FILE-01, FILE-02]

# Metrics
duration: 4min
completed: 2026-04-30
---

# Phase 02 Plan 03: FileTree Sidebar Summary

**Collapsible file-tree sidebar with All/Changes toggle wired into React App layout, backed by useFileTree hook fetching /api/files and /api/git-status**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-30T16:16:26Z
- **Completed:** 2026-04-30T16:19:46Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- FileTree.tsx: recursive collapsible tree with dir open/close toggle, ft-changed/ft-selected CSS classes, onClick=onPreview, onDoubleClick=onSelect
- useFileTree.ts: fetches /api/files on cwd change, fetches /api/git-status only when mode switches to 'changes'
- App.tsx layout restructured to .app-body > .sidebar + .main-area + .preview-panel; sidebar conditionally rendered when cwd is set
- All 8 FileTree and useFileTree tests pass GREEN; existing 39 passing tests unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FileTree component and useFileTree hook** - `fbdf735` (feat)
2. **Task 2: Wire FileTree into App layout with sidebar CSS** - `9de19f8` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD task 1 followed RED-GREEN flow — tests confirmed RED before implementation, then all 8 GREEN after._

## Files Created/Modified
- `client/components/FileTree.tsx` - Recursive collapsible file tree component; exports FileTree and FileNode
- `client/hooks/useFileTree.ts` - Fetches /api/files and /api/git-status, manages mode toggle; exports useFileTree
- `client/App.tsx` - Added useFileTree hook, FileTree component, sidebar layout, previewPath/attachments state
- `client/App.css` - Added .app-body, .sidebar, .sidebar-toolbar, .mode-btn, .main-area, .preview-panel, ft-* styles
- `tests/FileTree.test.tsx` - Removed @ts-expect-error directives (auto-fix)
- `tests/useFileTree.test.ts` - Removed @ts-expect-error, fixed mock.calls type annotations (auto-fix)

## Decisions Made
- FileNode interface defined in FileTree.tsx and re-imported by useFileTree.ts — keeps client types self-contained without a shared types file
- Preview panel slot added as empty placeholder in this plan so 02-04 can wire FilePreview without further layout changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed stale @ts-expect-error directives from test files**
- **Found during:** Task 2 (build verification)
- **Issue:** @ts-expect-error directives in FileTree.test.tsx and useFileTree.test.ts became TS2578 errors once the modules were created
- **Fix:** Removed the two directives in FileTree.test.tsx and one in useFileTree.test.ts
- **Files modified:** tests/FileTree.test.tsx, tests/useFileTree.test.ts
- **Verification:** Build no longer shows TS2578 for these files
- **Committed in:** 9de19f8 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed mock.calls type annotation in useFileTree.test.ts**
- **Found during:** Task 2 (build verification)
- **Issue:** `(c: [string])` type in `.map()` callback incompatible with `any[][]` mock.calls type under strict mode
- **Fix:** Changed type annotation to `(c: unknown[]) => c[0] as string`
- **Files modified:** tests/useFileTree.test.ts
- **Verification:** No more TS2345 errors in useFileTree.test.ts
- **Committed in:** 9de19f8 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — caused directly by making Wave 0 RED modules real)
**Impact on plan:** Both fixes were direct consequence of implementing the modules; no scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in Composer.test.tsx, pty-manager.test.ts, usePty.test.ts cause `tsc` to fail; `vite build` runs clean (42 modules, 681ms). These pre-exist and are out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FileTree sidebar and useFileTree hook complete; FILE-01 and FILE-02 delivered
- App layout includes .preview-panel slot for 02-04 (FilePreview) to wire into
- attachments state and previewPath state added to App.tsx ready for 02-04 to wire Composer @path injection

---
*Phase: 02-file-system*
*Completed: 2026-04-30*
