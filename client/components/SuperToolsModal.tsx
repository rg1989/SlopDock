import { useState } from 'react';

interface SuperToolsModalProps {
  cwd: string | null;
  onClose: () => void;
  onRunDirect: (command: string) => void;
  onRunWithGsd: (tool: SuperTool) => Promise<void>;
}

export interface SuperTool {
  id: string;
  /** Short label shown in the card header */
  name: string;
  /** One-line slug used as the GSD phase name */
  phaseName: string;
  /** Rich paragraph written into the GSD phase Goal — makes the roadmap entry meaningful */
  phaseDescription: string;
  /** Slash command sent to the terminal for direct invocation */
  directCommand: string;
  Icon: () => JSX.Element;
}

const IconArch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="9" y1="21" x2="9" y2="9"/>
  </svg>
);

export const SUPER_TOOLS: SuperTool[] = [
  {
    id: 'improve-arch',
    name: 'Improve Codebase Architecture',
    phaseName: 'Improve Codebase Architecture',
    phaseDescription:
      'Multi-step automated architectural analysis of the codebase: surfaces structural coupling hotspots, identifies over-abstracted or under-abstracted module boundaries, removes dead or redundant code paths, and applies concrete refactors with full test coverage. Produces a structured improvement report and commits all changes atomically.',
    directCommand: '/improve-codebase-architecture',
    Icon: IconArch,
  },
];

export function SuperToolsModal({ cwd, onClose, onRunDirect, onRunWithGsd }: SuperToolsModalProps) {
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleGsd = async (tool: SuperTool) => {
    setRunningId(tool.id);
    try {
      await onRunWithGsd(tool);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel st-modal" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <div className="st-modal-title-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span className="modal-title">Super Tools</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <p className="st-intro">
            Heavy multi-step workflow tools. <strong>Direct</strong> runs the skill immediately.{' '}
            <strong>Via GSD</strong> creates a tracked phase in your roadmap, runs the same skill,
            then marks the phase complete automatically when Claude finishes.
          </p>

          {SUPER_TOOLS.map((tool) => {
            const isRunning = runningId === tool.id;
            return (
              <div key={tool.id} className="st-card">
                <div className="st-card-header">
                  <div className="st-card-icon"><tool.Icon /></div>
                  <span className="st-card-name">{tool.name}</span>
                </div>
                <p className="st-card-desc">{tool.phaseDescription}</p>
                <div className="st-card-actions">
                  <button
                    className="st-btn"
                    disabled={isRunning}
                    onClick={() => { onRunDirect(tool.directCommand); }}
                    title="Send command directly — faster, no roadmap record"
                  >
                    Run Direct
                  </button>
                  <button
                    className="st-btn st-btn--gsd"
                    disabled={isRunning || !cwd}
                    onClick={() => handleGsd(tool)}
                    title={cwd ? 'Create a GSD phase, run the skill, auto-mark complete when done' : 'Open a folder first'}
                  >
                    {isRunning ? 'Starting…' : '⚡ Run via GSD'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
