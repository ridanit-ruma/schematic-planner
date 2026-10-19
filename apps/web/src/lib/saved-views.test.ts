import type { SavedView, SavedViews } from '@schematic/schema';
import { describe, expect, it } from 'vitest';

import { ApiError } from './api';
import { saveViews, type SavedViewsRemote } from './saved-views';

const view = (id: string): SavedView => ({
  id,
  name: id,
  type: 'table',
  filter: { kinds: [], statuses: [], tags: [], text: '' },
});

/** A server holding one list, refusing a save from an older version the way the API does. */
function server(start: SavedViews): SavedViewsRemote & { stored: () => SavedViews } {
  let stored = start;
  return {
    stored: () => stored,
    read: async () => stored,
    replace: async (_project, next) => {
      if (next.version !== stored.version) throw new ApiError(409, 'stale_views');
      stored = { version: stored.version + 1, views: next.views };
      return stored;
    },
  };
}

describe('saveViews', () => {
  it('replays the edit onto a newer save instead of overwriting it', async () => {
    const remote = server({ version: 2, views: [view('theirs')] });
    const read = { version: 1, views: [] };
    const saved = await saveViews(remote, 'p1', read, (views) => [...views, view('mine')]);
    expect(saved.views.map((one) => one.id)).toEqual(['theirs', 'mine']);
    expect(remote.stored().version).toBe(3);
  });

  it('gives up on anything but a conflict', async () => {
    const remote: SavedViewsRemote = {
      read: async () => ({ version: 0, views: [] }),
      replace: async () => {
        throw new ApiError(403, 'forbidden');
      },
    };
    await expect(saveViews(remote, 'p1', { version: 0, views: [] }, (v) => v)).rejects.toThrow(
      'forbidden',
    );
  });
});
