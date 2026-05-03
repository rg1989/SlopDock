import type React from 'react';
import { useEffect } from 'react';

export interface ContextMenuItem {
  label: string;
  action: () => void;
  icon?: React.ReactNode;
  variant?: 'danger';
  dividerAbove?: boolean;
}

interface Registration {
  items: ContextMenuItem[];
}

const registry = new Map<string, Registration>();

export function contextMenuLookup(id: string): Registration | undefined {
  return registry.get(id);
}

export function useContextMenu(id: string, items: ContextMenuItem[]) {
  // Synchronously keep registry fresh so closures are never stale
  registry.set(id, { items });

  useEffect(() => {
    return () => { registry.delete(id); };
  }, [id]);

  return { 'data-ctx-id': id } as const;
}
