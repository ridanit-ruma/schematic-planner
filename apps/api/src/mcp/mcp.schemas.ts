import { planEdgeKinds, planNodeKinds, planNodeStatuses, slugSchema } from '@schematic/schema';
import { z } from 'zod';

/**
 * The agent-facing surface, deliberately narrower than the internal schema.
 *
 * There is no position field anywhere here. Agents declare structure and the
 * server runs layout; asking a language model for coordinates produces bad
 * diagrams and spends tokens on numbers it has no way to reason about.
 */
export const agentNodeSchema = z.object({
  slug: slugSchema.describe('Stable lowercase-hyphenated id, e.g. "auth-service"'),
  title: z.string().min(1).max(200).describe('Short human-readable name'),
  kind: z.enum(planNodeKinds).default('task').describe('What sort of thing this node is'),
  body: z.string().max(100_000).default('').describe('Markdown detail'),
  status: z.enum(planNodeStatuses).default('idea'),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
});

export const agentEdgeSchema = z.object({
  kind: z
    .enum(planEdgeKinds)
    .default('flows_to')
    .describe(
      'flows_to = control or data moves from `from` to `to`, in the direction it moves. ' +
        'This is the one that draws the system; a reply is a second flows_to pointing back. ' +
        'contains = nesting (becomes directories on export). ' +
        'depends_on = what must exist first, which is NOT what calls what. ' +
        'relates_to = a plain association carrying no structure.',
    ),
  from: slugSchema,
  to: slugSchema,
  label: z.string().max(120).nullable().default(null),
  via: z
    .string()
    .max(200)
    .nullable()
    .default(null)
    .describe(
      'What sets this flow off, on a flows_to edge. A click, a route change, a request, ' +
        'a timer, a message. e.g. "click Sign in", "POST /api/login", "on save".',
    ),
  carries: z
    .string()
    .max(400)
    .nullable()
    .default(null)
    .describe(
      'What travels along a flows_to edge: a payload, a record, an event, a return value. ' +
        'e.g. "{ email, password }", "the signed token", "rows matching the filter".',
    ),
});

export const planViewSchema = z
  .enum(['outline', 'graph', 'markdown'])
  .default('outline')
  .describe('outline = indented tree, graph = json nodes and edges, markdown = full export');

const workspaceArg = z
  .string()
  .min(1)
  .max(64)
  .optional()
  .describe('Workspace slug. Omit when the account has only one');

export const listProjectsShape = { workspace: workspaceArg };
export const listPlansShape = { workspace: workspaceArg };

export const createPlanShape = {
  title: z.string().min(1).max(200),
  workspace: workspaceArg,
  projectSlug: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe('Which project to draw in. Omitted, the workspace default is used'),
  description: z.string().max(2000).default(''),
  nodes: z.array(agentNodeSchema).max(2000).default([]),
  edges: z.array(agentEdgeSchema).max(5000).default([]),
};

export const traceShape = {
  planId: z.string().min(1),
  from: z
    .string()
    .min(1)
    .max(200)
    .describe('Where to start: a slug, a title, or a tag. e.g. "login-page", "POST /api/login"'),
  direction: z
    .enum(['downstream', 'upstream', 'both'])
    .default('downstream')
    .describe(
      'downstream = what this reaches; upstream = what reaches this; both = the whole thread',
    ),
  depth: z.coerce.number().int().min(1).max(20).default(6).describe('How many hops to follow'),
};

export const getPlanShape = {
  planId: z.string().min(1),
  view: planViewSchema,
};

/** Every field but the slug is optional: an upsert merges into what is there. */
const agentNodePatchSchema = z.object({
  slug: slugSchema,
  kind: z.enum(planNodeKinds).optional(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(100_000).optional(),
  status: z.enum(planNodeStatuses).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
});

/**
 * Mirrors the internal operation union with the placement fields removed.
 *
 * Reusing the internal schema here would put `position` and `pinned` in the tool
 * definition, and a model shown a coordinate field will fill it in — which is
 * precisely the behaviour the layout rule exists to prevent.
 */
export const agentOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('upsert_node'), node: agentNodePatchSchema }),
  z.object({ op: z.literal('delete_node'), slug: slugSchema }),
  z.object({ op: z.literal('upsert_edge'), edge: agentEdgeSchema }),
  z.object({
    op: z.literal('delete_edge'),
    kind: z.enum(planEdgeKinds).default('depends_on'),
    from: slugSchema,
    to: slugSchema,
  }),
  z.object({
    op: z.literal('set_plan'),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
  }),
]);

export const applyOpsShape = {
  planId: z.string().min(1),
  ops: z
    .array(agentOpSchema)
    .min(1)
    .max(2000)
    .describe(
      'Applied atomically in one transaction. Upserts are keyed by slug, so retrying is safe',
    ),
};

export const layoutShape = {
  planId: z.string().min(1),
  scope: z
    .enum(['all', 'unpinned'])
    .default('unpinned')
    .describe('unpinned leaves nodes a person has dragged exactly where they are'),
  direction: z.enum(['RIGHT', 'DOWN']).default('RIGHT'),
};

export const exportPlanShape = {
  planId: z.string().min(1),
};

export const createProjectShape = {
  name: z.string().min(1).max(80).describe('Human name; the address is derived from it'),
  description: z.string().max(2000).default(''),
  workspace: workspaceArg,
};

export const deletePlanShape = {
  planId: z.string().min(1),
  confirmTitle: z
    .string()
    .min(1)
    .describe('The plan\'s exact title. Required so a wrong id cannot delete the wrong plan'),
};
