import { useState, type FC } from 'react';

export interface CanvasTab {
  id: string;
  title: string;
  html: string;
  locked: boolean;
  lockReason?: string;
}

interface MultiTabCanvasPanelProps {
  tabs: CanvasTab[];
  activeId: string | null;
  onClose: (id: string) => void;
  onActivate: (id: string) => void;
}

export const MultiTabCanvasPanel: FC<MultiTabCanvasPanelProps> = ({ tabs, activeId, onClose, onActivate }) => {
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);

  const pendingTab = pendingCloseId ? tabs.find(t => t.id === pendingCloseId) : null;
  const activeTab = activeId ? tabs.find(t => t.id === activeId) : null;

  const handleCloseClick = (e: React.MouseEvent, tab: CanvasTab) => {
    e.stopPropagation();
    if (tab.locked) {
      setPendingCloseId(tab.id);
    } else {
      onClose(tab.id);
    }
  };

  const truncateTitle = (title: string) =>
    title.length > 20 ? title.slice(0, 19) + '…' : title;

  if (tabs.length === 0) {
    return (
      <div className="canvas-empty-state">
        <span style={{ color: 'var(--txt-dim)', fontSize: 12 }}>No canvas yet</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div className="canvas-tab-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            role="tab"
            className={`bpanel-tab${tab.id === activeId ? ' bpanel-tab--active' : ''}`}
            onClick={() => onActivate(tab.id)}
          >
            <span className="bpanel-tab-label">{truncateTitle(tab.title)}</span>
            <button
              className={`bpanel-tab-close${tab.locked ? ' bpanel-tab-close--locked' : ''}`}
              onClick={(e) => handleCloseClick(e, tab)}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="canvas-tab-content">
        {activeTab && (
          <iframe
            key={activeTab.id}
            srcDoc={activeTab.html}
            sandbox="allow-scripts allow-forms"
            title={activeTab.title}
          />
        )}
      </div>
      {pendingCloseId && (
        <div className="modal-overlay" onClick={() => setPendingCloseId(null)}>
          <div className="modal-panel confirm-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Canvas locked</div>
            <div className="modal-message">
              {pendingTab?.lockReason
                ? `This canvas is locked: ${pendingTab.lockReason}. Close anyway?`
                : 'This canvas is locked: This canvas is tracking an active task. Close anyway?'}
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn modal-btn--cancel"
                onClick={() => setPendingCloseId(null)}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-btn--danger"
                onClick={() => {
                  onClose(pendingCloseId);
                  setPendingCloseId(null);
                }}
              >
                Force Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
