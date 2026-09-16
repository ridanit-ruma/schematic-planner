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
 * What the grid holds on to.
 *
 * A terminal sits at the vertical middle of a node, and nodes are not all the
 * same height — 76 for a bare card, 104 for one with a line, 420 for a full
 * one. Snapping the top-left corner therefore leaves two snapped nodes with
 * their terminals at different offsets, and the line between them has a kink in
 * it that no amount of snapping takes out.
 *
 * A preference and not a defect, so it is offered rather than decided: line the
 * boxes up, or line the wires up. Only the vertical anchor moves; horizontally
 * both snap the left edge, because that is where a node starts either way.
 */
export const GRID_ANCHORS = ['terminal', 'edge'] as const;

export type GridAnchor = (typeof GRID_ANCHORS)[number];

export const DEFAULT_ANCHOR: GridAnchor = 'terminal';

/**
 * A stored preference, believed only if it is one of the offered anchors.
 *
 * Same bargain as `asStep`: what comes back from `localStorage` is whatever was
 * last written there, by this version or an older one or by hand.
 */
export function asAnchor(value: unknown): GridAnchor {
  return GRID_ANCHORS.find((allowed) => allowed === value) ?? DEFAULT_ANCHOR;
}

/**
 * The nearest intersection.
 *
 * Rounds rather than floors, so a node settles on whichever line it is closer to
 * and never drifts consistently up and to the left. Negative coordinates are
 * ordinary here — the origin is wherever the first card was laid, not a corner.
 *
 * Under `terminal` it is the node's vertical middle that lands on a line, not
 * its corner: snap the middle and take the half-height off again. Two nodes of
 * different heights then have their terminals at the same offset, which is the
 * whole of what makes the run between them straight.
 */
export function snapTo(
  position: Position,
  step: number,
  anchor: GridAnchor = 'edge',
  height = 0,
): Position {
  const x = snapValue(position.x, step);
  if (anchor === 'edge' || height <= 0) return { x, y: snapValue(position.y, step) };
  return { x, y: snapValue(position.y + height / 2, step) - height / 2 };
}

/**
 * One coordinate on the nearest grid line.
 *
 * Separated from `snapTo` because a run of a line moves on one axis only, and
 * snapping the axis it is not moving on would drag it off the corner it shares
 * with its neighbour.
 */
export function snapValue(value: number, step: number): number {
  return Math.round(value / step) * step;
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
