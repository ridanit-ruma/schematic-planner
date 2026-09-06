import type { PlanDoc, PlanEdge, PlanNode } from './plan.js';

export type TraceDirection = 'downstream' | 'upstream' | 'both';

export interface TraceStep {
  /** The node arrived at. */
  readonly node: PlanNode;
  /** The flow that led here, or null for the node the walk started from. */
  readonly along: PlanEdge | null;
  /** Depth from the starting node. */
  readonly depth: number;
  /**
   * Why this step was not followed any further, if it was not.
   *
   * `loop` — it is already on this path, so going on would go round again.
   * `seen` — it was reached by another route and everything under it has been
   *   written out once. Expanding it again would repeat a whole subtree; in a
   *   busy graph that is most of the answer, twice.
   */
  readonly repeat: 'loop' | 'seen' | null;
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
 * where the request came from — so a branch that meets a node already on its
 * own path says so and stops.
 *
 * Each node is also expanded only once across the whole walk. Two routes into
 * the same part are worth showing; what hangs off it is identical the second
 * time, and repeating it can be most of the answer written twice.
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
  const expanded = new Set<string>();
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

      const onwards =
        here.repeat !== null || here.depth >= settings.depth
          ? []
          : (next.get(here.node.slug) ?? []);
      expanded.add(here.node.slug);

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
            repeat: trail.some((step) => step.node.slug === node.slug)
              ? 'loop'
              : expanded.has(node.slug)
                ? 'seen'
                : null,
          },
        ]);
      }
    };

    // Each direction is its own reading, so what one expanded does not silence
    // the other.
    expanded.clear();
    walk([{ node: from, along: null, depth: 0, repeat: null }]);
  }

  return { start: from, paths, reached, truncated };
}

function push(map: Map<string, PlanEdge[]>, key: string, edge: PlanEdge): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [edge]);
  else list.push(edge);
}
