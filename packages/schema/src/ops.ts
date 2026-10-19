import { z } from 'zod';

import {
  edgeId,
  metaSchema,
  planCommentPatchSchema,
  planDocSchema,
  planEdgeKinds,
  planEdgeInputSchema,
  positionSchema,
  sizeSchema,
  slugSchema,
  vocabularyValueSchema,
  normalizeEdge,
  type PlanComment,
  type PlanCommentPatch,
  type PlanDoc,
  type PlanEdge,
  type PlanNode,
} from './plan.js';

/** Every field but `slug` is optional: an upsert merges into whatever is there. */
export const planNodePatchSchema = z.object({
  slug: slugSchema,
  kind: vocabularyValueSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(100_000).optional(),
  status: vocabularyValueSchema.optional(),
  position: positionSchema.nullable().optional(),
  pinned: z.boolean().optional(),
  size: sizeSchema.nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  meta: metaSchema.optional(),
});
export type PlanNodePatch = z.infer<typeof planNodePatchSchema>;

export const planOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('upsert_node'), node: planNodePatchSchema }),
  z.object({ op: z.literal('delete_node'), slug: slugSchema }),
  /**
   * A node's identifier, changed along with everything that points at it.
   *
   * The slug is not decoration: it is the address an agent calls a node by and
   * the filename the node exports to, so a node whose title has moved on
   * carries a name from its first minute in both places. Every edge id is
   * derived from its endpoints, so renaming one end reissues every line
   * touching it, and anything said about the node follows.
   */
  z.object({ op: z.literal('rename_node'), from: slugSchema, to: slugSchema }),
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
  z.object({ op: z.literal('upsert_comment'), comment: planCommentPatchSchema }),
  z.object({ op: z.literal('delete_comment'), id: slugSchema }),
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
    meta: patch.meta ?? {},
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
    ...(patch.meta !== undefined && { meta: patch.meta }),
  };
}

function newComment(patch: PlanCommentPatch): PlanComment {
  return {
    id: patch.id,
    body: patch.body ?? '',
    author: patch.author ?? '',
    at: patch.at ?? new Date().toISOString(),
    position: patch.position ?? null,
    size: patch.size ?? null,
    anchor: patch.anchor ?? null,
    resolved: patch.resolved ?? false,
  };
}

function mergeComment(comment: PlanComment, patch: PlanCommentPatch): PlanComment {
  return {
    ...comment,
    ...(patch.body !== undefined && { body: patch.body }),
    ...(patch.author !== undefined && { author: patch.author }),
    ...(patch.at !== undefined && { at: patch.at }),
    ...(patch.position !== undefined && { position: patch.position }),
    ...(patch.size !== undefined && { size: patch.size }),
    ...(patch.anchor !== undefined && { anchor: patch.anchor }),
    ...(patch.resolved !== undefined && { resolved: patch.resolved }),
  };
}

function resolveEdgeId(op: Extract<PlanOp, { op: 'delete_edge' }>): string {
  if (op.id !== undefined) return op.id;
  if (op.from === undefined || op.to === undefined) {
    throw new PlanOpError('delete_edge needs either an id or both from and to');
  }
  return edgeId(op.kind, op.from, op.to, op.via ?? null);
}

/** How a line is drawn: only a person sets these, and nothing else writes them. */
const DRAWING = ['labelPosition', 'waypoints', 'fromSide', 'toSide'] as const;

/**
 * What an upsert keeps of an edge's drawing because it did not mention it.
 *
 * An agent rewriting a connection — to say what sets it off, say — sends the
 * ends and the words and never the geometry. Replacing the edge whole used to
 * throw away the bends and sides a person had drawn. Saying `null` or `[]`
 * still clears them.
 */
function drawing(
  before: PlanEdge,
  input: Partial<Record<(typeof DRAWING)[number], unknown>>,
): Partial<PlanEdge> {
  return Object.fromEntries(
    DRAWING.filter((key) => input[key] === undefined).map((key) => [key, before[key]]),
  );
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
  const comments = new Map(doc.comments.map((comment) => [comment.id, comment]));
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
      case 'rename_node': {
        if (op.from === op.to) break;
        const node = nodes.get(op.from);
        // Strict where the upserts are lenient, and deliberately. An upsert is
        // batched forty at a time and one bad field should not fail the other
        // thirty-nine; a rename is a single deliberate act, and renaming a node
        // that is not there has no reading under which the caller got what they
        // asked for.
        if (node === undefined) throw new PlanOpError(`no node "${op.from}" to rename`);
        if (nodes.has(op.to)) {
          throw new PlanOpError(`"${op.to}" is already another node's identifier`);
        }

        nodes.delete(op.from);
        nodes.set(op.to, { ...node, slug: op.to });

        for (const [id, edge] of [...edges]) {
          if (edge.from !== op.from && edge.to !== op.from) continue;
          edges.delete(id);
          const moved = {
            ...edge,
            from: edge.from === op.from ? op.to : edge.from,
            to: edge.to === op.from ? op.to : edge.to,
          };
          edges.set(edgeId(moved.kind, moved.from, moved.to, moved.via), {
            ...moved,
            id: edgeId(moved.kind, moved.from, moved.to, moved.via),
          });
        }

        for (const [id, comment] of comments) {
          if (comment.anchor === op.from) comments.set(id, { ...comment, anchor: op.to });
        }
        break;
      }
      case 'delete_node': {
        nodes.delete(op.slug);
        for (const [id, edge] of edges) {
          if (edge.from === op.slug || edge.to === op.slug) edges.delete(id);
        }
        // A note about the node outlives it, unanchored. See `sanitizePlanDoc`.
        for (const [id, comment] of comments) {
          if (comment.anchor === op.slug) comments.set(id, { ...comment, anchor: null });
        }
        break;
      }
      case 'upsert_edge': {
        const edge: PlanEdge = normalizeEdge(op.edge);
        const before = edges.get(edge.id);
        edges.set(edge.id, before === undefined ? edge : { ...edge, ...drawing(before, op.edge) });
        break;
      }
      case 'delete_edge': {
        edges.delete(resolveEdgeId(op));
        break;
      }
      case 'upsert_comment': {
        const existing = comments.get(op.comment.id);
        comments.set(
          op.comment.id,
          existing === undefined ? newComment(op.comment) : mergeComment(existing, op.comment),
        );
        break;
      }
      case 'delete_comment': {
        comments.delete(op.id);
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
    comments: [...comments.values()],
  };

  const parsed = planDocSchema.safeParse(next);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw new PlanOpError(`operations would leave the plan invalid: ${detail}`);
  }
  return parsed.data;
}

/**
 * The operations that turn `current` back into `target`: everything `target`
 * has is written in full, and everything it lacks is deleted.
 *
 * A restore is an ordinary write rather than a swap of the document, so it
 * reaches every open canvas, is recorded in the history like any edit, and can
 * itself be restored over.
 */
export function restoreOps(
  current: Pick<PlanDoc, 'nodes' | 'edges' | 'comments'>,
  target: Pick<PlanDoc, 'title' | 'description' | 'nodes' | 'edges' | 'comments'>,
): PlanOp[] {
  const keep = <T>(items: readonly T[], key: (item: T) => string) => new Set(items.map(key));
  const nodes = keep(target.nodes, (node) => node.slug);
  const edges = keep(target.edges, (edge) => edge.id);
  const comments = keep(target.comments, (comment) => comment.id);
  return [
    { op: 'set_plan', title: target.title, description: target.description },
    ...current.comments
      .filter((comment) => !comments.has(comment.id))
      .map((comment): PlanOp => ({ op: 'delete_comment', id: comment.id })),
    ...current.edges
      .filter((edge) => !edges.has(edge.id))
      .map((edge): PlanOp => ({ op: 'delete_edge', id: edge.id, kind: edge.kind })),
    ...current.nodes
      .filter((node) => !nodes.has(node.slug))
      .map((node): PlanOp => ({ op: 'delete_node', slug: node.slug })),
    ...target.nodes.map((node): PlanOp => ({ op: 'upsert_node', node })),
    ...target.edges.map((edge): PlanOp => ({ op: 'upsert_edge', edge })),
    ...target.comments.map((comment): PlanOp => ({ op: 'upsert_comment', comment })),
  ];
}
