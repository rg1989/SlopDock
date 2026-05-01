import { readdir } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

export interface FileNode {
  name: string;
  path: string; // absolute path
  type: 'file' | 'dir';
  hidden?: boolean; // true for dotfiles/dotdirs (except .git which is excluded entirely)
  children?: FileNode[];
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  '__pycache__',
  'coverage',
]);

export async function buildFileTree(root: string, depth = 0): Promise<FileNode[]> {
  if (depth >= 8) return [];

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs: FileNode[] = [];
  const files: FileNode[] = [];

  for (const entry of entries) {
    const name = entry.name;
    const isHidden = name.startsWith('.');

    const absPath = path.join(root, name);

    if (entry.isDirectory()) {
      // Always skip .git and other heavy dirs
      if (SKIP_DIRS.has(name)) continue;
      const children = await buildFileTree(absPath, depth + 1);
      dirs.push({ name, path: absPath, type: 'dir', hidden: isHidden, children });
    } else if (entry.isFile()) {
      files.push({ name, path: absPath, type: 'file', hidden: isHidden });
    }
  }

  // Sort each group alphabetically
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return [...dirs, ...files];
}

export interface GitFileEntry {
  path: string;   // absolute path
  status: string; // M, A, D, R, C, U, ?
  origPath?: string; // for renames: the old path (absolute)
}

export interface GitStatusResult {
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  changedPaths: string[]; // flat list of all changed absolute paths for file tree highlighting
}

function stripQuotes(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

export async function getGitStatus(cwd: string): Promise<GitStatusResult> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd });
    const lines = stdout.split('\n').filter((l) => l.length > 0);

    const staged: GitFileEntry[] = [];
    const unstaged: GitFileEntry[] = [];
    const changedPaths: string[] = [];

    for (const line of lines) {
      const xy = line.slice(0, 2);
      const x = xy[0]; // index (staged) status
      const y = xy[1]; // working tree (unstaged) status
      let relPath = line.slice(3);

      // Handle rename: "old -> new"
      let origRelPath: string | undefined;
      if (relPath.includes(' -> ')) {
        const parts = relPath.split(' -> ');
        origRelPath = stripQuotes(parts[0]);
        relPath = parts[1];
      }
      relPath = stripQuotes(relPath);

      const absPath = path.join(cwd, relPath);
      const absOrig = origRelPath ? path.join(cwd, origRelPath) : undefined;

      // Skip ignored files
      if (x === '!' && y === '!') continue;

      // Untracked
      if (x === '?' && y === '?') {
        unstaged.push({ path: absPath, status: '?' });
        changedPaths.push(absPath);
        continue;
      }

      // Staged changes (index status)
      if (x !== ' ' && x !== '?') {
        staged.push({ path: absPath, status: x, origPath: absOrig });
        if (!changedPaths.includes(absPath)) changedPaths.push(absPath);
      }

      // Unstaged changes (working tree status)
      if (y !== ' ' && y !== '?') {
        unstaged.push({ path: absPath, status: y });
        if (!changedPaths.includes(absPath)) changedPaths.push(absPath);
      }
    }

    return { staged, unstaged, changedPaths };
  } catch {
    return { staged: [], unstaged: [], changedPaths: [] };
  }
}

// Kept for backward compatibility — returns flat list of changed absolute paths
export async function getGitChangedPaths(cwd: string): Promise<string[]> {
  const { changedPaths } = await getGitStatus(cwd);
  return changedPaths;
}
