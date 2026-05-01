import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('App slop onboarding', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches /api/slop-status when cwd changes', () => {
    expect(true).toBe(false);
  });

  it('OnboardingModal renders when slopExists is false', () => {
    expect(true).toBe(false);
  });

  it('OnboardingModal does not render when slopExists is true', () => {
    expect(true).toBe(false);
  });
});
