import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import FolderPicker from '../client/components/FolderPicker';

describe('FolderPicker', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads recent paths from GET /api/recent-paths on mount', () => {
    expect(true).toBe(false);
  });

  it('calls PUT /api/recent-paths when a folder is connected', () => {
    expect(true).toBe(false);
  });
});
