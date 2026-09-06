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
 * `flows_to` is the one that draws the system: control or data moves from one
 * node to the next, in the direction it actually moves. A request and its reply
 * are two of them, pointing opposite ways.
 *
 * `contains` nests one node inside another and becomes directory structure on
 * export. `depends_on` orders siblings and becomes the numeric filename prefix —
 * it says what must exist first, which is not the same as what calls what.
 * `relates_to` is a plain association carrying no structural meaning.
 */
export const planEdgeKinds = ['flows_to', 'contains', 'depends_on', 'relates_to'] as const;
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
 *
 * What triggers a flow is part of that identity: one screen may reach the same
 * endpoint from two different buttons, and those are two flows, not one.
 */
export function edgeId(
  kind: PlanEdgeKind,
  from: string,
  to: string,
  via: string | null = null,
): string {
  const trigger = via === null || via.trim() === '' ? '' : `#${fingerprint(via)}`;
  return `${kind}:${from}>${to}${trigger}`;
}

/** A short, stable stand-in for a trigger, so an id stays inside its limit. */
function fingerprint(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

export const planEdgeSchema = z.object({
  id: z.string().min(1).max(160),
  kind: z.enum(planEdgeKinds).default('depends_on'),
  from: slugSchema,
  to: slugSchema,
  label: z.string().max(120).nullable().default(null),
  /** What sets this flow off: a click, a route change, a request, a timer. */
  via: z.string().max(200).nullable().default(null),
  /** What travels along it: a payload, a record, an event, a return value. */
  carries: z.string().max(400).nullable().default(null),
  /**
   * Where the writing on the line goes. Layout output, like a node's position:
   * the midpoint of a path is where every parallel line puts its note, and in a
   * busy corridor they land on top of each other. `null` means nobody has laid
   * this out yet, and the drawing falls back to the midpoint.
   */
  labelPosition: positionSchema.nullable().default(null),
});
export type PlanEdge = z.infer<typeof planEdgeSchema>;

/**
 * Everything but the two ends is optional here, and `normalizeEdge` fills the
 * rest in. Requiring each field to be spelled out meant that adding one to an
 * edge broke every literal in the codebase that had no opinion about it.
 */
export const planEdgeInputSchema = z.object({
  id: z.string().min(1).max(160).optional(),
  kind: z.enum(planEdgeKinds).default('depends_on'),
  from: slugSchema,
  to: slugSchema,
  label: z.string().max(120).nullish(),
  /** What sets this flow off: a click, a route change, a request, a timer. */
  via: z.string().max(200).nullish(),
  /** What travels along it: a payload, a record, an event, a return value. */
  carries: z.string().max(400).nullish(),
  /** Where the writing on the line goes. Layout output, like a node's position. */
  labelPosition: positionSchema.nullish(),
});
export type PlanEdgeInput = z.input<typeof planEdgeInputSchema>;

export function normalizeEdge(input: z.infer<typeof planEdgeInputSchema>): PlanEdge {
  return {
    id: input.id ?? edgeId(input.kind, input.from, input.to, input.via ?? null),
    kind: input.kind,
    from: input.from,
    to: input.to,
    label: input.label ?? null,
    via: input.via ?? null,
    carries: input.carries ?? null,
    labelPosition: input.labelPosition ?? null,
  };
}

/**
 * What is written on a line. A flow says what set it off and what it took
 * along; anything else carries a plain label. Read by the canvas, by layout
 * when it reserves room for it, and by the export.
 */
export function edgeNote(edge: Pick<PlanEdge, 'kind' | 'label' | 'via' | 'carries'>): string {
  if (edge.kind !== 'flows_to') return edge.label ?? '';
  return [edge.via, edge.carries].filter((part) => part !== null && part !== '').join(': ');
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
