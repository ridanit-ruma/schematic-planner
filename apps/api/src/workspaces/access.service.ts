import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../common/prisma.service.js';
import { atLeast, type Role } from './roles.js';

export interface PlanAccess {
  readonly planId: string;
  readonly workspaceId: string;
  readonly role: Role;
}

/**
 * Every authorisation decision in the application goes through here. Controllers
 * ask for the access they need and get an exception if the caller does not have
 * it, so no route can accidentally answer with someone else's data.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireWorkspace(userId: string, workspaceId: string, required: Role): Promise<Role> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });

    // A workspace the caller cannot see is reported as missing rather than
    // forbidden: "forbidden" would confirm that it exists.
    if (membership === null) throw new NotFoundException('Workspace not found');
    if (!atLeast(membership.role, required)) {
      throw new ForbiddenException(`This action requires the ${required} role`);
    }
    return membership.role;
  }

  async requirePlan(userId: string, planId: string, required: Role): Promise<PlanAccess> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true, workspaceId: true },
    });
    if (plan === null) throw new NotFoundException('Plan not found');

    const role = await this.requireWorkspace(userId, plan.workspaceId, required).catch(() => {
      throw new NotFoundException('Plan not found');
    });

    return { planId: plan.id, workspaceId: plan.workspaceId, role };
  }
}
