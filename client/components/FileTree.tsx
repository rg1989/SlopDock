import { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { useContextMenu } from '../hooks/useContextMenu';

// ---------------------------------------------------------------------------
// File type icons (inline SVG, sized 14×14, verticalAlign middle)
// ---------------------------------------------------------------------------

const FILE_LABELS: Record<string, string> = {
  '.ts': 'ts', '.tsx': 'tsx',
  '.js': 'js', '.mjs': 'js', '.cjs': 'js',
  '.jsx': 'jsx',
  '.py': 'py', '.pyw': 'py',
  '.json': '{}', '.jsonc': '{}',
  '.md': 'md', '.markdown': 'md',
  '.css': 'css',
  '.scss': 'sc', '.sass': 'sc',
  '.html': 'htm', '.htm': 'htm',
  '.rs': 'rs',
  '.go': 'go',
  '.yml': 'yml', '.yaml': 'yml',
  '.sh': 'sh', '.bash': 'sh', '.zsh': 'sh',
  '.sql': 'sql',
  '.toml': 'tml',
  '.xml': 'xml',
  '.c': 'c', '.h': 'c',
  '.cpp': 'c++', '.cc': 'c++', '.hpp': 'c++',
  '.java': 'jv',
  '.env': 'env',
};

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico']);

export function FileIcon({ name }: { name: string }) {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';

  // Image files — small picture-frame SVG (no text needed)
  if (IMAGE_EXTS.has(ext)) {
    return (
      <svg width="14" height="12" viewBox="0 0 14 12" fill="none"
        style={{ flexShrink: 0, marginRight: 5, verticalAlign: 'middle', alignSelf: 'center' }}>
        <rect x="0.75" y="0.75" width="12.5" height="10.5" rx="1.5" stroke="#6e7681" strokeWidth="1"/>
        <circle cx="3.5" cy="4" r="1.2" fill="#6e7681" opacity="0.6"/>
        <polyline points="0.75 8.5 3.5 5.5 6.5 8.5 8.5 6.5 13.25 10.5"
          stroke="#6e7681" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    );
  }

  const label = FILE_LABELS[ext] ?? null;

  // Language badge — browser-rendered text, always legible
  return (
    <span className={`ft-lang-badge${label ? '' : ' ft-lang-badge--generic'}`}>
      {label ?? '·'}
    </span>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginRight: 4, verticalAlign: 'middle' }}>
      {open ? (
        <>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" style={{ fill: 'rgba(var(--accent-rgb), 0.2)', stroke: 'var(--accent)' }} strokeWidth="1.5"/>
          <line x1="2" y1="11" x2="22" y2="11" style={{ stroke: 'var(--accent)' }} strokeWidth="1.5"/>
        </>
      ) : (
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="#8b949e" strokeWidth="1.5" fill="none"/>
      )}
    </svg>
  );
}

// SVG eye-off icon for hidden (dotfile) entries
function EyeOffIcon() {
  return (
    <svg
      className="ft-hidden-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="hidden file"
      style={{ marginRight: 4, verticalAlign: 'middle', flexShrink: 0, opacity: 0.55 }}
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Action icon components
// ---------------------------------------------------------------------------

const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const IconFilePlus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
);

const IconFolderPlus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    <line x1="12" y1="11" x2="12" y2="17"/>
    <line x1="9" y1="14" x2="15" y2="14"/>
  </svg>
);

// ---------------------------------------------------------------------------
// FileTree context (avoids prop drilling into every node)
// ---------------------------------------------------------------------------

interface FTCtx {
  cwd: string | null;
  onRefresh: () => void;
  pendingDelete: { path: string; type: 'file' | 'dir'; name: string } | null;
  setPendingDelete: (v: { path: string; type: 'file' | 'dir'; name: string } | null) => void;
  creating: { parentPath: string; type: 'file' | 'dir' } | null;
  setCreating: (v: { parentPath: string; type: 'file' | 'dir' } | null) => void;
  newName: string;
  setNewName: (v: string) => void;
  renamePath: string | null;
  setRenamePath: (v: string | null) => void;
}

const FileTreeContext = createContext<FTCtx>({
  cwd: null, onRefresh: () => {}, pendingDelete: null, setPendingDelete: () => {},
  creating: null, setCreating: () => {}, newName: '', setNewName: () => {},
  renamePath: null, setRenamePath: () => {},
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the node or any of its descendants is in changedPaths. */
function hasChangedDescendant(node: FileNode, changedPaths: Set<string>): boolean {
  if (node.type === 'file') return changedPaths.has(node.path);
  if (!node.children) return false;
  return node.children.some((child) => hasChangedDescendant(child, changedPaths));
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  hidden?: boolean; // true for dotfiles/dotdirs
  children?: FileNode[];
}

interface FileTreeNodeProps {
  node: FileNode;
  selected: Set<string>;
  onPreview: (path: string) => void;
  onOpen?: (path: string) => void;
  onOpenEdit?: (path: string) => void;
  onAttach?: (path: string) => void;
  changedPaths: Set<string>;
  mode: 'all' | 'changes';
  activePath?: string;
  depth?: number;
  collapseKey?: number;
  searchQuery?: string;
  showHiddenFiles?: boolean;
}

function nodeMatchesSearch(node: FileNode, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  if (node.type === 'file') return node.name.toLowerCase().includes(lower);
  return !!node.children?.some((c) => nodeMatchesSearch(c, q));
}

// ---------------------------------------------------------------------------
// CreatingInput — inline file/folder name input that appears inside a dir
// ---------------------------------------------------------------------------

function CreatingInput({ depth }: { depth: number }) {
  const { creating, newName, setNewName, setCreating, onRefresh } = useContext(FileTreeContext);
  if (!creating) return null;

  const submit = async () => {
    const trimmed = newName.trim();
    if (!trimmed) { setCreating(null); return; }
    const fullPath = creating.parentPath + '/' + trimmed;
    const endpoint = creating.type === 'dir' ? '/api/fs/dir' : '/api/fs/file';
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath }),
      });
      onRefresh();
    } catch { /* ignore */ }
    setCreating(null);
    setNewName('');
  };

  return (
    <li className="ft-creating-input" style={{ paddingLeft: `${16 + depth * 12}px` }}>
      {creating.type === 'dir' ? <FolderIcon open={false} /> : <FileIcon name={newName || 'file'} />}
      <input
        className="ft-name-input"
        autoFocus
        value={newName}
        onChange={e => setNewName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { void submit(); }
          if (e.key === 'Escape') { setCreating(null); setNewName(''); }
        }}
        onBlur={() => { setCreating(null); setNewName(''); }}
      />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Context menu icons (12×12, stroke-based)
// ---------------------------------------------------------------------------

const CtxIconRename = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
  </svg>
);
const CtxIconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);
const CtxIconReveal = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    <circle cx="14" cy="14" r="2.5"/>
    <line x1="16" y1="16" x2="18.5" y2="18.5"/>
  </svg>
);
const CtxIconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

// ---------------------------------------------------------------------------
// RenameInlineInput — inline rename field that replaces the node name
// ---------------------------------------------------------------------------

function RenameInlineInput({ node }: { node: FileNode }) {
  const ctx = useContext(FileTreeContext);
  const [value, setValue] = useState(node.name);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === node.name) { ctx.setRenamePath(null); return; }
    const dir = node.path.split('/').slice(0, -1).join('/');
    const newPath = dir + '/' + trimmed;
    try {
      await fetch('/api/fs/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: node.path, to: newPath }),
      });
      ctx.onRefresh();
    } catch { /* ignore */ }
    ctx.setRenamePath(null);
  };

  return (
    <input
      className="ft-name-input"
      autoFocus
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { void submit(); }
        if (e.key === 'Escape') ctx.setRenamePath(null);
      }}
      onBlur={() => ctx.setRenamePath(null)}
      onClick={e => e.stopPropagation()}
    />
  );
}

// ---------------------------------------------------------------------------
// FileTreeNode
// ---------------------------------------------------------------------------

function FileTreeNode({
  node,
  selected,
  onPreview,
  onOpen,
  onOpenEdit,
  onAttach,
  changedPaths,
  mode,
  activePath,
  depth = 0,
  collapseKey = 0,
  searchQuery = '',
  showHiddenFiles = true,
}: FileTreeNodeProps) {
  const [open, setOpen] = useState(true);
  const clickRef = useRef({ count: 0, timer: null as ReturnType<typeof setTimeout> | null });
  const ctx = useContext(FileTreeContext);

  // Collapse all when collapseKey increments
  useEffect(() => {
    if (collapseKey > 0) setOpen(false);
  }, [collapseKey]);

  // Auto-expand when searching
  useEffect(() => {
    if (searchQuery) setOpen(true);
  }, [searchQuery]);

  const handleClick = useCallback(() => {
    if (node.type !== 'file') return;
    clickRef.current.count++;
    const count = clickRef.current.count;
    if (clickRef.current.timer) clearTimeout(clickRef.current.timer);

    if (count === 1) {
      onPreview(node.path);
    } else if (count === 2) {
      onOpen?.(node.path);
    } else if (count >= 3) {
      onAttach?.(node.path);
      clickRef.current.count = 0;
      return;
    }
    clickRef.current.timer = setTimeout(() => { clickRef.current.count = 0; }, 400);
  }, [node.path, node.type, onPreview, onOpen, onAttach]);

  if (!showHiddenFiles && node.hidden) return null;

  const dirCtxProps = useContextMenu(`ft:${node.path}`, node.type === 'dir' ? [
    { label: 'Rename', icon: <CtxIconRename />, action: () => ctx.setRenamePath(node.path) },
    { label: 'Delete', icon: <CtxIconTrash />, variant: 'danger', dividerAbove: true, action: () => ctx.setPendingDelete({ path: node.path, type: 'dir', name: node.name }) },
  ] : [
    { label: 'Rename', icon: <CtxIconRename />, action: () => ctx.setRenamePath(node.path) },
    { label: 'Edit', icon: <CtxIconEdit />, action: () => onOpenEdit?.(node.path) },
    { label: 'Open Containing Folder', icon: <CtxIconReveal />, action: () => {
      fetch('/api/fs/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: node.path }) });
    }},
    { label: 'Delete', icon: <CtxIconTrash />, variant: 'danger', dividerAbove: true, action: () => ctx.setPendingDelete({ path: node.path, type: 'file', name: node.name }) },
  ]);

  if (node.type === 'dir') {
    if (mode === 'changes' && !hasChangedDescendant(node, changedPaths)) return null;
    if (searchQuery && !nodeMatchesSearch(node, searchQuery)) return null;
    return (
      <li className="ft-dir">
        <div
          className="ft-dir-header"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          {...dirCtxProps}
        >
          <span className="ft-caret" onClick={() => setOpen(prev => !prev)}>{open ? '▾' : '▸'}</span>
          {node.hidden && <EyeOffIcon />}
          <span
            style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}
            onClick={() => setOpen(prev => !prev)}
          >
            <FolderIcon open={open} />
            {ctx.renamePath === node.path
              ? <RenameInlineInput node={node} />
              : <span className="ft-name">{node.name}</span>
            }
          </span>
          {ctx.cwd && (
            <div className="ft-row-actions" onClick={e => e.stopPropagation()}>
              <button
                className="ft-action-btn"
                title="New File"
                onClick={() => { ctx.setCreating({ parentPath: node.path, type: 'file' }); ctx.setNewName(''); setOpen(true); }}
              ><IconFilePlus /></button>
              <button
                className="ft-action-btn"
                title="New Folder"
                onClick={() => { ctx.setCreating({ parentPath: node.path, type: 'dir' }); ctx.setNewName(''); setOpen(true); }}
              ><IconFolderPlus /></button>
              <button
                className="ft-action-btn ft-action-btn--danger"
                title="Delete folder"
                onClick={() => ctx.setPendingDelete({ path: node.path, type: 'dir', name: node.name })}
              ><IconTrash /></button>
            </div>
          )}
        </div>
        {open && (
          <ul className="ft-tree">
            {ctx.creating?.parentPath === node.path && (
              <CreatingInput depth={depth + 1} />
            )}
            {node.children?.map((child) => {
              if (!showHiddenFiles && child.hidden) return null;
              if (mode === 'changes' && child.type === 'file' && !changedPaths.has(child.path)) return null;
              if (searchQuery && !nodeMatchesSearch(child, searchQuery)) return null;
              return (
                <FileTreeNode
                  key={child.path}
                  node={child}
                  selected={selected}
                  onPreview={onPreview}
                  onOpen={onOpen}
                  onOpenEdit={onOpenEdit}
                  onAttach={onAttach}
                  changedPaths={changedPaths}
                  mode={mode}
                  activePath={activePath}
                  depth={depth + 1}
                  collapseKey={collapseKey}
                  searchQuery={searchQuery}
                  showHiddenFiles={showHiddenFiles}
                />
              );
            })}
          </ul>
        )}
      </li>
    );
  }

  // File node
  if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) return null;
  const isSelected = selected.has(node.path);
  const isChanged = changedPaths.has(node.path);
  const isActive = node.path === activePath;
  const classNames = [
    'ft-file',
    isSelected ? 'ft-selected' : '',
    isChanged ? 'ft-changed' : '',
    node.hidden ? 'ft-hidden' : '',
    isActive ? 'ft-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      className={classNames}
      data-path={node.path}
      style={{ paddingLeft: `${16 + depth * 12}px`, display: 'flex', alignItems: 'center' }}
      onClick={handleClick}
      {...dirCtxProps}
    >
      <span style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        {node.hidden && <EyeOffIcon />}
        <FileIcon name={node.name} />
        {ctx.renamePath === node.path
          ? <RenameInlineInput node={node} />
          : <span className="ft-filename">{node.name}</span>
        }
      </span>
      {ctx.cwd && (
        <div className="ft-row-actions" onClick={e => e.stopPropagation()}>
          <button
            className="ft-action-btn ft-action-btn--danger"
            title="Delete file"
            onClick={() => ctx.setPendingDelete({ path: node.path, type: 'file', name: node.name })}
          ><IconTrash /></button>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// FileTree (root)
// ---------------------------------------------------------------------------

interface FileTreeProps {
  nodes: FileNode[];
  selected: Set<string>;
  onPreview: (path: string) => void;
  onOpen?: (path: string) => void;
  onOpenEdit?: (path: string) => void;
  onAttach?: (path: string) => void;
  changedPaths: Set<string>;
  mode?: 'all' | 'changes';
  activePath?: string;
  collapseKey?: number;
  searchQuery?: string;
  showHiddenFiles?: boolean;
  cwd?: string | null;
  onRefresh?: () => void;
}

export function FileTree({
  nodes,
  selected,
  onPreview,
  onOpen,
  onOpenEdit,
  onAttach,
  changedPaths,
  mode = 'all',
  activePath,
  collapseKey = 0,
  searchQuery = '',
  showHiddenFiles = true,
  cwd,
  onRefresh = () => {},
}: FileTreeProps) {
  const rootRef = useRef<HTMLUListElement>(null);
  const [pendingDelete, setPendingDelete] = useState<{ path: string; type: 'file' | 'dir'; name: string } | null>(null);
  const [creating, setCreating] = useState<{ parentPath: string; type: 'file' | 'dir' } | null>(null);
  const [newName, setNewName] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [renamePath, setRenamePath] = useState<string | null>(null);

  useEffect(() => {
    if (!activePath || !rootRef.current) return;
    const el = rootRef.current.querySelector<HTMLElement>(`li[data-path="${CSS.escape(activePath)}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activePath]);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteLoading(true);
    try {
      await fetch('/api/fs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pendingDelete.path }),
      });
      onRefresh();
    } catch { /* ignore */ } finally {
      setDeleteLoading(false);
      setPendingDelete(null);
    }
  };

  const rootName = cwd ? (cwd.split('/').pop() ?? cwd) : 'Project';

  const ctx: FTCtx = {
    cwd: cwd ?? null,
    onRefresh,
    pendingDelete,
    setPendingDelete,
    creating,
    setCreating,
    newName,
    setNewName,
    renamePath,
    setRenamePath,
  };

  if (mode === 'changes' && changedPaths.size === 0) {
    return <p className="ft-empty">Working tree clean</p>;
  }

  return (
    <FileTreeContext.Provider value={ctx}>
      <div className="ft-root-wrap">
        {cwd && (
          <div className="ft-root-header">
            <span className="ft-caret">▾</span>
            <FolderIcon open={true} />
            <span className="ft-name ft-root-name">{rootName}</span>
            <div className="ft-row-actions" onClick={e => e.stopPropagation()}>
              <button
                className="ft-action-btn"
                title="New File"
                onClick={() => { setCreating({ parentPath: cwd, type: 'file' }); setNewName(''); }}
              ><IconFilePlus /></button>
              <button
                className="ft-action-btn"
                title="New Folder"
                onClick={() => { setCreating({ parentPath: cwd, type: 'dir' }); setNewName(''); }}
              ><IconFolderPlus /></button>
            </div>
          </div>
        )}

        <ul className="ft-tree" ref={rootRef}>
          {creating?.parentPath === cwd && (
            <CreatingInput depth={0} />
          )}
          {nodes.map((node) => {
            if (!showHiddenFiles && node.hidden) return null;
            if (mode === 'changes' && node.type === 'file' && !changedPaths.has(node.path)) return null;
            if (searchQuery && !nodeMatchesSearch(node, searchQuery)) return null;
            return (
              <FileTreeNode
                key={node.path}
                node={node}
                selected={selected}
                onPreview={onPreview}
                onOpen={onOpen}
                onOpenEdit={onOpenEdit}
                onAttach={onAttach}
                changedPaths={changedPaths}
                mode={mode}
                activePath={activePath}
                collapseKey={collapseKey}
                searchQuery={searchQuery}
                showHiddenFiles={showHiddenFiles}
              />
            );
          })}
        </ul>

        {pendingDelete && (
          <ConfirmModal
            title={`Delete ${pendingDelete.type === 'dir' ? 'folder' : 'file'}`}
            message={`"${pendingDelete.name}" will be permanently deleted. This cannot be undone.`}
            onConfirm={handleConfirmDelete}
            onCancel={() => setPendingDelete(null)}
            loading={deleteLoading}
          />
        )}
      </div>
    </FileTreeContext.Provider>
  );
}
