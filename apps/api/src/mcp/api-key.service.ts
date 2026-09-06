import { Injectable } from '@nestjs/common';

import { hashToken } from '../common/crypto.js';
import { PrismaService } from '../common/prisma.service.js';

export interface McpIdentity {
  readonly userId: string;
  readonly keyId: string;
  /**
   * Set only on a key issued under the older model, which was tied to one
   * workspace. Null means the key acts as its owner everywhere they are a
   * member, which is what every key issued now does.
   */
  readonly workspaceId: string | null;
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

    return { userId: key.userId, keyId: key.id, workspaceId: key.workspaceId };
  }
}
