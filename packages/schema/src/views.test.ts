import { describe, expect, it } from 'vitest';

import { makeDoc } from './fixtures.js';
import {
  DEFAULT_VOCABULARY,
  EMPTY_FILTER,
  applyFilter,
  boardColumns,
  readSavedViews,
  savedViewListSchema,
  savedViewSchema,
  type ViewFilter,
  type Vocabulary,
} from './index.js';

const columnsOf = (vocabulary: Vocabulary, ...nodes: Parameters<typeof makeDoc>[0]) =>
  boardColumns(makeDoc(nodes).nodes, vocabulary).map((column) => [
    column.status?.id ?? null,
    column.nodes.map((node) => node.slug),
  ]);

describe('boardColumns', () => {
  it('gives every status a column, in the order the project lists them', () => {
    expect(
      columnsOf(
        DEFAULT_VOCABULARY,
        { slug: 'b', status: 'done' },
        { slug: 'a', status: 'idea' },
        { slug: 'c', status: 'done' },
      ),
    ).toEqual([
      ['idea', ['a']],
      ['planned', []],
      ['in_progress', []],
      ['blocked', []],
      ['done', ['b', 'c']],
      ['dropped', []],
    ]);
  });

  it('keeps notes and groups off the board', () => {
    const columns = columnsOf(
      DEFAULT_VOCABULARY,
      { slug: 'remark', kind: 'note' },
      { slug: 'box', kind: 'group' },
      { slug: 'work', kind: 'task' },
    );
    expect(columns.flatMap(([, slugs]) => slugs)).toEqual(['work']);
  });

  it('keeps an archived status only while a node still has it', () => {
    const vocabulary: Vocabulary = {
      ...DEFAULT_VOCABULARY,
      statuses: DEFAULT_VOCABULARY.statuses.map((status) =>
        status.id === 'planned' || status.id === 'dropped' ? { ...status, archived: true } : status,
      ),
    };
    const ids = columnsOf(vocabulary, { slug: 'a', status: 'planned' }).map(([id]) => id);
    expect(ids).toContain('planned');
    expect(ids).not.toContain('dropped');
  });

  it('puts a status nobody defined in a trailing column instead of dropping the node', () => {
    const columns = columnsOf(DEFAULT_VOCABULARY, { slug: 'odd', status: 'reviewing' });
    expect(columns.at(-1)).toEqual([null, ['odd']]);
  });
});

describe('applyFilter', () => {
  const doc = makeDoc([
    { slug: 'sign-in', title: 'Sign in', kind: 'feature', status: 'done' },
    { slug: 'reset', title: 'Password reset', kind: 'task', status: 'blocked' },
    { slug: 'why', title: 'Why email', kind: 'note' },
  ]);
  const nodes = doc.nodes.map((node) =>
    node.slug === 'reset' ? { ...node, tags: ['auth'] } : node,
  );
  const slugs = (filter: Partial<ViewFilter>) =>
    applyFilter(nodes, { ...EMPTY_FILTER, ...filter }).map((node) => node.slug);

  it('shows everything when empty', () => {
    expect(slugs({})).toEqual(['sign-in', 'reset', 'why']);
  });

  it('matches any value within a list and every list across them', () => {
    expect(slugs({ kinds: ['feature', 'task'] })).toEqual(['sign-in', 'reset']);
    expect(slugs({ kinds: ['feature', 'task'], statuses: ['blocked'] })).toEqual(['reset']);
    expect(slugs({ tags: ['auth'] })).toEqual(['reset']);
  });

  it('finds text in the title or the identifier, ignoring case', () => {
    expect(slugs({ text: '  PASSWORD ' })).toEqual(['reset']);
    expect(slugs({ text: 'sign-' })).toEqual(['sign-in']);
  });
});

describe('saved views', () => {
  const view = { id: 'blocked-work', name: 'Blocked', type: 'board' };

  it('refuses an id that a built-in view answers to', () => {
    expect(savedViewSchema.safeParse({ ...view, id: 'table' }).success).toBe(false);
    expect(savedViewSchema.safeParse(view).success).toBe(true);
  });

  it('refuses two views with one id', () => {
    expect(savedViewListSchema.safeParse([view, view]).success).toBe(false);
  });

  it('reads nothing stored, or something broken, as no views', () => {
    expect(readSavedViews(null, 0)).toEqual({ version: 0, views: [] });
    expect(readSavedViews([{ id: 'x' }], 4)).toEqual({ version: 4, views: [] });
    expect(readSavedViews([view], 2).views[0]?.filter).toEqual(EMPTY_FILTER);
  });
});
