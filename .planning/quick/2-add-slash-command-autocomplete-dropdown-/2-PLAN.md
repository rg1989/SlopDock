---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - client/components/SlashMenu.tsx
  - client/components/Composer.tsx
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "Typing '/' at start of input (or after newline) opens the dropdown above the textarea"
    - "Typing additional characters after '/' filters the command list in real time"
    - "Arrow keys move selection up/down; Enter inserts the selected command; Escape closes without inserting"
    - "Clicking a command item inserts it into the textarea"
    - "Dropdown closes when the slash token is deleted or cursor leaves the slash context"
    - "Dropdown does not open mid-word (only after BOL or newline-preceded '/'"
  artifacts:
    - path: "client/components/SlashMenu.tsx"
      provides: "Autocomplete dropdown component — pure presentational, receives items + selectedIndex + onSelect + onClose"
    - path: "client/components/Composer.tsx"
      provides: "Augmented Composer with slash-detection logic and SlashMenu integration"
  key_links:
    - from: "client/components/Composer.tsx"
      to: "client/components/SlashMenu.tsx"
      via: "conditional render above textarea when slashQuery !== null"
      pattern: "slashQuery !== null && <SlashMenu"
---

<objective>
Add a slash-command autocomplete dropdown to the Composer textarea. When the user types "/" at the start of a line, a filtered menu appears above the input. Keyboard navigation (arrow up/down, Enter, Escape) and mouse click both work for selection. Selecting a command replaces the slash token with the full command text.

Purpose: Mirrors Claude's own "/" command UX so power users can invoke GSD and built-in commands without memorizing exact spellings.
Output: SlashMenu.tsx (new), Composer.tsx (augmented) — zero new npm dependencies.
</objective>

<execution_context>
@/Users/rgv250cc/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rgv250cc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/2-add-slash-command-autocomplete-dropdown-/2-PLAN.md

<interfaces>
<!-- Current Composer signature — executor must preserve all existing props/behaviour -->
interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  attachments?: string[];
  clearAttachments?: () => void;
  onAttach?: (paths: string[]) => void;
  cwd?: string | null;
}

<!-- Composer is a forwardRef component; ref is HTMLTextAreaElement -->
export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(...)

<!-- Existing handleKeyDown already handles:
     - Enter (no shift) → send
     - Shift+Enter → newline (browser default) -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create SlashMenu component with command registry</name>
  <files>client/components/SlashMenu.tsx</files>
  <action>
Create `client/components/SlashMenu.tsx` as a pure presentational component.

**Command registry** — define as a const array at the top of the file (easy to extend):

```ts
export interface SlashCommand {
  command: string;   // e.g. "/gsd:plan-phase"
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // GSD workflow commands
  { command: '/gsd:discuss-phase',   description: 'Discuss and clarify an upcoming phase' },
  { command: '/gsd:research-phase',  description: 'Research libraries / architecture for a phase' },
  { command: '/gsd:plan-phase',      description: 'Create execution plans for a phase' },
  { command: '/gsd:execute-phase',   description: 'Execute plans for a phase' },
  { command: '/gsd:verify-phase',    description: 'Verify phase against requirements' },
  { command: '/gsd:uat',             description: 'Run user acceptance testing for a phase' },
  { command: '/gsd:retrospective',   description: 'Generate phase retrospective' },
  { command: '/gsd:ship',            description: 'Tag and ship current milestone' },
  // Claude Code built-in
  { command: '/clear',               description: 'Clear conversation and free context' },
  { command: '/compact',             description: 'Compact conversation with summary' },
  { command: '/help',                description: 'Show Claude Code help' },
  { command: '/init',                description: 'Initialize CLAUDE.md for this project' },
  { command: '/login',               description: 'Switch Claude accounts' },
  { command: '/logout',              description: 'Logout from current account' },
  { command: '/model',               description: 'Set or show the current AI model' },
  { command: '/pr_comments',         description: 'View pull request comments' },
  { command: '/review',              description: 'Review a pull request' },
  { command: '/terminal-setup',      description: 'Set up terminal integration' },
  { command: '/vim',                 description: 'Toggle vim keybindings' },
];
```

**Component props:**

```ts
interface SlashMenuProps {
  items: SlashCommand[];      // already-filtered list
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}
```

**Rendering:** Render a `<div>` with `position: absolute`, `bottom: 'calc(100% + 4px)'`, `left: 0`, `right: 0`, `zIndex: 100`. This positions the dropdown ABOVE the composer wrapper (the wrapper is `position: relative` in Composer). Background `#161b22`, border `1px solid #30363d`, border-radius `6px`, max-height `240px`, overflow-y auto, box-shadow `0 -4px 16px rgba(0,0,0,0.4)`.

Each item is a `<div role="option">` with padding `6px 12px`, cursor pointer, display flex, gap `12px`. Highlight `selectedIndex` row with background `#21262d`. On hover set background `#1c2128`. Command text in `#d4845a` monospace `13px`. Description text in `#8b949e` `12px`, truncated with overflow hidden / text-overflow ellipsis / white-space nowrap.

If `items.length === 0` render nothing (return null).

Attach `onMouseDown` (not onClick) on each item calling `e.preventDefault(); onSelect(item)` — `mousedown` fires before `blur` on the textarea, preventing the menu from closing before the click registers.
  </action>
  <verify>File exists with exported SLASH_COMMANDS array and default-exported SlashMenu component; `npx tsc --noEmit` passes in client/</verify>
  <done>SlashMenu.tsx compiles cleanly; command list has at least 10 entries; dropdown positions above its container</done>
</task>

<task type="auto">
  <name>Task 2: Wire slash detection + keyboard navigation into Composer</name>
  <files>client/components/Composer.tsx</files>
  <action>
Augment `client/components/Composer.tsx` to integrate slash autocomplete. Preserve all existing behaviour exactly.

**State to add:**

```ts
const [slashQuery, setSlashQuery] = useState<string | null>(null);
// null = menu closed; string = current filter after '/'
const [slashAnchor, setSlashAnchor] = useState(0); // caret position of the '/' that opened the menu
const [menuIndex, setMenuIndex] = useState(0);
```

**Filtered items** (derived, not state):

```ts
const menuItems = slashQuery === null
  ? []
  : SLASH_COMMANDS.filter(c =>
      c.command.toLowerCase().includes(slashQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(slashQuery.toLowerCase())
    );
```

**Slash detection in `onChange`:**

Replace the direct `setValue` call with a handler that also detects slash context:

```ts
const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const val = e.target.value;
  setValue(val);

  const pos = e.target.selectionStart ?? val.length;
  // Find the start of the current "word" working backwards from cursor
  const before = val.slice(0, pos);
  // Find the last newline before cursor (or BOL)
  const lineStart = before.lastIndexOf('\n') + 1; // 0 if no newline
  const lineText = before.slice(lineStart);

  // Open menu only if line starts with '/' (optional leading whitespace not allowed per spec)
  if (lineText.startsWith('/')) {
    const query = lineText.slice(1); // text after the '/'
    // Do not open if there's a space in the token — user has moved past command selection
    if (!query.includes(' ')) {
      setSlashQuery(query);
      setSlashAnchor(lineStart); // remember where the slash is
      setMenuIndex(0);
      return;
    }
  }
  // Close menu if slash context no longer active
  setSlashQuery(null);
};
```

**Keyboard navigation** — update `handleKeyDown`:

Before the existing Enter handler, intercept arrow/enter/escape when menu is open:

```ts
if (slashQuery !== null && menuItems.length > 0) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setMenuIndex(i => Math.min(i + 1, menuItems.length - 1));
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    setMenuIndex(i => Math.max(i - 1, 0));
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    insertCommand(menuItems[menuIndex]);
    return;
  }
}
if (e.key === 'Escape' && slashQuery !== null) {
  e.preventDefault();
  setSlashQuery(null);
  return;
}
// ... existing Enter-to-send logic continues unchanged below
```

**insertCommand helper:**

```ts
const insertCommand = (cmd: SlashCommand) => {
  // Replace from slashAnchor to current cursor with "command " (trailing space)
  const ta = (ref as React.RefObject<HTMLTextAreaElement>).current;
  const pos = ta?.selectionStart ?? value.length;
  const before = value.slice(0, slashAnchor);      // text before the '/'
  const after = value.slice(pos);                   // text after current cursor
  const newVal = before + cmd.command + ' ' + after;
  setValue(newVal);
  setSlashQuery(null);
  // Restore cursor position after the inserted command + space
  requestAnimationFrame(() => {
    if (ta) {
      const newPos = slashAnchor + cmd.command.length + 1;
      ta.setSelectionRange(newPos, newPos);
      ta.focus();
    }
  });
};
```

**Render SlashMenu above the textarea wrapper:**

The outer `<div style={{ position: 'relative' }}>` already exists in Composer. Render SlashMenu inside it, before the `<textarea>`:

```tsx
{slashQuery !== null && menuItems.length > 0 && (
  <SlashMenu
    items={menuItems}
    selectedIndex={menuIndex}
    onSelect={insertCommand}
    onClose={() => setSlashQuery(null)}
  />
)}
<textarea ... onChange={handleChange} ... />
```

Import `SlashMenu` and `SLASH_COMMANDS` from `./SlashMenu`.

Do NOT change: forwardRef signature, onSend logic, attachments logic, handlePaperclip, handleSend, any existing styles.
  </action>
  <verify>`npx tsc --noEmit` passes; `npm run dev` starts without errors; manually type "/" in composer and confirm dropdown appears above textarea</verify>
  <done>Dropdown appears on "/", filters as you type, arrow+Enter inserts command with trailing space, Escape closes, click inserts — existing send/attach behaviour unchanged</done>
</task>

</tasks>

<verification>
Manual smoke test (takes ~2 minutes):
1. Open app, connect to a folder
2. Click Composer, type "/" — dropdown appears above textarea listing all commands
3. Type "gsd" — list narrows to GSD commands only
4. Press ArrowDown twice, press Enter — selected command is inserted at cursor with trailing space, dropdown closes
5. Clear text, type "/clear" — "/clear" matches, Enter inserts it
6. Type "/" then press Escape — dropdown closes, "/" remains in textarea
7. Click the "/" item with mouse — command inserted correctly
8. Confirm Enter-to-send still works normally when no dropdown is showing
9. Confirm Shift+Enter still inserts newline without triggering menu weirdly
10. Confirm attachments and send button still function normally
</verification>

<success_criteria>
- Dropdown appears above textarea (never overlaps input)
- Filtering is case-insensitive and matches both command and description text
- Keyboard: ArrowDown/ArrowUp cycle selection, Enter inserts, Escape closes
- Mouse: clicking an item inserts without blur-race condition
- Menu does NOT open mid-word or after a space following the command token
- Zero new npm dependencies
- All pre-existing Composer functionality unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/2-add-slash-command-autocomplete-dropdown-/2-SUMMARY.md` with what was built, files changed, and any decisions made.
</output>
