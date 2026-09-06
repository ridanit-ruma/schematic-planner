import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../common/prisma.service.js';
import { atLeast, type Role } from './roles.js';

export interface ProjectAccess {
  readonly projectId: string;
  readonly workspaceId: string;
  readonly role: Role;
}

export interface PlanAccess extends ProjectAccess {
  readonly planId: string;
}

/**
 * Every authorisation decision goes through here. Controllers ask for the access
 * they need and get an exception if the caller does not have it, so no route can
 * accidentally answer with someone else's data.
 *
 * Permission lives on the workspace and is inherited downward — a project and a
 * plan are reached by walking up to the workspace that holds them.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireWorkspace(userId: string, workspaceId: string, required: Role): Promise<Role> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });

    // Something the caller cannot see is reported as missing rather than
    // forbidden: "forbidden" would confirm that it exists.
    if (membership === null) throw new NotFoundException('Workspace not found');
    if (!atLeast(membership.role, required)) {
      throw new ForbiddenException(`This action requires the ${required} role`);
    }
    return membership.role;
  }

  async requireProject(userId: string, projectId: string, required: Role): Promise<ProjectAccess> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });
    if (project === null) throw new NotFoundException('Project not found');

    const role = await this.requireWorkspace(userId, project.workspaceId, required).catch(() => {
      throw new NotFoundException('Project not found');
    });

    return { projectId: project.id, workspaceId: project.workspaceId, role };
  }

  async requirePlan(userId: string, planId: string, required: Role): Promise<PlanAccess> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true, project: { select: { id: true, workspaceId: true } } },
    });
    if (plan === null) throw new NotFoundException('Plan not found');

    const role = await this.requireWorkspace(userId, plan.project.workspaceId, required).catch(
      () => {
        throw new NotFoundException('Plan not found');
      },
    );

    return {
      planId: plan.id,
      projectId: plan.project.id,
      workspaceId: plan.project.workspaceId,
      role,
    };
  }
}
