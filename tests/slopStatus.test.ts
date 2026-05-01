// Wave 0 stub — RED until 06-02 implements GET /api/slop-status and POST /api/slop-init
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('GET /api/slop-status', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when cwd param is missing', () => {
    expect(true).toBe(false);
  });

  it('returns { exists: true } when .slop/ folder is present in cwd', () => {
    expect(true).toBe(false);
  });

  it('returns { exists: false } when .slop/ folder is absent from cwd', () => {
    expect(true).toBe(false);
  });
});

describe('POST /api/slop-init', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when cwd body field is missing', () => {
    expect(true).toBe(false);
  });

  it('returns { ok: true } on success', () => {
    expect(true).toBe(false);
  });
});
