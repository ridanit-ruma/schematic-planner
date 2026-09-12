import { describe, expect, it } from 'vitest';

import { resolveDrop, type DropTarget } from './group-drop';
import { snapTo } from './snap';

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
    expect(drop.position.x).toBe(20);
    expect(drop.position.x + card.width).toBeLessThanOrEqual(600 - 20);
  });

  it('keeps clear of the band a group labels itself in', () => {
    expect(resolveDrop({ x: 100, y: -10, ...card }, [group], none).position.y).toBe(40);
  });

  it('grows a group too small for what was dropped in it', () => {
    const tight: DropTarget = { slug: 'tight', rect: { x: 0, y: 0, width: 200, height: 90 }, depth: 0 };
    const drop = resolveDrop({ x: 20, y: 20, ...card }, [tight], none);
    expect(drop.parent).toBe('tight');
    expect(drop.grow).toEqual({ width: 260 + 40, height: 76 + 60 });
  });

  it('refuses to drop a group into itself or into what it holds', () => {
    const drop = resolveDrop({ x: 150, y: 150, ...card }, [group, inner], new Set(['inner']));
    expect(drop.parent).toBe('group');
  });
});

/**
 * Snapping happens before the drop is resolved, never after.
 *
 * Both want the last word about where a node goes, and only one of them can have
 * it. Being wholly inside the group it belongs to is an invariant — the picture
 * would otherwise say a node is in a group while the plan says it is not —
 * whereas sitting on a grid line is a convenience. So the clamp runs last, and
 * these record what that costs.
 */
describe('a snapped position going through the clamp', () => {
  const step = 20;

  it('still ends up wholly inside the group', () => {
    // Over the left edge, and off the grid on the way in.
    const drop = resolveDrop({ ...snapTo({ x: -97, y: 203 }, step), ...card }, [group], none);
    expect(drop.parent).toBe('group');
    expect(drop.position.x).toBeGreaterThanOrEqual(20);
    expect(drop.position.x + card.width).toBeLessThanOrEqual(600 - 20);
  });

  it('lands on a line when the clamp has nothing to say', () => {
    const drop = resolveDrop({ ...snapTo({ x: 137, y: 151 }, step), ...card }, [group], none);
    expect(drop.position).toEqual({ x: 140, y: 160 });
  });

  /*
   * The corner of a group is the one position a tight group can offer, so it has
   * to be on the grid itself — which is why every side of CONTAINER_PADDING is a
   * multiple of it. With 16 down the sides this landed at x 16 and a card could
   * be on the grid or inside its group, never both.
   */
  it('offers the corner of a group as a grid position', () => {
    const drop = resolveDrop({ ...snapTo({ x: 0, y: 0 }, step), ...card }, [group], none);
    expect(drop.parent).toBe('group');
    expect(drop.position).toEqual({ x: 20, y: 40 });
    expect(drop.position.x % step).toBe(0);
    expect(drop.position.y % step).toBe(0);
  });

  /* But only when the group itself is on the grid: the room is measured from it. */
  it('cannot offer one inside a group that is off the grid', () => {
    const askew: DropTarget = { slug: 'askew', rect: { x: 7, y: 3, width: 600, height: 400 }, depth: 0 };
    const drop = resolveDrop({ ...snapTo({ x: 0, y: 0 }, step), ...card }, [askew], none);
    expect(drop.position).toEqual({ x: 27, y: 43 });
    expect(drop.position.x % step).not.toBe(0);
  });
});
