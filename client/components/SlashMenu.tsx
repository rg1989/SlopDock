export interface SlashCommand {
  command: string;
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

interface SlashMenuProps {
  items: SlashCommand[];
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}

const MAX_MENU_HEIGHT = 240;

export default function SlashMenu({ items, selectedIndex, onSelect, anchorRect }: SlashMenuProps) {
  if (items.length === 0) return null;

  // Render above the textarea using fixed positioning so no overflow:hidden clips it
  const bottom = window.innerHeight - anchorRect.top + 4;
  const left = anchorRect.left;
  const width = anchorRect.width;

  return (
    <div
      style={{
        position: 'fixed',
        bottom,
        left,
        width,
        zIndex: 9999,
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '6px',
        maxHeight: `${MAX_MENU_HEIGHT}px`,
        overflowY: 'auto',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
      }}
      role="listbox"
    >
      {items.map((item, idx) => (
        <div
          key={item.command}
          role="option"
          aria-selected={idx === selectedIndex}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          style={{
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            gap: '12px',
            alignItems: 'baseline',
            background: idx === selectedIndex ? '#21262d' : 'transparent',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = idx === selectedIndex ? '#21262d' : '#1c2128';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = idx === selectedIndex ? '#21262d' : 'transparent';
          }}
        >
          <span
            style={{
              color: '#d4845a',
              fontFamily: 'monospace',
              fontSize: '13px',
              flexShrink: 0,
            }}
          >
            {item.command}
          </span>
          <span
            style={{
              color: '#8b949e',
              fontFamily: 'monospace',
              fontSize: '12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.description}
          </span>
        </div>
      ))}
    </div>
  );
}
