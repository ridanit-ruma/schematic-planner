import { useCallback, useMemo, useState } from 'react';

import { type GridStep, asStep } from './snap';

const ON_KEY = 'plan-grid';
const STEP_KEY = 'plan-grid-step';

export interface GridPreference {
  /** Whether the grid is drawn and dragging lands on it. */
  readonly on: boolean;
  readonly step: GridStep;
  readonly toggle: () => void;
  readonly choose: (step: GridStep) => void;
}

/**
 * The grid, and whether a drag lands on it.
 *
 * One switch for both, because the grid is what the snapping is: the lines are
 * the only way to see where a node is about to go, and lines that nothing lands
 * on are decoration pretending to be a tool.
 *
 * A preference of the person looking, not a property of the plan: two people
 * with the same plan open can disagree about it and both be right. So it is kept
 * in the browser rather than in the document, and a browser that refuses to
 * store it simply shows the grid. What that means for the plan is that one of
 * them writes tidy coordinates and the other writes exact ones — which is
 * already true of anyone who drags a node at all.
 */
export function useGrid(): GridPreference {
  const [on, setOn] = useState(readOn);
  const [step, setStep] = useState(readStep);

  const toggle = useCallback(() => {
    setOn((current) => {
      const next = !current;
      remember(ON_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const choose = useCallback((next: GridStep) => {
    setStep(next);
    remember(STEP_KEY, String(next));
  }, []);

  // One object, kept: the canvas hangs its drag handler off this, and a fresh
  // literal every render would rebuild that handler on every render.
  return useMemo(() => ({ on, step, toggle, choose }), [on, step, toggle, choose]);
}

/**
 * The same preference, read without a hook.
 *
 * For the places that need it once, at the moment of a gesture, rather than as
 * state to render from — a custom edge deciding where to put the bend somebody
 * has just dropped. `localStorage` is the source of truth for it, so reading it
 * there cannot go stale the way a second copy in React state would.
 */
export function readGrid(): { on: boolean; step: GridStep } {
  return { on: readOn(), step: readStep() };
}

function remember(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* A remembered preference is a convenience, not a requirement. */
  }
}

function readOn(): boolean {
  try {
    return window.localStorage.getItem(ON_KEY) !== '0';
  } catch {
    return true;
  }
}

function readStep(): GridStep {
  try {
    return asStep(window.localStorage.getItem(STEP_KEY));
  } catch {
    return asStep(null);
  }
}
