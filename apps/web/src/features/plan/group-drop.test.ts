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
