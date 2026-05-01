import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { PersistedSession } from '../hooks/useSessionManager';

interface SessionHistoryModalProps {
  cwd: string;
  history: PersistedSession[];
  onOpen: (entry: PersistedSession) => void;
  onClose: () => void;
}

function fmt(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    + ' · '
    + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function SessionHistoryModal({ cwd, history, onOpen, onClose }: SessionHistoryModalProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const cwdEntries = history.filter(e => e.cwd === cwd);
    if (!search.trim()) return cwdEntries.slice(0, 10);
    const q = search.toLowerCase();
    return cwdEntries.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.status.includes(q)
    ).slice(0, 10);
  }, [history, cwd, search]);

  const totalForCwd = history.filter(e => e.cwd === cwd).length;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel sh-modal-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">Session History</span>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="sh-search-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#484f58' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="sh-search-input"
            type="text"
            placeholder="Search sessions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button className="sh-clear-btn" onClick={() => setSearch('')} aria-label="Clear search">×</button>
          )}
        </div>

        {/* List */}
        <div className="sh-list">
          {filtered.length === 0 ? (
            <div className="sh-empty">
              {search ? 'No sessions match your search.' : 'No closed sessions for this folder yet.'}
            </div>
          ) : (
            filtered.map(entry => (
              <button
                key={`${entry.id}-${entry.closedAt}`}
                className="sh-item"
                onClick={() => { onOpen(entry); onClose(); }}
              >
                <span className={`status-chip status--${entry.status}`} style={{ flexShrink: 0 }} />
                <div className="sh-item-info">
                  <span className="sh-item-name">{entry.name || 'Unnamed session'}</span>
                  <span className="sh-item-meta">{fmt(entry.closedAt)} · {entry.status}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="sh-footer">
          <span className="sh-footer-info">
            {totalForCwd > 0
              ? `Showing up to 10 of ${totalForCwd} closed session${totalForCwd !== 1 ? 's' : ''} · metadata only, no resources held`
              : 'Metadata only — no server resources held'}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
