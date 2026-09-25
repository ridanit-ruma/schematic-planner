import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../common/prisma.service.js';
import type { AccessService } from '../workspaces/access.service.js';
import { isTrashed, wouldLoop } from './folder-tree.js';
import { FoldersService } from './folders.service.js';

interface Row {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  deletedAt: Date | null;
  updatedAt: Date;
}

const at = new Date('2026-09-01T00:00:00Z');

/**
 * Just enough of Prisma's folder table to run the service against: the filters
 * it actually sends, answered from an array.
 */
function service(seed: Omit<Row, 'updatedAt'>[]): { folders: FoldersService; rows: Row[] } {
  const rows: Row[] = seed.map((row) => ({ ...row, updatedAt: at }));
  let made = 0;

  const matches = (row: Row, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([field, wanted]) => row[field as keyof Row] === wanted);

  const folder = {
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      rows
        .filter((row) => matches(row, where))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => ({ ...row, _count: { plans: 0 } })),
    create: async ({ data }: { data: Omit<Row, 'id' | 'deletedAt' | 'updatedAt'> }) => {
      made += 1;
      const row = { id: `new-${made}`, deletedAt: null, updatedAt: at, ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = rows.find((candidate) => candidate.id === where.id) as Row;
      Object.assign(row, data);
      return row;
    },
  };

  // One lock, held the way Postgres holds a row lock: a second transaction that
  // asks for it waits until the first one ends.
  let held: Promise<void> = Promise.resolve();
  const prisma = {
    folder,
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      let release = (): void => {};
      const tx = {
        folder,
        $queryRaw: async () => {
          const before = held;
          held = new Promise((resolve) => (release = resolve));
          await before;
          return [];
        },
      };
      try {
        return await work(tx);
      } finally {
        release();
      }
    },
  } as unknown as PrismaService;

  // The real rule for what is reachable, over the same rows: a folder in the
  // trash, by its own mark or an ancestor's, is not found.
  const access = {
    requireProject: async (_userId: string, projectId: string) => ({ projectId }),
    requireFolder: async (_userId: string, folderId: string) => {
      const row = rows.find((candidate) => candidate.id === folderId);
      if (row === undefined || isTrashed(rows, folderId)) {
        throw new NotFoundException('Folder not found');
      }
      return { folderId, projectId: row.projectId };
    },
  } as unknown as AccessService;

  return { folders: new FoldersService(prisma, access), rows };
}

/*
 * p1:
 *   Specs
 *     Billing
 *       Invoices
 *     Auth
 *   Notes
 * p2:
 *   Elsewhere
 */
const seed = [
  { id: 'specs', projectId: 'p1', parentId: null, name: 'Specs', deletedAt: null },
  { id: 'billing', projectId: 'p1', parentId: 'specs', name: 'Billing', deletedAt: null },
  { id: 'invoices', projectId: 'p1', parentId: 'billing', name: 'Invoices', deletedAt: null },
  { id: 'auth', projectId: 'p1', parentId: 'specs', name: 'Auth', deletedAt: null },
  { id: 'notes', projectId: 'p1', parentId: null, name: 'Notes', deletedAt: null },
  { id: 'elsewhere', projectId: 'p2', parentId: null, name: 'Elsewhere', deletedAt: null },
];

describe('listing folders', () => {
  it('gives them in tree order, each with its parent and path', async () => {
    const { folders } = service(seed);
    const listed = await folders.list('u', 'p1');
    expect(listed.map((folder) => folder.path.join('/'))).toEqual([
      'Notes',
      'Specs',
      'Specs/Auth',
      'Specs/Billing',
      'Specs/Billing/Invoices',
    ]);
    expect(listed.find((folder) => folder.id === 'invoices')?.parentId).toBe('billing');
  });

  it('leaves out a trashed folder and everything below it', async () => {
    const { folders } = service(
      seed.map((row) => (row.id === 'billing' ? { ...row, deletedAt: at } : row)),
    );
    const listed = await folders.list('u', 'p1');
    expect(listed.map((folder) => folder.id)).toEqual(['notes', 'specs', 'auth']);
  });
});

describe('making a folder', () => {
  it('makes one inside another', async () => {
    const { folders } = service(seed);
    const made = await folders.create('u', 'p1', { name: 'Drafts', parentId: 'billing' });
    expect(made).toMatchObject({ name: 'Drafts', parentId: 'billing', projectId: 'p1' });
  });

  it('refuses a name a sibling already has, whatever its case', async () => {
    const { folders } = service(seed);
    await expect(
      folders.create('u', 'p1', { name: 'invoices', parentId: 'billing' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(folders.create('u', 'p1', { name: 'NOTES' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  /* Names are unique among siblings, not across the project. */
  it('allows the same name in another branch', async () => {
    const { folders } = service(seed);
    await expect(folders.create('u', 'p1', { name: 'Billing' })).resolves.toMatchObject({
      parentId: null,
    });
    await expect(
      folders.create('u', 'p1', { name: 'Invoices', parentId: 'auth' }),
    ).resolves.toMatchObject({ parentId: 'auth' });
  });

  it('frees a name that went to the trash', async () => {
    const { folders } = service(
      seed.map((row) => (row.id === 'notes' ? { ...row, deletedAt: at } : row)),
    );
    await expect(folders.create('u', 'p1', { name: 'Notes' })).resolves.toMatchObject({
      name: 'Notes',
    });
  });

  it('refuses a parent in another project', async () => {
    const { folders } = service(seed);
    await expect(
      folders.create('u', 'p1', { name: 'Drafts', parentId: 'elsewhere' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a parent in the trash, even by ancestry', async () => {
    const { folders } = service(
      seed.map((row) => (row.id === 'specs' ? { ...row, deletedAt: at } : row)),
    );
    await expect(
      folders.create('u', 'p1', { name: 'Drafts', parentId: 'invoices' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('moving a folder', () => {
  it('moves it, and what is inside it goes along', async () => {
    const { folders, rows } = service(seed);
    await folders.update('u', 'billing', { parentId: 'notes' });
    expect(rows.find((row) => row.id === 'billing')?.parentId).toBe('notes');
    // Invoices still hangs off Billing, so it moved with it.
    const listed = await folders.list('u', 'p1');
    expect(listed.find((folder) => folder.id === 'invoices')?.path).toEqual([
      'Notes',
      'Billing',
      'Invoices',
    ]);
  });

  it('moves it to the top level', async () => {
    const { folders, rows } = service(seed);
    await folders.update('u', 'invoices', { parentId: null });
    expect(rows.find((row) => row.id === 'invoices')?.parentId).toBeNull();
  });

  it('refuses to put a folder inside itself', async () => {
    const { folders } = service(seed);
    await expect(folders.update('u', 'billing', { parentId: 'billing' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to put a folder inside one of its descendants', async () => {
    const { folders, rows } = service(seed);
    await expect(folders.update('u', 'specs', { parentId: 'invoices' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rows.find((row) => row.id === 'specs')?.parentId).toBeNull();
  });

  /* Each move alone is fine; both at once would leave two folders inside each other. */
  it('refuses the second of two moves that together would make a loop', async () => {
    const { folders, rows } = service(seed);
    const results = await Promise.allSettled([
      folders.update('u', 'specs', { parentId: 'notes' }),
      folders.update('u', 'notes', { parentId: 'specs' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(rows.some((row) => wouldLoop(rows, row.id, row.parentId))).toBe(false);
  });

  it('refuses a parent in another project', async () => {
    const { folders } = service(seed);
    await expect(folders.update('u', 'billing', { parentId: 'elsewhere' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses a move that would give the new parent two children of one name', async () => {
    const { folders } = service([
      ...seed,
      { id: 'notes-auth', projectId: 'p1', parentId: 'notes', name: 'Auth', deletedAt: null },
    ]);
    await expect(folders.update('u', 'notes-auth', { parentId: 'specs' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses a rename to a sibling’s name, but not to its own', async () => {
    const { folders } = service(seed);
    await expect(folders.update('u', 'auth', { name: 'billing' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(folders.update('u', 'auth', { name: 'AUTH' })).resolves.toMatchObject({
      name: 'AUTH',
    });
  });

  /* Twins made before names were unique must stay renameable apart. */
  it('lets one of a pair of twins be renamed or left as it is', async () => {
    const { folders } = service([
      ...seed,
      { id: 'twin', projectId: 'p1', parentId: null, name: 'Notes', deletedAt: null },
    ]);
    await expect(folders.update('u', 'twin', { name: 'Notes' })).resolves.toBeDefined();
    await expect(folders.update('u', 'twin', { name: 'Old notes' })).resolves.toMatchObject({
      name: 'Old notes',
    });
  });
});

describe('making a path', () => {
  it('makes only the parts that are missing', async () => {
    const { folders, rows } = service(seed);
    const { folder, made } = await folders.ensurePath('u', 'p1', ['specs', 'Billing', 'Drafts']);
    expect(made).toEqual(['Drafts']);
    expect(folder.parentId).toBe('billing');
    expect(rows).toHaveLength(seed.length + 1);
  });

  it('makes nothing when the whole path is there', async () => {
    const { folders } = service(seed);
    const { folder, made } = await folders.ensurePath('u', 'p1', ['Specs', 'Billing']);
    expect(made).toEqual([]);
    expect(folder.id).toBe('billing');
  });

  it('makes every part of a new path, each inside the last', async () => {
    const { folders, rows } = service(seed);
    const { made } = await folders.ensurePath('u', 'p1', ['Archive', '2025']);
    expect(made).toEqual(['Archive', '2025']);
    const archive = rows.find((row) => row.name === 'Archive');
    expect(rows.find((row) => row.name === '2025')?.parentId).toBe(archive?.id);
  });

  it('makes one folder of a name asked for twice at once', async () => {
    const { folders, rows } = service(seed);
    await Promise.all([
      folders.ensurePath('u', 'p1', ['Archive', '2025']),
      folders.ensurePath('u', 'p1', ['Archive', '2025']),
    ]);
    expect(rows.filter((row) => row.name === 'Archive')).toHaveLength(1);
    expect(rows.filter((row) => row.name === '2025')).toHaveLength(1);

    const made = await Promise.allSettled([
      folders.create('u', 'p1', { name: 'Drafts' }),
      folders.create('u', 'p1', { name: 'Drafts' }),
    ]);
    expect(made.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
  });

  /* A folder in the trash is not "already there"; a new one takes its place. */
  it('does not reuse a folder in the trash', async () => {
    const { folders } = service(
      seed.map((row) => (row.id === 'billing' ? { ...row, deletedAt: at } : row)),
    );
    const { made } = await folders.ensurePath('u', 'p1', ['Specs', 'Billing']);
    expect(made).toEqual(['Billing']);
  });
});
