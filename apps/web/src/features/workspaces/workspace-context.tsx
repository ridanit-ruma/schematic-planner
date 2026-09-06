import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useParams } from 'react-router';

import { Problem, Spinner } from '@/components/ui/feedback';
import { workspaces as api, type WorkspaceSummary } from '@/lib/api';

interface WorkspacesValue {
  readonly all: WorkspaceSummary[];
  readonly reload: () => void;
}

interface CurrentValue {
  readonly current: WorkspaceSummary;
}

const WorkspacesContext = createContext<WorkspacesValue | null>(null);
const CurrentContext = createContext<CurrentValue | null>(null);

export function useWorkspaces(): WorkspacesValue {
  const value = useContext(WorkspacesContext);
  if (value === null) throw new Error('useWorkspaces outside the provider');
  return value;
}

/** The workspace named in the address bar. Only valid under WorkspaceLayout. */
export function useWorkspace(): WorkspacesValue & CurrentValue {
  const list = useWorkspaces();
  const current = useContext(CurrentContext);
  if (current === null) throw new Error('useWorkspace outside a workspace route');
  return { ...list, ...current };
}

/**
 * Loads the caller's workspaces once, above everything that needs them. The
 * switcher in the header and the workspace a page is showing then read the same
 * list and cannot disagree.
 */
export function WorkspacesProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<WorkspaceSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    api.list().then(setAll).catch(setError);
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const value = useMemo(() => ({ all: all ?? [], reload }), [all, reload]);

  if (error !== null) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <Problem error={error} />
      </div>
    );
  }
  if (all === null) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }

  return <WorkspacesContext.Provider value={value}>{children}</WorkspacesContext.Provider>;
}

/** Resolves the slug in the address bar. The workspace's sections live in the rail. */
export function WorkspaceLayout() {
  const { workspaceSlug = '' } = useParams();
  const { all } = useWorkspaces();

  const current = useMemo(
    () => all.find((workspace) => workspace.slug === workspaceSlug),
    [all, workspaceSlug],
  );
  const value = useMemo(() => (current === undefined ? null : { current }), [current]);

  if (value === null) return <Navigate to="/" replace />;

  return (
    <CurrentContext.Provider value={value}>
      <Outlet />
    </CurrentContext.Provider>
  );
}
