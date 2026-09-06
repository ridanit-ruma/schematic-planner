import type { PlanDoc, PlanEdge, PlanNode } from './plan.js';

export type TraceDirection = 'downstream' | 'upstream' | 'both';

export interface TraceStep {
  /** The node arrived at. */
  readonly node: PlanNode;
  /** The flow that led here, or null for the node the walk started from. */
  readonly along: PlanEdge | null;
  /** Depth from the starting node. */
  readonly depth: number;
  /** Set when this node is already on the path above: the branch stops here. */
  readonly revisits: boolean;
}

export interface TracePath {
  readonly direction: 'downstream' | 'upstream';
  readonly steps: readonly TraceStep[];
}

export interface TraceResult {
  readonly start: PlanNode;
  readonly paths: readonly TracePath[];
  /** Nodes reached, in the order first seen. What a reader needs the detail of. */
  readonly reached: readonly PlanNode[];
  /** Set when the walk stopped at its budget rather than at the end of the graph. */
  readonly truncated: boolean;
}

export interface TraceOptions {
  readonly direction?: TraceDirection;
  readonly depth?: number;
  /** Hard ceiling on steps produced, so one call cannot walk a whole large plan. */
  readonly budget?: number;
}

const DEFAULTS = { direction: 'downstream' as TraceDirection, depth: 6, budget: 200 };

/**
 * Finds a node by slug, then by an exact title, then by a title or tag that
 * contains the term. Agents refer to things by the name a person used, which is
 * rarely the slug.
 */
export function findNode(doc: Pick<PlanDoc, 'nodes'>, term: string): PlanNode | null {
  const needle = term.trim().toLowerCase();
  if (needle === '') return null;

  const bySlug = doc.nodes.find((node) => node.slug === needle);
  if (bySlug !== undefined) return bySlug;

  const byTitle = doc.nodes.find((node) => node.title.toLowerCase() === needle);
  if (byTitle !== undefined) return byTitle;

  return (
    doc.nodes.find(
      (node) =>
        node.title.toLowerCase().includes(needle) ||
        node.tags.some((tag) => tag.toLowerCase() === needle),
    ) ?? null
  );
}

/**
 * Follows the flows out of (or into) one node and reports the paths, not the
 * plan.
 *
 * This is how a plan is meant to be read: a system is understood by following
 * one thread through it, and handing over every node in the document instead
 * makes the reader do that work again from a pile.
 *
 * A cycle is a fact about real systems, not an error — a reply flows back to
 * where the request came from. So a branch that meets a node already on its own
 * path is marked as revisiting it and stops there. Other branches through the
 * same node keep going, because arriving somewhere twice by two routes is not
 * a loop.
 */
export function tracePlan(
  doc: Pick<PlanDoc, 'nodes' | 'edges'>,
  from: PlanNode,
  options: TraceOptions = {},
): TraceResult {
  const settings = { ...DEFAULTS, ...options };
  const nodes = new Map(doc.nodes.map((node) => [node.slug, node]));
  const flows = doc.edges.filter((edge) => edge.kind === 'flows_to');

  const out = new Map<string, PlanEdge[]>();
  const into = new Map<string, PlanEdge[]>();
  for (const edge of flows) {
    push(out, edge.from, edge);
    push(into, edge.to, edge);
  }

  const paths: TracePath[] = [];
  const reached: PlanNode[] = [from];
  const seen = new Set<string>([from.slug]);
  let spent = 0;
  let truncated = false;

  const directions: ('downstream' | 'upstream')[] =
    settings.direction === 'both' ? ['downstream', 'upstream'] : [settings.direction];

  for (const direction of directions) {
    const next = direction === 'downstream' ? out : into;
    const other = (edge: PlanEdge): string => (direction === 'downstream' ? edge.to : edge.from);

    const walk = (trail: TraceStep[]): void => {
      if (truncated) return;
      const here = trail[trail.length - 1];
      if (here === undefined) return;

      const onwards = here.revisits || here.depth >= settings.depth
        ? []
        : (next.get(here.node.slug) ?? []);

      if (onwards.length === 0) {
        paths.push({ direction, steps: [...trail] });
        return;
      }

      for (const edge of onwards) {
        if (spent >= settings.budget) {
          truncated = true;
          return;
        }
        spent += 1;

        const node = nodes.get(other(edge));
        if (node === undefined) continue;
        if (!seen.has(node.slug)) {
          seen.add(node.slug);
          reached.push(node);
        }

        walk([
          ...trail,
          {
            node,
            along: edge,
            depth: here.depth + 1,
            revisits: trail.some((step) => step.node.slug === node.slug),
          },
        ]);
      }
    };

    walk([{ node: from, along: null, depth: 0, revisits: false }]);
  }

  return { start: from, paths, reached, truncated };
}

function push(map: Map<string, PlanEdge[]>, key: string, edge: PlanEdge): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [edge]);
  else list.push(edge);
}
