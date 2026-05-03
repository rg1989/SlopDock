import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(),
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(),
}));

import { Terminal as XTermMock } from '@xterm/xterm';
import { FitAddon as FitAddonMock } from '@xterm/addon-fit';
import { TerminalInput } from '../client/components/TerminalInput';

let capturedOnData: ((data: string) => void) | null = null;
let capturedKeyHandler: ((e: KeyboardEvent) => boolean) | null = null;
const mockDisposable = { dispose: vi.fn() };
const mockTerminal = {
  onData: vi.fn((cb: (data: string) => void) => {
    capturedOnData = cb;
    return mockDisposable;
  }),
  attachCustomKeyEventHandler: vi.fn((h: (e: KeyboardEvent) => boolean) => {
    capturedKeyHandler = h;
  }),
  open: vi.fn(),
  focus: vi.fn(),
  dispose: vi.fn(),
  loadAddon: vi.fn(),
  cols: 80,
  rows: 4,
};
const mockFitAddon = { fit: vi.fn() };

describe('TerminalInput', () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capturedOnData = null;
    capturedKeyHandler = null;
    mockSend = vi.fn();
    mockTerminal.onData.mockClear();
    mockTerminal.attachCustomKeyEventHandler.mockClear();
    mockTerminal.attachCustomKeyEventHandler.mockImplementation((h: (e: KeyboardEvent) => boolean) => {
      capturedKeyHandler = h;
    });
    mockTerminal.open.mockClear();
    mockTerminal.focus.mockClear();
    mockTerminal.dispose.mockClear();
    mockTerminal.loadAddon.mockClear();
    mockDisposable.dispose.mockClear();
    mockFitAddon.fit.mockClear();
    vi.mocked(XTermMock).mockImplementation(() => mockTerminal as any);
    vi.mocked(FitAddonMock).mockImplementation(() => mockFitAddon as any);
  });

  it('wires terminal.onData to sendInput on mount', async () => {
    render(<TerminalInput sendInput={mockSend} connected={true} />);
    await waitFor(() => {
      expect(mockTerminal.onData).toHaveBeenCalledTimes(1);
    });
  });

  it('sendInput receives the exact byte string from onData (Enter = \\r)', async () => {
    render(<TerminalInput sendInput={mockSend} connected={true} />);
    await waitFor(() => {
      expect(capturedOnData).not.toBeNull();
    });
    capturedOnData!('\r');
    expect(mockSend).toHaveBeenCalledWith('\r');
  });

  it('forwards arrow-key ANSI sequences to sendInput', async () => {
    render(<TerminalInput sendInput={mockSend} connected={true} />);
    await waitFor(() => {
      expect(capturedOnData).not.toBeNull();
    });
    capturedOnData!('\x1b[A');
    expect(mockSend).toHaveBeenCalledWith('\x1b[A');
    capturedOnData!('\x1b[B');
    expect(mockSend).toHaveBeenCalledWith('\x1b[B');
  });

  it('forwards Ctrl+C, Ctrl+D, Tab control sequences to sendInput', async () => {
    render(<TerminalInput sendInput={mockSend} connected={true} />);
    await waitFor(() => {
      expect(capturedOnData).not.toBeNull();
    });
    capturedOnData!('\x03');
    expect(mockSend).toHaveBeenCalledWith('\x03');
    capturedOnData!('\x04');
    expect(mockSend).toHaveBeenCalledWith('\x04');
    capturedOnData!('\x09');
    expect(mockSend).toHaveBeenCalledWith('\x09');
  });

  it('container renders with .terminal-input-strip class', () => {
    const { container } = render(<TerminalInput sendInput={mockSend} connected={true} />);
    const el = container.querySelector('.terminal-input-strip');
    expect(el).not.toBeNull();
  });

  it('SLASH-01: onSlashOpen is called when "/" is typed at empty input', async () => {
    const onSlashOpen = vi.fn();
    render(<TerminalInput sendInput={mockSend} connected={true} onSlashOpen={onSlashOpen} />);
    await waitFor(() => {
      expect(capturedKeyHandler).not.toBeNull();
    });
    capturedKeyHandler!({ type: 'keydown', key: '/' } as KeyboardEvent);
    expect(onSlashOpen).toHaveBeenCalledTimes(1);
  });

  it('SLASH-01: onSlashClose is called when Escape is pressed while slash menu is open', async () => {
    const onSlashOpen = vi.fn();
    const onSlashClose = vi.fn();
    render(<TerminalInput sendInput={mockSend} connected={true} onSlashOpen={onSlashOpen} onSlashClose={onSlashClose} />);
    await waitFor(() => {
      expect(capturedKeyHandler).not.toBeNull();
    });
    capturedKeyHandler!({ type: 'keydown', key: '/' } as KeyboardEvent);
    capturedKeyHandler!({ type: 'keydown', key: 'Escape' } as KeyboardEvent);
    expect(onSlashClose).toHaveBeenCalledTimes(1);
  });

  it('SLASH-02: handler returns false for ArrowUp when slash menu is open (suppresses xterm)', async () => {
    render(<TerminalInput sendInput={mockSend} connected={true} onSlashOpen={vi.fn()} />);
    await waitFor(() => {
      expect(capturedKeyHandler).not.toBeNull();
    });
    capturedKeyHandler!({ type: 'keydown', key: '/' } as KeyboardEvent);
    const result = capturedKeyHandler!({ type: 'keydown', key: 'ArrowUp' } as KeyboardEvent);
    expect(result).toBe(false);
  });

  it('SLASH-01: handler returns true for "/" (allows through to xterm for display)', async () => {
    render(<TerminalInput sendInput={mockSend} connected={true} onSlashOpen={vi.fn()} />);
    await waitFor(() => {
      expect(capturedKeyHandler).not.toBeNull();
    });
    const result = capturedKeyHandler!({ type: 'keydown', key: '/' } as KeyboardEvent);
    expect(result).toBe(true);
  });
});
