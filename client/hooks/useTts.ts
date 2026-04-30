import { useState, useRef, useCallback } from 'react';

// Standard ANSI escape sequence stripping
// Source: research doc + MDN Web Speech API docs
function stripAnsi(raw: string): string {
  return raw
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')    // CSI sequences (colors, cursor)
    .replace(/\x1b\][^\x07]*\x07/g, '')        // OSC sequences (title changes)
    .replace(/\x1b[^[\]]/g, '')                // other ESC sequences
    .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, ''); // control chars
}

// Split buffer at sentence boundaries; speak complete sentences; return remainder.
// Uses a capture group so the terminator stays attached to the sentence text.
function flushSentences(buffer: string, speak: (s: string) => void): string {
  // Split on sentence-ending punctuation followed by whitespace or end-of-string.
  // Capture group keeps the terminator in parts[i+1].
  const parts = buffer.split(/([.!?])(?=\s|$)/);
  // parts layout: [text, terminator, text, terminator, ..., remainder]
  let i = 0;
  while (i + 1 < parts.length) {
    const sentence = (parts[i] + (parts[i + 1] ?? '')).trim();
    if (sentence) speak(sentence);
    i += 2;
  }
  // Return trailing incomplete fragment (last element when parts.length is odd after split)
  return parts[parts.length - 1] ?? '';
}

interface UseTtsOptions {
  enabled: boolean;
}

interface UseTtsReturn {
  speaking: boolean;
  stop: () => void;
  handleData: (raw: string) => void;
}

export function useTts({ enabled }: UseTtsOptions): UseTtsReturn {
  const [speaking, setSpeaking] = useState(false);
  const bufferRef = useRef('');

  const speak = useCallback((text: string) => {
    if (!text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    // Avoid Google voices — they trigger the Chrome ~15s silent-stop bug (chromium #679437)
    const voices = speechSynthesis.getVoices();
    const safeVoice = voices.find(
      v => !v.name.startsWith('Google ') && v.lang.startsWith('en')
    );
    if (safeVoice) u.voice = safeVoice;
    u.rate = 1.1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => {
      if (!speechSynthesis.speaking) setSpeaking(false);
    };
    speechSynthesis.speak(u);
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    bufferRef.current = '';
    setSpeaking(false);
  }, []);

  const handleData = useCallback((raw: string) => {
    if (!enabled) return;
    const text = stripAnsi(raw);
    bufferRef.current += text;
    bufferRef.current = flushSentences(bufferRef.current, speak);
  }, [enabled, speak]);

  return { speaking, stop, handleData };
}
