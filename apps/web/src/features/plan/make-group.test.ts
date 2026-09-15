import { describe, expect, it } from 'vitest';

import { groupOps, type GroupMember } from './make-group';

const at = (slug: string, x: number, y: number): GroupMember => ({
  slug,
  rect: { x, y, width: 260, height: 76 },
});

describe('drawing a box around a selection', () => {
  it('makes one group holding everything chosen', () => {
    const result = groupOps([at('a', 0, 0), at('b', 400, 200)], {}, ['a', 'b']);

    expect(result).not.toBeNull();
    expect(result?.slug).toBe('group');
    expect(result?.ops[0]).toEqual({
      op: 'upsert_node',
      node: {
        slug: 'group',
        kind: 'group',
        title: 'Group',
        position: { x: -20, y: -40 },
        // 0..660 wide and 0..276 tall, plus the margins on each side.
        size: { width: 700, height: 336 },
      },
    });
    const held = result?.ops
      .filter((op) => op.op === 'upsert_edge')
      .map((op) => (op.op === 'upsert_edge' ? op.edge.to : ''));
    expect(held).toEqual(['a', 'b']);
  });

  it('is one batch, so undo takes the box and its contents back together', () => {
    const result = groupOps([at('a', 0, 0), at('b', 400, 0)], {}, []);
    expect(result?.ops).toHaveLength(3);
  });

  it('takes a node out of whatever held it', () => {
    const result = groupOps([at('a', 0, 0), at('b', 400, 0)], { a: 'old' }, ['a', 'b', 'old']);
    expect(result?.ops).toContainEqual({
      op: 'delete_edge',
      kind: 'contains',
      from: 'old',
      to: 'a',
    });
  });

  it('stays inside the box everything came out of', () => {
    const result = groupOps([at('a', 0, 0), at('b', 400, 0)], { a: 'feature', b: 'feature' }, []);
    const into = result?.ops.find((op) => op.op === 'upsert_edge' && op.edge.to === 'group');
    expect(into).toEqual(
      expect.objectContaining({ edge: expect.objectContaining({ from: 'feature', to: 'group' }) }),
    );
  });

  it('sits on the open canvas when the selection came from different boxes', () => {
    const result = groupOps([at('a', 0, 0), at('b', 400, 0)], { a: 'one', b: 'two' }, []);
    expect(result?.ops.some((op) => op.op === 'upsert_edge' && op.edge.to === 'group')).toBe(false);
  });

  it('groups a box rather than a box and its contents', () => {
    expect(groupOps([at('box', 0, 0), at('inside', 20, 40)], { inside: 'box' }, [])).toBeNull();
  });

  it('refuses a selection of one', () => {
    expect(groupOps([at('a', 0, 0)], {}, [])).toBeNull();
  });

  it('names the second group something else', () => {
    const result = groupOps([at('a', 0, 0), at('b', 400, 0)], {}, ['group']);
    expect(result?.slug).toBe('group-2');
  });
});
