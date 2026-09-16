import { describe, expect, it } from 'vitest';
import { planDocSchema } from '@schematic/schema';

import { renderHistory, renderNodes, renderPlan } from './render.js';

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
  it('outlines the hierarchy', () => {
    const outline = renderPlan(doc, 'outline');
    expect(outline).toContain('- group [group/idea] Group');
    expect(outline).toContain('  - auth [task/idea] Auth');
  });

  /*
   * The flows are the drawing. Without them this listed a nesting, which is a
   * table of contents wearing a diagram's clothes — an agent reading back a
   * plan it had drawn could not see one thing it had said about how the system
   * works.
   */
  it('writes the flows out of each node into the outline', () => {
    const wired = planDocSchema.parse({
      id: 'p3',
      title: 'Wired',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'form', title: 'Form' },
        { slug: 'api', title: 'API' },
      ],
      edges: [
        {
          id: 'f1',
          kind: 'flows_to',
          from: 'form',
          to: 'api',
          via: 'click Sign in',
          carries: '{ email }',
        },
      ],
    });

    expect(renderPlan(wired, 'outline')).toContain('--> api (click Sign in: { email })');
  });

  it('keeps a depends_on in the outline, in the direction it is recorded', () => {
    expect(renderPlan(doc, 'outline')).toContain('--depends_on--> db');
  });

  it('marks which nodes have something written on them', () => {
    const written = planDocSchema.parse({
      id: 'p4',
      title: 'Written',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'said', title: 'Said', body: 'the whole point' },
        { slug: 'bare', title: 'Bare' },
      ],
    });

    const outline = renderPlan(written, 'outline');
    expect(outline).toContain('Said *');
    expect(outline).toContain('Bare');
    expect(outline).not.toContain('Bare *');
    expect(outline).not.toContain('the whole point');
    expect(renderPlan(written, 'detail')).toContain('| the whole point');
  });

  it('never leaks coordinates into any view', () => {
    for (const view of ['outline', 'detail', 'graph', 'markdown'] as const) {
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

describe('renderNodes', () => {
  const written = planDocSchema.parse({
    id: 'p5',
    title: 'Written',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { slug: 'form', title: 'Form', body: 'Two fields and a button.', tags: ['ui'] },
      { slug: 'api', title: 'API' },
    ],
    edges: [
      { id: 'f1', kind: 'flows_to', from: 'form', to: 'api', via: 'click Sign in' },
    ],
  });

  it('gives back what a node actually says', () => {
    const rendered = renderNodes(written, ['form']);
    expect(rendered).toContain('## Form (form)');
    expect(rendered).toContain('Two fields and a button.');
    expect(rendered).toContain('tags: ui');
  });

  it('says what the node is wired to, in both directions', () => {
    expect(renderNodes(written, ['form'])).toContain('flows_to --> api (click Sign in)');
    expect(renderNodes(written, ['api'])).toContain('flows_to <-- form (click Sign in)');
  });

  it('says so rather than inventing a node that is not there', () => {
    const rendered = renderNodes(written, ['form', 'ghost']);
    expect(rendered).toContain('## Form (form)');
    expect(rendered).toContain('ghost');
  });

  it('is plain about a node nobody has written on', () => {
    expect(renderNodes(written, ['api'])).toContain('nothing written here yet');
  });
});

describe('renderHistory', () => {
  const at = new Date('2026-01-02T03:04:05.000Z');

  it('says who did what, and when', () => {
    const rendered = renderHistory([
      {
        kind: 'node.body',
        subject: 'form',
        label: 'Form',
        detail: 'rewrote it',
        at,
        batchId: null,
        by: { name: 'Ruma', agent: null },
      },
    ]);

    expect(rendered).toContain('Ruma');
    expect(rendered).toContain('node.body');
    expect(rendered).toContain('form');
  });

  it('names the agent rather than the account it signed in as', () => {
    const rendered = renderHistory([
      {
        kind: 'node.added',
        subject: 'api',
        label: 'API',
        detail: null,
        at,
        batchId: 'b1',
        by: { name: 'Ruma', agent: 'claude' },
      },
    ]);

    expect(rendered).toContain('claude');
  });

  it('is plain about a plan nothing has happened to', () => {
    expect(renderHistory([])).toContain('Nothing has changed');
  });
});
