import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DEFAULT_VOCABULARY, type Vocabulary } from '@schematic/schema';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../common/prisma.service.js';
import type { AccessService } from '../workspaces/access.service.js';
import type { Role } from '../workspaces/roles.js';
import { VocabularyService } from './vocabulary.service.js';

/**
 * One project row, and an update that only lands when the version it was
 * given still matches — the same condition Postgres applies. `interleave` runs
 * between a read and the write that follows it, which is where a second editor
 * saving would land.
 */
function project(role: Role = 'EDITOR') {
  const row: { vocabulary: unknown; vocabularyVersion: number } = {
    vocabulary: null,
    vocabularyVersion: 0,
  };
  const hooks: { interleave: (() => void) | null } = { interleave: null };

  const prisma = {
    project: {
      findUnique: async () => ({ ...row }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { vocabularyVersion: number };
        data: { vocabulary: unknown };
      }) => {
        const run = hooks.interleave;
        hooks.interleave = null;
        run?.();
        if (where.vocabularyVersion !== row.vocabularyVersion) return { count: 0 };
        row.vocabulary = data.vocabulary;
        row.vocabularyVersion += 1;
        return { count: 1 };
      },
    },
  } as unknown as PrismaService;

  const access = {
    requireProject: async (_user: string, _project: string, required: Role) => {
      if (required === 'EDITOR' && role === 'VIEWER') {
        throw new ForbiddenException('This action requires the EDITOR role');
      }
      return { projectId: 'p1', workspaceId: 'w1', role };
    },
  } as unknown as AccessService;

  return { service: new VocabularyService(prisma, access), row, hooks };
}

const withReview = (from: Vocabulary): Vocabulary => ({
  ...from,
  statuses: [
    ...from.statuses,
    { id: 'in-review', name: 'In review', color: 'purple', category: 'active', archived: false },
  ],
});

describe('reading a vocabulary', () => {
  it('gives the defaults, at version 0, for a project nobody has edited', async () => {
    const { service } = project();
    expect(await service.read('u1', 'p1')).toEqual(DEFAULT_VOCABULARY);
  });
});

describe('replacing a vocabulary', () => {
  it('saves against the version it was read at and moves the version on', async () => {
    const { service } = project();
    const read = await service.read('u1', 'p1');
    const saved = await service.replace('u1', 'p1', withReview(read));
    expect(saved.version).toBe(1);
    expect((await service.read('u1', 'p1')).statuses.map((one) => one.id)).toContain('in-review');
  });

  it('refuses a save made against a version somebody else has since replaced', async () => {
    const { service } = project();
    const mine = await service.read('u1', 'p1');
    const theirs = await service.read('u2', 'p1');
    await service.replace('u2', 'p1', withReview(theirs));

    await expect(service.replace('u1', 'p1', withReview(mine))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses a save that loses the race between its check and its write', async () => {
    const { service, hooks, row } = project();
    const read = await service.read('u1', 'p1');
    hooks.interleave = () => {
      row.vocabularyVersion += 1;
    };
    await expect(service.replace('u1', 'p1', withReview(read))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses to forget a status nodes may still use, and allows archiving it', async () => {
    const { service } = project();
    const read = await service.read('u1', 'p1');
    const forgot = { ...read, statuses: read.statuses.filter((one) => one.id !== 'planned') };
    await expect(service.replace('u1', 'p1', forgot)).rejects.toBeInstanceOf(BadRequestException);

    const archived = {
      ...read,
      statuses: read.statuses.map((one) =>
        one.id === 'planned' ? { ...one, archived: true } : one,
      ),
    };
    const saved = await service.replace('u1', 'p1', archived);
    expect(saved.statuses.find((one) => one.id === 'planned')?.archived).toBe(true);
  });

  it('is for editors', async () => {
    const { service } = project('VIEWER');
    await expect(
      service.replace('u1', 'p1', withReview(DEFAULT_VOCABULARY)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('adding a tag where it was typed', () => {
  it('adds it once, whatever its case', async () => {
    const { service } = project();
    const first = await service.addTag('u1', 'p1', { name: 'Auth', color: 'red' });
    const again = await service.addTag('u1', 'p1', { name: 'auth' });
    expect(first.tags).toEqual([{ name: 'Auth', color: 'red' }]);
    expect(again).toEqual(first);
  });

  it('retries against a save that landed in between rather than failing', async () => {
    const { service, hooks, row } = project();
    hooks.interleave = () => {
      // Somebody else adds a tag of their own between the read and the write.
      const { version: _version, ...lists } = DEFAULT_VOCABULARY;
      row.vocabulary = { ...lists, tags: [{ name: 'Billing', color: 'blue' }] };
      row.vocabularyVersion += 1;
    };
    const after = await service.addTag('u1', 'p1', { name: 'Auth', color: 'red' });
    expect(after.tags.map((one) => one.name).sort()).toEqual(['Auth', 'Billing']);
  });

  it('refuses a tag past the limit and keeps the vocabulary it had', async () => {
    const { service, row } = project();
    const { version: _version, ...lists } = DEFAULT_VOCABULARY;
    const tags = Array.from({ length: 500 }, (_, n) => ({ name: `t${n}`, color: 'blue' }));
    row.vocabulary = { ...lists, tags };

    await expect(service.addTag('u1', 'p1', { name: 'one-more' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect((await service.read('u1', 'p1')).tags).toHaveLength(500);
  });
});
