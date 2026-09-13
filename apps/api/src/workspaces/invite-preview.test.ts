import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../config/env.js';
import type { PrismaService } from '../common/prisma.service.js';
import type { CollabService } from '../collab/collab.service.js';
import type { AccessService } from './access.service.js';
import { WorkspacesService } from './workspaces.service.js';

const later = new Date(Date.now() + 86_400_000);

function service(invite: Record<string, unknown> | null) {
  const prisma = {
    invite: { findUnique: async () => invite },
  } as unknown as PrismaService;

  return new WorkspacesService(
    prisma,
    {} as AccessService,
    {} as CollabService,
    {} as AppConfig,
  );
}

const stored = {
  id: 'invite-1',
  role: 'EDITOR',
  email: 'jae@example.com',
  acceptedAt: null,
  declinedAt: null,
  expiresAt: later,
  workspace: { id: 'ws-1', name: 'Ledger' },
  createdBy: { name: 'Sam' },
};

describe('previewInvite', () => {
  it('says what the invitation is, without a session', async () => {
    await expect(service(stored).previewInvite('tok')).resolves.toEqual({
      workspace: { id: 'ws-1', name: 'Ledger' },
      role: 'EDITOR',
      invitedBy: { name: 'Sam' },
      email: 'jae@example.com',
      status: 'open',
    });
  });

  it('reports what has become of it rather than hiding it', async () => {
    await expect(
      service({ ...stored, declinedAt: new Date() }).previewInvite('tok'),
    ).resolves.toMatchObject({ status: 'declined' });
    await expect(
      service({ ...stored, expiresAt: new Date(Date.now() - 1) }).previewInvite('tok'),
    ).resolves.toMatchObject({ status: 'expired' });
  });

  /* A token nobody issued must not read differently from one that expired. */
  it('refuses a token it does not know', async () => {
    await expect(service(null).previewInvite('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('says nothing about who it was for when it was for nobody in particular', async () => {
    await expect(service({ ...stored, email: null }).previewInvite('tok')).resolves.toMatchObject({
      email: null,
    });
  });
});
