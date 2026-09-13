import { describe, expect, it } from 'vitest';
import { planDocSchema } from '@schematic/schema';

import { renderPlan } from './render.js';

const doc = planDocSchema.parse({
  id: 'p1',
  title: 'Plan',
  description: 'Notes.',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    { slug: 'group', title: 'Group', kind: 'group', position: { x: 5, y: 5 }, pinned: true },
    { slug: 'db', title: 'Database', status: 'done' },
    { slug: 'auth', title: 'Auth' },
  ],
  edges: [
    { id: 'c1', kind: 'contains', from: 'group', to: 'db' },
    { id: 'c2', kind: 'contains', from: 'group', to: 'auth' },
    { id: 'd1', kind: 'depends_on', from: 'auth', to: 'db' },
  ],
});

describe('renderPlan', () => {
  it('outlines the hierarchy with dependencies inline', () => {
    const outline = renderPlan(doc, 'outline');
    expect(outline).toContain('- group [group/idea] Group');
    expect(outline).toContain('  - auth [task/idea] Auth (needs: db)');
  });

  it('never leaks coordinates into any view', () => {
    for (const view of ['outline', 'graph', 'markdown'] as const) {
      const rendered = renderPlan(doc, view);
      expect(rendered).not.toContain('"x"');
      expect(rendered).not.toContain('position');
      expect(rendered).not.toContain('pinned');
    }
  });

  it('emits parseable json for the graph view', () => {
    const parsed = JSON.parse(renderPlan(doc, 'graph')) as { nodes: unknown[]; edges: unknown[] };
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.edges).toHaveLength(3);
  });

  it('renders an empty plan without crashing', () => {
    const empty = planDocSchema.parse({
      id: 'p2',
      title: 'Empty',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(renderPlan(empty, 'outline')).toContain('_empty plan_');
  });
});

import { renderPlanList } from './render.js';

const url = (id: string) => `https://example.test/plan/${id}`;

describe('renderPlanList', () => {
  const listing = [
    {
      workspace: 'demo',
      project: 'billing',
      folders: [
        { id: 'f1', name: 'Architecture' },
        { id: 'f2', name: 'Spikes' },
      ],
      plans: [
        { id: 'p1', title: 'Billing rework', nodeCount: 8, folderId: null },
        { id: 'p2', title: 'Invoice rendering', nodeCount: 12, folderId: 'f1' },
      ],
    },
  ];

  it('files each plan under the folder it is in', () => {
    const lines = renderPlanList(listing, url).split('\n');
    const folder = lines.findIndex((line) => line.trim() === 'Architecture');
    const filed = lines.findIndex((line) => line.includes('Invoice rendering'));
    expect(folder).toBeGreaterThan(-1);
    expect(filed).toBeGreaterThan(folder);
    expect(lines[filed]?.startsWith('    ')).toBe(true);
  });

  it('leaves a plan in no folder at the project level', () => {
    const line = renderPlanList(listing, url)
      .split('\n')
      .find((candidate) => candidate.includes('Billing rework'));
    expect(line?.startsWith('  ')).toBe(true);
    expect(line?.startsWith('    ')).toBe(false);
  });

  /* An empty folder is a place somebody made; an agent that cannot see it will
     make a second one with the same name. */
  it('shows a folder with nothing in it', () => {
    expect(renderPlanList(listing, url)).toContain('Spikes');
  });

  it('gives every plan its id and its address', () => {
    const out = renderPlanList(listing, url);
    expect(out).toContain('id p2');
    expect(out).toContain('https://example.test/plan/p2');
  });

  it('says so when there is nothing at all', () => {
    expect(renderPlanList([], url)).toMatch(/no plans/i);
  });
});
