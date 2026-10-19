import { planDocSchema, restoreOps } from '@schematic/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { applyOps, initializePlan, readPlanDoc } from './bind.js';

describe('restoreOps against the CRDT', () => {
  it('brings the shared document back to a snapshot of itself', () => {
    const before = planDocSchema.parse({
      id: 'p',
      title: 'Before',
      description: 'As it was.',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'a', title: 'A', body: 'First words.', position: { x: 10, y: 20 }, pinned: true },
        { slug: 'b', title: 'B', status: 'done', tags: ['x'], meta: { due: '2026-10-01' } },
      ],
      edges: [{ id: 'flows_to:a>b', kind: 'flows_to', from: 'a', to: 'b', via: 'click' }],
      comments: [{ id: 'note', body: 'Keep this.', anchor: 'a' }],
    });
    const doc = new Y.Doc();
    initializePlan(doc, before);
    const snapshot = readPlanDoc(doc).doc;

    applyOps(doc, [
      { op: 'set_plan', title: 'After' },
      { op: 'upsert_node', node: { slug: 'a', title: 'A changed', body: '# Other words' } },
      { op: 'delete_node', slug: 'b' },
      { op: 'upsert_node', node: { slug: 'c', title: 'C' } },
      { op: 'upsert_edge', edge: { kind: 'depends_on', from: 'c', to: 'a' } },
      { op: 'delete_comment', id: 'note' },
    ]);
    applyOps(doc, restoreOps(readPlanDoc(doc).doc, snapshot));

    const restored = readPlanDoc(doc).doc;
    expect({ ...restored, updatedAt: snapshot.updatedAt }).toEqual(snapshot);
  });
});
