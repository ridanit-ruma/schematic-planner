import { describe, expect, it } from 'vitest';

import {
  ancestorsOf,
  hiddenFolderIds,
  isTrashed,
  outsideFolders,
  pathOf,
  siblingNamed,
  subtreeOf,
  trashedFolderIds,
  wouldLoop,
} from './folder-tree.js';

const at = new Date('2026-09-01T00:00:00Z');

/*
 * Specs
 *   Billing
 *     Invoices
 *   Auth
 * Notes
 */
const tree = [
  { id: 'specs', parentId: null, name: 'Specs', deletedAt: null },
  { id: 'billing', parentId: 'specs', name: 'Billing', deletedAt: null },
  { id: 'invoices', parentId: 'billing', name: 'Invoices', deletedAt: null },
  { id: 'auth', parentId: 'specs', name: 'Auth', deletedAt: null },
  { id: 'notes', parentId: null, name: 'Notes', deletedAt: null },
];

describe('the folder tree', () => {
  it('walks up from a folder, nearest first', () => {
    expect(ancestorsOf(tree, 'invoices').map((folder) => folder.id)).toEqual(['billing', 'specs']);
    expect(ancestorsOf(tree, 'notes')).toEqual([]);
  });

  it('gives a folder its path from the top', () => {
    expect(pathOf(tree, 'invoices')).toEqual(['Specs', 'Billing', 'Invoices']);
    expect(pathOf(tree, 'notes')).toEqual(['Notes']);
    expect(pathOf(tree, 'missing')).toEqual([]);
  });

  it('finds everything below a folder, the folder included', () => {
    expect([...subtreeOf(tree, 'specs')].sort()).toEqual(['auth', 'billing', 'invoices', 'specs']);
    expect([...subtreeOf(tree, 'invoices')]).toEqual(['invoices']);
  });

  /* A loop in stored data must end a walk, not hang the request. */
  it('survives a loop that should never have been stored', () => {
    const looped = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
    ];
    expect(ancestorsOf(looped, 'a').map((folder) => folder.id)).toEqual(['b']);
    expect([...subtreeOf(looped, 'a')].sort()).toEqual(['a', 'b']);
  });
});

describe('moving a folder', () => {
  it('cannot put a folder inside itself', () => {
    expect(wouldLoop(tree, 'billing', 'billing')).toBe(true);
  });

  it('cannot put a folder inside one of its descendants', () => {
    expect(wouldLoop(tree, 'specs', 'invoices')).toBe(true);
    expect(wouldLoop(tree, 'billing', 'invoices')).toBe(true);
  });

  it('can put it beside or above where it was', () => {
    expect(wouldLoop(tree, 'invoices', 'specs')).toBe(false);
    expect(wouldLoop(tree, 'billing', 'notes')).toBe(false);
    expect(wouldLoop(tree, 'billing', null)).toBe(false);
  });
});

describe('names among siblings', () => {
  it('finds a sibling of the same name, whatever its case', () => {
    expect(siblingNamed(tree, 'specs', 'billing')?.id).toBe('billing');
    expect(siblingNamed(tree, 'specs', '  AUTH ')?.id).toBe('auth');
  });

  /* The same name in another branch is a different place, not a clash. */
  it('does not look outside the parent', () => {
    expect(siblingNamed(tree, null, 'Billing')).toBeUndefined();
    expect(siblingNamed(tree, 'notes', 'Invoices')).toBeUndefined();
  });

  it('lets a folder keep its own name', () => {
    expect(siblingNamed(tree, 'specs', 'Billing', 'billing')).toBeUndefined();
  });

  it('frees a name that went to the trash', () => {
    const thrown = tree.map((folder) =>
      folder.id === 'auth' ? { ...folder, deletedAt: at } : folder,
    );
    expect(siblingNamed(thrown, 'specs', 'Auth')).toBeUndefined();
  });
});

describe('a folder in the trash', () => {
  const thrown = tree.map((folder) =>
    folder.id === 'billing' ? { ...folder, deletedAt: at } : folder,
  );

  it('takes everything below it along, without marking it', () => {
    expect([...trashedFolderIds(thrown)].sort()).toEqual(['billing', 'invoices']);
    expect(isTrashed(thrown, 'invoices')).toBe(true);
    expect(thrown.find((folder) => folder.id === 'invoices')?.deletedAt).toBeNull();
  });

  it('leaves its parent and siblings where they were', () => {
    expect(isTrashed(thrown, 'specs')).toBe(false);
    expect(isTrashed(thrown, 'auth')).toBe(false);
  });

  /* Restoring clears one mark, and the subtree comes back whole. */
  it('brings the subtree back when its own mark is cleared', () => {
    expect(trashedFolderIds(tree).size).toBe(0);
  });

  /* Thrown away separately first, it stays thrown away when its parent returns. */
  it('keeps a mark of its own when an ancestor is restored', () => {
    const both = tree.map((folder) =>
      folder.id === 'invoices' ? { ...folder, deletedAt: at } : folder,
    );
    expect([...trashedFolderIds(both)]).toEqual(['invoices']);
  });
});

describe('leaving trashed folders out of a plan query', () => {
  it('adds nothing when nothing is in the trash', () => {
    expect(outsideFolders([])).toEqual({});
  });

  /* `NOT IN` is never true of a null, so the top level needs its own branch. */
  it('keeps plans at the top level', () => {
    expect(outsideFolders(['billing'])).toEqual({
      OR: [{ folderId: null }, { folderId: { notIn: ['billing'] } }],
    });
  });

  it('reads the whole project only when something is in the trash', async () => {
    const asked: unknown[] = [];
    const folder = {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        asked.push(where);
        return 'AND' in where
          ? [{ projectId: 'p1' }]
          : tree.map((row) => (row.id === 'specs' ? { ...row, deletedAt: at } : row));
      },
    };
    const hidden = await hiddenFolderIds({ folder } as never, { projectId: 'p1' });
    expect(hidden.sort()).toEqual(['auth', 'billing', 'invoices', 'specs']);
    expect(asked).toHaveLength(2);

    const none = { findMany: async () => [] };
    expect(await hiddenFolderIds({ folder: none } as never, { projectId: 'p1' })).toEqual([]);
  });
});
