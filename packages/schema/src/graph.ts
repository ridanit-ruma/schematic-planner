import type { PlanDoc, PlanNode } from './plan.js';

export interface PlanGraph {
  readonly nodes: ReadonlyMap<string, PlanNode>;
  /** child slug -> containing parent slug */
  readonly parentOf: ReadonlyMap<string, string>;
  /** parent slug -> contained children, sorted by slug */
  readonly childrenOf: ReadonlyMap<string, readonly string[]>;
  /** node slug -> nodes it depends on */
  readonly dependenciesOf: ReadonlyMap<string, readonly string[]>;
  /** node slug -> nodes that depend on it */
  readonly dependentsOf: ReadonlyMap<string, readonly string[]>;
  /** nodes with no containing parent, sorted by slug */
  readonly roots: readonly string[];
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const bucket = map.get(key);
  if (bucket === undefined) map.set(key, [value]);
  else if (!bucket.includes(value)) bucket.push(value);
}

export function buildPlanGraph(doc: Pick<PlanDoc, 'nodes' | 'edges'>): PlanGraph {
  const nodes = new Map<string, PlanNode>();
  for (const node of doc.nodes) nodes.set(node.slug, node);

  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const dependenciesOf = new Map<string, string[]>();
  const dependentsOf = new Map<string, string[]>();

  for (const edge of doc.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to) || edge.from === edge.to) continue;

    if (edge.kind === 'contains') {
      // A node keeps its first parent. Schema validation rejects a second one,
      // but the graph builder also runs on unvalidated collaborative state.
      if (!parentOf.has(edge.to)) {
        parentOf.set(edge.to, edge.from);
        push(childrenOf, edge.from, edge.to);
      }
    } else if (edge.kind === 'depends_on') {
      push(dependenciesOf, edge.from, edge.to);
      push(dependentsOf, edge.to, edge.from);
    }
  }

  for (const children of childrenOf.values()) children.sort();

  const roots = [...nodes.keys()].filter((slug) => !parentOf.has(slug)).sort();

  return { nodes, parentOf, childrenOf, dependenciesOf, dependentsOf, roots };
}

export interface TopologicalOrder {
  /** Every input slug exactly once. Cyclic members come last, sorted. */
  readonly order: readonly string[];
  /** Strongly connected components of size > 1 found in the scope. */
  readonly cycles: readonly (readonly string[])[];
}

/**
 * Kahn's algorithm over `slugs` only; dependencies pointing outside the scope are
 * ignored, which is what ordering siblings inside one directory needs. Ties are
 * broken by slug so the same plan always exports to the same filenames.
 */
export function topologicalOrder(
  slugs: readonly string[],
  dependenciesOf: ReadonlyMap<string, readonly string[]>,
): TopologicalOrder {
  const scope = new Set(slugs);
  const deps = new Map<string, Set<string>>();
  const dependents = new Map<string, string[]>();

  for (const slug of scope) {
    deps.set(slug, new Set());
    dependents.set(slug, []);
  }
  for (const slug of scope) {
    for (const dep of dependenciesOf.get(slug) ?? []) {
      if (!scope.has(dep) || dep === slug) continue;
      deps.get(slug)?.add(dep);
      dependents.get(dep)?.push(slug);
    }
  }

  const remaining = new Map<string, number>();
  const ready: string[] = [];
  for (const slug of scope) {
    const count = deps.get(slug)?.size ?? 0;
    remaining.set(slug, count);
    if (count === 0) ready.push(slug);
  }

  const order: string[] = [];
  while (ready.length > 0) {
    ready.sort();
    const slug = ready.shift();
    if (slug === undefined) break;
    order.push(slug);
    for (const dependent of dependents.get(slug) ?? []) {
      const left = (remaining.get(dependent) ?? 0) - 1;
      remaining.set(dependent, left);
      if (left === 0) ready.push(dependent);
    }
  }

  if (order.length === scope.size) return { order, cycles: [] };

  const stuck = [...scope].filter((slug) => !order.includes(slug)).sort();
  const cycles = stronglyConnectedComponents(stuck, deps).filter((scc) => scc.length > 1);

  return { order: [...order, ...stuck], cycles };
}

/** Tarjan, used only to name the members of a cycle in a warning. */
function stronglyConnectedComponents(
  slugs: readonly string[],
  deps: ReadonlyMap<string, ReadonlySet<string>>,
): string[][] {
  const scope = new Set(slugs);
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let counter = 0;

  const visit = (slug: string): void => {
    index.set(slug, counter);
    lowlink.set(slug, counter);
    counter += 1;
    stack.push(slug);
    onStack.add(slug);

    for (const next of deps.get(slug) ?? []) {
      if (!scope.has(next)) continue;
      if (!index.has(next)) {
        visit(next);
        lowlink.set(slug, Math.min(lowlink.get(slug) ?? 0, lowlink.get(next) ?? 0));
      } else if (onStack.has(next)) {
        lowlink.set(slug, Math.min(lowlink.get(slug) ?? 0, index.get(next) ?? 0));
      }
    }

    if (lowlink.get(slug) !== index.get(slug)) return;

    const component: string[] = [];
    for (;;) {
      const member = stack.pop();
      if (member === undefined) break;
      onStack.delete(member);
      component.push(member);
      if (member === slug) break;
    }
    components.push(component.sort());
  };

  for (const slug of slugs) if (!index.has(slug)) visit(slug);

  return components.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));
}

/** Depth of a node in the containment tree. Roots are 0. */
export function containmentDepth(graph: PlanGraph, slug: string): number {
  let depth = 0;
  let cursor = graph.parentOf.get(slug);
  const seen = new Set<string>([slug]);
  while (cursor !== undefined && !seen.has(cursor)) {
    seen.add(cursor);
    depth += 1;
    cursor = graph.parentOf.get(cursor);
  }
  return depth;
}
