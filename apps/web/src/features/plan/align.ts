import type { Rect } from '@schematic/schema';

import { snapTo, type GridAnchor } from './snap';

/**
 * A line two nodes share, as it is drawn while one of them is being dragged.
 *
 * `axis` names the coordinate that is shared: a `y` guide is a horizontal line
 * at height `at`, running from `from` to `to` along x.
 */
export interface Guide {
  axis: 'x' | 'y';
  at: number;
  from: number;
  to: number;
}

/** Start, middle and end of a box along one axis. */
function lines(rect: Rect, axis: 'x' | 'y'): number[] {
  const start = axis === 'x' ? rect.x : rect.y;
  const length = axis === 'x' ? rect.width : rect.height;
  return [start, start + length / 2, start + length];
}

/**
 * Where a dragged box would sit to share an edge or a middle with a neighbour.
 *
 * The grid alone cannot line a card up with a group: a group is as big as what
 * it holds, so its edges fall wherever that puts them, and a card snapped to the
 * grid lands beside them rather than on them. So each axis looks for the nearest
 * neighbour's edge or middle within `threshold`, and that line wins.
 *
 * `x` and `y` are the box's new corner on the axes that found one, and null on
 * the axes that did not.
 */
export function alignTo(
  moving: Rect,
  others: readonly Rect[],
  threshold: number,
): { x: number | null; y: number | null; guides: Guide[] } {
  const guides: Guide[] = [];
  const corner = { x: null as number | null, y: null as number | null };

  for (const axis of ['x', 'y'] as const) {
    let best: { shift: number; at: number } | null = null;
    const mine = lines(moving, axis);
    for (const other of others) {
      // Like with like: start to start, middle to middle, end to end. An edge
      // pulled onto somebody's middle is a snap nobody asked for.
      const theirs = lines(other, axis);
      for (let which = 0; which < theirs.length; which += 1) {
        const at = theirs[which] as number;
        const shift = at - (mine[which] as number);
        if (Math.abs(shift) > threshold) continue;
        if (best === null || Math.abs(shift) < Math.abs(best.shift)) best = { shift, at };
      }
    }
    if (best === null) continue;

    const start = (axis === 'x' ? moving.x : moving.y) + best.shift;
    corner[axis] = start;

    // Drawn across everything on that line, so the guide says what it lined up with.
    const across = axis === 'x' ? 'y' : 'x';
    const placed = { ...moving, [axis]: start };
    const sharing = [placed, ...others.filter((other) => lines(other, axis).includes(best.at))];
    guides.push({
      axis,
      at: best.at,
      from: Math.min(...sharing.map((rect) => lines(rect, across)[0] as number)),
      to: Math.max(...sharing.map((rect) => lines(rect, across)[2] as number)),
    });
  }
  return { ...corner, guides };
}

/**
 * Where a dragged node goes: a neighbour's line where one is close, the grid
 * everywhere else.
 *
 * One function for the drag and the drop, because two rules are what used to
 * move a card after it was let go: the drag snapped its corner and the drop
 * snapped its middle, and a 76px card landed 2px from where it was shown.
 */
export function place(
  raw: Rect,
  others: readonly Rect[],
  grid: { step: number; anchor: GridAnchor } | null,
  threshold: number,
  /** The height the grid holds it by: a card's own, and zero for a box. */
  anchorHeight = raw.height,
): { x: number; y: number; guides: Guide[] } {
  const snapped = grid === null ? raw : snapTo(raw, grid.step, grid.anchor, anchorHeight);
  const lined = alignTo(raw, others, threshold);
  return { x: lined.x ?? snapped.x, y: lined.y ?? snapped.y, guides: lined.guides };
}
