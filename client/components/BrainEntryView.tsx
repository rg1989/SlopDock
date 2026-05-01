import { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

export interface BrainEntryData {
  type: 'brain';
  id: string;
  name: string;
  description: string;
  entryType: string;
  tags: string[];
  created: string;
  body: string;
}

interface BrainEntryViewProps {
  data: BrainEntryData;
  cwd: string | null;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: (data: BrainEntryData) => void;
}

const TYPE_BADGE_CLASS: Record<string, string> = {
  decision: 'brain-badge--decision',
  pattern:  'brain-badge--pattern',
  context:  'brain-badge--context',
  note:     'brain-badge--note',
};

export function BrainEntryView({ data, cwd, onClose, onDeleted, onUpdated }: BrainEntryViewProps) {
  const [editing, setEditing]     = useState(false);
  const [draft, setDraft]         = useState('');
  const [editName, setEditName]   = useState('');
  const [editDesc, setEditDesc]   = useState('');
  const [editType, setEditType]   = useState('');
  const [editTags, setEditTags]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);

  function startEdit() {
    setDraft(data.body);
    setEditName(data.name);
    setEditDesc(data.description);
    setEditType(data.entryType);
    setEditTags(data.tags.join(', '));
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); }

  async function handleSave() {
    if (!cwd) return;
    setSaving(true);
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
      await fetch('/api/brain/entry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd, id: data.id, name: editName, description: editDesc, type: editType, tags, body: draft }),
      });
      const res = await fetch(`/api/brain/entry?cwd=${encodeURIComponent(cwd)}&id=${encodeURIComponent(data.id)}`);
      const json = await res.json() as { meta: Record<string, unknown>; body: string };
      onUpdated({
        type: 'brain',
        id: data.id,
        name: (json.meta.name as string) ?? editName,
        description: (json.meta.description as string) ?? editDesc,
        entryType: (json.meta.type as string) ?? editType,
        tags: (json.meta.tags as string[]) ?? tags,
        created: (json.meta.created as string) ?? data.created,
        body: json.body,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!cwd || !confirm(`Delete "${data.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch('/api/brain/entry', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd, id: data.id }),
      });
      onDeleted();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="brain-entry-view">
      {/* Toolbar */}
      <div className="fp-toolbar">
        {editing ? (
          <>
            <button className="fp-btn primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className="fp-btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
          </>
        ) : (
          <>
            <button className="fp-btn" onClick={startEdit}>Edit</button>
            <button className="fp-btn bev-btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        )}
      </div>

      {editing ? (
        /* ── Edit mode ──────────────────────────────────────────────────────── */
        <div className="bev-edit-wrap">
          <div className="bev-edit-fields">
            <input className="brain-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name" />
            <input className="brain-input" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Short description" />
            <div className="bev-edit-row">
              <select className="brain-select" value={editType} onChange={e => setEditType(e.target.value)}>
                <option value="decision">Decision</option>
                <option value="context">Context</option>
                <option value="pattern">Pattern</option>
                <option value="note">Note</option>
              </select>
              <input className="brain-input" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="Tags (comma-separated)" />
            </div>
          </div>
          <textarea className="fp-edit-area" value={draft} onChange={e => setDraft(e.target.value)} />
        </div>
      ) : (
        /* ── Read mode ──────────────────────────────────────────────────────── */
        <div className="bev-content">
          <div className="bev-header">
            <div className="bev-title-row">
              <h1 className="bev-name">{data.name}</h1>
              <span className={`brain-badge ${TYPE_BADGE_CLASS[data.entryType] ?? ''}`}>{data.entryType}</span>
            </div>
            {data.description && <p className="bev-description">{data.description}</p>}
            <div className="bev-meta">
              {data.tags.map(t => <span key={t} className="brain-tag">{t}</span>)}
              {data.created && <span className="bev-created">{data.created}</span>}
            </div>
          </div>
          <hr className="bev-divider" />
          <div className="bev-body">
            {data.body.trim() ? (
              <MarkdownRenderer content={data.body} />
            ) : (
              <p className="bev-empty-body">No content yet. Click Edit to add some.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
