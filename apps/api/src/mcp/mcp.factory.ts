import { Inject, Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { exportPlan } from '@schematic/exporter';
import { normalizeEdge, planEdgeInputSchema, type PlanOp } from '@schematic/schema';

import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { PlansService } from '../plans/plans.service.js';
import type { McpIdentity } from './api-key.service.js';
import { renderPlan } from './render.js';
import {
  applyOpsShape,
  createPlanShape,
  exportPlanShape,
  getPlanShape,
  layoutShape,
} from './mcp.schemas.js';

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });
const failure = (value: string) => ({ ...text(value), isError: true });

function reason(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

@Injectable()
export class McpFactory {
  constructor(
    private readonly plans: PlansService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * A fresh server per request. The transport runs stateless, so there is no
   * session to keep and nothing shared between two agents holding two keys.
   */
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
      'list_plans',
      { title: 'List plans', description: 'Plans in the workspace this API key belongs to.' },
      async () => {
        const plans = await this.plans.list(identity.userId, identity.workspaceId);
        if (plans.length === 0) return text('No plans yet. Use create_plan to make one.');
        return text(
          plans
            .map((plan) => `${plan.id}  ${plan.title} (${plan.nodeCount} nodes)`)
            .join('\n'),
        );
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
      async ({ title, description, nodes, edges }) => {
        try {
          const doc = await this.plans.create(identity.userId, identity.workspaceId, {
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
            `Created plan ${doc.id} with ${doc.nodes.length} nodes.\n\n${renderPlan(doc, 'outline')}`,
          );
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
          const doc = await this.plans.applyOps(identity.userId, planId, ops as PlanOp[]);
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
