import { useVoiceInput } from '../client/hooks/useVoiceInput';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- MediaRecorder + MediaDevices mock ---

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  mimeType = 'audio/webm';
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start = vi.fn(() => { this.state = 'recording'; });
  stop  = vi.fn(() => {
    this.state = 'inactive';
    // Fire a data chunk then onstop, like a real MediaRecorder
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  });

  constructor() { MockMediaRecorder.instances.push(this); }
}

function makeSttFetch(opts: { sttOk?: boolean; text?: string } = {}) {
  return vi.fn((url: string) => {
    if (url.includes('/api/stt/status')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ available: true }) });
    }
    if (url.includes('/api/stt')) {
      if (opts.sttOk === false) return Promise.resolve({ ok: false, json: () => Promise.resolve({ setupHint: null }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ text: opts.text ?? 'hello world' }) });
    }
    return Promise.resolve({ ok: false });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  MockMediaRecorder.instances = [];
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  vi.stubGlobal('fetch', makeSttFetch());
  // Mock getUserMedia
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    writable: true,
    configurable: true,
  });
});

describe('useVoiceInput', () => {
  it('VOICE-02: start() requests mic and sets recording=true', async () => {
    const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));
    await act(async () => { await result.current.start(); });
    expect(result.current.recording).toBe(true);
  });

  it('VOICE-01: onTranscript fires with Whisper text after stop()', async () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onTranscript }));

    await act(async () => { await result.current.start(); });
    await act(async () => { result.current.stop(); });

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('hello world'));
  });

  it('VOICE-02: stop() triggers onstop which sets recording=false after transcription', async () => {
    const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));
    await act(async () => { await result.current.start(); });
    await act(async () => { result.current.stop(); });
    await waitFor(() => expect(result.current.recording).toBe(false));
  });

  it('TTS-03: onStart callback fires when recording starts', async () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn(), onStart }));
    await act(async () => { await result.current.start(); });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('shows error when mic permission denied', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('denied'));
    const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));
    await act(async () => { await result.current.start(); });
    expect(result.current.micError).toMatch(/permission denied/i);
  });

  it('whisperAvailable reflects /api/stt/status response', async () => {
    const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));
    await waitFor(() => expect(result.current.whisperAvailable).toBe(true));
  });
});
