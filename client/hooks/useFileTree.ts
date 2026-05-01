import { useState, useEffect, useCallback, useRef } from 'react';
import type { FileNode } from '../components/FileTree';

const POLL_INTERVAL = 3000;

export interface GitFileEntry {
  path: string;
  status: string;
  origPath?: string;
}

export interface GitStatus {
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  changedPaths: Set<string>;
}

export function useFileTree(cwd: string | null) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [changedPaths, setChangedPaths] = useState<Set<string>>(new Set());
  const [gitStatus, setGitStatus] = useState<GitStatus>({ staged: [], unstaged: [], changedPaths: new Set() });
  const [mode, setMode] = useState<'all' | 'changes'>('all');
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const loadTree = useCallback(() => {
    if (!cwd) { setTree([]); return; }
    fetch(`/api/files?cwd=${encodeURIComponent(cwd)}`)
      .then((res) => res.json())
      .then((data: { tree: FileNode[] }) => setTree(data.tree))
      .catch(() => {});
  }, [cwd]);

  const loadChanges = useCallback(() => {
    if (!cwd) return;
    fetch(`/api/git-status?cwd=${encodeURIComponent(cwd)}`)
      .then((res) => res.json())
      .then((data: { staged: GitFileEntry[]; unstaged: GitFileEntry[]; changedPaths: string[] }) => {
        const pathSet = new Set(data.changedPaths ?? []);
        setChangedPaths(pathSet);
        setGitStatus({ staged: data.staged ?? [], unstaged: data.unstaged ?? [], changedPaths: pathSet });
      })
      .catch(() => {
        setChangedPaths(new Set());
        setGitStatus({ staged: [], unstaged: [], changedPaths: new Set() });
      });
  }, [cwd]);

  useEffect(() => {
    if (!cwd) { setTree([]); setChangedPaths(new Set()); setGitStatus({ staged: [], unstaged: [], changedPaths: new Set() }); return; }
    loadTree();
    const id = setInterval(() => {
      loadTree();
      if (modeRef.current === 'changes') loadChanges();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [cwd, loadTree, loadChanges]);

  useEffect(() => {
    if (mode === 'changes') loadChanges();
  }, [mode, loadChanges]);

  return { tree, changedPaths, gitStatus, loadChanges, mode, setMode };
}
