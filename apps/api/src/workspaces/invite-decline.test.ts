import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../config/env.js';
import type { PrismaService } from '../common/prisma.service.js';
import type { CollabService } from '../collab/collab.service.js';
import type { AccessService } from './access.service.js';
import { WorkspacesService } from './workspaces.service.js';

const later = new Date(Date.now() + 86_400_000);
const stored = { id: 'invite-1', acceptedAt: null, declinedAt: null, expiresAt: later };

function service(invite: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = [];
  const prisma = {
    invite: {
      findUnique: async () => invite,
      update: async (args: Record<string, unknown>) => {
        updates.push(args);
        return {};
      },
    },
  } as unknown as PrismaService;

  const workspaces = new WorkspacesService(
    prisma,
    {} as AccessService,
    {} as CollabService,
    {} as AppConfig,
  );
  return { workspaces, updates };
}

describe('declineInvite', () => {
  it('writes the refusal down', async () => {
    const { workspaces, updates } = service(stored);
    await expect(workspaces.declineInvite('user-1', 'tok')).resolves.toEqual({ ok: true });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ where: { id: 'invite-1' } });
    expect((updates[0]!['data'] as Record<string, unknown>)['declinedAt']).toBeInstanceOf(Date);
  });

  /* Clicking Decline twice is one refusal, not an error. */
  it('says nothing new the second time', async () => {
    const { workspaces, updates } = service({ ...stored, declinedAt: new Date() });
    await expect(workspaces.declineInvite('user-1', 'tok')).resolves.toEqual({ ok: true });
    expect(updates).toHaveLength(0);
  });

  it('refuses to decline one that was already taken', async () => {
    const { workspaces } = service({ ...stored, acceptedAt: new Date() });
    await expect(workspaces.declineInvite('user-1', 'tok')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses to decline one that has expired', async () => {
    const expired = new Date(Date.now() - 86_400_000);
    const { workspaces } = service({ ...stored, expiresAt: expired });
    await expect(workspaces.declineInvite('user-1', 'tok')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses a token it does not know', async () => {
    const { workspaces } = service(null);
    await expect(workspaces.declineInvite('user-1', 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('acceptInvite, once declining exists', () => {
  it('will not take one that was turned down', async () => {
    const prisma = {
      invite: {
        findUnique: async () => ({
          ...stored,
          declinedAt: new Date(),
          workspace: { id: 'ws-1', name: 'Ledger' },
        }),
      },
    } as unknown as PrismaService;
    const workspaces = new WorkspacesService(
      prisma,
      {} as AccessService,
      {} as CollabService,
      {} as AppConfig,
    );
    await expect(workspaces.acceptInvite('user-1', 'tok')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
