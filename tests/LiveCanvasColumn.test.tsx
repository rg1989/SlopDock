import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock heavy hooks so App renders without real side effects
vi.mock('../client/hooks/useDragResize', () => ({
  useDragResize: () => ({ width: 240, isDragging: false, onMouseDown: vi.fn(), setWidth: vi.fn() }),
}));

vi.mock('../client/hooks/useSessionManager', () => ({
  useSessionManager: () => ({
    sessions: [],
    activeId: null,
    hasPrompted: false,
    history: [],
    spawn: vi.fn(),
    close: vi.fn(),
    setActive: vi.fn(),
    restoreForCwd: vi.fn(),
  }),
}));

vi.mock('../client/hooks/useFileTree', () => ({
  useFileTree: () => ({
    tree: [],
    changedPaths: [],
    gitStatus: null,
    loadChanges: vi.fn(),
    mode: 'all',
    setMode: vi.fn(),
  }),
}));

vi.mock('../client/hooks/useAudioCoordinator', () => ({
  useAudioCoordinator: () => ({
    tts: { stop: vi.fn(), handleData: vi.fn(), speaking: false },
    voice: { listening: false, start: vi.fn(), stop: vi.fn() },
  }),
}));

vi.mock('../client/hooks/useSettings', async () => {
  const actual = await vi.importActual<typeof import('../client/hooks/useSettings')>('../client/hooks/useSettings');
  return {
    ...actual,
    useSettings: () => ({
      settings: {
        recordingMode: 'toggle',
        pttKey: null,
        sidebarTabsOrientation: 'horizontal',
        showHiddenFiles: true,
        agent: { command: 'claude', args: [], label: 'Claude' },
        typeIndicatorSize: 14,
      },
      update: vi.fn(),
    }),
  };
});

vi.mock('../client/hooks/useProjectHealth', () => ({
  useProjectHealth: () => [],
}));

// Mock child components that depend on browser APIs not available in jsdom
vi.mock('../client/components/SessionPane', () => ({
  SessionPane: () => null,
}));

vi.mock('../client/components/FolderPicker', () => ({
  FolderPicker: ({ onConnect }: { onConnect: (p: string) => void }) => (
    <button data-testid="folder-picker-connect" onClick={() => onConnect('/test/project')}>
      Connect
    </button>
  ),
}));

vi.mock('../client/components/LiveCanvasPanel', () => ({
  LiveCanvasPanel: () => <div data-testid="live-canvas-panel" />,
}));

vi.mock('../client/components/VoiceBar', () => ({
  VoiceBar: () => null,
}));

vi.mock('../client/components/HealthStatusBar', () => ({
  HealthStatusBar: () => null,
}));

vi.mock('../client/components/OnboardingModal', () => ({
  OnboardingModal: () => null,
}));

vi.mock('../client/components/SettingsModal', () => ({
  SettingsModal: () => null,
}));

vi.mock('../client/components/SuperToolsModal', () => ({
  SuperToolsModal: () => null,
}));

vi.mock('../client/components/RulesModal', () => ({
  RulesModal: () => null,
}));

vi.mock('../client/components/SessionHistoryModal', () => ({
  SessionHistoryModal: () => null,
}));

vi.mock('../client/components/SessionTabBar', () => ({
  SessionTabBar: () => null,
}));

vi.mock('../client/components/GsdRoadmap', () => ({
  GsdRoadmap: () => null,
}));

vi.mock('../client/components/BrainPanel', () => ({
  BrainPanel: () => null,
}));

vi.mock('../client/components/FileTree', () => ({
  FileTree: () => null,
}));

vi.mock('../client/components/SourceControl', () => ({
  SourceControl: () => null,
}));

vi.mock('../client/components/FilePreview', () => ({
  FilePreview: () => null,
}));

vi.mock('../client/components/BrainEntryView', () => ({
  BrainEntryView: () => null,
}));

vi.mock('../client/components/EditorTabBar', () => ({
  EditorTabBar: () => null,
}));

import App from '../client/App';

function setupFetchMock() {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/api/dir-exists')) {
      return Promise.resolve({ json: async () => ({ exists: true }) });
    }
    if (url.includes('/api/slop-status')) {
      return Promise.resolve({ json: async () => ({ exists: true, config: null }) });
    }
    return Promise.resolve({ json: async () => ({}) });
  }));
}

describe('CANVAS-01: canvas column renders when visible', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
    // Default: canvas visible (no override = true by default)
  });

  it('canvas-column element is present in DOM when isCanvasVisible is true (default)', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const appBody = container.querySelector('.app-body');
      expect(appBody).not.toBeNull();
    });

    // CANVAS-01: .canvas-column should exist when canvas is visible by default
    // Fails RED because canvas-column does not exist yet
    const canvasColumn = container.querySelector('.canvas-column');
    expect(canvasColumn).not.toBeNull();
  });
});

describe('CANVAS-02: canvas column hidden when not visible', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
    // Set canvas to hidden via localStorage
    localStorage.setItem('slopmop_ui:canvas_visible', JSON.stringify(false));
  });

  it('canvas-column element is NOT in DOM when slopmop_ui:canvas_visible is false', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const appBody = container.querySelector('.app-body');
      expect(appBody).not.toBeNull();
    });

    // CANVAS-02: .canvas-column should NOT exist when canvas visibility is false
    // This test may pass accidentally (canvas-column doesn't exist yet) — acceptable for Wave 0
    const canvasColumn = container.querySelector('.canvas-column');
    expect(canvasColumn).toBeNull();
  });
});

describe('CANVAS-03: canvas toggle button flips visibility', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
    // Canvas starts visible
  });

  it('clicking canvas-toggle-btn hides canvas-column and persists to localStorage', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const appBody = container.querySelector('.app-body');
      expect(appBody).not.toBeNull();
    });

    // CANVAS-03: canvas-toggle-btn should exist and clicking it should hide the canvas column
    // Fails RED because canvas-toggle-btn does not exist yet
    const toggleBtn =
      container.querySelector('[data-testid="canvas-toggle-btn"]') ??
      container.querySelector('.canvas-toggle-btn') ??
      container.querySelector('[title*="canvas"]') ??
      container.querySelector('[title*="Canvas"]');

    expect(toggleBtn).not.toBeNull();

    // Canvas should be visible before click
    expect(container.querySelector('.canvas-column')).not.toBeNull();

    fireEvent.click(toggleBtn!);

    // After click: canvas-column should be gone
    expect(container.querySelector('.canvas-column')).toBeNull();

    // Persisted to localStorage
    expect(localStorage.getItem('slopmop_ui:canvas_visible')).toBe(JSON.stringify(false));
  });
});
