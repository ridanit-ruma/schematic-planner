import { describe, expect, it } from 'vitest';

import { resolveDrop, type DropTarget } from './group-drop';

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

describe('resolveDrop', () => {
  it('leaves a node dropped on the open canvas alone', () => {
    const drop = resolveDrop({ x: 900, y: 900, ...card }, [group], none);
    expect(drop).toEqual({ parent: null, position: { x: 900, y: 900 }, grow: null });
  });

  it('takes the group whose bounds hold the centre', () => {
    expect(resolveDrop({ x: 150, y: 20, ...card }, [group], none).parent).toBe('group');
  });

  it('prefers the innermost group when they are nested', () => {
    expect(resolveDrop({ x: 150, y: 150, ...card }, [group, inner], none).parent).toBe('inner');
  });

  it('pulls a straddling node wholly inside', () => {
    // Dropped over the left edge: centre is inside, the card is not.
    const drop = resolveDrop({ x: -100, y: 200, ...card }, [group], none);
    expect(drop.parent).toBe('group');
    expect(drop.position.x).toBe(16);
    expect(drop.position.x + card.width).toBeLessThanOrEqual(600 - 16);
  });

  it('keeps clear of the band a group labels itself in', () => {
    expect(resolveDrop({ x: 100, y: -10, ...card }, [group], none).position.y).toBe(40);
  });

  it('grows a group too small for what was dropped in it', () => {
    const tight: DropTarget = { slug: 'tight', rect: { x: 0, y: 0, width: 200, height: 90 }, depth: 0 };
    const drop = resolveDrop({ x: 20, y: 20, ...card }, [tight], none);
    expect(drop.parent).toBe('tight');
    expect(drop.grow).toEqual({ width: 260 + 32, height: 76 + 56 });
  });

  it('refuses to drop a group into itself or into what it holds', () => {
    const drop = resolveDrop({ x: 150, y: 150, ...card }, [group, inner], new Set(['inner']));
    expect(drop.parent).toBe('group');
  });
});
