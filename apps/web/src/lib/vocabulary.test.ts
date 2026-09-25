import { DEFAULT_VOCABULARY, withTag, type Vocabulary } from '@schematic/schema';
import { describe, expect, it } from 'vitest';

import { ApiError } from './api';
import { createVocabularyStore, type VocabularyEdit, type VocabularyRemote } from './vocabulary';

/** A server holding one project's vocabulary, refusing a save made against an old version. */
function server() {
  let stored: Vocabulary = DEFAULT_VOCABULARY;
  const saves: Vocabulary[] = [];
  const remote: VocabularyRemote = {
    read: async () => stored,
    replace: async (_project, next) => {
      if (next.version !== stored.version) throw new ApiError(409, 'stale_vocabulary');
      saves.push(next);
      stored = { ...next, version: next.version + 1 };
      return stored;
    },
    addTag: async (_project, name, color) => {
      stored = { ...withTag(stored, name, color), version: stored.version + 1 };
      return stored;
    },
  };
  return {
    remote,
    saves,
    get stored() {
      return stored;
    },
    /** Somebody else saving, behind this tab's back. */
    elsewhere(edit: VocabularyEdit) {
      stored = { ...edit(stored), version: stored.version + 1 };
    },
  };
}

const rename =
  (id: string, name: string): VocabularyEdit =>
  (vocabulary) => ({
    ...vocabulary,
    statuses: vocabulary.statuses.map((one) => (one.id === id ? { ...one, name } : one)),
  });

const nameOf = (vocabulary: Vocabulary, id: string) =>
  vocabulary.statuses.find((one) => one.id === id)?.name;

describe('editing a vocabulary', () => {
  it('shows the edit at once, before the save comes back', async () => {
    const backend = server();
    const store = createVocabularyStore(backend.remote);
    await store.reload('p1');

    const saving = store.edit('p1', rename('idea', 'Someday'));
    expect(nameOf(store.current('p1'), 'idea')).toBe('Someday');
    await saving;
    expect(store.current('p1').version).toBe(1);
  });

  it('replays an edit onto somebody else’s newer save instead of overwriting it', async () => {
    const backend = server();
    const store = createVocabularyStore(backend.remote);
    await store.reload('p1');

    backend.elsewhere(rename('done', 'Shipped'));
    await store.edit('p1', rename('idea', 'Someday'));

    expect(nameOf(backend.stored, 'done')).toBe('Shipped');
    expect(nameOf(backend.stored, 'idea')).toBe('Someday');
    expect(nameOf(store.current('p1'), 'done')).toBe('Shipped');
  });

  it('saves two quick edits one after the other, both kept', async () => {
    const backend = server();
    const store = createVocabularyStore(backend.remote);
    await store.reload('p1');

    await Promise.all([
      store.edit('p1', rename('idea', 'Someday')),
      store.edit('p1', rename('planned', 'Next')),
    ]);

    expect(backend.saves).toHaveLength(2);
    expect(nameOf(backend.stored, 'idea')).toBe('Someday');
    expect(nameOf(backend.stored, 'planned')).toBe('Next');
  });

  it('drops an edit the server refuses and shows what the server has', async () => {
    const backend = server();
    backend.remote.replace = async () => {
      throw new ApiError(400, 'Removing is archiving');
    };
    const store = createVocabularyStore(backend.remote);
    await store.reload('p1');

    await store.edit('p1', rename('idea', 'Someday'));
    expect(nameOf(store.current('p1'), 'idea')).toBe('Idea');
    expect(store.store.getState().projects['p1']?.error).toBeInstanceOf(ApiError);
  });

  // A paste waits on this before using the statuses and kinds it added.
  it('tells its caller whether the edit was saved', async () => {
    const backend = server();
    const store = createVocabularyStore(backend.remote);
    await store.reload('p1');
    expect(await store.edit('p1', rename('idea', 'Someday'))).toBe(true);

    backend.remote.replace = async () => {
      throw new ApiError(400, 'Too many statuses');
    };
    expect(await store.edit('p1', rename('idea', 'Later'))).toBe(false);
  });
});

describe('adding a tag', () => {
  it('shows it at once and keeps what the server answers', async () => {
    const backend = server();
    const store = createVocabularyStore(backend.remote);
    await store.reload('p1');

    const adding = store.addTag('p1', 'Auth', 'red');
    expect(store.current('p1').tags).toEqual([{ name: 'Auth', color: 'red' }]);
    await adding;
    expect(store.current('p1')).toEqual(backend.stored);
  });
});
