import { type ReactNode } from 'react';

interface ActionBarProps {
  voiceSlot?: ReactNode;
  onAttach?: () => void;
  picking?: boolean;
}

export function ActionBar({ voiceSlot, onAttach, picking = false }: ActionBarProps) {
  return (
    <div className="terminal-action-bar">
      {voiceSlot}
      <button
        type="button"
        className="icon-btn"
        title="Attach file"
        disabled={picking}
        onClick={onAttach}
        style={{ opacity: picking ? 0.5 : 1 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
        </svg>
      </button>
    </div>
  );
}
