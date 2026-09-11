import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../common/prisma.service.js';
import { AccessService } from '../workspaces/access.service.js';
import { ApiKeyService } from './api-key.service.js';

/**
 * Suspension used to be enforced at sign-in and nowhere else, so an account
 * that held an API key kept full read and write over `/mcp` — a public route
 * that resolves the key itself and never passes through the guard — and an
 * account holding an unexpired access token kept REST and the collaboration
 * socket for the rest of its fifteen minutes. Ending the sessions stopped
 * neither: a session is the refresh token.
 *
 * These are the three gates that now ask. A fake Prisma is enough — what is
 * being tested is which question gets asked, not how the row is fetched.
 */

const SUSPENDED = new Date('2026-09-11T00:00:00.000Z');

function keyService(user: { name: string; suspendedAt: Date | null }): ApiKeyService {
  const prisma = {
    apiKey: {
      findUnique: async () => ({
        id: 'key-1',
        userId: 'user-1',
        workspaceId: null,
        revokedAt: null,
        user,
      }),
      update: async () => undefined,
    },
  } as unknown as PrismaService;
  return new ApiKeyService(prisma);
}

function accessService(suspendedAt: Date | null, role = 'EDITOR'): AccessService {
  const prisma = {
    membership: {
      findUnique: async () => ({ role, user: { suspendedAt } }),
    },
  } as unknown as PrismaService;
  return new AccessService(prisma);
}

describe('an API key whose owner is suspended', () => {
  it('does not resolve', async () => {
    const service = keyService({ name: 'Ruma', suspendedAt: SUSPENDED });
    expect(await service.resolve('sp_whatever')).toBeNull();
  });

  /* Suspension is reversible, so the key is refused rather than revoked:
     letting somebody back in restores what they had. */
  it('resolves again once the suspension is lifted', async () => {
    const service = keyService({ name: 'Ruma', suspendedAt: null });
    expect(await service.resolve('sp_whatever')).toMatchObject({ userId: 'user-1' });
  });
});

describe('authorisation while suspended', () => {
  it('is refused even where the membership is intact', async () => {
    await expect(accessService(SUSPENDED).requireWorkspace('user-1', 'ws-1', 'VIEWER')).rejects.
      toBeInstanceOf(ForbiddenException);
  });

  /* The collaboration socket authorises by calling straight into here and never
     goes near AuthService, which is why the check lives at this level. */
  it('is refused at the lowest role there is, not only at the write roles', async () => {
    await expect(
      accessService(SUSPENDED, 'OWNER').requireWorkspace('user-1', 'ws-1', 'VIEWER'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still lets an ordinary member through', async () => {
    expect(await accessService(null).requireWorkspace('user-1', 'ws-1', 'VIEWER')).toBe('EDITOR');
  });

  it('still refuses a non-member as missing rather than forbidden', async () => {
    const prisma = {
      membership: { findUnique: async () => null },
    } as unknown as PrismaService;
    await expect(
      new AccessService(prisma).requireWorkspace('user-1', 'ws-1', 'VIEWER'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
