import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { McpConnectionsModal } from '../client/components/McpConnectionsModal';
import { FolderPicker } from '../client/components/FolderPicker';

describe('McpConnectionsModal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches /api/mcp-servers on mount', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ servers: {} }),
    });

    render(<McpConnectionsModal onClose={vi.fn()} />);

    await waitFor(() => {
      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string][];
      expect(calls.some(c => c[0] === '/api/mcp-servers')).toBe(true);
    });
  });

  it('shows server names as text', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        servers: {
          'my-server': { command: 'node', args: ['server.js'], status: 'registered' },
        },
      }),
    });

    const { getByText } = render(<McpConnectionsModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(getByText('my-server')).toBeTruthy();
    });
  });

  it('shows Auto-register slopmop-canvas when key absent', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        servers: {
          'other-server': { command: 'node', args: [], status: 'registered' },
        },
      }),
    });

    const { getByText } = render(<McpConnectionsModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(getByText('Auto-register slopmop-canvas')).toBeTruthy();
    });
  });

  it('hides Auto-register slopmop-canvas when key present', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        servers: {
          'slopmop-canvas': { command: 'node', args: ['server/canvas-mcp-stdio.js'], status: 'registered' },
        },
      }),
    });

    const { queryByText } = render(<McpConnectionsModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(queryByText('Auto-register slopmop-canvas')).toBeNull();
    });
  });

  it('calls POST /api/mcp-register-canvas on click then re-fetches', async () => {
    let fetchCount = 0;
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/mcp-register-canvas' && opts?.method === 'POST') {
        return Promise.resolve({ json: async () => ({ ok: true }) });
      }
      fetchCount += 1;
      return Promise.resolve({ json: async () => ({ servers: {} }) });
    });

    const { getByText } = render(<McpConnectionsModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(getByText('Auto-register slopmop-canvas')).toBeTruthy();
    });

    fireEvent.click(getByText('Auto-register slopmop-canvas'));

    await waitFor(() => {
      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit?][];
      const postCall = calls.find(c => c[0] === '/api/mcp-register-canvas' && c[1]?.method === 'POST');
      expect(postCall).toBeDefined();
      expect(fetchCount).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('FolderPicker — fp-mcp-btn', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders .fp-mcp-btn when onMcpOpen is provided', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ paths: [] }),
    });

    const { container } = render(
      <FolderPicker cwd={null} onConnect={vi.fn()} onMcpOpen={vi.fn()} />
    );

    await waitFor(() => {
      expect(container.querySelector('.fp-mcp-btn')).toBeTruthy();
    });
  });

  it('does not render .fp-mcp-btn when onMcpOpen is absent', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ paths: [] }),
    });

    const { container } = render(
      <FolderPicker cwd={null} onConnect={vi.fn()} />
    );

    await waitFor(() => {
      expect(container.querySelector('.fp-mcp-btn')).toBeNull();
    });
  });

  it('calls onMcpOpen when .fp-mcp-btn is clicked', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ paths: [] }),
    });

    const onMcpOpen = vi.fn();
    const { container } = render(
      <FolderPicker cwd={null} onConnect={vi.fn()} onMcpOpen={onMcpOpen} />
    );

    await waitFor(() => {
      expect(container.querySelector('.fp-mcp-btn')).toBeTruthy();
    });

    fireEvent.click(container.querySelector('.fp-mcp-btn')!);
    expect(onMcpOpen).toHaveBeenCalledOnce();
  });
});
