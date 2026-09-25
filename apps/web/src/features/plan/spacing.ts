import type { Position, Rect } from '@schematic/schema';

/**
 * Equal spacing, the way a drawing tool keeps a row even.
 *
 * Two questions live here. While something is dragged: is there a gap already
 * on the canvas that the dragged block could repeat, and how far is it from
 * doing so? And for a selection: is it an evenly spaced row or column, and
 * where does everything go when that spacing changes or is made even?
 *
 * Everything is in plan coordinates and nothing here knows about the canvas.
 */

export type Axis = 'x' | 'y';

/**
 * A measured gap, drawn as a marker with its size written on it.
 *
 * `axis` is the direction the gap runs in: an `x` marker is a horizontal
 * span from `from` to `to`, drawn at height `at`.
 */
export interface GapMarker {
  axis: Axis;
  from: number;
  to: number;
  at: number;
  size: number;
}

export interface SpacingSnap {
  /** How far the block has to move along the axis to repeat the gap. */
  shift: number;
  /** The gap it would make, and every gap of the same size it repeats. */
  markers: GapMarker[];
}

const across = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x');
const start = (rect: Rect, axis: Axis): number => (axis === 'x' ? rect.x : rect.y);
const length = (rect: Rect, axis: Axis): number => (axis === 'x' ? rect.width : rect.height);
const end = (rect: Rect, axis: Axis): number => start(rect, axis) + length(rect, axis);
const middle = (rect: Rect, axis: Axis): number => start(rect, axis) + length(rect, axis) / 2;

/** Whether two boxes share some of their extent on the axis the gap does not run along. */
function sideBySide(one: Rect, other: Rect, axis: Axis): boolean {
  const cross = across(axis);
  return start(one, cross) < end(other, cross) && start(other, cross) < end(one, cross);
}

/** The gap from `before` to `after`, drawn through the band the two share. */
function marker(before: Rect, after: Rect, axis: Axis): GapMarker {
  const cross = across(axis);
  const low = Math.max(start(before, cross), start(after, cross));
  const high = Math.min(end(before, cross), end(after, cross));
  return {
    axis,
    from: end(before, axis),
    to: start(after, axis),
    at: low < high ? (low + high) / 2 : (middle(before, cross) + middle(after, cross)) / 2,
    size: start(after, axis) - end(before, axis),
  };
}

/** Whether `outer` holds all of `inner`. */
function encloses(outer: Rect, inner: Rect): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height
  );
}

/**
 * Whether anything in `row` sits in the open span between `from` and `to`.
 *
 * The ends of the span do not count, and nor does a box drawn around either of
 * them: a row of cards inside a group is still a row, with the group's own
 * outline running behind every gap in it.
 */
function blocked(
  row: readonly Rect[],
  axis: Axis,
  from: number,
  to: number,
  ends: readonly Rect[],
): boolean {
  return row.some(
    (other) =>
      !ends.includes(other) &&
      !ends.some((held) => encloses(other, held)) &&
      start(other, axis) < to &&
      end(other, axis) > from,
  );
}

/**
 * Gaps between neighbours that are already there.
 *
 * Only neighbours: two boxes with a third between them are not spaced by the
 * distance across the third.
 */
export function gapsIn(
  row: readonly Rect[],
  axis: Axis,
): { before: Rect; after: Rect; size: number }[] {
  const gaps: { before: Rect; after: Rect; size: number }[] = [];
  for (const before of row) {
    for (const after of row) {
      if (before === after || !sideBySide(before, after, axis)) continue;
      const from = end(before, axis);
      const to = start(after, axis);
      if (to - from <= 0) continue;
      if (blocked(row, axis, from, to, [before, after])) continue;
      gaps.push({ before, after, size: to - from });
    }
  }
  return gaps;
}

/**
 * Where a dragged block would repeat a gap already on the canvas, on one axis.
 *
 * The row is everything the block lines up with across that axis. A gap it
 * could repeat is one between two members of that row. The block may sit that
 * far after or before any neighbour in the row, or exactly between two
 * neighbours with the same gap on each side. The nearest candidate within
 * `threshold` wins, and nothing when none is.
 */
export function spacingSnap(
  moving: Rect,
  others: readonly Rect[],
  axis: Axis,
  threshold: number,
): SpacingSnap | null {
  const row = others.filter((other) => sideBySide(other, moving, axis));
  if (row.length === 0) return null;
  const sizes = gapsIn(row, axis);
  const own = length(moving, axis);
  const at = start(moving, axis);

  let best: {
    shift: number;
    placed: Rect;
    neighbours: [Rect | null, Rect | null];
    size: number;
  } | null = null;
  const offer = (target: number, size: number, before: Rect | null, after: Rect | null): void => {
    const shift = target - at;
    if (Math.abs(shift) > threshold) return;
    if (best !== null && Math.abs(shift) >= Math.abs(best.shift)) return;
    const placed = { ...moving, [axis]: target };
    // A neighbour with something else in the gap is not a neighbour.
    if (before !== null && blocked(row, axis, end(before, axis), target, [before, placed])) return;
    if (after !== null && blocked(row, axis, target + own, start(after, axis), [after, placed])) {
      return;
    }
    best = { shift, placed, neighbours: [before, after], size };
  };

  for (const neighbour of row) {
    const after = middle(moving, axis) >= middle(neighbour, axis);
    for (const gap of sizes) {
      if (after) offer(end(neighbour, axis) + gap.size, gap.size, neighbour, null);
      else offer(start(neighbour, axis) - gap.size - own, gap.size, null, neighbour);
    }
  }

  // Centred between two: the same gap either side, whatever size it comes to.
  for (const before of row) {
    for (const after of row) {
      if (before === after) continue;
      const room = start(after, axis) - end(before, axis) - own;
      if (room <= 0) continue;
      offer(end(before, axis) + room / 2, room / 2, before, after);
    }
  }

  if (best === null) return null;
  const chosen: {
    placed: Rect;
    neighbours: [Rect | null, Rect | null];
    size: number;
    shift: number;
  } = best;
  const [before, after] = chosen.neighbours;
  const markers: GapMarker[] = [];
  if (before !== null) markers.push(marker(before, chosen.placed, axis));
  if (after !== null) markers.push(marker(chosen.placed, after, axis));
  for (const gap of sizes) {
    if (Math.abs(gap.size - chosen.size) < 0.5) markers.push(marker(gap.before, gap.after, axis));
  }
  return { shift: chosen.shift, markers };
}

/** An evenly spaced row or column: its axis, its gap, and its members in order. */
export interface EvenRow {
  axis: Axis;
  gap: number;
  /** Indexes into the rects that were asked about, first to last along the axis. */
  order: number[];
}

/** How far a gap may differ from the others and still count as the same. */
const EVEN_PX = 1;

/**
 * Whether these boxes are an evenly spaced row or column.
 *
 * A row is boxes that do not overlap along the axis, each gap within a pixel of
 * the others. Two boxes are always even. When the boxes are a row one way and a
 * column the other — two cards on a diagonal — the axis they are further apart
 * on is the one meant.
 */
export function evenRow(rects: readonly Rect[]): EvenRow | null {
  if (rects.length < 2) return null;
  const found: (EvenRow & { spread: number })[] = [];

  for (const axis of ['x', 'y'] as const) {
    const order = rects
      .map((_, index) => index)
      .sort((a, b) => start(rects[a] as Rect, axis) - start(rects[b] as Rect, axis));
    const gaps: number[] = [];
    for (let index = 1; index < order.length; index += 1) {
      const before = rects[order[index - 1] as number] as Rect;
      const after = rects[order[index] as number] as Rect;
      gaps.push(start(after, axis) - end(before, axis));
    }
    if (gaps.some((gap) => gap < 0)) continue;
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (gaps.some((gap) => Math.abs(gap - mean) > EVEN_PX)) continue;
    const first = rects[order[0] as number] as Rect;
    const last = rects[order[order.length - 1] as number] as Rect;
    found.push({ axis, gap: mean, order, spread: middle(last, axis) - middle(first, axis) });
  }

  const chosen = found.sort((a, b) => b.spread - a.spread)[0];
  return chosen === undefined ? null : { axis: chosen.axis, gap: chosen.gap, order: chosen.order };
}

/**
 * Where each box goes when the row's gap becomes `gap`.
 *
 * The first box stays where it is and the rest follow it along the axis;
 * nothing moves across it. Returned in the order the rects were given.
 */
export function respace(rects: readonly Rect[], row: EvenRow, gap: number): Position[] {
  const placed: Position[] = rects.map((rect) => ({ x: rect.x, y: rect.y }));
  const first = rects[row.order[0] as number] as Rect;
  let cursor = end(first, row.axis);
  for (const index of row.order.slice(1)) {
    const rect = rects[index] as Rect;
    const at = Math.round(cursor + gap);
    placed[index] = row.axis === 'x' ? { x: at, y: rect.y } : { x: rect.x, y: at };
    cursor = at + length(rect, row.axis);
  }
  return placed;
}

/**
 * The gap a tidied selection falls back to when its members overlap: the
 * spacing the layout engine puts between cards.
 */
export const TIDY_FALLBACK_GAP = 40;

/**
 * An uneven selection spaced evenly along its longer axis, at its mean gap.
 *
 * The first box stays put and the others keep their place across the axis, so
 * a ragged row becomes an even one without anything jumping sideways. A
 * selection that overlaps itself so much that its mean gap is negative is
 * spaced at the layout's own distance instead.
 */
export function tidyUp(rects: readonly Rect[]): { row: EvenRow; positions: Position[] } | null {
  if (rects.length < 2) return null;
  const left = Math.min(...rects.map((rect) => rect.x));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const top = Math.min(...rects.map((rect) => rect.y));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  const axis: Axis = right - left >= bottom - top ? 'x' : 'y';

  const order = rects
    .map((_, index) => index)
    .sort((a, b) => middle(rects[a] as Rect, axis) - middle(rects[b] as Rect, axis));
  const first = rects[order[0] as number] as Rect;
  const last = rects[order[order.length - 1] as number] as Rect;
  const occupied = rects.reduce((sum, rect) => sum + length(rect, axis), 0);
  const mean = (end(last, axis) - start(first, axis) - occupied) / (rects.length - 1);
  const gap = mean >= 0 ? Math.round(mean) : TIDY_FALLBACK_GAP;

  const row: EvenRow = { axis, gap, order };
  return { row, positions: respace(rects, row, gap) };
}
