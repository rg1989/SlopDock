import { useState, useRef, useCallback, useEffect } from 'react';
import type { GitFileEntry, GitStatus } from '../hooks/useFileTree';
import { FileIcon } from './FileTree';
import { useContextMenu } from '../hooks/useContextMenu';

interface SourceControlProps {
  cwd: string;
  gitStatus: GitStatus;
  onRefresh: () => void;
  onOpenDiff: (filePath: string, staged: boolean) => void;
  onAttach?: (path: string) => void;
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

interface SectionFileRowProps {
  file: GitFileEntry;
  section: 'staged' | 'unstaged';
  isSelected: boolean;
  cwd: string;
  onFileClick: (file: GitFileEntry, section: 'staged' | 'unstaged', e: React.MouseEvent) => void;
  onAttach?: (path: string) => void;
  onSingleStage?: (path: string) => void;
  onSingleUnstage?: (path: string) => void;
  onSingleDiscard?: (path: string) => void;
  clickCountRef: React.MutableRefObject<Record<string, { count: number; timer: ReturnType<typeof setTimeout> | null }>>;
}

const CtxIconStage = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const CtxIconUnstage = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6"/>
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
  </svg>
);

const CtxIconDiscard = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

function SectionFileRow({
  file, section, isSelected, cwd,
  onFileClick, onAttach,
  onSingleStage, onSingleUnstage, onSingleDiscard,
  clickCountRef,
}: SectionFileRowProps) {
  const name = file.path.split('/').pop() ?? file.path;

  const ctxItems = section === 'staged'
    ? [{ label: 'Unstage', icon: <CtxIconUnstage />, action: () => onSingleUnstage?.(file.path) }]
    : [
        { label: 'Stage', icon: <CtxIconStage />, action: () => onSingleStage?.(file.path) },
        { label: 'Discard', icon: <CtxIconDiscard />, variant: 'danger' as const, dividerAbove: true, action: () => onSingleDiscard?.(file.path) },
      ];

  const ctxProps = useContextMenu(`sc:${section}:${file.path}`, ctxItems);

  return (
    <li
      className={`sc-file${isSelected ? ' sc-file--selected' : ''}`}
      title={`${file.path} — triple-click to add as context`}
      onClick={e => {
        const c = clickCountRef.current[file.path] ?? { count: 0, timer: null };
        c.count++;
        if (c.timer) clearTimeout(c.timer);
        if (c.count >= 3) {
          c.count = 0;
          onAttach?.(`${cwd}/${file.path}`);
        } else {
          onFileClick(file, section, e);
          c.timer = setTimeout(() => { c.count = 0; }, 400);
        }
        clickCountRef.current[file.path] = c;
      }}
      {...ctxProps}
    >
      <FileIcon name={name} />
      <span className="sc-filename">{name}</span>
      <span className={`sc-status sc-status--${file.status.toLowerCase()}`} title={statusTitle(file.status)}>
        {statusLabel(file.status)}
      </span>
    </li>
  );
}

interface SectionProps {
  title: string;
  count: number;
  files: GitFileEntry[];
  selected: Set<string>;
  section: 'staged' | 'unstaged';
  cwd: string;
  onFileClick: (file: GitFileEntry, section: 'staged' | 'unstaged', e: React.MouseEvent) => void;
  onAttach?: (path: string) => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  onStageSelected?: () => void;
  onUnstageSelected?: () => void;
  onDiscardSelected?: () => void;
  onSingleStage?: (path: string) => void;
  onSingleUnstage?: (path: string) => void;
  onSingleDiscard?: (path: string) => void;
  actionLoading: boolean;
}

function Section({
  title, count, files, selected, section, cwd,
  onFileClick, onAttach, onStageAll, onUnstageAll,
  onStageSelected, onUnstageSelected, onDiscardSelected,
  onSingleStage, onSingleUnstage, onSingleDiscard,
  actionLoading,
}: SectionProps) {
  const [collapsed, setCollapsed] = useState(section === 'staged');
  const hasSelection = selected.size > 0;
  const clickCountRef = useRef<Record<string, { count: number; timer: ReturnType<typeof setTimeout> | null }>>({});

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
            {files.map(file => (
              <SectionFileRow
                key={file.path}
                file={file}
                section={section}
                isSelected={selected.has(file.path)}
                cwd={cwd}
                onFileClick={onFileClick}
                onAttach={onAttach}
                onSingleStage={onSingleStage}
                onSingleUnstage={onSingleUnstage}
                onSingleDiscard={onSingleDiscard}
                clickCountRef={clickCountRef}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function SourceControl({ cwd, gitStatus, onRefresh, onOpenDiff, onAttach }: SourceControlProps) {
  const [selectedStaged, setSelectedStaged] = useState<Set<string>>(new Set());
  const [selectedUnstaged, setSelectedUnstaged] = useState<Set<string>>(new Set());
  const [commitMsg, setCommitMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [commitError, setCommitError] = useState('');
  const [discardModal, setDiscardModal] = useState<{ paths: string[] } | null>(null);
  const lastClickedStaged = useRef<string | null>(null);
  const lastClickedUnstaged = useRef<string | null>(null);

  // New state for commit loading, unpushed commits, and push
  const [commitLoading, setCommitLoading] = useState(false);
  const [unpushedCommits, setUnpushedCommits] = useState<Array<{hash: string; message: string}>>([]);
  const [unpushedLoaded, setUnpushedLoaded] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState('');
  const [unpushedKey, setUnpushedKey] = useState(0);

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

  const singleStage = useCallback((path: string) => runAction(async () => {
    await fetch('/api/git-stage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, paths: [path] }) });
  }), [cwd]);

  const singleUnstage = useCallback((path: string) => runAction(async () => {
    await fetch('/api/git-unstage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, paths: [path] }) });
  }), [cwd]);

  const singleDiscard = useCallback((path: string) => {
    const isUntracked = gitStatus.unstaged.find(f => f.path === path)?.status === '?';
    if (isUntracked) setDiscardModal({ paths: [path] });
    else performDiscard([path]);
  }, [gitStatus.unstaged]);

  const handleCommit = async () => {
    if (!commitMsg.trim() || !gitStatus.staged.length) return;
    setCommitLoading(true);
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
      setCommitLoading(false);
    }
  };

  const handleStageAllAndCommit = async () => {
    if (!commitMsg.trim() || !gitStatus.unstaged.length) return;
    setCommitLoading(true);
    setCommitError('');
    const paths = gitStatus.unstaged.map(f => f.path);
    let staged = false;
    try {
      const stageRes = await fetch('/api/git-stage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, paths }) });
      const stageData = await stageRes.json() as { ok: boolean; error?: string };
      if (!stageData.ok) { setCommitError(stageData.error ?? 'Stage failed'); return; }
      staged = true;
      const commitRes = await fetch('/api/git-commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, message: commitMsg }) });
      const commitData = await commitRes.json() as { ok: boolean; error?: string };
      if (commitData.ok) {
        setCommitMsg('');
      } else {
        // Revert: unstage the files we just staged
        await fetch('/api/git-unstage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, paths }) }).catch(() => {});
        staged = false;
        setCommitError(commitData.error ?? 'Commit failed');
      }
    } catch (err) {
      if (staged) {
        await fetch('/api/git-unstage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, paths }) }).catch(() => {});
      }
      setCommitError(String(err));
    } finally {
      setCommitLoading(false);
      onRefresh();
    }
  };

  const handlePush = async () => {
    setPushLoading(true);
    setPushError('');
    try {
      const res = await fetch('/api/git-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd }) });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        setUnpushedKey(k => k + 1);
      } else {
        setPushError(data.error ?? 'Push failed');
      }
    } finally {
      setPushLoading(false);
    }
  };

  const isEmpty = gitStatus.staged.length === 0 && gitStatus.unstaged.length === 0;

  useEffect(() => {
    if (!isEmpty) {
      setUnpushedLoaded(false);
      setUnpushedCommits([]);
      setPushError('');
      return;
    }
    setUnpushedLoaded(false);
    fetch(`/api/git-unpushed?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then((data: { commits: Array<{hash: string; message: string}>; error?: string }) => {
        setUnpushedCommits(data.commits ?? []);
        setUnpushedLoaded(true);
      })
      .catch(() => {
        setUnpushedCommits([]);
        setUnpushedLoaded(true);
      });
  }, [isEmpty, cwd, unpushedKey]);

  if (isEmpty) {
    return (
      <div className="sc-panel">
        {!unpushedLoaded ? (
          <div className="sc-upush-loading">
            <div className="sc-spinner--lg" />
          </div>
        ) : unpushedCommits.length === 0 ? (
          <p className="ft-empty">All up to date</p>
        ) : (
          <div className="sc-unpushed">
            <div className="sc-upush-header">
              <span className="sc-upush-title">Outgoing</span>
              <span className="sc-section-count">{unpushedCommits.length}</span>
            </div>
            {pushError && <div className="sc-commit-error" style={{ margin: '0 8px 4px' }}>{pushError}</div>}
            <ul className="sc-file-list sc-upush-list">
              {unpushedCommits.map(c => (
                <li key={c.hash} className="sc-upush-commit">
                  <span className="sc-upush-hash">{c.hash}</span>
                  <span className="sc-upush-msg">{c.message}</span>
                </li>
              ))}
            </ul>
            <div className="sc-commit-area">
              <button
                className="sc-btn sc-btn--commit sc-btn--push"
                disabled={pushLoading}
                onClick={handlePush}
              >
                {pushLoading ? (
                  <><div className="sc-spinner" />Pushing…</>
                ) : (
                  `↑ Push ${unpushedCommits.length} commit${unpushedCommits.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
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
          placeholder="Commit message…"
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleCommit();
            }
          }}
          rows={3}
          disabled={gitStatus.staged.length === 0 && gitStatus.unstaged.length === 0}
        />
        {commitError && <div className="sc-commit-error">{commitError}</div>}
        <div className="sc-commit-buttons">
          {/* Stage All — always visible when there are unstaged changes */}
          {gitStatus.unstaged.length > 0 && (
            <button
              className="sc-btn sc-btn--ghost sc-btn--stage-all"
              disabled={actionLoading || commitLoading}
              onClick={stageAll}
              title="Stage all changes"
            >
              Stage All ({gitStatus.unstaged.length})
            </button>
          )}
          {/* Commit — when staged changes exist */}
          {gitStatus.staged.length > 0 && (
            <button
              className="sc-btn sc-btn--commit"
              disabled={!commitMsg.trim() || commitLoading || actionLoading}
              onClick={handleCommit}
            >
              {commitLoading ? (
                <><div className="sc-spinner" />Committing…</>
              ) : (
                `Commit (${gitStatus.staged.length})`
              )}
            </button>
          )}
          {/* Stage & Commit — only when there are unstaged changes but nothing staged yet */}
          {gitStatus.unstaged.length > 0 && gitStatus.staged.length === 0 && (
            <button
              className="sc-btn sc-btn--commit sc-btn--commit-all"
              disabled={!commitMsg.trim() || commitLoading || actionLoading}
              onClick={handleStageAllAndCommit}
              title="Stage all and commit"
            >
              {commitLoading ? <><div className="sc-spinner" />Committing…</> : `Stage & Commit (${gitStatus.unstaged.length})`}
            </button>
          )}
        </div>
      </div>

      <Section
        title="Staged Changes"
        count={gitStatus.staged.length}
        files={gitStatus.staged}
        selected={selectedStaged}
        section="staged"
        cwd={cwd}
        onFileClick={handleFileClick}
        onAttach={onAttach}
        onUnstageAll={unstageAll}
        onUnstageSelected={unstageSelected}
        onSingleUnstage={singleUnstage}
        actionLoading={actionLoading || commitLoading}
      />

      <Section
        title="Changes"
        count={gitStatus.unstaged.length}
        files={gitStatus.unstaged}
        selected={selectedUnstaged}
        section="unstaged"
        cwd={cwd}
        onFileClick={handleFileClick}
        onAttach={onAttach}
        onStageAll={stageAll}
        onStageSelected={stageSelected}
        onDiscardSelected={discardSelected}
        onSingleStage={singleStage}
        onSingleDiscard={singleDiscard}
        actionLoading={actionLoading || commitLoading}
      />
    </div>
  );
}
