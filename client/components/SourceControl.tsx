import { useState, useRef, useCallback, useEffect } from 'react';
import type { GitFileEntry, GitStatus } from '../hooks/useFileTree';
import { FileIcon } from './FileTree';

interface SourceControlProps {
  cwd: string;
  gitStatus: GitStatus;
  onRefresh: () => void;
  onOpenDiff: (filePath: string, staged: boolean) => void;
}

function statusLabel(s: string): string {
  switch (s) {
    case 'M': return 'M';
    case 'A': return 'A';
    case 'D': return 'D';
    case 'R': return 'R';
    case 'C': return 'C';
    case 'U': return 'U';
    case '?': return '?';
    default: return s;
  }
}

function statusTitle(s: string): string {
  switch (s) {
    case 'M': return 'Modified';
    case 'A': return 'Added';
    case 'D': return 'Deleted';
    case 'R': return 'Renamed';
    case 'C': return 'Copied';
    case 'U': return 'Unmerged';
    case '?': return 'Untracked';
    default: return s;
  }
}

interface DiscardModalProps {
  paths: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

function DiscardModal({ paths, onConfirm, onCancel }: DiscardModalProps) {
  const untrackedNames = paths.map(p => p.split('/').pop() ?? p);
  const MAX_SHOWN = 3;
  const shown = untrackedNames.slice(0, MAX_SHOWN);
  const extra = untrackedNames.length - MAX_SHOWN;

  const nameList = extra > 0
    ? shown.join(', ') + `, …+${extra} more`
    : shown.join(', ');

  return (
    <div className="sc-modal-overlay" onClick={onCancel}>
      <div className="sc-modal" onClick={e => e.stopPropagation()}>
        <div className="sc-modal-title">Discard Changes</div>
        <div className="sc-modal-body">
          {paths.some(() => true) && (
            <p>
              The following untracked {paths.length === 1 ? 'file' : 'files'} will be{' '}
              <strong>permanently deleted</strong> from disk:
            </p>
          )}
          <p className="sc-modal-filenames">{nameList}</p>
          <p>This action cannot be undone.</p>
        </div>
        <div className="sc-modal-actions">
          <button className="sc-btn sc-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="sc-btn sc-btn--danger" onClick={onConfirm}>Discard</button>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  count: number;
  files: GitFileEntry[];
  selected: Set<string>;
  section: 'staged' | 'unstaged';
  onFileClick: (file: GitFileEntry, section: 'staged' | 'unstaged', e: React.MouseEvent) => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  onStageSelected?: () => void;
  onUnstageSelected?: () => void;
  onDiscardSelected?: () => void;
  actionLoading: boolean;
}

function Section({
  title, count, files, selected, section,
  onFileClick, onStageAll, onUnstageAll,
  onStageSelected, onUnstageSelected, onDiscardSelected,
  actionLoading,
}: SectionProps) {
  const [collapsed, setCollapsed] = useState(section === 'staged');
  const hasSelection = selected.size > 0;

  if (files.length === 0) return null;

  return (
    <div className="sc-section">
      <div className="sc-section-header" onClick={() => setCollapsed(c => !c)}>
        <span className="sc-section-caret">{collapsed ? '▸' : '▾'}</span>
        <span className="sc-section-title">{title}</span>
        <span className="sc-section-count">{count}</span>
        <div className="sc-section-actions" onClick={e => e.stopPropagation()}>
          {section === 'staged' ? (
            <button
              className="sc-icon-btn"
              title="Unstage All"
              disabled={actionLoading}
              onClick={onUnstageAll}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </button>
          ) : (
            <button
              className="sc-icon-btn"
              title="Stage All"
              disabled={actionLoading}
              onClick={onStageAll}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {hasSelection && (
            <div className="sc-selection-bar">
              <span className="sc-sel-count">{selected.size} selected</span>
              <div className="sc-sel-actions">
                {section === 'unstaged' && (
                  <>
                    <button className="sc-btn sc-btn--sm sc-btn--primary" disabled={actionLoading} onClick={onStageSelected}>Stage</button>
                    <button className="sc-btn sc-btn--sm sc-btn--danger" disabled={actionLoading} onClick={onDiscardSelected}>Discard</button>
                  </>
                )}
                {section === 'staged' && (
                  <button className="sc-btn sc-btn--sm sc-btn--ghost" disabled={actionLoading} onClick={onUnstageSelected}>Unstage</button>
                )}
              </div>
            </div>
          )}
          <ul className="sc-file-list">
            {files.map(file => {
              const name = file.path.split('/').pop() ?? file.path;
              const isSelected = selected.has(file.path);
              return (
                <li
                  key={file.path}
                  className={`sc-file${isSelected ? ' sc-file--selected' : ''}`}
                  title={file.path}
                  onClick={e => onFileClick(file, section, e)}
                >
                  <FileIcon name={name} />
                  <span className="sc-filename">{name}</span>
                  <span className={`sc-status sc-status--${file.status.toLowerCase()}`} title={statusTitle(file.status)}>
                    {statusLabel(file.status)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export function SourceControl({ cwd, gitStatus, onRefresh, onOpenDiff }: SourceControlProps) {
  const [selectedStaged, setSelectedStaged] = useState<Set<string>>(new Set());
  const [selectedUnstaged, setSelectedUnstaged] = useState<Set<string>>(new Set());
  const [commitMsg, setCommitMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [commitError, setCommitError] = useState('');
  const [discardModal, setDiscardModal] = useState<{ paths: string[] } | null>(null);
  const lastClickedStaged = useRef<string | null>(null);
  const lastClickedUnstaged = useRef<string | null>(null);

  // Clear selection when git status changes (after actions)
  useEffect(() => {
    setSelectedStaged(prev => {
      const valid = new Set(gitStatus.staged.map(f => f.path));
      return new Set([...prev].filter(p => valid.has(p)));
    });
    setSelectedUnstaged(prev => {
      const valid = new Set(gitStatus.unstaged.map(f => f.path));
      return new Set([...prev].filter(p => valid.has(p)));
    });
  }, [gitStatus]);

  const handleFileClick = useCallback((
    file: GitFileEntry,
    section: 'staged' | 'unstaged',
    e: React.MouseEvent,
  ) => {
    const files = section === 'staged' ? gitStatus.staged : gitStatus.unstaged;
    const selected = section === 'staged' ? selectedStaged : selectedUnstaged;
    const setSelected = section === 'staged' ? setSelectedStaged : setSelectedUnstaged;
    const lastClicked = section === 'staged' ? lastClickedStaged : lastClickedUnstaged;

    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selected);
      if (next.has(file.path)) next.delete(file.path);
      else next.add(file.path);
      setSelected(next);
      // Clear other section
      if (section === 'staged') setSelectedUnstaged(new Set());
      else setSelectedStaged(new Set());
    } else if (e.shiftKey) {
      const last = lastClicked.current;
      const lastIdx = last ? files.findIndex(f => f.path === last) : -1;
      const currIdx = files.findIndex(f => f.path === file.path);
      const start = lastIdx === -1 ? currIdx : Math.min(lastIdx, currIdx);
      const end = lastIdx === -1 ? currIdx : Math.max(lastIdx, currIdx);
      setSelected(new Set(files.slice(start, end + 1).map(f => f.path)));
      if (section === 'staged') setSelectedUnstaged(new Set());
      else setSelectedStaged(new Set());
    } else {
      setSelected(new Set([file.path]));
      if (section === 'staged') setSelectedUnstaged(new Set());
      else setSelectedStaged(new Set());
      onOpenDiff(file.path, section === 'staged');
    }
    lastClicked.current = file.path;
  }, [gitStatus, selectedStaged, selectedUnstaged, onOpenDiff]);

  const runAction = useCallback(async (fn: () => Promise<void>) => {
    setActionLoading(true);
    try { await fn(); } finally {
      setActionLoading(false);
      onRefresh();
    }
  }, [onRefresh]);

  const stageAll = () => runAction(async () => {
    const paths = gitStatus.unstaged.map(f => f.path);
    if (!paths.length) return;
    await fetch('/api/git-stage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, paths }) });
  });

  const unstageAll = () => runAction(async () => {
    const paths = gitStatus.staged.map(f => f.path);
    if (!paths.length) return;
    await fetch('/api/git-unstage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, paths }) });
  });

  const stageSelected = () => runAction(async () => {
    const paths = [...selectedUnstaged];
    if (!paths.length) return;
    await fetch('/api/git-stage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, paths }) });
    setSelectedUnstaged(new Set());
  });

  const unstageSelected = () => runAction(async () => {
    const paths = [...selectedStaged];
    if (!paths.length) return;
    await fetch('/api/git-unstage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, paths }) });
    setSelectedStaged(new Set());
  });

  const discardSelected = () => {
    const paths = [...selectedUnstaged];
    if (!paths.length) return;
    const untrackedSet = new Set(gitStatus.unstaged.filter(f => f.status === '?').map(f => f.path));
    const untrackedInSelection = paths.filter(p => untrackedSet.has(p));

    if (untrackedInSelection.length > 0) {
      setDiscardModal({ paths: untrackedInSelection });
    } else {
      performDiscard(paths);
    }
  };

  const performDiscard = (paths: string[]) => runAction(async () => {
    await fetch('/api/git-discard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, paths }) });
    setSelectedUnstaged(new Set());
  });

  const handleCommit = async () => {
    if (!commitMsg.trim() || !gitStatus.staged.length) return;
    setActionLoading(true);
    setCommitError('');
    try {
      const res = await fetch('/api/git-commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, message: commitMsg }) });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        setCommitMsg('');
        onRefresh();
      } else {
        setCommitError(data.error ?? 'Commit failed');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const isEmpty = gitStatus.staged.length === 0 && gitStatus.unstaged.length === 0;

  if (isEmpty) {
    return <p className="ft-empty">Working tree clean</p>;
  }

  return (
    <div className="sc-panel">
      {discardModal && (
        <DiscardModal
          paths={discardModal.paths}
          onCancel={() => setDiscardModal(null)}
          onConfirm={() => {
            const allPaths = [...selectedUnstaged];
            setDiscardModal(null);
            performDiscard(allPaths);
          }}
        />
      )}

      <div className="sc-commit-area">
        <textarea
          className="sc-commit-input"
          placeholder={gitStatus.staged.length > 0 ? 'Commit message…' : 'Stage changes to commit…'}
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleCommit();
            }
          }}
          rows={3}
          disabled={gitStatus.staged.length === 0}
        />
        {commitError && <div className="sc-commit-error">{commitError}</div>}
        <button
          className="sc-btn sc-btn--commit"
          disabled={!commitMsg.trim() || actionLoading || gitStatus.staged.length === 0}
          onClick={handleCommit}
        >
          {gitStatus.staged.length > 0
            ? `Commit ${gitStatus.staged.length} file${gitStatus.staged.length !== 1 ? 's' : ''}`
            : 'No staged changes'}
        </button>
      </div>

      <Section
        title="Staged Changes"
        count={gitStatus.staged.length}
        files={gitStatus.staged}
        selected={selectedStaged}
        section="staged"
        onFileClick={handleFileClick}
        onUnstageAll={unstageAll}
        onUnstageSelected={unstageSelected}
        actionLoading={actionLoading}
      />

      <Section
        title="Changes"
        count={gitStatus.unstaged.length}
        files={gitStatus.unstaged}
        selected={selectedUnstaged}
        section="unstaged"
        onFileClick={handleFileClick}
        onStageAll={stageAll}
        onStageSelected={stageSelected}
        onDiscardSelected={discardSelected}
        actionLoading={actionLoading}
      />
    </div>
  );
}
