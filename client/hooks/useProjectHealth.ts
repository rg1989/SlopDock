import { useState, useEffect } from 'react';

export interface ProjectHealth {
  loading: boolean;
  dirAccessible: boolean;
  isGitRepo: boolean;
  hasClaudeMd: boolean;
  agentFound: boolean;
  agentPath: string | null;
  hasNodeModules: boolean | null;
}

const INITIAL: ProjectHealth = {
  loading: false,
  dirAccessible: false,
  isGitRepo: false,
  hasClaudeMd: false,
  agentFound: false,
  agentPath: null,
  hasNodeModules: null,
};

export function useProjectHealth(
  cwd: string | null,
  agentCommand = 'claude'
): ProjectHealth {
  const [health, setHealth] = useState<ProjectHealth>(INITIAL);

  useEffect(() => {
    if (!cwd) {
      setHealth(INITIAL);
      return;
    }

    setHealth(prev => ({ ...prev, loading: true }));

    const timer = setTimeout(() => {
      const url = `/api/project-health?cwd=${encodeURIComponent(cwd)}&agent=${encodeURIComponent(agentCommand)}`;
      fetch(url)
        .then(r => r.json())
        .then((data: Omit<ProjectHealth, 'loading'>) =>
          setHealth({ loading: false, ...data })
        )
        .catch(() => setHealth(prev => ({ ...prev, loading: false })));
    }, 100);

    return () => clearTimeout(timer);
  }, [cwd, agentCommand]);

  return health;
}
