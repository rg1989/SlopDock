import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const PORT = process.env.SLOPMOP_PORT ?? 3000;
const BASE = `http://localhost:${PORT}`;

async function apiCall(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  let data = {};
  try { data = await r.json(); } catch { /* 204 no-body */ }
  return { ok: r.ok, status: r.status, data };
}

function toError(data) {
  return { isError: true, content: [{ type: 'text', text: data.error ?? 'Unknown error' }] };
}

function toOk(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

export async function callCanvasOpen(title) {
  const { ok, data } = await apiCall('POST', '/api/canvas/tabs', { title });
  if (!ok) return toError(data);
  return toOk({ canvas_id: data.id });
}

export async function callCanvasUpdate(canvas_id, html) {
  const { ok, data } = await apiCall('PUT', `/api/canvas/tabs/${canvas_id}`, { html });
  if (!ok) return toError(data);
  return toOk({ ok: true });
}

export async function callCanvasLock(canvas_id, reason) {
  const { ok, data } = await apiCall('POST', `/api/canvas/tabs/${canvas_id}/lock`, { reason });
  if (!ok) return toError(data);
  return toOk({ ok: true });
}

export async function callCanvasUnlock(canvas_id) {
  const { ok, data } = await apiCall('POST', `/api/canvas/tabs/${canvas_id}/unlock`, {});
  if (!ok) return toError(data);
  return toOk({ ok: true });
}

export async function callCanvasClose(canvas_id) {
  const { ok, data } = await apiCall('DELETE', `/api/canvas/tabs/${canvas_id}`);
  if (!ok) return toError(data);
  return toOk({ ok: true });
}

const server = new McpServer({ name: 'slopmop-canvas', version: '1.0.0' });

server.tool(
  'canvas_open',
  'Open a new canvas tab in SlopMop. Use this when output benefits from visual layout — tables, progress, timelines, analysis. Returns canvas_id for subsequent updates.',
  { title: z.string().describe('Title shown in the canvas tab bar') },
  async ({ title }) => callCanvasOpen(title)
);

server.tool(
  'canvas_update',
  'Replace canvas tab content with HTML. Write body content only (no DOCTYPE, no <html>, no <head>) — the SlopMop theme is injected automatically.',
  {
    canvas_id: z.string().describe('ID returned by canvas_open'),
    html: z.string().describe('HTML body content to display'),
  },
  async ({ canvas_id, html }) => callCanvasUpdate(canvas_id, html)
);

server.tool(
  'canvas_lock',
  'Lock a canvas tab to prevent the user from closing it while a task is running. Unlock when the task completes.',
  {
    canvas_id: z.string(),
    reason: z.string().optional().describe('Optional: why the tab is locked (shown to user if they try to close)'),
  },
  async ({ canvas_id, reason }) => callCanvasLock(canvas_id, reason)
);

server.tool(
  'canvas_unlock',
  'Unlock a canvas tab, re-enabling the user to close it.',
  { canvas_id: z.string() },
  async ({ canvas_id }) => callCanvasUnlock(canvas_id)
);

server.tool(
  'canvas_close',
  'Close a canvas tab when the task it tracks is complete. If the user already closed it, this returns a non-fatal error.',
  { canvas_id: z.string() },
  async ({ canvas_id }) => callCanvasClose(canvas_id)
);

const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) {
  await server.connect(new StdioServerTransport());
}
