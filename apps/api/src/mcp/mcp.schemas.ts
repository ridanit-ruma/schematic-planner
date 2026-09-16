import { planEdgeKinds, planNodeKinds, planNodeStatuses, slugSchema } from '@schematic/schema';
import { z } from 'zod';

/**
 * The agent-facing surface, deliberately narrower than the internal schema.
 *
 * There is no position field anywhere here. Agents declare structure and the
 * server runs layout; asking a language model for coordinates produces bad
 * diagrams and spends tokens on numbers it has no way to reason about.
 */
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
  .enum(['outline', 'detail', 'graph', 'markdown'])
  .default('outline')
  .describe(
    'outline = the tree with the flows out of each node, and a * against every node that has ' +
      'a body; detail = the same with every body printed; graph = json nodes and edges; ' +
      'markdown = the full export, frontmatter and all',
  );

const workspaceArg = z
  .string()
  .min(1)
  .max(64)
  .optional()
  .describe('Workspace slug. Omit when the account has only one');

const projectArg = z
  .string()
  .min(1)
  .max(64)
  .optional()
  .describe('Project slug. Omitted, the workspace default is used');

const folderArg = z
  .string()
  .min(1)
  .max(80)
  .describe('Folder name, as list_folders gives it. Folders do not nest');

export const listProjectsShape = { workspace: workspaceArg };
export const listPlansShape = { workspace: workspaceArg };

/**
 * Making a plan and drawing in it are two acts, and this is only the first.
 *
 * There are no nodes or edges here on purpose. A plan that arrived complete in
 * one call left nothing in its own history to say where forty nodes came from,
 * and nobody watching the canvas saw it drawn — it appeared. What goes in it
 * comes from apply_ops, which is also how it goes on growing afterwards.
 */
export const createPlanShape = {
  title: z.string().min(1).max(200),
  workspace: workspaceArg,
  projectSlug: projectArg.describe(
    'Which project to draw in. Omitted, the workspace default is used',
  ),
  folder: folderArg
    .optional()
    .describe('Which drawer of the project to file it in. Omitted, the top level'),
  description: z.string().max(2000).default(''),
  sourceSpecIds: z
    .array(z.string().min(1))
    .max(20)
    .optional()
    .describe(
      'Plan ids this one is being written from, in order. They must be plans in the same ' +
        'project. Use it when this plan implements a spec that is already drawn, so the link ' +
        'is a field rather than a line of prose nothing can follow',
    ),
};

/** Replaces the whole set. An empty array clears it. */
export const setPlanSourcesShape = {
  planId: z.string().min(1),
  sourceSpecIds: z
    .array(z.string().min(1))
    .max(20)
    .describe('The plans this one was written from, in order. Replaces whatever was there'),
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

/**
 * Reading a few nodes properly, rather than the whole document badly.
 *
 * Every other view is a summary, and the only route to what a node actually
 * said was the full export — pulling the document to read one paragraph of it.
 */
export const readNodesShape = {
  planId: z.string().min(1),
  slugs: z
    .array(slugSchema)
    .min(1)
    .max(100)
    .describe('The nodes to print in full, by slug, as get_plan lists them'),
};

/**
 * Finding the drawing that already covers something.
 *
 * Without it the only way to answer "where is this drawn?" is to list every
 * plan and open each one — which an agent will not do, so it draws a second
 * plan of the same system instead, and a workspace becomes a pile.
 */
export const searchShape = {
  query: z
    .string()
    .min(2)
    .max(200)
    .describe('Words to look for in node titles, identifiers, tags and bodies, and plan titles'),
  workspace: workspaceArg,
  projectSlug: projectArg.describe('Narrow it to one project. Omitted, everywhere the key reaches'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('How many matching nodes to report'),
};

/**
 * Where a plan has got to, and what to do next.
 *
 * The question an agent carrying out a plan has every turn, and the one reading
 * that did not exist.
 */
export const nextTaskShape = {
  planId: z.string().min(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe('How many of the ready tasks to print in full. The rest are listed by name'),
};

/**
 * What has happened to a plan, so an agent coming back can see what changed.
 *
 * A plan is a drawing two parties share. Without this an agent has no way to
 * ask what the person did while it was away, and its only options are to
 * assume nothing changed or to read the whole plan again.
 */
export const planHistoryShape = {
  planId: z.string().min(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(40)
    .describe('How many changes back to go, newest first'),
};

/** Every field but the slug is optional: an upsert merges into what is there. */
const agentNodePatchSchema = z.object({
  slug: slugSchema,
  kind: z.enum(planNodeKinds).optional(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(100_000).optional(),
  status: z.enum(planNodeStatuses).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  meta: z
    .record(z.string().min(1).max(64), z.string().max(500))
    .optional()
    .describe(
      'Extra frontmatter to carry through the export untouched, for keys this product has ' +
        'no opinion about. Not for anything it already has a field for',
    ),
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
  z.object({
    op: z.literal('rename_node'),
    from: slugSchema.describe("The node's current identifier."),
    to: slugSchema
      .describe(
        "The identifier it should answer to from now on. Every edge, note anchor and containment pointing at it moves with it. Fails if another node already uses it.",
      ),
  }),
  z.object({ op: z.literal('upsert_edge'), edge: agentEdgeSchema }),
  z.object({
    op: z.literal('delete_edge'),
    kind: z.enum(planEdgeKinds).default('depends_on'),
    from: slugSchema,
    to: slugSchema,
    // What sets a flow off is part of its identity, so an edge drawn with one
    // can only be named again with it. Without this field every triggered flow
    // an agent draws is one it can never remove.
    via: z
      .string()
      .max(200)
      .nullable()
      .default(null)
      .describe(
        'The trigger this flow was drawn with, needed to name one of several flows between ' +
          'the same pair of nodes. Omit it only for an edge that has none.',
      ),
  }),
  z.object({
    op: z.literal('upsert_comment'),
    comment: z.object({
      id: slugSchema.describe(
        'A readable id you choose, so leaving the same note twice leaves one note. ' +
          'e.g. "why-postgres-here"',
      ),
      body: z
        .string()
        .max(10_000)
        .optional()
        .describe(
          'What you have to say, as Markdown — it is drawn as Markdown on the canvas. ' +
            'To ask a question rather than guess, write it and offer the answers as a task ' +
            'list: "- [ ] Postgres" on one line, "- [ ] Redis" on the next. A person ticks ' +
            'one, and get_plan gives you back the body with "- [x]" against their answer.',
        ),
      anchor: slugSchema
        .nullable()
        .optional()
        .describe('The node this is about, or null for a note on the plan as a whole'),
      resolved: z
        .boolean()
        .optional()
        .describe('Settled. Use it to answer a note somebody left, not to tidy the canvas'),
    }),
  }),
  z.object({ op: z.literal('delete_comment'), id: slugSchema }),
  z.object({
    op: z.literal('set_plan'),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
  }),
]);

export const applyOpsShape = {
  planId: z.string().min(1),
  expectedRevision: z
    .string()
    .max(4000)
    .optional()
    .describe(
      'The revision this batch was written against, as get_plan reported it. Given, the batch ' +
        'is applied only if the plan is still at it, and refused whole if somebody has changed ' +
        'the plan since — nothing is half-written. Omit it unless you read the plan first and ' +
        'your operations depend on what you read',
    ),
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

export const listFoldersShape = { workspace: workspaceArg, projectSlug: projectArg };

export const createFolderShape = {
  name: z.string().min(1).max(80).describe('What to call the drawer'),
  workspace: workspaceArg,
  projectSlug: projectArg,
};

export const renameFolderShape = {
  folder: folderArg,
  to: z.string().min(1).max(80).describe('The new name'),
  workspace: workspaceArg,
  projectSlug: projectArg,
};

export const deleteFolderShape = {
  folder: folderArg,
  confirmName: z
    .string()
    .min(1)
    .describe("The folder's exact name. Required so a wrong name cannot take the wrong drawer"),
  workspace: workspaceArg,
  projectSlug: projectArg,
};

/**
 * Where a plan should live.
 *
 * Every part of the destination is optional because most moves change one thing.
 * Naming no project means the one the plan is already in, so a plan can be filed
 * in a drawer without an agent having to look up where it lives first.
 */
export const movePlanShape = {
  planId: z.string().min(1),
  workspace: workspaceArg,
  projectSlug: projectArg,
  folder: folderArg
    .nullish()
    .describe('Which drawer to file it in. Pass null for the project top level'),
};
