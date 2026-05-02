import { useState, useCallback } from 'react';
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

export function useRawSessionManager(cwd: string | null): UseRawSessionManagerReturn {
  const [sessions, setSessions] = useState<RawSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

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
