import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSettings } from '../client/hooks/useSettings';

describe('useSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads settings from server on mount, overwriting localStorage', async () => {
    expect(true).toBe(false);
  });

  it('falls back to localStorage if server returns null', async () => {
    expect(true).toBe(false);
  });

  it('PUT /api/global-settings called on update()', async () => {
    expect(true).toBe(false);
  });

  it('migration: writes localStorage value to server if server returns null', async () => {
    expect(true).toBe(false);
  });
});
