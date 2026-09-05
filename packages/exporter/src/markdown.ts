import matter from 'gray-matter';
import type { PlanGraph, PlanNode } from '@schematic/schema';

/**
 * Frontmatter carries everything needed to rebuild the graph, so an exported
 * bundle is a complete description of the plan rather than a rendering of it.
 * Position is written only for pinned nodes: unpinned coordinates are layout
 * output and would add churn to every diff.
 */
export function nodeToMarkdown(node: PlanNode, graph: PlanGraph): string {
  const dependsOn = [...(graph.dependenciesOf.get(node.slug) ?? [])].sort();
  const contains = [...(graph.childrenOf.get(node.slug) ?? [])];

  const data: Record<string, unknown> = {
    slug: node.slug,
    title: node.title,
    kind: node.kind,
    status: node.status,
  };
  if (node.tags.length > 0) data['tags'] = node.tags;
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
