import { describe, expect, it } from 'vitest';

import { resolveDrop, type DropTarget, type Rect } from './group-drop';

const group: DropTarget = {
  slug: 'group',
  rect: { x: 0, y: 0, width: 600, height: 400 },
  depth: 0,
};
const inner: DropTarget = {
  slug: 'inner',
  rect: { x: 100, y: 100, width: 300, height: 200 },
  depth: 1,
};
const card = { width: 260, height: 76 };
const none = new Set<string>();

describe('which box a drop lands in', () => {
  it('leaves a node dropped on the open canvas alone', () => {
    const drop = resolveDrop({ x: 900, y: 900, ...card }, [group], none);
    expect(drop).toEqual({ parent: null, position: { x: 900, y: 900 } });
  });

  it('takes a box the node is wholly inside', () => {
    expect(resolveDrop({ x: 150, y: 150, ...card }, [group], none).parent).toBe('group');
  });

  it('takes a box holding more than half of the node', () => {
    // 160 of 260 wide inside the left edge: nearly two thirds of it.
    expect(resolveDrop({ x: -100, y: 200, ...card }, [group], none).parent).toBe('group');
  });

  it('leaves a node that is mostly outside on the canvas', () => {
    // 100 of 260 wide inside: under half, so the box does not own it.
    expect(resolveDrop({ x: -160, y: 200, ...card }, [group], none).parent).toBeNull();
  });

  /*
   * Measured against the smaller of the two. A box is drawn tight around its
   * contents, so nothing the size of a box ever covers half of another box —
   * judged by the moved node's own area alone, one box could never be put
   * inside another at all.
   */
  it('takes a box dropped squarely onto another box', () => {
    const outer: DropTarget = {
      slug: 'outer',
      rect: { x: 0, y: 0, width: 300, height: 200 },
      depth: 0,
    };
    const big = { x: -100, y: -100, width: 700, height: 500 };
    expect(resolveDrop(big, [outer], none).parent).toBe('outer');
  });

  it('leaves a box that only clips the corner of another', () => {
    const outer: DropTarget = {
      slug: 'outer',
      rect: { x: 0, y: 0, width: 300, height: 200 },
      depth: 0,
    };
    const big = { x: 250, y: 160, width: 700, height: 500 };
    expect(resolveDrop(big, [outer], none).parent).toBeNull();
  });

  it('does not move a node it takes in', () => {
    const drop = resolveDrop({ x: -100, y: 200, ...card }, [group], none);
    expect(drop.position).toEqual({ x: -100, y: 200 });
  });

  it('prefers the box that holds most of the node', () => {
    const left: DropTarget = { slug: 'left', rect: { x: 0, y: 0, width: 200, height: 400 }, depth: 0 };
    const right: DropTarget = {
      slug: 'right',
      rect: { x: 200, y: 0, width: 400, height: 400 },
      depth: 0,
    };
    // 60 of 260 wide in the left box, 200 in the right one.
    expect(resolveDrop({ x: 140, y: 100, ...card }, [left, right], none).parent).toBe('right');
  });

  it('prefers the deeper box when both hold all of it', () => {
    const wide: DropTarget = {
      slug: 'wide',
      rect: { x: 0, y: 0, width: 900, height: 900 },
      depth: 0,
    };
    const tight: DropTarget = {
      slug: 'tight',
      rect: { x: 100, y: 100, width: 400, height: 400 },
      depth: 1,
    };
    expect(resolveDrop({ x: 150, y: 150, ...card }, [wide, tight], none).parent).toBe('tight');
  });

  it('refuses to drop a group into itself or into what it holds', () => {
    const drop = resolveDrop({ x: 150, y: 150, ...card }, [group, inner], new Set(['inner']));
    expect(drop.parent).toBe('group');
  });
});

describe('landing clear of what is already in the box', () => {
  const occupied = (rects: readonly Rect[]) => new Map([['group', rects]]);

  it('stays exactly where it was dropped when nothing is there', () => {
    const drop = resolveDrop({ x: 150, y: 150, ...card }, [group], none, occupied([]));
    expect(drop.position).toEqual({ x: 150, y: 150 });
  });

  it('slides below a node it was dropped on top of, keeping its column', () => {
    const sitting: Rect = { x: 140, y: 140, width: 260, height: 76 };
    const drop = resolveDrop({ x: 150, y: 150, ...card }, [group], none, occupied([sitting]));
    expect(drop.position).toEqual({ x: 150, y: 140 + 76 + 20 });
  });

  it('keeps going past a second node in the way', () => {
    const first: Rect = { x: 140, y: 140, width: 260, height: 76 };
    const second: Rect = { x: 140, y: 236, width: 260, height: 76 };
    const drop = resolveDrop({ x: 150, y: 150, ...card }, [group], none, occupied([first, second]));
    expect(drop.position.y).toBe(236 + 76 + 20);
  });

  it('leaves a node dropped beside one alone, because there is room in every direction', () => {
    const sitting: Rect = { x: 0, y: 140, width: 260, height: 76 };
    const drop = resolveDrop({ x: 300, y: 140, ...card }, [group], none, occupied([sitting]));
    expect(drop.position).toEqual({ x: 300, y: 140 });
  });
});

/*
 * Growing a box and leaving one cannot both be a drag.
 *
 * A box is the bounding box of what it holds, so the way to make one bigger is
 * to drag a child outward — and with a threshold the child left the box at
 * exactly the moment it would have stretched it. A box was therefore grown in
 * small steps, each one careful to stay under the threshold, which is the
 * opposite of direct manipulation. The menu is the way out.
 */
describe('a node that is already in a box', () => {
  it('stays in it, however far it is dragged', () => {
    const far = { x: 5000, y: 5000, ...card };
    expect(resolveDrop(far, [group], none, new Map(), 'group').parent).toBe('group');
  });

  it('stays in it even when it lands squarely inside another', () => {
    const other: DropTarget = {
      slug: 'other',
      rect: { x: 2000, y: 2000, width: 600, height: 400 },
      depth: 0,
    };
    const inside = { x: 2100, y: 2100, ...card };
    expect(resolveDrop(inside, [group, other], none, new Map(), 'group').parent).toBe('group');
  });

  it('is not moved clear of its siblings when it was only being dragged about', () => {
    const sitting = { x: 140, y: 140, width: 260, height: 76 };
    const drop = resolveDrop({ x: 150, y: 150, ...card }, [group], none, new Map([['group', [sitting]]]), 'group');
    // It still gets out of the way of what is already there, as any drop does.
    expect(drop.position.y).toBeGreaterThan(150);
  });
});

describe('a node on the open canvas', () => {
  it('still joins a box it is dropped into', () => {
    expect(resolveDrop({ x: 150, y: 150, ...card }, [group], none, new Map(), null).parent).toBe('group');
  });

  it('still stays out of one it barely touches', () => {
    expect(resolveDrop({ x: -160, y: 200, ...card }, [group], none, new Map(), null).parent).toBeNull();
  });
});
