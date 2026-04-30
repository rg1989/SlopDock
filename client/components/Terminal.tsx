import { useEffect, useRef } from 'react';
import type { Terminal as XTerminal } from '@xterm/xterm';
import type { FitAddon as XFitAddon } from '@xterm/addon-fit';
import { useResize } from '../hooks/useResize';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onReady: (terminal: XTerminal) => void;
  sendResize: (cols: number, rows: number) => void;
}

export function Terminal({ onReady, sendResize }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<XFitAddon | null>(null);

  useEffect(() => {
    let cancelled = false;
    let terminal: XTerminal | undefined;

    async function init() {
      const { Terminal: XTerm } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      // StrictMode runs cleanup before the second effect fires — bail if that happened
      if (cancelled) return;

      terminal = new XTerm({
        scrollback: 5000,
        theme: { background: '#0d1117' },
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // WebGL renderer with DOM fallback
      try {
        const { WebglAddon } = await import('@xterm/addon-webgl');
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon.dispose();
        });
        terminal.loadAddon(webglAddon);
      } catch {
        // WebGL not available — DOM renderer fallback
      }

      if (containerRef.current) {
        terminal.open(containerRef.current);
        fitAddon.fit();
      }

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      onReady(terminal);
    }

    init();

    return () => {
      cancelled = true;
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      terminal?.dispose();
    };
  }, [onReady]);

  useResize(containerRef, terminalRef.current, fitAddonRef.current, sendResize);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
