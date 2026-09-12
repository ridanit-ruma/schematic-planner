import { describe, expect, it } from 'vitest';

import { bentPath, insertionPoints, midpoint, type Side } from './edge-path';

const source = { x: 0, y: 0 };
const target = { x: 400, y: 200 };

/** Every corner the path visits, read back out of the `d` string. */
function corners(path: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (const match of path.matchAll(/[MLQ] ([-\d.]+),([-\d.]+)(?: ([-\d.]+),([-\d.]+))?/g)) {
    // A Q carries the corner first and the exit second; the corner is the one
    // that matters for squareness.
    points.push({ x: Number(match[1]), y: Number(match[2]) });
    if (match[3] !== undefined) points.push({ x: Number(match[3]), y: Number(match[4]) });
  }
  return points;
}

describe('a line bent through the points it was dragged through', () => {
  it('passes through every one of them, in order', () => {
    const bends = [
      { x: 120, y: 40 },
      { x: 300, y: 160 },
    ];
    const { path } = bentPath(source, 'right', target, 'left', bends);
    const visited = corners(path);
    for (const bend of bends) {
      expect(visited.some((p) => p.x === bend.x && p.y === bend.y)).toBe(true);
    }
    const first = visited.findIndex((p) => p.x === 120 && p.y === 40);
    const second = visited.findIndex((p) => p.x === 300 && p.y === 160);
    expect(first).toBeLessThan(second);
  });

  it('starts at the source and ends at the target', () => {
    const { path } = bentPath(source, 'right', target, 'left', [{ x: 200, y: 100 }]);
    expect(path.startsWith('M 0,0')).toBe(true);
    expect(path.endsWith('L 400,200')).toBe(true);
  });

  /* The drawing is square everywhere else, so the line has to be too. */
  it('keeps every leg square, with rounding allowed only at a corner', () => {
    const { path } = bentPath(source, 'right', target, 'left', [
      { x: 137, y: 43 },
      { x: 290, y: 181 },
    ]);
    // A rounded corner is the only diagonal, and it is at most the radius long.
    const visited = corners(path);
    for (let index = 1; index < visited.length; index += 1) {
      const a = visited[index - 1]!;
      const b = visited[index]!;
      const square = a.x === b.x || a.y === b.y;
      const tiny = Math.abs(b.x - a.x) <= 2 && Math.abs(b.y - a.y) <= 2;
      expect(square || tiny).toBe(true);
    }
  });

  /* Or the arrow clips the corner of the card instead of sitting against it. */
  it.each([
    ['right', 'left'],
    ['bottom', 'top'],
    ['left', 'right'],
    ['top', 'bottom'],
  ] as [Side, Side][])('meets a %s-to-%s pair head-on', (from, to) => {
    const { path } = bentPath(source, from, target, to, [{ x: 137, y: 43 }]);
    const visited = corners(path);
    const second = visited[1]!;
    const last = visited[visited.length - 1]!;
    const beforeLast = visited[visited.length - 2]!;
    // The first and last legs run along the node's own normal.
    const horizontalStart = from === 'left' || from === 'right';
    expect(horizontalStart ? second.y : second.x).toBe(horizontalStart ? source.y : source.x);
    const horizontalEnd = to === 'left' || to === 'right';
    expect(horizontalEnd ? beforeLast.y : beforeLast.x).toBe(
      horizontalEnd ? last.y : last.x,
    );
  });

  it('draws a line nobody has bent without complaint', () => {
    const { path } = bentPath(source, 'right', target, 'left', []);
    expect(path.startsWith('M 0,0')).toBe(true);
    expect(path.endsWith('L 400,200')).toBe(true);
  });

  it('does not pinch where two bends are almost on top of each other', () => {
    const { path } = bentPath(source, 'right', target, 'left', [
      { x: 200, y: 100 },
      { x: 201, y: 101 },
    ]);
    expect(path).not.toContain('NaN');
    expect(path).not.toContain('Infinity');
  });
});

describe('where the writing goes on a bent line', () => {
  it('is halfway along the line, not halfway between the ends', () => {
    // An L that goes a long way right and then a short way down: the straight
    // line between the ends leaves the path entirely.
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

describe('where a new bend can be grabbed', () => {
  it('offers one place on a straight line, and another for every bend added', () => {
    expect(insertionPoints(source, 'right', target, 'left', [])).toHaveLength(1);
    expect(insertionPoints(source, 'right', target, 'left', [{ x: 200, y: 100 }])).toHaveLength(2);
  });

  it('numbers them so a new bend lands in the order it was drawn, not at the end', () => {
    const points = insertionPoints(source, 'right', target, 'left', [
      { x: 120, y: 40 },
      { x: 300, y: 160 },
    ]);
    expect(points.map((p) => p.index)).toEqual([0, 1, 2]);
  });
});
