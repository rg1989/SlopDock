import { useRef, useState, useEffect, useCallback } from 'react';
import type { SessionEntry, SessionStatus } from '../hooks/useSessionManager';

export interface SessionTabBarProps {
  sessions: SessionEntry[];
  activeId: string | null;
  onSetActive: (id: string) => void;
  onClose: (id: string) => void;
  onSpawn: () => void;
}

const STATUS_CLASS: Record<SessionStatus, string> = {
  connecting: 'status--connecting',
  waiting:    'status--waiting',
  working:    'status--working',
  done:       'status--done',
  error:      'status--error',
};

export function SessionTabBar({ sessions, activeId, onSetActive, onClose, onSpawn }: SessionTabBarProps) {
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

  useEffect(() => { updateScrollState(); }, [sessions, updateScrollState]);

  function scrollLeft() { tabListRef.current?.scrollBy({ left: -120, behavior: 'smooth' }); }
  function scrollRight() { tabListRef.current?.scrollBy({ left: 120, behavior: 'smooth' }); }

  return (
    <div className="session-tab-bar">
      <button className="tab-scroll-btn left" onClick={scrollLeft} disabled={!canScrollLeft} aria-label="Scroll tabs left">‹</button>
      <div className="tab-list" ref={tabListRef}>
        {sessions.map((session) => {
          const isActive = session.id === activeId;
          const tabClass = ['session-tab', isActive ? 'active' : ''].filter(Boolean).join(' ');
          return (
            <div
              key={session.id}
              className={tabClass}
              data-session-id={session.id}
              onClick={() => onSetActive(session.id)}
            >
              <span className={`status-chip ${STATUS_CLASS[session.status]}`} />
              <span className="tab-title">{session.name}</span>
              <button
                className="tab-close"
                data-close
                onClick={(e) => { e.stopPropagation(); onClose(session.id); }}
                aria-label={`Close ${session.name}`}
              >×</button>
            </div>
          );
        })}
      </div>
      <button className="tab-scroll-btn right" onClick={scrollRight} disabled={!canScrollRight} aria-label="Scroll tabs right">›</button>
      <button className="session-spawn-btn" onClick={onSpawn} aria-label="New session">+</button>
    </div>
  );
}
