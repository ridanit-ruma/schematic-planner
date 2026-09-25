import { describe, expect, it } from 'vitest';

import { alignTo, place, placeBlock } from './align';

const card = (x: number, y: number, width = 260, height = 76) => ({ x, y, width, height });

describe('lining a dragged node up with the others', () => {
  it('leaves a node alone when nothing is near enough', () => {
    expect(alignTo(card(0, 0), [card(500, 500)], 6)).toEqual({ x: null, y: null, guides: [] });
  });

  it('pulls the top onto a top that is close', () => {
    const lined = alignTo(card(0, 103), [card(400, 100)], 6);
    expect(lined.y).toBe(100);
    expect(lined.x).toBeNull();
  });

  /* The case the grid could never answer: a group's edge is wherever its contents put it. */
  it('lines a card up with the edge of a box of any height', () => {
    const group = { x: -37, y: 13, width: 600, height: 331 };
    expect(alignTo(card(-34, 200), [group], 6).x).toBe(-37);
    expect(alignTo(card(700, 16), [group], 6).y).toBe(13);
  });

  it('lines up middles, which is where the wires leave', () => {
    const tall = card(400, 0, 260, 120);
    // Middle of the tall one is 60; a 76-high card's middle is at y + 38.
    expect(alignTo(card(0, 25), [tall], 6).y).toBe(60 - 38);
  });

  /*
   * Like with like only. An edge pulled onto somebody's middle is a snap nobody
   * asked for, and on a dense canvas it moved a box 8px onto its neighbour.
   */
  it('does not pull an edge onto a middle', () => {
    // Its bottom (154 + 256 = 410) is 2 from the other's middle (340 + 68 = 408).
    const group = { x: 740, y: 154, width: 300, height: 256 };
    expect(alignTo(group, [{ x: 600, y: 340, width: 300, height: 136 }], 6).y).toBeNull();
  });

  it('takes the nearest line when several are in reach', () => {
    expect(alignTo(card(0, 104), [card(400, 100), card(800, 105)], 6).y).toBe(105);
  });

  it('says where to draw the line it lined up on', () => {
    const { guides } = alignTo(card(0, 103), [card(400, 100)], 6);
    expect(guides).toEqual([{ axis: 'y', at: 100, from: 0, to: 660 }]);
  });
});

describe('placing a dragged node', () => {
  const grid = { step: 20, anchor: 'terminal' as const };

  /* The 0.1 of a square: the corner was snapped while dragging and the middle on release. */
  it('puts a card where the grid holds it, the same way while dragging and when dropped', () => {
    const raw = card(3, 1);
    const once = place(raw, [], grid, 6);
    expect(place({ ...raw, ...once }, [], grid, 6)).toEqual(once);
    // Middle on a line: y + 38 is a multiple of 20.
    expect((once.y + 38) % 20).toBe(0);
  });

  it('prefers a neighbour to the grid on the axis it lines up on', () => {
    const placed = place(card(3, 103), [card(400, 101)], grid, 6);
    expect(placed.y).toBe(101);
    expect(placed.x).toBe(0);
  });

  it('only lines up with neighbours when the grid is off', () => {
    expect(place(card(3, 57), [], null, 6)).toMatchObject({ x: 3, y: 57 });
  });
});

describe('placing a dragged block', () => {
  const grid = { step: 20, anchor: 'terminal' as const };

  it('is place, for a block of one', () => {
    const raw = card(3, 103);
    const others = [card(400, 101)];
    const one = place(raw, others, grid, 6);
    const block = placeBlock(raw, raw, others, grid, 6);
    expect({ x: raw.x + block.dx, y: raw.y + block.dy }).toEqual({ x: one.x, y: one.y });
    expect(block.guides).toEqual(one.guides);
  });

  // Two cards moved together line up by the box around both of them.
  it('lines up the whole block, not the node under the hand', () => {
    const lead = card(0, 200);
    const block = { x: 0, y: 150, width: 560, height: 126 };
    // The block's top (150) is 3 from a neighbour's top; the lead's is nowhere near.
    const placed = placeBlock(lead, block, [card(900, 147)], null, 6);
    expect(placed.dy).toBe(-3);
  });

  it('holds the grid by the node under the hand', () => {
    const lead = card(3, 1);
    const placed = placeBlock(lead, { ...lead, width: 800, height: 400 }, [], grid, 6);
    expect(lead.x + placed.dx).toBe(0);
    expect((lead.y + placed.dy + 38) % 20).toBe(0);
  });

  it('prefers an equal gap to the grid, and says so', () => {
    const others = [card(0, 0), card(300, 0)];
    const placed = placeBlock(card(603, 3), card(603, 3), others, grid, 6);
    expect(placed.dx).toBe(-3);
    expect(placed.gaps.map((gap) => gap.size)).toEqual([40, 40]);
  });

  it('takes whichever of an alignment and an equal gap is nearer', () => {
    // Left edges line up 2 away (a card at 601 below); the gap of 40 is 3 away.
    const others = [card(0, 0), card(300, 0), card(601, 300)];
    const placed = placeBlock(card(603, 3), card(603, 3), others, null, 6);
    expect(placed.dx).toBe(-2);
    expect(placed.guides.some((guide) => guide.axis === 'x')).toBe(true);
    expect(placed.gaps).toEqual([]);
  });
});
