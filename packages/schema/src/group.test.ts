import { describe, expect, it } from 'vitest';

import { DEFAULT_GROUP_SIZE, groupSize, isGroup } from './group.js';

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
