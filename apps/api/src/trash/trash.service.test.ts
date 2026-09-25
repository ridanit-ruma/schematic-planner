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

function service(): { trash: TrashService; writes: { model: string; where: unknown }[] } {
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
        return tree;
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
    $transaction: async (writes: Promise<unknown>[]) => Promise.all(writes),
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
});
