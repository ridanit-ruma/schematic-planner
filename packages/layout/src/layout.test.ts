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

  /**
   * The canvas snaps a drag to the same lattice, so a plan the server tidied and
   * a plan a person tidied have to agree about where the lines are. The step is
   * fixed here rather than offered: the layout runs where nobody's preference is
   * in scope, and a grid step is a coordinate the MCP surface does not take.
   */
  describe('the grid it draws on', () => {
    const GRID = 20;
    const onGrid = (p: { x: number; y: number }) => p.x % GRID === 0 && p.y % GRID === 0;

    it('places every node on it', async () => {
      const { positions } = await layoutPlan(plan());
      expect([...positions.values()].every(onGrid)).toBe(true);
    });

    it('places a nested node on it too, not merely inside its container', async () => {
      const doc = planDocSchema.parse({
        id: 'plan-3',
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
      const { positions, sizes } = await layoutPlan(doc);
      expect([...positions.values()].every(onGrid)).toBe(true);

      // And the container is sized in whole steps, so the room inside it starts
      // and ends on the grid as well.
      const box = sizes.get('group')!;
      expect(box.width % GRID).toBe(0);
      expect(box.height % GRID).toBe(0);
    });

    /* A child must not be rounded across the border of what holds it. */
    it('keeps a nested node inside its container', async () => {
      const doc = planDocSchema.parse({
        id: 'plan-4',
        title: 'Nested',
        updatedAt: '2026-01-01T00:00:00.000Z',
        nodes: [
          { slug: 'group', title: 'Group' },
          { slug: 'child', title: 'A' },
        ],
        edges: [{ id: 'c1', kind: 'contains', from: 'group', to: 'child' }],
      });
      const { positions, sizes } = await layoutPlan(doc);
      const box = sizes.get('group')!;
      const at = positions.get('group')!;
      const child = positions.get('child')!;
      expect(child.x).toBeGreaterThanOrEqual(at.x);
      expect(child.y).toBeGreaterThanOrEqual(at.y);
      expect(child.x).toBeLessThanOrEqual(at.x + box.width);
      expect(child.y).toBeLessThanOrEqual(at.y + box.height);
    });

    /* The translation onto pinned work is a whole number of steps, or it would
       carry every freshly placed node straight back off the grid. */
    it('stays on it when the layout is anchored to pinned nodes', async () => {
      const doc = plan({
        nodes: planDocSchema.shape.nodes.parse([
          // Deliberately off the grid, and off it on both axes.
          { slug: 'db', title: 'Database', position: { x: 137, y: -43 }, pinned: true },
          { slug: 'auth', title: 'Auth' },
          { slug: 'ui', title: 'UI' },
        ]),
      });
      const { positions } = await layoutPlan(doc);
      expect(positions.has('db')).toBe(false);
      expect([...positions.values()].every(onGrid)).toBe(true);
    });
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

    /*
     * Layout no longer says where the writing goes.
     *
     * It placed labels on the edges *it* routed, through its own channels and
     * ports — and the canvas draws its own orthogonal runs instead. So a point
     * recorded here was a point on a line in a picture nobody sees, and on a
     * freshly arranged plan every note floated clear of the flow it belonged
     * to. The canvas works it out from the route it actually draws.
     */
    it('says nothing about where the writing goes', async () => {
      const { labels } = await layoutPlan(busy(), { scope: 'all' });
      expect(labels.size).toBe(0);
    });

    /*
     * The labels are still declared on the way in, and this is why: ELK leaves
     * room in a corridor for writing it knows is coming. That part of its
     * answer is worth having, and it shows up as space between the flows rather
     * than as a position.
     */
    it('still leaves the flows room to be written on', async () => {
      const { positions } = await layoutPlan(busy(), { scope: 'all' });
      const rows = ['one', 'two', 'three', 'four']
        .map((slug) => positions.get(slug)?.y ?? 0)
        .sort((a, b) => a - b);
      for (let index = 1; index < rows.length; index += 1) {
        expect((rows[index] ?? 0) - (rows[index - 1] ?? 0)).toBeGreaterThan(40);
      }
    });
  });
});

describe('the size of a box', () => {
  const held = () =>
    planDocSchema.parse({
      id: 'p',
      title: 'P',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'box', title: 'Box', size: { width: 900, height: 700 } },
        { slug: 'inside', title: 'Inside' },
        { slug: 'loose', title: 'Loose' },
      ],
      edges: [{ id: 'contains:box>inside', kind: 'contains', from: 'box', to: 'inside' }],
    });

  /*
   * A box is drawn around what it holds, wherever one is drawn — on the canvas,
   * in the export, and here. So a size written on one is the record of a
   * measurement and never an instruction, and a run measures it afresh.
   */
  it('is what holds its contents, not the size written on it', async () => {
    const { sizes } = await layoutPlan(held(), { scope: 'unpinned' });
    const box = sizes.get('box');
    expect(box).toBeDefined();
    expect(box?.width).toBeLessThan(900);
    expect(box?.height).toBeLessThan(700);
  });

  it('follows what it holds when that no longer fits', async () => {
    const tall = planDocSchema.parse({
      id: 'p',
      title: 'P',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'box', title: 'Box', size: { width: 300, height: 120 } },
        { slug: 'inside', title: 'Inside', body: 'line\n'.repeat(20) },
      ],
      edges: [{ id: 'contains:box>inside', kind: 'contains', from: 'box', to: 'inside' }],
    });

    const { sizes } = await layoutPlan(tall, { scope: 'unpinned' });
    expect(sizes.get('box')?.height).toBeGreaterThan(120);
  });

  it('is the same whether or not the arrange was asked for outright', async () => {
    const loose = (await layoutPlan(held(), { scope: 'unpinned' })).sizes.get('box');
    const whole = (await layoutPlan(held(), { scope: 'all' })).sizes.get('box');
    expect(loose).toEqual(whole);
  });

  it('does not stop the node being arranged', async () => {
    const { positions } = await layoutPlan(held(), { scope: 'unpinned' });
    expect(positions.has('box')).toBe(true);
  });

  it('still gives bounds to a box that has none', async () => {
    const plan = planDocSchema.parse({
      id: 'p',
      title: 'P',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'box', title: 'Box' },
        { slug: 'inside', title: 'Inside' },
      ],
      edges: [{ id: 'contains:box>inside', kind: 'contains', from: 'box', to: 'inside' }],
    });
    const { sizes } = await layoutPlan(plan, { scope: 'unpinned' });
    expect(sizes.has('box')).toBe(true);
  });
});

describe('a card with a lot to say', () => {
  const withBody = (body: string) =>
    planDocSchema.parse({
      id: 'p',
      title: 'P',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'a', title: 'A', body },
        { slug: 'b', title: 'B' },
      ],
      edges: [{ id: 'flows_to:a>b', kind: 'flows_to', from: 'a', to: 'b' }],
    });

  it('is laid out around the room it will actually need', async () => {
    const short = await layoutPlan(withBody('one line'), { scope: 'all' });
    const long = await layoutPlan(withBody('a line\n'.repeat(12)), { scope: 'all' });

    // Whatever the direction puts where, a taller card cannot leave the drawing
    // the same size as a short one.
    const span = (r: Awaited<ReturnType<typeof layoutPlan>>) => {
      const ys = [...r.positions.values()].map((p) => p.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(long.positions.size).toBe(2);
    expect(span(long)).toBeGreaterThanOrEqual(span(short));
  });
});
