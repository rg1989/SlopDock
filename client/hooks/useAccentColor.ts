import { useState, useEffect, useCallback } from 'react';

export const DEFAULT_ACCENT = '#d4845a';
const DEFAULT_HOVER = '#e89a70';
const DEFAULT_DIM = '#c57348';
const DEFAULT_RGB = '212, 132, 90';

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function lighten(rgb: [number, number, number], amount: number): string {
  return '#' + rgb.map(c => Math.min(255, Math.round(c + (255 - c) * amount)).toString(16).padStart(2, '0')).join('');
}

function darken(rgb: [number, number, number], amount: number): string {
  return '#' + rgb.map(c => Math.max(0, Math.round(c * (1 - amount))).toString(16).padStart(2, '0')).join('');
}

function applyCssVars(hex: string) {
  const rgb = hexToRgb(hex);
  const root = document.documentElement;
  if (!rgb) {
    root.style.setProperty('--accent', DEFAULT_ACCENT);
    root.style.setProperty('--accent-hover', DEFAULT_HOVER);
    root.style.setProperty('--accent-dim', DEFAULT_DIM);
    root.style.setProperty('--accent-rgb', DEFAULT_RGB);
    return;
  }
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-hover', lighten(rgb, 0.1));
  root.style.setProperty('--accent-dim', darken(rgb, 0.08));
  root.style.setProperty('--accent-rgb', rgb.join(', '));
}

function clearCssVars() {
  const root = document.documentElement;
  root.style.removeProperty('--accent');
  root.style.removeProperty('--accent-hover');
  root.style.removeProperty('--accent-dim');
  root.style.removeProperty('--accent-rgb');
}

export function useAccentColor(cwd: string | null) {
  const [customHex, setCustomHex] = useState<string | null>(null);

  useEffect(() => {
    if (!cwd) {
      setCustomHex(null);
      clearCssVars();
      return;
    }
    fetch(`/api/slop-accent?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(({ accentColor }: { accentColor: string | null }) => {
        setCustomHex(accentColor ?? null);
        if (accentColor) applyCssVars(accentColor);
        else clearCssVars();
      })
      .catch(() => {});
  }, [cwd]);

  const setAccent = useCallback((hex: string | null, currentCwd: string | null) => {
    if (!currentCwd) return;
    setCustomHex(hex);
    if (hex) applyCssVars(hex);
    else clearCssVars();
    fetch('/api/slop-accent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd: currentCwd, accentColor: hex }),
    }).catch(() => {});
  }, []);

  return {
    hex: customHex ?? DEFAULT_ACCENT,
    customHex,
    setAccent,
  };
}
