## Canvas Tools (MCP)

SlopMop exposes a local MCP server at `server/canvas-mcp-stdio.js` with five canvas tools. Use these when output benefits from visual layout.

### When to use canvas tools

Use canvas tools when output would benefit from visual layout: task progress, data tables, timelines, analysis summaries, comparison matrices, diagrams. Open a new tab for each distinct topic. Lock the tab while a task is running. Unlock when done.

### Tool reference

| Tool | Signature | When to use |
|------|-----------|-------------|
| `canvas_open` | `canvas_open(title)` → `{canvas_id}` | Start of a task that produces visual output |
| `canvas_update` | `canvas_update(canvas_id, html)` → ok | Each time content changes |
| `canvas_lock` | `canvas_lock(canvas_id, reason?)` → ok | Before starting a multi-step task |
| `canvas_unlock` | `canvas_unlock(canvas_id)` → ok | After task completes |
| `canvas_close` | `canvas_close(canvas_id)` → ok | When the canvas is no longer needed |

### HTML format

Write **body HTML only** — no DOCTYPE, no `<html>`, no `<head>`. The SlopMop theme is injected automatically:
- Dark background (`#0d1117`), monospace font, orange accent (`#d4845a`)
- Pre-built classes: `.canvas-table`, `.canvas-progress`, `.canvas-card`, `.canvas-badge`, `.canvas-timeline`

Use `<!DOCTYPE html>` prefix **only** if you need to override the theme entirely.

### Example: progress tracker

```html
<div class="canvas-card">
  <h2>Task Progress</h2>
  <div class="canvas-progress"><div class="bar" style="width:60%"></div></div>
  <p style="color:var(--txt-sub)">Step 3 of 5 complete</p>
</div>
```

### Port configuration

The MCP script connects to SlopMop on `localhost:3000` by default. If you change the port, set the `SLOPMOP_PORT` environment variable in the MCP server config in `~/.claude/settings.json`.
