import type { ProjectHealth } from '../hooks/useProjectHealth';

interface HealthStatusBarProps {
  health: ProjectHealth;
}

interface DotSpec {
  key: string;
  label: string;
  status: 'ok' | 'warn' | 'error' | 'loading';
}

export function HealthStatusBar({ health }: HealthStatusBarProps) {
  if (health.loading) {
    return (
      <div className="health-bar">
        {['dir', 'git', 'agent'].map(k => (
          <span
            key={k}
            className="health-dot health-dot--loading"
            title="Checking..."
          />
        ))}
      </div>
    );
  }

  const dots: DotSpec[] = [
    {
      key: 'dir',
      label: health.dirAccessible ? 'Directory accessible' : 'Directory not accessible',
      status: health.dirAccessible ? 'ok' : 'error',
    },
    {
      key: 'git',
      label: health.isGitRepo ? 'Git repo' : 'Not a git repo',
      status: health.isGitRepo ? 'ok' : 'warn',
    },
    {
      key: 'claude-md',
      label: health.hasClaudeMd ? 'CLAUDE.md present' : 'CLAUDE.md missing',
      status: health.hasClaudeMd ? 'ok' : 'warn',
    },
    {
      key: 'agent',
      label: health.agentFound
        ? `Agent found: ${health.agentPath}`
        : 'Agent CLI not found in PATH',
      status: health.agentFound ? 'ok' : 'error',
    },
  ];

  if (health.hasNodeModules !== null) {
    dots.push({
      key: 'node-modules',
      label: health.hasNodeModules ? 'node_modules present' : 'node_modules missing — run npm install',
      status: health.hasNodeModules ? 'ok' : 'warn',
    });
  }

  const allGreen = dots.every(d => d.status === 'ok');
  if (allGreen) return null;

  return (
    <div className="health-bar">
      {dots.map(d => (
        <span
          key={d.key}
          className={`health-dot health-dot--${d.status}`}
          title={d.label}
        />
      ))}
      <span className="health-label">setup issues</span>
    </div>
  );
}
