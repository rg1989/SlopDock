---
phase: 02-file-system
plan: "04"
subsystem: ui
tags: [react, typescript, file-preview, attachment, attach-bar, file-system]

# Dependency graph
requires:
  - phase: 02-file-system-02-01
    provides: FileNode type, FileTree component, useFileTree hook with All/Changes toggle
  - phase: 02-file-system-02-02
    provides: GET /api/file endpoint returning FilePreviewData union
  - phase: 02-file-system-02-03
    provides: preview-panel slot in App layout, attachments/previewPath state in App

provides:
  - FilePreview component (text/image/binary rendering)
  - AttachBar component (filename chips with remove buttons)
  - Composer @path injection (prepends @abs/path\n before message on send)
  - Full wiring in App.tsx connecting previewPath to FilePreview via /api/file fetch
  - CSS for attach-bar, attach-chip, preview-panel-header, file-preview classes
  - Changes mode prunes empty directory subtrees (hasChangedDescendant helper)
  - "Working tree clean" empty state when changedPaths is empty in Changes mode
  - Dotfiles shown in tree with inline EyeOffIcon SVG and ft-hidden CSS class

affects:
  - phase-03-voice
  - any phase using Composer (attachments/clearAttachments props now available)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FilePreviewData union type discriminated on 'type' field (text | binary)"
    - "AttachBar filename-only chips — no inline content fetch, preview is click-to-open"
    - "@path injection: (attachments ?? []).map(p => '@' + p).join(' ') + newline prepend"
    - "previewPath useEffect triggers /api/file fetch, setPreviewData null on cwd change"

key-files:
  created:
    - client/components/FilePreview.tsx
    - client/components/AttachBar.tsx
  modified:
    - client/components/Composer.tsx
    - client/App.tsx
    - client/App.css
    - tests/FilePreview.test.tsx

key-decisions:
  - "FilePreview returns null for null data — no empty DOM output"
  - "AttachBar shows filename-only chips (path.split('/').pop()) — no content fetch"
  - "Composer clearAttachments called after onSend, before setValue empty"
  - "Unused @ts-expect-error directives removed from FilePreview.test.tsx after module created"
  - "Changes mode pruning uses recursive hasChangedDescendant — entire subtree pruned at directory level, not just leaf files"
  - "Dotfiles included in tree with hidden:boolean field set server-side; .git excluded via SKIP_DIRS"
  - "EyeOffIcon inline SVG — no extra dependency, 13px with 0.55 opacity"

patterns-established:
  - "Wave 0 @ts-expect-error pattern: remove suppressions when module is created"
  - "Preview panel: previewData fetched in App via useEffect on previewPath change"

requirements-completed:
  - FILE-03
  - FILE-04
  - FILE-05

# Metrics
duration: 3min
completed: 2026-04-30
---

# Phase 02 Plan 04: File Attachment and Preview Summary

**FilePreview (text/image/binary), AttachBar (filename chips), full App wiring with @path injection; Changes mode prunes empty dirs, shows empty state, dotfiles shown with eye-off icon**

## Performance

- **Duration:** ~20 min (including post-checkpoint fixes)
- **Started:** 2026-04-30T16:21:56Z
- **Completed:** 2026-04-30T19:45:00Z
- **Tasks:** 3 (2 auto + checkpoint fix pass)
- **Files modified:** 7

## Accomplishments
- Created FilePreview component rendering text in `<pre>`, images as `<img>` with correct mime type, and non-image binary as text notice
- Created AttachBar component rendering filename-only chips with × remove buttons, hidden when empty
- Modified Composer to prepend `@path1 @path2\n` before message when attachments non-empty, and call clearAttachments after send
- Wired App.tsx: previewPath state fetches /api/file and passes FilePreviewData to FilePreview; AttachBar receives attachments; Composer receives attachment props; preview panel has header + close button
- Fixed Changes mode to prune directory nodes with no changed descendants using `hasChangedDescendant` recursive helper
- Added "Working tree clean" empty state for Changes mode with zero changed files
- Included dotfiles in file tree (server-side `hidden: boolean` field); rendered with inline EyeOffIcon SVG and `ft-hidden` CSS class (opacity 0.7)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FilePreview component and modify Composer for @path injection** - `92bc7c9` (feat)
2. **Task 2: Create AttachBar and wire FilePreview + AttachBar into App** - `1adc71d` (feat)
3. **Post-checkpoint fixes: prune empty dirs, empty state, dotfiles with icon** - `8c4813c` (fix)

_Note: Task 1 was TDD: tests pre-existed (Wave 0 RED), implementation made them GREEN._

## Files Created/Modified
- `client/components/FilePreview.tsx` — FilePreviewData union type + FilePreview component for text/image/binary rendering
- `client/components/AttachBar.tsx` — filename chip strip with remove buttons, null when empty
- `client/components/Composer.tsx` — added attachments and clearAttachments props; @path prepend on send
- `client/App.tsx` — imports FilePreview/AttachBar; previewData state + fetch useEffect; AttachBar + Composer wired; preview panel with header and close button
- `client/App.css` — CSS for attach-bar, attach-chip, preview-panel-header, preview-filename, preview-close, file-preview, fp-*, ft-hidden, ft-empty classes
- `client/components/FileTree.tsx` — hasChangedDescendant helper, EyeOffIcon SVG, directory pruning in Changes mode, empty state, ft-hidden class on file nodes
- `server/file-api.ts` — FileNode.hidden boolean field; dotfiles included (except .git via SKIP_DIRS)
- `tests/FilePreview.test.tsx` — removed now-unused @ts-expect-error directives after module was created

## Decisions Made
- FilePreview returns null for null data (no empty DOM nodes rendered)
- AttachBar shows filename-only (no content fetch) — preview panel is the mechanism for inspecting content
- clearAttachments called after onSend so attachments are cleared on successful send intent
- Removed @ts-expect-error from FilePreview.test.tsx after the module was created — unused suppressions cause TS2578 errors in tsc
- Changes mode pruning uses `hasChangedDescendant` recursive helper — entire directory subtrees with zero changed files are pruned (returning null from `FileTreeNode`), not just leaf files
- `hidden: boolean` set server-side in `buildFileTree` so client rendering stays declarative
- `.git` remains excluded via `SKIP_DIRS`; other dotfiles now included with `hidden: true`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused @ts-expect-error directives in FilePreview.test.tsx**
- **Found during:** Task 2 (build verification)
- **Issue:** After creating FilePreview.tsx in Task 1, the @ts-expect-error directives at lines 3 and 5 of the test file became unused, causing TS2578 errors in the tsc pass of `npm run build`
- **Fix:** Removed the two @ts-expect-error comment lines; imports now resolve correctly
- **Files modified:** tests/FilePreview.test.tsx
- **Verification:** tsc error count reduced from 15 to 13 (the 13 remaining are pre-existing in pty-manager.test.ts and usePty.test.ts, out of scope)
- **Committed in:** 1adc71d (Task 2 commit)

---

**2. [Rule 1 - Bug] Changes mode rendered empty directory nodes**
- **Found during:** Human verification checkpoint
- **Issue:** Directory nodes rendered even when all descendants were non-changed files, producing empty folder entries in Changes tab
- **Fix:** Added `hasChangedDescendant` recursive helper; directory nodes return `null` early in Changes mode when helper returns false
- **Files modified:** client/components/FileTree.tsx
- **Committed in:** 8c4813c

**3. [Rule 2 - Missing Critical] No empty state for zero-change working tree**
- **Found during:** Human verification checkpoint
- **Issue:** When `changedPaths` was empty, Changes mode rendered a blank `<ul>` with no feedback to the user
- **Fix:** Guard at FileTree root: `if (mode === 'changes' && changedPaths.size === 0)` returns `<p className="ft-empty">Working tree clean</p>`
- **Files modified:** client/components/FileTree.tsx, client/App.css
- **Committed in:** 8c4813c

**4. [Rule 2 - Missing Critical] Dotfiles hidden from tree**
- **Found during:** Human verification checkpoint
- **Issue:** `.env`, `.gitignore`, and other dotfiles skipped entirely in `buildFileTree`; developers need visibility into these files
- **Fix:** Removed blanket dotfile skip; added `hidden: boolean` field on FileNode; client renders `EyeOffIcon` SVG inline for hidden nodes with `ft-hidden` CSS class
- **Files modified:** server/file-api.ts, client/components/FileTree.tsx, client/App.css
- **Committed in:** 8c4813c

---

**Total deviations:** 4 auto-fixed (1 Rule 1 bug, 3 Rule 2 missing critical)
**Impact on plan:** All fixes necessary for correctness and usability. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in tests/pty-manager.test.ts and tests/usePty.test.ts cause `tsc` to exit non-zero in `npm run build`, but `vite build` succeeds cleanly (44 modules transformed). These are out of scope for 02-04 and documented in deferred-items.

## Next Phase Readiness
- FILE-01 through FILE-05 complete — full file system phase done and verified
- Phase 03 voice is unblocked and ready to start
- FileNode.hidden field available if voice phase or future phases need file metadata

---
*Phase: 02-file-system*
*Completed: 2026-04-30*
