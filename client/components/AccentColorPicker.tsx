import { useState, useEffect, useRef, type FC } from 'react';
import { createPortal } from 'react-dom';

export interface PaletteEntry {
  name: string;
  hex: string;
}

const PRESETS: PaletteEntry[] = [
  { name: 'Claude Orange', hex: '#d4845a' },
  { name: 'Matrix Green',  hex: '#00c22b' },
  { name: 'Sky Blue',      hex: '#67a5db' },
  { name: 'Dracula',       hex: '#7347ad' },
  { name: 'Jade',          hex: '#4a9686' },
  { name: 'Neon Pink',     hex: '#d93496' },
  { name: 'Olive',         hex: '#acb037' },
  { name: 'Crimson',       hex: '#b03737' },
];

function Swatch({ hex, size = 14 }: { hex: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: 3,
      background: hex,
      border: '1px solid rgba(255,255,255,0.12)',
      flexShrink: 0,
    }} />
  );
}

interface OptionRowProps {
  entry: PaletteEntry;
  selected: boolean;
  isCustom?: boolean;
  onSelect: () => void;
  onRemove?: () => void;
  onHover: (hex: string, y: number, x: number) => void;
  onLeave: () => void;
}

const OptionRow: FC<OptionRowProps> = ({ entry, selected, isCustom, onSelect, onRemove, onHover, onLeave }) => (
  <div
    className={`accent-drop-row${selected ? ' accent-drop-row--sel' : ''}`}
    onMouseEnter={e => {
      const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      onHover(entry.hex, r.top - 28, r.left + r.width / 2);
    }}
    onMouseLeave={onLeave}
    onClick={onSelect}
  >
    <Swatch hex={entry.hex} />
    <span className="accent-drop-name">{entry.name}</span>
    {selected && <span className="accent-drop-check">✓</span>}
    {isCustom && onRemove && (
      <button
        className="accent-drop-remove"
        onClick={e => { e.stopPropagation(); onRemove(); }}
        title="Remove"
      >×</button>
    )}
  </div>
);

interface Props {
  value: string | null;
  onChange: (hex: string | null) => void;
  disabled?: boolean;
}

export const AccentColorPicker: FC<Props> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [customPalette, setCustomPalette] = useState<PaletteEntry[]>([]);
  const [addName, setAddName] = useState('');
  const [addHex, setAddHex] = useState('');
  const [addError, setAddError] = useState('');
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [tooltip, setTooltip] = useState<{ hex: string; top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/accent-palette')
      .then(r => r.json())
      .then(({ palette }: { palette: PaletteEntry[] }) => setCustomPalette(palette ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function openDropdown() {
    if (disabled || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
    setOpen(v => !v);
  }

  function select(hex: string | null) {
    onChange(hex);
    setOpen(false);
  }

  function savePalette(next: PaletteEntry[]) {
    setCustomPalette(next);
    fetch('/api/accent-palette', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palette: next }),
    }).catch(() => {});
  }

  function addColor() {
    const name = addName.trim();
    const raw = addHex.trim();
    const hex = raw.startsWith('#') ? raw : '#' + raw;
    if (!name) { setAddError('Name required'); return; }
    if (!/^#[0-9a-f]{6}$/i.test(hex)) { setAddError('Invalid hex (e.g. #ff0080)'); return; }
    setAddError('');
    savePalette([...customPalette, { name, hex: hex.toLowerCase() }]);
    setAddName('');
    setAddHex('');
  }

  function removeColor(idx: number) {
    const removed = customPalette[idx];
    savePalette(customPalette.filter((_, i) => i !== idx));
    if (value === removed.hex) onChange(null);
  }

  const activeHex = value ?? '#d4845a';
  const activeEntry =
    PRESETS.find(p => p.hex === value) ??
    customPalette.find(p => p.hex === value) ??
    (value ? { name: value, hex: value } : PRESETS[0]);

  return (
    <div className="accent-picker-wrap">
      <button
        ref={triggerRef}
        className={`accent-trigger${open ? ' accent-trigger--open' : ''}`}
        onClick={openDropdown}
        disabled={disabled}
        title={disabled ? 'Open a project to customize' : undefined}
      >
        <Swatch hex={activeHex} />
        <span className="accent-trigger-name">{activeEntry.name}</span>
        <span className="accent-trigger-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {tooltip && createPortal(
        <span className="accent-hex-tooltip" style={{ top: tooltip.top, left: tooltip.left }}>
          {tooltip.hex}
        </span>,
        document.body,
      )}

      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="accent-drop"
          style={{ top: dropPos.top, left: dropPos.left, minWidth: dropPos.width }}
        >
          <div className="accent-drop-section">
            {PRESETS.map(p => (
              <OptionRow
                key={p.hex}
                entry={p}
                selected={p.hex === activeHex && (value !== null || p.hex === '#d4845a')}
                onSelect={() => select(p.hex === '#d4845a' ? null : p.hex)}
                onHover={(hex, top, left) => setTooltip({ hex, top, left })}
                onLeave={() => setTooltip(null)}
              />
            ))}
          </div>

          {customPalette.length > 0 && (
            <>
              <div className="accent-drop-divider" />
              <div className="accent-drop-section">
                {customPalette.map((p, i) => (
                  <OptionRow
                    key={p.hex + i}
                    entry={p}
                    selected={p.hex === value}
                    isCustom
                    onSelect={() => select(p.hex)}
                    onRemove={() => removeColor(i)}
                    onHover={(hex, top, left) => setTooltip({ hex, top, left })}
                    onLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="accent-drop-divider" />
          <div className="accent-drop-add">
            <div className="accent-drop-add-row">
              <input
                className="accent-add-input"
                placeholder="Name"
                value={addName}
                onChange={e => { setAddName(e.target.value); setAddError(''); }}
                onKeyDown={e => e.key === 'Enter' && addColor()}
              />
              <input
                className="accent-add-input accent-add-input--hex"
                placeholder="#rrggbb"
                value={addHex}
                maxLength={7}
                onChange={e => { setAddHex(e.target.value); setAddError(''); }}
                onKeyDown={e => e.key === 'Enter' && addColor()}
              />
              <button className="accent-add-btn" onClick={addColor}>Add</button>
            </div>
            {addError && <div className="accent-add-error">{addError}</div>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
