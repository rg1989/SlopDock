import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('MCP-05: canvas MCP tool HTTP proxying', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it('canvas_open: POST /api/canvas/tabs with title, returns canvas_id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'abc-123', title: 'Test Tab' }),
    });
    // @ts-expect-error — module does not exist yet (Wave 0 RED)
    const { callCanvasOpen } = await import('../server/canvas-mcp-stdio.js');
    const result = await callCanvasOpen('Test Tab');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/canvas/tabs'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.content[0].text).toContain('abc-123');
  });

  it('canvas_open: returns isError:true when API returns 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'tab not found' }),
    });
    // @ts-expect-error — module does not exist yet (Wave 0 RED)
    const { callCanvasClose } = await import('../server/canvas-mcp-stdio.js');
    const result = await callCanvasClose('missing-id');
    expect(result.isError).toBe(true);
  });
});
