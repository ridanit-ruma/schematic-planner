import { Injectable } from '@nestjs/common';

import { hashToken } from '../common/crypto.js';
import { PrismaService } from '../common/prisma.service.js';

export interface McpIdentity {
  readonly userId: string;
  readonly workspaceId: string;
  readonly keyId: string;
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves a Bearer credential, or null if it is unknown or revoked. */
  async resolve(secret: string): Promise<McpIdentity | null> {
    const key = await this.prisma.apiKey.findUnique({ where: { hash: hashToken(secret) } });
    if (key === null || key.revokedAt !== null) return null;

    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return { userId: key.userId, workspaceId: key.workspaceId, keyId: key.id };
  }
}
