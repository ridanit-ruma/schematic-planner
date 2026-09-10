import {
  PLAN_DOC_VERSION,
  planCommentSchema,
  planEdgeSchema,
  planNodeSchema,
  type PlanComment,
  type PlanDoc,
  type PlanEdge,
  type PlanNode,
} from './plan.js';

export interface SanitizeResult {
  readonly doc: PlanDoc;
  /** One line per thing that had to be discarded, for logging or a warning. */
  readonly dropped: readonly string[];
}

export interface SanitizeInput {
  id: string;
  title?: unknown;
  description?: unknown;
  updatedAt?: string;
  nodes: readonly unknown[];
  edges: readonly unknown[];
  comments?: readonly unknown[];
}

/**
 * Turn arbitrary raw plan data into a valid PlanDoc by discarding what cannot be
 * kept, rather than rejecting the whole document.
 *
 * Concurrent edits produce states no single client ever intended: deleting a
 * node while someone else draws an edge to it leaves that edge dangling. The
 * read model has to cope with those instead of failing, so repair is the
 * behaviour here and strict validation stays in `planDocSchema`.
 */
export function sanitizePlanDoc(input: SanitizeInput): SanitizeResult {
  const dropped: string[] = [];

  const nodes = new Map<string, PlanNode>();
  for (const raw of input.nodes) {
    const parsed = planNodeSchema.safeParse(raw);
    if (!parsed.success) {
      dropped.push(`node discarded: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
      continue;
    }
    if (nodes.has(parsed.data.slug)) {
      dropped.push(`duplicate node "${parsed.data.slug}" discarded`);
      continue;
    }
    nodes.set(parsed.data.slug, parsed.data);
  }

  const edges = new Map<string, PlanEdge>();
  const parentOf = new Map<string, string>();

  for (const raw of input.edges) {
    const parsed = planEdgeSchema.safeParse(raw);
    if (!parsed.success) {
      dropped.push(`edge discarded: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
      continue;
    }
    const edge = parsed.data;

    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      dropped.push(`edge "${edge.id}" discarded: endpoint missing`);
      continue;
    }
    if (edge.from === edge.to) {
      dropped.push(`edge "${edge.id}" discarded: connects a node to itself`);
      continue;
    }

    if (edge.kind === 'contains') {
      const existing = parentOf.get(edge.to);
      if (existing !== undefined && existing !== edge.from) {
        dropped.push(`edge "${edge.id}" discarded: "${edge.to}" already inside "${existing}"`);
        continue;
      }
      if (wouldCloseCycle(parentOf, edge.from, edge.to)) {
        dropped.push(`edge "${edge.id}" discarded: would create a containment cycle`);
        continue;
      }
      parentOf.set(edge.to, edge.from);
    }

    edges.set(edge.id, edge);
  }

  const comments = new Map<string, PlanComment>();
  for (const raw of input.comments ?? []) {
    const parsed = planCommentSchema.safeParse(raw);
    if (!parsed.success) {
      dropped.push(`comment discarded: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
      continue;
    }
    const comment = parsed.data;
    if (comments.has(comment.id)) {
      dropped.push(`duplicate comment "${comment.id}" discarded`);
      continue;
    }
    // The node it was about is gone. The note is not: it is kept, floating,
    // because deleting somebody's question along with the box they asked it
    // about is how an objection disappears without being answered.
    comments.set(
      comment.id,
      comment.anchor !== null && !nodes.has(comment.anchor)
        ? { ...comment, anchor: null }
        : comment,
    );
  }

  const doc: PlanDoc = {
    version: PLAN_DOC_VERSION,
    id: input.id,
    title: typeof input.title === 'string' && input.title.trim() !== '' ? input.title : 'Untitled plan',
    description: typeof input.description === 'string' ? input.description : '',
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    comments: [...comments.values()],
    updatedAt: input.updatedAt ?? new Date(0).toISOString(),
  };

  return { doc, dropped };
}

/** Adding parent -> child closes a cycle when parent already sits under child. */
function wouldCloseCycle(
  parentOf: ReadonlyMap<string, string>,
  parent: string,
  child: string,
): boolean {
  const seen = new Set<string>();
  let cursor: string | undefined = parent;
  while (cursor !== undefined && !seen.has(cursor)) {
    if (cursor === child) return true;
    seen.add(cursor);
    cursor = parentOf.get(cursor);
  }
  return false;
}
