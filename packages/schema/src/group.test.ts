import { describe, expect, it } from 'vitest';

import { DEFAULT_GROUP_SIZE, groupSize, growToHold, isGroup } from './group.js';

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

describe('the bounds a box is drawn at', () => {
  it('is what somebody gave it when that is enough', () => {
    expect(growToHold({ width: 600, height: 400 }, { width: 300, height: 200 })).toEqual({
      width: 600,
      height: 400,
    });
  });

  it('grows to hold a child that has outgrown it', () => {
    expect(growToHold({ width: 300, height: 200 }, { width: 300, height: 480 })).toEqual({
      width: 300,
      height: 480,
    });
  });

  it('grows on each axis independently', () => {
    expect(growToHold({ width: 600, height: 200 }, { width: 300, height: 480 })).toEqual({
      width: 600,
      height: 480,
    });
  });

  it('falls back to bounds a node can be dropped into when it holds nothing', () => {
    expect(growToHold(null, null)).toEqual(DEFAULT_GROUP_SIZE);
  });

  it('is at least what its contents need even with no size of its own', () => {
    expect(growToHold(null, { width: 900, height: 100 }).width).toBe(900);
  });
});
