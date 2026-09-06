import { z } from 'zod';

import {
  edgeId,
  planDocSchema,
  planEdgeKinds,
  planEdgeInputSchema,
  planNodeKinds,
  planNodeStatuses,
  positionSchema,
  sizeSchema,
  slugSchema,
  normalizeEdge,
  type PlanDoc,
  type PlanEdge,
  type PlanNode,
} from './plan.js';

/** Every field but `slug` is optional: an upsert merges into whatever is there. */
export const planNodePatchSchema = z.object({
  slug: slugSchema,
  kind: z.enum(planNodeKinds).optional(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(100_000).optional(),
  status: z.enum(planNodeStatuses).optional(),
  position: positionSchema.nullable().optional(),
  pinned: z.boolean().optional(),
  size: sizeSchema.nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
});
export type PlanNodePatch = z.infer<typeof planNodePatchSchema>;

export const planOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('upsert_node'), node: planNodePatchSchema }),
  z.object({ op: z.literal('delete_node'), slug: slugSchema }),
  z.object({ op: z.literal('upsert_edge'), edge: planEdgeInputSchema }),
  z.object({
    op: z.literal('delete_edge'),
    // Either an explicit id, or the endpoints it would have been derived from.
    id: z.string().min(1).max(160).optional(),
    kind: z.enum(planEdgeKinds).default('depends_on'),
    from: slugSchema.optional(),
    to: slugSchema.optional(),
    /** Needed to name one of several flows between the same pair of nodes. */
    via: z.string().max(200).nullable().optional(),
  }),
  z.object({
    op: z.literal('set_plan'),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
  }),
]);
export type PlanOp = z.infer<typeof planOpSchema>;
export type PlanOpInput = z.input<typeof planOpSchema>;

export const planOpsSchema = z.array(planOpSchema).min(1).max(2000);

export class PlanOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanOpError';
  }
}

function newNode(patch: PlanNodePatch): PlanNode {
  return {
    slug: patch.slug,
    kind: patch.kind ?? 'task',
    // A node created without a title is named after its slug rather than
    // rejected: agents batch these, and one missing title should not fail 40 ops.
    title: patch.title ?? patch.slug,
    body: patch.body ?? '',
    status: patch.status ?? 'idea',
    position: patch.position ?? null,
    pinned: patch.pinned ?? false,
    size: patch.size ?? null,
    tags: patch.tags ?? [],
  };
}

function mergeNode(node: PlanNode, patch: PlanNodePatch): PlanNode {
  return {
    ...node,
    ...(patch.kind !== undefined && { kind: patch.kind }),
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.body !== undefined && { body: patch.body }),
    ...(patch.status !== undefined && { status: patch.status }),
    ...(patch.position !== undefined && { position: patch.position }),
    ...(patch.pinned !== undefined && { pinned: patch.pinned }),
    ...(patch.size !== undefined && { size: patch.size }),
    ...(patch.tags !== undefined && { tags: patch.tags }),
  };
}

function resolveEdgeId(op: Extract<PlanOp, { op: 'delete_edge' }>): string {
  if (op.id !== undefined) return op.id;
  if (op.from === undefined || op.to === undefined) {
    throw new PlanOpError('delete_edge needs either an id or both from and to');
  }
  return edgeId(op.kind, op.from, op.to, op.via ?? null);
}

/**
 * Pure reference implementation of the write path. `packages/ydoc` performs the
 * same operations against a CRDT; this version is the oracle both are tested
 * against. Ops apply all-or-nothing: the result is validated before it is
 * returned, so a batch that would leave dangling edges throws instead.
 */
export function applyPlanOps(doc: PlanDoc, ops: readonly PlanOp[]): PlanDoc {
  const nodes = new Map(doc.nodes.map((node) => [node.slug, node]));
  const edges = new Map(doc.edges.map((edge) => [edge.id, edge]));
  let { title, description } = doc;

  for (const op of ops) {
    switch (op.op) {
      case 'upsert_node': {
        const existing = nodes.get(op.node.slug);
        nodes.set(
          op.node.slug,
          existing === undefined ? newNode(op.node) : mergeNode(existing, op.node),
        );
        break;
      }
      case 'delete_node': {
        nodes.delete(op.slug);
        for (const [id, edge] of edges) {
          if (edge.from === op.slug || edge.to === op.slug) edges.delete(id);
        }
        break;
      }
      case 'upsert_edge': {
        const edge: PlanEdge = normalizeEdge(op.edge);
        edges.set(edge.id, edge);
        break;
      }
      case 'delete_edge': {
        edges.delete(resolveEdgeId(op));
        break;
      }
      case 'set_plan': {
        if (op.title !== undefined) title = op.title;
        if (op.description !== undefined) description = op.description;
        break;
      }
    }
  }

  const next = {
    ...doc,
    title,
    description,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };

  const parsed = planDocSchema.safeParse(next);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw new PlanOpError(`operations would leave the plan invalid: ${detail}`);
  }
  return parsed.data;
}
