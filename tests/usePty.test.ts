import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Terminal } from '@xterm/xterm';
import { DEFAULT_AGENT } from '../client/hooks/useSettings';

// Mock @xterm/xterm
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(),
}));

// --- MockWebSocket implementation ---
interface MockWsInstance {
  url: string;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  // helpers to simulate server events
  simulateOpen: () => void;
  simulateMessage: (data: object) => void;
}

let wsInstances: MockWsInstance[] = [];

const MockWebSocket = vi.fn().mockImplementation((url: string) => {
  const instance: MockWsInstance = {
    url,
    readyState: 0, // CONNECTING
    send: vi.fn(),
    close: vi.fn(() => {
      instance.readyState = 3; // CLOSED
    }),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    simulateOpen() {
      instance.readyState = 1; // OPEN
      instance.onopen?.(new Event('open'));
    },
    simulateMessage(data: object) {
      instance.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
    },
  };
  wsInstances.push(instance);
  return instance;
});

// Stub WebSocket.OPEN constant (cast to any to attach static constants)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockWebSocketAny = MockWebSocket as any;
MockWebSocketAny.OPEN = 1;
MockWebSocketAny.CONNECTING = 0;
MockWebSocketAny.CLOSING = 2;
MockWebSocketAny.CLOSED = 3;

vi.stubGlobal('WebSocket', MockWebSocket);

import { usePty } from '../client/hooks/usePty';

describe('usePty', () => {
  let mockTerminal: Terminal;

  beforeEach(() => {
    wsInstances = [];
    MockWebSocket.mockClear();

    mockTerminal = {
      write: vi.fn(),
      reset: vi.fn(),
      cols: 80,
      rows: 24,
    } as unknown as Terminal;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens a WebSocket derived from window.location when cwd and terminal are provided', () => {
    renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT })
    );

    expect(MockWebSocket).toHaveBeenCalledTimes(1);
    // deriveWsUrl uses window.location.host (includes port if non-standard)
    const calledUrl: string = (MockWebSocket.mock.calls[0] as [string])[0];
    expect(calledUrl).toMatch(/^ws:\/\/localhost(:\d+)?\/ws$/);
  });

  it('uses wsUrl override when provided', () => {
    renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT, wsUrl: 'ws://custom:9000/ws' })
    );

    expect(MockWebSocket).toHaveBeenCalledWith('ws://custom:9000/ws');
  });

  it('sends {type:start} with cwd, cols, rows, agentCommand, agentArgs on WebSocket open (TERM-01)', () => {
    renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT })
    );

    const ws = wsInstances[0];
    act(() => ws.simulateOpen());

    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ws.send.mock.calls[0][0])).toMatchObject({
      type: 'start',
      cwd: '/tmp',
      cols: 80,
      rows: 24,
      agentCommand: 'claude',
      agentArgs: [],
    });
  });

  it('propagates custom agentCommand and agentArgs in start message', () => {
    renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: { command: 'aider', args: ['--model', 'gpt-4'], label: 'Aider' } })
    );

    const ws = wsInstances[0];
    act(() => ws.simulateOpen());

    const msg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(msg.agentCommand).toBe('aider');
    expect(msg.agentArgs).toEqual(['--model', 'gpt-4']);
  });

  it('calls terminal.write(data) when server sends {type:data, data} (TERM-02)', () => {
    renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT })
    );

    const ws = wsInstances[0];
    act(() => ws.simulateOpen());
    act(() => ws.simulateMessage({ type: 'data', data: 'hello world' }));

    expect(mockTerminal.write).toHaveBeenCalledWith('hello world');
  });

  it('sendInput sends {type:input, data} over WebSocket', () => {
    const { result } = renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT })
    );

    const ws = wsInstances[0];
    act(() => ws.simulateOpen());
    act(() => result.current.sendInput('ls\n'));

    // First send is 'start', second is the input
    expect(ws.send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(ws.send.mock.calls[1][0])).toEqual({
      type: 'input',
      data: 'ls\n',
    });
  });

  it('sendResize sends {type:resize, cols, rows} over WebSocket', () => {
    const { result } = renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT })
    );

    const ws = wsInstances[0];
    act(() => ws.simulateOpen());
    act(() => result.current.sendResize(120, 40));

    expect(ws.send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(ws.send.mock.calls[1][0])).toEqual({
      type: 'resize',
      cols: 120,
      rows: 40,
    });
  });

  it('closes WebSocket on unmount', () => {
    const { unmount } = renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT })
    );

    const ws = wsInstances[0];
    unmount();

    expect(ws.close).toHaveBeenCalledTimes(1);
  });

  it('does not open WebSocket when cwd is null', () => {
    renderHook(() =>
      usePty({ cwd: null, terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT })
    );

    expect(MockWebSocket).not.toHaveBeenCalled();
  });

  it('does not open WebSocket when terminal is null', () => {
    renderHook(() =>
      usePty({ cwd: '/tmp', terminal: null, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT })
    );

    expect(MockWebSocket).not.toHaveBeenCalled();
  });

  it('does not call terminal.write for non-data messages', () => {
    renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT })
    );

    const ws = wsInstances[0];
    act(() => ws.simulateOpen());
    act(() => ws.simulateMessage({ type: 'exit', code: 0 }));

    expect(mockTerminal.write).not.toHaveBeenCalled();
  });
});

describe('sessionId in protocol', () => {
  let mockTerminal: import('@xterm/xterm').Terminal;

  beforeEach(() => {
    wsInstances = [];
    MockWebSocket.mockClear();

    mockTerminal = {
      write: vi.fn(),
      reset: vi.fn(),
      cols: 80,
      rows: 24,
    } as unknown as import('@xterm/xterm').Terminal;
  });

  it('includes sessionId in start message (SESS-06)', () => {
    renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT })
    );

    const ws = wsInstances[0];
    act(() => ws.simulateOpen());

    expect(ws.send).toHaveBeenCalledTimes(1);
    const startMsg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(startMsg.type).toBe('start');
    // sessionId must be a non-empty string (UUID)
    expect(typeof startMsg.sessionId).toBe('string');
    expect(startMsg.sessionId).toBeTruthy();
  });
});

describe('PTY session reconnect', () => {
  let mockTerminal: import('@xterm/xterm').Terminal;

  beforeEach(() => {
    wsInstances = [];
    MockWebSocket.mockClear();

    mockTerminal = {
      write: vi.fn(),
      reset: vi.fn(),
      cols: 80,
      rows: 24,
    } as unknown as import('@xterm/xterm').Terminal;
  });

  it('uses provided sessionId prop in start message (PTY-01)', () => {
    renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT, sessionId: 'fixed-uuid-1234' })
    );

    const ws = wsInstances[0];
    act(() => ws.simulateOpen());

    expect(ws.send).toHaveBeenCalledTimes(1);
    const startMsg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(startMsg.sessionId).toBe('fixed-uuid-1234');
  });

  it('reopens WebSocket with new sessionId when sessionId prop changes (PTY-01)', () => {
    const { rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) =>
        usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT, sessionId }),
      { initialProps: { sessionId: 'uuid-a' } }
    );

    const ws1 = wsInstances[0];
    act(() => ws1.simulateOpen());

    const firstStartMsg = JSON.parse(ws1.send.mock.calls[0][0]);
    expect(firstStartMsg.sessionId).toBe('uuid-a');

    rerender({ sessionId: 'uuid-b' });

    expect(MockWebSocket).toHaveBeenCalledTimes(2);

    const ws2 = wsInstances[1];
    act(() => ws2.simulateOpen());

    const secondStartMsg = JSON.parse(ws2.send.mock.calls[0][0]);
    expect(secondStartMsg.sessionId).toBe('uuid-b');
  });

  it('transitions status from reconnecting to waiting on session-ready (PTY-01 reconnect path)', () => {
    const onStatus = vi.fn();

    renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT, sessionId: 'some-id', onStatus })
    );

    act(() => onStatus('reconnecting'));

    const ws = wsInstances[0];
    act(() => ws.simulateOpen());
    act(() => ws.simulateMessage({ type: 'session-ready', sessionId: 'some-id' }));

    const calls = onStatus.mock.calls.map((c: [string]) => c[0]);
    expect(calls).toContain('waiting');
  });

  it('shows done status when reconnecting to an already-exited session (PTY-05)', () => {
    const onStatus = vi.fn();

    renderHook(() =>
      usePty({ cwd: '/tmp', terminal: mockTerminal, cols: 80, rows: 24, agentConfig: DEFAULT_AGENT, sessionId: 'exited-id', onStatus })
    );

    const ws = wsInstances[0];
    act(() => ws.simulateOpen());

    act(() => onStatus('reconnecting'));

    act(() => ws.simulateMessage({ type: 'exit', code: 0 }));

    const calls = onStatus.mock.calls.map((c: [string]) => c[0]);
    expect(calls).toContain('done');
  });
});
