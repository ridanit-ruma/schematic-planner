import type { Position } from '@schematic/schema';

/**
 * The grid a drag lands on.
 *
 * Every step divides the 40 the layout engine spaces cards by, so a hand-placed
 * node lands on the same lattice a laid-out one would: a drawing that has been
 * tidied by hand and a drawing that has been tidied by the server do not drift
 * apart. 20 is the default because it is the fine division the canvas has always
 * drawn — switching snapping on changes where nodes land, never what is drawn.
 */
export const GRID_STEPS = [10, 20, 40, 80] as const;

export type GridStep = (typeof GRID_STEPS)[number];

export const DEFAULT_STEP: GridStep = 20;

/** The coarse division is drawn every fifth line, as it always has been. */
export const COARSE_MULTIPLE = 5;

/**
 * The nearest intersection.
 *
 * Rounds rather than floors, so a node settles on whichever line it is closer to
 * and never drifts consistently up and to the left. Negative coordinates are
 * ordinary here — the origin is wherever the first card was laid, not a corner.
 */
export function snapTo(position: Position, step: number): Position {
  return {
    x: Math.round(position.x / step) * step,
    y: Math.round(position.y / step) * step,
  };
}

/**
 * A stored preference, believed only if it is one of the offered steps.
 *
 * What comes back from `localStorage` is whatever was last written there, by
 * this version or an older one or by hand. A step of `0` would divide by zero
 * and put every node at the origin, so the value is checked rather than parsed.
 */
export function asStep(value: unknown): GridStep {
  const step = typeof value === 'string' ? Number(value) : value;
  return GRID_STEPS.find((allowed) => allowed === step) ?? DEFAULT_STEP;
}
