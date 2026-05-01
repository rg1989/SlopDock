import type { FC } from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmModal: FC<ConfirmModalProps> = ({ title, message, onConfirm, onCancel, loading }) => (
  <div className="modal-overlay" onClick={onCancel}>
    <div className="modal-panel confirm-panel" onClick={e => e.stopPropagation()}>
      <div className="modal-title">{title}</div>
      <div className="modal-message">{message}</div>
      <div className="modal-actions">
        <button className="modal-btn modal-btn--cancel" onClick={onCancel} disabled={loading}>Cancel</button>
        <button className="modal-btn modal-btn--danger" onClick={async () => { await onConfirm(); }} disabled={loading}>
          {loading ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);
