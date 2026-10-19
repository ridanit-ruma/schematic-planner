import { z } from 'zod';

import { slugSchema, vocabularyValueSchema, type PlanNode } from './plan.js';
import { uniqueSlug } from './slug.js';
import { isWorkKind, statusOf, type Vocabulary, type VocabularyStatus } from './vocabulary.js';

/** The views a project can save. The canvas is always there and is not saved. */
export const SAVED_VIEW_TYPES = ['table', 'board', 'timeline', 'matrix'] as const;
export type SavedViewType = (typeof SAVED_VIEW_TYPES)[number];

export const SAVED_VIEWS_MAX = 50;

/** Ids a saved view may not take, because `?view=` already means a built-in view by them. */
export const BUILT_IN_VIEW_IDS: readonly string[] = ['canvas', ...SAVED_VIEW_TYPES];

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

/** What a matrix can lay out along each side. */
export const MATRIX_AXES = ['status', 'kind', 'tag'] as const;
export type MatrixAxis = (typeof MATRIX_AXES)[number];

export const matrixAxesSchema = z
  .object({ rows: z.enum(MATRIX_AXES), columns: z.enum(MATRIX_AXES) })
  .refine((axes) => axes.rows !== axes.columns, { message: 'rows and columns must differ' });
export type MatrixAxes = z.infer<typeof matrixAxesSchema>;

export const DEFAULT_MATRIX_AXES: MatrixAxes = { rows: 'kind', columns: 'status' };

export const savedViewSchema = z.object({
  /** Addressed by `?view=`, so it is a slug, and never one of the built-in view names. */
  id: slugSchema.refine((id) => !BUILT_IN_VIEW_IDS.includes(id), {
    message: 'that name belongs to a built-in view',
  }),
  /** The project's own words, shown as written. */
  name: z.string().trim().min(1).max(60),
  type: z.enum(SAVED_VIEW_TYPES),
  filter: viewFilterSchema.default(EMPTY_FILTER),
  /** Read by a matrix; kept by the other types so switching back finds it. */
  axes: matrixAxesSchema.default(DEFAULT_MATRIX_AXES),
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
 * A project's saved views as stored. Null is a project nobody has saved one in.
 *
 * Read one view at a time, so one that no longer parses costs only itself: a
 * view saved as `timeline` before that became a built-in view's name is given
 * another id rather than taking every other view in the project down with it,
 * and anything else unreadable is left out.
 */
export function readSavedViews(stored: unknown, version: number): SavedViews {
  const views: SavedView[] = [];
  const taken = new Set(BUILT_IN_VIEW_IDS);
  for (const raw of Array.isArray(stored) ? stored : []) {
    const id: unknown = (raw as { id?: unknown } | null)?.id;
    const renamed =
      typeof id === 'string' && taken.has(id)
        ? { ...(raw as object), id: uniqueSlug(`${id}-view`, taken) }
        : raw;
    const parsed = savedViewSchema.safeParse(renamed);
    if (!parsed.success || views.length >= SAVED_VIEWS_MAX) continue;
    taken.add(parsed.data.id);
    views.push(parsed.data);
  }
  return { version, views };
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

/**
 * When a node is due, from `meta.due`: the date part of an ISO 8601 string, or
 * null when there is none or it is not a real date.
 */
export function dueDate(node: Pick<PlanNode, 'meta'>): string | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(node.meta['due'] ?? '');
  if (day === null) return null;
  const [, year, month, date] = day.map(Number) as [number, number, number, number];
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date ? day[0] : null;
}

export interface TimelineBucket {
  /** `YYYY-MM`, or null for work with no date. */
  month: string | null;
  nodes: PlanNode[];
}

/**
 * The plan's work by the month it is due, earliest first.
 *
 * Work without a readable date is collected at the end rather than left out:
 * a timeline that silently hides undated work is one nobody can trust.
 */
export function timelineBuckets(
  nodes: readonly PlanNode[],
  vocabulary: Vocabulary,
): TimelineBucket[] {
  const dated = nodes
    .filter((node) => isWorkKind(vocabulary, node.kind))
    .map((node) => ({ node, due: dueDate(node) }));
  const months = [...new Set(dated.flatMap(({ due }) => (due === null ? [] : [due.slice(0, 7)])))];
  const buckets: TimelineBucket[] = months.sort().map((month) => ({
    month,
    nodes: dated
      .filter(({ due }) => due?.startsWith(month) === true)
      .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
      .map(({ node }) => node),
  }));
  const undated = dated.filter(({ due }) => due === null).map(({ node }) => node);
  if (undated.length > 0) buckets.push({ month: null, nodes: undated });
  return buckets;
}

export interface Matrix {
  /** Values along each side; null on a tag side is "no tag". */
  rows: (string | null)[];
  columns: (string | null)[];
  /** `cells[row][column]`. A node with two tags is in both rows. */
  cells: PlanNode[][][];
}

function valuesOf(node: PlanNode, axis: MatrixAxis): (string | null)[] {
  if (axis === 'status') return [node.status];
  if (axis === 'kind') return [node.kind];
  return node.tags.length === 0 ? [null] : node.tags;
}

/** The project's order first, archived values only while in use, then values it never defined. */
function axisValues(
  nodes: readonly PlanNode[],
  vocabulary: Vocabulary,
  axis: MatrixAxis,
): (string | null)[] {
  const used = new Set(nodes.flatMap((node) => valuesOf(node, axis)));
  const listed =
    axis === 'tag'
      ? vocabulary.tags.map((tag) => tag.name).filter((name) => used.has(name))
      : (axis === 'status' ? vocabulary.statuses : vocabulary.kinds)
          .filter((entry) => !entry.archived || used.has(entry.id))
          .map((entry) => entry.id);
  const rest = [...used].filter((value) => value !== null && !listed.includes(value));
  return [...listed, ...rest, ...(used.has(null) ? [null] : [])];
}

/** Every node, placed by two of its properties at once. */
export function matrixCells(
  nodes: readonly PlanNode[],
  vocabulary: Vocabulary,
  axes: MatrixAxes,
): Matrix {
  const rows = axisValues(nodes, vocabulary, axes.rows);
  const columns = axisValues(nodes, vocabulary, axes.columns);
  const cells = rows.map((row) =>
    columns.map((column) =>
      nodes.filter(
        (node) =>
          valuesOf(node, axes.rows).includes(row) && valuesOf(node, axes.columns).includes(column),
      ),
    ),
  );
  return { rows, columns, cells };
}
