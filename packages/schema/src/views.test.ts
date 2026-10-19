import { describe, expect, it } from 'vitest';

import { makeDoc } from './fixtures.js';
import { DEFAULT_VOCABULARY, boardColumns, type Vocabulary } from './index.js';

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
