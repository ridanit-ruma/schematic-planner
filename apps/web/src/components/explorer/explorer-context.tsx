import { createContext, useContext, useMemo, type ReactNode, type RefObject } from 'react';

/**
 * What a screen in the content area can ask of the explorer beside it.
 *
 * The tree is a plain read with no socket behind it, so a screen that changes
 * something the tree shows — a plan renamed on its canvas, a project renamed in
 * its settings, a plan restored from the trash — says so, and the tree catches
 * up at once instead of on the next return to the window.
 */
export interface ExplorerHandle {
  /** Reads the tree again. */
  reread: () => void;
  /** Puts a plan's new title on its row straight away. */
  renamePlan: (planId: string, title: string) => void;
  /** Opens the explorer, if it is folded away, and starts naming a new project. */
  newProject: () => void;
}

const idle: ExplorerHandle = {
  reread: () => undefined,
  renamePlan: () => undefined,
  newProject: () => undefined,
};

const ExplorerContext = createContext<ExplorerHandle>(idle);

/**
 * Provided by the shell, filled in by the explorer. A ref rather than state, so
 * a screen that calls into it does not re-render every time the tree does.
 */
export function ExplorerProvider({
  handle,
  children,
}: {
  handle: RefObject<ExplorerHandle | null>;
  children: ReactNode;
}) {
  const value = useMemo<ExplorerHandle>(
    () => ({
      reread: () => handle.current?.reread(),
      renamePlan: (planId, title) => handle.current?.renamePlan(planId, title),
      newProject: () => handle.current?.newProject(),
    }),
    [handle],
  );
  return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>;
}

/** The explorer beside this screen. Outside the shell, every call does nothing. */
export function useExplorer(): ExplorerHandle {
  return useContext(ExplorerContext);
}
