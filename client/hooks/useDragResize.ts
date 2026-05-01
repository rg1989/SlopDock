import { useState, useRef, useCallback } from 'react';

interface UseDragResizeReturn {
  width: number;
  setWidth: React.Dispatch<React.SetStateAction<number>>;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Drag-to-resize a panel by a handle on its edge.
 *
 * direction: 'left'  — dragging right increases width (sidebar on the left)
 *            'right' — dragging left increases width  (preview on the right)
 *            'up'    — dragging up increases height   (bottom panel growing upward)
 *            'down'  — dragging down increases height (top panel growing downward)
 * maxRef:    mutable ref updated each render with the current max width/height;
 *            the drag handler reads it live so it always respects the latest layout.
 */
export function useDragResize(
  initial: number,
  min: number,
  direction: 'left' | 'right' | 'up' | 'down',
  maxRef?: React.RefObject<number>,
): UseDragResizeReturn {
  const [width, setWidth] = useState(initial);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startW = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startW.current = width;
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      let delta: number;
      if (direction === 'left') delta = ev.clientX - startX.current;
      else if (direction === 'right') delta = startX.current - ev.clientX;
      else if (direction === 'up') delta = startY.current - ev.clientY;
      else delta = ev.clientY - startY.current;
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
