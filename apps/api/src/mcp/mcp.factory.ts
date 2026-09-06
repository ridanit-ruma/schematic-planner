import { Inject, Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { exportPlan } from '@schematic/exporter';
import { findNode, normalizeEdge, planEdgeInputSchema, planOpsSchema, tracePlan } from '@schematic/schema';

import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { PlansService } from '../plans/plans.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import type { McpIdentity } from './api-key.service.js';
import { renderPlan, renderTrace } from './render.js';
import {
  applyOpsShape,
  createPlanShape,
  createProjectShape,
  deletePlanShape,
  exportPlanShape,
  getPlanShape,
  traceShape,
  layoutShape,
  listPlansShape,
  listProjectsShape,
} from './mcp.schemas.js';
import { reachable, resolveWorkspace } from './workspace-scope.js';

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });
const failure = (value: string) => ({ ...text(value), isError: true });

function reason(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

@Injectable()
export class McpFactory {
  constructor(
    private readonly plans: PlansService,
    private readonly projects: ProjectsService,
    private readonly workspaces: WorkspacesService,
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
          'to nodes by slug. Build a plan with create_plan, change it with apply_ops, and ' +
          'read one with trace rather than pulling the whole document.',
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
        const lines: string[] = [];

        for (const target of scope) {
          for (const project of await this.projects.list(identity.userId, target.id)) {
            const plans = await this.plans.list(identity.userId, project.id);
            if (plans.length === 0) continue;
            lines.push(`${target.slug} / ${project.slug}`);
            for (const plan of plans) {
              lines.push(
                `  ${plan.title} — ${plan.nodeCount} nodes — ${this.planUrl(plan.id)}`,
              );
              lines.push(`    id ${plan.id}`);
            }
          }
        }

        if (lines.length === 0) return text('No plans yet. Use create_plan to make one.');
        return text(lines.join('\n'));
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
          return text(renderTrace(tracePlan(doc, start, { direction, depth })));
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
          return text(renderPlan(await this.plans.read(identity.userId, planId), view));
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
          'Create a plan in one call: the nodes, and the flows between them.\n\n' +
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
      async ({ title, description, workspace, projectSlug, nodes, edges }) => {
        try {
          const target = await resolveWorkspace(this.workspaces, identity, workspace);
          const projectId =
            projectSlug === undefined
              ? await this.projects.defaultFor(target.id)
              : (await this.projects.bySlug(identity.userId, target.id, projectSlug)).id;

          const doc = await this.plans.create(identity.userId, projectId, {
            title,
            description,
            spec: {
              version: 1,
              title,
              description,
              nodes: nodes.map((node) => ({
                ...node,
                position: null,
                pinned: false,
                size: null,
              })),
              edges: edges.map((edge) => normalizeEdge(planEdgeInputSchema.parse(edge))),
            },
          });
          return text(
            `Created plan ${doc.id} with ${doc.nodes.length} nodes.\n` +
              `Open it at ${this.planUrl(doc.id)}\n\n${renderPlan(doc, 'outline')}`,
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
      'delete_plan',
      {
        title: 'Delete a plan',
        description:
          'Permanently removes a plan. The exact title must be given as well, so a wrong id ' +
          'cannot take somebody else\'s work with it.',
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
          return text(`Deleted "${doc.title}".`);
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
          'The only write door. The batch is applied in one transaction and appears at once ' +
          'on every open canvas. Node upserts are keyed by slug, so retrying never duplicates.',
        inputSchema: applyOpsShape,
      },
      async ({ planId, ops }) => {
        try {
          // Validated narrow, then widened into the internal union. The agent
          // never sees the placement fields the internal one carries.
          const doc = await this.plans.applyOps(identity.userId, planId, planOpsSchema.parse(ops), {
            userId: identity.userId,
            apiKeyId: identity.keyId,
          });
          return text(`Applied ${ops.length} operation(s).\n\n${renderPlan(doc, 'outline')}`);
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
          const doc = await this.plans.layout(identity.userId, planId, { scope, direction }, {
            userId: identity.userId,
            apiKeyId: identity.keyId,
          });
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
