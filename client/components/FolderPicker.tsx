import { useState, useEffect, useRef } from 'react';

interface FolderPickerProps {
  cwd: string | null;
  onConnect: (path: string) => void;
  onSettingsOpen?: () => void;
  onSuperToolsOpen?: () => void;
}

export function FolderPicker({ cwd, onConnect, onSettingsOpen, onSuperToolsOpen }: FolderPickerProps) {
  const [picking, setPicking] = useState(false);
  const [branch, setBranch] = useState<string | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchOpen, setBranchOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cwd) { setBranch(null); setBranches([]); return; }
    fetch(`/api/git-branch?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(({ branch }: { branch: string | null }) => setBranch(branch))
      .catch(() => setBranch(null));
  }, [cwd]);

  useEffect(() => {
    if (!branchOpen || !cwd) return;
    fetch(`/api/git-branches?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(({ branches }: { branches: string[] }) => setBranches(branches))
      .catch(() => setBranches([]));
  }, [branchOpen, cwd]);

  useEffect(() => {
    if (!branchOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setBranchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [branchOpen]);

  const handleBrowse = async () => {
    setPicking(true);
    try {
      const res = await fetch('/api/pick-folder', { method: 'POST' });
      if (res.ok) {
        const { path: selected } = await res.json() as { path: string };
        onConnect(selected);
      }
    } finally {
      setPicking(false);
    }
  };

  const handleCheckout = async (b: string) => {
    if (!cwd) return;
    setBranchOpen(false);
    const res = await fetch('/api/git-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd, branch: b }),
    });
    const { ok } = await res.json() as { ok: boolean };
    if (ok) setBranch(b);
  };

  const parts = cwd ? cwd.split('/').filter(Boolean) : [];
  const parentPath = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') + '/' : (cwd ? '/' : '');
  const folderName = parts[parts.length - 1] ?? '';

  return (
    <div className="fp-bar">
      <button
        type="button"
        className={`fp-pick-btn${picking ? ' picking' : ''}`}
        onClick={handleBrowse}
        disabled={picking}
        title="Open folder"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      <div className="fp-path-display">
        {cwd ? (
          <>
            <span className="fp-path-parent">{parentPath}</span>
            <span className="fp-path-name">{folderName}</span>
          </>
        ) : (
          <span className="fp-path-placeholder">No folder open — click to choose</span>
        )}
      </div>

      <img src="/logo.png" className="fp-logo" alt="" draggable={false} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />

      {branch && (
        <div className="fp-branch-wrap" ref={dropRef}>
          <button className="fp-branch-btn" onClick={() => setBranchOpen(o => !o)} title="Switch git branch">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="3" x2="6" y2="15"/>
              <circle cx="18" cy="6" r="3"/>
              <circle cx="6" cy="18" r="3"/>
              <path d="M18 9a9 9 0 0 1-9 9"/>
            </svg>
            <span>{branch}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {branchOpen && (
            <div className="fp-branch-dropdown">
              {branches.length === 0 ? (
                <div className="fp-branch-item" style={{ color: '#484f58', cursor: 'default' }}>Loading…</div>
              ) : branches.map(b => (
                <div
                  key={b}
                  className={`fp-branch-item${b === branch ? ' active' : ''}`}
                  onClick={() => handleCheckout(b)}
                >
                  {b}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {cwd && onSuperToolsOpen && (
        <button className="fp-supertools-btn" onClick={onSuperToolsOpen} title="Super Tools">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </button>
      )}

      {onSettingsOpen && (
        <button className="fp-settings-btn" onClick={onSettingsOpen} title="Settings">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      )}
    </div>
  );
}
