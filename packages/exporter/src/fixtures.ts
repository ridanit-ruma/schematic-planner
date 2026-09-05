import { planDocSchema, type PlanDoc } from '@schematic/schema';

/**
 * Two root containers where the second depends on the first, and a dependency
 * between siblings inside the first. Exercises nesting and ordering together.
 */
export function samplePlan(): PlanDoc {
  return planDocSchema.parse({
    id: 'plan-1',
    title: 'Schematic Planner',
    description: 'The plan for the planner.',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { slug: 'foundation', title: 'Foundation', kind: 'group' },
      { slug: 'database', title: 'Database', status: 'done', tags: ['infra'] },
      { slug: 'auth', title: 'Auth', status: 'in_progress', body: 'Email and password first.' },
      { slug: 'editor', title: 'Editor', kind: 'group' },
      { slug: 'canvas', title: 'Canvas', position: { x: 120, y: 40 }, pinned: true },
    ],
    edges: [
      { id: 'contains:foundation>database', kind: 'contains', from: 'foundation', to: 'database' },
      { id: 'contains:foundation>auth', kind: 'contains', from: 'foundation', to: 'auth' },
      { id: 'contains:editor>canvas', kind: 'contains', from: 'editor', to: 'canvas' },
      { id: 'depends_on:auth>database', kind: 'depends_on', from: 'auth', to: 'database' },
      { id: 'depends_on:editor>foundation', kind: 'depends_on', from: 'editor', to: 'foundation' },
    ],
  });
}
