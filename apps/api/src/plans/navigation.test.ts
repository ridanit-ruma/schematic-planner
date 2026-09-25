import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../common/prisma.service.js';
import type { CollabService } from '../collab/collab.service.js';
import type { AccessService } from '../workspaces/access.service.js';
import type { PlanDocumentsService } from './plan-documents.service.js';
import { PlansService } from './plans.service.js';

const at = new Date('2026-09-01T00:00:00Z');

/*
 * Ledger
 *   Specs
 *     Billing (trashed)
 *       Drafts          <- "Drafted" filed here
 *     Auth              <- "Login" filed here
 *   "Loose" at the top level
 */
const folders = [
  { id: 'specs', name: 'Specs', parentId: null, deletedAt: null as Date | null },
  { id: 'billing', name: 'Billing', parentId: 'specs', deletedAt: at as Date | null },
  { id: 'drafts', name: 'Drafts', parentId: 'billing', deletedAt: null as Date | null },
  { id: 'auth', name: 'Auth', parentId: 'specs', deletedAt: null as Date | null },
];
const plans = [
  { id: 'drafted', title: 'Drafted', updatedAt: at, folderId: 'drafts' },
  { id: 'login', title: 'Login', updatedAt: at, folderId: 'auth' },
  { id: 'loose', title: 'Loose', updatedAt: at, folderId: null },
];

function service(): PlansService {
  const prisma = {
    workspace: {
      findUniqueOrThrow: async () => ({ id: 'w1', slug: 'demo', name: 'Demo' }),
    },
    project: {
      findMany: async () => [
        {
          id: 'p1',
          slug: 'ledger',
          name: 'Ledger',
          folders: folders.map(({ id, name, parentId }) => ({ id, name, parentId })),
          plans,
        },
      ],
    },
    folder: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        'AND' in where
          ? folders.filter((folder) => folder.deletedAt !== null).map(() => ({ projectId: 'p1' }))
          : folders,
    },
  } as unknown as PrismaService;

  const access = {
    requireWorkspace: async () => 'EDITOR',
    requirePlan: async () => ({ planId: 'login', projectId: 'p1', workspaceId: 'w1' }),
  } as unknown as AccessService;

  return new PlansService(prisma, access, {} as CollabService, {} as PlanDocumentsService);
}

describe('the workspace tree', () => {
  it('names the workspace and the caller’s role in it', async () => {
    const tree = await service().workspaceNavigation('u', 'w1');
    expect(tree.workspace).toEqual({ id: 'w1', slug: 'demo', name: 'Demo', role: 'EDITOR' });
  });

  it('carries each folder’s parent so the explorer can nest them', async () => {
    const [project] = (await service().workspaceNavigation('u', 'w1')).projects;
    expect(project?.folders).toContainEqual({ id: 'auth', name: 'Auth', parentId: 'specs' });
  });

  it('leaves out a trashed folder, the folders below it and the plans in them', async () => {
    const [project] = (await service().workspaceNavigation('u', 'w1')).projects;
    expect(project?.folders.map((folder) => folder.id)).toEqual(['specs', 'auth']);
    expect(project?.plans.map((plan) => plan.id)).toEqual(['login', 'loose']);
  });

  /* The plan-page route answers the same tree, so its callers keep working. */
  it('is what a plan’s navigation answers too, with that plan’s project', async () => {
    const plans = service();
    const fromPlan = await plans.navigation('u', 'login');
    const fromWorkspace = await plans.workspaceNavigation('u', 'w1');
    expect(fromPlan).toEqual({ ...fromWorkspace, projectId: 'p1' });
  });
});
