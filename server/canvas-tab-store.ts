import path from 'path';
import { readFile, rename, writeFile, mkdir } from 'fs/promises';
import { notifyCanvasTabsUpdated, setTabsGetter } from './canvas-tab-sse.js';

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
let stateFilePath = '';

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = filePath + '.tmp';
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, filePath);
}

function wrapHtml(rawHtml: string): string {
  const trimmed = rawHtml.trimStart();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return rawHtml;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
:root {
  --bg: #0d1117;
  --surface: #161b22;
  --surface-hover: #1c2128;
  --surface-hi: #21262d;
  --border: #30363d;
  --border-muted: #484f58;
  --txt-dim: #6e7681;
  --txt-sub: #8b949e;
  --txt: #c9d1d9;
  --txt-bright: #e6edf3;
  --accent: #d4845a;
  --accent-hover: #e89a70;
  --accent-dim: #c57348;
  --accent-rgb: 212, 132, 90;
  --error: #f85149;
  --error-rgb: 248, 81, 73;
  --success: #7ee787;
  --warning: #e3b341;
  --info: #79c0ff;
  --syn-red: #ff7b72;
  --syn-blue: #a5d6ff;
  --syn-purple: #d2a8ff;
  --syn-violet: #bc8cff;
  --syn-link: #58a6ff;
  --syn-green: #aff3b7;
}

body {
  background: var(--bg);
  color: var(--txt);
  font-family: monospace;
  margin: 16px;
  line-height: 1.5;
}

.canvas-table {
  width: 100%;
  border-collapse: collapse;
}
.canvas-table th,
.canvas-table td {
  border: 1px solid var(--border);
  padding: 6px 12px;
  text-align: left;
}
.canvas-table th {
  background: var(--surface);
  color: var(--txt-bright);
}

.canvas-progress {
  height: 8px;
  background: var(--surface-hi);
  border-radius: 4px;
  overflow: hidden;
}
.canvas-progress .bar {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
}

.canvas-card {
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 8px;
}

.canvas-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 11px;
  border-radius: 3px;
  background: var(--surface-hi);
  color: var(--txt-sub);
}

.canvas-timeline {
  list-style: none;
  padding: 0;
  margin: 0;
}
.canvas-timeline li {
  padding: 8px 12px;
  border-left: 2px solid var(--accent);
  margin-bottom: 8px;
  background: var(--surface);
}
</style>
</head>
<body>
${rawHtml}
</body>
</html>`;
}

async function persist(): Promise<void> {
  if (!stateFilePath) return;
  const data = JSON.stringify(Array.from(tabs.values()), null, 2);
  await mkdir(path.dirname(stateFilePath), { recursive: true });
  await atomicWrite(stateFilePath, data);
  notifyCanvasTabsUpdated();
}

export function createTab(title: string): CanvasTab | null {
  if (tabs.size >= 20) return null;
  const now = Date.now();
  const tab: CanvasTab = {
    id: crypto.randomUUID(),
    title,
    html: '',
    locked: false,
    createdAt: now,
    updatedAt: now,
  };
  tabs.set(tab.id, tab);
  void persist();
  return tab;
}

export function updateTab(id: string, rawHtml: string): void {
  const tab = tabs.get(id);
  if (!tab) return;
  tab.html = wrapHtml(rawHtml);
  tab.updatedAt = Date.now();
  void persist();
}

export function lockTab(id: string, reason?: string): void {
  const tab = tabs.get(id);
  if (!tab) return;
  tab.locked = true;
  if (reason !== undefined) {
    tab.lockReason = reason;
  } else {
    delete tab.lockReason;
  }
  tab.updatedAt = Date.now();
  void persist();
}

export function unlockTab(id: string): void {
  const tab = tabs.get(id);
  if (!tab) return;
  tab.locked = false;
  delete tab.lockReason;
  tab.updatedAt = Date.now();
  void persist();
}

export function closeTab(id: string): void {
  tabs.delete(id);
  void persist();
}

export function getTab(id: string): CanvasTab | undefined {
  return tabs.get(id);
}

export function getAllTabs(): CanvasTab[] {
  return Array.from(tabs.values());
}

export async function initCanvasStore(projectRoot: string): Promise<void> {
  stateFilePath = path.join(projectRoot, '.slop', 'canvas-state.json');
  setTabsGetter(getAllTabs);
  try {
    const raw = await readFile(stateFilePath, 'utf-8');
    const parsed = JSON.parse(raw) as CanvasTab[];
    for (const tab of parsed) {
      tabs.set(tab.id, tab);
    }
  } catch {
    // missing file is fine — start empty
  }
}
