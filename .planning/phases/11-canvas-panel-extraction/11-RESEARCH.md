# Phase 11: canvas-panel-extraction - Research

**Researched:** 2026-05-02
**Domain:** React layout restructuring — extracting a tab-hosted panel into a persistent split-pane column with drag-resize and localStorage persistence
**Confidence:** HIGH

## Summary

Live Canvas currently lives inside the sidebar's tabbed area as one of five icon-tab panels (`SidebarTabId = 'explorer' | 'changes' | 'roadmap' | 'brain' | 'canvas'`). The goal is to promote it to a dedicated always-visible right-column panel, split vertically below the editor panel (or as its own column when the editor panel is hidden), with a horizontal resize handle between canvas and editor, a toolbar toggle button to show/hide the canvas pane, and localStorage persistence for both visibility state and the canvas split height.

The project already contains everything needed: `useDragResize` supports `'up'` direction (vertical drag), `localStorage` read/write utilities (`uiRead`/`uiWrite`) are defined in `App.tsx`, the CSS `.resize-handle--h` class is the correct horizontal-drag variant, and `LiveCanvasPanel` is already a self-contained component. No new dependencies are required.

The main structural change is in `App.tsx`: remove `'canvas'` from `SIDEBAR_TABS`, strip the sidebar canvas branch, add a new canvas column to the `app-body` flex row (to the right of the editor panel), and introduce canvas-specific drag-resize + visibility state.

**Primary recommendation:** Add a `canvas-column` div as a new flex sibling after the editor panel in `app-body`, driven by `useDragResize('up', ...)` for the internal editor/canvas height split, with a single `.resize-handle--h` separator and an `isCanvasVisible` boolean toggle persisted in localStorage.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React hooks (useState, useEffect, useRef, useCallback) | 18 | State, effects, drag refs | Project-wide pattern — no Redux/Zustand |
| `useDragResize` (internal) | — | Drag-to-resize panels | Already used for sidebar, editor, and composer resize |
| localStorage via `uiRead`/`uiWrite` | — | Persist panel dimensions and visibility | Already used for sidebar width, editor width, sidebar tab, editor tabs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest + @testing-library/react | ^3 / ^16 | Unit tests for hook behaviour and visibility toggle | Required — nyquist_validation enabled |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Adding canvas as right-column sibling | Render canvas inside editor-panel with flex split | Right-column sibling matches the Phase 12/13 pattern (bottom panel) and keeps canvas logically independent of editor state |
| localStorage via `uiRead`/`uiWrite` | URL query params | localStorage is the established pattern; URL params are only used for `cwd` |

**Installation:**
```bash
# No new packages — zero dependency change
```

## Architecture Patterns

### Existing Layout Structure
```
.app (flex column)
  .folder-bar
  .app-body (flex row, flex: 1)
    .sidebar (flex-shrink: 0, width: sidebar.width)
    .resize-handle (col-resize, sidebar↔main)
    .main-area (flex: 1, flex-direction: column)
      .terminal-area (flex: 1 — SessionTabBar + SessionPanes)
    .resize-handle (col-resize, main↔editor) [conditional on activeTabs.length]
    .editor-panel (flex-shrink: 0, width: editor.width) [conditional on activeTabs.length]
  .app-footer
```

### Target Layout Structure (Phase 11)
```
.app (flex column)
  .folder-bar
  .app-body (flex row, flex: 1)
    .sidebar (same — canvas tab removed)
    .resize-handle (col-resize)
    .main-area (flex: 1)
    [.resize-handle col-resize]
    [.editor-panel — unchanged, conditional on activeTabs]
    [.resize-handle col-resize  — new: editor/canvas separator OR main/canvas separator]
    [.canvas-column (flex-shrink: 0, flex-direction: column) — new, conditional on isCanvasVisible]
      [.editor-subpanel — if editor tabs open, canvas splits vertically with editor]
      [.resize-handle--h — horizontal split handle inside canvas-column]
      [.live-canvas-panel — the existing component]
  .app-footer
```

**Alternative simpler interpretation (recommended for Phase 11):** The canvas is its own full-height right column — it does NOT share a column with the editor panel. The editor panel and canvas panel are separate flex siblings in `app-body`. This avoids complex nested split logic. The vertical split within the canvas column (for a future "canvas above, something below" layout) can be deferred to Phase 12.

### Pattern 1: Right-Column Toggle
**What:** `isCanvasVisible` boolean state, persisted on change, controls whether the canvas column div is rendered. A toolbar button in a header bar toggles it.
**When to use:** The canvas column is always at a fixed width (or last-saved width), shown/hidden as a unit.
**Example:**
```typescript
// In App.tsx — matches existing uiRead/uiWrite pattern
const CANVAS_DEFAULT_WIDTH = 360;
const CANVAS_MIN = 200;

const UI = {
  // existing entries ...
  canvasVisible: 'slopmop_ui:canvas_visible',
  canvasWidth:   'slopmop_ui:canvas_width',
} as const;

const [isCanvasVisible, setIsCanvasVisible] = useState<boolean>(() =>
  uiRead<boolean>(UI.canvasVisible, true)
);
const [canvasInitWidth] = useState(() =>
  Math.max(CANVAS_MIN, uiRead(UI.canvasWidth, CANVAS_DEFAULT_WIDTH))
);
const canvasMaxRef = useRef<number>(Infinity);
const canvas = useDragResize(canvasInitWidth, CANVAS_MIN, 'right', canvasMaxRef);

// Persist on drag-end (same prevDragging ref pattern used for sidebar/editor)
const prevCanvasDragging = useRef(false);
useEffect(() => {
  if (prevCanvasDragging.current && !canvas.isDragging) uiWrite(UI.canvasWidth, canvas.width);
  prevCanvasDragging.current = canvas.isDragging;
}, [canvas.isDragging, canvas.width]);

const toggleCanvas = useCallback(() => {
  setIsCanvasVisible(v => {
    uiWrite(UI.canvasVisible, !v);
    return !v;
  });
}, []);
```

### Pattern 2: Toolbar Toggle Button in Canvas Header
**What:** Small icon button in a header bar above the canvas iframe. Matches FolderPicker/VoiceBar button style.
**When to use:** Canvas column is visible — button collapses it. When canvas is hidden, a button in the app-wide toolbar (or a persistent edge affordance) re-opens it.
**Example approach:** Add a toggle icon button inside `LiveCanvasPanel`'s existing toolbar, passing `onToggle` as a prop. Alternatively, place a "show canvas" icon button in the editor panel header or the main toolbar for symmetric access.

### Pattern 3: Removing Canvas from Sidebar
**What:** Remove `'canvas'` from `SidebarTabId` union and `SIDEBAR_TABS` array. Remove the `sidebarTab === 'canvas'` branch from the sidebar content area. Remove `IconCanvas`. Remove the `'canvas'` option from the `valid` array in the `setSidebarTabRaw` initializer.
**When to use:** Part of the extraction — this is straightforward cleanup.

### Anti-Patterns to Avoid
- **Nesting canvas inside the editor column with a vertical flex split:** adds complexity for Phase 11 with no Phase 12/13 payoff. Keep them as independent columns.
- **Passing isDragging from the canvas's own resize hook to LiveCanvasPanel:** The existing `isDragging` prop on `LiveCanvasPanel` disables pointer events on the iframe during drag. Wire the canvas column's own resize isDragging to this prop.
- **Using a raw hex color in new CSS:** CLAUDE.md is explicit — use CSS variables from `theme.css` only.
- **Per-component CSS files:** All new CSS goes in `client/App.css`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-to-resize canvas column | Custom mousedown/mousemove logic | `useDragResize('right', ...)` | Already battle-tested in sidebar and editor panel |
| Persist canvas width | Direct localStorage.setItem calls | `uiRead`/`uiWrite` + prevDragging ref pattern | Matches existing drag-end persistence pattern exactly |
| Horizontal split inside column | Custom CSS flex hack | `useDragResize('up', ...)` + `.resize-handle--h` | Composer panel already uses this pattern in SessionPane |
| Canvas iframe pointer-events during drag | CSS override on drag | `isDragging` prop already supported on LiveCanvasPanel | The prop disables pointer events — just wire it |

**Key insight:** The entire resize + persist infrastructure already exists. Phase 11 is a layout restructure that wires existing pieces, not a new capability build.

## Common Pitfalls

### Pitfall 1: `maxRef` not updated for canvas column
**What goes wrong:** Canvas column grows beyond available space, overlapping other panels.
**Why it happens:** `maxRef.current` is updated each render for sidebar and editor but a newly added canvas ref would be missed.
**How to avoid:** Add `canvasMaxRef.current = window.innerWidth - (cwd ? sidebar.width + RESIZE_HANDLE_WIDTH : 0) - 300 - (activeTabs.length > 0 ? editor.width + RESIZE_HANDLE_WIDTH : 0);` in the layout max-width refs block.
**Warning signs:** Canvas visually overlaps the terminal/editor area.

### Pitfall 2: Forgetting to wire `isDragging` to `LiveCanvasPanel`
**What goes wrong:** Iframe captures mousemove events during canvas column resize, making the resize handle sticky/unresponsive.
**Why it happens:** `<iframe>` intercepts pointer events; the `isDragging` prop exists specifically to prevent this.
**How to avoid:** Pass `isDragging={canvas.isDragging}` to `<LiveCanvasPanel>`.
**Warning signs:** Resize handle stops tracking mouse as soon as it crosses the iframe boundary.

### Pitfall 3: Stale sidebar tab state after removing 'canvas'
**What goes wrong:** If a user had `canvas` persisted as their active sidebar tab in localStorage, removing it from the valid list causes a silent fallback to `explorer` — but the UI doesn't crash. This is actually handled by the existing `valid.includes(saved)` guard.
**Why it happens:** Non-issue — the guard already exists. But verify it falls back gracefully to `'explorer'`, not `undefined`.
**How to avoid:** Confirm `valid` array in `setSidebarTabRaw` initializer no longer includes `'canvas'`.

### Pitfall 4: Canvas column renders when `cwd` is null
**What goes wrong:** `LiveCanvasPanel` calls `/api/live-canvas?cwd=...` with an empty/null cwd, producing an API error on mount.
**Why it happens:** App renders before a project folder is connected.
**How to avoid:** Wrap the canvas column in the same `cwd &&` guard used for the sidebar. Only render the canvas column when `cwd` is set.

### Pitfall 5: Canvas width not constrained after window resize
**What goes wrong:** After the browser window shrinks, the saved canvas width could exceed the available space.
**Why it happens:** `maxRef` is calculated at render time, but the stored initial width is set once in `useState`.
**How to avoid:** The existing pattern (sidebar/editor) handles this the same way — the drag-end only writes when the drag finishes, and `maxRef` clamps during dragging. The initial width might still overflow on first render. Add a `Math.min` clamp on initial read: `Math.max(CANVAS_MIN, Math.min(window.innerWidth / 3, uiRead(...)))`.

## Code Examples

### Sidebar cleanup — remove canvas tab
```typescript
// BEFORE
type SidebarTabId = 'explorer' | 'changes' | 'roadmap' | 'brain' | 'canvas';
const SIDEBAR_TABS = [..., { id: 'canvas', label: 'Live Canvas', Icon: IconCanvas }];
const valid: SidebarTabId[] = ['explorer', 'changes', 'roadmap', 'brain', 'canvas'];

// AFTER
type SidebarTabId = 'explorer' | 'changes' | 'roadmap' | 'brain';
const SIDEBAR_TABS = [...]; // remove canvas entry
const valid: SidebarTabId[] = ['explorer', 'changes', 'roadmap', 'brain'];
// Remove IconCanvas SVG component and the sidebarTab === 'canvas' branch
```

### Canvas column JSX (in app-body, after editor panel)
```tsx
{cwd && isCanvasVisible && (
  <>
    <div
      className={`resize-handle${canvas.isDragging ? ' dragging' : ''}`}
      onMouseDown={canvas.onMouseDown}
    />
    <div className="canvas-column" style={{ width: canvas.width }}>
      <div className="canvas-column-header">
        <span className="canvas-column-label">Canvas</span>
        <button
          className="canvas-toggle-btn"
          title="Hide canvas"
          onClick={toggleCanvas}
        >
          {/* close/collapse icon */}
        </button>
      </div>
      <LiveCanvasPanel cwd={cwd} isDragging={canvas.isDragging} />
    </div>
  </>
)}
```

### CSS for canvas-column
```css
/* Canvas column — right column, full height, sibling of editor-panel */
.canvas-column {
  flex-shrink: 0;
  overflow: hidden;
  background: var(--bg);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.canvas-column-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.canvas-column-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--border-muted);
}

.canvas-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--txt-dim);
  padding: 2px 4px;
  border-radius: 3px;
  transition: color 0.12s, background 0.12s;
  font-family: monospace;
}
.canvas-toggle-btn:hover {
  color: var(--txt);
  background: var(--surface-hover);
}
```

### Show-canvas button placement (when isCanvasVisible is false)
The phase description says "toolbar toggle". The most discoverable location is a small icon button in the `FolderPicker` bar or as a standalone button that appears in the top-right of the app bar when canvas is hidden. A simple approach: always render a small "Canvas" toggle button in the folder-bar row, reflecting the current visible state.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canvas in sidebar tabs | Canvas as persistent right column | Phase 11 | Canvas always visible without sacrificing a sidebar slot |
| Width-only drag | Width + visibility persisted | Phase 11 | User preference survives reload |

**No deprecated libraries or APIs involved.** This is pure layout restructuring using existing project infrastructure.

## Open Questions

1. **Where does the "show canvas" button live when canvas is hidden?**
   - What we know: Phase description says "toolbar toggle"
   - What's unclear: Specific placement — folder-bar, editor header, or floating edge button
   - Recommendation: Add a small icon toggle button to the right end of the `folder-bar` div. It's always visible regardless of canvas state. Matches the pattern of settings/super-tools icons already in FolderPicker.

2. **Should the canvas column be a fixed width or share vertical space with the editor panel?**
   - What we know: Phase description says "split vertically from the editor panel" — this implies they share the same right column
   - What's unclear: Whether editor and canvas literally share one column (stacked), or are separate columns side by side
   - Recommendation: "Split vertically from the editor panel" most naturally means they share the right column, stacked. The canvas sits below the editor panel in the same flex-column container, separated by a `.resize-handle--h`. This requires a new wrapper `div.right-column` that replaces the standalone `editor-panel` element. The planner should confirm this interpretation before designing tasks.

3. **Should canvas visibility and width have separate localStorage keys or be combined?**
   - What we know: Existing pattern uses one key per dimension (sidebar width, editor width separately)
   - What's unclear: Nothing — follow the existing pattern: two keys (`canvasVisible`, `canvasWidth`)
   - Recommendation: Two separate keys, same as sidebar/editor.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 + @testing-library/react ^16 |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npm test -- --reporter=verbose live-canvas` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

Phase 11 requirements are TBD (not yet formally defined). Based on the phase description, the expected behaviors to test are:

| Behavior ID | Behavior | Test Type | Automated Command | File Exists? |
|-------------|----------|-----------|-------------------|-------------|
| CANVAS-01 | Canvas column renders when `cwd` is set and `isCanvasVisible` is true | unit (React) | `npm test -- LiveCanvasColumn` | ❌ Wave 0 |
| CANVAS-02 | Canvas column hidden when `isCanvasVisible` is false | unit (React) | `npm test -- LiveCanvasColumn` | ❌ Wave 0 |
| CANVAS-03 | Toggle button flips visibility and persists to localStorage | unit (React) | `npm test -- LiveCanvasColumn` | ❌ Wave 0 |
| CANVAS-04 | Canvas tab removed from sidebar — sidebar has 4 tabs not 5 | unit (React) | `npm test -- App.canvasPanel` | ❌ Wave 0 |
| CANVAS-05 | Canvas width restored from localStorage on mount | unit (React) | `npm test -- App.canvasPanel` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --reporter=verbose` on affected test file
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/App.canvasPanel.test.tsx` — covers CANVAS-04, CANVAS-05 (sidebar tab removal, localStorage restore)
- [ ] `tests/LiveCanvasColumn.test.tsx` — covers CANVAS-01, CANVAS-02, CANVAS-03 (visibility toggle, persistence)
- No framework install needed — Vitest + RTL already configured

## Sources

### Primary (HIGH confidence)
- Direct code reading of `client/App.tsx` — full layout structure, useDragResize wiring, uiRead/uiWrite pattern, SIDEBAR_TABS, sidebar tab render switch
- Direct code reading of `client/components/LiveCanvasPanel.tsx` — existing props interface (cwd, isDragging), fetch polling, iframe sandbox
- Direct code reading of `client/hooks/useDragResize.ts` — direction parameter options including 'up'/'right', maxRef pattern
- Direct code reading of `client/App.css` — .resize-handle, .resize-handle--h, .editor-panel, .live-canvas-panel, .app-body
- Direct code reading of `client/components/SessionPane.tsx` — composer panel 'up' direction + resize-handle--h usage
- Direct code reading of `.planning/config.json` — nyquist_validation: true

### Secondary (MEDIUM confidence)
- CLAUDE.md design system rules — confirmed font/color/spacing/border constraints for new CSS

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no external research needed
- Architecture: HIGH — layout structure fully read from source, existing patterns confirmed
- Pitfalls: HIGH — derived from reading actual code and known iframe drag interaction
- Test mapping: MEDIUM — requirement IDs are TBD; test names are derived from phase description, not formal specs

**Research date:** 2026-05-02
**Valid until:** 2026-06-01 (stable codebase — no fast-moving dependencies)
