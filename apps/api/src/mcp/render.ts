import { exportPlan } from '@schematic/exporter';
import { buildPlanGraph, type PlanDoc, type TraceResult } from '@schematic/schema';

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
        edges: doc.edges.map((edge) => ({
          kind: edge.kind,
          from: edge.from,
          to: edge.to,
          ...(edge.via !== null && { via: edge.via }),
          ...(edge.carries !== null && { carries: edge.carries }),
        })),
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

/**
 * A trace, drawn as the tree the walk actually found.
 *
 * Printing each path in full repeats the hops they share — four routes out of
 * one screen restate the first two steps four times — and the point of this
 * tool is to spend less of the reader's attention than the document would. So
 * a path prints only where it leaves the one before it.
 */
export function renderTrace(result: TraceResult): string {
  const lines: string[] = [`Flow through ${result.start.title} (${result.start.slug})`, ''];

  const walked = result.paths.filter((path) => path.steps.length > 1);
  if (walked.length === 0) {
    lines.push(
      'Nothing flows to or from it. Either this node is not wired up yet, or the plan',
      'records only structure — draw flows_to edges to say what calls, sends or',
      'navigates to what.',
    );
    return lines.join('\n');
  }

  let heading: string | null = null;
  let previous: readonly { node: { slug: string }; along: { id: string } | null }[] = [];

  for (const path of walked) {
    if (path.direction !== heading) {
      heading = path.direction;
      lines.push(
        heading === 'downstream' ? 'What it reaches:' : 'What reaches it:',
        `  ${result.start.title} (${result.start.slug})`,
      );
      previous = [];
    }

    // How much of this path the reader has already been shown.
    let shared = 0;
    while (
      shared < previous.length &&
      shared < path.steps.length &&
      previous[shared]?.node.slug === path.steps[shared]?.node.slug &&
      (previous[shared]?.along?.id ?? null) === (path.steps[shared]?.along?.id ?? null)
    ) {
      shared += 1;
    }

    for (const step of path.steps.slice(Math.max(shared, 1))) {
      if (step.along === null) continue;
      const note = [step.along.via, step.along.carries].filter((part) => part !== null).join(': ');
      const arrow = path.direction === 'downstream' ? '-->' : '<--';
      lines.push(
        `  ${'    '.repeat(step.depth)}${arrow}${note === '' ? '' : ` (${note})`} ` +
          `${step.node.title} (${step.node.slug})` +
          (step.revisits ? '  [already above]' : ''),
      );
    }
    previous = path.steps;
  }

  const detail = result.reached.filter((node) => node.body.trim() !== '');
  if (detail.length > 0) {
    lines.push('', '---', '');
    for (const node of detail) {
      lines.push(`## ${node.title} (${node.slug})`, `status: ${node.status}`, '', node.body.trim(), '');
    }
  }

  if (result.truncated) {
    lines.push('Stopped at the step budget. Trace from a node further along, or lower the depth.');
  }

  return lines.join('\n');
}
