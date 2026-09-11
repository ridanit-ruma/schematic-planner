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

export interface FolderAccess extends ProjectAccess {
  readonly folderId: string;
}

/**
 * Something in the trash is not there as far as every ordinary route is
 * concerned. Only the trash itself asks to see it, and it says so.
 */
export interface AccessOptions {
  readonly includeTrashed?: boolean;
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
      include: { user: { select: { suspendedAt: true } } },
    });

    // Something the caller cannot see is reported as missing rather than
    // forbidden: "forbidden" would confirm that it exists.
    if (membership === null) throw new NotFoundException('Workspace not found');

    // Suspension is asked about here rather than only at sign-in, because this
    // is the one place every authorisation decision passes through and the
    // collaboration socket is not one of the places that goes near
    // `AuthService`. Said plainly rather than reported as missing: a suspended
    // account knows it is suspended, and a workspace it can no longer reach is
    // not a workspace whose existence is a secret from it. Carried on the
    // membership query, so no path pays for a second round trip.
    if (membership.user.suspendedAt !== null) {
      throw new ForbiddenException('This account is suspended');
    }
    if (!atLeast(membership.role, required)) {
      throw new ForbiddenException(`This action requires the ${required} role`);
    }
    return membership.role;
  }

  async requireProject(
    userId: string,
    projectId: string,
    required: Role,
    options: AccessOptions = {},
  ): Promise<ProjectAccess> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true, deletedAt: true },
    });
    if (project === null) throw new NotFoundException('Project not found');
    if (project.deletedAt !== null && options.includeTrashed !== true) {
      throw new NotFoundException('Project not found');
    }

    const role = await this.requireWorkspace(userId, project.workspaceId, required).catch(() => {
      throw new NotFoundException('Project not found');
    });

    return { projectId: project.id, workspaceId: project.workspaceId, role };
  }

  async requireFolder(
    userId: string,
    folderId: string,
    required: Role,
    options: AccessOptions = {},
  ): Promise<FolderAccess> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: {
        id: true,
        deletedAt: true,
        project: { select: { id: true, workspaceId: true, deletedAt: true } },
      },
    });
    if (folder === null) throw new NotFoundException('Folder not found');
    // A folder under a trashed project is in the trash with it, even though
    // only the project carries the mark.
    const trashed = folder.deletedAt !== null || folder.project.deletedAt !== null;
    if (trashed && options.includeTrashed !== true) throw new NotFoundException('Folder not found');

    const role = await this.requireWorkspace(userId, folder.project.workspaceId, required).catch(
      () => {
        throw new NotFoundException('Folder not found');
      },
    );

    return {
      folderId: folder.id,
      projectId: folder.project.id,
      workspaceId: folder.project.workspaceId,
      role,
    };
  }

  async requirePlan(
    userId: string,
    planId: string,
    required: Role,
    options: AccessOptions = {},
  ): Promise<PlanAccess> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        deletedAt: true,
        folder: { select: { deletedAt: true } },
        project: { select: { id: true, workspaceId: true, deletedAt: true } },
      },
    });
    if (plan === null) throw new NotFoundException('Plan not found');
    // A plan under a trashed folder or project is in the trash with it, even
    // though only the container carries the mark.
    const trashed =
      plan.deletedAt !== null ||
      plan.folder?.deletedAt != null ||
      plan.project.deletedAt !== null;
    if (trashed && options.includeTrashed !== true) throw new NotFoundException('Plan not found');

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
