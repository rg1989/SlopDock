import type { Request, Response } from 'express';
import type { CanvasTab } from './canvas-tab-store.js';

type Client = { res: Response };

const clients = new Set<Client>();
let _getAll: () => CanvasTab[] = () => [];

export function setTabsGetter(fn: () => CanvasTab[]): void {
  _getAll = fn;
}

export function registerCanvasTabSseClient(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const entry: Client = { res };
  clients.add(entry);

  res.write(`data: ${JSON.stringify({ tabs: _getAll() })}\n\n`);

  const detach = () => {
    clients.delete(entry);
  };
  req.on('close', detach);
  res.on('close', detach);
}

export function notifyCanvasTabsUpdated(): void {
  const payload = `data: ${JSON.stringify({ tabs: _getAll() })}\n\n`;
  for (const c of clients) {
    if (c.res.writableEnded) {
      clients.delete(c);
      continue;
    }
    try {
      c.res.write(payload);
    } catch {
      clients.delete(c);
    }
  }
}
