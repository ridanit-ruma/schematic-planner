import {
  buildPlanGraph,
  edgeNote,
  statusOf,
  workNodes,
  workState,
  type PlanDoc,
  type Vocabulary,
} from '@schematic/schema';

import { oneLine } from './inline.js';

/** How many ready tasks `plan.md` lists before saying how many it left out. */
export const READY_LISTED = 24;

/**
 * A D2 string literal: everything on one line, with quotes, backslashes and `$`
 * escaped — D2 substitutes `${name}` inside double quotes, and a title like
 * `Budget ${cost}` would stop the whole diagram compiling.
 */
export function d2String(text: string): string {
  return `"${oneLine(text).replace(/[\\"$]/g, (char) => `\\${char}`)}"`;
}

/** A Markdown table cell: one line, and a pipe that would end the cell escaped. */
function cell(text: string): string {
  return oneLine(text).replace(/\|/g, '\\|');
}

/**
 * The plan as D2, for a ```diagram fence: containment as nested containers,
 * dependencies and flows as arrows. Ids are slugs, quoted, and an arrow names
 * a nested node by its path from the top.
 */
export function planDiagram(doc: PlanDoc): string {
  const graph = buildPlanGraph(doc);
  const path = (slug: string): string => {
    const parent = graph.parentOf.get(slug);
    return parent === undefined ? d2String(slug) : `${path(parent)}.${d2String(slug)}`;
  };
  const lines = ['direction: right'];
  const declare = (slug: string, depth: number): void => {
    const node = graph.nodes.get(slug);
    if (node === undefined) return;
    const indent = '  '.repeat(depth);
    const children = graph.childrenOf.get(slug) ?? [];
    const head = `${indent}${d2String(slug)}: ${d2String(node.title)}`;
    if (children.length === 0) {
      lines.push(head);
      return;
    }
    lines.push(`${head} {`);
    for (const child of children) declare(child, depth + 1);
    lines.push(`${indent}}`);
  };
  for (const node of doc.nodes) if (!graph.parentOf.has(node.slug)) declare(node.slug, 0);
  for (const edge of doc.edges) {
    if (edge.kind !== 'depends_on' && edge.kind !== 'flows_to') continue;
    const note = edgeNote(edge);
    const label = edge.kind === 'depends_on' ? 'depends on' : note;
    lines.push(
      `${path(edge.from)} -> ${path(edge.to)}${label === '' ? '' : `: ${d2String(label)}`}`,
    );
  }
  return lines.join('\n');
}

/**
 * `plan.md`: the plan as one document to read or to hand on — where the work
 * stands, what can start now, and the structure as a diagram fence a renderer
 * such as Attacca draws and anything else shows as source.
 *
 * Pure, like the rest of the export: the same plan gives the same bytes.
 */
export function planSummary(doc: PlanDoc, vocabulary: Vocabulary): string {
  const sections = [`# ${oneLine(doc.title)}`];
  if (doc.description.trim() !== '') sections.push(doc.description.trim());

  const work = workNodes(doc, vocabulary);
  if (work.length > 0) {
    const counts = new Map<string, number>();
    for (const node of work) counts.set(node.status, (counts.get(node.status) ?? 0) + 1);
    const ordered = [
      ...vocabulary.statuses.map((status) => status.id).filter((id) => counts.has(id)),
      ...[...counts.keys()].filter((id) => statusOf(vocabulary, id) === undefined).sort(),
    ];
    sections.push(
      [
        '## Status',
        '',
        '| Status | Nodes |',
        '| --- | ---: |',
        ...ordered.map(
          (id) => `| ${cell(statusOf(vocabulary, id)?.name ?? id)} | ${counts.get(id)} |`,
        ),
      ].join('\n'),
    );

    const { ready } = workState(doc, vocabulary);
    const listed = ready
      .slice(0, READY_LISTED)
      .map((node) => `- ${cell(node.title)} (\`${node.slug}\`)`);
    if (ready.length > READY_LISTED) {
      listed.push(`- …and ${ready.length - READY_LISTED} more, left out here.`);
    }
    sections.push(
      [
        '## Ready now',
        '',
        ...(listed.length === 0 ? ['Nothing can be started now.'] : listed),
      ].join('\n'),
    );
  }

  if (doc.nodes.length > 0) {
    sections.push(`## Structure\n\n\`\`\`diagram\n${planDiagram(doc)}\n\`\`\``);
  }
  return `${sections.join('\n\n')}\n`;
}
