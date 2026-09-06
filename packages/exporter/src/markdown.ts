import matter from 'gray-matter';
import type { PlanEdge, PlanGraph, PlanNode } from '@schematic/schema';

/**
 * Frontmatter carries everything needed to rebuild the graph, so an exported
 * bundle is a complete description of the plan rather than a rendering of it.
 * Position is written only for pinned nodes: unpinned coordinates are layout
 * output and would add churn to every diff.
 */
export function nodeToMarkdown(node: PlanNode, graph: PlanGraph, edges: readonly PlanEdge[] = []): string {
  const dependsOn = [...(graph.dependenciesOf.get(node.slug) ?? [])].sort();
  const contains = [...(graph.childrenOf.get(node.slug) ?? [])];

  // Written as a list rather than a set of slugs: a flow is only readable
  // alongside what sets it off and what it carries.
  const flows = edges
    .filter((edge) => edge.kind === 'flows_to' && edge.from === node.slug)
    .map((edge) => ({
      to: edge.to,
      ...(edge.via !== null && edge.via !== '' && { via: edge.via }),
      ...(edge.carries !== null && edge.carries !== '' && { carries: edge.carries }),
    }));

  const data: Record<string, unknown> = {
    slug: node.slug,
    title: node.title,
    kind: node.kind,
    status: node.status,
  };
  if (node.tags.length > 0) data['tags'] = node.tags;
  if (flows.length > 0) data['flows_to'] = flows;
  if (dependsOn.length > 0) data['depends_on'] = dependsOn;
  if (contains.length > 0) data['contains'] = contains;
  if (node.pinned && node.position !== null) {
    data['pinned'] = true;
    data['position'] = { x: node.position.x, y: node.position.y };
  }

  const body = node.body.trim();
  const content = `\n# ${node.title}\n${body === '' ? '' : `\n${body}\n`}`;

  return matter.stringify(content, data);
}
