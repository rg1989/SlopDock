# Phase 14: canvas-mcp-and-connections — Context

**Gathered:** 2026-05-03
**Status:** Ready for planning
**Source:** Design conversation

<domain>
## Phase Boundary

This phase delivers three interconnected features:

1. **Multi-tab canvas panel** — the canvas column gets its own tab bar. Agent opens tabs, user closes them (with lock protection). No user-opened tabs.
2. **Canvas MCP server** — a local stdio MCP server exposing 5 tools that Claude CLI calls to control the canvas. Registered in `~/.claude/settings.json`.
3. **MCP connections management UI** — button in FolderPicker toolbar (next to canvas toggle), opens a modal listing registered MCP servers with status and config.

This phase does NOT cover: canvas content editing by the user, canvas sharing, export, or embedding other apps.

</domain>

<decisions>
## Implementation Decisions

### Canvas Tab Model

- Agent-only tab creation. No `+` button for user. User can only close tabs.
- Each tab has a unique ID (`canvas_id`). Agent gets this ID from `canvas_open()`.
- Tab list persisted to `.slop/canvas-state.json` so tabs survive server restart.
- SSE pushes tab state changes to frontend instantly (reuse existing SSE infrastructure).

### MCP Tools API (5 tools, stdio transport)

- `canvas_open(title: string)` → `{canvas_id: string}` — creates a new tab, returns ID
- `canvas_update(canvas_id: string, html: string)` → ok — replaces tab body content
- `canvas_lock(canvas_id: string, reason?: string)` → ok — prevents user from closing
- `canvas_unlock(canvas_id: string)` → ok — re-enables close button
- `canvas_close(canvas_id: string)` → ok — agent closes its own tab

MCP server is a standalone Node.js script (`server/canvas-mcp-stdio.js`) using stdio transport. It proxies operations to SlopMop's Express server via HTTP on localhost. Registered in `~/.claude/settings.json` under `mcpServers.slopmop-canvas`.

### Design System / HTML Wrapping

- Agent writes **body content only** (no DOCTYPE, no `<html>`, no `<head>`).
- Server wraps it in a template that injects all SlopMop CSS variables plus a small set of pre-built canvas classes: `.canvas-table`, `.canvas-progress`, `.canvas-card`, `.canvas-badge`, `.canvas-timeline`.
- **Escape hatch**: if agent's HTML starts with `<!DOCTYPE html>` or `<html`, server passes it through unmodified. This lets Claude override the theme when explicitly asked.
- Default font: `monospace`. Default background: `--bg` (`#0d1117`). Default text: `--txt` (`#c9d1d9`). Accent: `--accent` (`#d4845a`).

### Lock Behaviour

- Locked tab: close button (`×`) is visually dimmed.
- Clicking close on locked tab → modal: "This canvas is locked: [reason]. Close anyway?" with **Cancel** and **Force Close**.
- Force close works silently — agent's subsequent `canvas_update`/`canvas_unlock` calls to a closed tab return a "tab not found" error (not a crash).
- `reason` is optional — if not provided, modal shows generic "This canvas is tracking an active task."

### Canvas Panel UI

- Canvas column header: tab bar (same chip/underline pattern as bottom panel tabs).
- Active tab: accent bottom border. Inactive: dimmed.
- No `+` button visible anywhere.
- Each chip shows: tab title (truncated to ~20 chars) + `×` close button.
- Tabs scroll horizontally if they overflow.
- When all tabs are closed: panel shows the existing "No canvas yet" empty state.
- Existing canvas toggle button (open/close the whole panel) remains — not removed this phase.

### MCP Connections UI

- New icon button in FolderPicker toolbar, to the right of the canvas toggle.
- Opens a modal (same style as SettingsModal).
- Lists all MCP servers from `~/.claude/settings.json` → `mcpServers`.
- Per server: name, command, connection status (ping test or "registered only"), tool count if pingable.
- "Auto-register slopmop-canvas" button if the canvas MCP server is not yet registered.
- Read/display only — no in-app config editing for arbitrary servers (just the auto-register action for our own server).

### Canvas State Server

- In-memory map `Map<string, CanvasTab>` on Express server.
- Persisted to `.slop/canvas-state.json` on every write, loaded on server start.
- Tab schema: `{id, title, html, locked, lockReason, createdAt, updatedAt}`.
- REST API: `GET /api/canvas/tabs`, `POST /api/canvas/tabs`, `PUT /api/canvas/tabs/:id`, `DELETE /api/canvas/tabs/:id`, `POST /api/canvas/tabs/:id/lock`, `POST /api/canvas/tabs/:id/unlock`.
- SSE: reuse `/api/live-canvas/events` or add `/api/canvas/events` — pushes full tab list on any change.

### CLAUDE.md Addition

The canvas MCP must also be documented for Claude in `.slop/CLAUDE.md`:
> Use the `canvas_*` MCP tools when output would benefit from visual layout: task progress, data tables, timelines, analysis summaries, comparison matrices, diagrams. Open a new tab for each distinct topic. Lock the tab while a task is running. Write only body HTML — the SlopMop theme (dark background, monospace, orange accent) is injected automatically. Use `<!DOCTYPE html>` prefix only if you need to override the theme entirely.

### Claude's Discretion

- Exact `canvas_id` format (UUID vs short ID)
- How many tabs to allow before refusing `canvas_open` (if any limit)
- MCP server port conflict handling
- Tab title truncation strategy in the UI
- Exact icons for MCP connections button

</decisions>

<specifics>
## Specific References

**Existing canvas infrastructure to build on:**
- `server/live-canvas.ts` — `readLiveCanvas` / `writeLiveCanvas` (atomic write pattern to reuse)
- `server/live-canvas-sse.ts` — SSE broadcast infrastructure to reuse
- `server/index.ts` lines 435–490 — existing canvas REST routes (extend, don't replace)
- `client/components/LiveCanvasPanel.tsx` — polling + iframe render (replace with tab-aware version)
- `.slop/canvas-state.json` — new persistence file

**Existing UI patterns to match:**
- Bottom panel tab chips: `.bpanel-tab`, `.bpanel-tab--active`, `.bpanel-tab-close` — same visual pattern for canvas tabs
- FolderPicker toolbar buttons (canvas toggle, settings icon) — same pattern for MCP button
- SettingsModal — same modal pattern for MCP connections modal

**MCP protocol reference:**
- Claude CLI MCP config: `~/.claude/settings.json` → `mcpServers` object
- stdio transport: process spawned by Claude, JSON-RPC 2.0 over stdin/stdout
- MCP SDK: `@modelcontextprotocol/sdk` (check if already in package.json)

</specifics>

<deferred>
## Deferred

- Canvas tab drag-to-reorder
- Canvas tab pinning (prevent close without lock)
- Export canvas tab as PNG/PDF
- Canvas tab history / undo
- Full MCP server config editing in UI (beyond auto-register)
- Removing the existing canvas toggle button (deferred to next phase)

</deferred>

---

*Phase: 14-canvas-mcp-and-connections*
*Context gathered: 2026-05-03 from design conversation*
