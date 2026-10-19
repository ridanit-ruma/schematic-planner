import { z } from 'zod';

import { slugSchema, vocabularyValueSchema, type PlanNode } from './plan.js';
import { isWorkKind, statusOf, type Vocabulary, type VocabularyStatus } from './vocabulary.js';

/** The views a project can save. The canvas is always there and is not saved. */
export const SAVED_VIEW_TYPES = ['table', 'board'] as const;
export type SavedViewType = (typeof SAVED_VIEW_TYPES)[number];

export const SAVED_VIEWS_MAX = 50;

/**
 * Which nodes a view shows. Within one list any value matches; across lists
 * every list that has values must match. Empty is everything.
 */
export const viewFilterSchema = z.object({
  kinds: z.array(vocabularyValueSchema).max(50).default([]),
  statuses: z.array(vocabularyValueSchema).max(50).default([]),
  tags: z.array(z.string().min(1).max(40)).max(50).default([]),
  /** Found in the title, the identifier or the body, ignoring case. */
  text: z.string().max(200).default(''),
});
export type ViewFilter = z.infer<typeof viewFilterSchema>;

export const EMPTY_FILTER: ViewFilter = { kinds: [], statuses: [], tags: [], text: '' };

export const savedViewSchema = z.object({
  /** Addressed by `?view=`, so it is a slug, and never one of the built-in view names. */
  id: slugSchema.refine((id) => !['canvas', ...SAVED_VIEW_TYPES].includes(id), {
    message: 'that name belongs to a built-in view',
  }),
  /** The project's own words, shown as written. */
  name: z.string().trim().min(1).max(60),
  type: z.enum(SAVED_VIEW_TYPES),
  filter: viewFilterSchema.default(EMPTY_FILTER),
});
export type SavedView = z.infer<typeof savedViewSchema>;

export const savedViewListSchema = z
  .array(savedViewSchema)
  .max(SAVED_VIEWS_MAX)
  .refine((views) => new Set(views.map((view) => view.id)).size === views.length, {
    message: 'two views have the same id',
  });

/** A project's saved views, with the version they were read at. */
export const savedViewsSchema = z.object({
  version: z.number().int().min(0),
  views: savedViewListSchema,
});
export type SavedViews = z.infer<typeof savedViewsSchema>;

/**
 * A project's saved views as stored. Null is a project nobody has saved one in;
 * anything that does not parse reads as none rather than failing the plan.
 */
export function readSavedViews(stored: unknown, version: number): SavedViews {
  const parsed = savedViewListSchema.safeParse(stored ?? []);
  return { version, views: parsed.success ? parsed.data : [] };
}

export function isEmptyFilter(filter: ViewFilter): boolean {
  return (
    filter.kinds.length === 0 &&
    filter.statuses.length === 0 &&
    filter.tags.length === 0 &&
    filter.text.trim() === ''
  );
}

export function applyFilter<
  T extends Pick<PlanNode, 'slug' | 'title' | 'body' | 'kind' | 'status' | 'tags'>,
>(nodes: readonly T[], filter: ViewFilter): T[] {
  const text = filter.text.trim().toLowerCase();
  return nodes.filter(
    (node) =>
      (filter.kinds.length === 0 || filter.kinds.includes(node.kind)) &&
      (filter.statuses.length === 0 || filter.statuses.includes(node.status)) &&
      (filter.tags.length === 0 || node.tags.some((tag) => filter.tags.includes(tag))) &&
      (text === '' ||
        [node.title, node.slug, node.body].some((field) => field.toLowerCase().includes(text))),
  );
}

export interface BoardColumn {
  /** Null for the column of nodes whose status the project does not define. */
  status: VocabularyStatus | null;
  nodes: PlanNode[];
}

/**
 * A plan as columns of work, one per status, in the order the project lists them.
 *
 * Only work is on the board — the rule `next_task` uses — so notes and groups,
 * which have no progress to make, stay off it. Every piece of work is on it:
 * an archived status keeps its column while a node still has it, and a status
 * the project never defined gets a trailing column rather than hiding the node.
 */
export function boardColumns(nodes: readonly PlanNode[], vocabulary: Vocabulary): BoardColumn[] {
  const work = nodes.filter((node) => isWorkKind(vocabulary, node.kind));
  const columns: BoardColumn[] = vocabulary.statuses
    .map((status) => ({ status, nodes: work.filter((node) => node.status === status.id) }))
    .filter((column) => !column.status.archived || column.nodes.length > 0);
  const unknown = work.filter((node) => statusOf(vocabulary, node.status) === undefined);
  if (unknown.length > 0) columns.push({ status: null, nodes: unknown });
  return columns;
}
