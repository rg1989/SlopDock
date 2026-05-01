import { useState, useCallback } from 'react';
import type { EditorTab } from '../components/EditorTabBar';
import type { FilePreviewData } from '../components/FilePreview';

async function fetchFileContent(cwd: string, filePath: string): Promise<FilePreviewData> {
  try {
    const relPath = filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
    const res = await fetch(`/api/file?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(relPath)}`);
    if (!res.ok) return { type: 'not-found' };
    return await res.json();
  } catch {
    return { type: 'not-found' };
  }
}

async function fetchBrainEntry(cwd: string, id: string): Promise<FilePreviewData> {
  try {
    const res = await fetch(`/api/brain/entry?cwd=${encodeURIComponent(cwd)}&id=${encodeURIComponent(id)}`);
    if (!res.ok) return { type: 'not-found' };
    const json = await res.json() as { meta: Record<string, unknown>; body: string };
    return {
      type: 'brain',
      id,
      name: (json.meta.name as string) ?? id,
      description: (json.meta.description as string) ?? '',
      entryType: (json.meta.type as string) ?? 'note',
      tags: (json.meta.tags as string[]) ?? [],
      created: (json.meta.created as string) ?? '',
      body: json.body,
    };
  } catch {
    return { type: 'not-found' };
  }
}

export interface UseEditorTabsReturn {
  tabs: EditorTab[];
  activeTabId: string | null;
  editingTabId: string | null;
  /** Path of the active tab — used by FileTree to highlight the open file */
  activeFilePath: string | null;
  setActiveTabId: (id: string | null) => void;
  openFile: (path: string, isPreview: boolean) => Promise<void>;
  openDiff: (filePath: string, staged: boolean) => Promise<void>;
  openBrainEntry: (id: string, isPreview: boolean) => Promise<void>;
  updateTabData: (id: string, data: FilePreviewData) => void;
  closeTab: (id: string) => void;
  promoteTab: (id: string) => void;
  /** Restore tabs from persisted UI state (called on cwd change) */
  restoreFromSaved: (saved: { tabs: Array<{ path: string; isPreview: boolean }>; activeTabId: string | null }, cwd: string) => void;
  /** Clear all tabs (called on cwd change when no saved state exists) */
  reset: () => void;
}

export function useEditorTabs(cwd: string | null): UseEditorTabsReturn {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);

  const activeFilePath = tabs.find(t => t.id === activeTabId && t.tabType !== 'brain')?.path ?? null;

  const openFile = useCallback(async (path: string, isPreview: boolean) => {
    if (!cwd) return;

    if (isPreview) {
      let alreadyOpen = false;
      setTabs((prev) => {
        if (prev.some((t) => t.path === path)) { alreadyOpen = true; return prev; }
        const existingPreviewIdx = prev.findIndex((t) => t.isPreview);
        if (existingPreviewIdx !== -1) {
          const updated = [...prev];
          updated[existingPreviewIdx] = { id: path, path, isPreview: true, data: null };
          return updated;
        }
        return [...prev, { id: path, path, isPreview: true, data: null }];
      });
      setActiveTabId(path);
      if (alreadyOpen) return;
      const data = await fetchFileContent(cwd, path);
      setTabs((prev) => prev.map((t) => (t.id === path ? { ...t, data } : t)));
    } else {
      let needsFetch = false;
      setTabs((prev) => {
        const existing = prev.find((t) => t.path === path);
        if (existing) {
          if (!existing.isPreview) return prev;
          return prev.map((t) => t.path === path ? { ...t, isPreview: false } : t);
        }
        needsFetch = true;
        return [...prev, { id: path, path, isPreview: false, data: null }];
      });
      setActiveTabId(path);
      if (!needsFetch) return;
      const data = await fetchFileContent(cwd, path);
      setTabs((prev) => prev.map((t) => (t.id === path ? { ...t, data } : t)));
    }
  }, [cwd]);

  const openDiff = useCallback(async (filePath: string, staged: boolean) => {
    if (!cwd) return;
    const tabId = `diff:${staged ? 'staged' : 'unstaged'}:${filePath}`;
    setTabs(prev => {
      if (prev.some(t => t.id === tabId)) return prev;
      return [...prev, { id: tabId, path: filePath, isPreview: false, tabType: 'diff', staged, data: null }];
    });
    setActiveTabId(tabId);

    setTabs(prev => {
      const existing = prev.find(t => t.id === tabId);
      if (existing?.data) return prev;
      return prev;
    });

    const relPath = filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
    const res = await fetch(`/api/git-diff?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(filePath)}&staged=${staged}`);
    const { diff } = await res.json() as { diff: string };
    const data: FilePreviewData = { type: 'diff', content: diff ?? '' };
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, data } : t));
    void relPath;
  }, [cwd]);

  const openBrainEntry = useCallback(async (id: string, isPreview: boolean) => {
    if (!cwd) return;
    const tabId = `brain:${id}`;

    if (isPreview) {
      setTabs(prev => {
        if (prev.some(t => t.id === tabId)) return prev;
        const existingPreviewIdx = prev.findIndex(t => t.isPreview);
        if (existingPreviewIdx !== -1) {
          const updated = [...prev];
          updated[existingPreviewIdx] = { id: tabId, path: id, isPreview: true, tabType: 'brain', data: null };
          return updated;
        }
        return [...prev, { id: tabId, path: id, isPreview: true, tabType: 'brain', data: null }];
      });
    } else {
      setTabs(prev => {
        if (prev.some(t => t.id === tabId)) return prev;
        return [...prev, { id: tabId, path: id, isPreview: false, tabType: 'brain', data: null }];
      });
    }
    setActiveTabId(tabId);

    const data = await fetchBrainEntry(cwd, id);
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, data } : t));
  }, [cwd]);

  const updateTabData = useCallback((id: string, data: FilePreviewData) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, data } : t));
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((currentActive) => {
        if (currentActive !== id) return currentActive;
        if (next.length === 0) return null;
        return next[Math.min(idx, next.length - 1)].id;
      });
      return next;
    });
    setEditingTabId((prev) => (prev === id ? null : prev));
  }, []);

  const promoteTab = useCallback((id: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, isPreview: false } : t)));
    setEditingTabId(id);
  }, []);

  const restoreFromSaved = useCallback((
    saved: { tabs: Array<{ path: string; isPreview: boolean }>; activeTabId: string | null },
    cwdForFetch: string,
  ) => {
    // Exclude brain tabs from restore — they're accessed via the brain panel
    const fileTabs = saved.tabs.filter(t => !t.path.startsWith('brain:'));
    const skeletonTabs: EditorTab[] = fileTabs.map(t => ({
      id: t.path, path: t.path, isPreview: t.isPreview, data: null,
    }));
    setTabs(skeletonTabs);
    const restoredActive = saved.activeTabId && !saved.activeTabId.startsWith('brain:')
      ? saved.activeTabId
      : (skeletonTabs[0]?.id ?? null);
    setActiveTabId(restoredActive);
    setEditingTabId(null);
    (async () => {
      for (const tab of fileTabs) {
        const data = await fetchFileContent(cwdForFetch, tab.path);
        setTabs(prev => prev.map(t => t.id === tab.path ? { ...t, data } : t));
      }
    })();
  }, []);

  const reset = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
    setEditingTabId(null);
  }, []);

  return {
    tabs,
    activeTabId,
    editingTabId,
    activeFilePath,
    setActiveTabId,
    openFile,
    openDiff,
    openBrainEntry,
    updateTabData,
    closeTab,
    promoteTab,
    restoreFromSaved,
    reset,
  };
}
