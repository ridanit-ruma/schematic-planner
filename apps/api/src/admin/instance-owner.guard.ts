import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma.service.js';
import type { AuthUser } from '../auth/auth.types.js';

/**
 * Nothing behind this is reachable by anyone but the instance's owner.
 *
 * Asked of the database rather than read from the token: standing in the
 * instance can be taken away, and a token issued fifteen minutes ago should not
 * still administer it. Admin routes are rare enough for the extra read to cost
 * nothing that matters.
 */
@Injectable()
export class InstanceOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const id = request.user?.id;
    if (id === undefined) throw new ForbiddenException('Not the owner of this instance');

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { instanceRole: true, suspendedAt: true },
    });
    if (user?.instanceRole !== 'OWNER' || user.suspendedAt !== null) {
      // The same answer as for a route that does not exist would be tidier, but
      // Nest has already routed by the time a guard runs.
      throw new ForbiddenException('Not the owner of this instance');
    }
    return true;
  }
}
