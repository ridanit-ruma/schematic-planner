import { buildPlanGraph, type PlanDoc } from '@schematic/schema';

import { toCanvas } from './canvas.js';
import { nodeToMarkdown } from './markdown.js';
import { assignPaths } from './paths.js';

export interface ExportFile {
  readonly path: string;
  readonly content: string;
}

export interface ExportBundle {
  readonly files: readonly ExportFile[];
  /** Non-fatal problems, e.g. dependency cycles that had to be broken. */
  readonly warnings: readonly string[];
}

export interface ExportOptions {
  /** Emit `plan.canvas`. Default true. */
  readonly canvas?: boolean;
  /** Emit `plan.json`, the machine-readable original. Default true. */
  readonly planJson?: boolean;
}

/**
 * `fileOf` is populated depth-first in export order, so re-grouping its keys by
 * parent gives a contents list whose order matches the numeric file prefixes.
 * Reading `graph.childrenOf` here instead would list children alphabetically and
 * disagree with the filenames beside them.
 */
function tableOfContents(
  graph: ReturnType<typeof buildPlanGraph>,
  fileOf: ReadonlyMap<string, string>,
): string {
  const roots: string[] = [];
  const childrenInOrder = new Map<string, string[]>();

  for (const slug of fileOf.keys()) {
    const parent = graph.parentOf.get(slug);
    if (parent === undefined) {
      roots.push(slug);
      continue;
    }
    const bucket = childrenInOrder.get(parent);
    if (bucket === undefined) childrenInOrder.set(parent, [slug]);
    else bucket.push(slug);
  }

  const lines: string[] = [];
  const walk = (slugs: readonly string[], depth: number): void => {
    for (const slug of slugs) {
      const node = graph.nodes.get(slug);
      const path = fileOf.get(slug);
      if (node === undefined || path === undefined) continue;

      const status = node.status === 'idea' ? '' : ` — \`${node.status}\``;
      lines.push(`${'  '.repeat(depth)}- [${node.title}](${path})${status}`);
      walk(childrenInOrder.get(slug) ?? [], depth + 1);
    }
  };
  walk(roots, 0);

  return lines.join('\n');
}

function overview(
  doc: PlanDoc,
  graph: ReturnType<typeof buildPlanGraph>,
  fileOf: ReadonlyMap<string, string>,
  warnings: readonly string[],
): string {
  const sections = [`# ${doc.title}`];
  if (doc.description.trim() !== '') sections.push(doc.description.trim());

  const toc = tableOfContents(graph, fileOf);
  sections.push(`## Contents\n\n${toc === '' ? '_This plan has no nodes yet._' : toc}`);

  if (warnings.length > 0) {
    sections.push(`## Warnings\n\n${warnings.map((w) => `- ${w}`).join('\n')}`);
  }

  sections.push(
    `---\n\nExported from Schematic Planner. \`plan.json\` holds the same content in machine-readable form.`,
  );

  return `${sections.join('\n\n')}\n`;
}

/**
 * The whole export is a pure function of the plan: no clock, no filesystem, no
 * randomness. The same plan always produces byte-identical output.
 */
export function exportPlan(doc: PlanDoc, options: ExportOptions = {}): ExportBundle {
  const graph = buildPlanGraph(doc);
  const { fileOf, warnings } = assignPaths(doc, graph);

  const files: ExportFile[] = [{ path: 'README.md', content: overview(doc, graph, fileOf, warnings) }];

  for (const [slug, path] of fileOf) {
    const node = graph.nodes.get(slug);
    if (node === undefined) continue;
    files.push({ path, content: nodeToMarkdown(node, graph) });
  }

  if (options.canvas !== false) {
    files.push({
      path: 'plan.canvas',
      content: `${JSON.stringify(toCanvas(doc, graph, fileOf), null, 2)}\n`,
    });
  }

  if (options.planJson !== false) {
    files.push({ path: 'plan.json', content: `${JSON.stringify(doc, null, 2)}\n` });
  }

  return { files, warnings };
}
