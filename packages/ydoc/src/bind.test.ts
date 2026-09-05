import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { applyPlanOps, planDocSchema, planOpsSchema, type PlanDoc } from '@schematic/schema';

import { applyOps, edgesMap, initializePlan, isEmpty, nodesMap, readPlanDoc } from './bind.js';

function samplePlan(): PlanDoc {
  return planDocSchema.parse({
    id: 'plan-1',
    title: 'Plan',
    description: 'A plan.',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { slug: 'db', title: 'Database', body: 'Postgres.', status: 'done' },
      { slug: 'auth', title: 'Auth', position: { x: 10, y: 20 }, pinned: true },
    ],
    edges: [{ id: 'depends_on:auth>db', kind: 'depends_on', from: 'auth', to: 'db' }],
  });
}

const ops = (input: unknown[]) => planOpsSchema.parse(input);

/** Ignore `updatedAt`, which the server owns and the document does not carry. */
function comparable(doc: PlanDoc) {
  return {
    ...doc,
    updatedAt: '',
    nodes: [...doc.nodes].sort((a, b) => a.slug.localeCompare(b.slug)),
    edges: [...doc.edges].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

describe('initializePlan and readPlanDoc', () => {
  it('round-trips a plan through the CRDT', () => {
    const doc = new Y.Doc();
    const plan = samplePlan();
    initializePlan(doc, plan);

    const { doc: read, dropped } = readPlanDoc(doc, { updatedAt: plan.updatedAt });
    expect(dropped).toEqual([]);
    expect(comparable(read)).toEqual(comparable(plan));
  });

  it('reports an untouched document as empty', () => {
    expect(isEmpty(new Y.Doc())).toBe(true);
    const doc = new Y.Doc();
    initializePlan(doc, samplePlan());
    expect(isEmpty(doc)).toBe(false);
  });
});

describe('applyOps', () => {
  it('matches the pure implementation it mirrors', () => {
    const plan = samplePlan();
    const doc = new Y.Doc();
    initializePlan(doc, plan);

    const batch = ops([
      { op: 'upsert_node', node: { slug: 'ui', title: 'UI' } },
      { op: 'upsert_edge', edge: { from: 'ui', to: 'auth' } },
      { op: 'upsert_node', node: { slug: 'db', status: 'planned' } },
      { op: 'set_plan', title: 'Renamed' },
    ]);

    const expected = applyPlanOps(plan, batch);
    applyOps(doc, batch);

    const { doc: actual } = readPlanDoc(doc, { updatedAt: plan.updatedAt });
    expect(comparable(actual)).toEqual(comparable(expected));
  });

  it('applies the whole batch in one transaction', () => {
    const doc = new Y.Doc();
    initializePlan(doc, samplePlan());

    let updates = 0;
    doc.on('update', () => {
      updates += 1;
    });

    applyOps(
      doc,
      ops([
        { op: 'upsert_node', node: { slug: 'a', title: 'A' } },
        { op: 'upsert_node', node: { slug: 'b', title: 'B' } },
        { op: 'upsert_edge', edge: { from: 'a', to: 'b' } },
      ]),
    );

    expect(updates).toBe(1);
  });

  it('leaves the document untouched when the batch would be invalid', () => {
    const doc = new Y.Doc();
    initializePlan(doc, samplePlan());
    const before = Y.encodeStateAsUpdate(doc);

    expect(() =>
      applyOps(doc, ops([{ op: 'upsert_edge', edge: { from: 'db', to: 'ghost' } }])),
    ).toThrow();

    expect(readPlanDoc(doc).doc.edges).toHaveLength(1);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(Buffer.from(before))).toBe(true);
  });

  it('removes edges attached to a deleted node', () => {
    const doc = new Y.Doc();
    initializePlan(doc, samplePlan());

    applyOps(doc, ops([{ op: 'delete_node', slug: 'db' }]));

    expect(nodesMap(doc).has('db')).toBe(false);
    expect(edgesMap(doc).size).toBe(0);
  });
});

describe('concurrent editing', () => {
  function fork(plan: PlanDoc): [Y.Doc, Y.Doc] {
    const a = new Y.Doc();
    initializePlan(a, plan);
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    return [a, b];
  }

  function merge(a: Y.Doc, b: Y.Doc): void {
    const fromA = Y.encodeStateAsUpdate(a);
    const fromB = Y.encodeStateAsUpdate(b);
    Y.applyUpdate(a, fromB);
    Y.applyUpdate(b, fromA);
  }

  it('converges when two peers add different nodes', () => {
    const [a, b] = fork(samplePlan());

    applyOps(a, ops([{ op: 'upsert_node', node: { slug: 'from-a', title: 'A' } }]));
    applyOps(b, ops([{ op: 'upsert_node', node: { slug: 'from-b', title: 'B' } }]));
    merge(a, b);

    const slugs = (doc: Y.Doc) =>
      readPlanDoc(doc)
        .doc.nodes.map((n) => n.slug)
        .sort();
    expect(slugs(a)).toEqual(slugs(b));
    expect(slugs(a)).toEqual(['auth', 'db', 'from-a', 'from-b']);
  });

  it('drops the edge when one peer deletes a node another was connecting', () => {
    const [a, b] = fork(samplePlan());

    applyOps(b, ops([{ op: 'upsert_node', node: { slug: 'ui', title: 'UI' } }]));
    merge(a, b);

    applyOps(a, ops([{ op: 'delete_node', slug: 'ui' }]));
    applyOps(b, ops([{ op: 'upsert_edge', edge: { from: 'ui', to: 'db' } }]));
    merge(a, b);

    const result = readPlanDoc(a);
    expect(result.doc.nodes.map((n) => n.slug).sort()).toEqual(['auth', 'db']);
    expect(result.dropped.join(' ')).toContain('endpoint missing');
    expect(planDocSchema.safeParse(result.doc).success).toBe(true);
  });

  it('merges concurrent edits to the same body character by character', () => {
    const plan = planDocSchema.parse({
      id: 'plan-2',
      title: 'Plan',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [{ slug: 'note', title: 'Note', body: 'hello' }],
    });
    const [a, b] = fork(plan);

    const textOf = (doc: Y.Doc) => nodesMap(doc).get('note')?.get('body') as Y.Text;
    textOf(a).insert(5, ' world');
    textOf(b).insert(0, 'say ');
    merge(a, b);

    expect(readPlanDoc(a).doc.nodes[0]?.body).toBe('say hello world');
    expect(readPlanDoc(b).doc.nodes[0]?.body).toBe('say hello world');
  });
});
