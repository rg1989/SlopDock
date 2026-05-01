import { useState, useEffect, useCallback, type FC } from 'react';
import { ConfirmModal } from './ConfirmModal';

interface GsdPlan {
  id: string;
  name: string;
  completed: boolean;
  planPath: string | null;
  summaryPath: string | null;
}

interface GsdPhase {
  number: number;
  name: string;
  goal: string;
  completed: boolean;
  dirName: string;
  researchPath: string | null;
  verificationPath: string | null;
  plans: GsdPlan[];
}

interface GsdQuickTask {
  number: number;
  description: string;
  date: string;
  completed: boolean;
  dirName: string;
  planPath: string | null;
}

interface GsdRoadmapData {
  exists: true;
  milestone: string;
  milestoneName: string;
  status: string;
  progress: { totalPhases: number; completedPhases: number; totalPlans: number; completedPlans: number; percent: number };
  phases: GsdPhase[];
  quickTasks: GsdQuickTask[];
}

type RoadmapResponse = { exists: false } | GsdRoadmapData;

interface GsdRoadmapProps {
  cwd: string;
  onOpenFile: (path: string, isPreview: boolean) => void;
}

const IconCheck = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconBolt = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const IconMap = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
    <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
  </svg>
);

const IconTrashSm = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

function statusColor(status: string): string {
  if (status === 'completed') return '#d4845a';
  if (status === 'in-progress') return '#d4845a';
  return '#484f58';
}

function phaseStatusLabel(phase: GsdPhase): string {
  if (phase.completed) return 'Complete';
  const done = phase.plans.filter(p => p.completed).length;
  if (done > 0) return `${done}/${phase.plans.length} plans`;
  return 'Planned';
}

function phaseColor(phase: GsdPhase): string {
  if (phase.completed) return '#d4845a';
  const done = phase.plans.filter(p => p.completed).length;
  if (done > 0) return '#d4845a';
  return '#484f58';
}

export const GsdRoadmap: FC<GsdRoadmapProps> = ({ cwd, onOpenFile }) => {
  const [data, setData] = useState<RoadmapResponse | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{
    label: string;
    endpoint: string;
    body: Record<string, unknown>;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadRoadmap = useCallback(() => {
    setData(null);
    fetch(`/api/gsd-roadmap?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(d => {
        setData(d as RoadmapResponse);
        if (d.exists) {
          const rd = d as GsdRoadmapData;
          // Always collapse completed phases; only active ones stay expanded
          const toCollapse = new Set(rd.phases.filter((p: GsdPhase) => p.completed).map((p: GsdPhase) => p.number));
          setCollapsed(toCollapse);
        }
      })
      .catch(() => setData({ exists: false }));
  }, [cwd]);

  useEffect(() => { loadRoadmap(); }, [loadRoadmap]);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteLoading(true);
    try {
      await fetch(pendingDelete.endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingDelete.body),
      });
      loadRoadmap();
    } catch { /* ignore */ } finally {
      setDeleteLoading(false);
      setPendingDelete(null);
    }
  };

  const toggleCollapse = (num: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num); else next.add(num);
      return next;
    });
  };

  const openFile = (filePath: string | null) => {
    if (filePath) onOpenFile(filePath, true);
  };

  if (data === null) {
    return (
      <div className="rm-loading">
        <div className="rm-loading-dots">
          <span /><span /><span />
        </div>
      </div>
    );
  }

  if (!data.exists) {
    return (
      <div className="rm-empty">
        <div className="rm-empty-icon"><IconMap /></div>
        <div className="rm-empty-title">No GSD Roadmap found</div>
        <div className="rm-empty-body">
          This panel shows your project's development roadmap when a <code>.planning/</code> directory is present.
        </div>
        <div className="rm-empty-hint">
          To get started, open Claude Code in this folder and run:
          <code className="rm-empty-cmd">/gsd:new-project</code>
        </div>
      </div>
    );
  }

  const rd = data as GsdRoadmapData;
  const { milestone, milestoneName, status, progress, phases, quickTasks } = rd;
  const pct = progress.percent || (progress.totalPlans > 0 ? Math.round((progress.completedPlans / progress.totalPlans) * 100) : 0);
  const color = statusColor(status);

  return (
    <div className="rm-root">
      {/* ── Milestone header ── */}
      <div className="rm-header">
        <div className="rm-milestone-row">
          <span className="rm-milestone-badge" style={{ borderColor: color, color }}>
            {milestone || 'v?'}
          </span>
          <span className="rm-milestone-name">{milestoneName || 'Milestone'}</span>
          <span className="rm-status-dot" style={{ background: color }} title={status} />
        </div>
        <div className="rm-progress-bar-wrap">
          <div className="rm-progress-bar">
            <div className="rm-progress-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
          <span className="rm-progress-pct" style={{ color }}>{pct}%</span>
        </div>
        <div className="rm-progress-stats">
          {progress.completedPlans}/{progress.totalPlans} plans · {progress.completedPhases}/{progress.totalPhases} phases
        </div>
      </div>

      {/* ── Quick Tasks ── */}
      {quickTasks.length > 0 && (
        <div className="rm-quick-section">
          <div className="rm-quick-header">
            <IconBolt />
            <span>Quick Tasks</span>
            <span className="rm-quick-count">{quickTasks.filter(q => q.completed).length}/{quickTasks.length}</span>
          </div>
          <div className="rm-quick-list">
            {quickTasks.map(task => (
              <div
                key={task.number}
                className={`rm-quick-item${task.planPath ? ' rm-quick-item--link' : ''}`}
                onClick={() => openFile(task.planPath)}
                title={task.planPath ? 'Open plan in editor' : undefined}
              >
                <span className={`rm-plan-check${task.completed ? ' rm-plan-check--done' : ''}`}>
                  {task.completed ? <IconCheck /> : null}
                </span>
                <span className="rm-quick-num">{task.number}</span>
                <span className="rm-quick-desc">{task.description}</span>
                {task.date && <span className="rm-quick-date">{task.date.slice(5)}</span>}
                <div className="rm-item-actions" onClick={e => {
                  e.stopPropagation();
                  setPendingDelete({ label: `Quick task ${task.number}: ${task.description}`, endpoint: '/api/gsd/quick', body: { cwd, dirName: task.dirName, num: task.number } });
                }}>
                  <button className="rm-delete-btn" title="Delete quick task"><IconTrashSm /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Phase timeline ── */}
      <div className="rm-timeline">
        {phases.map((phase) => {
          const isOpen = !collapsed.has(phase.number);
          const pc = phaseColor(phase);
          const completedPlans = phase.plans.filter(p => p.completed).length;

          return (
            <div key={phase.number} className="rm-phase-wrap">
              {/* Phase node */}
              <div className="rm-phase-row" onClick={() => toggleCollapse(phase.number)}>
                <div className="rm-phase-track">
                  <div className="rm-phase-dot" style={{ borderColor: pc, background: phase.completed ? pc : 'transparent' }}>
                    {phase.completed && <IconCheck />}
                  </div>
                  <div className="rm-phase-line" />
                </div>
                <div className="rm-phase-body">
                  <div className="rm-phase-top">
                    <span className="rm-phase-num" style={{ color: pc }}>Phase {phase.number}</span>
                    <span className="rm-phase-chevron"><IconChevron open={isOpen} /></span>
                  </div>
                  <div className="rm-phase-name">{phase.name}</div>
                  <div className="rm-phase-meta" style={{ color: pc }}>
                    {phaseStatusLabel(phase)}
                    {phase.plans.length > 0 && ` · ${completedPlans}/${phase.plans.length}`}
                  </div>
                </div>
                <div className="rm-item-actions" onClick={e => {
                  e.stopPropagation();
                  setPendingDelete({ label: `Phase ${phase.number}: ${phase.name}`, endpoint: '/api/gsd/phase', body: { cwd, phase: phase.number } });
                }}>
                  <button className="rm-delete-btn" title="Delete phase"><IconTrashSm /></button>
                </div>
              </div>

              {/* Plans list */}
              {isOpen && (
                <div className="rm-plans-wrap">
                  <div className="rm-plans-track">
                    <div className="rm-plans-line" />
                  </div>
                  <div className="rm-plans-list">
                    {phase.goal && (
                      <div className="rm-phase-goal">{phase.goal}</div>
                    )}
                    {phase.plans.map(plan => (
                      <div
                        key={plan.id}
                        className={`rm-plan-item${plan.planPath ? ' rm-plan-item--link' : ''}`}
                        onClick={() => openFile(plan.planPath)}
                        title={plan.planPath ? 'Open plan in editor' : undefined}
                      >
                        <span className={`rm-plan-check${plan.completed ? ' rm-plan-check--done' : ''}`}>
                          {plan.completed ? <IconCheck /> : null}
                        </span>
                        <span className="rm-plan-id">{plan.id}</span>
                        <span className="rm-plan-name">{plan.name}</span>
                        <div className="rm-item-actions" onClick={e => {
                          e.stopPropagation();
                          setPendingDelete({ label: `Plan ${plan.id}`, endpoint: '/api/gsd/plan', body: { cwd, phaseNum: phase.number, planId: plan.id } });
                        }}>
                          <button className="rm-delete-btn" title="Delete plan"><IconTrashSm /></button>
                        </div>
                      </div>
                    ))}
                    {phase.researchPath && (
                      <div className="rm-phase-docs">
                        <button className="rm-doc-link" onClick={() => openFile(phase.researchPath)}>Research</button>
                        {phase.verificationPath && (
                          <button className="rm-doc-link" onClick={() => openFile(phase.verificationPath)}>Verification</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pendingDelete && (
        <ConfirmModal
          title="Delete permanently"
          message={`"${pendingDelete.label}" will be permanently removed. This cannot be undone.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
};
