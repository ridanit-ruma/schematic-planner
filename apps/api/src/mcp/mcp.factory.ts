import { Inject, Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { exportPlan } from '@schematic/exporter';
import { normalizeEdge, planEdgeInputSchema, planOpsSchema } from '@schematic/schema';

import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { PlansService } from '../plans/plans.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import type { McpIdentity } from './api-key.service.js';
import { renderPlan } from './render.js';
import {
  applyOpsShape,
  createPlanShape,
  createProjectShape,
  deletePlanShape,
  exportPlanShape,
  getPlanShape,
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
          'Turn a written plan into a diagram. Declare structure only — never coordinates; ' +
          'the server lays the graph out. Refer to nodes by slug. Create a whole plan with ' +
          'create_plan, then change it with apply_ops, which is batched and applied atomically.',
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
      'get_plan',
      {
        title: 'Read a plan',
        description: 'Read a plan. Positions and styling are never included.',
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
          'Create a plan from a whole structure in one call. This is the path for turning ' +
          'a plan you have already written into a diagram.',
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
          const doc = await this.plans.applyOps(identity.userId, planId, planOpsSchema.parse(ops));
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
          const doc = await this.plans.layout(identity.userId, planId, { scope, direction });
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
