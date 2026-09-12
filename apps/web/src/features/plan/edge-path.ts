import type { Position } from '@schematic/schema';

/** Which way a line leaves or meets a node, in React Flow's terms. */
export type Side = 'left' | 'right' | 'top' | 'bottom';

/** How far a line runs straight out of a node before it is allowed to turn. */
const STUB = 12;

/**
 * A line bent through the points somebody dragged it through.
 *
 * Only used once a line has been bent by hand; an untouched line is still drawn
 * by React Flow's own smooth-step router, which knows things this does not. So
 * the job here is narrow: pass through every given point, in order, keep every
 * segment square, and meet both nodes head-on so the arrow sits flat against
 * the card rather than clipping its corner.
 *
 * Square, because the drawing is square everywhere else. A diagonal through two
 * bends would read as a different product.
 */
export function bentPath(
  source: Position,
  sourceSide: Side,
  target: Position,
  targetSide: Side,
  waypoints: readonly Position[],
  radius = 2,
): { path: string; label: Position } {
  const corners = route(source, sourceSide, target, targetSide, waypoints);
  return { path: draw(corners, radius), label: midpoint(corners) };
}

/** Outward, away from the node the line is touching. */
function outward(side: Side): Position {
  switch (side) {
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
  }
}

/**
 * The corner list, every consecutive pair differing in one axis only.
 *
 * A stub is taken out of each node first, so the leg that touches a card is
 * always along that card's own normal whatever the bends ask for. Between the
 * stubs each pair gets one elbow, turned along the longer side of the gap: the
 * shorter leg is the one that reads as the correction.
 */
function route(
  source: Position,
  sourceSide: Side,
  target: Position,
  targetSide: Side,
  waypoints: readonly Position[],
): Position[] {
  const out = outward(sourceSide);
  const into = outward(targetSide);
  const from = { x: source.x + out.x * STUB, y: source.y + out.y * STUB };
  const to = { x: target.x + into.x * STUB, y: target.y + into.y * STUB };

  const through = [from, ...waypoints, to];
  const corners: Position[] = [source, from];

  for (let index = 0; index < through.length - 1; index += 1) {
    const a = through[index] as Position;
    const b = through[index + 1] as Position;
    if (a.x === b.x || a.y === b.y) {
      corners.push(b);
      continue;
    }
    const elbow =
      Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    corners.push(elbow, b);
  }

  corners.push(target);
  return dedupe(corners);
}

/** Two corners in the same place are not a corner. */
function dedupe(points: readonly Position[]): Position[] {
  const kept: Position[] = [];
  for (const point of points) {
    const last = kept[kept.length - 1];
    if (last !== undefined && last.x === point.x && last.y === point.y) continue;
    kept.push(point);
  }
  return kept;
}

/** An SVG path along the corners, each one rounded off as far as it can be. */
function draw(corners: readonly Position[], radius: number): string {
  const first = corners[0];
  if (first === undefined) return '';
  if (corners.length === 1) return `M ${first.x},${first.y}`;

  let d = `M ${first.x},${first.y}`;
  for (let index = 1; index < corners.length - 1; index += 1) {
    const previous = corners[index - 1] as Position;
    const corner = corners[index] as Position;
    const next = corners[index + 1] as Position;
    // Never more than half of either leg, or neighbouring curves would cross
    // and the line would visibly pinch on a short segment.
    const room = Math.min(
      radius,
      distance(previous, corner) / 2,
      distance(corner, next) / 2,
    );
    if (room <= 0) {
      d += ` L ${corner.x},${corner.y}`;
      continue;
    }
    const entry = along(corner, previous, room);
    const exit = along(corner, next, room);
    d += ` L ${entry.x},${entry.y} Q ${corner.x},${corner.y} ${exit.x},${exit.y}`;
  }
  const last = corners[corners.length - 1] as Position;
  return `${d} L ${last.x},${last.y}`;
}

function distance(a: Position, b: Position): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

/** `by` pixels from `at` in the direction of `towards`. */
function along(at: Position, towards: Position, by: number): Position {
  const span = distance(at, towards);
  if (span === 0) return at;
  return {
    x: at.x + ((towards.x - at.x) / span) * by,
    y: at.y + ((towards.y - at.y) / span) * by,
  };
}

/**
 * Halfway along the line as drawn, not halfway between its ends.
 *
 * The writing goes here when nobody has placed it, and on a bent line the
 * straight-line middle can sit somewhere the line never goes.
 */
export function midpoint(corners: readonly Position[]): Position {
  const total = corners.reduce(
    (sum, point, index) => (index === 0 ? 0 : sum + distance(corners[index - 1] as Position, point)),
    0,
  );
  let walked = 0;
  for (let index = 1; index < corners.length; index += 1) {
    const a = corners[index - 1] as Position;
    const b = corners[index] as Position;
    const leg = distance(a, b);
    if (walked + leg >= total / 2) {
      const into = leg === 0 ? 0 : (total / 2 - walked) / leg;
      return { x: a.x + (b.x - a.x) * into, y: a.y + (b.y - a.y) * into };
    }
    walked += leg;
  }
  return corners[corners.length - 1] ?? { x: 0, y: 0 };
}

/**
 * Where a new bend would go if somebody grabbed this line: the middle of each
 * straight run, and nothing where two runs meet.
 *
 * Indexed by which waypoint the new one would become, so a drag can insert it
 * in the right place in the order rather than at the end, which would make the
 * line double back on itself.
 */
export function insertionPoints(
  source: Position,
  sourceSide: Side,
  target: Position,
  targetSide: Side,
  waypoints: readonly Position[],
): { at: Position; index: number }[] {
  const out = outward(sourceSide);
  const into = outward(targetSide);
  const stops = [
    { x: source.x + out.x * STUB, y: source.y + out.y * STUB },
    ...waypoints,
    { x: target.x + into.x * STUB, y: target.y + into.y * STUB },
  ];
  return stops.slice(0, -1).map((a, index) => {
    const b = stops[index + 1] as Position;
    return { at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, index };
  });
}
