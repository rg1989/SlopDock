import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';

export interface BrainEntry {
  id: string;
  name: string;
  description: string;
  type: 'decision' | 'pattern' | 'context' | 'note';
  tags: string[];
  created: string;
}

interface BrainPanelProps {
  cwd: string;
  onOpenEntry: (id: string, isPreview: boolean) => void;
  onAttach?: (path: string) => void;
  /** Called after a deletion so the panel can refresh its list */
  refreshKey?: number;
  /** ID of the brain entry currently open in the editor */
  activeEntryId?: string;
}

const TYPE_ORDER: BrainEntry['type'][] = ['decision', 'context', 'pattern', 'note'];
const TYPE_LABELS: Record<string, string> = {
  decision: 'Decisions',
  context: 'Context',
  pattern: 'Patterns',
  note: 'Notes',
};

export function BrainPanel({ cwd, onOpenEntry, onAttach, refreshKey, activeEntryId }: BrainPanelProps) {
  const [entries, setEntries]   = useState<BrainEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<BrainEntry['type']>('note');
  const [creating, setCreating] = useState(false);
  const clickRef = useRef<Record<string, { count: number; timer: ReturnType<typeof setTimeout> | null }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/brain?cwd=${encodeURIComponent(cwd)}`);
      const { entries: data } = await res.json() as { entries: BrainEntry[] };
      setEntries(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const filtered = entries.filter(e =>
    !search ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const byType = Object.fromEntries(
    TYPE_ORDER.map(t => [t, filtered.filter(e => e.type === t)])
  );

  async function handleCreate(ev: FormEvent) {
    ev.preventDefault();
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd, name: formName.trim(), description: formDesc.trim(), type: formType, body: '' }),
      });
      const { id } = await res.json() as { id: string };
      setShowForm(false);
      setFormName('');
      setFormDesc('');
      setFormType('note');
      await load();
      onOpenEntry(id, false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="brain-panel">
      {/* Search + New button */}
      <div className="sidebar-search-bar">
        <input
          className="sidebar-search-input"
          type="text"
          placeholder="Search brain…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className="sidebar-collapse-btn"
          title="New entry"
          onClick={() => setShowForm(v => !v)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* New entry form */}
      {showForm && (
        <form className="brain-new-form" onSubmit={handleCreate}>
          <input
            className="brain-input"
            placeholder="Name…"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            autoFocus
          />
          <input
            className="brain-input"
            placeholder="Short description (optional)"
            value={formDesc}
            onChange={e => setFormDesc(e.target.value)}
          />
          <select
            className="brain-select"
            value={formType}
            onChange={e => setFormType(e.target.value as BrainEntry['type'])}
          >
            <option value="decision">Decision</option>
            <option value="context">Context</option>
            <option value="pattern">Pattern</option>
            <option value="note">Note</option>
          </select>
          <div className="brain-form-footer">
            <button type="submit" className="fp-btn primary" disabled={creating || !formName.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" className="fp-btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Body */}
      {loading ? (
        <div className="fp-loading" style={{ paddingTop: 32 }}>
          <div className="fp-loading-dot" /><div className="fp-loading-dot" /><div className="fp-loading-dot" />
        </div>
      ) : entries.length === 0 ? (
        <div className="sidebar-empty-panel">No entries yet.{'\n'}Click + to create your first.</div>
      ) : filtered.length === 0 ? (
        <div className="sidebar-empty-panel">No results for "{search}"</div>
      ) : (
        <div className="brain-list">
          {TYPE_ORDER.map(type => {
            const group = byType[type];
            if (!group?.length) return null;
            return (
              <div key={type} className="brain-group">
                <div className="brain-group-header">
                  <span className="brain-group-label">{TYPE_LABELS[type]}</span>
                  <span className="brain-group-count">{group.length}</span>
                </div>
                {group.map(entry => (
                  <button
                    key={entry.id}
                    className={`brain-entry-btn${entry.id === activeEntryId ? ' brain-entry-btn--active' : ''}`}
                    onClick={() => {
                      const c = clickRef.current[entry.id] ?? { count: 0, timer: null };
                      c.count++;
                      if (c.timer) clearTimeout(c.timer);
                      if (c.count >= 3) {
                        c.count = 0;
                        onAttach?.(`${cwd}/.brain/${entry.id}.md`);
                      } else {
                        onOpenEntry(entry.id, false);
                        c.timer = setTimeout(() => { c.count = 0; }, 400);
                      }
                      clickRef.current[entry.id] = c;
                    }}
                    title={entry.description || entry.name}
                  >
                    <span className="brain-entry-name">{entry.name}</span>
                    {entry.description && <span className="brain-entry-desc">{entry.description}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
