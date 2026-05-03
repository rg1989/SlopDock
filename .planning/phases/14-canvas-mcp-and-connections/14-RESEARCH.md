# Phase 14: canvas-mcp-and-connections — Research

**Researched:** 2026-05-03
**Domain:** MCP stdio server, canvas tab state, SSE broadcast, React modal/toolbar patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Canvas Tab Model**
- Agent-only tab creation. No `+` button for user. User can only close tabs.
- Each tab has a unique ID (`canvas_id`). Agent gets this ID from `canvas_open()`.
- Tab list persisted to `.slop/canvas-state.json` so tabs survive server restart.
- SSE pushes tab state changes to frontend instantly (reuse existing SSE infrastructure).

**MCP Tools API (5 tools, stdio transport)**
- `canvas_open(title: string)` → `{canvas_id: string}`
- `canvas_update(canvas_id: string, html: string)` → ok
- `canvas_lock(canvas_id: string, reason?: string)` → ok
- `canvas_unlock(canvas_id: string)` → ok
- `canvas_close(canvas_id: string)` → ok
- MCP server is `server/canvas-mcp-stdio.js` using stdio transport, proxies to Express via HTTP on localhost
- Registered in `~/.claude/settings.json` under `mcpServers.slopmop-canvas`

**Design System / HTML Wrapping**
- Agent writes body content only (no DOCTYPE, no `<html>`, no `<head>`)
- Server wraps in template injecting SlopMop CSS variables + canvas classes: `.canvas-table`, `.canvas-progress`, `.canvas-card`, `.canvas-badge`, `.canvas-timeline`
- Escape hatch: if HTML starts with `<!DOCTYPE html>` or `<html`, pass through unmodified
- Default font: monospace. Default background: `--bg`. Default text: `--txt`. Accent: `--accent`.

**Lock Behaviour**
- Locked tab: close button (`×`) is visually dimmed
- Clicking close on locked tab → modal: "This canvas is locked: [reason]. Close anyway?" with Cancel and Force Close
- Force close works silently; agent's subsequent calls return "tab not found" error (not crash)

**Canvas Panel UI**
- Canvas column header: tab bar (same chip/underline pattern as bottom panel tabs: `.bpanel-tab`, `.bpanel-tab--active`, `.bpanel-tab-close`)
- Active tab: accent bottom border. No `+` button anywhere.
- Each chip: title (truncated ~20 chars) + `×` close button
- Tabs scroll horizontally if they overflow
- When all tabs closed: existing "No canvas yet" empty state
- Existing canvas toggle button remains

**MCP Connections UI**
- New icon button in FolderPicker toolbar, to the right of the canvas toggle
- Opens modal (same style as SettingsModal)
- Lists all MCP servers from `~/.claude/settings.json` → `mcpServers`
- Per server: name, command, connection status, tool count if pingable
- "Auto-register slopmop-canvas" button if not yet registered
- Read/display only (no arbitrary server config editing)

**Canvas State Server**
- In-memory `Map<string, CanvasTab>` on Express server
- Persisted to `.slop/canvas-state.json` on every write, loaded on server start
- Tab schema: `{id, title, html, locked, lockReason, createdAt, updatedAt}`
- REST API: GET/POST/PUT/DELETE `/api/canvas/tabs`, POST `/api/canvas/tabs/:id/lock`, POST `/api/canvas/tabs/:id/unlock`
- SSE: reuse `/api/live-canvas/events` or add `/api/canvas/events` — pushes full tab list on any change

**CLAUDE.md Addition**
> Use the `canvas_*` MCP tools when output would benefit from visual layout: task progress, data tables, timelines, analysis summaries, comparison matrices, diagrams. Open a new tab for each distinct topic. Lock the tab while a task is running. Write only body HTML — the SlopMop theme (dark background, monospace, orange accent) is injected automatically. Use `<!DOCTYPE html>` prefix only if you need to override the theme entirely.

### Claude's Discretion
- Exact `canvas_id` format (UUID vs short ID)
- How many tabs to allow before refusing `canvas_open` (if any limit)
- MCP server port conflict handling
- Tab title truncation strategy in the UI
- Exact icons for MCP connections button

### Deferred Ideas (OUT OF SCOPE)
- Canvas tab drag-to-reorder
- Canvas tab pinning
- Export canvas tab as PNG/PDF
- Canvas tab history / undo
- Full MCP server config editing in UI (beyond auto-register)
- Removing the existing canvas toggle button
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MCP-01 | `canvas_open(title)` tool creates a new tab, returns `canvas_id` | REST POST `/api/canvas/tabs`, UUID generation with `crypto.randomUUID()` |
| MCP-02 | `canvas_update(canvas_id, html)` tool replaces tab body content with theme wrapping | REST PUT `/api/canvas/tabs/:id`, HTML template injection pattern |
| MCP-03 | `canvas_lock(canvas_id, reason?)` and `canvas_unlock(canvas_id)` tools control close-button protection | REST POST lock/unlock routes, dimmed close button CSS |
| MCP-04 | `canvas_close(canvas_id)` tool closes a tab; subsequent operations on closed tab return "tab not found" (not crash) | REST DELETE `/api/canvas/tabs/:id`, graceful 404 handling in MCP server |
| MCP-05 | MCP server is a stdio script registered in `~/.claude/settings.json` under `mcpServers.slopmop-canvas` | `@modelcontextprotocol/sdk` + `StdioServerTransport`, mcpServers JSON format |
| CANVASTAB-01 | Canvas column header replaced with horizontal tab bar showing agent-opened tabs; active tab has accent bottom border | Reuse `.bpanel-tab` / `.bpanel-tab--active` / `.bpanel-tab-close` CSS classes, add canvas-tab namespace |
| CANVASTAB-02 | Tabs scroll horizontally if they overflow; no `+` button visible | `overflow-x: auto` + scroll buttons pattern from `SessionTabBar` |
| CANVASTAB-03 | Clicking `×` on locked tab shows confirmation modal with Cancel / Force Close | `ConfirmModal.tsx` pattern, locked state from SSE |
| CANVASTAB-04 | Tab list persists across server restarts via `.slop/canvas-state.json`; SSE pushes changes to frontend | Atomic write pattern from `live-canvas.ts`, SSE from `live-canvas-sse.ts` |
| MCPUI-01 | New icon button in FolderPicker toolbar opens MCP connections modal | Extend `FolderPickerProps`, add `onMcpOpen?` handler, match `fp-canvas-btn` CSS pattern |
| MCPUI-02 | MCP connections modal lists registered servers with status; "Auto-register slopmop-canvas" button if missing | SettingsModal structure, `~/.claude/settings.json` read endpoint |
</phase_requirements>

---

## Summary

Phase 14 has three distinct sub-systems that must be built in dependency order: (1) the canvas tab state server on the backend, (2) the multi-tab canvas panel on the frontend consuming that state via SSE, and (3) the MCP stdio script that proxies the five canvas tools to the Express API. The MCP connections UI is independent and can be built alongside any of the above.

The project already has excellent infrastructure to build on. The SSE broadcast system (`live-canvas-sse.ts`) is a clean, minimal pattern — replicating it for canvas tab events requires about 50 lines. The atomic write pattern from `live-canvas.ts` handles `.slop/canvas-state.json` persistence without modification. The bottom panel tab bar CSS (`.bpanel-tab`, `.bpanel-tab--active`, `.bpanel-tab-close`) is a direct visual match for what canvas tabs need — no new styles need to be invented.

The `@modelcontextprotocol/sdk` is NOT currently installed. It must be added as a dependency. Version 1.29.0 is the latest as of research date. The MCP server script must be CommonJS-compatible (`.js` with `require` or ESM with `type: module`) and standalone — it runs as a subprocess of Claude CLI via `node server/canvas-mcp-stdio.js`. The script proxies all operations to `http://localhost:3000` (the running Express server). The `~/.claude/settings.json` does not yet have a `mcpServers` key; registering requires adding that key with the server config.

**Primary recommendation:** Build in this order: (A) `CanvasTabStore` module + REST routes + SSE, (B) `MultiTabCanvasPanel` component + App.tsx wiring, (C) MCP connections modal, (D) `canvas-mcp-stdio.js` script + registration helper.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.29.0 | MCP server + stdio transport | Official SDK from Anthropic; `McpServer` high-level API + `StdioServerTransport` is the canonical pattern |
| `zod` | 4.4.2 (use `zod/v4`) | Input schema validation for MCP tools | Required peer dep of MCP SDK; v4 API needed for `McpServer.registerTool` |
| `crypto.randomUUID()` | Node built-in | Generate canvas_id | No dep needed; available in Node 15+ and all modern browsers |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs/promises` (Node built-in) | — | Atomic write for canvas-state.json | Already used in `live-canvas.ts` — reuse exact same pattern |
| `ConfirmModal.tsx` | existing | Lock confirmation dialog | Reuse for "This canvas is locked" force-close modal |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `McpServer` high-level API | Low-level `Server` class | `McpServer` is less boilerplate; low-level gives more control but needed for complex routing only |
| UUID for canvas_id | nanoid short IDs | UUID is built-in (no dep); nanoid gives friendlier IDs but needs a new dep — UUID is preferred here |

**Installation:**
```bash
npm install @modelcontextprotocol/sdk zod
```

Note: `zod` is already used internally by the SDK. Adding it explicitly as a dep ensures version consistency and allows it to be imported in `canvas-mcp-stdio.js`.

---

## Architecture Patterns

### Recommended Project Structure

New files to create:

```
server/
├── canvas-tab-store.ts      # CanvasTab type, in-memory Map, CRUD + persistence
├── canvas-tab-sse.ts        # SSE broadcast for canvas tab changes (mirrors live-canvas-sse.ts)
└── canvas-mcp-stdio.js      # Standalone MCP stdio script (NOT .ts — runs directly with node)

client/components/
├── MultiTabCanvasPanel.tsx  # Replaces LiveCanvasPanel in canvas-column
└── McpConnectionsModal.tsx  # MCP connections modal

tests/
├── canvas-tab-store.test.ts       # Unit: CRUD, persistence, atomic write
├── canvas-mcp-tools.test.ts       # Unit: HTTP proxy logic (mock fetch)
├── MultiTabCanvasPanel.test.tsx   # Component: tab render, lock state, close modal
└── McpConnectionsModal.test.tsx   # Component: server list render, auto-register button
```

`.slop/canvas-state.json` — created at runtime, not tracked in git.

### Pattern 1: Canvas Tab Store (mirrors live-canvas.ts)

**What:** In-memory Map persisted to disk on every write. Loaded once at server startup.
**When to use:** Canvas state management throughout the Express server.

```typescript
// server/canvas-tab-store.ts
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { notifyCanvasTabsUpdated } from './canvas-tab-sse.js';

export interface CanvasTab {
  id: string;
  title: string;
  html: string;
  locked: boolean;
  lockReason?: string;
  createdAt: number;
  updatedAt: number;
}

const tabs = new Map<string, CanvasTab>();
let stateFilePath: string | null = null;

async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tmp = filePath + '.tmp';
  await writeFile(tmp, data, 'utf-8');
  await rename(tmp, filePath);
}

export async function initCanvasStore(projectRoot: string): Promise<void> {
  stateFilePath = path.resolve(projectRoot, '.slop', 'canvas-state.json');
  try {
    const raw = await readFile(stateFilePath, 'utf-8');
    const arr = JSON.parse(raw) as CanvasTab[];
    tabs.clear();
    for (const t of arr) tabs.set(t.id, t);
  } catch { /* file not found on first run */ }
}

async function persist(projectRoot: string): Promise<void> {
  if (!stateFilePath) return;
  await mkdir(path.dirname(stateFilePath), { recursive: true });
  await atomicWrite(stateFilePath, JSON.stringify([...tabs.values()]));
  notifyCanvasTabsUpdated(projectRoot);
}
```

### Pattern 2: SSE for Canvas Tabs (mirrors live-canvas-sse.ts)

**What:** Fan-out SSE that pushes the full tab array on any mutation.
**When to use:** Frontend subscribes once; all tab CRUD flows through SSE.

```typescript
// server/canvas-tab-sse.ts
import type { Request, Response } from 'express';
import { getAllTabs } from './canvas-tab-store.js';

type Client = { res: Response };
const clients = new Set<Client>();

export function registerCanvasTabSseClient(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  const entry: Client = { res };
  clients.add(entry);
  // Send current state immediately on connect
  res.write(`data: ${JSON.stringify({ tabs: getAllTabs() })}\n\n`);
  const detach = () => clients.delete(entry);
  req.on('close', detach);
  res.on('close', detach);
}

export function notifyCanvasTabsUpdated(_projectRoot: string): void {
  const line = `data: ${JSON.stringify({ tabs: getAllTabs() })}\n\n`;
  for (const c of clients) {
    if (c.res.writableEnded) { clients.delete(c); continue; }
    try { c.res.write(line); } catch { clients.delete(c); }
  }
}
```

### Pattern 3: McpServer Tool Registration

**What:** High-level `McpServer` API with Zod input schemas.
**When to use:** All five canvas tools in `canvas-mcp-stdio.js`.

```javascript
// server/canvas-mcp-stdio.js  (plain .js, runs with node)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = 'http://localhost:3000';
const server = new McpServer({ name: 'slopmop-canvas', version: '1.0.0' });

server.registerTool(
  'canvas_open',
  {
    description: 'Open a new canvas tab. Returns canvas_id.',
    inputSchema: z.object({ title: z.string() }),
  },
  async ({ title }) => {
    const r = await fetch(`${BASE}/api/canvas/tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const data = await r.json();
    if (!r.ok) return { isError: true, content: [{ type: 'text', text: data.error }] };
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);
// ... remaining 4 tools follow same fetch-proxy pattern

await server.connect(new StdioServerTransport());
```

### Pattern 4: `~/.claude/settings.json` mcpServers Registration

**What:** JSON object added to `~/.claude/settings.json` so Claude CLI spawns the server.
**Format (verified from official MCP docs):**

```json
{
  "mcpServers": {
    "slopmop-canvas": {
      "command": "node",
      "args": ["/absolute/path/to/server/canvas-mcp-stdio.js"],
      "env": {}
    }
  }
}
```

The `command` is the binary to spawn. `args` are the argv array. Claude CLI merges this with its existing settings — patching the file must preserve existing keys.

**Auto-register backend endpoint** (`POST /api/mcp-register-canvas`) should:
1. Read `~/.claude/settings.json` (create if missing)
2. Merge `mcpServers.slopmop-canvas` into the object
3. Atomic write back

**Read endpoint** (`GET /api/mcp-servers`) should:
1. Read `~/.claude/settings.json`
2. Return `mcpServers` object (or `{}` if missing)
3. For each server: include name, command, args — status check is best-effort ping

### Pattern 5: MCP Connections Modal (mirrors SettingsModal structure)

**What:** Modal opened by new toolbar button, lists MCP servers.
**When to use:** User clicks the MCP connections icon in FolderPicker.

Key structural elements:
- `modal-overlay` + `modal-panel` + `modal-header` + `modal-body` + `modal-footer` (identical to SettingsModal)
- Server list rows: name (monospace bold), command chip, status dot (green = ok, grey = registered-only)
- "Auto-register slopmop-canvas" button: only shown when `mcpServers.slopmop-canvas` is absent

### Pattern 6: Multi-Tab Canvas Panel

**What:** Replaces `<LiveCanvasPanel>` in the canvas column. Renders the tab bar + active tab's iframe.
**Key behaviors:**
- Tab bar uses `.bpanel-tab` / `.bpanel-tab--active` / `.bpanel-tab-close` classes verbatim (no new CSS for the chips themselves)
- SSE subscription: `GET /api/canvas/events` — receives full tab array on each change
- Active tab stored in local React state; falls back to first tab when active tab is closed
- Locked close: `bpanel-tab-close--locked` modifier reduces opacity; onClick shows `ConfirmModal`

### Anti-Patterns to Avoid

- **Using polling instead of SSE for tab state**: The existing SSE infrastructure is already in place. Use it — polling introduces lag and duplicates the architecture.
- **TypeScript for the MCP stdio script**: `canvas-mcp-stdio.js` must be plain `.js` (or ESM `.mjs`) — it runs directly with `node`, not through `tsx`. Put TypeScript types in a separate `.d.ts` if needed.
- **Importing canvas-tab-store from the MCP script**: The MCP script is a separate process. It must use HTTP — never import the store directly.
- **Modifying `~/.claude/settings.json` without preserving existing keys**: Read-merge-write, not overwrite.
- **Adding `font-family: monospace` to canvas tab CSS**: The global `* { font-family: monospace }` rule handles this. Per CLAUDE.md rule 1, only add `font-family` when setting an exception.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom tmp-file logic | Copy the exact `atomicWrite` from `live-canvas.ts` | Already solved; tmp+rename is the correct pattern |
| SSE fan-out | Custom EventEmitter routing | Copy the `clients` Set + `notifyXxx` pattern from `live-canvas-sse.ts` | Already solved; handles writableEnded cleanup |
| MCP protocol framing | Custom JSON-RPC over stdin/stdout | `@modelcontextprotocol/sdk` `StdioServerTransport` | The wire protocol has edge cases (buffering, partial reads) |
| Tool input validation | Manual type checks | Zod schemas in `McpServer.registerTool` | SDK validates before calling handler; throws proper MCP errors |
| Modal from scratch | New modal component | Reuse `modal-overlay` / `modal-panel` CSS + structure from SettingsModal | Design consistency; existing CSS handles all states |
| Confirmation dialog | New inline dialog | Reuse `ConfirmModal.tsx` (already exists) | Already tested; handles Escape key |

**Key insight:** This phase is primarily wiring existing patterns — the SSE, atomic write, modal, and tab-chip patterns are all already tested and working. The only genuinely new code is the MCP server script and the canvas tab store.

---

## Common Pitfalls

### Pitfall 1: MCP Script Must Be Node-Executable, Not TSX

**What goes wrong:** Writing `canvas-mcp-stdio.ts` and assuming `tsx watch` will handle it. It won't — Claude CLI spawns it directly with `node`, not through the dev server.
**Why it happens:** The rest of the server is `.ts` transpiled by tsx.
**How to avoid:** Write `canvas-mcp-stdio.js` as plain ESM (add `"type": "module"` or use `.mjs`). Since `package.json` already has `"type": "module"`, a `.js` file in `server/` will be treated as ESM.
**Warning signs:** `SyntaxError: Cannot use import statement` when Claude tries to spawn the server.

### Pitfall 2: `~/.claude/settings.json` May Not Have a `mcpServers` Key

**What goes wrong:** Auto-register reads the file, finds no `mcpServers` key, and crashes or writes a malformed file.
**Why it happens:** The current `~/.claude/settings.json` has keys `permissions`, `model`, `hooks`, `statusLine`, `effortLevel` — no `mcpServers` yet.
**How to avoid:** Read → parse → `existing.mcpServers ??= {}` → merge → write.
**Warning signs:** Claude CLI fails to start with settings parse error.

### Pitfall 3: SSE Client Cleanup on writableEnded

**What goes wrong:** Clients that disconnected stay in the Set; subsequent `res.write()` throws.
**Why it happens:** `close` event doesn't always fire before the next notify call in high-throughput scenarios.
**How to avoid:** Check `c.res.writableEnded` before writing and delete stale entries — this is already the pattern in `notifyLiveCanvasUpdated`. Copy it exactly.

### Pitfall 4: IFrame Security — agent HTML Can Run Scripts

**What goes wrong:** Agent HTML can access `window.parent` or make network requests if sandbox is too permissive.
**Why it happens:** The current `LiveCanvasPanel` uses `sandbox="allow-scripts allow-forms"` which is already intentionally restrictive.
**How to avoid:** Keep the same sandbox value for canvas tab iframes. Do NOT add `allow-same-origin` — that would break the security boundary.

### Pitfall 5: HTML Wrapping vs Pass-Through Detection

**What goes wrong:** Wrapping HTML that starts with `<!DOCTYPE html>` adds a second DOCTYPE.
**Why it happens:** String prefix check is easy to get wrong (`trimStart()` before checking).
**How to avoid:**
```typescript
function wrapHtml(rawHtml: string, cssVars: string): string {
  const trimmed = rawHtml.trimStart();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return rawHtml; // pass-through
  }
  return `<!DOCTYPE html><html>...${rawHtml}...`;
}
```

### Pitfall 6: Canvas Tab SSE Does Not Need cwd Scoping

**What goes wrong:** Copying the cwd-scoped SSE client pattern from `live-canvas-sse.ts` when canvas tabs are global to the server instance.
**Why it happens:** The live canvas SSE filters by `cwdNorm` because it tracks a per-project file.
**How to avoid:** Canvas tabs are in the server's in-memory Map, not per-project. The SSE endpoint for canvas tabs does not need a `cwd` parameter. Remove cwd filtering.

### Pitfall 7: Stale Canvas_id After Force-Close

**What goes wrong:** After user force-closes a locked tab, the MCP server makes subsequent calls with the same `canvas_id` expecting success.
**Why it happens:** The agent doesn't know the tab was closed.
**How to avoid:** The REST routes must return `404 { error: 'tab not found' }` for missing IDs. The MCP tool handlers must propagate this as `isError: true` content — not throw. This ensures Claude sees a graceful tool failure, not an MCP protocol error.

---

## Code Examples

Verified patterns from existing codebase:

### Bottom Panel Tab Chip (exact CSS classes to reuse)

```css
/* Source: client/App.css lines 4563-4615 */
.bpanel-tab               /* flex container, height: 100%, cursor: pointer */
.bpanel-tab:hover         /* background: var(--surface-hover) */
.bpanel-tab--active       /* background: var(--surface-hi) + border-bottom: 1px solid var(--accent) */
.bpanel-tab-label         /* font-size: 11px; font-family: monospace */
.bpanel-tab-close         /* 16x16 button, var(--txt-dim) */
.bpanel-tab-close:hover   /* var(--txt) + var(--surface-hover) */
```

For canvas tabs: use these classes as-is. Add `canvas-tab` as an additional class for canvas-specific overrides if needed (e.g., locked state opacity).

### FolderPicker Button Pattern (exact structure to match for MCP button)

```tsx
// Source: client/components/FolderPicker.tsx lines 283-294
{onCanvasToggle && (
  <button
    className={`fp-canvas-btn${isCanvasVisible ? ' fp-canvas-btn--active' : ''}`}
    onClick={onCanvasToggle}
    title={isCanvasVisible ? 'Hide canvas' : 'Show canvas'}
  >
    <svg width="15" height="15" ...>...</svg>
  </button>
)}
```

MCP button: add `onMcpOpen?: () => void` to `FolderPickerProps`, render after canvas toggle button. Use class `fp-mcp-btn`. No active state needed (it's a modal trigger, not a toggle).

### Atomic Write Pattern (copy from live-canvas.ts)

```typescript
// Source: server/live-canvas.ts lines 20-24
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = filePath + '.tmp';
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, filePath);
}
```

Use identical pattern in `canvas-tab-store.ts` for `.slop/canvas-state.json`.

### SSE Registration Pattern (copy from live-canvas-sse.ts)

```typescript
// Source: server/live-canvas-sse.ts lines 15-38
// Key differences for canvas: no cwdNorm scoping, push full tabs array
```

### SettingsModal Structure (replicate for McpConnectionsModal)

```tsx
// Source: client/components/SettingsModal.tsx lines 338-617
<div className="modal-overlay" onMouseDown={overlayClickClose}>
  <div className="modal-panel modal-panel--settings-wide" role="dialog" aria-modal="true">
    <div className="modal-header">
      <span className="modal-title">MCP Connections</span>
      <button className="modal-close-btn" onClick={onClose}>×</button>
    </div>
    <div className="modal-body">
      {/* server list */}
    </div>
    <div className="modal-footer">
      <button className="fp-btn primary" onClick={onClose}>Done</button>
    </div>
  </div>
</div>
```

No settings-tab-bar needed for MCP modal (single view, no sub-tabs).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `live-canvas.html` file | Multi-tab in-memory store + SSE | Phase 14 | Agent can work on multiple canvases simultaneously |
| Live canvas polling (2s interval) in LiveCanvasPanel | SSE subscription in MultiTabCanvasPanel | Phase 14 | Instant updates, no stale state |
| No MCP tools | 5 canvas tools via stdio MCP server | Phase 14 | Claude CLI can control canvas without writing files |

**Deprecated/outdated after this phase:**
- `LiveCanvasPanel.tsx` polling loop — replaced by SSE in `MultiTabCanvasPanel.tsx`
- Direct `live-canvas.html` file for canvas output — agent should use MCP tools instead (file still works as fallback)

---

## Open Questions

1. **Port hardcoding in canvas-mcp-stdio.js**
   - What we know: Express server runs on PORT=3000 (set in npm scripts)
   - What's unclear: If user changes the port, the MCP script breaks silently
   - Recommendation: Read port from environment variable `SLOPMOP_PORT` with default 3000; document this in `.slop/CLAUDE.md`

2. **MCP server connections modal — status check mechanism**
   - What we know: The modal needs a "connection status" per registered server
   - What's unclear: Claude CLI is what actually connects to MCP servers; the app cannot verify if the connection is live from Claude's perspective
   - Recommendation: Show "registered" for all servers in `mcpServers`; add a special "ping" for `slopmop-canvas` by hitting `/api/canvas/tabs` (if 200, show as "active")

3. **Tab limit enforcement**
   - What we know: CONTEXT.md defers this to Claude's discretion
   - What's unclear: No limit means a runaway agent could open hundreds of tabs
   - Recommendation: Impose a soft limit of 20 tabs; `canvas_open` returns an error if exceeded; this is reversible

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + React Testing Library 16 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --reporter=verbose tests/canvas-tab-store.test.ts tests/canvas-mcp-tools.test.ts tests/MultiTabCanvasPanel.test.tsx tests/McpConnectionsModal.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-01 | `canvas_open` creates tab, returns canvas_id | unit | `npm test -- tests/canvas-tab-store.test.ts` | Wave 0 |
| MCP-02 | `canvas_update` replaces html, wrapping logic | unit | `npm test -- tests/canvas-tab-store.test.ts` | Wave 0 |
| MCP-03 | lock/unlock sets locked flag + lockReason | unit | `npm test -- tests/canvas-tab-store.test.ts` | Wave 0 |
| MCP-04 | close removes tab; missing id returns 404 | unit | `npm test -- tests/canvas-tab-store.test.ts` | Wave 0 |
| MCP-05 | MCP proxy tools call correct HTTP endpoints | unit | `npm test -- tests/canvas-mcp-tools.test.ts` | Wave 0 |
| MCP-05 | `~/.claude/settings.json` registration format | manual | n/a — file system side effect | manual-only |
| CANVASTAB-01 | Tab bar renders with correct CSS classes | component | `npm test -- tests/MultiTabCanvasPanel.test.tsx` | Wave 0 |
| CANVASTAB-02 | No `+` button; tabs overflow-scroll | component | `npm test -- tests/MultiTabCanvasPanel.test.tsx` | Wave 0 |
| CANVASTAB-03 | Force-close modal shown on locked tab click | component | `npm test -- tests/MultiTabCanvasPanel.test.tsx` | Wave 0 |
| CANVASTAB-04 | State persisted to canvas-state.json | unit | `npm test -- tests/canvas-tab-store.test.ts` | Wave 0 |
| MCPUI-01 | MCP button visible in FolderPicker | component | `npm test -- tests/McpConnectionsModal.test.tsx` | Wave 0 |
| MCPUI-02 | Modal lists servers; auto-register button | component | `npm test -- tests/McpConnectionsModal.test.tsx` | Wave 0 |

**Manual-only tests (and why):**
- MCP-05 Claude CLI integration: Verifying that Claude CLI actually spawns the MCP server and calls tools requires a real Claude CLI process — not testable in jsdom or unit test context.
- End-to-end SSE push to browser: SSE stream behavior requires a real HTTP server; Vitest doesn't support this without msw or supertest integration (not currently in the stack).
- HTML theme wrapping visual correctness: Requires visual inspection in a real browser to confirm CSS variables resolve correctly.

### Sampling Rate

- **Per task commit:** `npm test -- tests/canvas-tab-store.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/canvas-tab-store.test.ts` — covers MCP-01, MCP-02, MCP-03, MCP-04, CANVASTAB-04 (unit tests for the store CRUD + persistence + HTML wrapping)
- [ ] `tests/canvas-mcp-tools.test.ts` — covers MCP-05 (mock fetch, verify HTTP proxy calls)
- [ ] `tests/MultiTabCanvasPanel.test.tsx` — covers CANVASTAB-01, CANVASTAB-02, CANVASTAB-03
- [ ] `tests/McpConnectionsModal.test.tsx` — covers MCPUI-01, MCPUI-02 (mock fetch for `/api/mcp-servers`)
- [ ] Framework install: `npm install @modelcontextprotocol/sdk zod` — required before implementation

---

## Sources

### Primary (HIGH confidence)

- Codebase direct inspection — `server/live-canvas.ts`, `server/live-canvas-sse.ts`, `server/index.ts:435-490`, `client/components/LiveCanvasPanel.tsx`, `client/components/FolderPicker.tsx`, `client/components/SettingsModal.tsx`, `client/components/SessionTabBar.tsx`, `client/App.tsx`
- `client/App.css` lines 4510–4640 — bpanel tab CSS classes (confirmed exact class names)
- `package.json` — confirmed `@modelcontextprotocol/sdk` is NOT installed
- `~/.claude/settings.json` — confirmed `mcpServers` key is absent; file has `permissions`, `model`, `hooks`, `statusLine`, `effortLevel`
- `.planning/config.json` — confirmed `workflow.nyquist_validation: true`

### Secondary (MEDIUM confidence)

- `npm show @modelcontextprotocol/sdk version` → 1.29.0 (verified live)
- `npm show zod version` → 4.4.2 (verified live)
- modelcontextprotocol/typescript-sdk GitHub (WebFetch) — confirmed `McpServer` + `StdioServerTransport` API, tool registration with Zod, return format with `content` array

### Tertiary (LOW confidence)

- mcpServers JSON format in `~/.claude/settings.json` — inferred from MCP official docs + community examples; `{ command, args, env }` structure is consistent across multiple sources but not directly verified against this specific Claude CLI version

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified with npm, MCP SDK API verified from official docs
- Architecture: HIGH — all patterns derived from existing codebase inspection
- Pitfalls: HIGH — all except port-hardcoding derived from reading actual code
- mcpServers JSON format: MEDIUM — consistent across sources but not verified against installed Claude CLI version

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (MCP SDK is actively developed; check for breaking changes before implementing)
