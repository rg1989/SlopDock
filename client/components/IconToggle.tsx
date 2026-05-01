import type { FC, ReactNode } from 'react';

interface IconToggleProps {
  on: boolean;
  onIcon: ReactNode;
  offIcon: ReactNode;
  onTooltip: string;
  offTooltip: string;
  onClick: () => void;
  disabled?: boolean;
  /** Adds a soft glow pulse — use when the feature is actively doing something */
  pulsing?: boolean;
  className?: string;
}

/**
 * A minimal icon-only toggle button. The icon itself communicates the state —
 * no surrounding label needed. Use wherever a compact, self-describing toggle fits.
 */
export const IconToggle: FC<IconToggleProps> = ({
  on,
  onIcon,
  offIcon,
  onTooltip,
  offTooltip,
  onClick,
  disabled = false,
  pulsing = false,
  className,
}) => {
  const cls = [
    'icon-toggle',
    on ? 'icon-toggle--on' : 'icon-toggle--off',
    pulsing ? 'icon-toggle--pulsing' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      title={on ? onTooltip : offTooltip}
      aria-pressed={on}
      aria-label={on ? onTooltip : offTooltip}
      onClick={onClick}
      disabled={disabled}
    >
      {on ? onIcon : offIcon}
    </button>
  );
};

/* ── Built-in icon sets ──────────────────────────────────────────────────── */

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const SpeakerOnIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...strokeProps}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

export const SpeakerOffIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...strokeProps}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);
