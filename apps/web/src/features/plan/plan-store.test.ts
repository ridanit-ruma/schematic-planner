import { planDocSchema, planOpsSchema } from '@schematic/schema';
import { applyOps, initializePlan } from '@schematic/ydoc';
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
});
