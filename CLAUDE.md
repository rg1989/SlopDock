# SlopDock — Project Rules

## Design System

### Font

**All UI text uses `monospace` (system monospace).** No exceptions unless noted below.

```css
font-family: monospace;
```

Exceptions:
- Terminal output: `'SF Mono', 'Fira Code', 'Courier New', monospace`
- Markdown body prose (`.md-body`): `Georgia, serif`

**Never omit `font-family: monospace` from any new component.** This is the single most common regression — inline styles and new components forget it and fall back to the browser's sans-serif default.

### Color Palette

Derived from GitHub's dark theme. Use these tokens — do not introduce new hex values.

| Role | Value | Usage |
|---|---|---|
| App background | `#0d1117` | `html`, `body`, `#root` |
| Surface | `#161b22` | Panels, menus, composer, tab bars |
| Elevated surface | `#21262d` | Hover states, selected rows, code inline bg |
| Border | `#30363d` | All borders and dividers |
| Muted border | `#484f58` | Subtle separators, loading dots |
| Very muted text | `#6e7681` | Placeholder-level labels |
| Secondary text | `#8b949e` | Descriptions, timestamps, muted labels |
| Primary text | `#c9d1d9` | Default body text |
| Bright text | `#e6edf3` | Emphasis, headings |
| **Accent orange** | `#d4845a` | Commands, active states, primary interactive, resize handles |
| Accent orange hover | `#e89a70` | Hover on orange elements |
| Accent orange pressed | `#c57348` | Active/pressed orange |
| Error / danger | `#f85149` | Errors, destructive actions |
| Success / green | `#7ee787` | Success states |
| Warning / yellow | `#e3b341` | Warnings |
| Info / blue | `#79c0ff` | Info, links |

Syntax highlight colors (use only in code/token contexts):
`#ff7b72`, `#a5d6ff`, `#d2a8ff`, `#bc8cff`, `#58a6ff`, `#aff3b7`

### Font Sizes

| Size | Usage |
|---|---|
| `10px` | Uppercase labels (`text-transform: uppercase; letter-spacing: 0.06em`) |
| `11px` | Badges, small metadata, inline code labels |
| `12px` | Default body / descriptions |
| `13px` | Medium UI text, command names in menus |
| `14px` | File names, slightly prominent text |
| `16px` | Titles, headings within panels |

Line height: `1.5` for all body text.

### Spacing

Base unit is `4px`. Common values: `4`, `6`, `8`, `12`, `16px`.

Standard component padding: `6px 12px` (rows/list items), `8px 12px` (bars/toolbars).

### Border Radius

| Value | Usage |
|---|---|
| `3px` | Inline elements (code spans, tokens) |
| `4px` | Small components (badges, inputs, dropdowns) |
| `6px` | Panels, menus, modal surfaces |
| `50%` | Circular indicators, loading dots |

### Transitions

```css
/* Hover background changes */
transition: background 0.15s;

/* Color + background together */
transition: color 0.12s, background 0.12s;
```

Do not use longer durations for simple hover effects.

### Interactive States

- **Hover**: `#1c2128` (just above surface)
- **Selected / active row**: `#21262d`
- **Focus ring**: `1px solid #d4845a` or `outline: 1px solid #d4845a`

### Borders

Standard: `1px solid #30363d`

Do not use `2px` borders except for resize handles or active tab indicators.

---

## Component Patterns

### Popup / Dropdown Menus

```jsx
// Container
{
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '6px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  zIndex: 9999,
}

// Row
{
  padding: '6px 12px',
  display: 'flex',
  gap: '12px',
  alignItems: 'baseline',
  fontFamily: 'monospace',  // ← always include
}

// Row — selected
{ background: '#21262d' }

// Row — hover
{ background: '#1c2128' }
```

### Labels / Badges

```css
font-size: 10px;
text-transform: uppercase;
letter-spacing: 0.06em;
color: #484f58;
font-family: monospace;
```

### Inline Code

```css
color: #a5d6ff;
background: #21262d;
border-radius: 3px;
padding: 0 2px;
font-family: monospace;
```

---

## Architecture

- **Stack**: Node/Express backend (`server/`), React 18 + Vite frontend (`client/`)
- **Terminal**: node-pty over WebSocket (`server/index.ts`)
- **State**: React hooks only — no Redux, no Zustand
- **Styling**: Plain CSS (`client/App.css`) + inline styles in components. No CSS-in-JS libraries, no Tailwind.
- **Tests**: Vitest + React Testing Library (`tests/`)

### File Conventions

- Components: `client/components/PascalCase.tsx`
- Hooks: `client/hooks/useCamelCase.ts`
- All new CSS goes into `client/App.css` — no per-component CSS files
- Inline styles are acceptable for dynamic values; static styles go in `App.css`

---

## Rules for New Features

1. **Font first**: every new component must explicitly set `fontFamily: 'monospace'` on text elements, or inherit it via a CSS class that sets it. Do not assume inheritance will work through inline-styled containers.

2. **Colors from the palette only**: do not introduce new hex values. Map your needs to the table above.

3. **No new dependencies** without discussion — the bundle is intentionally lean.

4. **No comments in code** unless the why is non-obvious. Do not add docstrings or JSDoc blocks.

5. **No external UI libraries** (no MUI, Chakra, Radix, etc.). Build from the patterns above.
