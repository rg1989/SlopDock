import { useState, useRef, useEffect, type FC } from 'react';

export interface AddOption {
  id: string;
  label: string;
  description: string;
  command: string;
  placeholder: string;
}

export const ADD_OPTIONS: AddOption[] = [
  {
    id: 'phase',
    label: 'Add Phase',
    description: 'Appends a new phase to the end of the current milestone roadmap.',
    command: '/gsd:add-phase',
    placeholder: 'Describe what this phase should accomplish…',
  },
  {
    id: 'insert-phase',
    label: 'Insert Phase',
    description: 'Inserts an urgent phase between existing ones as a decimal (e.g. 2.1).',
    command: '/gsd:insert-phase',
    placeholder: 'Describe the urgent work to insert between phases…',
  },
  {
    id: 'quick',
    label: 'Quick Task',
    description: 'Creates a fast, self-contained task tracked outside the main roadmap.',
    command: '/gsd:quick',
    placeholder: 'Describe the task to accomplish…',
  },
  {
    id: 'milestone',
    label: 'New Milestone',
    description: 'Archives the current milestone and begins planning the next one.',
    command: '/gsd:new-milestone',
    placeholder: 'Describe the goals for the next milestone…',
  },
];

interface GsdAddModalProps {
  option: AddOption;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export const GsdAddModal: FC<GsdAddModalProps> = ({ option, onSubmit, onCancel }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const canSubmit = text.trim().length > 0;

  const handleSubmit = () => {
    if (canSubmit) onSubmit(text.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-panel gsd-add-modal" onClick={e => e.stopPropagation()}>
        <div className="gsd-add-modal-header">
          <div className="modal-title">{option.label}</div>
          <div className="gsd-add-modal-desc">{option.description}</div>
        </div>

        <textarea
          ref={textareaRef}
          className="gsd-add-modal-input"
          placeholder={option.placeholder}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
        />

        <div className="gsd-add-modal-cmd">
          <span className="gsd-add-modal-cmd-label">Will run</span>
          <code className="gsd-add-modal-cmd-value">{option.command}</code>
          <span className="gsd-add-modal-cmd-hint">⌘↩ to start</span>
        </div>

        <div className="modal-actions">
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className="modal-btn modal-btn--start" onClick={handleSubmit} disabled={!canSubmit}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
};
