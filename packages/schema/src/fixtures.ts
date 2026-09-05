import { planDocSchema, type PlanDoc } from './plan.js';

interface NodeSeed {
  slug: string;
  title?: string;
  kind?: string;
}

interface EdgeSeed {
  kind: string;
  from: string;
  to: string;
}

/** Test helper: build a validated PlanDoc from a terse description. */
export function makeDoc(nodes: NodeSeed[], edges: EdgeSeed[] = []): PlanDoc {
  return planDocSchema.parse({
    id: 'plan-test',
    title: 'Test plan',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: nodes.map((node) => ({ title: node.slug, ...node })),
    edges: edges.map((edge) => ({ id: `${edge.kind}:${edge.from}>${edge.to}`, ...edge })),
  });
}
