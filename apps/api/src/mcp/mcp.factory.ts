import { Inject, Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { exportPlan } from '@schematic/exporter';
import {
  findNode,
  planOpsSchema,
  tracePlan,
  type PlanDoc,
  type PlanOp,
} from '@schematic/schema';

import { READING_STEP_MS } from '@schematic/ydoc';

import { CollabService } from '../collab/collab.service.js';
import { FoldersService } from '../folders/folders.service.js';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { PlansService } from '../plans/plans.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import type { McpIdentity } from '../auth/api-key.service.js';
import { agentAuthor, signComments } from './authorship.js';
import {
  matchingLine,
  renderFound,
  renderNext,
  renderHistory,
  renderNodes,
  renderPlan,
  renderPlanList,
  renderTrace,
  type Found,
} from './render.js';
import {
  applyOpsShape,
  createFolderShape,
  createPlanShape,
  setPlanSourcesShape,
  createProjectShape,
  deleteFolderShape,
  deletePlanShape,
  exportPlanShape,
  getPlanShape,
  traceShape,
  layoutShape,
  listFoldersShape,
  listPlansShape,
  listProjectsShape,
  movePlanShape,
  nextTaskShape,
  planHistoryShape,
  readNodesShape,
  renameFolderShape,
  searchShape,
} from './mcp.schemas.js';
import { chooseFolder, reachable, resolveWorkspace } from './workspace-scope.js';

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });
const failure = (value: string) => ({ ...text(value), isError: true });

/**
 * Where a plan came from and what came of it, for a reader who has just been
 * handed the plan itself.
 *
 * A source that no longer resolves is shown with the reason rather than
 * dropped: the id is what the plan recorded, and an agent asked to carry on
 * needs to know the source is gone, not to find the citation quietly tidied up.
 */
function renderProvenance(provenance: {
  sources: { id: string; title: string | null; folder: string | null; state: string }[];
  sourcedBy: { id: string; title: string }[];
}): string {
  const lines: string[] = [];

  for (const source of provenance.sources) {
    const where = source.folder === null ? '' : ` (${source.folder})`;
    const state = source.state === 'ok' ? '' : ` — ${source.state}`;
    lines.push(`- ${source.title ?? 'unknown'}${where} ${source.id}${state}`);
  }
  const from = lines.length === 0 ? '' : `Written from:\n${lines.join('\n')}\n\n`;

  const of =
    provenance.sourcedBy.length === 0
      ? ''
      : `Written from this one:\n${provenance.sourcedBy
          .map((plan) => `- ${plan.title} ${plan.id}`)
          .join('\n')}\n\n`;

  return `${from}${of}`;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

@Injectable()
export class McpFactory {
  constructor(
    private readonly plans: PlansService,
    private readonly projects: ProjectsService,
    private readonly folders: FoldersService,
    private readonly workspaces: WorkspacesService,
    private readonly collab: CollabService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * A fresh server per request. The transport runs stateless, so there is no
   * session to keep and nothing shared between two agents holding two keys.
   */
  /**
   * Where a person can look at this plan.
   *
   * An agent that has just drawn something needs to be able to say where it is,
   * and it has no way to know how addresses on this instance are shaped.
   */
  private planUrl(planId: string): string {
    return `${this.config.appPublicUrl}/plan/${planId}`;
  }

  /**
   * Which project a call means.
   *
   * The same answer create_plan has always worked out for itself, in one place
   * now that six other tools need it too.
   */
  private async resolveProject(
    identity: McpIdentity,
    workspace: string | undefined,
    projectSlug: string | undefined,
  ): Promise<{ workspaceId: string; workspaceSlug: string; projectId: string }> {
    const target = await resolveWorkspace(this.workspaces, identity, workspace);
    const projectId =
      projectSlug === undefined
        ? await this.projects.defaultFor(target.id)
        : (await this.projects.bySlug(identity.userId, target.id, projectSlug)).id;
    return { workspaceId: target.id, workspaceSlug: target.slug, projectId };
  }

  build(identity: McpIdentity): McpServer {
    const server = new McpServer(
      { name: 'schematic-planner', version: '0.1.0' },
      {
        instructions:
          'Draw how a system works, so that a person and an agent can both read it.\n\n' +
          'The point of this tool is the flow: which part hands to which, what sets each ' +
          'hand-off off, and what travels along it. A plan whose edges are all `contains` ' +
          'is a nested list in a different shape and says nothing a heading could not — if ' +
          'you find yourself drawing one, you have transcribed the source instead of ' +
          'reading it.\n\n' +
          'Nodes are the parts. Their `kind` is deliberately generic, because a flow is a ' +
          'flow whether the parts are screens and endpoints, stages in a pipeline, or steps ' +
          'in a process — say what a part is in its title and body.\n\n' +
          'Declare structure only, never coordinates: the server lays the graph out. Refer ' +
          'to nodes by slug.\n\n' +
          'A plan is a living drawing, not a document you hand over finished. create_plan ' +
          'opens one; apply_ops keeps it growing, batch after batch, against the id — that is ' +
          'the ordinary way to work here, and it is what lets a person watch the canvas ' +
          'change. Before drawing something new, look for the plan that already covers it ' +
          'with list_plans and carry on with that one: a second plan of the same system is ' +
          'how a workspace turns into a pile. Read one with trace rather than pulling the ' +
          'whole document.',
      },
    );

    server.registerTool(
      'list_workspaces',
      {
        title: 'List workspaces',
        description:
          'Workspaces this key can act in. A key belongs to a person, so this is every ' +
          'workspace they are a member of.',
      },
      async () => {
        const options = await reachable(this.workspaces, identity);
        if (options.length === 0) return text('This key reaches no workspace.');
        return text(options.map((w) => `${w.slug}  ${w.name}`).join('\n'));
      },
    );

    server.registerTool(
      'list_plans',
      {
        title: 'List plans',
        description:
          'Plans this key can reach, grouped by workspace and project. Narrow it with the ' +
          'workspace argument.',
        inputSchema: listPlansShape,
      },
      async ({ workspace }) => {
        const options = await reachable(this.workspaces, identity);
        const scope =
          workspace === undefined ? options : options.filter((w) => w.slug === workspace);
        const listing = [];

        for (const target of scope) {
          for (const project of await this.projects.list(identity.userId, target.id)) {
            const [plans, drawers] = await Promise.all([
              this.plans.list(identity.userId, project.id),
              this.folders.list(identity.userId, project.id),
            ]);
            listing.push({
              workspace: target.slug,
              project: project.slug,
              folders: drawers.map((drawer) => ({ id: drawer.id, name: drawer.name })),
              plans: plans.map((plan) => ({
                id: plan.id,
                title: plan.title,
                nodeCount: plan.nodeCount,
                folderId: plan.folderId,
              })),
            });
          }
        }

        return text(renderPlanList(listing, (id) => this.planUrl(id)));
      },
    );

    server.registerTool(
      'list_projects',
      {
        title: 'List projects',
        description:
          'Projects this key can reach. A workspace holds projects, and a project holds plans.',
        inputSchema: listProjectsShape,
      },
      async ({ workspace }) => {
        const options = await reachable(this.workspaces, identity);
        const scope =
          workspace === undefined ? options : options.filter((w) => w.slug === workspace);
        const lines: string[] = [];

        for (const target of scope) {
          const projects = await this.projects.list(identity.userId, target.id);
          for (const project of projects) {
            lines.push(
              `${target.slug} / ${project.slug}  ${project.name} (${project.planCount} plans)`,
            );
          }
        }

        if (lines.length === 0) return text('No projects yet.');
        return text(lines.join('\n'));
      },
    );

    server.registerTool(
      'trace',
      {
        title: 'Follow a flow',
        description:
          'Follow the flow through one part of a plan: what a node reaches, or what reaches ' +
          'it, hop by hop, with what sets each hop off and what it carries. Prefer this over ' +
          'get_plan when you want to understand how something works — it answers with the ' +
          'thread rather than the whole document. Cycles are reported and not followed twice.',
        inputSchema: traceShape,
      },
      async ({ planId, from, direction, depth }) => {
        try {
          const doc = await this.plans.read(identity.userId, planId);
          const start = findNode(doc, from);
          if (start === null) {
            return failure(
              `Nothing in this plan is called "${from}". Names are matched by slug, then title, ` +
                'then tag. Use get_plan with view "outline" to see what is there.',
            );
          }
          const walk = tracePlan(doc, start, { direction, depth });

          // Reading is made visible on the canvas the way a cursor is: an
          // agent following a thread through the plan is something the people
          // looking at it can watch happen. It goes on the ephemeral channel
          // and nothing is written to the document.
          const hops = walk.paths.flatMap((path) =>
            path.steps.map((step) => ({
              node: step.node.slug,
              edge: step.along?.id ?? null,
            })),
          );
          if (hops.length > 0) {
            this.collab.announceReading(
              planId,
              {
                by: identity.name,
                agent: true,
                from: start.slug,
                hops,
                at: Date.now(),
              },
              // Long enough for the walk plus a moment to read what it found.
              Math.min(hops.length * READING_STEP_MS + 4000, 30_000),
            );
          }

          return text(renderTrace(walk));
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'get_plan',
      {
        title: 'Read a plan',
        description:
          'The whole plan at once. For understanding how one part works, trace is the better ' +
          'tool: it answers with the thread instead of the document. Positions are never included.',
        inputSchema: getPlanShape,
      },
      async ({ planId, view }) => {
        try {
          const [doc, revision, provenance] = await Promise.all([
            this.plans.read(identity.userId, planId),
            this.plans.revision(planId),
            this.plans.provenance(identity.userId, planId),
          ]);
          return text(
            `${renderPlan(doc, view)}\n\n${renderProvenance(provenance)}Revision: ${revision}`,
          );
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'search',
      {
        title: 'Find where something is drawn',
        description:
          'Looks for words across every plan the key can reach — node titles, identifiers, ' +
          'tags and bodies — and answers with the plans they are in. Use it before drawing ' +
          'anything new: a second plan of a system somebody already drew is how a workspace ' +
          'turns into a pile, and this is the only way to find the first one without opening ' +
          'each in turn.',
        inputSchema: searchShape,
      },
      async ({ query, workspace, projectSlug, limit }) => {
        try {
          const needles = query
            .toLowerCase()
            .split(/\s+/)
            .filter((word) => word !== '');
          if (needles.length === 0) return failure('Nothing to look for.');

          const options = await reachable(this.workspaces, identity);
          const scope =
            workspace === undefined ? options : options.filter((one) => one.slug === workspace);

          const found: Found[] = [];
          let searched = 0;

          for (const target of scope) {
            for (const project of await this.projects.list(identity.userId, target.id)) {
              if (projectSlug !== undefined && project.slug !== projectSlug) continue;

              const [plans, drawers] = await Promise.all([
                this.plans.list(identity.userId, project.id),
                this.folders.list(identity.userId, project.id),
              ]);
              const drawerName = new Map(drawers.map((drawer) => [drawer.id, drawer.name]));

              for (const summary of plans) {
                // Every plan is decoded to look inside it, so the work is
                // bounded by saying enough is enough rather than by hoping.
                if (found.length >= limit || searched >= SEARCH_PLAN_LIMIT) break;
                searched += 1;

                const doc = await this.plans.read(identity.userId, summary.id);
                const place = {
                  planId: summary.id,
                  planTitle: doc.title,
                  workspace: target.slug,
                  project: project.slug,
                  folder: summary.folderId === null
                    ? null
                    : (drawerName.get(summary.folderId) ?? null),
                };

                for (const node of doc.nodes) {
                  if (found.length >= limit) break;
                  const hit = whereItMatches(node, needles);
                  if (hit === null) continue;
                  found.push({
                    ...place,
                    slug: node.slug,
                    kind: node.kind,
                    status: node.status,
                    title: node.title,
                    where: hit.where,
                    line: hit.line,
                  });
                }
              }
            }
          }

          return text(renderFound(found, query, (id) => this.planUrl(id), searched));
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'next_task',
      {
        title: 'Where the plan has got to, and what to do next',
        description:
          'The state of a plan and the tasks that can be started now, each with its body — so ' +
          'the next move is in hand rather than worked out. A task is ready when everything ' +
          'that flows into it, and everything it depends on, is done. Prefer this over reading ' +
          'the whole plan and deciding for yourself: on a long outline that decision is where ' +
          'a task already finished gets done twice, or one waiting on unfinished work gets ' +
          'started. Call it again after each task rather than working from what you remember.',
        inputSchema: nextTaskShape,
      },
      async ({ planId, limit }) => {
        try {
          const doc = await this.plans.read(identity.userId, planId);
          return text(renderNext(doc, limit));
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'read_nodes',
      {
        title: 'Read what these nodes say',
        description:
          'The full body of the nodes you name, with what each one is wired to and what holds ' +
          'it. Every other view is a summary — this is the one that gives you the words. Read ' +
          'the plan first and ask for the handful you actually need; asking for all of them is ' +
          'get_plan with view "detail".',
        inputSchema: readNodesShape,
      },
      async ({ planId, slugs }) => {
        try {
          const doc = await this.plans.read(identity.userId, planId);
          return text(renderNodes(doc, slugs));
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'plan_history',
      {
        title: 'What has changed on this plan',
        description:
          'Who changed what, newest first — a person dragging a node, an agent applying a ' +
          'batch, a note answered. A plan is a drawing two parties share, so use this when you ' +
          'come back to one you drew earlier rather than assuming it is as you left it.',
        inputSchema: planHistoryShape,
      },
      async ({ planId, limit }) => {
        try {
          const entries = await this.plans.changes(identity.userId, planId, limit);
          return text(renderHistory(entries));
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'set_plan_sources',
      {
        title: 'Say which plans this one was written from',
        description:
          'Replaces the whole set, so two callers cannot half-agree about where a plan came ' +
          'from. Sources must be plans in the same project; an empty array clears them. ' +
          'Reading a plan back names each source, the drawer it is filed in, and whether it ' +
          'still resolves — a source that is deleted or moved is reported, never removed, so ' +
          'losing a spec does not quietly edit the plan that cited it.',
        inputSchema: setPlanSourcesShape,
        annotations: { destructiveHint: false },
      },
      async ({ planId, sourceSpecIds }) => {
        try {
          const stored = await this.plans.setSources(identity.userId, planId, sourceSpecIds);
          return text(
            stored.length === 0
              ? 'Cleared the sources of this plan.'
              : `This plan is now written from: ${stored.join(', ')}`,
          );
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'create_plan',
      {
        title: 'Create a plan',
        description:
          'Open an empty plan. Nothing is drawn here — apply_ops does that, with the id this ' +
          'gives back.\n\n' +
          'This is the first call, not the last one. A plan is a drawing somebody keeps, not ' +
          'an artefact you produce once, so go on adding to it as often as you learn ' +
          'something new. Drawing it in pieces is also the only way a person watching the ' +
          'canvas sees it take shape rather than appear, and the only way its own history can ' +
          'say where each part came from.\n\n' +
          'Draw how the thing works, not a list of what to do. A node is a part of the ' +
          'system — a screen, a route, an endpoint, a function, a table, a job, an outside ' +
          'service. A flows_to edge is control or data moving from one to the next, in the ' +
          'direction it moves, saying what sets it off (via) and what it takes along ' +
          '(carries). A reply is its own flows_to pointing back.\n\n' +
          'If the source material is a list — a backlog, a kanban board, a set of headings — ' +
          'it will not contain these connections, and copying it across produces the same ' +
          'list with boxes around it. Work out what calls, sends or navigates to what, and ' +
          'draw that.',
        inputSchema: createPlanShape,
      },
      async ({ title, description, workspace, projectSlug, folder, sourceSpecIds }) => {
        try {
          const { projectId } = await this.resolveProject(identity, workspace, projectSlug);
          const filed =
            folder === undefined
              ? null
              : chooseFolder(await this.folders.list(identity.userId, projectId), folder).id;

          const doc = await this.plans.create(
            identity.userId,
            projectId,
            { title, description, folderId: filed },
            { userId: identity.userId, apiKeyId: identity.keyId },
          );
          // After the plan exists, because a source is validated against the
          // project the plan is in and a plan that does not exist is in none.
          if (sourceSpecIds !== undefined && sourceSpecIds.length > 0) {
            await this.plans.setSources(identity.userId, doc.id, sourceSpecIds);
          }
          return text(
            `Created plan ${doc.id}, empty.\n` +
              `Open it at ${this.planUrl(doc.id)}\n` +
              `Draw into it with apply_ops and this id, a few nodes at a time.`,
          );
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'create_project',
      {
        title: 'Create a project',
        description:
          'A project groups the plans for one thing being built. Without this everything an ' +
          'agent draws piles into the workspace default.',
        inputSchema: createProjectShape,
      },
      async ({ name, description, workspace }) => {
        try {
          const target = await resolveWorkspace(this.workspaces, identity, workspace);
          const project = await this.projects.create(identity.userId, target.id, {
            name,
            description,
          });
          return text(`Created project ${project.slug} in ${target.slug}.`);
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'list_folders',
      {
        title: 'List folders',
        description:
          'The drawers inside a project, and how many plans are in each. A folder does not ' +
          'nest, and a plan does not have to be in one.',
        inputSchema: listFoldersShape,
      },
      async ({ workspace, projectSlug }) => {
        try {
          const { projectId } = await this.resolveProject(identity, workspace, projectSlug);
          const drawers = await this.folders.list(identity.userId, projectId);
          if (drawers.length === 0) {
            return text('No folders in this project. Everything sits at its top level.');
          }
          return text(
            drawers.map((drawer) => `${drawer.name} — ${drawer.planCount} plans`).join('\n'),
          );
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'create_folder',
      {
        title: 'Create a folder',
        description:
          'A drawer inside a project, for grouping plans that belong together. Folders do not ' +
          'nest. Asking for one that is already there gives back the one that is there rather ' +
          'than making a second of the same name.',
        inputSchema: createFolderShape,
      },
      async ({ name, workspace, projectSlug }) => {
        try {
          const { projectId } = await this.resolveProject(identity, workspace, projectSlug);
          const drawers = await this.folders.list(identity.userId, projectId);
          const already = drawers.find(
            (drawer) => drawer.name.trim().toLowerCase() === name.trim().toLowerCase(),
          );
          if (already !== undefined) {
            return text(`"${already.name}" is already there, holding ${already.planCount} plans.`);
          }
          const made = await this.folders.create(identity.userId, projectId, { name });
          return text(`Created folder "${made.name}". File plans in it with move_plan.`);
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'rename_folder',
      {
        title: 'Rename a folder',
        description: 'Changes what a drawer is called. Nothing inside it moves.',
        inputSchema: renameFolderShape,
      },
      async ({ folder, to, workspace, projectSlug }) => {
        try {
          const { projectId } = await this.resolveProject(identity, workspace, projectSlug);
          const chosen = chooseFolder(await this.folders.list(identity.userId, projectId), folder);
          const renamed = await this.folders.update(identity.userId, chosen.id, { name: to });
          return text(`"${chosen.name}" is now "${renamed.name}".`);
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'delete_folder',
      {
        title: 'Delete a folder',
        description:
          'Moves a folder to the workspace trash, and the plans filed in it go with it — a ' +
          'person can restore the folder and get them back. The exact name must be given as ' +
          'well, so a wrong name cannot take the wrong drawer.',
        inputSchema: deleteFolderShape,
        annotations: { destructiveHint: true },
      },
      async ({ folder, confirmName, workspace, projectSlug }) => {
        try {
          const { projectId } = await this.resolveProject(identity, workspace, projectSlug);
          const chosen = chooseFolder(await this.folders.list(identity.userId, projectId), folder);
          if (chosen.name !== confirmName) {
            return failure(
              `That folder is called "${chosen.name}", not "${confirmName}". Nothing was deleted.`,
            );
          }
          await this.folders.remove(identity.userId, chosen.id);
          return text(
            `Moved "${chosen.name}" to the trash, with the plans in it. ` +
              'A person can restore it from there.',
          );
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'move_plan',
      {
        title: 'Move a plan',
        description:
          'Files a plan somewhere else: another drawer of the same project, another project, ' +
          'or a project in another workspace.\n\n' +
          'Naming only a folder moves it within the project it is already in. Passing null for ' +
          'the folder takes it out to the project top level. Moving a plan to another workspace ' +
          'drops any share link it had, because the link was handed out on the understanding of ' +
          'who could reach it.',
        inputSchema: movePlanShape,
      },
      async ({ planId, workspace, projectSlug, folder }) => {
        try {
          const where = await this.plans.navigation(identity.userId, planId);
          // Naming no destination project means the one it is already in, so a
          // plan can be filed in a drawer without an agent having to look up
          // where it lives first.
          const destination =
            workspace === undefined && projectSlug === undefined
              ? { projectId: where.projectId, workspaceSlug: where.workspace.slug }
              : await this.resolveProject(identity, workspace, projectSlug);

          const filed =
            folder === undefined || folder === null
              ? null
              : chooseFolder(
                  await this.folders.list(identity.userId, destination.projectId),
                  folder,
                ).id;

          await this.plans.move(identity.userId, planId, destination.projectId, filed);

          const crossed = destination.workspaceSlug !== where.workspace.slug;
          return text(
            `Moved. It is now ${filed === null ? 'at the top level of' : `in "${folder}" in`} ` +
              `that project.${crossed ? ' Any share link it had has been dropped.' : ''}`,
          );
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'delete_plan',
      {
        title: 'Delete a plan',
        description:
          'Moves a plan to the workspace trash, where a person can restore it or remove it for ' +
          'good. The exact title must be given as well, so a wrong id cannot take somebody ' +
          "else's work with it.",
        inputSchema: deletePlanShape,
        annotations: { destructiveHint: true },
      },
      async ({ planId, confirmTitle }) => {
        try {
          const doc = await this.plans.read(identity.userId, planId);
          if (doc.title !== confirmTitle) {
            return failure(
              `That plan is called "${doc.title}", not "${confirmTitle}". Nothing was deleted.`,
            );
          }
          await this.plans.remove(identity.userId, planId);
          return text(`Moved "${doc.title}" to the trash. A person can restore it from there.`);
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'apply_ops',
      {
        title: 'Change a plan',
        description:
          'How a plan grows once it exists, and the only write door. Takes the plan id from ' +
          'create_plan or list_plans, so it changes a drawing that is already there — ' +
          'including one somebody else made.\n\n' +
          'Call it as often as you like. Each batch is applied in one transaction and reaches ' +
          'every open canvas at once, so a person looking at the plan watches it change under ' +
          'them rather than being handed a finished picture. Node upserts are keyed by slug, ' +
          'so retrying never duplicates.\n\n' +
          'upsert_comment leaves a note on the drawing rather than changing it: a question, ' +
          'an objection, something you are unsure of. Use it when you would otherwise have to ' +
          'guess — a note sits on the canvas where a person will see it and can answer, which ' +
          'is better than a plan drawn confidently around an assumption. Notes somebody else ' +
          'left are in get_plan; read them before carrying on, and resolve one when you have ' +
          'acted on it.\n\n' +
          'A flow is identified by what sets it off, so drawing the same pair again with a ' +
          'different via adds a second flow rather than correcting the first. To change what ' +
          'sets a flow off, delete_edge it with the old via in the same batch. The reply says ' +
          'so when a batch leaves two flows running between one pair.',
        inputSchema: applyOpsShape,
      },
      async ({ planId, ops, expectedRevision }) => {
        try {
          // Validated narrow, then widened into the internal union. The agent
          // never sees the placement fields the internal one carries — which is
          // also why the notes are signed here and not by the caller: there is
          // nothing an agent could put in an author field that is worth
          // trusting, and the server already knows whose key this is.
          const signed = signComments(planOpsSchema.parse(ops), agentAuthor(identity.name));
          const doc = await this.plans.applyOps(
            identity.userId,
            planId,
            signed,
            { userId: identity.userId, apiKeyId: identity.keyId },
            expectedRevision,
          );
          const revision = await this.plans.revision(planId);
          const doubled = doubledFlows(doc, signed);
          return text(
            `Applied ${ops.length} operation(s).\n\n${doubled}${renderPlan(doc, 'outline')}` +
              `\n\nRevision: ${revision}`,
          );
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'layout',
      {
        title: 'Arrange a plan',
        description: 'Re-run automatic layout. Nodes a person has placed are left alone.',
        inputSchema: layoutShape,
      },
      async ({ planId, scope, direction }) => {
        try {
          const doc = await this.plans.layout(
            identity.userId,
            planId,
            { scope, direction },
            {
              userId: identity.userId,
              apiKeyId: identity.keyId,
            },
          );
          return text(`Arranged ${doc.nodes.length} nodes.`);
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    server.registerTool(
      'export_plan',
      {
        title: 'Export a plan',
        description: 'The Markdown bundle a plan exports to, plus a link to download the zip.',
        inputSchema: exportPlanShape,
      },
      async ({ planId }) => {
        try {
          const doc = await this.plans.read(identity.userId, planId);
          const bundle = exportPlan(doc, { canvas: false, planJson: false });
          const warnings =
            bundle.warnings.length === 0
              ? ''
              : `\n\nWarnings:\n${bundle.warnings.map((w) => `- ${w}`).join('\n')}`;

          return text(
            `${bundle.files.map((file) => `### ${file.path}\n\n${file.content}`).join('\n\n')}` +
              `${warnings}\n\nZip (including plan.canvas): ${this.config.apiPublicUrl}/plans/${planId}/export`,
          );
        } catch (error) {
          return failure(reason(error));
        }
      },
    );

    return server;
  }
}

/**
 * How many plans one search will open.
 *
 * Every plan has to be decoded to look inside it, so this is real work. The
 * ceiling is generous enough to cover a workspace somebody actually uses and
 * low enough that a search cannot become a way to read the whole instance.
 */
const SEARCH_PLAN_LIMIT = 120;

/** Where in a node the words are, and the line they are on. */
function whereItMatches(
  node: { slug: string; title: string; tags: readonly string[]; body: string },
  needles: readonly string[],
): { where: string; line: string } | null {
  const holds = (value: string) => {
    const lowered = value.toLowerCase();
    return needles.every((needle) => lowered.includes(needle));
  };

  if (holds(node.title)) return { where: 'title', line: node.title };
  if (holds(node.slug)) return { where: 'identifier', line: node.slug };
  const tag = node.tags.find((one) => holds(one));
  if (tag !== undefined) return { where: 'tag', line: tag };

  const line = matchingLine(node.body, needles);
  return line === null ? null : { where: 'body', line };
}

/**
 * A warning for the one write that quietly draws the wrong thing.
 *
 * What sets a flow off is part of its identity, which is what lets two
 * different triggers run between the same pair of nodes. The cost is that
 * redrawing a flow with a corrected trigger adds a second one instead of
 * changing the first, and nothing said so: an agent tidying up its own wording
 * doubled the line and read back an outline it had no reason to look twice at.
 *
 * Only pairs this batch touched are reported, and only when there is now more
 * than one flow between them — two deliberate triggers are a drawing somebody
 * meant, said once, and then never mentioned again.
 */
export function doubledFlows(doc: PlanDoc, applied: readonly PlanOp[]): string {
  const drawn = new Set<string>();
  for (const op of applied) {
    if (op.op === 'upsert_edge' && op.edge.kind === 'flows_to') {
      drawn.add(`${op.edge.from}>${op.edge.to}`);
    }
  }
  if (drawn.size === 0) return '';

  const lines: string[] = [];
  for (const pair of drawn) {
    const [from, to] = pair.split('>');
    const flows = doc.edges.filter(
      (edge) => edge.kind === 'flows_to' && edge.from === from && edge.to === to,
    );
    if (flows.length < 2) continue;
    const triggers = flows.map((edge) => (edge.via === null ? 'no trigger' : `"${edge.via}"`));
    lines.push(`  ${from} --> ${to}, set off by ${triggers.join(' and ')}`);
  }
  if (lines.length === 0) return '';

  return (
    'More than one flow now runs between these:\n' +
    `${lines.join('\n')}\n` +
    'That is right if you meant to draw two triggers. If you meant to correct one, a flow is ' +
    'identified by its trigger, so the old one is still there — remove it with delete_edge ' +
    'carrying the via it was drawn with.\n\n'
  );
}
