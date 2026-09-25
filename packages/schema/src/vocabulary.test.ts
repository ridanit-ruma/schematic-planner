import { describe, expect, it } from 'vitest';

import {
  DEFAULT_VOCABULARY,
  categoryOf,
  droppedIds,
  isDefaultName,
  isSettled,
  isWorkKind,
  matchVocabulary,
  pickable,
  planNodeKinds,
  planNodeStatuses,
  randomTagColor,
  readVocabulary,
  storedVocabularySchema,
  vocabularyId,
  vocabularyInputSchema,
  withTag,
  type Vocabulary,
} from './index.js';

const custom: Vocabulary = {
  ...DEFAULT_VOCABULARY,
  version: 3,
  statuses: [
    ...DEFAULT_VOCABULARY.statuses,
    { id: 'in-review', name: 'In review', color: 'purple', category: 'active', archived: false },
    { id: 'old', name: 'Old', color: 'gray', category: 'todo', archived: true },
  ],
  kinds: [
    ...DEFAULT_VOCABULARY.kinds,
    { id: 'spike', name: 'Spike', look: 'dashed', work: true, archived: false },
  ],
};

describe('DEFAULT_VOCABULARY', () => {
  it('has exactly the ids nodes stored before vocabularies existed', () => {
    expect(DEFAULT_VOCABULARY.statuses.map((one) => one.id)).toEqual([...planNodeStatuses]);
    expect(DEFAULT_VOCABULARY.kinds.map((one) => one.id)).toEqual([...planNodeKinds]);
  });

  it('reproduces the fixed behaviour through categories and the work flag', () => {
    expect(categoryOf(DEFAULT_VOCABULARY, 'in_progress')).toBe('active');
    expect(categoryOf(DEFAULT_VOCABULARY, 'blocked')).toBe('blocked');
    expect(isSettled(DEFAULT_VOCABULARY, 'done')).toBe(true);
    expect(isSettled(DEFAULT_VOCABULARY, 'dropped')).toBe(true);
    expect(isSettled(DEFAULT_VOCABULARY, 'planned')).toBe(false);
    expect(isWorkKind(DEFAULT_VOCABULARY, 'note')).toBe(false);
    expect(isWorkKind(DEFAULT_VOCABULARY, 'group')).toBe(false);
    expect(isWorkKind(DEFAULT_VOCABULARY, 'decision')).toBe(true);
  });

  it('is itself a valid vocabulary', () => {
    expect(vocabularyInputSchema.safeParse(DEFAULT_VOCABULARY).success).toBe(true);
  });
});

describe('an unknown status or kind', () => {
  it('has no category and is not settled', () => {
    expect(categoryOf(DEFAULT_VOCABULARY, 'mystery')).toBeNull();
    expect(isSettled(DEFAULT_VOCABULARY, 'mystery')).toBe(false);
  });

  it('counts as work, so next_task does not hide it', () => {
    expect(isWorkKind(DEFAULT_VOCABULARY, 'mystery')).toBe(true);
  });
});

describe('readVocabulary', () => {
  it('reads null as the defaults at the stored version', () => {
    expect(readVocabulary(null, 0)).toEqual(DEFAULT_VOCABULARY);
  });

  it('reads a stored vocabulary with its version', () => {
    const { version: _version, ...stored } = custom;
    expect(readVocabulary(stored, 3)).toEqual(custom);
  });

  it('reads something malformed as the defaults rather than failing', () => {
    expect(readVocabulary({ statuses: 'nope' }, 7)).toEqual({ ...DEFAULT_VOCABULARY, version: 7 });
  });
});

describe('vocabularyInputSchema', () => {
  const edited = (patch: Partial<Vocabulary>) => ({ ...custom, ...patch });

  it('refuses two statuses with one id', () => {
    const statuses = [...custom.statuses, { ...custom.statuses[0]! }];
    expect(vocabularyInputSchema.safeParse(edited({ statuses })).success).toBe(false);
  });

  it('refuses a vocabulary without the group kind, or with it archived', () => {
    const kinds = custom.kinds.filter((one) => one.id !== 'group');
    expect(vocabularyInputSchema.safeParse(edited({ kinds })).success).toBe(false);
    const archived = custom.kinds.map((one) =>
      one.id === 'group' ? { ...one, archived: true } : one,
    );
    expect(vocabularyInputSchema.safeParse(edited({ kinds: archived })).success).toBe(false);
  });

  it('refuses a vocabulary with every status archived', () => {
    const statuses = custom.statuses.map((one) => ({ ...one, archived: true }));
    expect(vocabularyInputSchema.safeParse(edited({ statuses })).success).toBe(false);
  });

  it('refuses the same tag twice in different case', () => {
    const tags = [
      { name: 'Auth', color: 'red' as const },
      { name: 'auth', color: 'blue' as const },
    ];
    expect(vocabularyInputSchema.safeParse(edited({ tags })).success).toBe(false);
  });

  it('refuses an id that is not lowercase words', () => {
    const statuses = [...custom.statuses, { ...custom.statuses[0]!, id: 'In Review' }];
    expect(vocabularyInputSchema.safeParse(edited({ statuses })).success).toBe(false);
  });

  it('stores without the version', () => {
    const { version: _version, ...stored } = custom;
    expect(storedVocabularySchema.safeParse(stored).success).toBe(true);
  });
});

describe('vocabularyId', () => {
  it('makes a readable id from a first name', () => {
    expect(vocabularyId('In review', [], 'status')).toBe('in-review');
    expect(vocabularyId('Café  QA!', [], 'status')).toBe('cafe-qa');
  });

  it('never reuses a taken id', () => {
    expect(vocabularyId('Done', ['done', 'done-2'], 'status')).toBe('done-3');
  });

  it('uses the fallback for a name with nothing Latin in it', () => {
    expect(vocabularyId('검토 중', ['status'], 'status')).toBe('status-2');
  });
});

describe('droppedIds', () => {
  it('names statuses and kinds a save would forget', () => {
    const after = { statuses: custom.statuses.slice(1), kinds: custom.kinds };
    expect(droppedIds(custom, after)).toEqual(['status "idea"']);
  });

  it('allows archiving', () => {
    const after = {
      statuses: custom.statuses.map((one) => ({ ...one, archived: true })),
      kinds: custom.kinds,
    };
    expect(droppedIds(custom, after)).toEqual([]);
  });
});

describe('matchVocabulary', () => {
  it('takes an id, or a name in any case', () => {
    expect(matchVocabulary(custom.statuses, 'in-review', undefined, 'status')).toEqual({
      ok: true,
      id: 'in-review',
    });
    expect(matchVocabulary(custom.statuses, 'In Review', undefined, 'status')).toEqual({
      ok: true,
      id: 'in-review',
    });
  });

  it('names the valid ones on a miss', () => {
    const miss = matchVocabulary(custom.statuses, 'shipped', undefined, 'status');
    expect(miss.ok).toBe(false);
    if (!miss.ok) {
      expect(miss.message).toContain('"shipped"');
      expect(miss.message).toContain('in-review (In review)');
      expect(miss.message).not.toContain('old');
    }
  });

  it('refuses an archived value unless the node already has it', () => {
    expect(matchVocabulary(custom.statuses, 'old', 'idea', 'status').ok).toBe(false);
    expect(matchVocabulary(custom.statuses, 'old', 'old', 'status')).toEqual({
      ok: true,
      id: 'old',
    });
  });

  it('lets a node keep an unknown value it already has', () => {
    expect(matchVocabulary(custom.statuses, 'legacy', 'legacy', 'status')).toEqual({
      ok: true,
      id: 'legacy',
    });
  });
});

describe('tags', () => {
  it('adds a tag once, whatever its case', () => {
    const once = withTag(custom, 'Auth', 'red');
    expect(once.tags).toEqual([{ name: 'Auth', color: 'red' }]);
    expect(withTag(once, 'auth')).toBe(once);
  });

  it('picks a colour that is not one of the greys', () => {
    for (const roll of [0, 0.3, 0.99]) {
      expect(['gray', 'dim']).not.toContain(randomTagColor(() => roll));
    }
  });
});

describe('pickable and isDefaultName', () => {
  it('offers what is not archived, plus what the node already has', () => {
    expect(pickable(custom.statuses).map((one) => one.id)).not.toContain('old');
    expect(pickable(custom.statuses, 'old').map((one) => one.id)).toContain('old');
  });

  it('knows a default that has not been renamed', () => {
    expect(isDefaultName({ id: 'idea', name: 'Idea' }, 'statuses')).toBe(true);
    expect(isDefaultName({ id: 'idea', name: 'Someday' }, 'statuses')).toBe(false);
    expect(isDefaultName({ id: 'in-review', name: 'In review' }, 'statuses')).toBe(false);
  });
});
