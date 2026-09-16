import { exportPlan } from '@schematic/exporter';
import { buildPlanGraph, topologicalOrder, type PlanDoc, type TraceResult } from '@schematic/schema';
import type { NamedFolder } from './workspace-scope.js';

export type PlanView = 'outline' | 'detail' | 'graph' | 'markdown';

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
        ...(doc.comments.length > 0 && {
          comments: doc.comments.map((comment) => ({
            id: comment.id,
            author: comment.author,
            body: comment.body,
            ...(comment.anchor !== null && { anchor: comment.anchor }),
            ...(comment.resolved && { resolved: true }),
          })),
        }),
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

  if (view === 'detail') return outline(doc, { bodies: true });

  return outline(doc);
}

/**
 * Named nodes, in full, with what they are wired to.
 *
 * The gap this fills: every view was a summary. An agent asked to carry out the
 * task drawn on one node could see its title and its status and nothing it
 * actually said, and the only way to the words was the whole export — the
 * document, to read one paragraph of it.
 */
export function renderNodes(doc: PlanDoc, slugs: readonly string[]): string {
  const graph = buildPlanGraph(doc);
  const lines: string[] = [];
  const missing: string[] = [];

  for (const slug of slugs) {
    const node = graph.nodes.get(slug);
    if (node === undefined) {
      missing.push(slug);
      continue;
    }

    lines.push(`## ${node.title} (${node.slug})`, `${node.kind} / ${node.status}`);
    if (node.tags.length > 0) lines.push(`tags: ${node.tags.join(', ')}`);

    const holder = graph.parentOf.get(slug);
    if (holder !== undefined) lines.push(`inside: ${holder}`);
    const children = graph.childrenOf.get(slug) ?? [];
    if (children.length > 0) lines.push(`holds: ${children.join(', ')}`);

    for (const line of wiring(doc, slug)) lines.push(line);

    const meta = Object.entries(node.meta ?? {});
    for (const [key, value] of meta) lines.push(`${key}: ${value}`);

    lines.push('', node.body.trim() === '' ? '_nothing written here yet_' : node.body.trim(), '');
  }

  if (missing.length > 0) {
    lines.push(
      `Nothing in this plan is called: ${missing.join(', ')}. ` +
        'Names are matched by slug. Use get_plan to see what is there.',
    );
  }

  return lines.join('\n');
}

/** The lines into and out of one node, written the way the drawing reads. */
function wiring(doc: PlanDoc, slug: string): string[] {
  const lines: string[] = [];
  for (const edge of doc.edges) {
    if (edge.kind === 'contains') continue;
    if (edge.from !== slug && edge.to !== slug) continue;
    const note = [edge.via, edge.carries].filter((part) => part !== null).join(': ');
    const tail = note === '' ? '' : ` (${note})`;
    lines.push(
      edge.from === slug
        ? `${edge.kind} --> ${edge.to}${tail}`
        : `${edge.kind} <-- ${edge.from}${tail}`,
    );
  }
  return lines;
}

function outline(doc: PlanDoc, options: { bodies?: boolean } = {}): string {
  const graph = buildPlanGraph(doc);
  const lines = [`# ${doc.title}`];
  if (doc.description !== '') lines.push('', doc.description);
  lines.push('');

  /*
   * The flows belong in the outline, because the flows are what the drawing is.
   * Without them this listed a nesting — which is a document's table of
   * contents wearing a diagram's clothes — and an agent reading a plan back
   * could not see a single thing it had drawn about how the system works.
   */
  const flows = new Map<string, string[]>();
  for (const edge of doc.edges) {
    if (edge.kind === 'contains') continue;
    const note = [edge.via, edge.carries].filter((part) => part !== null).join(': ');
    const arrow = edge.kind === 'flows_to' ? '-->' : `--${edge.kind}-->`;
    const list = flows.get(edge.from) ?? [];
    list.push(`${arrow} ${edge.to}${note === '' ? '' : ` (${note})`}`);
    flows.set(edge.from, list);
  }

  /*
   * Down the flows, not down the alphabet.
   *
   * The graph sorts siblings by slug, which is what the export wants — the same
   * plan has to produce the same filenames every time. Read back as a drawing
   * it is the least useful order there is: a chain of eight steps came out
   * scrambled, and the one thing the reader wanted to know was which came
   * first. Here the order follows what flows into what, with the alphabet only
   * breaking ties and anything caught in a cycle coming last.
   */
  const reaching = new Map<string, string[]>();
  for (const edge of doc.edges) {
    if (edge.kind === 'contains' || edge.kind === 'relates_to') continue;
    // A depends_on points at what must exist first, so it reads the other way
    // round from a flow and still means "that one comes before this one".
    const [after, first] = edge.kind === 'depends_on' ? [edge.from, edge.to] : [edge.to, edge.from];
    const list = reaching.get(after) ?? [];
    list.push(first);
    reaching.set(after, list);
  }

  const walk = (siblings: readonly string[], depth: number): void => {
    for (const slug of topologicalOrder(siblings, reaching).order) {
      const node = graph.nodes.get(slug);
      if (node === undefined) continue;

      const pad = '  '.repeat(depth);
      const said = node.body.trim();
      // Which nodes are worth asking read_nodes about, without printing them.
      const written = options.bodies === true || said === '' ? '' : ' *';
      lines.push(`${pad}- ${node.slug} [${node.kind}/${node.status}] ${node.title}${written}`);
      for (const flow of flows.get(slug) ?? []) lines.push(`${pad}    ${flow}`);
      if (options.bodies === true && said !== '') {
        for (const line of said.split('\n')) lines.push(`${pad}    | ${line}`);
      }
      walk(graph.childrenOf.get(slug) ?? [], depth + 1);
    }
  };
  walk(graph.roots, 0);

  if (options.bodies !== true && doc.nodes.some((node) => node.body.trim() !== '')) {
    lines.push('', 'A node marked * has a body. read_nodes prints them.');
  }

  if (doc.nodes.length === 0) lines.push('_empty plan_');

  // What people have said about the drawing, after the drawing. An open note is
  // usually the most useful thing in a plan an agent is asked to carry on with:
  // it is the one part that says what is wrong with what is already there.
  const open = doc.comments.filter((comment) => !comment.resolved);
  if (open.length > 0) {
    lines.push('', '## Notes left on this plan', '');
    /*
     * In full, not flattened to a line.
     *
     * A note is how an agent asks a question rather than guessing, and the way
     * it asks is a task list the person ticks one box of. Squeezed onto one
     * line and cut at 240 characters, the answers were the part that got cut —
     * so the mechanism worked, and reading the result back did not.
     */
    for (const comment of open) {
      const about = comment.anchor === null ? '' : ` on ${comment.anchor}`;
      const who = comment.author === '' ? 'Someone' : comment.author;
      lines.push(`- ${comment.id}${about} — ${who}:`);
      for (const line of comment.body.trim().split('\n')) lines.push(`    ${line}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/** A note may be several paragraphs; the list it appears in is one line each. */
function oneLine(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat === '') return '(empty)';
  return flat.length > 240 ? `${flat.slice(0, 240)}…` : flat;
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
      if (lines[lines.length - 1] !== '') lines.push('');
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
          (step.repeat === 'loop'
            ? '  [loops back]'
            : step.repeat === 'seen'
              ? '  [shown above]'
              : ''),
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

export interface ListedPlan {
  readonly id: string;
  readonly title: string;
  readonly nodeCount: number;
  readonly folderId: string | null;
}

export interface ListedProject {
  readonly workspace: string;
  readonly project: string;
  readonly folders: readonly NamedFolder[];
  readonly plans: readonly ListedPlan[];
}

/**
 * What an agent sees when it asks what is there.
 *
 * Indented by where a plan is filed, because an agent that cannot see folders
 * cannot use them: it piles everything at the top level of a project and makes
 * a second folder of a name that already exists. An empty folder is listed for
 * the same reason.
 */
export function renderPlanList(
  projects: readonly ListedProject[],
  url: (planId: string) => string,
): string {
  const lines: string[] = [];

  for (const entry of projects) {
    if (entry.plans.length === 0 && entry.folders.length === 0) continue;
    lines.push(`${entry.workspace} / ${entry.project}`);

    const write = (plan: ListedPlan, indent: string): void => {
      lines.push(`${indent}${plan.title} — ${plan.nodeCount} nodes — ${url(plan.id)}`);
      lines.push(`${indent}  id ${plan.id}`);
    };

    for (const folder of entry.folders) {
      lines.push(`  ${folder.name}`);
      for (const plan of entry.plans.filter((held) => held.folderId === folder.id)) {
        write(plan, '    ');
      }
    }
    for (const plan of entry.plans.filter((held) => held.folderId === null)) {
      write(plan, '  ');
    }
  }

  if (lines.length === 0) return 'No plans yet. Use create_plan to make one.';
  return lines.join('\n');
}

/**
 * What has happened to a plan, newest first.
 *
 * A plan is a drawing two parties share, and an agent that comes back to one it
 * drew earlier had no way to ask what the person did in the meantime — its only
 * choices were to assume nothing had changed, or to read the whole thing again
 * and diff it by eye.
 *
 * A key acts for the person who issued it, so both names are printed. `Ruma`
 * alone reads as somebody at a keyboard; `claude` alone hides whose permission
 * it was working under.
 */
export function renderHistory(entries: readonly PlanChange[]): string {
  if (entries.length === 0) {
    return 'Nothing has changed on this plan since it was made.';
  }

  const lines: string[] = [];
  let batch: string | null | undefined;

  for (const entry of entries) {
    // One act at a time. A batch of forty operations is one thing somebody did,
    // and printing forty authors and forty timestamps buries that.
    if (entry.batchId !== batch) {
      batch = entry.batchId;
      lines.push('', `${whom(entry)} — ${entry.at.toISOString()}`);
    }
    const detail = entry.detail === null || entry.detail === '' ? '' : ` — ${oneLine(entry.detail)}`;
    lines.push(`  ${entry.kind} ${entry.subject} (${entry.label})${detail}`);
  }

  return lines.join('\n').trim();
}

function whom(entry: PlanChange): string {
  if (entry.by === null) return 'Somebody since deleted';
  if (entry.by.agent === null) return entry.by.name;
  return `${entry.by.agent}, for ${entry.by.name}`;
}

/** Only the parts of a change entry a reader needs. */
export interface PlanChange {
  readonly kind: string;
  readonly subject: string;
  readonly label: string;
  readonly detail: string | null;
  readonly at: Date;
  readonly batchId: string | null;
  readonly by: { readonly name: string; readonly agent: string | null } | null;
}
