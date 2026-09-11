import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma.service.js';
import { AccessService } from '../workspaces/access.service.js';

export interface TrashItem {
  kind: 'plan' | 'project' | 'folder';
  id: string;
  name: string;
  /** Where it was: the project a plan sat in, or how much a project held. */
  where: string;
  deletedAt: Date;
  by: { name: string; avatarUrl: string | null } | null;
  /**
   * The plan is still answering a public share link. Trashing does not drop the
   * share -- the trash is reversible, and a fresh token would not be the link
   * people already have -- so this screen is where it can be turned off.
   */
  shared: boolean;
}

/**
 * What has been thrown away, and the two ways out of it.
 *
 * Deleting is the one action in the product that destroys work somebody else
 * may still want, so it does not destroy anything: it sets `deletedAt` and
 * every listing stops looking. Emptying the trash is the act that actually
 * removes rows, and it is separate, named, and asked for on purpose.
 */
@Injectable()
export class TrashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(userId: string, workspaceId: string): Promise<TrashItem[]> {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');

    const [projects, folders, plans] = await Promise.all([
      this.prisma.project.findMany({
        where: { workspaceId, deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          name: true,
          deletedAt: true,
          deletedBy: { select: { name: true, avatarUrl: true } },
          _count: { select: { plans: true } },
        },
      }),
      this.prisma.folder.findMany({
        where: { deletedAt: { not: null }, project: { workspaceId } },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          name: true,
          deletedAt: true,
          deletedBy: { select: { name: true, avatarUrl: true } },
          project: { select: { name: true } },
          _count: { select: { plans: true } },
        },
      }),
      this.prisma.plan.findMany({
        where: { deletedAt: { not: null }, project: { workspaceId } },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          title: true,
          deletedAt: true,
          deletedBy: { select: { name: true, avatarUrl: true } },
          project: { select: { name: true } },
          share: { select: { id: true } },
        },
      }),
    ]);

    const items: TrashItem[] = [
      ...projects.map((project) => ({
        kind: 'project' as const,
        id: project.id,
        name: project.name,
        where:
          project._count.plans === 1 ? '1 plan inside' : `${project._count.plans} plans inside`,
        deletedAt: project.deletedAt as Date,
        by: project.deletedBy,
        shared: false,
      })),
      ...folders.map((folder) => ({
        kind: 'folder' as const,
        id: folder.id,
        name: folder.name,
        where:
          folder._count.plans === 1
            ? `1 plan inside, in ${folder.project.name}`
            : `${folder._count.plans} plans inside, in ${folder.project.name}`,
        deletedAt: folder.deletedAt as Date,
        by: folder.deletedBy,
        shared: false,
      })),
      ...plans.map((plan) => ({
        kind: 'plan' as const,
        id: plan.id,
        name: plan.title === '' ? 'Untitled plan' : plan.title,
        where: plan.project.name,
        deletedAt: plan.deletedAt as Date,
        by: plan.deletedBy,
        shared: plan.share !== null,
      })),
    ];

    return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  }

  async restorePlan(userId: string, planId: string): Promise<{ ok: true }> {
    const access = await this.access.requirePlan(userId, planId, 'ADMIN', { includeTrashed: true });
    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: planId },
      select: { folderId: true },
    });

    // Restoring into a project or folder that is itself in the trash would put
    // the plan somewhere nobody can reach, so its containers come back with it.
    await this.prisma.$transaction([
      this.prisma.project.updateMany({
        where: { id: access.projectId, deletedAt: { not: null } },
        data: { deletedAt: null, deletedById: null },
      }),
      ...(plan.folderId === null
        ? []
        : [
            this.prisma.folder.updateMany({
              where: { id: plan.folderId, deletedAt: { not: null } },
              data: { deletedAt: null, deletedById: null },
            }),
          ]),
      this.prisma.plan.update({
        where: { id: planId },
        data: { deletedAt: null, deletedById: null },
      }),
    ]);
    return { ok: true };
  }

  async restoreFolder(userId: string, folderId: string): Promise<{ ok: true }> {
    const access = await this.access.requireFolder(userId, folderId, 'ADMIN', {
      includeTrashed: true,
    });
    await this.prisma.$transaction([
      this.prisma.project.updateMany({
        where: { id: access.projectId, deletedAt: { not: null } },
        data: { deletedAt: null, deletedById: null },
      }),
      this.prisma.folder.update({
        where: { id: folderId },
        data: { deletedAt: null, deletedById: null },
      }),
    ]);
    return { ok: true };
  }

  async restoreProject(userId: string, projectId: string): Promise<{ ok: true }> {
    await this.access.requireProject(userId, projectId, 'ADMIN', { includeTrashed: true });
    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: null, deletedById: null },
    });
    return { ok: true };
  }

  async purgePlan(userId: string, planId: string): Promise<{ ok: true }> {
    await this.access.requirePlan(userId, planId, 'ADMIN', { includeTrashed: true });
    await this.prisma.plan.delete({ where: { id: planId } });
    return { ok: true };
  }

  /**
   * The folder goes; the plans that were in it do not. `onDelete: SetNull` puts
   * them back at the project's top level, which is the one place they are
   * certain to be reachable.
   */
  async purgeFolder(userId: string, folderId: string): Promise<{ ok: true }> {
    await this.access.requireFolder(userId, folderId, 'ADMIN', { includeTrashed: true });
    await this.prisma.folder.delete({ where: { id: folderId } });
    return { ok: true };
  }

  async purgeProject(userId: string, projectId: string): Promise<{ ok: true }> {
    await this.access.requireProject(userId, projectId, 'ADMIN', { includeTrashed: true });
    await this.prisma.project.delete({ where: { id: projectId } });
    return { ok: true };
  }

  /** Everything in this workspace's trash, gone. */
  async empty(userId: string, workspaceId: string): Promise<{ removed: number }> {
    await this.access.requireWorkspace(userId, workspaceId, 'ADMIN');

    const [plans, folders, projects] = await this.prisma.$transaction([
      // Plans filed in a discarded folder go with it: they were thrown away
      // when it was, and only the folder carries the mark.
      this.prisma.plan.deleteMany({
        where: {
          project: { workspaceId },
          OR: [{ deletedAt: { not: null } }, { folder: { deletedAt: { not: null } } }],
        },
      }),
      this.prisma.folder.deleteMany({
        where: { deletedAt: { not: null }, project: { workspaceId } },
      }),
      // After the plans, because a project takes its plans with it and the
      // count would then be short.
      this.prisma.project.deleteMany({ where: { workspaceId, deletedAt: { not: null } } }),
    ]);

    return { removed: plans.count + folders.count + projects.count };
  }
}
