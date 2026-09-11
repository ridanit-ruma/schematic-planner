import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../config/env.js';
import type { PrismaService } from '../common/prisma.service.js';
import type { CollabService } from '../collab/collab.service.js';
import type { AccessService } from './access.service.js';
import type { Role } from './roles.js';
import { WorkspacesService } from './workspaces.service.js';

/**
 * `requireWorkspace` returns the actor's own role and `createInvite` used to
 * throw it away, so a workspace ADMIN could mint an OWNER invite. That is the
 * first step of the one chain that gets around the rule this file does enforce:
 * mint the invite, remove your own membership so `acceptInvite`'s upsert takes
 * its create branch, accept, and the workspace has a second owner who can then
 * demote the first. Both ends of that are closed now.
 */

function service(actorRole: Role): {
  workspaces: WorkspacesService;
  removed: string[];
  revoked: string[];
} {
  const removed: string[] = [];
  const revoked: string[] = [];

  const prisma = {
    invite: { create: async () => ({ id: 'invite-1' }) },
    membership: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        removed.push(where.userId);
        return { count: 1 };
      },
      findUnique: async () => null,
    },
  } as unknown as PrismaService;

  const access = {
    requireWorkspace: async () => actorRole,
  } as unknown as AccessService;

  const collab = { revoke: (userId: string) => revoked.push(userId) } as unknown as CollabService;
  const config = { appPublicUrl: 'https://example.invalid' } as AppConfig;

  return { workspaces: new WorkspacesService(prisma, access, collab, config), removed, revoked };
}

const invite = { role: 'OWNER' as Role, expiresInDays: 14 };

describe('the role an invitation may carry', () => {
  it('is capped at the role of whoever issues it', async () => {
    const { workspaces } = service('ADMIN');
    await expect(workspaces.createInvite('admin-1', 'ws-1', invite)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('still lets an owner invite an owner', async () => {
    const { workspaces } = service('OWNER');
    await expect(workspaces.createInvite('owner-1', 'ws-1', invite)).resolves.toMatchObject({
      url: expect.stringContaining('/invite/'),
    });
  });

  it('leaves the ordinary case alone', async () => {
    const { workspaces } = service('ADMIN');
    await expect(
      workspaces.createInvite('admin-1', 'ws-1', { role: 'EDITOR', expiresInDays: 14 }),
    ).resolves.toMatchObject({ url: expect.stringContaining('/invite/') });
  });
});

describe('removing a member', () => {
  /* `updateMember` already refused this; the two now match. */
  it('refuses to remove the person asking', async () => {
    const { workspaces, removed } = service('ADMIN');
    await expect(workspaces.removeMember('admin-1', 'ws-1', 'admin-1')).rejects.toThrow(
      /cannot remove yourself/,
    );
    expect(removed).toEqual([]);
  });

  /* A socket is authorised when it opens and never again, so taking access
     away has to reach the ones already held. */
  it('drops the sockets the removed member is holding', async () => {
    const { workspaces, removed, revoked } = service('ADMIN');
    await expect(workspaces.removeMember('admin-1', 'ws-1', 'someone-else')).resolves.toEqual({
      ok: true,
    });
    expect(removed).toEqual(['someone-else']);
    expect(revoked).toEqual(['someone-else']);
  });
});
