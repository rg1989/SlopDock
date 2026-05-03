import { useEffect, useRef } from 'react';
import type { ContextMenuItem } from '../hooks/useContextMenu';

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const menuHeight = items.length * 30 + 8;
  const adjX = Math.min(x, window.innerWidth - 170);
  const adjY = Math.min(y, window.innerHeight - menuHeight);

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: adjX, top: adjY }}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.dividerAbove && i > 0 && <div className="ctx-menu-divider" />}
          <button
            className={`ctx-menu-item${item.variant === 'danger' ? ' ctx-menu-item--danger' : ''}`}
            onClick={() => { item.action(); onClose(); }}
          >
            {item.icon && <span className="ctx-menu-icon">{item.icon}</span>}
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
