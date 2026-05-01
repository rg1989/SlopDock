import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileTree } from '../client/components/FileTree';
import type { FileNode } from '../client/components/FileTree';

// Minimal test fixture: one directory containing two files
const testTree: FileNode[] = [
  {
    name: 'src',
    path: '/test/project/src',
    type: 'dir',
    children: [
      { name: 'index.ts', path: '/test/project/src/index.ts', type: 'file' },
      { name: 'App.tsx', path: '/test/project/src/App.tsx', type: 'file' },
    ],
  },
];

describe('FileTree', () => {
  it('renders file tree — shows directory name and file names', () => {
    render(
      <FileTree
        nodes={testTree}
        selected={new Set<string>()}
        onPreview={vi.fn()}
        changedPaths={new Set<string>()}
      />
    );

    expect(screen.getByText('src')).toBeTruthy();
    expect(screen.getByText('index.ts')).toBeTruthy();
    expect(screen.getByText('App.tsx')).toBeTruthy();
  });

  it('toggle dir — clicking directory header collapses children; clicking again expands', () => {
    render(
      <FileTree
        nodes={testTree}
        selected={new Set<string>()}
        onPreview={vi.fn()}
        changedPaths={new Set<string>()}
      />
    );

    // Children are visible initially
    expect(screen.getByText('index.ts')).toBeTruthy();

    // Click the folder name span (which has onClick to toggle open state)
    const dirHeader = screen.getByText('src');
    fireEvent.click(dirHeader);

    // Children should no longer be visible
    expect(screen.queryByText('index.ts')).toBeNull();
    expect(screen.queryByText('App.tsx')).toBeNull();

    // Click again to expand
    fireEvent.click(dirHeader);

    expect(screen.getByText('index.ts')).toBeTruthy();
    expect(screen.getByText('App.tsx')).toBeTruthy();
  });

  it('changedPaths highlights changed file — element has ft-changed class', () => {
    render(
      <FileTree
        nodes={testTree}
        selected={new Set<string>()}
        onPreview={vi.fn()}
        changedPaths={new Set(['/test/project/src/index.ts'])}
      />
    );

    // ft-changed class is on the <li> element; closest('li') traverses to it
    const fileEl = screen.getByText('index.ts').closest('li');
    expect(fileEl?.className).toContain('ft-changed');
  });

  it('open file — double-clicking a file calls onOpen with absolute path', () => {
    const onOpen = vi.fn();
    render(
      <FileTree
        nodes={testTree}
        selected={new Set<string>()}
        onOpen={onOpen}
        onPreview={vi.fn()}
        changedPaths={new Set<string>()}
      />
    );

    const fileEl = screen.getByText('index.ts');
    // The component uses a click counter: 1st click = onPreview, 2nd click = onOpen
    // Fire two separate click events to simulate double-click behavior
    fireEvent.click(fileEl);
    fireEvent.click(fileEl);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith('/test/project/src/index.ts');
  });

  it('preview click — single-clicking a file calls onPreview with absolute path', () => {
    const onPreview = vi.fn();
    render(
      <FileTree
        nodes={testTree}
        selected={new Set<string>()}
        onPreview={onPreview}
        changedPaths={new Set<string>()}
      />
    );

    const fileEl = screen.getByText('App.tsx');
    fireEvent.click(fileEl);

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith('/test/project/src/App.tsx');
  });
});
