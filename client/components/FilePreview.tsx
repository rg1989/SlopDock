import React, { useState, useEffect } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

export type FilePreviewData =
  | { type: 'text'; content: string }
  | { type: 'binary'; isImage: true; base64: string; ext: string }
  | { type: 'binary'; isImage: false; ext: string }
  | { type: 'diff'; content: string }
  | { type: 'brain'; id: string; name: string; description: string; entryType: string; tags: string[]; created: string; body: string }
  | { type: 'not-found' };

interface FilePreviewProps {
  data: FilePreviewData | null;
  filePath?: string | null;
  cwd?: string | null;
  initialEditing?: boolean;
  onPromote?: () => void;
}

// ---------------------------------------------------------------------------
// Server-side highlight via /api/highlight (Node.js Shiki — no browser bundle)
// ---------------------------------------------------------------------------

async function fetchHighlight(content: string, lang: string): Promise<string | null> {
  try {
    const res = await fetch('/api/highlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, lang }),
    });
    const { html } = await res.json() as { html: string | null };
    return html;
  } catch {
    return null;
  }
}

function extToShikiLang(filePath: string | null | undefined): string {
  if (!filePath) return 'text';
  const base = filePath.split('/').pop() ?? '';
  if (base === 'Dockerfile') return 'dockerfile';
  if (base === '.gitignore' || base === '.gitattributes') return 'gitignore';
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return 'text';
  switch (filePath.slice(dot).toLowerCase()) {
    case '.ts':                          return 'typescript';
    case '.tsx':                         return 'tsx';
    case '.js': case '.mjs': case '.cjs': return 'javascript';
    case '.jsx':                         return 'jsx';
    case '.py':                          return 'python';
    case '.json': case '.jsonc':         return 'json';
    case '.css':                         return 'css';
    case '.scss':                        return 'scss';
    case '.md': case '.markdown':        return 'markdown';
    case '.html': case '.htm':           return 'html';
    case '.xml': case '.svg':            return 'xml';
    case '.sh': case '.bash': case '.zsh': return 'bash';
    case '.yml': case '.yaml':           return 'yaml';
    case '.toml':                        return 'toml';
    case '.rs':                          return 'rust';
    case '.go':                          return 'go';
    case '.java':                        return 'java';
    case '.c': case '.h':               return 'c';
    case '.cpp': case '.cc': case '.hpp': return 'cpp';
    case '.sql':                         return 'sql';
    case '.diff': case '.patch':         return 'diff';
    default:                             return 'text';
  }
}

function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png':              return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.gif':              return 'image/gif';
    case '.webp':             return 'image/webp';
    case '.svg':              return 'image/svg+xml';
    default:                  return 'image/png';
  }
}

// ---------------------------------------------------------------------------
// Unified diff renderer
// ---------------------------------------------------------------------------

function DiffView({ content }: { content: string }) {
  if (!content.trim()) {
    return <div className="diff-empty">No changes to display</div>;
  }

  const lines = content.split('\n');

  return (
    <div className="diff-view">
      <pre className="diff-pre">
        {lines.map((line, i) => {
          let cls = 'diff-line';
          if (line.startsWith('+') && !line.startsWith('+++')) cls += ' diff-add';
          else if (line.startsWith('-') && !line.startsWith('---')) cls += ' diff-del';
          else if (line.startsWith('@@')) cls += ' diff-hunk';
          else if (line.startsWith('---') || line.startsWith('+++')) cls += ' diff-file-header';
          else if (line.startsWith('diff ') || line.startsWith('index ')) cls += ' diff-meta';
          return (
            <div key={i} className={cls}>
              <span className="diff-gutter">
                {line.startsWith('+') && !line.startsWith('+++') ? '+' :
                 line.startsWith('-') && !line.startsWith('---') ? '−' : ' '}
              </span>
              <span className="diff-content">{line.startsWith('+') || line.startsWith('-') ? line.slice(1) : line}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilePreview({ data, filePath, cwd, initialEditing, onPromote }: FilePreviewProps): React.ReactElement | null {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [mdPreview, setMdPreview] = useState(false);

  const isMarkdown = filePath?.match(/\.(md|markdown)$/i) != null;

  // Reset on file change; enter edit mode if initialEditing is set
  useEffect(() => {
    setEditing(!!initialEditing);
    setDraft(initialEditing && data?.type === 'text' ? data.content : '');
    setHighlightedHtml(null);
    setMdPreview(false);
  }, [data, initialEditing]);

  // Highlight code via server-side Shiki
  useEffect(() => {
    if (!data || data.type !== 'text' || editing) return;
    let cancelled = false;
    const lang = extToShikiLang(filePath);
    fetchHighlight(data.content, lang).then(html => {
      if (!cancelled) setHighlightedHtml(html);
    });
    return () => { cancelled = true; };
  }, [data, filePath, editing]);

  if (data === null) {
    return (
      <div className="fp-loading">
        <div className="fp-loading-dot" />
        <div className="fp-loading-dot" />
        <div className="fp-loading-dot" />
      </div>
    );
  }

  if (data.type === 'not-found') {
    const parts = (filePath ?? '').split('/');
    const filename = parts.pop() ?? filePath ?? 'unknown';
    const dir = parts.join('/') || '/';
    return (
      <div className="fp-not-found">
        <svg className="fp-not-found-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
          <polyline points="13 2 13 9 20 9"/>
          <line x1="9" y1="14" x2="15" y2="14"/>
        </svg>
        <p className="fp-not-found-title">File no longer available</p>
        <p className="fp-not-found-name">{filename}</p>
        <p className="fp-not-found-path">
          <span className="fp-not-found-label">Last known path</span>
          <code className="fp-not-found-code">{filePath ?? 'unknown'}</code>
        </p>
        <p className="fp-not-found-dir">
          <span className="fp-not-found-label">Searched in</span>
          <code className="fp-not-found-code">{dir}</code>
        </p>
      </div>
    );
  }

  if (data.type === 'text') {
    const content = data.content;

    function handleEdit() {
      onPromote?.();
      setDraft(content);
      setEditing(true);
    }

    async function handleSave() {
      if (!filePath || !cwd) return;
      const relPath = filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
      setSaving(true);
      try {
        await fetch('/api/file', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cwd, path: relPath, content: draft }),
        });
        setEditing(false);
      } finally {
        setSaving(false);
      }
    }

    function handleCancel() {
      setEditing(false);
      setDraft('');
    }

    return (
      <div className="file-preview">
        <div className="fp-toolbar">
          {editing ? (
            <>
              <button className="fp-btn primary" onClick={handleSave} disabled={saving || !filePath || !cwd}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="fp-btn" onClick={handleCancel} disabled={saving}>Cancel</button>
            </>
          ) : (
            <>
              <button className="fp-btn" onClick={handleEdit}>Edit</button>
              {isMarkdown && (
                <button
                  className={`fp-btn${mdPreview ? ' primary' : ''}`}
                  onClick={() => setMdPreview(v => !v)}
                  title="Toggle rendered preview"
                >
                  Preview
                </button>
              )}
            </>
          )}
        </div>
        {editing ? (
          <textarea className="fp-edit-area" value={draft} onChange={(e) => setDraft(e.target.value)} />
        ) : mdPreview && isMarkdown ? (
          <div className="fp-md-preview">
            <MarkdownRenderer content={content} />
          </div>
        ) : highlightedHtml ? (
          <div className="fp-shiki" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <pre className="fp-text">{content}</pre>
        )}
      </div>
    );
  }

  if (data.type === 'diff') {
    return <DiffView content={data.content} />;
  }

  // brain entries are rendered by BrainEntryView in App.tsx — FilePreview never receives them
  if (data.type === 'brain') return null;

  if (data.isImage) {
    const mime = getMimeType(data.ext);
    return (
      <img className="fp-image" src={`data:${mime};base64,${data.base64}`} alt="preview" style={{ maxWidth: '100%' }} />
    );
  }

  return <div className="fp-binary">Binary file ({data.ext})</div>;
}
