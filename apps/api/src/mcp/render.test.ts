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
