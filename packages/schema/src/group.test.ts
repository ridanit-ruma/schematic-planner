import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GROUP_SIZE,
  GROUP_PADDING,
  groupSize,
  holdingBox,
  isGroup,
  overlapShare,
} from './group.js';

describe('what counts as a group', () => {
  it('is a group because it says so, holding nothing', () => {
    expect(isGroup({ kind: 'group' }, 0)).toBe(true);
  });

  it('is a group because it holds something, whatever it calls itself', () => {
    expect(isGroup({ kind: 'feature' }, 2)).toBe(true);
  });

  it('is an ordinary card otherwise', () => {
    expect(isGroup({ kind: 'feature' }, 0)).toBe(false);
    expect(isGroup({ kind: 'note' }, 0)).toBe(false);
  });
});

describe('the bounds a group is drawn at', () => {
  it('uses the size it was given', () => {
    expect(groupSize({ size: { width: 500, height: 300 } })).toEqual({ width: 500, height: 300 });
  });

  it('falls back to bounds a node can be dropped into', () => {
    expect(groupSize({ size: null })).toEqual(DEFAULT_GROUP_SIZE);
  });
});

describe('the box that holds what is in it', () => {
  it('is nothing at all when it holds nothing', () => {
    expect(holdingBox([])).toBeNull();
  });

  it('wraps one child with the room a box keeps', () => {
    expect(holdingBox([{ x: 100, y: 100, width: 260, height: 80 }])).toEqual({
      x: 100 - GROUP_PADDING.left,
      y: 100 - GROUP_PADDING.top,
      width: 260 + GROUP_PADDING.left + GROUP_PADDING.right,
      height: 80 + GROUP_PADDING.top + GROUP_PADDING.bottom,
    });
  });

  it('reaches up and to the left, not only down and to the right', () => {
    const box = holdingBox([
      { x: 200, y: 200, width: 100, height: 100 },
      { x: 40, y: 10, width: 100, height: 100 },
    ]);
    expect(box?.x).toBe(40 - GROUP_PADDING.left);
    expect(box?.y).toBe(10 - GROUP_PADDING.top);
    expect(box?.width).toBe(300 - 40 + GROUP_PADDING.left + GROUP_PADDING.right);
    expect(box?.height).toBe(300 - 10 + GROUP_PADDING.top + GROUP_PADDING.bottom);
  });

  it('follows a child that has grown taller, because nothing else remembers a height', () => {
    const short = holdingBox([{ x: 0, y: 0, width: 260, height: 76 }]);
    const tall = holdingBox([{ x: 0, y: 0, width: 260, height: 420 }]);
    expect(tall?.height).toBe((short?.height ?? 0) + 344);
  });
});

describe('how much of a node is inside a box', () => {
  const box = { x: 0, y: 0, width: 400, height: 400 };

  it('is all of it when it sits wholly inside', () => {
    expect(overlapShare({ x: 50, y: 50, width: 100, height: 100 }, box)).toBe(1);
  });

  it('is none of it when they do not touch', () => {
    expect(overlapShare({ x: 500, y: 500, width: 100, height: 100 }, box)).toBe(0);
  });

  it('is none of it when they share only an edge', () => {
    expect(overlapShare({ x: 400, y: 0, width: 100, height: 100 }, box)).toBe(0);
  });

  it('counts the part inside, as a share of the node and not of the box', () => {
    expect(overlapShare({ x: 350, y: 0, width: 100, height: 100 }, box)).toBeCloseTo(0.5);
    expect(overlapShare({ x: 360, y: 0, width: 100, height: 100 }, box)).toBeCloseTo(0.4);
  });
});
