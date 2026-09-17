import { CARD, GROUP_PADDING, cardHeight, planDocSchema, planOpsSchema } from '@schematic/schema';
import { applyOps, initializePlan, readPlanDoc } from '@schematic/ydoc';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createPlanStore } from './plan-store';

function seeded() {
  const doc = new Y.Doc();
  initializePlan(
    doc,
    planDocSchema.parse({
      id: 'plan-1',
      title: 'Plan',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'db', title: 'Database' },
        { slug: 'auth', title: 'Auth' },
        { slug: 'ui', title: 'UI' },
      ],
      edges: [{ id: 'depends_on:auth>db', kind: 'depends_on', from: 'auth', to: 'db' }],
    }),
  );
  return { doc, bound: createPlanStore(doc) };
}

const ops = (input: unknown[]) => planOpsSchema.parse(input);
const byId = <T extends { id: string }>(nodes: T[], id: string): T | undefined =>
  nodes.find((node) => node.id === id);

describe('createPlanStore', () => {
  it('projects the document into React Flow nodes and edges', () => {
    const { bound } = seeded();
    const state = bound.store.getState();

    expect(state.nodes.map((node) => node.id).sort()).toEqual(['auth', 'db', 'ui']);
    expect(state.edges).toHaveLength(1);
    // Dependencies are drawn from what is needed to what needs it.
    expect(state.edges[0]).toMatchObject({ source: 'db', target: 'auth' });
    expect(state.title).toBe('Plan');
  });

  /**
   * The property the canvas depends on: React Flow memoises node components on
   * object identity, so a change to one node must not replace the others.
   */
  it('keeps untouched node objects identical when one node changes', () => {
    const { doc, bound } = seeded();
    const before = bound.store.getState().nodes;

    applyOps(doc, ops([{ op: 'upsert_node', node: { slug: 'db', status: 'done' } }]));

    const after = bound.store.getState().nodes;
    expect(byId(after, 'db')).not.toBe(byId(before, 'db'));
    expect(byId(after, 'db')?.data.node.status).toBe('done');
    expect(byId(after, 'auth')).toBe(byId(before, 'auth'));
    expect(byId(after, 'ui')).toBe(byId(before, 'ui'));
  });

  it('leaves every node object alone when only an edge changes', () => {
    const { doc, bound } = seeded();
    const before = bound.store.getState().nodes;

    applyOps(doc, ops([{ op: 'upsert_edge', edge: { from: 'ui', to: 'auth' } }]));

    const after = bound.store.getState().nodes;
    for (const node of before) expect(byId(after, node.id)).toBe(node);
    expect(bound.store.getState().edges).toHaveLength(2);
  });

  it('adds and removes nodes as the document changes', () => {
    const { doc, bound } = seeded();

    applyOps(doc, ops([{ op: 'upsert_node', node: { slug: 'api', title: 'API' } }]));
    expect(bound.store.getState().nodes).toHaveLength(4);

    applyOps(doc, ops([{ op: 'delete_node', slug: 'ui' }]));
    const ids = bound.store.getState().nodes.map((node) => node.id);
    expect(ids).not.toContain('ui');
    expect(ids).toHaveLength(3);
  });

  it('stops projecting once destroyed', () => {
    const { doc, bound } = seeded();
    bound.destroy();

    applyOps(doc, ops([{ op: 'upsert_node', node: { slug: 'late', title: 'Late' } }]));
    expect(bound.store.getState().nodes.map((node) => node.id)).not.toContain('late');
  });

  it('stops pointing at something once it has been removed', () => {
    const { doc, bound } = seeded();
    bound.store.getState().highlight('ui');
    expect(bound.store.getState().related).not.toBeNull();

    // Removing the node under the pointer sends no leave event for it, so
    // without the document being consulted the rest of the drawing would stay
    // stepped back around a node that is not there any more.
    applyOps(doc, ops([{ op: 'delete_node', slug: 'ui' }]), 'test');

    expect(bound.store.getState().related).toBeNull();
    expect(bound.store.getState().relatedTo).toBeNull();
  });

  it('keeps pointing at something that is still there', () => {
    const { doc, bound } = seeded();
    bound.store.getState().highlight('auth');
    applyOps(doc, ops([{ op: 'delete_node', slug: 'ui' }]), 'test');

    expect(bound.store.getState().relatedTo).toBe('auth');
    expect(bound.store.getState().related?.has('auth')).toBe(true);
  });
});

/**
 * React Flow's delete key produces a `remove` change. Applied to the store it
 * took the node off the screen and left it in the document, so it came back the
 * next time anything else changed — the canvas said one thing and the plan said
 * another. Existence is the document's to decide.
 */
describe('a node or a line being removed', () => {
  it('keeps a node the document still has', () => {
    const { bound } = seeded();
    bound.store.getState().onNodesChange([{ type: 'remove', id: 'db' }]);

    expect(bound.store.getState().nodes.map((node) => node.id).sort()).toEqual([
      'auth',
      'db',
      'ui',
    ]);
  });

  it('keeps a line the document still has', () => {
    const { bound } = seeded();
    const id = bound.store.getState().edges[0]!.id;
    bound.store.getState().onEdgesChange([{ type: 'remove', id }]);

    expect(bound.store.getState().edges).toHaveLength(1);
  });

  it('lets every other kind of change through', () => {
    const { bound } = seeded();
    bound.store.getState().onNodesChange([{ type: 'select', id: 'db', selected: true }]);

    expect(byId(bound.store.getState().nodes, 'db')?.selected).toBe(true);
  });

  it('drops the node once the document has dropped it', () => {
    const { doc, bound } = seeded();
    applyOps(doc, ops([{ op: 'delete_node', slug: 'db' }]));

    expect(bound.store.getState().nodes.map((node) => node.id).sort()).toEqual(['auth', 'ui']);
  });
});

/**
 * The chicken and the egg this removes. While "is a group" meant "already
 * holds something", the first node had nowhere to be dropped: a box appeared
 * only once it had contents, and contents could only be dragged into a box.
 */
describe('a group that holds nothing yet', () => {
  it('is drawn as a box because it says it is one', () => {
    const { doc, bound } = seeded();
    applyOps(doc, ops([{ op: 'upsert_node', node: { slug: 'area', kind: 'group' } }]));

    const area = byId(bound.store.getState().nodes, 'area');
    expect(area?.style).toEqual({ width: 380, height: 260 });
  });

  it('is drawn at the same bounds whatever size is written on it', () => {
    const { doc, bound } = seeded();
    applyOps(
      doc,
      ops([
        {
          op: 'upsert_node',
          node: { slug: 'area', kind: 'group', size: { width: 600, height: 400 } },
        },
      ]),
    );

    // Nothing holds it to a size: a box is what it holds, and this one holds
    // nothing yet, so it is drawn at the bounds a first node can be dropped in.
    expect(byId(bound.store.getState().nodes, 'area')?.style).toEqual({
      width: 380,
      height: 260,
    });
  });

  it('takes a node into it, and the node is drawn inside it', () => {
    const { doc, bound } = seeded();
    applyOps(
      doc,
      ops([
        { op: 'upsert_node', node: { slug: 'area', kind: 'group' } },
        { op: 'upsert_edge', edge: { kind: 'contains', from: 'area', to: 'db' } },
      ]),
    );

    expect(byId(bound.store.getState().nodes, 'db')?.parentId).toBe('area');
    expect(bound.store.getState().parentOf['db']).toBe('area');
  });
});

describe('a node that holds others without calling itself a group', () => {
  it('is still drawn as the box around them', () => {
    const { doc, bound } = seeded();
    applyOps(doc, ops([{ op: 'upsert_edge', edge: { kind: 'contains', from: 'auth', to: 'db' } }]));

    const auth = byId(bound.store.getState().nodes, 'auth');
    expect(auth?.style).toBeDefined();
    expect(byId(bound.store.getState().nodes, 'db')?.parentId).toBe('auth');
  });
});

/**
 * A card is as tall as what it has to say and nothing stores that height, so a
 * plan drawn before any of this is correct the moment it is opened — there was
 * nothing to migrate.
 */
describe('how tall a card is drawn', () => {
  it('is the bare card when it says nothing', () => {
    const { bound } = seeded();
    expect(byId(bound.store.getState().nodes, 'db')?.style).toEqual({
      width: CARD.width,
      height: CARD.minHeight,
    });
  });

  it('grows with the body, with nobody having sized anything', () => {
    const { doc, bound } = seeded();
    applyOps(
      doc,
      ops([
        {
          op: 'upsert_node',
          node: { slug: 'db', body: 'one\ntwo\nthree\nfour\nfive\nsix\nseven' },
        },
      ]),
    );

    // React Flow types a style height as a CSS length, so it is read back as a
    // number before anything compares it with one.
    const height = Number(byId(bound.store.getState().nodes, 'db')?.style?.height);
    expect(height).toBe(cardHeight('one\ntwo\nthree\nfour\nfive\nsix\nseven'));
    expect(height).toBeGreaterThan(CARD.minHeight);
  });

  it('takes the width somebody chose, and measures the height at it', () => {
    const { doc, bound } = seeded();
    const body = 'x'.repeat(200);
    applyOps(
      doc,
      ops([{ op: 'upsert_node', node: { slug: 'db', body, size: { width: 520, height: 9999 } } }]),
    );

    expect(byId(bound.store.getState().nodes, 'db')?.style).toEqual({
      width: 520,
      // Never the stored 9999: a card's height is not a person's to set.
      height: cardHeight(body, 520),
    });
  });

  it('returns to the standard width when the width is cleared', () => {
    const { doc, bound } = seeded();
    applyOps(
      doc,
      ops([{ op: 'upsert_node', node: { slug: 'db', size: { width: 520, height: 100 } } }]),
    );
    applyOps(doc, ops([{ op: 'upsert_node', node: { slug: 'db', size: null } }]));

    expect(byId(bound.store.getState().nodes, 'db')?.style?.width).toBe(CARD.width);
  });
});

describe('a box around what it holds', () => {
  const held = () => {
    const made = seeded();
    applyOps(
      made.doc,
      ops([
        { op: 'upsert_node', node: { slug: 'box', kind: 'group', title: 'Box' } },
        { op: 'upsert_edge', edge: { kind: 'contains', from: 'box', to: 'db' } },
      ]),
    );
    return made;
  };

  /*
   * The defect this pair was written for, measured on the running instance
   * before it was fixed: a card inside a box was dragged from 260 wide to 460
   * and grew straight out through the box's edge, which stayed at 300 for the
   * whole gesture and jumped to 500 only when the grip was let go.
   */
  it('keeps up with a card while its width is still being dragged', () => {
    const { bound } = held();
    bound.store.getState().setEditable(true);
    const was = Number(byId(bound.store.getState().nodes, 'box')?.style?.width);

    bound.store.getState().sizeNode('db', { width: CARD.width + 200, height: 0 });

    const card = byId(bound.store.getState().nodes, 'db')?.style;
    const box = byId(bound.store.getState().nodes, 'box')?.style;
    expect(Number(card?.width)).toBe(CARD.width + 200);
    expect(Number(box?.width)).toBe(was + 200);
    // And nothing was written down: a drag in progress is not a decision.
    expect(readPlanDoc(bound.doc).doc.nodes.find((node) => node.slug === 'db')?.size).toBeNull();
  });

  it('lets go of the dragged width once the grip is released', () => {
    const { bound } = held();
    bound.store.getState().setEditable(true);
    bound.store.getState().sizeNode('db', { width: CARD.width + 200, height: 0 });
    bound.store.getState().resizeNode('db', { width: CARD.width + 200, height: 0 });

    expect(bound.store.getState().sizing).toEqual({});
    // Same answer as before, now because the document says so rather than
    // because a drag does.
    expect(Number(byId(bound.store.getState().nodes, 'db')?.style?.width)).toBe(CARD.width + 200);
  });

  it('refuses a width for a box, and keeps none behind', () => {
    const { bound } = held();
    bound.store.getState().setEditable(true);
    bound.store.getState().sizeNode('box', { width: 900, height: 0 });
    expect(bound.store.getState().sizing).toEqual({});
    bound.store.getState().resizeNode('box', { width: 900, height: 0 });
    expect(bound.store.getState().sizing).toEqual({});
  });

  it('is exactly what it holds, plus the room a box keeps', () => {
    const { bound } = held();
    const box = byId(bound.store.getState().nodes, 'box')?.style;
    const card = byId(bound.store.getState().nodes, 'db')?.style;
    expect(Number(box?.width)).toBe(
      Number(card?.width) + GROUP_PADDING.left + GROUP_PADDING.right,
    );
    expect(Number(box?.height)).toBe(
      Number(card?.height) + GROUP_PADDING.top + GROUP_PADDING.bottom,
    );
  });

  it('grows when what it holds outgrows it', () => {
    const { doc, bound } = held();
    const before = Number(byId(bound.store.getState().nodes, 'box')?.style?.height ?? 0);

    applyOps(doc, ops([{ op: 'upsert_node', node: { slug: 'db', body: 'line\n'.repeat(18) } }]));

    const after = Number(byId(bound.store.getState().nodes, 'box')?.style?.height ?? 0);
    expect(after).toBeGreaterThan(before);
  });

  it('ignores bounds somebody wrote on it, because the contents are the answer', () => {
    const { doc, bound } = held();
    const drawn = byId(bound.store.getState().nodes, 'box')?.style;
    applyOps(
      doc,
      ops([{ op: 'upsert_node', node: { slug: 'box', size: { width: 1200, height: 900 } } }]),
    );

    expect(byId(bound.store.getState().nodes, 'box')?.style).toEqual(drawn);
  });

  /*
   * The half the old rule could not do. A box grew down and to the right from
   * its own stored corner, so a child dragged above or left of it hung outside
   * the boundary that was supposed to contain it.
   */
  it('reaches up to a child dragged above it', () => {
    const { doc, bound } = held();
    const before = byId(bound.store.getState().nodes, 'box');
    applyOps(
      doc,
      ops([{ op: 'upsert_node', node: { slug: 'db', position: { x: -400, y: -400 } } }]),
    );

    const box = bound.store.getState().absolute['box'];
    const card = bound.store.getState().absolute['db'];
    expect(before).toBeDefined();
    expect(box).toBeDefined();
    expect(box?.x).toBe((card?.x ?? 0) - GROUP_PADDING.left);
    expect(box?.y).toBe((card?.y ?? 0) - GROUP_PADDING.top);
  });
});
