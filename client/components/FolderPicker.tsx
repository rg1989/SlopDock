import { useState } from 'react';

interface FolderPickerProps {
  onConnect: (cwd: string) => void;
}

export function FolderPicker({ onConnect }: FolderPickerProps) {
  const [path, setPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = path.trim();
    if (trimmed) {
      onConnect(trimmed);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        background: '#161b22',
        borderBottom: '1px solid #30363d',
      }}
    >
      <input
        type="text"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        placeholder="Enter folder path, e.g. /Users/you/myproject"
        style={{
          flex: 1,
          padding: '6px 10px',
          background: '#0d1117',
          color: '#c9d1d9',
          border: '1px solid #30363d',
          borderRadius: '6px',
          fontFamily: 'monospace',
          fontSize: '13px',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        style={{
          padding: '6px 16px',
          background: '#238636',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Connect
      </button>
    </form>
  );
}
