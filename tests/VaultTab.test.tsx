import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VaultTab } from '../client/components/VaultTab';

const MOCK_TARGETS = [
  { id: 'claude-settings',       src: '/home/.claude/settings.json',       dest: '/home/.slop/backups/claude/settings.json',       sourceExists: true,  backupExists: true,  inSync: true,  lastBackup: '2024-01-01T00:00:00.000Z' },
  { id: 'claude-settings-local', src: '/home/.claude/settings.local.json', dest: '/home/.slop/backups/claude/settings.local.json', sourceExists: true,  backupExists: false, inSync: false, lastBackup: null },
  { id: 'claude-md',             src: '/home/.claude/CLAUDE.md',           dest: '/home/.slop/backups/claude/CLAUDE.md',           sourceExists: true,  backupExists: true,  inSync: false, lastBackup: '2024-01-02T00:00:00.000Z' },
  { id: 'claude-keybindings',    src: '/home/.claude/keybindings.json',    dest: '/home/.slop/backups/claude/keybindings.json',    sourceExists: false, backupExists: false, inSync: false, lastBackup: null },
  { id: 'gsd-config',            src: '/home/.claude/gsd/config.json',     dest: '/home/.slop/backups/gsd/config.json',            sourceExists: true,  backupExists: true,  inSync: true,  lastBackup: '2024-01-03T00:00:00.000Z' },
  { id: 'git-config',            src: '/home/.gitconfig',                  dest: '/home/.slop/backups/git/.gitconfig',             sourceExists: true,  backupExists: true,  inSync: true,  lastBackup: '2024-01-04T00:00:00.000Z' },
  { id: 'ssh-config',            src: '/home/.ssh/config',                 dest: '/home/.slop/backups/ssh/config',                 sourceExists: true,  backupExists: true,  inSync: true,  lastBackup: '2024-01-05T00:00:00.000Z' },
];

describe('VaultTab', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a list of backup targets from vault-status data', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ targets: MOCK_TARGETS }),
    });

    render(<VaultTab />);
    await waitFor(() => {
      expect(screen.getByText('claude-settings')).toBeDefined();
    });
    expect(screen.getByText('claude-settings-local')).toBeDefined();
    expect(screen.getByText('claude-md')).toBeDefined();
    expect(screen.getByText('claude-keybindings')).toBeDefined();
    expect(screen.getByText('gsd-config')).toBeDefined();
    expect(screen.getByText('git-config')).toBeDefined();
    expect(screen.getByText('ssh-config')).toBeDefined();
  });

  it('Backup All button calls POST /api/vault-backup', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ targets: MOCK_TARGETS }) })
      .mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });

    render(<VaultTab />);
    await waitFor(() => {
      expect(screen.getByText('Backup All')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Backup All'));
    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const putCall = calls.find(c => c[0] === '/api/vault-backup' && (c[1] as RequestInit)?.method === 'POST') as [string, RequestInit] | undefined;
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall![1].body as string);
      expect(body.targets).toBeUndefined();
    });
  });

  it('Restore button calls POST /api/vault-restore with target id', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ targets: MOCK_TARGETS }) })
      .mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });

    render(<VaultTab />);
    await waitFor(() => {
      const restoreBtns = screen.getAllByText('Restore');
      expect(restoreBtns.length).toBeGreaterThan(0);
    });

    const restoreBtns = screen.getAllByText('Restore');
    fireEvent.click(restoreBtns[0]);

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const restoreCall = calls.find(c => c[0] === '/api/vault-restore' && (c[1] as RequestInit)?.method === 'POST') as [string, RequestInit] | undefined;
      expect(restoreCall).toBeDefined();
      const body = JSON.parse(restoreCall![1].body as string);
      expect(body.targets).toContain('claude-settings');
    });
  });

  it('sync dot shows green when inSync=true', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        targets: [
          { id: 'claude-settings', src: '/src', dest: '/dest', sourceExists: true, backupExists: true, inSync: true, lastBackup: '2024-01-01T00:00:00.000Z' },
        ],
      }),
    });

    const { container } = render(<VaultTab />);
    await waitFor(() => {
      const okDot = container.querySelector('.vault-dot--ok');
      expect(okDot).toBeDefined();
      expect(okDot).not.toBeNull();
    });
  });

  it('sync dot shows amber when backupExists=false', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        targets: [
          { id: 'claude-settings-local', src: '/src', dest: '/dest', sourceExists: true, backupExists: false, inSync: false, lastBackup: null },
        ],
      }),
    });

    const { container } = render(<VaultTab />);
    await waitFor(() => {
      const warnDot = container.querySelector('.vault-dot--warn');
      expect(warnDot).toBeDefined();
      expect(warnDot).not.toBeNull();
    });
  });
});
