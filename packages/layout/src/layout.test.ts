import { describe, expect, it } from 'vitest';
import { planDocSchema, type PlanDoc } from '@schematic/schema';

import { layoutPlan } from './layout.js';

function plan(overrides: Partial<PlanDoc> = {}): PlanDoc {
  return planDocSchema.parse({
    id: 'plan-1',
    title: 'Layout',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { slug: 'db', title: 'Database' },
      { slug: 'auth', title: 'Auth' },
      { slug: 'ui', title: 'UI' },
    ],
    edges: [
      { id: 'd1', kind: 'depends_on', from: 'auth', to: 'db' },
      { id: 'd2', kind: 'depends_on', from: 'ui', to: 'auth' },
    ],
    ...overrides,
  });
}

describe('layoutPlan', () => {
  it('places every node', async () => {
    const { positions } = await layoutPlan(plan());
    expect([...positions.keys()].sort()).toEqual(['auth', 'db', 'ui']);
    expect([...positions.values()].every((p) => Number.isFinite(p.x))).toBe(true);
  });

  it('puts a dependency to the left of what needs it', async () => {
    const { positions } = await layoutPlan(plan());
    const db = positions.get('db');
    const auth = positions.get('auth');
    const ui = positions.get('ui');

    expect(db!.x).toBeLessThan(auth!.x);
    expect(auth!.x).toBeLessThan(ui!.x);
  });

  it('is deterministic', async () => {
    const [a, b] = await Promise.all([layoutPlan(plan()), layoutPlan(plan())]);
    expect([...a.positions]).toEqual([...b.positions]);
  });

  it('leaves pinned nodes out of the result and anchors the rest near them', async () => {
    const doc = plan({
      nodes: planDocSchema.shape.nodes.parse([
        { slug: 'db', title: 'Database', position: { x: 1000, y: 500 }, pinned: true },
        { slug: 'auth', title: 'Auth' },
        { slug: 'ui', title: 'UI' },
      ]),
    });
    const { positions } = await layoutPlan(doc);

    expect(positions.has('db')).toBe(false);
    expect(positions.get('auth')!.x).toBeGreaterThan(500);
  });

  it('re-places pinned nodes when the scope is the whole plan', async () => {
    const doc = plan({
      nodes: planDocSchema.shape.nodes.parse([
        { slug: 'db', title: 'Database', position: { x: 1000, y: 500 }, pinned: true },
        { slug: 'auth', title: 'Auth' },
        { slug: 'ui', title: 'UI' },
      ]),
    });
    const { positions } = await layoutPlan(doc, { scope: 'all' });

    expect(positions.has('db')).toBe(true);
  });

  it('lays out nested nodes inside their container', async () => {
    const doc = planDocSchema.parse({
      id: 'plan-2',
      title: 'Nested',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'group', title: 'Group' },
        { slug: 'child-a', title: 'A' },
        { slug: 'child-b', title: 'B' },
      ],
      edges: [
        { id: 'c1', kind: 'contains', from: 'group', to: 'child-a' },
        { id: 'c2', kind: 'contains', from: 'group', to: 'child-b' },
      ],
    });
    const { positions } = await layoutPlan(doc);

    expect(positions.size).toBe(3);
    expect(positions.get('child-a')!.x).toBeGreaterThanOrEqual(positions.get('group')!.x);
  });

  describe('the writing on a line', () => {
    /** Four flows out of one node, all labelled, all heading the same way. */
    const busy = (): PlanDoc =>
      planDocSchema.parse({
        id: 'plan-2',
        title: 'Busy',
        updatedAt: '2026-01-01T00:00:00.000Z',
        nodes: [
          { slug: 'source', title: 'Source' },
          { slug: 'one', title: 'One' },
          { slug: 'two', title: 'Two' },
          { slug: 'three', title: 'Three' },
          { slug: 'four', title: 'Four' },
        ],
        edges: [
          { id: 'f1', kind: 'flows_to', from: 'source', to: 'one', via: 'click Save', carries: '{ id }' },
          { id: 'f2', kind: 'flows_to', from: 'source', to: 'two', via: 'click Delete', carries: '{ id }' },
          { id: 'f3', kind: 'flows_to', from: 'source', to: 'three', via: 'on load', carries: 'the current filter' },
          { id: 'f4', kind: 'flows_to', from: 'source', to: 'four', via: 'on submit', carries: 'the whole form' },
        ],
      });

    it('gets a place of its own for every labelled flow', async () => {
      const { labels } = await layoutPlan(busy(), { scope: 'all' });
      expect([...labels.keys()].sort()).toEqual(['f1', 'f2', 'f3', 'f4']);
    });

    it('does not put two of them in the same place', async () => {
      const { labels } = await layoutPlan(busy(), { scope: 'all' });
      const placed = [...labels.values()];
      for (let a = 0; a < placed.length; a += 1) {
        for (let b = a + 1; b < placed.length; b += 1) {
          const [one, other] = [placed[a]!, placed[b]!];
          const apart = Math.abs(one.x - other.x) > 100 || Math.abs(one.y - other.y) > 18;
          expect(apart, `labels at ${one.x},${one.y} and ${other.x},${other.y}`).toBe(true);
        }
      }
    });

    it('leaves a line with nothing written on it out of it', async () => {
      const { labels } = await layoutPlan(plan(), { scope: 'all' });
      expect(labels.size).toBe(0);
    });
  });
});
