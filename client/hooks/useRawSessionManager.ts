import { useState, useCallback, useEffect } from 'react';
import type { SessionStatus } from './usePty';

export interface RawSession {
  id: string;
  status: SessionStatus;
  cwd: string;
}

export interface UseRawSessionManagerReturn {
  sessions: RawSession[];
  activeId: string | null;
  add: () => void;
  remove: (id: string) => void;
  setActive: (id: string) => void;
  updateStatus: (id: string, status: SessionStatus) => void;
}

const MAX_RAW_SESSIONS = 4;
const STORAGE_KEY = 'slopmop:raw-sessions';

function loadSaved(): { sessions: RawSession[]; activeId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessions: [], activeId: null };
    const { sessions, activeId } = JSON.parse(raw) as { sessions: RawSession[]; activeId: string | null };
    const restored = sessions.map(s => ({ ...s, status: 'connecting' as const }));
    return { sessions: restored, activeId: activeId ?? (restored[0]?.id ?? null) };
  } catch {
    return { sessions: [], activeId: null };
  }
}

export function useRawSessionManager(cwd: string | null): UseRawSessionManagerReturn {
  const [sessions, setSessions] = useState<RawSession[]>(() => loadSaved().sessions);
  const [activeId, setActiveId] = useState<string | null>(() => loadSaved().activeId);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, activeId }));
  }, [sessions, activeId]);

  const add = useCallback(() => {
    if (!cwd) return;
    const id = crypto.randomUUID();
    setSessions(prev => {
      if (prev.length >= MAX_RAW_SESSIONS) return prev;
      const newSession: RawSession = { id, status: 'connecting', cwd };
      return [...prev, newSession];
    });
    setActiveId(id);
  }, [cwd]);

  const remove = useCallback((id: string) => {
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== id);
      setActiveId(active => {
        if (active !== id) return active;
        return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      });
      return remaining;
    });
  }, []);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const updateStatus = useCallback((id: string, status: SessionStatus) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  return { sessions, activeId, add, remove, setActive, updateStatus };
}
