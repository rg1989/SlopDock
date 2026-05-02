import { useState, useEffect, useRef } from 'react';
import type { Terminal as XTerminal } from '@xterm/xterm';
import type { SessionStatus } from '../hooks/usePty';
import { usePty } from '../hooks/usePty';
import { Terminal } from './Terminal';

export interface RawTerminalPaneProps {
  sessionId: string;
  cwd: string;
  isActive: boolean;
  onStatus?: (status: SessionStatus) => void;
}

export function RawTerminalPane({ sessionId, cwd, isActive, onStatus }: RawTerminalPaneProps) {
  const [terminal, setTerminal] = useState<XTerminal | null>(null);
  const [visibleKey, setVisibleKey] = useState(0);
  const wasActiveRef = useRef(isActive);

  useEffect(() => {
    if (isActive && !wasActiveRef.current) setVisibleKey(k => k + 1);
    wasActiveRef.current = isActive;
  }, [isActive]);

  const cols = terminal?.cols ?? 80;
  const rows = terminal?.rows ?? 24;

  const { sendResize } = usePty({
    cwd,
    terminal,
    cols,
    rows,
    agentConfig: { command: 'bash', args: [], label: 'shell' },
    sessionId,
    onStatus,
  });

  return (
    <div
      className="raw-terminal-pane"
      style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden' }}
    >
      <Terminal
        onReady={setTerminal}
        sendResize={(c, r) => { if (isActive) sendResize(c, r); }}
        visibleKey={visibleKey}
      />
    </div>
  );
}
