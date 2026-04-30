import { useRef, useState, useEffect, useCallback } from 'react';
import type { FilePreviewData } from './FilePreview';

export interface EditorTab {
  id: string;         // unique id (file path used as id)
  path: string;       // absolute file path
  isPreview: boolean; // true = italic/dimmed, false = permanent
  data: FilePreviewData | null;
}

interface EditorTabBarProps {
  tabs: EditorTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onPromote: (id: string) => void; // double-click tab title → promote to permanent + edit mode
}

export function EditorTabBar({ tabs, activeId, onSelect, onClose, onPromote }: EditorTabBarProps) {
  const tabListRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = tabListRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = tabListRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    updateScrollState();
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  // Re-check scroll state when tabs change
  useEffect(() => {
    updateScrollState();
  }, [tabs, updateScrollState]);

  if (tabs.length === 0) return null;

  function scrollLeft() {
    tabListRef.current?.scrollBy({ left: -120, behavior: 'smooth' });
  }

  function scrollRight() {
    tabListRef.current?.scrollBy({ left: 120, behavior: 'smooth' });
  }

  return (
    <div className="editor-tab-bar">
      <button
        className="tab-scroll-btn left"
        onClick={scrollLeft}
        disabled={!canScrollLeft}
        aria-label="Scroll tabs left"
      >
        ‹
      </button>
      <div className="tab-list" ref={tabListRef}>
        {tabs.map((tab) => {
          const filename = tab.path.split('/').pop() ?? tab.path;
          const isActive = tab.id === activeId;
          const tabClass = [
            'editor-tab',
            isActive ? 'active' : '',
            tab.isPreview ? 'preview' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={tab.id}
              className={tabClass}
              onClick={() => onSelect(tab.id)}
              onDoubleClick={() => onPromote(tab.id)}
            >
              <span className="tab-title">{filename}</span>
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                aria-label={`Close ${filename}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button
        className="tab-scroll-btn right"
        onClick={scrollRight}
        disabled={!canScrollRight}
        aria-label="Scroll tabs right"
      >
        ›
      </button>
    </div>
  );
}
