import { useEffect, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

export function useResize(
  containerRef: React.RefObject<HTMLDivElement | null>,
  terminal: Terminal | null,
  fitAddon: FitAddon | null,
  onResize: (cols: number, rows: number) => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !terminal || !fitAddon) return;

    const observer = new ResizeObserver(() => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fitAddon.fit();
        onResize(terminal.cols, terminal.rows);
      }, 150);
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timerRef.current);
    };
  }, [containerRef, terminal, fitAddon, onResize]);
}
