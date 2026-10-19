import {
  DEFAULT_MATRIX_AXES,
  EMPTY_FILTER,
  type MatrixAxes,
  type SavedView,
  type ViewFilter,
} from '@schematic/schema';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { useSavedViews } from '@/lib/saved-views';
import { PLAN_VIEWS, type PlanView } from './plan-view';

/**
 * Which way a plan is being read, kept in `?view=` so a link or a reload opens
 * it the same way: a built-in view by name, or one the project saved by its id.
 */
export function usePlanView(projectId: string | null) {
  const [params, setParams] = useSearchParams();
  const param = params.get('view');
  const saved = useSavedViews(projectId);
  const current = saved.views.find((view) => view.id === param) ?? null;
  const builtIn = PLAN_VIEWS.find((view) => view === param);
  const view: PlanView = current?.type ?? builtIn ?? 'canvas';
  // A saved view's address before the project's views arrive: wait, rather than flash the canvas.
  const pending = param !== null && builtIn === undefined && current === null && !saved.loaded;

  // Opening a saved view puts its filter on screen; changing it afterwards is an edit to save or not.
  const [filter, setFilter] = useState<ViewFilter>(EMPTY_FILTER);
  const [axes, setAxes] = useState<MatrixAxes>(DEFAULT_MATRIX_AXES);
  const [opened, setOpened] = useState<string | null>(null);
  if ((current?.id ?? null) !== opened) {
    setOpened(current?.id ?? null);
    if (current !== null) {
      setFilter(current.filter);
      setAxes(current.axes);
    }
  }

  const go = (next: string | null): void =>
    setParams(
      (search) => {
        if (next === null) search.delete('view');
        else search.set('view', next);
        return search;
      },
      { replace: true },
    );

  return {
    view,
    pending,
    current,
    filter,
    setFilter,
    axes,
    setAxes,
    saved,
    showView: (next: PlanView) => go(next === 'canvas' ? null : next),
    /** A saved view, or the view on screen unsaved when null. */
    openSaved: (next: SavedView | null) => go(next?.id ?? view),
  };
}
