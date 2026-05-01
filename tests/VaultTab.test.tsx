import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// @ts-expect-error
import { VaultTab } from '../client/components/VaultTab';

describe('VaultTab', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a list of backup targets from vault-status data', () => {
    expect(true).toBe(false);
  });

  it('Backup All button calls POST /api/vault-backup', () => {
    expect(true).toBe(false);
  });

  it('Restore button calls POST /api/vault-restore with target id', () => {
    expect(true).toBe(false);
  });
});
