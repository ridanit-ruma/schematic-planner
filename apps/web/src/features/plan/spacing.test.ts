import { describe, expect, it } from 'vitest';

import { evenRow, respace, spacingSnap, tidyUp, TIDY_FALLBACK_GAP } from './spacing';

const card = (x: number, y: number, width = 260, height = 76) => ({ x, y, width, height });

describe('repeating a gap that is already there', () => {
  // A and B are 40 apart. C dragged to 43 past B snaps to 40 past it.
  it('snaps a block to the gap between two others in its row', () => {
    const snap = spacingSnap(card(603, 0), [card(0, 0), card(300, 0)], 'x', 6);
    expect(snap?.shift).toBe(-3);
    const sizes = snap?.markers.map((marker) => [marker.from, marker.to, marker.size]);
    // The gap it makes, and the one it repeats.
    expect(sizes).toContainEqual([560, 600, 40]);
    expect(sizes).toContainEqual([260, 300, 40]);
  });

  it('snaps on the near side too', () => {
    expect(spacingSnap(card(-302, 0), [card(0, 0), card(300, 0)], 'x', 6)?.shift).toBe(2);
  });

  it('leaves a block alone when no gap is within reach', () => {
    expect(spacingSnap(card(620, 0), [card(0, 0), card(300, 0)], 'x', 6)).toBeNull();
  });

  // Only what lines up with the block across the axis is its row.
  it('ignores gaps in rows the block is not in', () => {
    expect(spacingSnap(card(603, 500), [card(0, 0), card(300, 0)], 'x', 6)).toBeNull();
  });

  it('centres a block between two neighbours with the same gap either side', () => {
    // Room of 440 between them, less a 260 card: 90 either side, at 350.
    const snap = spacingSnap(card(348, 0), [card(0, 0), card(700, 0)], 'x', 6);
    expect(snap?.shift).toBe(2);
    expect(snap?.markers.map((marker) => marker.size)).toEqual([90, 90]);
  });

  it('works down a column', () => {
    const snap = spacingSnap(card(0, 237), [card(0, 0), card(0, 116)], 'y', 6);
    // 40 between the first two; the third lands 40 under the second.
    expect(snap?.shift).toBe(-5);
  });

  // A group drawn round a row runs behind every gap in it. It is not in the way.
  it('finds the gaps of a row inside a box', () => {
    const box = { x: -20, y: -40, width: 900, height: 200 };
    const snap = spacingSnap(card(602, 0), [box, card(0, 0), card(300, 0)], 'x', 6);
    expect(snap?.shift).toBe(-2);
  });

  // Two cards with a third between them are not spaced by the width of the third.
  it('measures only between neighbours', () => {
    const snap = spacingSnap(card(1203, 0), [card(0, 0), card(300, 0), card(900, 0)], 'x', 6);
    // 40 (A–B) and 340 (B–C) are gaps; 640 (A to C, across B) is not. The
    // block lands 40 past C.
    expect(snap?.shift).toBe(-3);
    expect(snap?.markers.every((marker) => marker.size === 40 || marker.size === 340)).toBe(true);
  });
});

describe('an evenly spaced selection', () => {
  it('recognises a row and its gap', () => {
    const row = evenRow([card(600, 0), card(0, 0), card(300, 0)]);
    expect(row).toEqual({ axis: 'x', gap: 40, order: [1, 2, 0] });
  });

  it('allows a pixel either way', () => {
    expect(evenRow([card(0, 0), card(300, 3), card(601, 0)])?.gap).toBeCloseTo(40.5);
  });

  it('is not a row when the gaps differ', () => {
    expect(evenRow([card(0, 0), card(300, 0), card(650, 0)])).toBeNull();
  });

  it('is not a row when the boxes overlap', () => {
    expect(evenRow([card(0, 0), card(100, 20)])).toBeNull();
  });

  it('recognises a column', () => {
    expect(evenRow([card(0, 0), card(0, 100)])).toMatchObject({ axis: 'y', gap: 24 });
  });

  // Two cards on a diagonal are both; the way they are further apart is meant.
  it('takes the axis two boxes are further apart on', () => {
    expect(evenRow([card(0, 0), card(500, 100)])?.axis).toBe('x');
    expect(evenRow([card(0, 0), card(270, 400)])?.axis).toBe('y');
  });

  it('respaces from the first, keeping everything across the axis', () => {
    const rects = [card(0, 0), card(300, 7), card(600, 0)];
    const row = evenRow(rects);
    expect(row).not.toBeNull();
    expect(respace(rects, row!, 60)).toEqual([
      { x: 0, y: 0 },
      { x: 320, y: 7 },
      { x: 640, y: 0 },
    ]);
  });

  it('keeps the first in place even when it was listed last', () => {
    const rects = [card(600, 0), card(300, 0), card(0, 0)];
    const row = evenRow(rects)!;
    expect(respace(rects, row, 0)).toEqual([
      { x: 520, y: 0 },
      { x: 260, y: 0 },
      { x: 0, y: 0 },
    ]);
  });
});

describe('tidying a selection up', () => {
  it('spaces it evenly along its longer axis at its mean gap', () => {
    const tidied = tidyUp([card(0, 0), card(280, 10), card(700, -5)]);
    // 960 wide, 780 of it cards: two gaps of 90.
    expect(tidied?.row).toMatchObject({ axis: 'x', gap: 90 });
    expect(tidied?.positions).toEqual([
      { x: 0, y: 0 },
      { x: 350, y: 10 },
      { x: 700, y: -5 },
    ]);
    // And then it is a row, which is what brings the handles back.
    const after = tidied!.positions.map((at) => card(at.x, at.y));
    expect(evenRow(after)?.gap).toBe(90);
  });

  it('works down a column when the selection is taller than wide', () => {
    expect(tidyUp([card(0, 0), card(10, 100), card(0, 400)])?.row.axis).toBe('y');
  });

  it('spaces a pile that overlaps itself at the layout distance', () => {
    const tidied = tidyUp([card(0, 0), card(20, 0), card(40, 0)]);
    expect(tidied?.row.gap).toBe(TIDY_FALLBACK_GAP);
    expect(tidied?.positions.map((at) => at.x)).toEqual([0, 300, 600]);
  });

  it('has nothing to tidy in one box', () => {
    expect(tidyUp([card(0, 0)])).toBeNull();
  });
});
