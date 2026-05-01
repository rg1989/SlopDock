import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onStart?: () => void;
}

interface UseVoiceInputReturn {
  recording: boolean;
  transcribing: boolean;
  micError: string | null;
  start: () => void;
  stop: () => void;
  supported: boolean;
  whisperAvailable: boolean | null;
}

export function useVoiceInput({ onTranscript, onStart }: UseVoiceInputOptions): UseVoiceInputReturn {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null);

  const recorderRef  = useRef<MediaRecorder | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const abortRef     = useRef<AbortController | null>(null);
  const autoStopRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    fetch('/api/stt/status')
      .then(r => r.json())
      .then((d: { available: boolean }) => setWhisperAvailable(d.available))
      .catch(() => setWhisperAvailable(false));
  }, []);

  const start = useCallback(async () => {
    setMicError(null);
    onStart?.();   // TTS-04: stop TTS before mic opens

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError('Microphone permission denied. Allow access in your browser settings.');
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Release mic immediately
      stream.getTracks().forEach(t => t.stop());
      streamRef.current = null;

      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      chunksRef.current = [];

      setRecording(false);
      setTranscribing(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch('/api/stt', {
          method: 'POST',
          headers: { 'Content-Type': blob.type },
          body: blob,
          signal: ctrl.signal,
        });

        if (res.ok) {
          const { text } = await res.json() as { text: string };
          if (text?.trim()) onTranscript(text.trim());
        } else {
          const { setupHint } = await res.json().catch(() => ({ setupHint: null }));
          setMicError(setupHint ?? 'Whisper STT unavailable. Install: pip install openai-whisper');
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setMicError('Transcription failed — check that the server is running.');
        }
      } finally {
        abortRef.current = null;
        setTranscribing(false);
      }
    };

    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);

    // Auto-stop after 60 seconds
    autoStopRef.current = setTimeout(() => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    }, 60_000);
  }, [onStart, onTranscript]);

  const stop = useCallback(() => {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    // onstop fires asynchronously — recording/transcribing states updated there
  }, []);

  return { recording, transcribing, micError, start, stop, supported, whisperAvailable };
}
