import { z } from 'zod';

import { SLUG_MAX_LENGTH, SLUG_PATTERN } from './slug.js';

export const PLAN_DOC_VERSION = 1;

export const planNodeKinds = ['feature', 'task', 'decision', 'note', 'group'] as const;
export type PlanNodeKind = (typeof planNodeKinds)[number];

export const planNodeStatuses = [
  'idea',
  'planned',
  'in_progress',
  'blocked',
  'done',
  'dropped',
] as const;
export type PlanNodeStatus = (typeof planNodeStatuses)[number];

/**
 * `contains` nests one node inside another and becomes directory structure on
 * export. `depends_on` orders siblings and becomes the numeric filename prefix.
 * `relates_to` is a plain association carrying no structural meaning.
 */
export const planEdgeKinds = ['contains', 'depends_on', 'relates_to'] as const;
export type PlanEdgeKind = (typeof planEdgeKinds)[number];

export const slugSchema = z
  .string()
  .min(1)
  .max(SLUG_MAX_LENGTH)
  .regex(SLUG_PATTERN, 'must be lowercase alphanumeric words joined by single hyphens');

export const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});
export type Position = z.infer<typeof positionSchema>;

export const sizeSchema = z.object({
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});

export const planNodeSchema = z.object({
  slug: slugSchema,
  kind: z.enum(planNodeKinds).default('task'),
  title: z.string().min(1).max(200),
  body: z.string().max(100_000).default(''),
  status: z.enum(planNodeStatuses).default('idea'),
  /** `null` means "unplaced" — layout is free to position it. */
  position: positionSchema.nullable().default(null),
  /** Set when a human has moved the node. Auto-layout must not touch it. */
  pinned: z.boolean().default(false),
  size: sizeSchema.nullable().default(null),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
});
export type PlanNode = z.infer<typeof planNodeSchema>;

/**
 * Edge identity is derived from its endpoints rather than generated, so the same
 * relationship submitted twice collapses to one edge instead of duplicating.
 */
export function edgeId(kind: PlanEdgeKind, from: string, to: string): string {
  return `${kind}:${from}>${to}`;
}

export const planEdgeSchema = z.object({
  id: z.string().min(1).max(160),
  kind: z.enum(planEdgeKinds).default('depends_on'),
  from: slugSchema,
  to: slugSchema,
  label: z.string().max(120).nullable().default(null),
});
export type PlanEdge = z.infer<typeof planEdgeSchema>;

export const planEdgeInputSchema = z.object({
  id: z.string().min(1).max(160).optional(),
  kind: z.enum(planEdgeKinds).default('depends_on'),
  from: slugSchema,
  to: slugSchema,
  label: z.string().max(120).nullable().default(null),
});
export type PlanEdgeInput = z.input<typeof planEdgeInputSchema>;

export function normalizeEdge(input: z.infer<typeof planEdgeInputSchema>): PlanEdge {
  return {
    id: input.id ?? edgeId(input.kind, input.from, input.to),
    kind: input.kind,
    from: input.from,
    to: input.to,
    label: input.label,
  };
}

const planBodySchema = z.object({
  version: z.literal(PLAN_DOC_VERSION).default(PLAN_DOC_VERSION),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  nodes: z.array(planNodeSchema).max(5000).default([]),
  edges: z.array(planEdgeSchema).max(20_000).default([]),
});

/** Referential integrity. Structural cycles are reported here; dependency cycles
 * are not, because export breaks those deterministically rather than rejecting. */
function checkIntegrity(
  doc: { nodes: PlanNode[]; edges: PlanEdge[] },
  ctx: z.RefinementCtx,
): void {
  const slugs = new Set<string>();
  doc.nodes.forEach((node, index) => {
    if (slugs.has(node.slug)) {
      ctx.addIssue({
        code: 'custom',
        message: `duplicate node slug "${node.slug}"`,
        path: ['nodes', index, 'slug'],
      });
    }
    slugs.add(node.slug);
  });

  const parentOf = new Map<string, string>();
  doc.edges.forEach((edge, index) => {
    for (const [side, slug] of [
      ['from', edge.from],
      ['to', edge.to],
    ] as const) {
      if (!slugs.has(slug)) {
        ctx.addIssue({
          code: 'custom',
          message: `edge references unknown node "${slug}"`,
          path: ['edges', index, side],
        });
      }
    }

    if (edge.from === edge.to) {
      ctx.addIssue({
        code: 'custom',
        message: `edge connects "${edge.from}" to itself`,
        path: ['edges', index],
      });
      return;
    }

    if (edge.kind !== 'contains') return;

    const existing = parentOf.get(edge.to);
    if (existing !== undefined && existing !== edge.from) {
      ctx.addIssue({
        code: 'custom',
        message: `"${edge.to}" is already contained by "${existing}"`,
        path: ['edges', index],
      });
      return;
    }
    parentOf.set(edge.to, edge.from);
  });

  for (const start of parentOf.keys()) {
    const seen = new Set<string>([start]);
    let cursor = parentOf.get(start);
    while (cursor !== undefined) {
      if (seen.has(cursor)) {
        ctx.addIssue({
          code: 'custom',
          message: `containment cycle through "${cursor}"`,
          path: ['edges'],
        });
        break;
      }
      seen.add(cursor);
      cursor = parentOf.get(cursor);
    }
  }
}

export const planDocSchema = planBodySchema
  .extend({
    id: z.string().min(1).max(64),
    updatedAt: z.string().min(1),
  })
  .superRefine(checkIntegrity);
export type PlanDoc = z.infer<typeof planDocSchema>;

/** What an agent submits to `create_plan`: structure without server-owned fields. */
export const planSpecSchema = planBodySchema
  .omit({ edges: true })
  .extend({ edges: z.array(planEdgeInputSchema).max(20_000).default([]) });
export type PlanSpec = z.infer<typeof planSpecSchema>;
export type PlanSpecInput = z.input<typeof planSpecSchema>;

export function emptyPlanDoc(id: string, title: string): PlanDoc {
  return {
    version: PLAN_DOC_VERSION,
    id,
    title,
    description: '',
    nodes: [],
    edges: [],
    updatedAt: new Date(0).toISOString(),
  };
}
