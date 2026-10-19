import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { SavedView } from '@schematic/schema';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../common/prisma.service.js';
import type { AccessService } from '../workspaces/access.service.js';
import type { Role } from '../workspaces/roles.js';
import { ViewsService } from './views.service.js';

/** One project row whose update lands only while the version it was given still matches. */
function project(role: Role = 'EDITOR') {
  const row: { views: unknown; viewsVersion: number } = { views: null, viewsVersion: 0 };
  const prisma = {
    project: {
      findUnique: async () => ({ ...row }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { viewsVersion: number };
        data: { views: unknown };
      }) => {
        if (where.viewsVersion !== row.viewsVersion) return { count: 0 };
        row.views = data.views;
        row.viewsVersion += 1;
        return { count: 1 };
      },
    },
  } as unknown as PrismaService;
  const access = {
    requireProject: async (_user: string, _project: string, required: Role) => {
      if (required === 'EDITOR' && role === 'VIEWER') throw new ForbiddenException();
      return { projectId: 'p1', workspaceId: 'w1', role };
    },
  } as unknown as AccessService;
  return { service: new ViewsService(prisma, access), row };
}

const blocked: SavedView = {
  id: 'blocked',
  name: 'Blocked',
  type: 'board',
  filter: { kinds: [], statuses: ['blocked'], tags: [], text: '' },
};

describe('ViewsService', () => {
  it('reads a project nobody saved a view in as none', async () => {
    const { service } = project();
    await expect(service.read('u1', 'p1')).resolves.toEqual({ version: 0, views: [] });
  });

  it('saves, and refuses a save made from an older read', async () => {
    const { service } = project();
    await expect(service.replace('u1', 'p1', { version: 0, views: [blocked] })).resolves.toEqual({
      version: 1,
      views: [blocked],
    });
    await expect(service.replace('u1', 'p1', { version: 0, views: [] })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.read('u1', 'p1')).resolves.toEqual({ version: 1, views: [blocked] });
  });

  it('lets a viewer read but not save', async () => {
    const { service } = project('VIEWER');
    await expect(service.read('u1', 'p1')).resolves.toBeDefined();
    await expect(service.replace('u1', 'p1', { version: 0, views: [] })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
