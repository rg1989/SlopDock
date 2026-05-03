import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttachBar } from '../client/components/AttachBar';

describe('AttachBar', () => {
  it('renders basename of each attachment', () => {
    const paths = ['/home/user/project/file.ts', '/tmp/notes.md'];
    render(<AttachBar attachments={paths} onRemove={vi.fn()} />);
    expect(screen.getByText('file.ts')).toBeTruthy();
    expect(screen.getByText('notes.md')).toBeTruthy();
  });

  it('X button calls onRemove with full path', () => {
    const onRemove = vi.fn();
    render(<AttachBar attachments={['/path/to/file.ts']} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /remove file.ts/i }));
    expect(onRemove).toHaveBeenCalledWith('/path/to/file.ts');
  });

  it('renders null when empty', () => {
    const { container } = render(<AttachBar attachments={[]} onRemove={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders multiple chips', () => {
    const paths = ['/a/x.ts', '/b/y.ts', '/c/z.ts'];
    render(<AttachBar attachments={paths} onRemove={vi.fn()} />);
    expect(screen.getAllByRole('button').length).toBe(3);
  });
});
