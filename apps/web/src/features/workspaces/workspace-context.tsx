import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useParams } from 'react-router';

import { Problem, Spinner } from '@/components/ui/feedback';
import { workspaces as api, type WorkspaceSummary } from '@/lib/api';
import { useLiveList } from '@/lib/use-live-list';
import { rememberWorkspace, rememberedWorkspace, resolveWorkspace } from './current-workspace';

interface WorkspacesValue {
  readonly all: WorkspaceSummary[];
  readonly reload: () => void;
  /**
   * The one to show on a screen that does not name a workspace — your account,
   * the recent list. Where you last were, not whichever comes first.
   */
  readonly resting: WorkspaceSummary | undefined;
}

interface CurrentValue {
  readonly current: WorkspaceSummary;
}

/** Announced by the workspace a route resolved, listened for by the provider above it. */
const WORKSPACE_VISITED = 'schematic:workspace-visited';

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
  const [last, setLast] = useState(rememberedWorkspace);

  useLiveList(() => {
    api.list().then(setAll).catch(setError);
  }, [nonce]);

  // Held in state as well as in storage: the rail has to follow you into a
  // workspace, not only remember it across a reload.
  useEffect(() => {
    const onVisit = (event: Event): void => setLast((event as CustomEvent<string>).detail);
    window.addEventListener(WORKSPACE_VISITED, onVisit);
    return () => window.removeEventListener(WORKSPACE_VISITED, onVisit);
  }, []);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const value = useMemo(
    () => ({
      all: all ?? [],
      reload,
      resting: resolveWorkspace(all ?? [], undefined, last),
    }),
    [all, reload, last],
  );

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

  useEffect(() => {
    if (current === undefined) return;
    rememberWorkspace(current.slug);
    window.dispatchEvent(new CustomEvent(WORKSPACE_VISITED, { detail: current.slug }));
  }, [current]);
  const value = useMemo(() => (current === undefined ? null : { current }), [current]);

  if (value === null) return <Navigate to="/" replace />;

  return (
    <CurrentContext.Provider value={value}>
      <Outlet />
    </CurrentContext.Provider>
  );
}
