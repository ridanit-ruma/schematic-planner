import type { Position } from '@schematic/schema';
import { describe, expect, it } from 'vitest';

import type { Rect } from './group-drop';
import { carry, descendantsOf, dropSelection } from './move-selection';

const card = (x: number, y: number, width = 260, height = 76): Rect => ({ x, y, width, height });
const at = (rect: Rect): Position => ({ x: rect.x, y: rect.y });

describe('dropping a dragged selection', () => {
  /*
   * The bug this exists for: only the node under the hand was written, and
   * every other selected node sprang back to where the document last had it.
   */
  it('ends a multi-node drag with every node where it was drawn', () => {
    const rects = { a: card(0, 0), b: card(300, 0), c: card(600, 200) };
    const absolute = { a: at(rects.a), b: at(rects.b), c: at(rects.c) };
    const moves = dropSelection(
      [
        { slug: 'a', rect: card(100, 50) },
        { slug: 'b', rect: card(400, 50) },
        { slug: 'c', rect: card(700, 250) },
      ],
      { absolute, parentOf: {}, rects, targets: [] },
    );
    expect(Object.fromEntries(moves.positions)).toEqual({
      a: { x: 100, y: 50 },
      b: { x: 400, y: 50 },
      c: { x: 700, y: 250 },
    });
    expect(moves.placed.sort()).toEqual(['a', 'b', 'c']);
    expect(moves.membership).toEqual([]);
    expect(moves.shifts.get('c')).toEqual({ x: 100, y: 50 });
  });

  it('carries what a dragged box holds', () => {
    const absolute = { box: { x: 0, y: 0 }, one: { x: 20, y: 40 }, two: { x: 20, y: 140 } };
    const parentOf = { one: 'box', two: 'box' };
    const moves = dropSelection([{ slug: 'box', rect: card(200, 100, 300, 200) }], {
      absolute,
      parentOf,
      rects: {},
      targets: [],
    });
    expect(moves.positions.get('one')).toEqual({ x: 220, y: 140 });
    expect(moves.positions.get('two')).toEqual({ x: 220, y: 240 });
    // Carried, not placed: only what the hand moved is pinned.
    expect(moves.placed).toEqual(['box']);
  });

  it('resolves each node against the boxes as a single drop would be', () => {
    const box = { slug: 'box', rect: card(1000, 0, 400, 300), depth: 0 };
    const rects = { box: box.rect, inside: card(1020, 40), loose: card(0, 0) };
    const moves = dropSelection(
      [
        // Stays in the box it was in, however far it goes.
        { slug: 'inside', rect: card(1500, 500) },
        // Joins the box it was let go over.
        { slug: 'loose', rect: card(1100, 150) },
      ],
      {
        absolute: { box: at(box.rect), inside: at(rects.inside), loose: at(rects.loose) },
        parentOf: { inside: 'box' },
        rects,
        targets: [box],
      },
    );
    expect(moves.membership).toEqual([{ slug: 'loose', from: null, to: 'box' }]);
  });

  // A box travelling with the selection is not somewhere to drop into.
  it('does not drop one dragged node into another', () => {
    const box = { slug: 'box', rect: card(0, 0, 400, 300), depth: 0 };
    const moves = dropSelection(
      [
        { slug: 'box', rect: card(100, 100, 400, 300) },
        { slug: 'loose', rect: card(150, 150) },
      ],
      {
        absolute: { box: { x: 0, y: 0 }, loose: { x: 50, y: 50 } },
        parentOf: {},
        rects: { box: box.rect, loose: card(50, 50) },
        targets: [box],
      },
    );
    expect(moves.membership).toEqual([]);
  });

  // Two siblings moved together land where they were drawn, not clear of
  // where each other used to be.
  it('ignores where the moving nodes used to be', () => {
    const rects = { box: card(0, 0, 700, 300), one: card(20, 40), two: card(300, 40) };
    const moves = dropSelection(
      [
        { slug: 'one', rect: card(300, 40) },
        { slug: 'two', rect: card(580, 40) },
      ],
      {
        absolute: { box: at(rects.box), one: at(rects.one), two: at(rects.two) },
        parentOf: { one: 'box', two: 'box' },
        rects,
        targets: [{ slug: 'box', rect: rects.box, depth: 0 }],
      },
    );
    expect(moves.positions.get('one')).toEqual({ x: 300, y: 40 });
    expect(moves.positions.get('two')).toEqual({ x: 580, y: 40 });
  });
});

describe('moving nodes by hand', () => {
  it('moves what they hold by the same amount', () => {
    const moves = carry(
      new Map([['box', { x: 50, y: 0 }]]),
      { box: { x: 0, y: 0 }, inner: { x: 20, y: 40 }, deeper: { x: 40, y: 80 } },
      { inner: 'box', deeper: 'inner' },
    );
    expect(moves.positions.get('deeper')).toEqual({ x: 90, y: 80 });
    expect(moves.shifts.get('inner')).toEqual({ x: 50, y: 0 });
  });

  it('finds everything held at any depth', () => {
    expect(descendantsOf('a', { b: 'a', c: 'b', d: 'x' }).sort()).toEqual(['b', 'c']);
  });
});
