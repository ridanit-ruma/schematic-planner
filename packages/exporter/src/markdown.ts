import matter from 'gray-matter';

import { oneLine, wikilinkLabel } from './inline.js';
import { RESERVED_META_KEYS, type PlanComment, type PlanEdge, type PlanGraph, type PlanNode } from '@schematic/schema';

/**
 * Frontmatter carries everything needed to rebuild the graph, so an exported
 * bundle is a complete description of the plan rather than a rendering of it.
 * Position is written only for pinned nodes: unpinned coordinates are layout
 * output and would add churn to every diff.
 */
export function nodeToMarkdown(
  node: PlanNode,
  graph: PlanGraph,
  edges: readonly PlanEdge[] = [],
  /** Where every node's file ended up, so the body can link to them. */
  fileOf: ReadonlyMap<string, string> = new Map(),
  comments: readonly PlanComment[] = [],
): string {
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

  // An association has no structure to become a directory or a file number, so
  // before this it was the one relation the export simply lost -- and in a vault
  // a plain link between two notes is most of what the vault is.
  const related = [
    ...new Set(
      edges
        .filter(
          (edge) =>
            edge.kind === 'relates_to' && (edge.from === node.slug || edge.to === node.slug),
        )
        .map((edge) => (edge.from === node.slug ? edge.to : edge.from)),
    ),
  ].sort();

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
  if (related.length > 0) data['related'] = related;
  // Frontmatter this product does not own, written back where it was found.
  // Guarded rather than trusted: the schema refuses a reserved key, and a
  // document repaired out of a live CRDT is not always what the schema saw.
  for (const [key, value] of Object.entries(node.meta)) {
    if (RESERVED_META_KEYS.has(key)) continue;
    data[key] = value;
  }
  if (node.pinned && node.position !== null) {
    data['pinned'] = true;
    data['position'] = { x: node.position.x, y: node.position.y };
  }

  const body = node.body.trim();
  // The filename is the title now, and Obsidian shows it above the note. An H1
  // saying the same thing is the title twice. A container is the exception: its
  // file is the README of a folder, which does not say what it holds.
  const sections = contains.length > 0 ? [`# ${oneLine(node.title)}`] : [];
  if (body !== '') sections.push(body);

  // Frontmatter slugs are how a machine rebuilds the graph; these are how a
  // person follows it. Obsidian builds its graph view, its backlinks and its
  // unlinked mentions out of wikilinks and nothing else, so an export without
  // them opens as a folder of unconnected notes however complete the
  // frontmatter is.
  const links = linkSection(node, graph, edges, fileOf);
  if (links !== null) sections.push(links);

  const said = notesSection(node.slug, comments);
  if (said !== null) sections.push(said);

  const content = sections.length === 0 ? '\n' : `\n${sections.join('\n\n')}\n`;
  return matter.stringify(content, data);
}

/** `[[path/to/file|Title]]`: a full path, because container notes are all README. */
function wikilink(slug: string, graph: PlanGraph, fileOf: ReadonlyMap<string, string>): string {
  const title = wikilinkLabel(graph.nodes.get(slug)?.title ?? slug);
  const path = fileOf.get(slug);
  if (path === undefined) return title;
  const target = path.replace(/\.md$/, '');
  return `[[${target}|${title}]]`;
}

function linkSection(
  node: PlanNode,
  graph: PlanGraph,
  edges: readonly PlanEdge[],
  fileOf: ReadonlyMap<string, string>,
): string | null {
  if (fileOf.size === 0) return null;
  const lines: string[] = [];
  const link = (slug: string): string => wikilink(slug, graph, fileOf);

  const parent = graph.parentOf.get(node.slug);
  if (parent !== undefined) lines.push(`- Inside ${link(parent)}`);
  for (const child of graph.childrenOf.get(node.slug) ?? []) lines.push(`- Holds ${link(child)}`);
  for (const need of [...(graph.dependenciesOf.get(node.slug) ?? [])].sort()) {
    lines.push(`- Needs ${link(need)} first`);
  }

  for (const edge of edges) {
    if (edge.kind === 'flows_to' && edge.from === node.slug) {
      const how = [edge.via, edge.carries].filter((part) => part !== null && part !== '');
      lines.push(`- Flows to ${link(edge.to)}${how.length === 0 ? '' : ` — ${how.join(': ')}`}`);
    } else if (edge.kind === 'flows_to' && edge.to === node.slug) {
      lines.push(`- Reached from ${link(edge.from)}`);
    } else if (
      edge.kind === 'relates_to' &&
      (edge.from === node.slug || edge.to === node.slug)
    ) {
      const other = edge.from === node.slug ? edge.to : edge.from;
      const label = edge.label === null || edge.label === '' ? '' : ` — ${edge.label}`;
      lines.push(`- Related: ${link(other)}${label}`);
    }
  }

  return lines.length === 0 ? null : `## Links\n\n${lines.join('\n')}`;
}

/**
 * What people said about this node, carried into the export.
 *
 * A note is not part of the system, so it never becomes a file of its own --
 * but an objection nobody answered is the most useful sentence on the page, and
 * dropping it from the Markdown would leave the export agreeing with itself.
 */
function notesSection(slug: string, comments: readonly PlanComment[]): string | null {
  const about = comments.filter((comment) => comment.anchor === slug);
  if (about.length === 0) return null;

  const lines = about.map((comment) => {
    const who = comment.author === '' ? 'Someone' : oneLine(comment.author);
    const state = comment.resolved ? ' _(resolved)_' : '';
    const said = comment.body.trim() === '' ? '_(empty)_' : comment.body.trim();
    return `> **${who}**${state}\n>\n${said
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')}`;
  });
  return `## Notes\n\n${lines.join('\n\n')}`;
}
