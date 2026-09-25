import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../common/prisma.service.js';
import type { AccessService } from '../workspaces/access.service.js';
import { TrashService } from './trash.service.js';

const at = new Date('2026-09-01T00:00:00Z');
const by = { name: 'Ruma', avatarUrl: null };

/*
 * Specs
 *   Billing (trashed)    <- plan "Invoices" filed in Drafts, below it
 *     Drafts
 */
const tree = [
  { id: 'specs', parentId: null, name: 'Specs', plans: [] },
  { id: 'billing', parentId: 'specs', name: 'Billing', plans: [{ id: 'a' }] },
  { id: 'drafts', parentId: 'billing', name: 'Drafts', plans: [{ id: 'b' }, { id: 'c' }] },
];

function service(folders: readonly object[] = tree): {
  trash: TrashService;
  writes: { model: string; where: unknown }[];
} {
  const writes: { model: string; where: unknown }[] = [];
  const record =
    (model: string) =>
    async ({ where }: { where: unknown }) => {
      writes.push({ model, where });
      return { count: 1 };
    };

  const prisma = {
    project: { findMany: async () => [], updateMany: record('project') },
    folder: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if ('deletedAt' in where) {
          return [
            {
              id: 'billing',
              name: 'Billing',
              deletedAt: at,
              deletedBy: by,
              project: { name: 'Ledger' },
            },
          ];
        }
        return folders;
      },
      updateMany: record('folder'),
    },
    plan: {
      findMany: async () => [
        {
          id: 'p9',
          title: 'Old spike',
          folderId: 'drafts',
          deletedAt: at,
          deletedBy: by,
          project: { name: 'Ledger' },
          share: null,
        },
      ],
      findUniqueOrThrow: async () => ({ folderId: 'drafts' }),
      update: record('plan'),
    },
    $queryRaw: async () => [],
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(prisma),
  } as unknown as PrismaService;

  const access = {
    requireWorkspace: async () => 'ADMIN',
    requireFolder: async () => ({ projectId: 'p1' }),
    requirePlan: async () => ({ projectId: 'p1' }),
  } as unknown as AccessService;

  return { trash: new TrashService(prisma, access), writes };
}

describe('the trash with nested folders', () => {
  it('says where a nested folder sat, by its path', async () => {
    const { trash } = service();
    const folder = (await trash.list('u', 'w1')).find((item) => item.kind === 'folder');
    expect(folder?.location).toEqual({ project: 'Ledger', folders: ['Specs'] });
    expect(folder?.where).toContain('Ledger / Specs');
  });

  /* Everything below it went to the trash with it, so that is what it holds. */
  it('counts the plans in the folders below a folder too', async () => {
    const { trash } = service();
    const folder = (await trash.list('u', 'w1')).find((item) => item.kind === 'folder');
    expect(folder?.where).toMatch(/^3 plans inside/);
  });

  it('says where a plan sat, folders and all', async () => {
    const { trash } = service();
    const plan = (await trash.list('u', 'w1')).find((item) => item.kind === 'plan');
    expect(plan?.location).toEqual({ project: 'Ledger', folders: ['Specs', 'Billing', 'Drafts'] });
    expect(plan?.where).toBe('Ledger / Specs / Billing / Drafts');
  });

  it('restores a folder with the folders above it', async () => {
    const { trash, writes } = service();
    await trash.restoreFolder('u', 'billing');
    const folders = writes.find((write) => write.model === 'folder');
    expect(folders?.where).toMatchObject({ id: { in: ['billing', 'specs'] } });
  });

  /* A plan brought back below a folder still in the trash would be out of reach. */
  it('restores a plan with every folder above it', async () => {
    const { trash, writes } = service();
    await trash.restorePlan('u', 'p9');
    const folders = writes.find((write) => write.model === 'folder');
    expect(folders?.where).toMatchObject({ id: { in: ['drafts', 'billing', 'specs'] } });
  });

  /* Two siblings of one name, and a path would reach either. */
  it('refuses to bring back a folder whose name a sibling has taken since', async () => {
    const { trash, writes } = service([
      { id: 'old', parentId: null, name: 'Specs', deletedAt: at },
      { id: 'new', parentId: null, name: 'specs', deletedAt: null },
      { id: 'drafts', parentId: 'old', name: 'Drafts', deletedAt: null },
    ]);
    await expect(trash.restoreFolder('u', 'old')).rejects.toBeInstanceOf(ConflictException);
    // A plan filed below it would bring it back too.
    await expect(trash.restorePlan('u', 'p9')).rejects.toBeInstanceOf(ConflictException);
    expect(writes).toEqual([]);
  });
});

/**
 * Every call the service makes, in order, and whether it went through the
 * transaction. Two transactions cannot race in a fake, so what is proved is the
 * shape that keeps them apart in Postgres: the tree is locked, then read, then
 * written, all inside one transaction.
 */
function logged(): { trash: TrashService; calls: string[] } {
  const calls: string[] = [];
  const client = (where: string) => {
    const call =
      (name: string, result: unknown) =>
      async (..._args: unknown[]) => {
        calls.push(`${where} ${name}`);
        return result;
      };
    return {
      $queryRaw: call('lock', []),
      project: {
        findMany: call('project.findMany', [{ id: 'p1' }]),
        updateMany: call('project.updateMany', { count: 0 }),
        deleteMany: call('project.deleteMany', { count: 0 }),
      },
      folder: {
        findMany: call('folder.findMany', [
          { id: 'billing', parentId: null, name: 'Billing', deletedAt: at, projectId: 'p1' },
        ]),
        updateMany: call('folder.updateMany', { count: 1 }),
        deleteMany: call('folder.deleteMany', { count: 1 }),
      },
      plan: {
        findUniqueOrThrow: call('plan.findUniqueOrThrow', { folderId: 'billing' }),
        update: call('plan.update', {}),
        deleteMany: call('plan.deleteMany', { count: 1 }),
      },
    };
  };
  const tx = client('tx');
  const prisma = {
    ...client('outside'),
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      calls.push('begin');
      const out = await work(tx);
      calls.push('commit');
      return out;
    },
  } as unknown as PrismaService;
  const access = {
    requireWorkspace: async () => 'ADMIN',
    requireFolder: async () => ({ projectId: 'p1' }),
    requirePlan: async () => ({ projectId: 'p1' }),
  } as unknown as AccessService;
  return { trash: new TrashService(prisma, access), calls };
}

describe('emptying the trash while something is restored', () => {
  /* A restore landing between the read and the delete would lose the folder and its plans. */
  it('reads what to delete inside the transaction that deletes it, after locking the trees', async () => {
    const { trash, calls } = logged();
    await trash.empty('u', 'w1');
    expect(calls.filter((call) => call.startsWith('outside'))).toEqual([]);
    expect(calls.indexOf('tx lock')).toBeGreaterThan(calls.indexOf('begin'));
    expect(calls.indexOf('tx lock')).toBeLessThan(calls.indexOf('tx folder.findMany'));
    expect(calls.indexOf('tx folder.deleteMany')).toBeLessThan(calls.indexOf('commit'));
  });

  it('restores under the same lock', async () => {
    for (const restore of ['folder', 'plan'] as const) {
      const { trash, calls } = logged();
      if (restore === 'folder') await trash.restoreFolder('u', 'billing');
      else await trash.restorePlan('u', 'p9');
      expect(calls.filter((call) => call.startsWith('outside'))).toEqual([]);
      expect(calls.indexOf('tx lock')).toBeGreaterThan(calls.indexOf('begin'));
      expect(calls.indexOf('tx lock')).toBeLessThan(calls.indexOf('tx folder.findMany'));
      expect(calls.indexOf('tx folder.updateMany')).toBeLessThan(calls.indexOf('commit'));
    }
  });
});
