import { describe, expect, it } from 'vitest';

import { labelAt, legalize, midpoint, pathOf, routeOf, type Side } from './edge-path';

const source = { x: 0, y: 0 };
const target = { x: 400, y: 200 };
const level = { x: 400, y: 0 };

/** Every corner the path visits, read back out of the `d` string. */
function corners(path: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (const match of path.matchAll(/[MLQ] ([-\d.]+),([-\d.]+)(?: ([-\d.]+),([-\d.]+))?/g)) {
    points.push({ x: Number(match[1]), y: Number(match[2]) });
    if (match[3] !== undefined) points.push({ x: Number(match[3]), y: Number(match[4]) });
  }
  return points;
}

/** Every consecutive pair differs on one axis only. */
function square(route: readonly { x: number; y: number }[]): boolean {
  for (let index = 1; index < route.length; index += 1) {
    const a = route[index - 1]!;
    const b = route[index]!;
    if (a.x !== b.x && a.y !== b.y) return false;
  }
  return true;
}

const route = (chain: { x: number; y: number }[], to = target) =>
  routeOf(source, 'right' as Side, to, 'left' as Side, chain);

describe('the default route', () => {
  it('is one straight run when both ends sit at the same height', () => {
    expect(route([], level)).toEqual([source, level]);
  });

  it('is a Z split midway between the two stubs', () => {
    // Stubs at x = 12 and x = 388, so the vertical run sits at 200.
    expect(route([])).toEqual([source, { x: 200, y: 0 }, { x: 200, y: 200 }, target]);
  });

  it('steps around a line that doubles back', () => {
    const behind = { x: -300, y: 200 };
    expect(route([], behind)).toEqual([
      source,
      { x: 12, y: 0 },
      { x: 12, y: 100 },
      { x: -312, y: 100 },
      { x: -312, y: 200 },
      behind,
    ]);
  });

  it('steps aside rather than back over itself when a doubling-back line is level', () => {
    const drawn = route([], { x: -300, y: 0 });
    expect(square(drawn)).toBe(true);
    expect(drawn.some((point) => point.y !== 0)).toBe(true);
  });
});

describe('legalising what is stored', () => {
  it('leaves a route it produced itself alone', () => {
    const once = legalize(source, 'right', target, 'left', [
      { x: 150, y: 0 },
      { x: 150, y: 200 },
    ]);
    expect(once).toEqual([
      { x: 150, y: 0 },
      { x: 150, y: 200 },
    ]);
    expect(legalize(source, 'right', target, 'left', once)).toEqual(once);
  });

  it('keeps an old free point as the split of a clean Z', () => {
    expect(legalize(source, 'right', target, 'left', [{ x: 137, y: 43 }])).toEqual([
      { x: 137, y: 0 },
      { x: 137, y: 200 },
    ]);
  });

  it('pins the first and last corners to the handle heights, however the node moved', () => {
    const moved = { x: 400, y: -90 };
    const drawn = legalize(source, 'right', moved, 'left', [
      { x: 150, y: 999 },
      { x: 150, y: 888 },
    ]);
    expect(drawn[0]?.y).toBe(0);
    expect(drawn[drawn.length - 1]?.y).toBe(-90);
  });

  it('returns a square route for any list of points at all', () => {
    const junk = [
      [{ x: 5, y: 5 }],
      [
        { x: 5, y: 5 },
        { x: -60, y: 900 },
        { x: 12, y: 3 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
    ];
    for (const chain of junk) {
      const drawn = route(chain);
      expect(square(drawn)).toBe(true);
      expect(drawn[0]).toEqual(source);
      expect(drawn[drawn.length - 1]).toEqual(target);
      // The legs that touch a card run along the card's own normal.
      expect(drawn[1]?.y).toBe(source.y);
      expect(drawn[drawn.length - 2]?.y).toBe(target.y);
    }
  });

  it('holds a vertical run between the two stubs when a node is dragged past it', () => {
    const near = { x: 60, y: 200 };
    const drawn = legalize(source, 'right', near, 'left', [
      { x: 900, y: 0 },
      { x: 900, y: 200 },
    ]);
    // The target's stub is at x = 48, so the run cannot go beyond it.
    expect(drawn.every((corner) => corner.x <= 48)).toBe(true);
    expect(drawn.every((corner) => corner.x >= 12)).toBe(true);
  });

  it('does not clamp a line that doubles back, whose runs sit outside that span by design', () => {
    const behind = { x: -300, y: 200 };
    const drawn = legalize(source, 'right', behind, 'left', [
      { x: 80, y: 0 },
      { x: 80, y: 100 },
      { x: -400, y: 100 },
      { x: -400, y: 200 },
    ]);
    expect(drawn[0]?.x).toBe(80);
    expect(drawn[3]?.x).toBe(-400);
  });
});

describe('the drawn path', () => {
  it('starts at the source and ends at the target', () => {
    const path = pathOf(route([{ x: 200, y: 100 }]));
    expect(path.startsWith('M 0,0')).toBe(true);
    expect(path.endsWith('L 400,200')).toBe(true);
  });

  it('keeps every leg square, with rounding allowed only at a corner', () => {
    const visited = corners(pathOf(route([{ x: 137, y: 43 }])));
    for (let index = 1; index < visited.length; index += 1) {
      const a = visited[index - 1]!;
      const b = visited[index]!;
      const straight = a.x === b.x || a.y === b.y;
      const tiny = Math.abs(b.x - a.x) <= 2 && Math.abs(b.y - a.y) <= 2;
      expect(straight || tiny).toBe(true);
    }
  });

  it('draws a line nobody has touched without complaint', () => {
    const path = pathOf(route([]));
    expect(path).not.toContain('NaN');
    expect(path).not.toContain('Infinity');
  });
});

describe('where the writing goes', () => {
  it('is halfway along the line, not halfway between the ends', () => {
    const at = midpoint([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 40 },
    ]);
    expect(at.x).toBeCloseTo(220);
    expect(at.y).toBeCloseTo(0);
  });

  it('copes with a path of no length', () => {
    expect(midpoint([{ x: 7, y: 7 }])).toEqual({ x: 7, y: 7 });
    expect(midpoint([])).toEqual({ x: 0, y: 0 });
  });
});

import { dragSegment, movableSegments, segmentOfLabel } from './edge-path';

describe('which runs of a line can be moved', () => {
  it('offers none on a line with nothing to turn', () => {
    expect(movableSegments(route([], level))).toEqual([]);
  });

  it('offers the one vertical run of a Z, moving sideways', () => {
    const runs = movableSegments(route([]));
    expect(runs).toHaveLength(1);
    expect(runs[0]?.axis).toBe('x');
    expect(runs[0]?.index).toBe(1);
  });

  it('offers three on a line that doubles back, the middle one moving up and down', () => {
    const runs = movableSegments(route([], { x: -300, y: 200 }));
    expect(runs.map((run) => run.axis)).toEqual(['x', 'y', 'x']);
  });

  it('never offers a run that touches a card', () => {
    const drawn = route([]);
    const runs = movableSegments(drawn);
    expect(runs.every((run) => run.index > 0 && run.index < drawn.length - 2)).toBe(true);
  });
});

describe('moving a run', () => {
  it('takes both ends of a vertical run sideways and leaves everything else', () => {
    expect(dragSegment(route([]), 1, 260)).toEqual([
      { x: 260, y: 0 },
      { x: 260, y: 200 },
    ]);
  });

  it('takes both ends of a horizontal run up and down', () => {
    const after = dragSegment(route([], { x: -300, y: 200 }), 2, 160);
    expect(after[1]).toEqual({ x: 12, y: 160 });
    expect(after[2]).toEqual({ x: -312, y: 160 });
  });

  it('never changes how many corners there are', () => {
    const drawn = route([]);
    expect(dragSegment(drawn, 1, 999)).toHaveLength(drawn.length - 2);
  });
});

describe('which run the writing belongs to', () => {
  it('is the run it sits on, measured to the run and not to its ends', () => {
    const drawn = route([]);
    // The middle of the vertical run at x = 200.
    expect(segmentOfLabel(drawn, { x: 205, y: 100 })).toBe(1);
    // Out along the first horizontal leg.
    expect(segmentOfLabel(drawn, { x: 60, y: 4 })).toBe(0);
  });

  it('answers for a point nowhere near the line', () => {
    const index = segmentOfLabel(route([]), { x: -9000, y: 9000 });
    expect(Number.isInteger(index)).toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});

/*
 * The writing goes on the line the router drew, not at a point a different
 * router remembered. ELK placed the notes when it laid a plan out, through its
 * own channels and ports; this file draws the line. Nothing reconciled them, so
 * on a freshly arranged canvas every note floated clear of its flow.
 */
describe('where the writing on a line sits', () => {
  it('puts one note in the middle of the longest run', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 400, y: 100 },
    ];
    expect(labelAt(route, { of: 1, index: 0 })).toEqual({ x: 200, y: 100 });
  });

  it('spreads several down the corridor rather than stacking them', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ];
    const first = labelAt(route, { of: 3, index: 0 });
    const second = labelAt(route, { of: 3, index: 1 });
    const third = labelAt(route, { of: 3, index: 2 });
    expect([first.x, second.x, third.x]).toEqual([75, 150, 225]);
  });

  it('keeps every note on the run itself', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 0, y: 200 },
      { x: 500, y: 200 },
    ];
    for (let index = 0; index < 3; index += 1) {
      expect(labelAt(route, { of: 3, index }).y).toBe(200);
    }
  });

  it('answers for a line with nothing to sit on', () => {
    expect(labelAt([{ x: 7, y: 9 }])).toEqual({ x: 7, y: 9 });
    expect(labelAt([])).toEqual({ x: 0, y: 0 });
  });
});
