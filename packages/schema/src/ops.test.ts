import { describe, expect, it } from 'vitest';

import { makeDoc } from './fixtures.js';
import { planDocSchema } from './plan.js';
import { PlanOpError, applyPlanOps, planOpsSchema, restoreOps } from './ops.js';

const parse = (ops: unknown[]) => planOpsSchema.parse(ops);

describe('applyPlanOps', () => {
  it('creates a node on first upsert and merges on the second', () => {
    const doc = makeDoc([]);

    const created = applyPlanOps(
      doc,
      parse([{ op: 'upsert_node', node: { slug: 'db', title: 'Database' } }]),
    );
    expect(created.nodes[0]).toMatchObject({ slug: 'db', title: 'Database', status: 'idea' });

    const merged = applyPlanOps(
      created,
      parse([{ op: 'upsert_node', node: { slug: 'db', status: 'done' } }]),
    );
    expect(merged.nodes[0]).toMatchObject({ title: 'Database', status: 'done' });
  });

  it('names a node after its slug when created without a title', () => {
    const doc = applyPlanOps(
      makeDoc([]),
      parse([{ op: 'upsert_node', node: { slug: 'api-gateway' } }]),
    );
    expect(doc.nodes[0]?.title).toBe('api-gateway');
  });

  it('is idempotent for repeated edge upserts', () => {
    const doc = makeDoc([{ slug: 'a' }, { slug: 'b' }]);
    const once = applyPlanOps(doc, parse([{ op: 'upsert_edge', edge: { from: 'a', to: 'b' } }]));
    const twice = applyPlanOps(once, parse([{ op: 'upsert_edge', edge: { from: 'a', to: 'b' } }]));

    expect(twice.edges).toHaveLength(1);
  });

  it('removes incident edges when a node is deleted', () => {
    const doc = makeDoc(
      [{ slug: 'a' }, { slug: 'b' }],
      [{ kind: 'depends_on', from: 'a', to: 'b' }],
    );
    const next = applyPlanOps(doc, parse([{ op: 'delete_node', slug: 'b' }]));

    expect(next.nodes.map((n) => n.slug)).toEqual(['a']);
    expect(next.edges).toEqual([]);
  });

  it('deletes an edge addressed by its endpoints', () => {
    const doc = makeDoc(
      [{ slug: 'a' }, { slug: 'b' }],
      [{ kind: 'depends_on', from: 'a', to: 'b' }],
    );
    const next = applyPlanOps(
      doc,
      parse([{ op: 'delete_edge', kind: 'depends_on', from: 'a', to: 'b' }]),
    );

    expect(next.edges).toEqual([]);
  });

  it('rejects the whole batch when the result would be invalid', () => {
    const doc = makeDoc([{ slug: 'a' }]);
    expect(() =>
      applyPlanOps(
        doc,
        parse([
          { op: 'upsert_node', node: { slug: 'b', title: 'B' } },
          { op: 'upsert_edge', edge: { from: 'b', to: 'ghost' } },
        ]),
      ),
    ).toThrow(PlanOpError);
  });

  it('updates plan metadata', () => {
    const doc = applyPlanOps(makeDoc([]), parse([{ op: 'set_plan', title: 'Renamed' }]));
    expect(doc.title).toBe('Renamed');
  });
});

describe('rename_node', () => {
  const plan = () =>
    planDocSchema.parse({
      id: 'p',
      title: 'P',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'old', title: 'Old' },
        { slug: 'other', title: 'Other' },
      ],
      edges: [
        { id: 'flows_to:old>other', kind: 'flows_to', from: 'old', to: 'other' },
        { id: 'contains:other>old', kind: 'contains', from: 'other', to: 'old' },
      ],
      comments: [{ id: 'note', body: 'about it', anchor: 'old' }],
    });

  it('gives the node its new identifier and keeps everything else', () => {
    const next = applyPlanOps(plan(), [{ op: 'rename_node', from: 'old', to: 'fresh' }]);

    expect(next.nodes.map((node) => node.slug).sort()).toEqual(['fresh', 'other']);
    expect(next.nodes.find((node) => node.slug === 'fresh')?.title).toBe('Old');
  });

  it('reissues every line that touched it, at both ends', () => {
    const next = applyPlanOps(plan(), [{ op: 'rename_node', from: 'old', to: 'fresh' }]);

    expect(next.edges.map((edge) => edge.id).sort()).toEqual([
      'contains:other>fresh',
      'flows_to:fresh>other',
    ]);
    expect(next.edges.every((edge) => edge.from !== 'old' && edge.to !== 'old')).toBe(true);
  });

  it('carries what was said about it', () => {
    const next = applyPlanOps(plan(), [{ op: 'rename_node', from: 'old', to: 'fresh' }]);
    expect(next.comments[0]?.anchor).toBe('fresh');
  });

  it('refuses an identifier another node already answers to', () => {
    expect(() => applyPlanOps(plan(), [{ op: 'rename_node', from: 'old', to: 'other' }])).toThrow(
      PlanOpError,
    );
  });

  it('refuses to rename a node that is not there', () => {
    expect(() => applyPlanOps(plan(), [{ op: 'rename_node', from: 'gone', to: 'fresh' }])).toThrow(
      PlanOpError,
    );
  });

  it('does nothing when the name is the name it has', () => {
    const next = applyPlanOps(plan(), [{ op: 'rename_node', from: 'old', to: 'old' }]);
    expect(next.nodes.map((node) => node.slug).sort()).toEqual(['old', 'other']);
  });
});

describe('restoreOps', () => {
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

  it('brings a plan back to exactly what it was', () => {
    const after = applyPlanOps(before, [
      { op: 'set_plan', title: 'After' },
      { op: 'upsert_node', node: { slug: 'a', title: 'A changed', body: 'Other words.' } },
      { op: 'delete_node', slug: 'b' },
      { op: 'upsert_node', node: { slug: 'c', title: 'C' } },
      { op: 'upsert_edge', edge: { kind: 'depends_on', from: 'c', to: 'a' } },
      { op: 'delete_comment', id: 'note' },
      { op: 'upsert_comment', comment: { id: 'other', body: 'New.' } },
    ]);
    const restored = applyPlanOps(after, restoreOps(after, before));
    expect({ ...restored, updatedAt: before.updatedAt }).toEqual(before);
  });
});

describe('upsert_edge on an edge somebody drew', () => {
  const drawn = applyPlanOps(makeDoc([{ slug: 'a' }, { slug: 'b' }]), [
    {
      op: 'upsert_edge',
      edge: {
        kind: 'flows_to',
        from: 'a',
        to: 'b',
        waypoints: [
          { x: 40, y: 0 },
          { x: 40, y: 80 },
        ],
        labelPosition: { x: 40, y: 40 },
        fromSide: 'bottom',
        toSide: 'top',
      },
    },
  ]);

  it('keeps the bends and sides an agent did not mention', () => {
    const [edge] = applyPlanOps(drawn, [
      { op: 'upsert_edge', edge: { kind: 'flows_to', from: 'a', to: 'b', carries: 'a token' } },
    ]).edges;
    expect(edge).toMatchObject({
      carries: 'a token',
      waypoints: [
        { x: 40, y: 0 },
        { x: 40, y: 80 },
      ],
      labelPosition: { x: 40, y: 40 },
      fromSide: 'bottom',
      toSide: 'top',
    });
  });

  it('clears them when told to', () => {
    const [edge] = applyPlanOps(drawn, [
      {
        op: 'upsert_edge',
        edge: { kind: 'flows_to', from: 'a', to: 'b', waypoints: [], fromSide: null, toSide: null },
      },
    ]).edges;
    expect(edge).toMatchObject({ waypoints: [], fromSide: null, toSide: null });
    expect(edge?.labelPosition).toEqual({ x: 40, y: 40 });
  });
});

describe('upsert_edge naming an existing id for other ends', () => {
  it('starts a new line rather than inheriting the old one’s drawing', () => {
    const doc = applyPlanOps(makeDoc([{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }]), [
      {
        op: 'upsert_edge',
        edge: {
          id: 'line',
          kind: 'flows_to',
          from: 'a',
          to: 'b',
          waypoints: [{ x: 1, y: 2 }],
          fromSide: 'top',
        },
      },
    ]);
    const [edge] = applyPlanOps(doc, [
      { op: 'upsert_edge', edge: { id: 'line', kind: 'flows_to', from: 'c', to: 'b' } },
    ]).edges;
    expect(edge).toMatchObject({ from: 'c', waypoints: [], fromSide: null });
  });
});
