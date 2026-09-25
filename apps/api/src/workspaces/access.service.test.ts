import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../common/prisma.service.js';
import { AccessService } from './access.service.js';

const at = new Date('2026-09-01T00:00:00Z');

/*
 * Specs (trashed)
 *   Billing
 *     Invoices   <- the plan is filed here
 * Notes
 */
const tree = [
  { id: 'specs', parentId: null, deletedAt: at as Date | null },
  { id: 'billing', parentId: 'specs', deletedAt: null },
  { id: 'invoices', parentId: 'billing', deletedAt: null },
  { id: 'notes', parentId: null, deletedAt: null },
];

function access(folders: typeof tree): { access: AccessService; asked: string[] } {
  const asked: string[] = [];
  const project = { id: 'p1', workspaceId: 'w1', deletedAt: null };
  const find = (id: string) => folders.find((folder) => folder.id === id) ?? null;

  const prisma = {
    membership: {
      findUnique: async () => ({ role: 'OWNER', user: { suspendedAt: null } }),
    },
    plan: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const folderId = where.id === 'plan-in-invoices' ? 'invoices' : 'notes';
        return { id: where.id, deletedAt: null, folder: find(folderId), project };
      },
    },
    folder: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const folder = find(where.id);
        return folder === null ? null : { ...folder, project };
      },
      findMany: async () => {
        asked.push('folder.findMany');
        return folders;
      },
    },
  } as unknown as PrismaService;

  return { access: new AccessService(prisma), asked };
}

describe('reaching something below a trashed folder', () => {
  it('does not find a plan whose folder is under a trashed one', async () => {
    const { access: service } = access(tree);
    await expect(service.requirePlan('u', 'plan-in-invoices', 'VIEWER')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('finds it when the trash is what is asking', async () => {
    const { access: service } = access(tree);
    await expect(
      service.requirePlan('u', 'plan-in-invoices', 'VIEWER', { includeTrashed: true }),
    ).resolves.toMatchObject({ projectId: 'p1' });
  });

  it('does not find a folder under a trashed one', async () => {
    const { access: service } = access(tree);
    await expect(service.requireFolder('u', 'invoices', 'VIEWER')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('finds both again once the trashed folder is restored', async () => {
    const restored = tree.map((folder) => ({ ...folder, deletedAt: null }));
    const { access: service } = access(restored);
    await expect(service.requirePlan('u', 'plan-in-invoices', 'VIEWER')).resolves.toBeDefined();
    await expect(service.requireFolder('u', 'invoices', 'VIEWER')).resolves.toBeDefined();
  });

  /* The common case — a plan in a top-level folder — costs no extra query. */
  it('does not read the tree for a folder with no parent', async () => {
    const { access: service, asked } = access(tree);
    await service.requirePlan('u', 'plan-in-notes', 'VIEWER');
    await service.requireFolder('u', 'notes', 'VIEWER');
    expect(asked).toEqual([]);
  });
});
