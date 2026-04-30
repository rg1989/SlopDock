---
phase: quick-4
plan: 01
subsystem: ui
tags: [react, typescript, tabs, file-editor, vscode-style]

# Dependency graph
requires:
  - phase: quick-3
    provides: FilePreview component with syntax highlighting and edit/save toolbar
provides:
  - VS Code-style tabbed file editor replacing single-file preview panel
  - EditorTabBar component with scroll arrows, preview/permanent tab variants
  - openFile()/closeTab()/promoteTab() state management in App.tsx
  - FileTree activePath highlighting and auto-scroll-into-view
  - FilePreview initialEditing prop for edit-on-mount behavior
affects: [ui, file-editing, sidebar, preview-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Preview tab (italic) vs permanent tab - single-click browse vs double-click/promote to keep open"
    - "Tab ID equals file path for simplicity"
    - "editingTabId separate state from activeTabId to control one-shot edit mode trigger"
    - "ResizeObserver + scroll event to show/hide arrow buttons"

key-files:
  created:
    - client/components/EditorTabBar.tsx
  modified:
    - client/App.tsx
    - client/components/FileTree.tsx
    - client/components/FilePreview.tsx
    - client/App.css

key-decisions:
  - "Use file path as tab ID (simple, unique per file, no extra ID generation needed)"
  - "editingTabId separate from activeTabId so promote triggers one-shot edit mode without re-triggering on subsequent re-renders"
  - "openFile() is async/useCallback fetching content inline, replacing the old useEffect pattern"
  - "FileTree double-click calls both onSelect (attach) AND onOpen (permanent tab) to preserve existing attach behavior"

patterns-established:
  - "Tab state: editorTabs[] (EditorTab[]) + activeTabId + editingTabId in App.tsx"
  - "Preview tab replacement: find existing preview tab by isPreview=true, replace in-place"
  - "Promote flow: promoteTab(id) sets isPreview=false + editingTabId=id; FilePreview reads initialEditing=activeTabId===editingTabId"

requirements-completed: [QUICK-4]

# Metrics
duration: 25min
completed: 2026-05-01
---

# Quick Plan 4: Tabbed File Editor Summary

**VS Code-style tabbed editor with preview (italic/replaceable) vs permanent tabs, EditorTabBar scroll arrows, FileTree active-file highlight, and edit-on-promote via initialEditing prop**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-01T00:00:00Z
- **Completed:** 2026-05-01T00:25:00Z
- **Tasks:** 3 (Task 4 is checkpoint:human-verify, paused for user)
- **Files modified:** 5

## Accomplishments
- Created EditorTabBar component with ResizeObserver-driven scroll arrow visibility, close buttons, and preview/active CSS variants
- Refactored App.tsx: removed previewPath/previewData, added editorTabs[], openFile(), closeTab(), promoteTab() with async content fetching
- FileTree gains activePath prop (ft-active CSS class + scrollIntoView) and onOpen prop (double-click permanent open)
- FilePreview gains initialEditing prop (enters edit mode on mount when promoted via double-click or Edit button)
- Full CSS for tab bar (34px height, blue top border on active, italic+dashed for preview, red x on hover)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EditorTabBar component** - `b848b29` (feat)
2. **Task 2: Refactor App.tsx + FileTree + FilePreview** - `dbdb970` (feat)
3. **Task 3: Add CSS for tab bar and active tree highlight** - `5abd882` (feat)

## Files Created/Modified
- `client/components/EditorTabBar.tsx` - Tab bar UI: EditorTab interface, scroll arrows with ResizeObserver, preview/active variants, close buttons
- `client/App.tsx` - editorTabs[] state, openFile()/closeTab()/promoteTab() functions, EditorTabBar + FilePreview wiring
- `client/components/FileTree.tsx` - activePath prop with ft-active class, data-path attribute, onOpen prop for double-click permanent open, scrollIntoView useEffect
- `client/components/FilePreview.tsx` - initialEditing + onPromote props; useEffect dependency updated to [data, initialEditing]
- `client/App.css` - ~118 lines of tab bar and ft-active styles appended

## Decisions Made
- **Tab ID = file path**: Simple, unique, avoids UUID generation. Works because one tab per path.
- **editingTabId separate from activeTabId**: Prevents edit mode from re-triggering on tab switches; acts as a one-shot signal that clears implicitly when the comparison `activeTabId === editingTabId` becomes false.
- **openFile() replaces useEffect**: Async inline fetch inside useCallback gives direct control over which tab gets the data, avoiding the stale closure issues of the old useEffect approach.
- **FileTree double-click calls both onSelect AND onOpen**: Preserves the existing "double-click attaches file" behavior while also opening a permanent tab.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Linter (likely Prettier/ESLint) was modifying FilePreview.tsx between Read and Edit calls, causing "file modified since read" errors. Worked around by writing the full file via `cp` from a temp file rather than using incremental edits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tab bar is built and wired; user verification step (Task 4 checkpoint) needed before closing the plan
- All TypeScript compiles clean (zero errors in client code)
- All existing features (terminal, composer, voice, attach, resize) are unaffected by the refactor

---
*Phase: quick-4*
*Completed: 2026-05-01*
