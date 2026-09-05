import { exportPlan } from '@schematic/exporter';
import { buildPlanGraph, type PlanDoc } from '@schematic/schema';

export type PlanView = 'outline' | 'graph' | 'markdown';

/**
 * Positions and styling are excluded from every view. An agent declares
 * structure and never needs coordinates, and sending them would spend the
 * caller's context on numbers it cannot use.
 */
export function renderPlan(doc: PlanDoc, view: PlanView): string {
  if (view === 'graph') {
    return JSON.stringify(
      {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        nodes: doc.nodes.map((node) => ({
          slug: node.slug,
          kind: node.kind,
          title: node.title,
          status: node.status,
          ...(node.tags.length > 0 && { tags: node.tags }),
        })),
        edges: doc.edges.map((edge) => ({ kind: edge.kind, from: edge.from, to: edge.to })),
      },
      null,
      2,
    );
  }

  if (view === 'markdown') {
    // The real export keeps pinned coordinates so a round trip preserves manual
    // layout. A view an agent reads should not: it cannot act on them.
    const withoutPlacement: PlanDoc = {
      ...doc,
      nodes: doc.nodes.map((node) => ({ ...node, position: null, pinned: false, size: null })),
    };
    return exportPlan(withoutPlacement, { canvas: false, planJson: false })
      .files.map((file) => `### ${file.path}\n\n${file.content}`)
      .join('\n\n');
  }

  return outline(doc);
}

function outline(doc: PlanDoc): string {
  const graph = buildPlanGraph(doc);
  const lines = [`# ${doc.title}`];
  if (doc.description !== '') lines.push('', doc.description);
  lines.push('');

  const walk = (slugs: readonly string[], depth: number): void => {
    for (const slug of slugs) {
      const node = graph.nodes.get(slug);
      if (node === undefined) continue;

      const deps = [...(graph.dependenciesOf.get(slug) ?? [])].sort();
      const needs = deps.length === 0 ? '' : ` (needs: ${deps.join(', ')})`;
      lines.push(
        `${'  '.repeat(depth)}- ${node.slug} [${node.kind}/${node.status}] ${node.title}${needs}`,
      );
      walk(graph.childrenOf.get(slug) ?? [], depth + 1);
    }
  };
  walk(graph.roots, 0);

  if (doc.nodes.length === 0) lines.push('_empty plan_');
  return lines.join('\n');
}
