import type { SavedView, SavedViews } from '@schematic/schema';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from './api';

export interface SavedViewsRemote {
  read: (projectId: string) => Promise<SavedViews>;
  replace: (projectId: string, views: SavedViews) => Promise<SavedViews>;
}

export const savedViews: SavedViewsRemote = {
  read: (projectId) => api<SavedViews>(`/projects/${projectId}/views`),
  replace: (projectId, views) =>
    api<SavedViews>(`/projects/${projectId}/views`, {
      method: 'PUT',
      body: JSON.stringify(views),
    }),
};

/** A change, as what it does to whatever the list is by the time it is saved. */
export type ViewsEdit = (views: SavedView[]) => SavedView[];

/** How many times an edit is replayed onto somebody else's newer save. */
const REBASES = 3;

/**
 * Saves an edit to a project's views. When somebody else saved first the
 * server says 409, and the edit is replayed onto what they saved, so two
 * people saving two different views both keep theirs.
 */
export async function saveViews(
  remote: SavedViewsRemote,
  projectId: string,
  base: SavedViews,
  edit: ViewsEdit,
): Promise<SavedViews> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await remote.replace(projectId, { version: base.version, views: edit(base.views) });
    } catch (error) {
      const conflict = error instanceof ApiError && error.status === 409;
      if (!conflict || attempt >= REBASES) throw error;
      base = await remote.read(projectId);
    }
  }
}

/** The views a plan's project has saved. Null project: none, and nothing to save to. */
export function useSavedViews(projectId: string | null, remote: SavedViewsRemote = savedViews) {
  const [state, setState] = useState<{ projectId: string; views: SavedViews } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (projectId === null) return;
    let live = true;
    remote
      .read(projectId)
      .then((views) => live && setState({ projectId, views }))
      .catch((cause: unknown) => live && setError(cause));
    return () => {
      live = false;
    };
  }, [projectId, remote]);

  const current = state !== null && state.projectId === projectId ? state.views : null;

  const save = useCallback(
    async (edit: ViewsEdit): Promise<void> => {
      if (projectId === null || current === null) return;
      try {
        const views = await saveViews(remote, projectId, current, edit);
        setState({ projectId, views });
        setError(null);
      } catch (cause) {
        setError(cause);
      }
    },
    [projectId, current, remote],
  );

  return { views: current?.views ?? [], loaded: current !== null, error, save };
}
