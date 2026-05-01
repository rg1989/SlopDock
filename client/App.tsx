import { useState, useCallback, useEffect, useRef, type JSX } from 'react';
import type { Terminal } from '@xterm/xterm';
import { usePty } from './hooks/usePty';
import { useFileTree } from './hooks/useFileTree';
import { useVoiceInput } from './hooks/useVoiceInput';
import { useTts } from './hooks/useTts';
import { useSettings, matchesPttCombo } from './hooks/useSettings';
import { Terminal as TerminalComponent } from './components/Terminal';
import { FolderPicker } from './components/FolderPicker';
import { Composer } from './components/Composer';
import { FileTree } from './components/FileTree';
import { SourceControl } from './components/SourceControl';
import { FilePreview } from './components/FilePreview';
import type { FilePreviewData } from './components/FilePreview';
import { EditorTabBar } from './components/EditorTabBar';
import type { EditorTab } from './components/EditorTabBar';
import { AttachBar } from './components/AttachBar';
import { VoiceBar } from './components/VoiceBar';
import { SettingsModal } from './components/SettingsModal';
import { GsdRoadmap } from './components/GsdRoadmap';
import { SuperToolsModal } from './components/SuperToolsModal';
import type { SuperTool } from './components/SuperToolsModal';
import './App.css';

type SidebarTabId = 'explorer' | 'changes' | 'roadmap' | 'brain';

const IconExplorer = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconChanges = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
    <path d="M6 21V9a9 9 0 0 0 9 9"/>
  </svg>
);
const IconRoadmap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
    <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
  </svg>
);
const IconBrain = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3z"/>
  </svg>
);

const SIDEBAR_TABS: { id: SidebarTabId; label: string; Icon: () => JSX.Element }[] = [
  { id: 'explorer', label: 'Explorer', Icon: IconExplorer },
  { id: 'changes', label: 'Source Control', Icon: IconChanges },
  { id: 'roadmap', label: 'GSD Roadmap', Icon: IconRoadmap },
  { id: 'brain', label: 'Second Brain', Icon: IconBrain },
];

const STORAGE_KEY = 'slopdock_last_folder';
const SIDEBAR_MIN = 140;
const SIDEBAR_DEFAULT = 240;
const PREVIEW_MIN = 180;
const PREVIEW_DEFAULT = 320;
const TERMINAL_MIN = 140;
const RESIZE_HANDLE_WIDTH = 4;

interface PersistedUIState {
  sidebarWidth: number;
  previewWidth: number;
  tabs: Array<{ path: string; isPreview: boolean }>;
  activeTabId: string | null;
}

function loadUIState(cwd: string): PersistedUIState | null {
  try {
    const raw = localStorage.getItem(`slopdock_ui_${cwd}`);
    return raw ? (JSON.parse(raw) as PersistedUIState) : null;
  } catch { return null; }
}

function saveUIState(cwd: string, state: PersistedUIState) {
  try { localStorage.setItem(`slopdock_ui_${cwd}`, JSON.stringify(state)); } catch {}
}

function useDragResize(
  initial: number,
  min: number,
  direction: 'left' | 'right',
  maxRef?: React.RefObject<number>,
) {
  const [width, setWidth] = useState(initial);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = direction === 'left'
        ? ev.clientX - startX.current
        : startX.current - ev.clientX;
      const max = maxRef?.current ?? Infinity;
      setWidth(Math.max(min, Math.min(max, startW.current + delta)));
    };
    const onUp = () => {
      dragging.current = false;
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width, min, direction, maxRef]);

  return { width, setWidth, isDragging, onMouseDown };
}

function getInitialPath(): string | null {
  // URL param takes priority — each tab remembers its own folder across refreshes
  const params = new URLSearchParams(window.location.search);
  const urlPath = params.get('cwd');
  if (urlPath) return urlPath;
  return localStorage.getItem(STORAGE_KEY);
}

function persistPath(cwd: string) {
  localStorage.setItem(STORAGE_KEY, cwd);
  const url = new URL(window.location.href);
  url.searchParams.set('cwd', cwd);
  window.history.replaceState(null, '', url.toString());
}

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

export default function App() {
  const [cwd, setCwd] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [initialPath] = useState(getInitialPath);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [superToolsOpen, setSuperToolsOpen] = useState(false);

  const { settings, update: updateSettings } = useSettings();

  const sidebarMaxRef = useRef<number>(Infinity);
  const previewMaxRef = useRef<number>(Infinity);

  const sidebar = useDragResize(SIDEBAR_DEFAULT, SIDEBAR_MIN, 'left', sidebarMaxRef);
  const preview = useDragResize(PREVIEW_DEFAULT, PREVIEW_MIN, 'right', previewMaxRef);

  // Keep max refs current every render so drag handlers always see the latest values
  const previewVisible = editorTabs.length > 0;
  sidebarMaxRef.current = window.innerWidth - TERMINAL_MIN - (previewVisible ? preview.width + RESIZE_HANDLE_WIDTH : 0) - RESIZE_HANDLE_WIDTH;
  previewMaxRef.current = window.innerWidth - TERMINAL_MIN - sidebar.width - RESIZE_HANDLE_WIDTH - (previewVisible ? RESIZE_HANDLE_WIDTH : 0);

  const cols = terminal?.cols ?? 80;
  const rows = terminal?.rows ?? 24;

  const tts = useTts({ enabled: ttsEnabled });

  const { sendInput, sendResize, connected } = usePty({
    cwd,
    terminal,
    cols,
    rows,
    onData: ttsEnabled ? tts.handleData : undefined,
  });

  const voice = useVoiceInput({
    onTranscript: (text) => {
      // TTS-03: transcript from interrupt becomes a new sent message
      sendInput(text + '\r');
    },
    onStart: () => {
      // TTS-04: stop TTS when mic recording starts
      tts.stop();
    },
  });

  const { tree, changedPaths, gitStatus, loadChanges, mode, setMode } = useFileTree(cwd);
  const [sidebarTab, setSidebarTab] = useState<SidebarTabId>('explorer');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [collapseKey, setCollapseKey] = useState(0);

  useEffect(() => {
    setMode(sidebarTab === 'changes' ? 'changes' : 'all');
  }, [sidebarTab, setMode]);

  const handleConnect = useCallback((path: string) => {
    const normalized = path.replace(/\/+$/, '');
    persistPath(normalized);
    setCwd(normalized);
  }, []);

  const handleReady = useCallback((t: Terminal) => {
    setTerminal(t);
  }, []);

  // Auto-connect when terminal is ready if we have a saved path
  useEffect(() => {
    if (terminal && initialPath && !cwd) {
      handleConnect(initialPath);
    }
  }, [terminal, initialPath, cwd, handleConnect]);

  // Focus Composer when session connects
  useEffect(() => {
    if (connected) composerRef.current?.focus();
  }, [connected]);

  // Push-to-talk keyboard shortcut
  useEffect(() => {
    if (!settings.pttKey) return;
    const combo = settings.pttKey;
    const onDown = (e: KeyboardEvent) => {
      if (!matchesPttCombo(e, combo)) return;
      if (e.repeat) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (settings.recordingMode === 'hold') {
        voice.start();
      } else {
        if (voice.recording) voice.stop(); else voice.start();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== combo.code) return;
      if (settings.recordingMode === 'hold') voice.stop();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [settings.pttKey, settings.recordingMode, voice]);

  useEffect(() => {
    if (!cwd) return;
    setAttachments([]);
    setSidebarSearch('');

    const saved = loadUIState(cwd);
    if (saved) {
      sidebar.setWidth(saved.sidebarWidth);
      preview.setWidth(saved.previewWidth);
      const skeletonTabs: EditorTab[] = saved.tabs.map(t => ({
        id: t.path, path: t.path, isPreview: t.isPreview, data: null,
      }));
      setEditorTabs(skeletonTabs);
      setActiveTabId(saved.activeTabId);
      setEditingTabId(null);
      (async () => {
        for (const tab of saved.tabs) {
          const data = await fetchFileContent(cwd, tab.path);
          setEditorTabs(prev => prev.map(t => t.id === tab.path ? { ...t, data } : t));
        }
      })();
    } else {
      setEditorTabs([]);
      setActiveTabId(null);
      setEditingTabId(null);
    }
  }, [cwd]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cwd) return;
    const timer = setTimeout(() => {
      saveUIState(cwd, {
        sidebarWidth: sidebar.width,
        previewWidth: preview.width,
        tabs: editorTabs.map(t => ({ path: t.path, isPreview: t.isPreview })),
        activeTabId,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [cwd, sidebar.width, preview.width, editorTabs, activeTabId]);

  const openFile = useCallback(async (path: string, isPreview: boolean) => {
    if (!cwd) return;

    if (isPreview) {
      let alreadyOpen = false;
      setEditorTabs((prev) => {
        // File already open in any tab → just activate it, never duplicate
        if (prev.some((t) => t.path === path)) {
          alreadyOpen = true;
          return prev;
        }
        // Replace an existing preview tab or add a new one
        const existingPreviewIdx = prev.findIndex((t) => t.isPreview);
        if (existingPreviewIdx !== -1) {
          const updated = [...prev];
          updated[existingPreviewIdx] = { id: path, path, isPreview: true, data: null };
          return updated;
        }
        return [...prev, { id: path, path, isPreview: true, data: null }];
      });
      setActiveTabId(path);
      if (alreadyOpen) return; // data already loaded, nothing to fetch
      const data = await fetchFileContent(cwd, path);
      setEditorTabs((prev) =>
        prev.map((t) => (t.id === path ? { ...t, data } : t))
      );
    } else {
      let needsFetch = false;
      setEditorTabs((prev) => {
        const existing = prev.find((t) => t.path === path);
        if (existing) {
          // Already open — promote if preview, keep as-is if permanent
          if (!existing.isPreview) return prev;
          return prev.map((t) =>
            t.path === path ? { ...t, isPreview: false } : t
          );
        }
        needsFetch = true;
        return [...prev, { id: path, path, isPreview: false, data: null }];
      });
      setActiveTabId(path);
      if (!needsFetch) return; // data already loaded
      const data = await fetchFileContent(cwd, path);
      setEditorTabs((prev) =>
        prev.map((t) => (t.id === path ? { ...t, data } : t))
      );
    }
  }, [cwd]);

  const openDiff = useCallback(async (filePath: string, staged: boolean) => {
    if (!cwd) return;
    const tabId = `diff:${staged ? 'staged' : 'unstaged'}:${filePath}`;
    // If already open, just focus it
    const alreadyOpen = editorTabs.some(t => t.id === tabId);
    if (alreadyOpen) { setActiveTabId(tabId); return; }

    const newTab: EditorTab = { id: tabId, path: filePath, isPreview: false, tabType: 'diff', staged, data: null };
    setEditorTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);

    const relPath = filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
    const res = await fetch(`/api/git-diff?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(filePath)}&staged=${staged}`);
    const { diff } = await res.json() as { diff: string };
    const data: FilePreviewData = { type: 'diff', content: diff ?? '' };
    setEditorTabs(prev => prev.map(t => t.id === tabId ? { ...t, data } : t));
    void relPath;
  }, [cwd, editorTabs]);

  const closeTab = useCallback((id: string) => {
    setEditorTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.id !== id);
      // Update active tab: prefer right neighbor, then left, then null
      setActiveTabId((currentActive) => {
        if (currentActive !== id) return currentActive;
        if (next.length === 0) return null;
        const newIdx = Math.min(idx, next.length - 1);
        return next[newIdx].id;
      });
      return next;
    });
    setEditingTabId((prev) => (prev === id ? null : prev));
  }, []);

  const promoteTab = useCallback((id: string) => {
    setEditorTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isPreview: false } : t))
    );
    setEditingTabId(id);
  }, []);

  // Derive the active tab's path for FileTree highlighting
  const activeTab = editorTabs.find((t) => t.id === activeTabId);
  const activeFilePath = activeTab?.path ?? null;

  return (
    <div className="app">
      <div className="folder-bar">
        <FolderPicker
          cwd={cwd}
          onConnect={handleConnect}
          onSettingsOpen={() => setSettingsOpen(true)}
          onSuperToolsOpen={() => setSuperToolsOpen(true)}
        />
      </div>
      {superToolsOpen && (
        <SuperToolsModal
          cwd={cwd}
          onClose={() => setSuperToolsOpen(false)}
          onRunDirect={(command) => {
            sendInput('\x15' + command + '\r');
            setSuperToolsOpen(false);
          }}
          onRunWithGsd={async (tool: SuperTool) => {
            await fetch('/api/gsd-track-phase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cwd,
                name: tool.phaseName,
                description: tool.phaseDescription,
              }),
            });
            sendInput('\x15' + tool.directCommand + '\r');
            setSuperToolsOpen(false);
          }}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      <div className="app-body">
        {cwd && (
          <>
            <div
              className={`sidebar${settings.sidebarTabsOrientation === 'vertical' ? ' sidebar--vertical' : ''}`}
              style={{ width: sidebar.width }}
            >
              <div className={`sidebar-tabs-bar sidebar-tabs-bar--${settings.sidebarTabsOrientation === 'vertical' ? 'v' : 'h'}`}>
                {SIDEBAR_TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    className={`stab${sidebarTab === id ? ' stab--active' : ''}`}
                    title={label}
                    onClick={() => setSidebarTab(id)}
                  >
                    <Icon />
                  </button>
                ))}
              </div>
              <div className="sidebar-content-area">
                {(sidebarTab === 'explorer') && (
                  <div className="sidebar-search-bar">
                    <input
                      className="sidebar-search-input"
                      type="text"
                      placeholder="Search files…"
                      value={sidebarSearch}
                      onChange={(e) => setSidebarSearch(e.target.value)}
                    />
                    <button
                      className="sidebar-collapse-btn"
                      title="Collapse all"
                      onClick={() => setCollapseKey((k) => k + 1)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                        <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
                      </svg>
                    </button>
                  </div>
                )}
                {sidebarTab === 'explorer' ? (
                  <FileTree
                    nodes={tree}
                    selected={new Set(attachments)}
                    onPreview={(p) => openFile(p, true)}
                    onOpen={(p) => openFile(p, false)}
                    onAttach={(p) => setAttachments(prev => prev.includes(p) ? prev : [...prev, p])}
                    changedPaths={changedPaths}
                    mode={mode}
                    activePath={activeFilePath ?? undefined}
                    collapseKey={collapseKey}
                    searchQuery={sidebarSearch}
                    showHiddenFiles={settings.showHiddenFiles}
                    cwd={cwd ?? undefined}
                    onRefresh={loadChanges}
                  />
                ) : sidebarTab === 'changes' ? (
                  <SourceControl
                    cwd={cwd}
                    gitStatus={gitStatus}
                    onRefresh={loadChanges}
                    onOpenDiff={openDiff}
                  />
                ) : sidebarTab === 'roadmap' ? (
                  <GsdRoadmap cwd={cwd} onOpenFile={openFile} />
                ) : (
                  <div className="sidebar-empty-panel">Second Brain — coming soon</div>
                )}
              </div>
            </div>
            <div
              className={`resize-handle${sidebar.isDragging ? ' dragging' : ''}`}
              onMouseDown={sidebar.onMouseDown}
            />
          </>
        )}
        <div className="main-area">
          <div
            className="terminal-area"
            onClick={() => composerRef.current?.focus()}
          >
            <TerminalComponent onReady={handleReady} sendResize={sendResize} />
          </div>
          <AttachBar
            attachments={attachments}
            onRemove={(p) => setAttachments(prev => prev.filter(x => x !== p))}
          />
          <div className="composer-area">
            <VoiceBar
              recording={voice.recording}
              transcribing={voice.transcribing}
              speaking={tts.speaking}
              ttsEnabled={ttsEnabled}
              micError={voice.micError}
              onMicStart={voice.start}
              onMicStop={voice.stop}
              onTtsToggle={() => setTtsEnabled(e => !e)}
              onTtsStop={tts.stop}
              supported={voice.supported}
              ttsAvailable={tts.piperAvailable}
              whisperAvailable={voice.whisperAvailable}
            />
            <Composer
              ref={composerRef}
              onSend={sendInput}
              disabled={!connected}
              attachments={attachments}
              clearAttachments={() => setAttachments([])}
              onAttach={(paths) => setAttachments(prev => [...prev, ...paths.filter(p => !prev.includes(p))])}
              cwd={cwd}
            />
          </div>
        </div>
        {editorTabs.length > 0 && (
          <>
            <div
              className={`resize-handle${preview.isDragging ? ' dragging' : ''}`}
              onMouseDown={preview.onMouseDown}
            />
            <div className="preview-panel" style={{ width: preview.width }}>
              <EditorTabBar
                tabs={editorTabs}
                activeId={activeTabId}
                onSelect={setActiveTabId}
                onClose={closeTab}
                onPromote={promoteTab}
              />
              {(() => {
                const tab = editorTabs.find((t) => t.id === activeTabId);
                if (!tab) return null;
                return (
                  <FilePreview
                    data={tab.data}
                    filePath={tab.path}
                    cwd={cwd}
                    initialEditing={activeTabId === editingTabId}
                    onPromote={() => promoteTab(activeTabId!)}
                  />
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
