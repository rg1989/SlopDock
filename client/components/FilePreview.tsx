import React, { useState, useEffect } from 'react';

export type FilePreviewData =
  | { type: 'text'; content: string }
  | { type: 'binary'; isImage: true; base64: string; ext: string }
  | { type: 'binary'; isImage: false; ext: string };

interface FilePreviewProps {
  data: FilePreviewData | null;
  filePath?: string | null;
  cwd?: string | null;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token = { type: string; text: string };

type LangRule = { type: string; re: RegExp };

function buildRules(patterns: [string, string][]): LangRule[] {
  return patterns.map(([type, src]) => ({ type, re: new RegExp(src, 'y') }));
}

const LANG_RULES: Record<string, LangRule[]> = {
  js: buildRules([
    ['comment',  '//.*?(?=\\n|$)|/\\*[\\s\\S]*?\\*/'],
    ['string',   '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|\'[^\'\\\\]*(?:\\\\.[^\'\\\\]*)*\'|`[^`\\\\]*(?:\\\\.[^`\\\\]*)*`'],
    ['keyword',  '\\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|typeof|new|this|try|catch|throw|null|undefined|true|false)\\b'],
    ['number',   '\\b\\d+\\.?\\d*\\b'],
    ['property', '\\b[a-z_$][\\w$]*(?=\\s*:(?!:))'],
    ['operator', '===|!==|>=|<=|=>|\\|\\||&&|\\.\\.\\.'],
    ['plain',    '[\\s\\S]'],
  ]),
  python: buildRules([
    ['comment',  '#.*?(?=\\n|$)'],
    ['string',   '"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|\'[^\'\\\\]*(?:\\\\.[^\'\\\\]*)*\''],
    ['keyword',  '\\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|raise|pass|True|False|None|and|or|not|in|is|lambda|yield|self)\\b'],
    ['number',   '\\b\\d+\\.?\\d*\\b'],
    ['plain',    '[\\s\\S]'],
  ]),
  json: buildRules([
    ['string',  '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"'],
    ['number',  '-?\\b\\d+\\.?\\d*(?:[eE][+\\-]?\\d+)?\\b'],
    ['keyword', '\\b(true|false|null)\\b'],
    ['plain',   '[\\s\\S]'],
  ]),
  css: buildRules([
    ['comment',   '/\\*[\\s\\S]*?\\*/'],
    ['string',    '"[^"]*"|\'[^\']*\''],
    ['css-var',   '--[-\\w]+'],
    ['selector',  '\\.[-\\w]+|#[-\\w]+|[@:][-\\w]+'],
    ['property',  '[-\\w]+(?=\\s*:)'],
    ['value',     ':.*?(?=;|}|$)'],
    ['css-unit',  '\\b\\d+\\.?\\d*(?:px|em|rem|vh|vw|%|s|ms|deg)\\b'],
    ['css-func',  '\\b(?:rgb|rgba|hsl|hsla|var|calc|linear-gradient|radial-gradient)(?=\\()'],
    ['plain',     '[\\s\\S]'],
  ]),
  html: buildRules([
    ['comment',  '<!--[\\s\\S]*?-->'],
    ['tag',      '<[/!]?[-\\w]+'],
    ['attr',     '[-\\w]+='],
    ['string',   '"[^"]*"|\'[^\']*\''],
    ['close',    '>'],
    ['plain',    '[\\s\\S]'],
  ]),
  shell: buildRules([
    ['comment',  '#.*?(?=\\n|$)'],
    ['string',   '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|\'[^\']*\''],
    ['keyword',  '\\b(if|then|else|fi|for|do|done|while|case|esac|function|return|export|local|echo|cd|ls|grep|find|mkdir|rm|cp|mv)\\b'],
    ['plain',    '[\\s\\S]'],
  ]),
  markdown: buildRules([
    ['heading',    '#{1,6} [^\n]*'],
    ['bold',       '\\*\\*[^*]+\\*\\*|__[^_]+__'],
    ['italic',     '\\*[^*\n]+\\*|_[^_\n]+_'],
    ['code',       '`[^`\n]+`'],
    ['link',       '\\[[^\\]]*\\]\\([^)]*\\)'],
    ['blockquote', '>(?= )[^\n]*'],
    ['list-item',  '-(?= )|\\*(?= )|\\d+\\.(?= )'],
    ['hr',         '-{3,}|\\*{3,}|_{3,}'],
    ['plain',      '[\\s\\S]'],
  ]),
  yaml: buildRules([
    ['comment',   '#[^\n]*'],
    ['yaml-doc',  '---|\\.\\.\\.'],
    ['string',    '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|\'[^\'\\\\]*(?:\\\\.[^\'\\\\]*)*\''],
    ['yaml-bool', '\\b(?:true|false|yes|no|on|off|null|~)\\b'],
    ['number',    '-?\\b\\d+\\.?\\d*(?:[eE][+\\-]?\\d+)?\\b'],
    ['yaml-key',  '[-\\w.]+(?=\\s*:(?:\\s|$))'],
    ['yaml-list', '-(?= )'],
    ['plain',     '[\\s\\S]'],
  ]),
};

function extToLang(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.ts': case '.tsx': case '.js': case '.jsx': case '.mjs': return 'js';
    case '.py': return 'python';
    case '.json': return 'json';
    case '.css': case '.scss': return 'css';
    case '.md': case '.markdown': return 'markdown';
    case '.yml': case '.yaml': return 'yaml';
    case '.html': case '.htm': case '.xml': case '.svg': return 'html';
    case '.sh': case '.bash': case '.zsh': return 'shell';
    default: return 'plain';
  }
}

function tokenizeWith(code: string, rules: LangRule[]): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < code.length) {
    let matched = false;
    for (const rule of rules) {
      rule.re.lastIndex = pos;
      const m = rule.re.exec(code);
      if (m && m.index === pos) {
        tokens.push({ type: rule.type, text: m[0] });
        pos += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push({ type: 'plain', text: code[pos] });
      pos += 1;
    }
  }
  return tokens;
}

function tokenizeFrontmatter(code: string): Token[] | null {
  // Detect YAML frontmatter: file must start with "---\n" or "---\r\n"
  if (!code.startsWith('---\n') && !code.startsWith('---\r\n')) return null;
  // Find the closing --- line (search for \n--- after position 3)
  const rest = code.slice(3);
  const closingIdx = rest.search(/\n---(?:\r?\n|$)/);
  if (closingIdx === -1) return null;
  // frontmatter = from 0 up to and including the closing ---\n
  const fmEnd = 3 + closingIdx + 1; // position of the \n before closing ---
  // find the actual end of the closing --- line
  const afterClose = code.indexOf('\n', fmEnd + 3);
  const frontmatterEnd = afterClose === -1 ? code.length : afterClose + 1;

  const frontmatter = code.slice(0, frontmatterEnd);
  const remainder = code.slice(frontmatterEnd);

  const yamlTokens = tokenizeWith(frontmatter, LANG_RULES['yaml']);
  const mdTokens = tokenizeWith(remainder, LANG_RULES['markdown']);
  return [...yamlTokens, ...mdTokens];
}

function tokenize(code: string, ext: string): Token[] {
  const lang = extToLang(ext);
  if (lang === 'plain') return [{ type: 'plain', text: code }];

  // YAML frontmatter detection for markdown files
  if (lang === 'markdown') {
    const fmTokens = tokenizeFrontmatter(code);
    if (fmTokens) return fmTokens;
  }

  const rules = LANG_RULES[lang];
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < code.length) {
    let matched = false;
    for (const rule of rules) {
      rule.re.lastIndex = pos;
      const m = rule.re.exec(code);
      if (m && m.index === pos) {
        tokens.push({ type: rule.type, text: m[0] });
        pos += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Fallback: advance one character as plain
      tokens.push({ type: 'plain', text: code[pos] });
      pos += 1;
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    default: return 'image/png';
  }
}

function getExt(filePath: string | null | undefined): string {
  if (!filePath) return '';
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return '';
  return filePath.slice(dot);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilePreview({ data, filePath, cwd }: FilePreviewProps): React.ReactElement | null {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset edit mode when the previewed file changes
  useEffect(() => {
    setEditing(false);
    setDraft('');
  }, [data]);

  if (data === null) return null;

  if (data.type === 'text') {
    const content = data.content;
    const ext = getExt(filePath);
    const tokens = tokenize(content, ext);

    function handleEdit() {
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
              <button
                className="fp-btn primary"
                onClick={handleSave}
                disabled={saving || !filePath || !cwd}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="fp-btn" onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
            </>
          ) : (
            <button className="fp-btn" onClick={handleEdit}>
              Edit
            </button>
          )}
        </div>
        {editing ? (
          <textarea
            className="fp-edit-area"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : (
          <pre className="fp-text">
            {tokens.map((tok, i) => (
              <span key={i} className={`tok-${tok.type}`}>{tok.text}</span>
            ))}
          </pre>
        )}
      </div>
    );
  }

  if (data.isImage) {
    const mime = getMimeType(data.ext);
    return (
      <img
        className="fp-image"
        src={`data:${mime};base64,${data.base64}`}
        alt="preview"
        style={{ maxWidth: '100%' }}
      />
    );
  }

  return <div className="fp-binary">Binary file ({data.ext})</div>;
}
