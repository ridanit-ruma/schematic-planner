import type { Position } from '@schematic/schema';

/** Which way a line leaves or meets a node, in React Flow's terms. */
export type Side = 'left' | 'right' | 'top' | 'bottom';

/** How far a line runs straight out of a node before it is allowed to turn. */
const STUB = 12;

/**
 * How far a line that doubles back steps aside.
 *
 * Only needed when both ends sit at the same height: there is no midpoint
 * between them to cross at, and coming back along the height it left at would
 * draw the return leg on top of the outward one.
 */
const BYPASS = 40;

/**
 * A route, as corners, and the line drawn along them.
 *
 * Every node in this drawing has one target handle on its left and one source
 * handle on its right, so a line always leaves rightwards and arrives
 * leftwards. That makes every route an alternation — horizontal, vertical,
 * horizontal, … — beginning and ending horizontal, and it is the whole reason
 * this can be a list of corners rather than a router with opinions.
 *
 * What is stored on the edge is the interior corners. `legalize` turns whatever
 * is stored into a legal route, which is what lets a line survive a node being
 * dragged, and what lets the free points of the older bend-a-line-by-its-points
 * gesture be read without migrating anything.
 */

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

/** A straight run of a route, and the axis it may be moved along. */
export interface Run {
  readonly index: number;
  readonly axis: 'x' | 'y';
  readonly a: Position;
  readonly b: Position;
}

/**
 * The interior corners of the route, from whatever is stored on the edge.
 *
 * Total: any list of points at all comes back as a legal route. Idempotent: its
 * own output goes through unchanged, so a route written by a drag survives a
 * round trip.
 */
export function legalize(
  source: Position,
  sourceSide: Side,
  target: Position,
  targetSide: Side,
  chain: readonly Position[],
): Position[] {
  const out = outward(sourceSide);
  const into = outward(targetSide);
  const from = { x: source.x + out.x * STUB, y: source.y + out.y * STUB };
  const to = { x: target.x + into.x * STUB, y: target.y + into.y * STUB };

  const corners =
    chain.length === 0 ? fallback(source, target, from, to) : rebuild(chain, source.y, target.y);
  return clamped(corners, from, to);
}

/** The whole route, the two handles included. */
export function routeOf(
  source: Position,
  sourceSide: Side,
  target: Position,
  targetSide: Side,
  chain: readonly Position[],
): Position[] {
  return dedupe([source, ...legalize(source, sourceSide, target, targetSide, chain), target]);
}

/**
 * The route a line takes when nobody has touched it.
 *
 * A Z with its vertical run halfway between the two stubs, which is what React
 * Flow's smooth-step router drew before this one existed — so a drawing full of
 * untouched lines looks the same as it did.
 */
function fallback(source: Position, target: Position, from: Position, to: Position): Position[] {
  const ahead = to.x >= from.x;

  // Nothing to turn. This is the case a person means by "the two are on the same
  // line": there is no run to take hold of, and there should not be.
  if (ahead && source.y === target.y) return [];

  if (ahead) {
    const split = Math.round((from.x + to.x) / 2);
    return [
      { x: split, y: source.y },
      { x: split, y: target.y },
    ];
  }

  const midY = source.y === target.y ? source.y + BYPASS : Math.round((source.y + target.y) / 2);
  return [
    { x: from.x, y: source.y },
    { x: from.x, y: midY },
    { x: to.x, y: midY },
    { x: to.x, y: target.y },
  ];
}

/**
 * A stored list, rebuilt into an alternation.
 *
 * Corners are taken two at a time: each pair is one vertical run, so both of its
 * ends take the pair's first x. The run between one pair and the next is
 * horizontal, so both of its ends take one y. Then the first and last corners
 * are pinned to the handle heights, because the legs that touch a card are
 * horizontal whatever is stored — that pinning is what keeps a route square when
 * a node is dragged, and it means nothing has to carry the corners along.
 */
function rebuild(chain: readonly Position[], sourceY: number, targetY: number): Position[] {
  // An odd corner is a vertical run with nothing to pair it with — an old free
  // point, most likely. Repeating it makes it that run, which keeps the x
  // somebody chose and throws away only the y, which the alternation decides.
  const padded = chain.length % 2 === 0 ? chain : [...chain, chain[chain.length - 1] as Position];

  const corners: Position[] = [];
  for (let pair = 0; pair * 2 < padded.length; pair += 1) {
    const a = padded[pair * 2] as Position;
    const b = padded[pair * 2 + 1] as Position;
    corners.push({ x: a.x, y: a.y }, { x: a.x, y: b.y });
  }

  for (let pair = 1; pair * 2 < corners.length; pair += 1) {
    const before = corners[pair * 2 - 1] as Position;
    const at = corners[pair * 2] as Position;
    corners[pair * 2] = { x: at.x, y: before.y };
  }

  const first = corners[0] as Position;
  const last = corners[corners.length - 1] as Position;
  corners[0] = { x: first.x, y: sourceY };
  corners[corners.length - 1] = { x: last.x, y: targetY };
  return corners;
}

/**
 * A vertical run is held between the two stubs, so a line cannot be pushed
 * behind a card and arrive backwards.
 *
 * Only where there is room between them. A line that doubles back has its runs
 * outside that span by design, and clamping it would fold the route onto itself.
 *
 * This happens on the way to being drawn and never on the way to being stored:
 * dragging a node past a hand-placed run and back again has to return the line
 * to where its owner put it.
 */
function clamped(corners: readonly Position[], from: Position, to: Position): Position[] {
  if (to.x < from.x) return corners.map((corner) => ({ ...corner }));
  return corners.map((corner) => ({
    x: Math.min(Math.max(corner.x, from.x), to.x),
    y: corner.y,
  }));
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
export function pathOf(route: readonly Position[], radius = 2): string {
  const first = route[0];
  if (first === undefined) return '';
  if (route.length === 1) return `M ${first.x},${first.y}`;

  let d = `M ${first.x},${first.y}`;
  for (let index = 1; index < route.length - 1; index += 1) {
    const previous = route[index - 1] as Position;
    const corner = route[index] as Position;
    const next = route[index + 1] as Position;
    // Never more than half of either leg, or neighbouring curves would cross and
    // the line would visibly pinch on a short segment.
    const room = Math.min(radius, distance(previous, corner) / 2, distance(corner, next) / 2);
    if (room <= 0) {
      d += ` L ${corner.x},${corner.y}`;
      continue;
    }
    const entry = along(corner, previous, room);
    const exit = along(corner, next, room);
    d += ` L ${entry.x},${entry.y} Q ${corner.x},${corner.y} ${exit.x},${exit.y}`;
  }
  const last = route[route.length - 1] as Position;
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
 * The runs of a route somebody may take hold of.
 *
 * Not the first and not the last: those two touch a card and their position is
 * the handle's, so a hit area over them would be a control that does nothing.
 * Leaving them bare is also how the cursor says which parts of a line move.
 */
export function movableSegments(route: readonly Position[]): Run[] {
  const runs: Run[] = [];
  for (let index = 1; index < route.length - 2; index += 1) {
    const a = route[index] as Position;
    const b = route[index + 1] as Position;
    if (a.x === b.x && a.y === b.y) continue;
    runs.push({ index, axis: a.x === b.x ? 'x' : 'y', a, b });
  }
  return runs;
}

/**
 * One run moved to `to` on its own axis, as interior corners ready to store.
 *
 * Both ends of the run go together and nothing is inserted or removed, so the
 * number of corners is the same before and after. That is what lets a drag hold
 * on to the same hit area from the moment it starts to the moment it is let go.
 *
 * `to` is a position rather than a distance so that the grid can be applied to
 * it directly, and so a long drag cannot accumulate rounding error.
 */
export function dragSegment(route: readonly Position[], index: number, to: number): Position[] {
  const moved = route.map((point) => ({ ...point }));
  const a = moved[index];
  const b = moved[index + 1];
  if (a === undefined || b === undefined) return moved.slice(1, -1);
  if (a.x === b.x) {
    a.x = to;
    b.x = to;
  } else {
    a.y = to;
    b.y = to;
  }
  return moved.slice(1, -1);
}

/**
 * Which run a point belongs to — the writing on a line, in practice.
 *
 * Measured to the run itself rather than to its ends: nearest-endpoint gets it
 * wrong exactly in the middle of a long run, which is where a label usually is.
 */
export function segmentOfLabel(route: readonly Position[], at: Position): number {
  let best = 0;
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < route.length - 1; index += 1) {
    const span = distanceToSegment(at, route[index] as Position, route[index + 1] as Position);
    if (span < nearest) {
      nearest = span;
      best = index;
    }
  }
  return best;
}

/** How far a point sits from a segment, not from its nearer end. */
function distanceToSegment(point: Position, a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  if (length === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  // How far along ab the point projects, clamped to the segment itself.
  const along = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + along * dx), point.y - (a.y + along * dy));
}

/**
 * Where the writing on a line sits.
 *
 * On the line — worked out from the route that is actually drawn, every render,
 * with nothing stored. The writing used to be placed at a point ELK recorded
 * when it laid the plan out, which is ELK's own routing through ELK's own
 * channels and ports, and not the line this file draws. Nothing reconciled
 * them, so on a freshly arranged canvas the notes floated well clear of the
 * flows they belonged to: they were sitting on a line in a picture nobody sees.
 *
 * The middle run, counted along the route, because it is the same run whatever
 * the line is doing. The longest one was the obvious choice and the wrong one:
 * which run is longest changes as soon as somebody drags one, so the writing
 * hopped to a different leg of the line in the middle of the gesture that was
 * supposed to be carrying it. A run named by its place in the route cannot move
 * out from under it.
 *
 * `share` then keeps the notes of several flows leaving one node off each
 * other, in two ways at once — and it takes both.
 *
 * **Along the run**, so they read as a column down a corridor rather than a
 * pile at its middle: one lands at a half, two at a third and two thirds,
 * three at a quarter, a half and three quarters.
 *
 * **Across it**, by a row each, because along is not enough on its own. Two
 * flows out of one node into two others are two different lines, and their
 * middle runs are often parallel and level — so two notes fifteen pixels
 * apart along a run still sat on top of each other, being a hundred wide. A
 * row of clearance is a guarantee; a fraction of a run somebody else's line
 * happens to share is not.
 */
const NOTE_ROW = 22;

export function labelAt(
  route: readonly Position[],
  share: { of: number; index: number } = { of: 1, index: 0 },
): Position {
  if (route.length < 2) return route[0] ?? { x: 0, y: 0 };

  // Rounded down, so a line with one run takes that one and a line with three
  // takes the connecting run between the two that are pinned to their handles.
  const run = Math.floor((route.length - 1) / 2);
  const best = { from: route[run] as Position, to: route[run + 1] as Position };

  const along = (share.index + 1) / (share.of + 1);
  const on = {
    x: best.from.x + (best.to.x - best.from.x) * along,
    y: best.from.y + (best.to.y - best.from.y) * along,
  };

  // Centred on the run, so one note sits exactly on it and a pair straddle it.
  const across = (share.index - (share.of - 1) / 2) * NOTE_ROW;
  const upright = Math.abs(best.to.y - best.from.y) > Math.abs(best.to.x - best.from.x);
  return upright ? { x: on.x + across, y: on.y } : { x: on.x, y: on.y + across };
}
