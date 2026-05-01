import { useRef, useState, useEffect, useCallback } from 'react';
import type { FilePreviewData } from './FilePreview';

export interface EditorTab {
  id: string;
  path: string;
  isPreview: boolean;
  tabType?: 'file' | 'diff';  // diff tabs are read-only and show "(Diffs)" suffix
  staged?: boolean;            // for diff tabs: whether showing staged diff
  data: FilePreviewData | null;
}

interface EditorTabBarProps {
  tabs: EditorTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onPromote: (id: string) => void;
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

  useEffect(() => { updateScrollState(); }, [tabs, updateScrollState]);

  if (tabs.length === 0) return null;

  function scrollLeft() { tabListRef.current?.scrollBy({ left: -120, behavior: 'smooth' }); }
  function scrollRight() { tabListRef.current?.scrollBy({ left: 120, behavior: 'smooth' }); }

  return (
    <div className="editor-tab-bar">
      <button className="tab-scroll-btn left" onClick={scrollLeft} disabled={!canScrollLeft} aria-label="Scroll tabs left">‹</button>
      <div className="tab-list" ref={tabListRef}>
        {tabs.map((tab) => {
          const filename = tab.path.split('/').pop() ?? tab.path;
          const isDiff = tab.tabType === 'diff';
          const title = isDiff ? `${filename} (Diffs)` : filename;
          const isActive = tab.id === activeId;
          const tabClass = [
            'editor-tab',
            isActive ? 'active' : '',
            tab.isPreview ? 'preview' : '',
            isDiff ? 'diff-tab' : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={tab.id}
              className={tabClass}
              onClick={() => onSelect(tab.id)}
              onDoubleClick={() => !isDiff && onPromote(tab.id)}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onClose(tab.id); } }}
            >
              {isDiff && (
                <svg className="tab-diff-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                </svg>
              )}
              <span className="tab-title">{title}</span>
              <button
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                aria-label={`Close ${title}`}
              >×</button>
            </div>
          );
        })}
      </div>
      <button className="tab-scroll-btn right" onClick={scrollRight} disabled={!canScrollRight} aria-label="Scroll tabs right">›</button>
    </div>
  );
}
